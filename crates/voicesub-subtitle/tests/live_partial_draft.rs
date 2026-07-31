//! Live partial MT draft presentation.

use std::sync::{Arc, Mutex};

use serde_json::json;
use voicesub_subtitle::{
    LifecycleState, PublishCallback, SubtitlePayloadEvent, SubtitleRouter, TranscriptEvent,
    TranscriptKind, TranscriptSegment, TranslationEvent, TranslationItem,
};

fn config() -> serde_json::Value {
    json!({
        "translation": {
            "enabled": true,
            "live_partial": { "enabled": true },
            "lines": [{
                "slot_id": "translation_1",
                "enabled": true,
                "target_lang": "en",
                "provider": "google_translate_v2",
                "label": "EN"
            }]
        },
        "subtitle_output": {
            "show_source": true,
            "show_translations": true,
            "max_translation_languages": 2,
            "display_order": ["source", "translation_1"]
        },
        "subtitle_lifecycle": {
            "keep_completed_translation_during_active_partial": true
        },
        "overlay": { "preset": "dual-line", "compact": false }
    })
}

struct RecordingPublisher {
    messages: Arc<Mutex<Vec<SubtitlePayloadEvent>>>,
}

impl RecordingPublisher {
    fn new() -> (Self, PublishCallback) {
        let messages = Arc::new(Mutex::new(Vec::new()));
        let messages_cb = messages.clone();
        let publish: PublishCallback = Arc::new(move |payload| {
            messages_cb.lock().unwrap().push(payload);
        });
        (Self { messages }, publish)
    }

    fn last(&self) -> SubtitlePayloadEvent {
        self.messages
            .lock()
            .unwrap()
            .last()
            .cloned()
            .expect("expected published payload")
    }
}

#[tokio::test]
async fn live_partial_draft_appears_on_partial_only_overlay() {
    let cfg = config();
    let config_getter: voicesub_subtitle::ConfigGetter = Arc::new(move || cfg.clone());
    let (recorder, publish) = RecordingPublisher::new();
    let router = SubtitleRouter::new(config_getter, publish, None);

    router
        .handle_transcript(TranscriptEvent {
            event: TranscriptKind::Partial,
            text: "привет".into(),
            sequence: 10,
            segment: Some(TranscriptSegment {
                segment_id: "seg-1".into(),
                text: "привет".into(),
                is_final: false,
                source_lang: "ru".into(),
                provider: Some("browser_google".into()),
                sequence: 10,
                revision: 1,
                start_ms: None,
                end_ms: None,
            }),
        })
        .await;
    router.flush_overlay_publish().await;

    router
        .handle_translation(TranslationEvent {
            sequence: 10,
            source_text: "привет".into(),
            source_lang: "ru".into(),
            provider: "google_translate_v2".into(),
            is_complete: false,
            is_live_partial: true,
            preview_lineage_key: Some("seg-1".into()),
            translations: vec![TranslationItem {
                slot_id: Some("translation_1".into()),
                label: Some("EN".into()),
                target_lang: "en".into(),
                text: "hello".into(),
                provider: "google_translate_v2".into(),
                success: true,
                ..Default::default()
            }],
            ..Default::default()
        })
        .await;
    router.flush_overlay_publish().await;

    let last = recorder.last();
    assert_eq!(last.lifecycle_state, LifecycleState::PartialOnly);
    let texts: Vec<_> = last.visible_items.iter().map(|i| i.text.as_str()).collect();
    assert!(texts.contains(&"привет"));
    assert!(texts.contains(&"hello"));
}

