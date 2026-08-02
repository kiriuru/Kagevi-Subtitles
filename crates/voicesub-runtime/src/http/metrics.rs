use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};

use serde_json::{Value, json};
use voicesub_ws::EventsHubDiagnostics;

#[derive(Debug, Default)]
struct MetricsInner {
    asr_partial_ms: Option<f64>,
    asr_final_ms: Option<f64>,
    translation_metrics: Value,
}

/// Browser/runtime counters surfaced in `/api/runtime/status` metrics.
#[derive(Debug)]
pub struct RuntimeMetricsCollector {
    browser_transcripts_received: AtomicU64,
    browser_partials_published: AtomicU64,
    browser_finals_published: AtomicU64,
    partial_updates_emitted: AtomicU64,
    finals_emitted: AtomicU64,
    suppressed_partial_updates: AtomicU64,
    runtime_status_broadcast_count: AtomicU64,
    runtime_status_duplicate_suppressed: AtomicU64,
    runtime_status_heartbeat_sent: AtomicU64,
    runtime_events_duplicate_suppressed: AtomicU64,
    event_bus_consumer_lagged_total: AtomicU64,
    event_bus_consumer_lagged_messages_skipped: AtomicU64,
    overlay_ipc_coalesced_suppressed: AtomicU64,
    inner: Mutex<MetricsInner>,
}

impl Default for RuntimeMetricsCollector {
    fn default() -> Self {
        Self::new()
    }
}

impl RuntimeMetricsCollector {
    pub fn new() -> Self {
        Self {
            browser_transcripts_received: AtomicU64::new(0),
            browser_partials_published: AtomicU64::new(0),
            browser_finals_published: AtomicU64::new(0),
            partial_updates_emitted: AtomicU64::new(0),
            finals_emitted: AtomicU64::new(0),
            suppressed_partial_updates: AtomicU64::new(0),
            runtime_status_broadcast_count: AtomicU64::new(0),
            runtime_status_duplicate_suppressed: AtomicU64::new(0),
            runtime_status_heartbeat_sent: AtomicU64::new(0),
            runtime_events_duplicate_suppressed: AtomicU64::new(0),
            event_bus_consumer_lagged_total: AtomicU64::new(0),
            event_bus_consumer_lagged_messages_skipped: AtomicU64::new(0),
            overlay_ipc_coalesced_suppressed: AtomicU64::new(0),
            inner: Mutex::new(MetricsInner::default()),
        }
    }

