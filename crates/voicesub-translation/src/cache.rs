use std::collections::{HashMap, VecDeque};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tracing::warn;

pub(crate) const DEFAULT_MAX_ENTRIES: usize = 5000;
const MAX_EPHEMERAL_ENTRIES: usize = 256;
const FLUSH_INTERVAL: Duration = Duration::from_secs(2);

#[derive(Debug)]
struct CacheState {
    entries: HashMap<String, String>,
    order: VecDeque<String>,
    ephemeral_entries: HashMap<String, String>,
    ephemeral_order: VecDeque<String>,
    max_entries: usize,
    enabled: bool,
    persist: bool,
    dirty: bool,
    loaded: bool,
    cache_file: Option<PathBuf>,
    last_flush_scheduled: Option<Instant>,
}

impl CacheState {
    fn new(cache_dir: Option<PathBuf>, max_entries: usize) -> Self {
        let cache_file = cache_dir.map(|dir| dir.join("translation_cache.json"));
        if let Some(ref path) = cache_file {
            if let Some(parent) = path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            if !path.exists() {
                let _ = fs::write(path, "{}");
            }
        }
        Self {
            entries: HashMap::new(),
            order: VecDeque::new(),
            ephemeral_entries: HashMap::new(),
            ephemeral_order: VecDeque::new(),
            max_entries,
            enabled: true,
            persist: cache_file.is_some(),
            dirty: false,
            loaded: false,
            cache_file,
            last_flush_scheduled: None,
        }
    }

    fn ensure_loaded(&mut self) {
        if self.loaded {
            return;
        }
        self.loaded = true;
        let Some(path) = self.cache_file.clone() else {
            return;
        };
        let raw = match fs::read_to_string(&path) {
            Ok(text) => text,
            Err(_) => return,
        };
        let payload: HashMap<String, String> = if let Ok(map) = serde_json::from_str(&raw) { map } else {
            let _ = fs::write(&path, "{}");
            return;
        };
        for (key, value) in payload {
            self.insert_locked(key, value, false);
        }
        self.dirty = false;
    }

    fn touch_locked(&mut self, key: &str) {
        if let Some(pos) = self.order.iter().position(|item| item == key) {
            self.order.remove(pos);
        }
        self.order.push_back(key.to_string());
    }

    fn touch_ephemeral_locked(&mut self, key: &str) {
        if let Some(pos) = self.ephemeral_order.iter().position(|item| item == key) {
            self.ephemeral_order.remove(pos);
        }
        self.ephemeral_order.push_back(key.to_string());
    }

    fn evict_locked(&mut self) {
        if self.max_entries == 0 {
            self.entries.clear();
            self.order.clear();
            self.dirty = true;
            return;
        }
        while self.entries.len() > self.max_entries {
            if let Some(oldest) = self.order.pop_front() {
                self.entries.remove(&oldest);
                self.dirty = true;
            } else {
                break;
            }
        }
    }

    fn insert_locked(&mut self, key: String, value: String, mark_dirty: bool) {
        if self.max_entries == 0 {
            return;
        }
        if self.entries.contains_key(&key) {
            if self.entries.get(&key) == Some(&value) {
                self.touch_locked(&key);
                return;
            }
            self.entries.insert(key.clone(), value);
            self.touch_locked(&key);
        } else {
            self.entries.insert(key.clone(), value);
            self.order.push_back(key);
            self.evict_locked();
        }
        if mark_dirty {
            self.dirty = true;
        }
    }

    fn insert_ephemeral_locked(&mut self, key: String, value: String) {
        if self.max_entries == 0 {
            return;
        }
        if self.ephemeral_entries.get(&key) == Some(&value) {
            self.touch_ephemeral_locked(&key);
            return;
        }
        self.ephemeral_entries.insert(key.clone(), value);
        self.touch_ephemeral_locked(&key);
        let limit = self.max_entries.min(MAX_EPHEMERAL_ENTRIES);
        while self.ephemeral_entries.len() > limit {
            if let Some(oldest) = self.ephemeral_order.pop_front() {
                self.ephemeral_entries.remove(&oldest);
            }
        }
    }

    fn get_locked(&mut self, key: &str, promote_ephemeral: bool) -> Option<String> {
        if let Some(value) = self.entries.get(key).cloned() {
            self.touch_locked(key);
            return Some(value);
        }
        let value = self.ephemeral_entries.get(key).cloned()?;
        self.touch_ephemeral_locked(key);
        if promote_ephemeral {
            self.ephemeral_entries.remove(key);
            if let Some(position) = self.ephemeral_order.iter().position(|item| item == key) {
                self.ephemeral_order.remove(position);
            }
            self.insert_locked(key.to_string(), value.clone(), true);
        }
        Some(value)
    }

