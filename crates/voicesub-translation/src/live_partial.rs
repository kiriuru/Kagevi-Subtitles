//! Gate for optional live MT on ASR partials (not LLM token streams).

use std::time::Instant;

use serde_json::Value;
use voicesub_partial_emit::{PartialEmitInput, normalize_transcript_text, should_emit_partial};

#[derive(Debug, Clone)]
pub struct LivePartialSettings {
    pub enabled: bool,
    pub min_interval_ms: u64,
    pub min_delta_chars: u32,
    pub word_growth: bool,
}

impl Default for LivePartialSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            // Typing-style MT: coalesce must cover typical classic-MT RTT (often 300–800ms
            // per provider, higher with 2+ live slots) or the overlay freezes on a stale draft.
            min_interval_ms: 400,
            min_delta_chars: 6,
            word_growth: false,
        }
    }
}

impl LivePartialSettings {
    pub fn from_translation_config(translation: &Value) -> Self {
        let live = translation.get("live_partial").unwrap_or(&Value::Null);
        let defaults = Self::default();
        Self {
            enabled: live
                .get("enabled")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            min_interval_ms: live
                .get("min_interval_ms")
                .and_then(|v| v.as_u64())
                .unwrap_or(defaults.min_interval_ms)
                .min(5_000),
            min_delta_chars: live
                .get("min_delta_chars")
                .and_then(|v| v.as_u64())
                .unwrap_or(u64::from(defaults.min_delta_chars))
                .min(64) as u32,
            word_growth: live
                .get("word_growth")
                .and_then(|v| v.as_bool())
                .unwrap_or(defaults.word_growth),
        }
    }
}

/// ASR hypothesis + gate settings for one [`LivePartialGate::decide`] call.
#[derive(Debug, Clone, Copy)]
pub struct LivePartialDecideInput<'a> {
    pub segment_id: &'a str,
    pub text: &'a str,
    pub sequence: u64,
    pub revision: u64,
    pub source_lang: &'a str,
    pub settings: &'a LivePartialSettings,
    pub now: Instant,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LivePartialGateReason {
    Submitted,
    /// Trailing flush of text that was held during coalesce.
    SubmittedPending,
    Disabled,
    EmptyText,
    Unchanged,
    Coalesced,
    BelowDelta,
}

impl LivePartialGateReason {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Submitted => "submitted",
            Self::SubmittedPending => "submitted_pending",
            Self::Disabled => "disabled",
            Self::EmptyText => "empty_text",
            Self::Unchanged => "unchanged",
            Self::Coalesced => "coalesced",
            Self::BelowDelta => "below_delta",
        }
    }

    pub fn should_submit(self) -> bool {
        matches!(self, Self::Submitted | Self::SubmittedPending)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LivePartialDecision {
    pub reason: LivePartialGateReason,
    /// Normalized source text to enqueue when `reason.should_submit()`.
    pub text_to_submit: Option<String>,
}

impl LivePartialDecision {
    pub fn should_submit(&self) -> bool {
        self.reason.should_submit()
    }

    pub fn as_str(&self) -> &'static str {
        self.reason.as_str()
    }
}

#[derive(Debug, Default)]
pub struct LivePartialGate {
    segment_id: Option<String>,
    previous_text: String,
    previous_emit: Option<Instant>,
    /// Latest text waiting for coalesce window to elapse (trailing edge).
    pending_text: Option<String>,
    /// ASR sequence that produced `pending_text` (for timer flush submit).
    pending_sequence: Option<u64>,
    pending_revision: Option<u64>,
    pending_source_lang: Option<String>,
    pending_qualified: bool,
}

impl LivePartialGate {
    pub fn reset(&mut self) {
        self.segment_id = None;
        self.previous_text.clear();
        self.previous_emit = None;
        self.pending_text = None;
        self.pending_sequence = None;
        self.pending_revision = None;
        self.pending_source_lang = None;
        self.pending_qualified = false;
    }

    pub fn note_final(&mut self) {
        self.reset();
    }

    pub fn has_pending(&self) -> bool {
        self.pending_text.is_some()
    }

    pub fn pending_segment_id(&self) -> Option<&str> {
        self.segment_id.as_deref()
    }

    pub fn pending_sequence(&self) -> Option<u64> {
        self.pending_sequence
    }

    pub fn pending_revision(&self) -> Option<u64> {
        self.pending_revision
    }

    pub fn pending_source_lang(&self) -> Option<&str> {
        self.pending_source_lang.as_deref()
    }

