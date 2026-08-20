//! Live network checks for the keyless providers.
//!
//! `#[ignore]` by default: these hit third-party endpoints, so they must never gate CI.
//! Run explicitly when verifying that a keyless path is still alive:
//!
//! ```text
//! cargo test -p voicesub-translation --test keyless_providers_live -- --ignored --nocapture
//! ```

use std::collections::HashMap;

use voicesub_translation::{
    SharedHttpClient, TranslateRequest, build_default_registry, build_translation_http_client,
};

async fn translate_with(provider_name: &str, text: &str, target: &str) -> String {
    let transport = SharedHttpClient::new(build_translation_http_client());
    let registry = build_default_registry(transport);
    let provider = registry
        .get(provider_name)
        .unwrap_or_else(|| panic!("{provider_name} must be registered"));
    let settings = HashMap::new();
    provider
        .translate(TranslateRequest {
            text,
            source_lang: "auto",
            target_lang: target,
            settings: &settings,
            timeout_secs: Some(20.0),
        })
        .await
        .unwrap_or_else(|err| panic!("{provider_name} translate failed: {err}"))
}

#[tokio::test]
#[ignore = "hits the live Bing Translator endpoint"]
async fn bing_translator_translates_without_api_key() {
    let translated = translate_with("bing_translator", "hello world", "ru").await;
    println!("bing_translator -> {translated}");
    assert!(!translated.is_empty());
    assert_ne!(translated, "hello world");
}

#[tokio::test]
#[ignore = "hits the live Bing Translator endpoint"]
async fn bing_translator_reuses_session_across_calls() {
    let transport = SharedHttpClient::new(build_translation_http_client());
    let registry = build_default_registry(transport);
    let provider = registry.get("bing_translator").expect("registered");
    let settings = HashMap::new();

    for text in ["first call", "second call"] {
        let translated = provider
            .translate(TranslateRequest {
                text,
                source_lang: "auto",
                target_lang: "ru",
                settings: &settings,
                timeout_secs: Some(20.0),
            })
            .await
            .expect("translate");
        assert!(!translated.is_empty());
    }

    let diag = provider.diagnostics(&settings);
    assert_eq!(diag["session_cached"], true);
}

#[tokio::test]
#[ignore = "hits the live clients5.google.com endpoint"]
async fn free_web_translate_uses_clients5_endpoint() {
    let translated = translate_with("free_web_translate", "hello world", "ru").await;
    println!("free_web_translate -> {translated}");
    assert!(!translated.is_empty());
    assert_ne!(translated, "hello world");
}

#[tokio::test]
#[ignore = "hits the live translate.googleapis.com endpoint"]
async fn google_web_still_uses_translate_single_endpoint() {
    let translated = translate_with("google_web", "hello world", "ru").await;
    println!("google_web -> {translated}");
    assert!(!translated.is_empty());
    assert_ne!(translated, "hello world");
}