    fn clear_locked(&mut self) {
        self.entries.clear();
        self.order.clear();
        self.ephemeral_entries.clear();
        self.ephemeral_order.clear();
        self.dirty = false;
        if self.persist
            && let Some(path) = self.cache_file.clone()
        {
            let _ = Self::write_atomic(&path, &HashMap::new());
        }
    }

    fn write_atomic(path: &Path, payload: &HashMap<String, String>) -> std::io::Result<()> {
        let temp = path.with_extension("tmp");
        let body = serde_json::to_string_pretty(payload).unwrap_or_else(|_| "{}".into());
        fs::write(&temp, body)?;
        fs::rename(temp, path)?;
        Ok(())
    }

    fn flush_dirty(&mut self) {
        if !self.persist || !self.dirty {
            return;
        }
        let Some(path) = self.cache_file.clone() else {
            return;
        };
        let snapshot = self.entries.clone();
        self.dirty = false;
        if let Err(err) = Self::write_atomic(&path, &snapshot) {
            warn!(?err, "translation cache flush failed");
            self.dirty = true;
        }
    }

    fn maybe_flush(&mut self) {
        if !self.persist || !self.dirty {
            return;
        }
        let now = Instant::now();
        if let Some(last) = self.last_flush_scheduled
            && now.duration_since(last) < FLUSH_INTERVAL
        {
            return;
        }
        self.last_flush_scheduled = Some(now);
        self.flush_dirty();
    }
}

#[derive(Debug)]
pub struct TranslationCache {
    state: Mutex<CacheState>,
}

impl TranslationCache {
    pub fn with_dir(cache_dir: Option<PathBuf>, max_entries: usize) -> Self {
        Self {
            state: Mutex::new(CacheState::new(cache_dir, max_entries)),
        }
    }

    pub fn clear(&self) {
        let mut state = self.state.lock().expect("cache lock");
        state.ensure_loaded();
        state.clear_locked();
    }

    pub fn get(&self, key: &str) -> Option<String> {
        let mut state = self.state.lock().expect("cache lock");
        if !state.enabled {
            return None;
        }
        state.ensure_loaded();
        state.get_locked(key, false)
    }

    /// Read a cached value and promote an exact live-preview hit to persistent final cache.
    pub fn get_promoting_ephemeral(&self, key: &str) -> Option<String> {
        let mut state = self.state.lock().expect("cache lock");
        if !state.enabled {
            return None;
        }
        state.ensure_loaded();
        let value = state.get_locked(key, true);
        state.maybe_flush();
        value
    }

    pub fn insert(&self, key: String, value: String) {
        let mut state = self.state.lock().expect("cache lock");
        if !state.enabled || state.max_entries == 0 {
            return;
        }
        state.ensure_loaded();
        state.ephemeral_entries.remove(&key);
        if let Some(position) = state.ephemeral_order.iter().position(|item| item == &key) {
            state.ephemeral_order.remove(position);
        }
        state.insert_locked(key, value, true);
        state.maybe_flush();
    }

    /// Memory-only insert (no disk dirty bit). Used by live-partial MT so finals can
    /// reuse the last draft via cache hit without persisting incomplete phrases.
    pub fn insert_ephemeral(&self, key: String, value: String) {
        let mut state = self.state.lock().expect("cache lock");
        if !state.enabled || state.max_entries == 0 {
            return;
        }
        state.ensure_loaded();
        state.insert_ephemeral_locked(key, value);
    }

    pub fn update_settings(&self, enabled: bool, persist: bool, max_entries: Option<usize>) {
        let mut state = self.state.lock().expect("cache lock");
        if !enabled {
            state.enabled = false;
            state.clear_locked();
            return;
        }
        state.enabled = true;
        if let Some(max) = max_entries {
            state.max_entries = max;
            state.evict_locked();
            let ephemeral_limit = max.min(MAX_EPHEMERAL_ENTRIES);
            while state.ephemeral_entries.len() > ephemeral_limit {
                if let Some(oldest) = state.ephemeral_order.pop_front() {
                    state.ephemeral_entries.remove(&oldest);
                }
            }
        }
        if !persist {
            state.persist = false;
        } else if state.cache_file.is_some() {
            state.persist = true;
        }
        state.maybe_flush();
    }

    #[cfg(test)]
    pub fn flush_now(&self) {
        let mut state = self.state.lock().expect("cache lock");
        state.flush_dirty();
    }

    pub fn enabled(&self) -> bool {
        self.state.lock().expect("cache lock").enabled
    }
}

impl Drop for TranslationCache {
    fn drop(&mut self) {
        if let Ok(mut state) = self.state.lock() {
            state.flush_dirty();
        }
    }
}