#[tokio::test]
async fn exact_match_carried_draft_is_tts_eligible_on_final() {
    let cfg = config();
    let config_getter: voicesub_subtitle::ConfigGetter = Arc::new(move || cfg.clone());
    let (recorder, publish) = RecordingPublisher::new();
    let router = SubtitleRouter::new(config_getter, publish, None);

    router
        .handle_transcript(TranscriptEvent {
            event: TranscriptKind::Partial,
            text: "привет мир".into(),
            sequence: 10,
            segment: Some(TranscriptSegment {
                segment_id: "seg-tts".into(),
                text: "привет мир".into(),
                is_final: false,
                source_lang: "ru".into(),
                provider: Some("browser_google".into()),
                sequence: 10,
                revision: 1,
                start_ms: None,
                end_ms: None,
            }),
        })
        .await;
    router
        .handle_translation(TranslationEvent {
            sequence: 10,
            source_text: "привет мир".into(),
            source_lang: "ru".into(),
            provider: "google_translate_v2".into(),
            is_complete: false,
            is_live_partial: true,
            preview_lineage_key: Some("seg-tts".into()),
            translations: vec![TranslationItem {
                slot_id: Some("translation_1".into()),
                label: Some("EN".into()),
                target_lang: "en".into(),
                text: "hello world".into(),
                provider: "google_translate_v2".into(),
                success: true,
                ..Default::default()
            }],
            ..Default::default()
        })
        .await;
    router
        .handle_transcript(TranscriptEvent {
            event: TranscriptKind::Final,
            text: "привет мир".into(),
            sequence: 11,
            segment: Some(TranscriptSegment {
                segment_id: "seg-tts".into(),
                text: "привет мир".into(),
                is_final: true,
                source_lang: "ru".into(),
                provider: Some("browser_google".into()),
                sequence: 11,
                revision: 2,
                start_ms: None,
                end_ms: None,
            }),
        })
        .await;
    router.flush_overlay_publish().await;

    let last = recorder.last();
    let translation = last
        .visible_items
        .iter()
        .find(|item| item.kind == "translation")
        .expect("expected carried translation");
    assert_eq!(translation.text, "hello world");
    assert!(
        !translation.is_live_draft,
        "exact-match draft must be TTS-eligible immediately on ASR final"
    );
}

#[tokio::test]
async fn final_keeps_live_draft_until_final_translation() {
    let cfg = config();
    let config_getter: voicesub_subtitle::ConfigGetter = Arc::new(move || cfg.clone());
    let (recorder, publish) = RecordingPublisher::new();
    let router = SubtitleRouter::new(config_getter, publish, None);

    router
        .handle_transcript(TranscriptEvent {
            event: TranscriptKind::Partial,
            text: "привет мир".into(),
            sequence: 10,
            segment: Some(TranscriptSegment {
                segment_id: "seg-1".into(),
                text: "привет мир".into(),
                is_final: false,
                source_lang: "ru".into(),
                provider: Some("browser_google".into()),
                sequence: 10,
                revision: 1,
                start_ms: None,
                end_ms: None,
            }),
        })
        .await;
    router
        .handle_translation(TranslationEvent {
            sequence: 10,
            source_text: "привет мир".into(),
            source_lang: "ru".into(),
            provider: "google_translate_v2".into(),
            is_complete: false,
            is_live_partial: true,
            preview_lineage_key: Some("seg-1".into()),
            translations: vec![TranslationItem {
                slot_id: Some("translation_1".into()),
                label: Some("EN".into()),
                target_lang: "en".into(),
                text: "hello world".into(),
                provider: "google_translate_v2".into(),
                success: true,
                ..Default::default()
            }],
            ..Default::default()
        })
        .await;
    router
        .handle_transcript(TranscriptEvent {
            event: TranscriptKind::Final,
            text: "привет мир".into(),
            sequence: 11,
            segment: Some(TranscriptSegment {
                segment_id: "seg-1".into(),
                text: "привет мир".into(),
                is_final: true,
                source_lang: "ru".into(),
                provider: Some("browser_google".into()),
                sequence: 11,
                revision: 2,
                start_ms: None,
                end_ms: None,
            }),
        })
        .await;
    router.flush_overlay_publish().await;

    let last = recorder.last();
    let texts: Vec<_> = last.visible_items.iter().map(|i| i.text.as_str()).collect();
    assert!(
        texts.iter().any(|t| t.contains("hello")),
        "expected carried live draft after final, got {texts:?}"
    );

    router
        .handle_translation(TranslationEvent {
            sequence: 11,
            source_text: "привет мир".into(),
            source_lang: "ru".into(),
            is_complete: true,
            is_live_partial: false,
            preview_lineage_key: Some("seg-1".into()),
            translations: vec![TranslationItem {
                slot_id: Some("translation_1".into()),
                label: Some("EN".into()),
                target_lang: "en".into(),
                text: "hello world final".into(),
                provider: "google_translate_v2".into(),
                success: true,
                ..Default::default()
            }],
            ..Default::default()
        })
        .await;
    router.flush_overlay_publish().await;
    let final_payload = recorder.last();
    assert!(
        final_payload
            .visible_items
            .iter()
            .any(|item| item.text == "hello world final"),
        "authoritative final translation must replace the carried draft"
    );
}

