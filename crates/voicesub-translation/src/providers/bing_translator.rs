//! Keyless Bing Translator web session.
//!
//! Scrapes IG / IID / AbusePreventionHelper token from `bing.com/translator`, then POSTs
//! `ttranslatev3`. No API key. Concurrent realtime partials share one in-flight bootstrap.

use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};

use async_trait::async_trait;
use reqwest::StatusCode;
use serde_json::{Value, json};
use tracing::debug;

use super::{
    ProviderError, ProviderInfo, TranslateRequest, TranslationProvider, base_diagnostics, http,
    http::SharedHttpClient, lang_codes::azure_lang, normalize_source_lang,
};

const BING_WEBSITE: &str = "https://www.bing.com/translator";
const BING_TRANSLATE_URL: &str = "https://www.bing.com/ttranslatev3";

/// Refresh session a little before the advertised abuse-prevention interval.
const SESSION_SKEW: Duration = Duration::from_secs(30);

const BING_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
     (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0";

fn extract_translation_text(payload: &Value) -> String {
    let mut parts = Vec::new();
    if let Some(items) = payload.as_array() {
        for item in items {
            if let Some(translations) = item.get("translations").and_then(|value| value.as_array())
            {
                for translation in translations {
                    if let Some(text) = translation.get("text").and_then(|value| value.as_str()) {
                        parts.push(text);
                    }
                }
            }
        }
    }
    parts.concat().trim().to_string()
}

fn capture_quoted(haystack: &str, marker: &str) -> Option<String> {
    let start = haystack.find(marker)? + marker.len();
    let rest = &haystack[start..];
    let end = rest.find('"')?;
    let value = rest[..end].trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

fn parse_bing_session(html: &str) -> Result<BingSession, ProviderError> {
    let ig = capture_quoted(html, "IG:\"")
        .or_else(|| capture_quoted(html, "IG:'"))
        .ok_or_else(|| {
            ProviderError::Message("Bing Translator could not find IG in translator page.".into())
        })?;
    let iid = capture_quoted(html, "data-iid=\"")
        .or_else(|| capture_quoted(html, "data-iid='"))
        .ok_or_else(|| {
            ProviderError::Message("Bing Translator could not find IID in translator page.".into())
        })?;

    let helper_marker = "params_AbusePreventionHelper";
    let helper_pos = html.find(helper_marker).ok_or_else(|| {
        ProviderError::Message("Bing Translator missing AbusePreventionHelper params.".into())
    })?;
    let after = &html[helper_pos + helper_marker.len()..];
    let bracket_start = after.find('[').ok_or_else(|| {
        ProviderError::Message("Bing AbusePreventionHelper array missing.".into())
    })?;
    let bracket_end = after[bracket_start..].find(']').ok_or_else(|| {
        ProviderError::Message("Bing AbusePreventionHelper array unclosed.".into())
    })?;
    let array_json = &after[bracket_start..=bracket_start + bracket_end];
    let parsed: Value = serde_json::from_str(array_json).map_err(|err| {
        ProviderError::Message(format!(
            "Bing Translator invalid AbusePreventionHelper JSON: {err}"
        ))
    })?;
    let arr = parsed.as_array().ok_or_else(|| {
        ProviderError::Message("Bing AbusePreventionHelper is not an array.".into())
    })?;
    if arr.len() < 3 {
        return Err(ProviderError::Message(
            "Bing AbusePreventionHelper array is too short.".into(),
        ));
    }
    let key = arr[0]
        .as_u64()
        .or_else(|| arr[0].as_i64().map(|v| v as u64))
        .ok_or_else(|| ProviderError::Message("Bing AbusePreventionHelper key invalid.".into()))?;
    let token = arr[1]
        .as_str()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ProviderError::Message("Bing AbusePreventionHelper token empty.".into()))?
        .to_string();
    let expiry_ms = arr[2]
        .as_u64()
        .or_else(|| arr[2].as_i64().map(|v| v as u64))
        .unwrap_or(3_600_000);
    let ttl = Duration::from_millis(expiry_ms).saturating_sub(SESSION_SKEW);
    let ttl = if ttl.is_zero() {
        Duration::from_secs(60)
    } else {
        ttl
    };

    Ok(BingSession {
        ig,
        iid,
        key,
        token,
        issued_at: Instant::now(),
        ttl,
    })
}

#[derive(Clone)]
struct BingSession {
    ig: String,
    iid: String,
    key: u64,
    token: String,
    issued_at: Instant,
    ttl: Duration,
}

impl BingSession {
    fn is_fresh(&self) -> bool {
        self.issued_at.elapsed() < self.ttl
    }
}

pub struct BingTranslatorProvider {
    transport: Arc<SharedHttpClient>,
    session: RwLock<Option<BingSession>>,
    bootstrap: tokio::sync::Mutex<()>,
}

impl BingTranslatorProvider {
    pub fn new(transport: Arc<SharedHttpClient>) -> Self {
        Self {
            transport,
            session: RwLock::new(None),
            bootstrap: tokio::sync::Mutex::new(()),
        }
    }

    fn cached_session(&self) -> Option<BingSession> {
        let guard = self.session.read().ok()?;
        let session = guard.as_ref()?;
        if session.is_fresh() {
            Some(session.clone())
        } else {
            None
        }
    }

    fn store_session(&self, session: BingSession) {
        if let Ok(mut guard) = self.session.write() {
            *guard = Some(session);
        }
    }

    fn clear_session(&self) {
        if let Ok(mut guard) = self.session.write() {
            *guard = None;
        }
    }

    async fn fetch_session(&self, timeout_secs: Option<f64>) -> Result<BingSession, ProviderError> {
        let response = self
            .transport
            .client()
            .get(BING_WEBSITE)
            .header(reqwest::header::USER_AGENT, BING_USER_AGENT)
            .header(reqwest::header::ACCEPT, "text/html,application/xhtml+xml")
            .timeout(http::effective_request_timeout(timeout_secs))
            .send()
            .await?;
        let status = response.status();
        let html = response.text().await.unwrap_or_default();
        if !status.is_success() {
            let detail = http::truncate_error_body(&html, 280);
            let suffix = if detail.is_empty() {
                String::new()
            } else {
                format!(" - {detail}")
            };
            return Err(ProviderError::Message(format!(
                "Bing Translator page failed: HTTP {status}{suffix}"
            )));
        }
        let session = parse_bing_session(&html)?;
        debug!(
            ig_len = session.ig.len(),
            iid = %session.iid,
            ttl_secs = session.ttl.as_secs(),
            "refreshed bing translator session"
        );
        Ok(session)
    }

    async fn ensure_session(
        &self,
        timeout_secs: Option<f64>,
    ) -> Result<BingSession, ProviderError> {
        if let Some(session) = self.cached_session() {
            return Ok(session);
        }
        let _guard = self.bootstrap.lock().await;
        if let Some(session) = self.cached_session() {
            return Ok(session);
        }
        let session = self.fetch_session(timeout_secs).await?;
        self.store_session(session.clone());
        Ok(session)
    }

    async fn post_translate(
        &self,
        session: &BingSession,
        text: &str,
        from_lang: &str,
        to: &str,
        timeout_secs: Option<f64>,
    ) -> Result<(StatusCode, String), ProviderError> {
        let key = session.key.to_string();
        let response = self
            .transport
            .client()
            .post(BING_TRANSLATE_URL)
            .query(&[
                ("isVertical", "1"),
                ("IG", session.ig.as_str()),
                ("IID", session.iid.as_str()),
            ])
            .header(reqwest::header::USER_AGENT, BING_USER_AGENT)
            .header(reqwest::header::REFERER, BING_WEBSITE)
            .header(
                reqwest::header::CONTENT_TYPE,
                "application/x-www-form-urlencoded",
            )
            .form(&[
                ("fromLang", from_lang),
                ("to", to),
                ("text", text),
                ("token", session.token.as_str()),
                ("key", key.as_str()),
            ])
            .timeout(http::effective_request_timeout(timeout_secs))
            .send()
            .await?;
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        Ok((status, body))
    }
}

#[async_trait]
impl TranslationProvider for BingTranslatorProvider {
    fn info(&self) -> ProviderInfo {
        ProviderInfo {
            name: "bing_translator",
            group: "experimental",
            experimental: true,
            local_provider: false,
            supports_live_partial: true,
        }
    }

    async fn translate(&self, request: TranslateRequest<'_>) -> Result<String, ProviderError> {
        let source = normalize_source_lang(request.source_lang);
        let from_lang = if source == "auto" {
            "auto-detect".to_string()
        } else {
            azure_lang(&source)
        };
        let to = azure_lang(request.target_lang);

        let mut session = self.ensure_session(request.timeout_secs).await?;
        let mut attempt = self
            .post_translate(
                &session,
                request.text,
                &from_lang,
                &to,
                request.timeout_secs,
            )
            .await?;

        if matches!(
            attempt.0,
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN | StatusCode::BAD_REQUEST
        ) {
            let _guard = self.bootstrap.lock().await;
            self.clear_session();
            drop(_guard);
            session = self.ensure_session(request.timeout_secs).await?;
            attempt = self
                .post_translate(
                    &session,
                    request.text,
                    &from_lang,
                    &to,
                    request.timeout_secs,
                )
                .await?;
        }

        let (status, payload) = attempt;
        if !status.is_success() {
            let detail = http::truncate_error_body(&payload, 280);
            let suffix = if detail.is_empty() {
                String::new()
            } else {
                format!(" - {detail}")
            };
            return Err(ProviderError::Message(format!(
                "Bing Translator request failed: HTTP {status}{suffix}"
            )));
        }

        let value: Value = serde_json::from_str(&payload).map_err(|err| {
            ProviderError::Message(format!("Bing Translator returned invalid JSON: {err}"))
        })?;
        let translated = extract_translation_text(&value);
        if translated.is_empty() {
            return Err(ProviderError::Message(
                "Bing Translator returned an empty translation.".into(),
            ));
        }
        Ok(translated)
    }

    fn diagnostics(&self, settings: &HashMap<String, String>) -> Value {
        let mut diag = base_diagnostics(&self.info(), settings);
        if let Some(obj) = diag.as_object_mut() {
            obj.insert(
                "status_message".into(),
                json!(
                    "Experimental keyless Bing Translator web session. \
                     No API key required; availability may change."
                ),
            );
            obj.insert(
                "session_cached".into(),
                json!(self.cached_session().is_some()),
            );
        }
        diag
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_translation_text_reads_bing_shape() {
        let payload = json!([{
            "translations": [{ "text": "привет, мир", "to": "ru" }],
            "detectedLanguage": { "language": "en" },
            "usedLLM": true
        }]);
        assert_eq!(extract_translation_text(&payload), "привет, мир");
    }

    #[test]
    fn extract_translation_text_is_empty_for_unexpected_shape() {
        assert_eq!(extract_translation_text(&json!({})), "");
        assert_eq!(extract_translation_text(&json!([])), "");
    }

    #[test]
    fn parse_bing_session_reads_ig_iid_and_helper() {
        let html = r#"
            window._G={IG:"ABCDEF0123456789",V:"translator"};
            <div data-iid="translator.5023"></div>
            var params_AbusePreventionHelper = [1785829134801,"hIGqTFNreW1JCdfW2tvj4hMfXFONaHIn",3600000];
        "#;
        let session = parse_bing_session(html).expect("parse");
        assert_eq!(session.ig, "ABCDEF0123456789");
        assert_eq!(session.iid, "translator.5023");
        assert_eq!(session.key, 1_785_829_134_801);
        assert_eq!(session.token, "hIGqTFNreW1JCdfW2tvj4hMfXFONaHIn");
        assert!(session.ttl < Duration::from_millis(3_600_000));
        assert!(session.ttl >= Duration::from_secs(60));
    }

    #[test]
    fn parse_bing_session_rejects_missing_fields() {
        assert!(parse_bing_session("<html></html>").is_err());
        assert!(parse_bing_session(r#"IG:"only""#).is_err());
    }

    #[test]
    fn session_cache_round_trips_and_expires() {
        let provider = BingTranslatorProvider::new(SharedHttpClient::new(reqwest::Client::new()));
        assert!(provider.cached_session().is_none());
        provider.store_session(BingSession {
            ig: "ig".into(),
            iid: "iid".into(),
            key: 1,
            token: "tok".into(),
            issued_at: Instant::now(),
            ttl: Duration::from_secs(60),
        });
        assert_eq!(provider.cached_session().expect("fresh").ig, "ig");
        provider.clear_session();
        assert!(provider.cached_session().is_none());

        provider.store_session(BingSession {
            ig: "ig".into(),
            iid: "iid".into(),
            key: 1,
            token: "tok".into(),
            issued_at: Instant::now() - Duration::from_secs(120),
            ttl: Duration::from_secs(60),
        });
        assert!(provider.cached_session().is_none());
    }
}