    /// Milliseconds until a timer should call [`Self::flush_pending_due`].
    /// Any held pending text (including below-delta growth) gets a trailing flush so
    /// quiet gaps still update the overlay instead of waiting for final ASR.
    pub fn pending_flush_delay_ms(
        &self,
        settings: &LivePartialSettings,
        now: Instant,
    ) -> Option<u64> {
        self.pending_text.as_ref()?;
        match self.previous_emit {
            None => Some(0),
            Some(prev) => Some(
                settings
                    .min_interval_ms
                    .saturating_sub(
                        now.checked_duration_since(prev)
                            .unwrap_or_default()
                            .as_millis() as u64,
                    ),
            ),
        }
    }

    /// Timer-driven trailing flush when ASR went quiet after a coalesced update.
    pub fn flush_pending_due(
        &mut self,
        settings: &LivePartialSettings,
        now: Instant,
    ) -> LivePartialDecision {
        let reject = |reason: LivePartialGateReason| LivePartialDecision {
            reason,
            text_to_submit: None,
        };
        let accept = |reason: LivePartialGateReason, text: String| LivePartialDecision {
            reason,
            text_to_submit: Some(text),
        };

        if !settings.enabled {
            return reject(LivePartialGateReason::Disabled);
        }
        if !self.coalesce_elapsed(settings, now) {
            return reject(LivePartialGateReason::Coalesced);
        }
        if let Some(pending) = self
            .pending_text
            .take()
            .filter(|pending| pending != &self.previous_text)
        {
            self.pending_sequence = None;
            self.pending_revision = None;
            self.pending_source_lang = None;
            self.pending_qualified = false;
            self.previous_text = pending.clone();
            self.previous_emit = Some(now);
            return accept(LivePartialGateReason::SubmittedPending, pending);
        }
        self.pending_sequence = None;
        self.pending_revision = None;
        self.pending_source_lang = None;
        self.pending_qualified = false;
        reject(LivePartialGateReason::Unchanged)
    }

    /// Decide whether a live-partial translation job should be enqueued.
    pub fn decide(&mut self, input: LivePartialDecideInput<'_>) -> LivePartialDecision {
        let reject = |reason: LivePartialGateReason| LivePartialDecision {
            reason,
            text_to_submit: None,
        };
        let accept = |reason: LivePartialGateReason, text: String| LivePartialDecision {
            reason,
            text_to_submit: Some(text),
        };

        if !input.settings.enabled {
            return reject(LivePartialGateReason::Disabled);
        }
        let new_norm = normalize_transcript_text(input.text);
        if new_norm.is_empty() {
            return reject(LivePartialGateReason::EmptyText);
        }
        if self.segment_id.as_deref() != Some(input.segment_id) {
            self.segment_id = Some(input.segment_id.to_string());
            self.previous_text.clear();
            self.previous_emit = None;
            self.pending_text = None;
            self.pending_sequence = None;
            self.pending_revision = None;
            self.pending_source_lang = None;
            self.pending_qualified = false;
        }

        if new_norm == self.previous_text {
            self.pending_text = None;
            self.pending_sequence = None;
            self.pending_revision = None;
            self.pending_source_lang = None;
            self.pending_qualified = false;
            return reject(LivePartialGateReason::Unchanged);
        }

        let mode = if input.settings.word_growth {
            "word_growth"
        } else {
            "char_delta"
        };
        let correction = !new_norm.starts_with(&self.previous_text);
        let qualify = if correction {
            true
        } else if input.settings.word_growth {
            should_emit_partial(PartialEmitInput {
                new_text: &new_norm,
                previous_text: &self.previous_text,
                mode,
                min_new_words: 1,
                min_delta_chars: input.settings.min_delta_chars.max(1),
                coalescing_ms: 0,
                previous_emit: None,
                now: input.now,
            })
        } else {
            new_norm
                .chars()
                .count()
                .saturating_sub(self.previous_text.chars().count())
                >= input.settings.min_delta_chars.max(1) as usize
        };

        if self.coalesce_elapsed(input.settings, input.now) && qualify {
            self.pending_text = None;
            self.pending_sequence = None;
            self.pending_revision = None;
            self.pending_source_lang = None;
            self.pending_qualified = false;
            self.previous_text = new_norm.clone();
            self.previous_emit = Some(input.now);
            return accept(LivePartialGateReason::Submitted, new_norm);
        }

        // Hold the newest hypothesis. Trailing flush submits any change after the
        // coalesce window — min_delta only gates leading-edge mid-speech submits.
        self.pending_text = Some(new_norm);
        self.pending_sequence = Some(input.sequence);
        self.pending_revision = Some(input.revision);
        self.pending_source_lang = Some(input.source_lang.to_string());
        self.pending_qualified = qualify;
        if qualify {
            reject(LivePartialGateReason::Coalesced)
        } else {
            reject(LivePartialGateReason::BelowDelta)
        }
    }

    /// Back-compat helper for callers that only need a bool.
    pub fn should_submit(&mut self, input: LivePartialDecideInput<'_>) -> bool {
        self.decide(input).should_submit()
    }