#[tokio::test]
async fn live_draft_replaces_previous_completed_translation() {
    let cfg = config();
    let config_getter: voicesub_subtitle::ConfigGetter = Arc::new(move || cfg.clone());
    let (recorder, publish) = RecordingPublisher::new();
    let router = SubtitleRouter::new(config_getter, publish, None);

    router
        .handle_transcript(TranscriptEvent {
            event: TranscriptKind::Final,
            text: "длинная завершённая фраза для теста".into(),
            sequence: 1,
            segment: Some(TranscriptSegment {
                segment_id: "seg-old".into(),
                text: "длинная завершённая фраза для теста".into(),
                is_final: true,
                source_lang: "ru".into(),
                provider: Some("browser_google".into()),
                sequence: 1,
                revision: 1,
                start_ms: None,
                end_ms: None,
            }),
        })
        .await;
    router
        .handle_translation(TranslationEvent {
            sequence: 1,
            source_text: "длинная завершённая фраза для теста".into(),
            source_lang: "ru".into(),
            provider: "google_translate_v2".into(),
            is_complete: true,
            is_live_partial: false,
            translations: vec![TranslationItem {
                slot_id: Some("translation_1".into()),
                label: Some("EN".into()),
                target_lang: "en".into(),
                text: "a long completed phrase for the test".into(),
                provider: "google_translate_v2".into(),
                success: true,
                ..Default::default()
            }],
            ..Default::default()
        })
        .await;
    router
        .handle_transcript(TranscriptEvent {
            event: TranscriptKind::Partial,
            text: "но".into(),
            sequence: 2,
            segment: Some(TranscriptSegment {
                segment_id: "seg-new".into(),
                text: "но".into(),
                is_final: false,
                source_lang: "ru".into(),
                provider: Some("browser_google".into()),
                sequence: 2,
                revision: 1,
                start_ms: None,
                end_ms: None,
            }),
        })
        .await;
    router
        .handle_translation(TranslationEvent {
            sequence: 2,
            source_text: "но".into(),
            source_lang: "ru".into(),
            provider: "google_translate_v2".into(),
            is_complete: false,
            is_live_partial: true,
            preview_lineage_key: Some("seg-new".into()),
            translations: vec![TranslationItem {
                slot_id: Some("translation_1".into()),
                label: Some("EN".into()),
                target_lang: "en".into(),
                text: "But".into(),
                provider: "google_translate_v2".into(),
                success: true,
                ..Default::default()
            }],
            ..Default::default()
        })
        .await;
    router.flush_overlay_publish().await;

    let last = recorder.last();
    assert_eq!(last.lifecycle_state, LifecycleState::CompletedWithPartial);
    let translation = last
        .visible_items
        .iter()
        .find(|i| i.kind == "translation")
        .map(|i| i.text.as_str());
    assert_eq!(
        translation,
        Some("But"),
        "live draft for the new phrase must replace previous completed MT"
    );
}

