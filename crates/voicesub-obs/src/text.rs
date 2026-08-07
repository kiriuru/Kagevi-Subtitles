use voicesub_subtitle::{SubtitleLineItem, SubtitlePayloadEvent};

pub fn normalize_text(text: &str) -> String {
    text.lines()
        .map(|line| line.split_whitespace().collect::<Vec<_>>().join(" "))
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

/// Trailing visible window for realtime OBS CC partials.
///
/// `max_chars == 0` keeps the full text (unlimited). Otherwise keeps the longest trailing
/// run of **whole words** (whitespace-separated) that fits in `max_chars`, so the caption
/// scrolls by words as speech grows — never by mid-word character cuts. A single word longer
/// than `max_chars` falls back to its trailing characters.
pub fn trailing_caption_window(text: &str, max_chars: usize) -> String {
    if max_chars == 0 {
        return text.to_string();
    }
    if text.chars().count() <= max_chars {
        return text.to_string();
    }
    let words: Vec<&str> = text.split_whitespace().collect();
    if words.is_empty() {
        return String::new();
    }

    let mut start = words.len();
    let mut used = 0usize;
    while start > 0 {
        let word = words[start - 1];
        let word_chars = word.chars().count();
        let joined = if start == words.len() {
            word_chars
        } else {
            used + 1 + word_chars
        };
        if joined > max_chars {
            if start == words.len() {
                // One oversized word: keep a trailing char slice as last resort.
                return word
                    .chars()
                    .rev()
                    .take(max_chars)
                    .collect::<String>()
                    .chars()
                    .rev()
                    .collect();
            }
            break;
        }
        start -= 1;
        used = joined;
    }
    words[start..].join(" ")
}

/// Final caption text after a phrase that already streamed as realtime partials.
///
/// When `last_partial` is empty the final was not preceded by live growth (or partials are
/// off) — return the full final. Otherwise apply the same trailing window so OBS CC cannot
/// dump the entire phrase after a scrolled partial stream.
pub fn finalize_after_partials(
    normalized_final: &str,
    last_partial: &str,
    max_partial_caption_chars: usize,
) -> String {
    if last_partial.is_empty() {
        return normalized_final.to_string();
    }
    trailing_caption_window(normalized_final, max_partial_caption_chars)
}

pub fn select_payload_text(payload: &SubtitlePayloadEvent, mode: &str) -> String {
    if mode == "first_visible_line" {
        return select_first_visible_text(payload);
    }
    if mode.starts_with("translation_") {
        // translation_N is a Translation line slot_id (same as UI), not the Nth visible line.
        return find_non_draft_translation(payload, mode).unwrap_or_default();
    }
    String::new()
}

fn find_non_draft_translation(payload: &SubtitlePayloadEvent, mode: &str) -> Option<String> {
    let matching = |item: &&SubtitleLineItem| {
        item.kind == "translation"
            && !item.is_live_draft
            && !item.text.trim().is_empty()
            && (item.slot_id.as_deref() == Some(mode) || item.style_slot.as_deref() == Some(mode))
    };
    payload
        .visible_items
        .iter()
        .find(matching)
        .or_else(|| payload.items.iter().find(matching))
        .map(|item| item.text.clone())
}

/// Live-draft text for `translation_N` modes (empty for other modes / missing draft).
pub fn select_payload_live_draft_text(payload: &SubtitlePayloadEvent, mode: &str) -> String {
    let Some(index_str) = mode.strip_prefix("translation_") else {
        return String::new();
    };
    let Ok(index) = index_str.parse::<usize>() else {
        return String::new();
    };
    if let Some(item) = payload.visible_items.iter().find(|item| {
        item.kind == "translation"
            && item.is_live_draft
            && !item.text.trim().is_empty()
            && (item.slot_id.as_deref() == Some(mode) || item.style_slot.as_deref() == Some(mode))
    }) {
        return item.text.clone();
    }
    let translations: Vec<_> = payload
        .visible_items
        .iter()
        .filter(|item| item.kind == "translation" && !item.text.trim().is_empty())
        .collect();
    translations
        .get(index.saturating_sub(1))
        .filter(|item| item.is_live_draft)
        .map(|item| item.text.clone())
        .unwrap_or_default()
}

/// Returns `true` when a partial update should be suppressed by throttle settings.
pub fn should_throttle_partial_update(
    previous: &str,
    normalized: &str,
    elapsed_ms: Option<u64>,
    partial_throttle_ms: u64,
    min_partial_delta_chars: u64,
) -> bool {
    if previous.is_empty() {
        return false;
    }
    let Some(elapsed_ms) = elapsed_ms else {
        return false;
    };
    if elapsed_ms >= partial_throttle_ms {
        return false;
    }
    let growth_chars = normalized.chars().count() as i64 - previous.chars().count() as i64;
    let word_tail_growth =
        normalized.split_whitespace().count() > previous.split_whitespace().count();
    growth_chars >= 0 && (growth_chars as u64) < min_partial_delta_chars && !word_tail_growth
}

pub fn select_first_visible_text(payload: &SubtitlePayloadEvent) -> String {
    payload
        .visible_items
        .iter()
        .find(|item| !item.is_live_draft && !item.text.trim().is_empty())
        .map(|item| item.text.clone())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use voicesub_subtitle::{LifecycleState, SubtitleLineItem, SubtitlePayloadEvent};

    #[test]
    fn normalize_collapses_whitespace() {
        assert_eq!(normalize_text("  hello   world \n"), "hello world");
    }

    #[test]
    fn trailing_window_keeps_short_text() {
        assert_eq!(trailing_caption_window("Hello world", 80), "Hello world");
    }

    #[test]
    fn trailing_window_unlimited_when_zero() {
        let long = "a".repeat(200);
        assert_eq!(trailing_caption_window(&long, 0), long);
    }

    #[test]
    fn trailing_window_takes_trailing_words_within_budget() {
        let text = "one two three four five six seven eight";
        assert_eq!(trailing_caption_window(text, 20), "five six seven eight");
    }

    #[test]
    fn trailing_window_drops_whole_words_not_mid_word_chars() {
        // 18 chars cannot fit "three four five six" (19); keep "four five six".
        let text = "one two three four five six";
        assert_eq!(trailing_caption_window(text, 18), "four five six");
    }

    #[test]
    fn trailing_window_shifts_by_word_as_phrase_grows() {
        assert_eq!(
            trailing_caption_window("alpha beta gamma", 14),
            "beta gamma"
        );
        assert_eq!(
            trailing_caption_window("alpha beta gamma delta", 14),
            "gamma delta"
        );
        assert_eq!(
            trailing_caption_window("alpha beta gamma delta epsilon", 14),
            "delta epsilon"
        );
    }

    #[test]
    fn trailing_window_handles_cjk_without_spaces() {
        let text = "これは日本語の長い文ですよ";
        let window = trailing_caption_window(text, 8);
        assert_eq!(window.chars().count(), 8);
        assert!(text.ends_with(&window));
    }

    #[test]
    fn finalize_after_partials_keeps_full_text_without_prior_partial() {
        let full = "one two three four five six seven eight";
        assert_eq!(finalize_after_partials(full, "", 20), full);
    }

    #[test]
    fn finalize_after_partials_windows_when_partials_already_streamed() {
        let full = "one two three four five six seven eight";
        assert_eq!(
            finalize_after_partials(full, full, 20),
            "five six seven eight"
        );
    }

    #[test]
    fn partial_throttle_skips_small_growth_within_window() {
        assert!(should_throttle_partial_update(
            "Hello",
            "Hello!",
            Some(50),
            1000,
            3
        ));
    }

    #[test]
    fn partial_throttle_allows_new_word_within_window() {
        assert!(!should_throttle_partial_update(
            "Hello",
            "Hello cruel",
            Some(50),
            1000,
            8
        ));
    }

    #[test]
    fn partial_throttle_counts_unicode_chars_not_bytes() {
        assert!(!should_throttle_partial_update(
            "П",
            "При",
            Some(10),
            1000,
            1
        ));
    }

    #[test]
    fn partial_throttle_allows_shrink_within_window() {
        assert!(!should_throttle_partial_update(
            "Hello cruel",
            "Hello",
            Some(50),
            1000,
            8
        ));
    }

    #[test]
    fn selects_translation_slot_text() {
        let payload = SubtitlePayloadEvent {
            visible_items: vec![SubtitleLineItem {
                kind: "translation".into(),
                lang: "en".into(),
                label: "EN".into(),
                text: "Hello".into(),
                style_slot: None,
                slot_id: Some("translation_1".into()),
                target_lang: Some("en".into()),
                provider: None,
                visible: true,
                success: true,
                error: None,
                is_live_draft: false,
            }],
            lifecycle_state: LifecycleState::CompletedOnly,
            ..SubtitlePayloadEvent::default()
        };
        assert_eq!(select_payload_text(&payload, "translation_1"), "Hello");
    }

    #[test]
    fn selects_translation_slot_by_id_not_visible_index() {
        // display_order has translation_1 then translation_3 — only two visible lines.
        // Mode translation_3 must resolve by slot_id, not as "3rd visible translation".
        let payload = SubtitlePayloadEvent {
            visible_items: vec![
                SubtitleLineItem {
                    kind: "translation".into(),
                    lang: "ja".into(),
                    label: "JA".into(),
                    text: "こんにちは".into(),
                    style_slot: Some("translation_1".into()),
                    slot_id: Some("translation_1".into()),
                    target_lang: Some("ja".into()),
                    provider: None,
                    visible: true,
                    success: true,
                    error: None,
                    is_live_draft: false,
                },
                SubtitleLineItem {
                    kind: "translation".into(),
                    lang: "en".into(),
                    label: "EN".into(),
                    text: "Hello world".into(),
                    style_slot: Some("translation_3".into()),
                    slot_id: Some("translation_3".into()),
                    target_lang: Some("en".into()),
                    provider: None,
                    visible: true,
                    success: true,
                    error: None,
                    is_live_draft: false,
                },
            ],
            lifecycle_state: LifecycleState::CompletedOnly,
            completed_block_visible: true,
            ..SubtitlePayloadEvent::default()
        };
        assert_eq!(
            select_payload_text(&payload, "translation_3"),
            "Hello world"
        );
        assert_eq!(select_payload_text(&payload, "translation_1"), "こんにちは");
        assert_eq!(
            select_payload_text(&payload, "translation_2"),
            "",
            "missing slot must stay empty (no positional steal from later slots)"
        );
    }

    #[test]
    fn selects_completed_translation_from_items_when_hidden_by_live_partial() {
        let mut hidden = SubtitleLineItem {
            kind: "translation".into(),
            lang: "en".into(),
            label: "EN".into(),
            text: "Completed final".into(),
            style_slot: None,
            slot_id: Some("translation_3".into()),
            target_lang: Some("en".into()),
            provider: None,
            visible: false,
            success: true,
            error: None,
            is_live_draft: false,
        };
        let draft = SubtitleLineItem {
            kind: "translation".into(),
            lang: "en".into(),
            label: "EN".into(),
            text: "draft".into(),
            style_slot: Some("translation_3".into()),
            slot_id: Some("translation_3".into()),
            target_lang: Some("en".into()),
            provider: None,
            visible: true,
            success: true,
            error: None,
            is_live_draft: true,
        };
        let payload = SubtitlePayloadEvent {
            items: vec![draft.clone(), hidden.clone()],
            visible_items: vec![draft],
            lifecycle_state: LifecycleState::CompletedWithPartial,
            completed_block_visible: true,
            completed_sequence: Some(5),
            ..SubtitlePayloadEvent::default()
        };
        let _ = &mut hidden;
        assert_eq!(
            select_payload_text(&payload, "translation_3"),
            "Completed final"
        );
    }

    #[test]
    fn ignores_live_draft_translation_for_captions() {
        let payload = SubtitlePayloadEvent {
            visible_items: vec![SubtitleLineItem {
                kind: "translation".into(),
                lang: "en".into(),
                label: "EN".into(),
                text: "growing draft".into(),
                style_slot: None,
                slot_id: Some("translation_1".into()),
                target_lang: Some("en".into()),
                provider: None,
                visible: true,
                success: true,
                error: None,
                is_live_draft: true,
            }],
            lifecycle_state: LifecycleState::CompletedWithPartial,
            completed_block_visible: true,
            ..SubtitlePayloadEvent::default()
        };
        assert_eq!(select_payload_text(&payload, "translation_1"), "");
        assert_eq!(select_first_visible_text(&payload), "");
    }

    #[test]
    fn selects_live_draft_translation_for_partial_captions() {
        let payload = SubtitlePayloadEvent {
            visible_items: vec![SubtitleLineItem {
                kind: "translation".into(),
                lang: "en".into(),
                label: "EN".into(),
                text: "growing draft".into(),
                style_slot: None,
                slot_id: Some("translation_1".into()),
                target_lang: Some("en".into()),
                provider: None,
                visible: true,
                success: true,
                error: None,
                is_live_draft: true,
            }],
            lifecycle_state: LifecycleState::PartialOnly,
            completed_block_visible: false,
            ..SubtitlePayloadEvent::default()
        };
        assert_eq!(
            select_payload_live_draft_text(&payload, "translation_1"),
            "growing draft"
        );
        assert_eq!(select_payload_live_draft_text(&payload, "source_live"), "");
    }
}