    fn coalesce_elapsed(&self, settings: &LivePartialSettings, now: Instant) -> bool {
        if settings.min_interval_ms == 0 {
            return true;
        }
        match self.previous_emit {
            None => true,
            Some(prev) => {
                now.checked_duration_since(prev)
                    .unwrap_or_default()
                    .as_millis() as u64
                    >= settings.min_interval_ms
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::time::Duration;

    fn input<'a>(
        segment_id: &'a str,
        text: &'a str,
        sequence: u64,
        revision: u64,
        source_lang: &'a str,
        settings: &'a LivePartialSettings,
        now: Instant,
    ) -> LivePartialDecideInput<'a> {
        LivePartialDecideInput {
            segment_id,
            text,
            sequence,
            revision,
            source_lang,
            settings,
            now,
        }
    }

    #[test]
    fn gate_disabled_never_emits() {
        let mut gate = LivePartialGate::default();
        let settings = LivePartialSettings::default();
        assert_eq!(
            gate.decide(input(
                "s1",
                "hello world",
                1,
                1,
                "en",
                &settings,
                Instant::now()
            ))
            .reason,
            LivePartialGateReason::Disabled
        );
    }

    #[test]
    fn char_delta_emits_mid_word_growth() {
        let mut gate = LivePartialGate::default();
        let settings = LivePartialSettings {
            enabled: true,
            min_interval_ms: 0,
            min_delta_chars: 2,
            word_growth: false,
        };
        let t0 = Instant::now();
        assert_eq!(
            gate.decide(input("s1", "he", 1, 1, "en", &settings, t0))
                .reason,
            LivePartialGateReason::Submitted
        );
        assert_eq!(
            gate.decide(input("s1", "hello", 2, 2, "en", &settings, t0))
                .reason,
            LivePartialGateReason::Submitted
        );
    }

    #[test]
    fn coalesce_holds_then_trailing_pending_flushes() {
        let mut gate = LivePartialGate::default();
        let settings = LivePartialSettings {
            enabled: true,
            min_interval_ms: 150,
            min_delta_chars: 2,
            word_growth: false,
        };
        let t0 = Instant::now();
        assert_eq!(
            gate.decide(input("s1", "he", 1, 1, "en", &settings, t0))
                .reason,
            LivePartialGateReason::Submitted
        );
        assert_eq!(
            gate.decide(input(
                "s1",
                "hello",
                2,
                2,
                "en",
                &settings,
                t0 + Duration::from_millis(40)
            ))
            .reason,
            LivePartialGateReason::Coalesced
        );
        // Newest text after window → Submitted (not merely pending flush).
        assert_eq!(
            gate.decide(input(
                "s1",
                "hello",
                3,
                3,
                "en",
                &settings,
                t0 + Duration::from_millis(200)
            ))
            .reason,
            LivePartialGateReason::Submitted
        );
        // Reverting to the last emitted text cancels a held hypothesis.
        let mut gate2 = LivePartialGate::default();
        assert_eq!(
            gate2
                .decide(input("s1", "he", 1, 1, "en", &settings, t0))
                .reason,
            LivePartialGateReason::Submitted
        );
        assert_eq!(
            gate2
                .decide(input(
                    "s1",
                    "hello",
                    2,
                    2,
                    "en",
                    &settings,
                    t0 + Duration::from_millis(40)
                ))
                .reason,
            LivePartialGateReason::Coalesced
        );
        let reverted = gate2.decide(input(
            "s1",
            "he",
            3,
            3,
            "en",
            &settings,
            t0 + Duration::from_millis(200),
        ));
        assert_eq!(reverted.reason, LivePartialGateReason::Unchanged);
        assert!(!gate2.has_pending());
    }

    #[test]
    fn timer_flush_pending_after_coalesce_without_asr() {
        let mut gate = LivePartialGate::default();
        let settings = LivePartialSettings {
            enabled: true,
            min_interval_ms: 150,
            min_delta_chars: 2,
            word_growth: false,
        };
        let t0 = Instant::now();
        assert_eq!(
            gate.decide(input("s1", "he", 1, 1, "en", &settings, t0))
                .reason,
            LivePartialGateReason::Submitted
        );
        assert_eq!(
            gate.decide(input(
                "s1",
                "hello",
                2,
                2,
                "en",
                &settings,
                t0 + Duration::from_millis(40)
            ))
            .reason,
            LivePartialGateReason::Coalesced
        );
        assert!(gate.has_pending());
        assert_eq!(gate.pending_sequence(), Some(2));
        let early = gate.flush_pending_due(&settings, t0 + Duration::from_millis(40));
        assert_eq!(early.reason, LivePartialGateReason::Coalesced);
        assert!(gate.has_pending());
        let flushed = gate.flush_pending_due(&settings, t0 + Duration::from_millis(200));
        assert_eq!(flushed.reason, LivePartialGateReason::SubmittedPending);
        assert_eq!(flushed.text_to_submit.as_deref(), Some("hello"));
        assert!(!gate.has_pending());
    }

    #[test]
    fn below_delta_still_arms_trailing_flush() {
        let mut gate = LivePartialGate::default();
        let settings = LivePartialSettings {
            enabled: true,
            min_interval_ms: 150,
            min_delta_chars: 3,
            word_growth: false,
        };
        let t0 = Instant::now();
        assert!(gate.should_submit(input("s1", "hello", 1, 1, "en", &settings, t0)));
        let held = gate.decide(input(
            "s1",
            "hello!",
            2,
            2,
            "en",
            &settings,
            t0 + Duration::from_millis(40),
        ));
        assert_eq!(held.reason, LivePartialGateReason::BelowDelta);
        assert!(gate.has_pending());
        assert_eq!(
            gate.pending_flush_delay_ms(&settings, t0 + Duration::from_millis(40)),
            Some(110)
        );
        let flushed = gate.flush_pending_due(&settings, t0 + Duration::from_millis(200));
        assert_eq!(flushed.reason, LivePartialGateReason::SubmittedPending);
        assert_eq!(flushed.text_to_submit.as_deref(), Some("hello!"));
    }

    #[test]
    fn shorter_asr_correction_is_submitted_after_coalesce() {
        let mut gate = LivePartialGate::default();
        let settings = LivePartialSettings {
            enabled: true,
            min_interval_ms: 150,
            min_delta_chars: 2,
            word_growth: false,
        };
        let t0 = Instant::now();
        assert!(gate.should_submit(input(
            "s1",
            "hello wrong ending",
            1,
            1,
            "en",
            &settings,
            t0
        )));
        let corrected = gate.decide(input(
            "s1",
            "hello world",
            2,
            2,
            "en",
            &settings,
            t0 + Duration::from_millis(200),
        ));
        assert_eq!(corrected.reason, LivePartialGateReason::Submitted);
        assert_eq!(corrected.text_to_submit.as_deref(), Some("hello world"));
    }

    #[test]
    fn after_coalesce_prefers_newest_text() {
        let mut gate = LivePartialGate::default();
        let settings = LivePartialSettings {
            enabled: true,
            min_interval_ms: 150,
            min_delta_chars: 2,
            word_growth: false,
        };
        let t0 = Instant::now();
        assert_eq!(
            gate.decide(input("s1", "he", 1, 1, "en", &settings, t0))
                .reason,
            LivePartialGateReason::Submitted
        );
        assert_eq!(
            gate.decide(input(
                "s1",
                "hel",
                2,
                2,
                "en",
                &settings,
                t0 + Duration::from_millis(20)
            ))
            .reason,
            LivePartialGateReason::BelowDelta
        );
        assert_eq!(
            gate.decide(input(
                "s1",
                "hello world",
                3,
                3,
                "en",
                &settings,
                t0 + Duration::from_millis(200)
            ))
            .reason,
            LivePartialGateReason::Submitted
        );
    }

    #[test]
    fn word_growth_misses_mid_word_then_char_default_catches() {
        let mut word_gate = LivePartialGate::default();
        let word_settings = LivePartialSettings {
            enabled: true,
            min_interval_ms: 150,
            min_delta_chars: 2,
            word_growth: true,
        };
        let t0 = Instant::now();
        assert_eq!(
            word_gate
                .decide(input("s1", "hel", 1, 1, "en", &word_settings, t0))
                .reason,
            LivePartialGateReason::Submitted
        );
        // Same word count but different token still qualifies word_growth → held as Coalesced.
        assert_eq!(
            word_gate
                .decide(input(
                    "s1",
                    "hello",
                    2,
                    2,
                    "en",
                    &word_settings,
                    t0 + Duration::from_millis(20)
                ))
                .reason,
            LivePartialGateReason::Coalesced
        );
    }

    #[test]
    fn final_resets_gate() {
        let mut gate = LivePartialGate::default();
        let settings = LivePartialSettings {
            enabled: true,
            min_interval_ms: 0,
            min_delta_chars: 1,
            word_growth: false,
        };
        let t0 = Instant::now();
        assert!(gate.should_submit(input("s1", "ab", 1, 1, "en", &settings, t0)));
        gate.note_final();
        assert!(gate.should_submit(input("s1", "ab", 2, 2, "en", &settings, t0)));
    }

    #[test]
    fn settings_from_config_defaults_char_delta() {
        let settings = LivePartialSettings::from_translation_config(&json!({
            "live_partial": { "enabled": true }
        }));
        assert!(settings.enabled);
        assert_eq!(settings.min_interval_ms, 400);
        assert_eq!(settings.min_delta_chars, 6);
        assert!(!settings.word_growth);
    }
}