#[tokio::test]
async fn live_partial_ignores_keep_completed_before_first_draft() {
    let cfg = config();
    let config_getter: voicesub_subtitle::ConfigGetter = Arc::new(move || cfg.clone());
    let (recorder, publish) = RecordingPublisher::new();
    let router = SubtitleRouter::new(config_getter, publish, None);

    router
        .handle_transcript(TranscriptEvent {
            event: TranscriptKind::Final,
            text: "длинная завершённая фраза для теста".into(),
            sequence: 1,
            segment: Some(TranscriptSegment {
                segment_id: "seg-old".into(),
                text: "длинная завершённая фраза для теста".into(),
                is_final: true,
                source_lang: "ru".into(),
                provider: Some("browser_google".into()),
                sequence: 1,
                revision: 1,
                start_ms: None,
                end_ms: None,
            }),
        })
        .await;
    router
        .handle_translation(TranslationEvent {
            sequence: 1,
            source_text: "длинная завершённая фраза для теста".into(),
            source_lang: "ru".into(),
            provider: "google_translate_v2".into(),
            is_complete: true,
            is_live_partial: false,
            translations: vec![TranslationItem {
                slot_id: Some("translation_1".into()),
                label: Some("EN".into()),
                target_lang: "en".into(),
                text: "a long completed phrase for the test".into(),
                provider: "google_translate_v2".into(),
                success: true,
                ..Default::default()
            }],
            ..Default::default()
        })
        .await;
    router
        .handle_transcript(TranscriptEvent {
            event: TranscriptKind::Partial,
            text: "В общем".into(),
            sequence: 2,
            segment: Some(TranscriptSegment {
                segment_id: "seg-new".into(),
                text: "В общем".into(),
                is_final: false,
                source_lang: "ru".into(),
                provider: Some("browser_google".into()),
                sequence: 2,
                revision: 1,
                start_ms: None,
                end_ms: None,
            }),
        })
        .await;
    router.flush_overlay_publish().await;

    let last = recorder.last();
    assert_eq!(last.lifecycle_state, LifecycleState::CompletedWithPartial);
    assert_eq!(last.active_partial_text, "В общем");
    assert!(
        last.visible_items
            .iter()
            .filter(|i| i.kind == "translation")
            .all(|i| i.text != "a long completed phrase for the test"),
        "keep_completed must not paint previous MT onto a live-partial phrase: {:?}",
        last.visible_items
    );
    assert!(
        !last
            .visible_items
            .iter()
            .any(|i| i.kind == "translation" && !i.text.is_empty()),
        "until a live draft arrives, translation row stays empty under live-partial"
    );
}

#[tokio::test]
async fn in_flight_draft_may_lag_current_partial_without_regressing() {
    let cfg = config();
    let config_getter: voicesub_subtitle::ConfigGetter = Arc::new(move || cfg.clone());
    let (recorder, publish) = RecordingPublisher::new();
    let router = SubtitleRouter::new(config_getter, publish, None);

    for (sequence, revision, text) in [(10, 1, "привет"), (11, 2, "привет мир")] {
        router
            .handle_transcript(TranscriptEvent {
                event: TranscriptKind::Partial,
                text: text.into(),
                sequence,
                segment: Some(TranscriptSegment {
                    segment_id: "seg-lag".into(),
                    text: text.into(),
                    is_final: false,
                    source_lang: "ru".into(),
                    provider: Some("browser_google".into()),
                    sequence,
                    revision,
                    start_ms: None,
                    end_ms: None,
                }),
            })
            .await;
    }

    router
        .handle_translation(TranslationEvent {
            sequence: 10,
            source_text: "привет".into(),
            source_lang: "ru".into(),
            is_complete: false,
            is_live_partial: true,
            preview_lineage_key: Some("seg-lag".into()),
            translations: vec![TranslationItem {
                slot_id: Some("translation_1".into()),
                target_lang: "en".into(),
                text: "hello".into(),
                provider: "google_translate_v2".into(),
                success: true,
                ..Default::default()
            }],
            ..Default::default()
        })
        .await;
    router.flush_overlay_publish().await;

    let last = recorder.last();
    assert_eq!(last.active_partial_text, "привет мир");
    assert!(
        last.visible_items.iter().any(|item| item.text == "hello"),
        "completed in-flight draft should remain visible while ASR grows"
    );

    router
        .handle_translation(TranslationEvent {
            sequence: 9,
            source_text: "при".into(),
            source_lang: "ru".into(),
            is_complete: false,
            is_live_partial: true,
            preview_lineage_key: Some("seg-lag".into()),
            translations: vec![TranslationItem {
                slot_id: Some("translation_1".into()),
                target_lang: "en".into(),
                text: "stale".into(),
                provider: "google_translate_v2".into(),
                success: true,
                ..Default::default()
            }],
            ..Default::default()
        })
        .await;
    router.flush_overlay_publish().await;
    assert!(
        recorder
            .last()
            .visible_items
            .iter()
            .any(|item| item.text == "hello")
    );
}
