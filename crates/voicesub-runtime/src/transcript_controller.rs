//! Port of SST `TranscriptController` — unified transcript → subtitle → OBS → translation path.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex as StdMutex, RwLock};
use std::time::{Duration, Instant};

use serde_json::Value;
use tokio::sync::Mutex;
use tokio::task::AbortHandle;
use voicesub_obs::ObsCaptionService;
use voicesub_subtitle::{SubtitleRouter, TranscriptEvent, TranscriptKind, TranscriptSegment};
use voicesub_translation::{
    LivePartialDecideInput, LivePartialGate, LivePartialGateReason, LivePartialSettings,
    TranslationPreviewLineage,
    TranslationRuntimeController,
};
use voicesub_twitch::{
    SourceTextReplacementSettings, apply_source_text_replacement, settings_from_section_value,
};
use voicesub_ws::WsEventPublisher;

use crate::http::RuntimeMetricsCollector;
use crate::trace::RuntimePipelineLog;

/// Minimum spacing between `transcript_update` partial broadcasts (review §2). Browser
/// Web Speech emits interim hypotheses many times per second; each one previously produced
/// a `transcript_update` IPC/WS event in addition to `overlay_update`. Coalescing partials
/// here caps that rate without touching the subtitle lifecycle or overlay path (those still
/// see every partial). Final transcripts always bypass the throttle.
const PARTIAL_TRANSCRIPT_MIN_INTERVAL_MS: u64 = 90;

fn partial_transcript_min_interval() -> Duration {
    let ms = std::env::var("VOICESUB_TRANSCRIPT_PARTIAL_MIN_INTERVAL_MS")
        .ok()
        .and_then(|raw| raw.trim().parse::<u64>().ok())
        .unwrap_or(PARTIAL_TRANSCRIPT_MIN_INTERVAL_MS);
    Duration::from_millis(ms)
}

/// Leading-edge throttle for partial `transcript_update` broadcasts. A new phrase
/// (changed `segment_id`) always emits immediately; repeat partials of the same phrase are
/// rate-limited even when `event.sequence` increments on every interim hypothesis.
/// The very latest partial of a burst may be coalesced away, but the matching
/// `overlay_update` still carries it and a final transcript follows shortly.
#[derive(Debug, Default)]
struct PartialTranscriptThrottle {
    interval: Duration,
    last_emit: Option<Instant>,
    last_phrase_key: Option<String>,
}

impl PartialTranscriptThrottle {
    fn new(interval: Duration) -> Self {
        Self {
            interval,
            last_emit: None,
            last_phrase_key: None,
        }
    }

    fn should_emit_partial(&mut self, phrase_key: &str, now: Instant) -> bool {
        let new_phrase = self.last_phrase_key.as_deref() != Some(phrase_key);
        let due = self
            .last_emit
            .map(|previous| now.duration_since(previous) >= self.interval)
            .unwrap_or(true);
        if new_phrase || due {
            self.last_phrase_key = Some(phrase_key.to_string());
            self.last_emit = Some(now);
            return true;
        }
        false
    }

    fn note_final(&mut self) {
        self.last_emit = None;
        self.last_phrase_key = None;
    }
}

pub struct TranscriptController {
    subtitle: Arc<SubtitleRouter>,
    translation: Arc<Mutex<TranslationRuntimeController>>,
    obs: Arc<ObsCaptionService>,
    publisher: WsEventPublisher,
    config_snapshot: Arc<RwLock<Value>>,
    pipeline_log: RuntimePipelineLog,
    metrics: Arc<RuntimeMetricsCollector>,
    partial_throttle: StdMutex<PartialTranscriptThrottle>,
    live_partial_gate: Arc<StdMutex<LivePartialGate>>,
    /// Bumped to invalidate a timer that already woke while it is being aborted.
    live_partial_flush_generation: Arc<AtomicU64>,
    live_partial_flush_task: StdMutex<Option<AbortHandle>>,
}

impl TranscriptController {
    pub fn new(
        subtitle: Arc<SubtitleRouter>,
        translation: Arc<Mutex<TranslationRuntimeController>>,
        obs: Arc<ObsCaptionService>,
        publisher: WsEventPublisher,
        config_snapshot: Arc<RwLock<Value>>,
        pipeline_log: RuntimePipelineLog,
        metrics: Arc<RuntimeMetricsCollector>,
    ) -> Self {
        Self {
            subtitle,
            translation,
            obs,
            publisher,
            config_snapshot,
            pipeline_log,
            metrics,
            partial_throttle: StdMutex::new(PartialTranscriptThrottle::new(
                partial_transcript_min_interval(),
            )),
            live_partial_gate: Arc::new(StdMutex::new(LivePartialGate::default())),
            live_partial_flush_generation: Arc::new(AtomicU64::new(0)),
            live_partial_flush_task: StdMutex::new(None),
        }
    }