    pub fn record_runtime_status_broadcast(&self) {
        self.runtime_status_broadcast_count
            .fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_runtime_status_duplicate_suppressed(&self) {
        self.runtime_status_duplicate_suppressed
            .fetch_add(1, Ordering::Relaxed);
        self.record_runtime_events_duplicate_suppressed();
    }

    pub fn record_runtime_status_heartbeat_sent(&self) {
        self.runtime_status_heartbeat_sent
            .fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_runtime_events_duplicate_suppressed(&self) {
        self.runtime_events_duplicate_suppressed
            .fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_event_bus_consumer_lagged(&self, skipped: u64) {
        self.event_bus_consumer_lagged_total
            .fetch_add(1, Ordering::Relaxed);
        self.event_bus_consumer_lagged_messages_skipped
            .fetch_add(skipped, Ordering::Relaxed);
    }

    pub fn record_overlay_ipc_coalesced(&self) {
        self.overlay_ipc_coalesced_suppressed
            .fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_browser_transcript_received(&self) {
        self.browser_transcripts_received
            .fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_suppressed_partial(&self) {
        self.suppressed_partial_updates
            .fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_partial_published(&self, latency_ms: Option<f64>) {
        self.browser_partials_published
            .fetch_add(1, Ordering::Relaxed);
        self.partial_updates_emitted.fetch_add(1, Ordering::Relaxed);
        if let Ok(mut inner) = self.inner.lock() {
            inner.asr_partial_ms = latency_ms;
        }
    }

    pub fn record_translation_metrics(&self, metrics: Value) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.translation_metrics = metrics;
        }
    }

    pub fn record_final_published(&self, latency_ms: Option<f64>) {
        self.browser_finals_published
            .fetch_add(1, Ordering::Relaxed);
        self.finals_emitted.fetch_add(1, Ordering::Relaxed);
        if let Ok(mut inner) = self.inner.lock() {
            inner.asr_final_ms = latency_ms;
        }
    }

    pub fn reset(&self) {
        self.browser_transcripts_received
            .store(0, Ordering::Relaxed);
        self.browser_partials_published.store(0, Ordering::Relaxed);
        self.browser_finals_published.store(0, Ordering::Relaxed);
        self.partial_updates_emitted.store(0, Ordering::Relaxed);
        self.finals_emitted.store(0, Ordering::Relaxed);
        self.suppressed_partial_updates.store(0, Ordering::Relaxed);
        self.runtime_status_broadcast_count
            .store(0, Ordering::Relaxed);
        self.runtime_status_duplicate_suppressed
            .store(0, Ordering::Relaxed);
        self.runtime_status_heartbeat_sent
            .store(0, Ordering::Relaxed);
        self.runtime_events_duplicate_suppressed
            .store(0, Ordering::Relaxed);
        self.event_bus_consumer_lagged_total
            .store(0, Ordering::Relaxed);
        self.event_bus_consumer_lagged_messages_skipped
            .store(0, Ordering::Relaxed);
        self.overlay_ipc_coalesced_suppressed
            .store(0, Ordering::Relaxed);
        if let Ok(mut inner) = self.inner.lock() {
            *inner = MetricsInner::default();
        }
    }

    pub fn snapshot(
        &self,
        ws_diag: &EventsHubDiagnostics,
        browser_stale_dropped: u64,
        translation_metrics: &Value,
    ) -> Value {
        let inner = self.inner.lock().ok();
        let asr_partial_ms = inner.as_ref().and_then(|v| v.asr_partial_ms);
        let asr_final_ms = inner.as_ref().and_then(|v| v.asr_final_ms);

        let mut map = serde_json::Map::new();
        map.insert(
            "ws_events_connections_active".into(),
            json!(ws_diag.connections_active),
        );
        map.insert(
            "ws_events_broadcast_count".into(),
            json!(ws_diag.broadcast_count),
        );
        map.insert(
            "ws_events_send_failures".into(),
            json!(ws_diag.send_failures),
        );
        map.insert(
            "ws_events_dead_connections_removed".into(),
            json!(ws_diag.dead_connections_removed),
        );
        map.insert(
            "ws_events_dropped_oldest".into(),
            json!(ws_diag.dropped_oldest),
        );
        map.insert(
            "ws_events_queue_max_depth_observed".into(),
            json!(ws_diag.queue_max_depth_observed),
        );
        map.insert(
            "runtime_status_broadcast_count".into(),
            json!(self.runtime_status_broadcast_count.load(Ordering::Relaxed)),
        );
        map.insert(
            "runtime_status_duplicate_suppressed".into(),
            json!(
                self.runtime_status_duplicate_suppressed
                    .load(Ordering::Relaxed)
            ),
        );
        map.insert(
            "runtime_status_heartbeat_sent".into(),
            json!(self.runtime_status_heartbeat_sent.load(Ordering::Relaxed)),
        );
        map.insert(
            "runtime_events_duplicate_suppressed".into(),
            json!(
                self.runtime_events_duplicate_suppressed
                    .load(Ordering::Relaxed)
            ),
        );
        map.insert(
            "browser_transcripts_received".into(),
            json!(self.browser_transcripts_received.load(Ordering::Relaxed)),
        );
        map.insert(
            "browser_partials_published".into(),
            json!(self.browser_partials_published.load(Ordering::Relaxed)),
        );
        map.insert(
            "browser_finals_published".into(),
            json!(self.browser_finals_published.load(Ordering::Relaxed)),
        );
        map.insert(
            "partial_updates_emitted".into(),
            json!(self.partial_updates_emitted.load(Ordering::Relaxed)),
        );
        map.insert(
            "finals_emitted".into(),
            json!(self.finals_emitted.load(Ordering::Relaxed)),
        );
        map.insert(
            "suppressed_partial_updates".into(),
            json!(self.suppressed_partial_updates.load(Ordering::Relaxed)),
        );
        map.insert(
            "event_bus_consumer_lagged_total".into(),
            json!(self.event_bus_consumer_lagged_total.load(Ordering::Relaxed)),
        );
        map.insert(
            "event_bus_consumer_lagged_messages_skipped".into(),
            json!(
                self.event_bus_consumer_lagged_messages_skipped
                    .load(Ordering::Relaxed)
            ),
        );
        map.insert(
            "overlay_ipc_coalesced_suppressed".into(),
            json!(
                self.overlay_ipc_coalesced_suppressed
                    .load(Ordering::Relaxed)
            ),
        );
        map.insert(
            "browser_transcript_stale_dropped".into(),
            json!(browser_stale_dropped),
        );
        if let Some(ms) = asr_partial_ms {
            map.insert("asr_partial_ms".into(), json!(ms));
        }
        if let Some(ms) = asr_final_ms {
            map.insert("asr_final_ms".into(), json!(ms));
        }

        let stored_translation = inner.as_ref().map(|v| v.translation_metrics.clone());
        merge_translation_metrics_into(&mut map, stored_translation.as_ref(), translation_metrics);

        Value::Object(map)
    }
}

/// Merge dispatcher metrics into the runtime metrics map.
///
/// Prefer `translation_*` keys from the live argument when present; otherwise keep
/// callback-stored dispatcher metrics. Short diagnostic aliases (`jobs_started`, …) are
/// mapped onto the prefixed names the Tools panel reads so summarized diagnostics cannot
/// wipe counters by replacing the whole object.
fn merge_translation_metrics_into(
    map: &mut serde_json::Map<String, Value>,
    stored: Option<&Value>,
    incoming: &Value,
) {
    if let Some(obj) = stored.and_then(|v| v.as_object()) {
        for (key, value) in obj {
            if key.starts_with("translation_") {
                map.insert(key.clone(), value.clone());
            }
        }
    }

    let Some(incoming_obj) = incoming.as_object() else {
        return;
    };

    let has_prefixed = incoming_obj.keys().any(|key| key.starts_with("translation_"));
    if has_prefixed {
        for (key, value) in incoming_obj {
            if key.starts_with("translation_") {
                map.insert(key.clone(), value.clone());
            }
        }
        return;
    }

    // Summarized diagnostics use short names — project them onto translation_* keys.
    const ALIASES: &[(&str, &str)] = &[
        ("queue_depth", "translation_queue_depth"),
        ("jobs_started", "translation_jobs_started"),
        ("jobs_cancelled", "translation_jobs_cancelled"),
        ("stale_results_dropped", "translation_stale_results_dropped"),
        ("last_queue_latency_ms", "translation_queue_latency_ms"),
        ("last_provider_latency_ms", "translation_provider_latency_ms"),
        ("last_runtime_reason", "translation_last_runtime_reason"),
        ("last_slot_id", "translation_last_slot_id"),
        ("last_target_lang", "translation_last_target_lang"),
        ("last_provider", "translation_last_provider"),
        ("last_timeout_ms", "translation_last_timeout_ms"),
        ("provider_skipped_before_call", "translation_provider_skipped_before_call"),
    ];
    for (short, prefixed) in ALIASES {
        if let Some(value) = incoming_obj.get(*short) {
            // Do not clobber a fresher stored prefixed value with null/empty short aliases.
            if value.is_null() && map.contains_key(*prefixed) {
                continue;
            }
            map.insert((*prefixed).into(), value.clone());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn translation_metrics_keep_prefixed_keys_when_diagnostics_use_short_names() {
        let metrics = RuntimeMetricsCollector::new();
        metrics.record_translation_metrics(json!({
            "translation_jobs_started": 7,
            "translation_queue_depth": 2,
            "translation_last_provider": "google_translate_v2",
            "translation_queue_latency_ms": 15,
        }));
        let diagnostics = json!({
            "enabled": true,
            "status": "ready",
            "jobs_started": 7,
            "queue_depth": 2,
            "last_provider": "google_translate_v2",
            "last_queue_latency_ms": 15,
        });
        let snapshot = metrics.snapshot(&EventsHubDiagnostics::default(), 0, &diagnostics);
        assert_eq!(snapshot["translation_jobs_started"], 7);
        assert_eq!(snapshot["translation_queue_depth"], 2);
        assert_eq!(snapshot["translation_last_provider"], "google_translate_v2");
        assert_eq!(snapshot["translation_queue_latency_ms"], 15);
        // Readiness noise must not replace metric keys.
        assert!(snapshot.get("enabled").is_none());
    }

    #[test]
    fn ipc_fanout_metrics_record_lag_and_coalesce() {
        let metrics = RuntimeMetricsCollector::new();
        metrics.record_event_bus_consumer_lagged(12);
        metrics.record_event_bus_consumer_lagged(3);
        metrics.record_overlay_ipc_coalesced();
        let snapshot = metrics.snapshot(&EventsHubDiagnostics::default(), 0, &json!({}));
        assert_eq!(snapshot["event_bus_consumer_lagged_total"], 2);
        assert_eq!(snapshot["event_bus_consumer_lagged_messages_skipped"], 15);
        assert_eq!(snapshot["overlay_ipc_coalesced_suppressed"], 1);
    }
}