/// Stable FNV-1a 64-bit hash for cache key text (keeps keys short on disk).
fn hash_text(text: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in text.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}:{}", text.len())
}

pub fn cache_key(
    provider: &str,
    source_lang: &str,
    target_lang: &str,
    source_text: &str,
) -> String {
    format!(
        "{provider}::{source_lang}::{target_lang}::{}",
        hash_text(source_text)
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_cache_dir() -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        std::env::temp_dir().join(format!("vs-cache-test-{stamp}"))
    }

    #[test]
    fn lru_evicts_oldest_entry() {
        let cache = TranslationCache::with_dir(None, 2);
        cache.insert("a".into(), "1".into());
        cache.insert("b".into(), "2".into());
        cache.insert("c".into(), "3".into());
        assert_eq!(cache.get("a"), None);
        assert_eq!(cache.get("b"), Some("2".into()));
        assert_eq!(cache.get("c"), Some("3".into()));
    }

    #[test]
    fn touch_moves_entry_to_recent() {
        let cache = TranslationCache::with_dir(None, 2);
        cache.insert("a".into(), "1".into());
        cache.insert("b".into(), "2".into());
        assert_eq!(cache.get("a"), Some("1".into()));
        cache.insert("c".into(), "3".into());
        assert_eq!(cache.get("b"), None);
        assert_eq!(cache.get("a"), Some("1".into()));
    }

    #[test]
    fn persist_roundtrip() {
        let dir = temp_cache_dir();
        let cache = TranslationCache::with_dir(Some(dir.clone()), DEFAULT_MAX_ENTRIES);
        cache.insert(
            cache_key("google_translate_v2", "en", "fr", "hello"),
            "bonjour".into(),
        );
        cache.flush_now();
        let reloaded = TranslationCache::with_dir(Some(dir.clone()), DEFAULT_MAX_ENTRIES);
        assert_eq!(
            reloaded.get(&cache_key("google_translate_v2", "en", "fr", "hello")),
            Some("bonjour".into())
        );
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn ephemeral_entries_never_leak_into_persistent_snapshot() {
        let dir = temp_cache_dir();
        let ephemeral_key = cache_key("stub", "en", "fr", "hello");
        let persistent_key = cache_key("stub", "en", "fr", "final");
        {
            let cache = TranslationCache::with_dir(Some(dir.clone()), DEFAULT_MAX_ENTRIES);
            cache.insert_ephemeral(ephemeral_key.clone(), "bonjour".into());
            cache.insert(persistent_key.clone(), "final-fr".into());
            cache.flush_now();
        }
        let reloaded = TranslationCache::with_dir(Some(dir.clone()), DEFAULT_MAX_ENTRIES);
        assert_eq!(reloaded.get(&ephemeral_key), None);
        assert_eq!(reloaded.get(&persistent_key), Some("final-fr".into()));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn exact_final_hit_promotes_ephemeral_entry() {
        let dir = temp_cache_dir();
        let key = cache_key("stub", "en", "fr", "hello");
        {
            let cache = TranslationCache::with_dir(Some(dir.clone()), DEFAULT_MAX_ENTRIES);
            cache.insert_ephemeral(key.clone(), "bonjour".into());
            assert_eq!(
                cache.get_promoting_ephemeral(&key),
                Some("bonjour".into())
            );
            cache.flush_now();
        }
        let reloaded = TranslationCache::with_dir(Some(dir.clone()), DEFAULT_MAX_ENTRIES);
        assert_eq!(reloaded.get(&key), Some("bonjour".into()));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn ephemeral_churn_cannot_evict_persistent_lru() {
        let cache = TranslationCache::with_dir(None, 2);
        cache.insert("final-a".into(), "a".into());
        cache.insert("final-b".into(), "b".into());
        for index in 0..20 {
            cache.insert_ephemeral(format!("draft-{index}"), index.to_string());
        }
        assert_eq!(cache.get("final-a"), Some("a".into()));
        assert_eq!(cache.get("final-b"), Some("b".into()));
    }

    #[test]
    fn max_entries_zero_disables_inserts() {
        let cache = TranslationCache::with_dir(None, 0);
        cache.insert("a".into(), "1".into());
        assert_eq!(cache.get("a"), None);
    }

    #[test]
    fn cache_key_is_stable_and_compact() {
        let key = cache_key("stub", "en", "fr", "hello world");
        assert!(key.starts_with("stub::en::fr::"));
        assert!(!key.contains("hello world"));
        assert_eq!(
            cache_key("stub", "en", "fr", "hello world"),
            cache_key("stub", "en", "fr", "hello world")
        );
    }
}