    fn replacement_settings(&self) -> SourceTextReplacementSettings {
        self.config_snapshot
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .get("source_text_replacement")
            .map(settings_from_section_value)
            .unwrap_or_default()
    }

    fn default_source_lang(&self) -> String {
        self.config_snapshot
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .get("source_lang")
            .and_then(|v| v.as_str())
            .unwrap_or("auto")
            .trim()
            .to_ascii_lowercase()
    }

    fn apply_replacement(&self, mut event: TranscriptEvent) -> TranscriptEvent {
        let settings = self.replacement_settings();
        let routed = apply_source_text_replacement(&event.text, &settings);
        event.text = routed.clone();
        if let Some(segment) = event.segment.as_mut() {
            segment.text = routed;
        }
        event
    }

    fn event_source_lang(&self, event: &TranscriptEvent) -> String {
        event
            .segment
            .as_ref()
            .map(|segment| segment.source_lang.as_str())
            .unwrap_or(self.default_source_lang().as_str())
            .trim()
            .to_ascii_lowercase()
    }

    /// SST parity: `backend/core/runtime/transcript_controller.py::handle_event`
    /// — subtitle record must exist before `submit_final` (dispatcher relevance).
    pub async fn handle_event(&self, event: TranscriptEvent, ingest_started: Option<Instant>) {
        let ingest_latency_ms = ingest_started.map(|started| {
            let ms = started.elapsed().as_secs_f64() * 1000.0;
            (ms * 10.0).round() / 10.0
        });
        let event = self.apply_replacement(event);
        // Subtitle lifecycle first; fanout must not block ingest (review §2).
        self.subtitle.handle_transcript(event.clone()).await;
        if self.should_publish_transcript(&event) {
            if event.event == TranscriptKind::Partial {
                let publisher = self.publisher.clone();
                let body = serde_json::to_value(&event).unwrap_or_default();
                tokio::spawn(async move {
                    publisher
                        .broadcast_channel("transcript_update", "transcript_update", body)
                        .await;
                });
            } else {
                self.publish_transcript(&event).await;
            }
        }
        self.publish_source_event(&event);

        if event.event == TranscriptKind::Final {
            {
                self.cancel_live_partial_trailing_flush();
                let mut gate = self
                    .live_partial_gate
                    .lock()
                    .unwrap_or_else(|e| e.into_inner());
                gate.note_final();
            }
            let source_lang = self.event_source_lang(&event);
            let preview_lineage_key = preview_lineage_key_from_segment(event.segment.as_ref());
            self.pipeline_log.live_partial_final_submit(
                event.sequence,
                event.text.chars().count(),
                preview_lineage_key.as_deref(),
            );
            // Start under the controller mutex, then drop it before submit_final's
            // relevance/await loops so status/settings are not blocked.
            let dispatcher = {
                let mut controller = self.translation.lock().await;
                controller
                    .ensure_started(voicesub_translation::DispatcherCallbacks::default())
                    .await;
                controller.dispatcher_handle()
            };
            if let Some(dispatcher) = dispatcher {
                dispatcher
                    .submit_final(
                        event.sequence,
                        &event.text,
                        &source_lang,
                        preview_lineage_key.as_deref(),
                    )
                    .await;
            }
            self.pipeline_log.asr_ingest_published(
                true,
                event.sequence,
                event.text.chars().count(),
                ingest_latency_ms,
            );
            self.metrics.record_final_published(ingest_latency_ms);
        } else {
            self.maybe_submit_live_partial(&event).await;
            self.pipeline_log.asr_ingest_published(
                false,
                event.sequence,
                event.text.chars().count(),
                ingest_latency_ms,
            );
            self.metrics.record_partial_published(ingest_latency_ms);
        }
    }

