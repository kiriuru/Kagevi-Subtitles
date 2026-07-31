use std::collections::{HashMap, VecDeque};

const MAX_PREVIEW_LINEAGES: usize = 1024;

#[derive(Debug, Default)]
pub struct TranslationPreviewLineage {
    generations: HashMap<String, u64>,
    order: VecDeque<String>,
}

impl TranslationPreviewLineage {
    pub fn lineage_key(segment_id: Option<&str>, _revision: Option<u64>) -> Option<String> {
        let segment = segment_id?.trim();
        if segment.is_empty() {
            return None;
        }
        Some(segment.to_string())
    }

    pub fn supersede(&mut self, key: Option<&str>) -> u64 {
        let Some(key) = key.filter(|k| !k.is_empty()) else {
            return 0;
        };
        if let Some(position) = self.order.iter().position(|candidate| candidate == key) {
            self.order.remove(position);
        }
        self.order.push_back(key.to_string());
        while self.order.len() > MAX_PREVIEW_LINEAGES {
            if let Some(oldest) = self.order.pop_front() {
                self.generations.remove(&oldest);
            }
        }
        let entry = self.generations.entry(key.to_string()).or_insert(0);
        *entry += 1;
        *entry
    }

    pub fn generation(&self, key: &str) -> u64 {
        self.generations.get(key).copied().unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn supersede_increments_generation_for_same_key() {
        let mut lineage = TranslationPreviewLineage::default();
        assert_eq!(lineage.supersede(Some("seg")), 1);
        assert_eq!(lineage.supersede(Some("seg")), 2);
        assert_eq!(lineage.generation("seg"), 2);
    }

    #[test]
    fn lineage_key_is_stable_across_revisions() {
        assert_eq!(
            TranslationPreviewLineage::lineage_key(Some("seg"), Some(1)),
            Some("seg".into())
        );
        assert_eq!(
            TranslationPreviewLineage::lineage_key(Some("seg"), Some(99)),
            Some("seg".into())
        );
    }

    #[test]
    fn generation_counters_are_bounded() {
        let mut lineage = TranslationPreviewLineage::default();
        for index in 0..=MAX_PREVIEW_LINEAGES {
            let key = format!("seg-{index}");
            assert_eq!(lineage.supersede(Some(&key)), 1);
        }
        assert_eq!(lineage.generations.len(), MAX_PREVIEW_LINEAGES);
        assert_eq!(lineage.generation("seg-0"), 0);
    }
}
