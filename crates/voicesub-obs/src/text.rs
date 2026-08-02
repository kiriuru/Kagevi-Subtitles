use voicesub_subtitle::SubtitlePayloadEvent;

pub fn normalize_text(text: &str) -> String {
    text.lines()
        .map(|line| line.split_whitespace().collect::<Vec<_>>().join(" "))
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

pub fn select_payload_text(payload: &SubtitlePayloadEvent, mode: &str) -> String {
    let visible: Vec<_> = payload
        .visible_items
        .iter()
        .filter(|item| !item.is_live_draft && !item.text.trim().is_empty())
        .collect();
    if mode == "first_visible_line" {
        return select_first_visible_text(payload);
    }
    if let Some(index_str) = mode.strip_prefix("translation_")
        && let Ok(index) = index_str.parse::<usize>()
    {
        let translations: Vec<_> = visible
            .iter()
            .filter(|item| item.kind == "translation")
            .collect();
        return translations
            .get(index.saturating_sub(1))
            .map(|item| item.text.clone())
            .unwrap_or_default();
    }
    String::new()
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