    async fn maybe_submit_live_partial(&self, event: &TranscriptEvent) {
        let translation_cfg = self
            .config_snapshot
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .get("translation")
            .cloned()
            .unwrap_or(Value::Null);
        if !translation_cfg
            .get("enabled")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            return;
        }
        let settings = LivePartialSettings::from_translation_config(&translation_cfg);
        if !settings.enabled {
            return;
        }
        let Some(segment) = event.segment.as_ref() else {
            return;
        };
        let segment_id = segment.segment_id.as_str();
        if segment_id.is_empty() {
            return;
        }
        let text_len = event.text.chars().count();
        let source_lang = self.event_source_lang(event);
        self.pipeline_log.live_partial_seen(
            event.sequence,
            segment_id,
            Some(segment.revision),
            text_len,
        );
        let decision = {
            let mut gate = self
                .live_partial_gate
                .lock()
                .unwrap_or_else(|e| e.into_inner());
            gate.decide(LivePartialDecideInput {
                segment_id,
                text: &event.text,
                sequence: event.sequence,
                revision: segment.revision,
                source_lang: &source_lang,
                settings: &settings,
                now: Instant::now(),
            })
        };
        self.pipeline_log.live_partial_gate(
            event.sequence,
            segment_id,
            decision.as_str(),
            text_len,
            decision.should_submit(),
        );
        if matches!(
            decision.reason,
            LivePartialGateReason::Coalesced | LivePartialGateReason::BelowDelta
        ) {
            let now = Instant::now();
            let delay_ms = {
                let gate = self
                    .live_partial_gate
                    .lock()
                    .unwrap_or_else(|e| e.into_inner());
                gate.pending_flush_delay_ms(&settings, now)
                    .unwrap_or(settings.min_interval_ms)
            };
            self.schedule_live_partial_trailing_flush(delay_ms);
        } else if !decision.should_submit() {
            self.cancel_live_partial_trailing_flush();
        }
        let Some(submit_text) = decision.text_to_submit.clone() else {
            return;
        };
        self.cancel_live_partial_trailing_flush();
        let preview_lineage_key = preview_lineage_key_from_segment(event.segment.as_ref());
        self.pipeline_log.live_partial_enqueued(
            event.sequence,
            segment_id,
            Some(segment.revision),
            submit_text.chars().count(),
            preview_lineage_key.as_deref(),
        );
        self.enqueue_live_partial_job(
            event.sequence,
            &submit_text,
            &source_lang,
            preview_lineage_key.as_deref(),
        )
        .await;
    }

    fn schedule_live_partial_trailing_flush(&self, delay_ms: u64) {
        let mut task_slot = self
            .live_partial_flush_task
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        if let Some(previous) = task_slot.take() {
            previous.abort();
        }
        let generation = self
            .live_partial_flush_generation
            .fetch_add(1, Ordering::AcqRel)
            + 1;
        let gate = Arc::clone(&self.live_partial_gate);
        let flush_gen = Arc::clone(&self.live_partial_flush_generation);
        let translation = Arc::clone(&self.translation);
        let config_snapshot = Arc::clone(&self.config_snapshot);
        let pipeline_log = self.pipeline_log.clone();
        let task = tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(delay_ms.max(1))).await;
            if flush_gen.load(Ordering::Acquire) != generation {
                return;
            }
            let translation_cfg = config_snapshot
                .read()
                .unwrap_or_else(|e| e.into_inner())
                .get("translation")
                .cloned()
                .unwrap_or(Value::Null);
            if !translation_cfg
                .get("enabled")
                .and_then(|v| v.as_bool())
                .unwrap_or(false)
            {
                return;
            }
            let live_settings = LivePartialSettings::from_translation_config(&translation_cfg);
            if !live_settings.enabled {
                return;
            }
            let (decision, segment_id, sequence, revision, source_lang) = {
                let mut g = gate.lock().unwrap_or_else(|e| e.into_inner());
                let segment_id = g.pending_segment_id().map(str::to_string);
                let sequence = g.pending_sequence();
                let revision = g.pending_revision();
                let source_lang = g.pending_source_lang().map(str::to_string);
                let decision = g.flush_pending_due(&live_settings, Instant::now());
                (decision, segment_id, sequence, revision, source_lang)
            };
            if flush_gen.load(Ordering::Acquire) != generation {
                return;
            }
            let Some(submit_text) = decision.text_to_submit.clone() else {
                return;
            };
            let Some(segment_id) = segment_id else {
                return;
            };
            let sequence = sequence.unwrap_or(0);
            let revision = revision.unwrap_or(0);
            let source_lang = source_lang.unwrap_or_else(|| "auto".to_string());
            let preview_lineage_key = segment_id.clone();
            pipeline_log.live_partial_gate(
                sequence,
                &segment_id,
                decision.as_str(),
                submit_text.chars().count(),
                true,
            );
            pipeline_log.live_partial_enqueued(
                sequence,
                &segment_id,
                Some(revision),
                submit_text.chars().count(),
                Some(preview_lineage_key.as_str()),
            );
            let dispatcher = {
                let mut controller = translation.lock().await;
                controller
                    .ensure_started(voicesub_translation::DispatcherCallbacks::default())
                    .await;
                controller.dispatcher_handle()
            };
            if let Some(dispatcher) = dispatcher {
                dispatcher
                    .submit_partial(
                        sequence,
                        &submit_text,
                        &source_lang,
                        Some(preview_lineage_key.as_str()),
                    )
                    .await;
            }
        });
        *task_slot = Some(task.abort_handle());
    }

    fn cancel_live_partial_trailing_flush(&self) {
        self.live_partial_flush_generation
            .fetch_add(1, Ordering::AcqRel);
        if let Some(task) = self
            .live_partial_flush_task
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .take()
        {
            task.abort();
        }
    }

    async fn enqueue_live_partial_job(
        &self,
        sequence: u64,
        submit_text: &str,
        source_lang: &str,
        preview_lineage_key: Option<&str>,
    ) {
        let dispatcher = {
            let mut controller = self.translation.lock().await;
            controller
                .ensure_started(voicesub_translation::DispatcherCallbacks::default())
                .await;
            controller.dispatcher_handle()
        };
        if let Some(dispatcher) = dispatcher {
            dispatcher
                .submit_partial(sequence, submit_text, source_lang, preview_lineage_key)
                .await;
        }
    }

    fn should_publish_transcript(&self, event: &TranscriptEvent) -> bool {
        let mut throttle = self
            .partial_throttle
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        if event.event == TranscriptKind::Final {
            throttle.note_final();
            return true;
        }
        let Some(phrase_key) = event
            .segment
            .as_ref()
            .map(|segment| segment.segment_id.as_str())
        else {
            return true;
        };
        throttle.should_emit_partial(phrase_key, Instant::now())
    }

    async fn publish_transcript(&self, event: &TranscriptEvent) {
        let body = serde_json::to_value(event).unwrap_or_default();
        self.publisher
            .broadcast_channel("transcript_update", "transcript_update", body)
            .await;
    }

    fn publish_source_event(&self, event: &TranscriptEvent) {
        let is_final = event.event == TranscriptKind::Final;
        self.obs.publish_source(&event.text, is_final);
    }
}

pub fn preview_lineage_key_from_segment(segment: Option<&TranscriptSegment>) -> Option<String> {
    let segment = segment?;
    TranslationPreviewLineage::lineage_key(Some(&segment.segment_id), Some(segment.revision))
}

#[cfg(test)]
mod tests {
    use super::*;
    use voicesub_subtitle::TranscriptKind;

    #[test]
    fn preview_lineage_uses_segment_id_and_revision() {
        let segment = TranscriptSegment {
            segment_id: "worker-g0-s1".into(),
            text: "hi".into(),
            is_final: true,
            source_lang: "en".into(),
            provider: Some("browser_google".into()),
            sequence: 1,
            revision: 3,
            start_ms: None,
            end_ms: None,
        };
        assert_eq!(
            preview_lineage_key_from_segment(Some(&segment)),
            Some("worker-g0-s1".into())
        );
    }

    #[test]
    fn partial_throttle_emits_first_and_rate_limits_repeats() {
        let mut throttle = PartialTranscriptThrottle::new(Duration::from_millis(90));
        let t0 = Instant::now();
        assert!(throttle.should_emit_partial("worker-g0-s1", t0));
        assert!(!throttle.should_emit_partial("worker-g0-s1", t0 + Duration::from_millis(30)));
        assert!(throttle.should_emit_partial("worker-g0-s1", t0 + Duration::from_millis(100)));
    }

    #[test]
    fn partial_throttle_new_phrase_always_emits() {
        let mut throttle = PartialTranscriptThrottle::new(Duration::from_millis(90));
        let t0 = Instant::now();
        assert!(throttle.should_emit_partial("worker-g0-s1", t0));
        assert!(throttle.should_emit_partial("worker-g0-s2", t0 + Duration::from_millis(5)));
    }

    #[test]
    fn partial_throttle_rate_limits_same_segment_despite_increasing_sequence() {
        let mut throttle = PartialTranscriptThrottle::new(Duration::from_millis(90));
        let t0 = Instant::now();
        assert!(throttle.should_emit_partial("worker-g0-s1", t0));
        assert!(!throttle.should_emit_partial("worker-g0-s1", t0 + Duration::from_millis(20)));
        assert!(!throttle.should_emit_partial("worker-g0-s1", t0 + Duration::from_millis(40)));
        assert!(throttle.should_emit_partial("worker-g0-s1", t0 + Duration::from_millis(100)));
    }

    #[test]
    fn partial_throttle_resets_after_final() {
        let mut throttle = PartialTranscriptThrottle::new(Duration::from_millis(90));
        let t0 = Instant::now();
        assert!(throttle.should_emit_partial("worker-g0-s7", t0));
        throttle.note_final();
        assert!(throttle.should_emit_partial("worker-g0-s7", t0 + Duration::from_millis(1)));
    }

    #[test]
    fn final_event_kind_matches_sst_contract() {
        let event = TranscriptEvent {
            event: TranscriptKind::Final,
            text: "hello".into(),
            sequence: 1,
            segment: None,
        };
        assert_eq!(event.event, TranscriptKind::Final);
    }
}
