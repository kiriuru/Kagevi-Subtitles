//! Keyless Microsoft Translator access via the anonymous token Edge itself uses.
//!
//! Flow: `GET /translate/auth` yields a short-lived anonymous JWT, which authorizes
//! `POST /translate` on the Edge-facing Translator host. No account or API key.

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

const AUTH_URL: &str = "https://edge.microsoft.com/translate/auth";
const TRANSLATE_URL: &str = "https://api-edge.cognitive.microsofttranslator.com/translate";

/// Anonymous JWTs live ~10 minutes; refresh early so a long request cannot outlive the token.
const TOKEN_TTL: Duration = Duration::from_secs(7 * 60);

/// The auth endpoint only answers browser-shaped requests.
const EDGE_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
     (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";

fn extract_edge_translation_text(payload: &Value) -> String {
    let mut parts = Vec::new();
    if let Some(items) = payload.as_array() {
        for item in items {
            if let Some(translations) = item.get("translations").and_then(|value| value.as_array()) {
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

struct CachedToken {
    token: String,
    issued_at: Instant,
}

pub struct MicrosoftEdgeProvider {
    transport: Arc<SharedHttpClient>,
    token: RwLock<Option<CachedToken>>,
}

impl MicrosoftEdgeProvider {
    pub fn new(transport: Arc<SharedHttpClient>) -> Self {
        Self {
            transport,
            token: RwLock::new(None),
        }
    }

    /// Returns an owned token so no lock guard is ever held across an `.await`.
    fn cached_token(&self) -> Option<String> {
        let guard = self.token.read().ok()?;
        let cached = guard.as_ref()?;
        if cached.issued_at.elapsed() < TOKEN_TTL {
            Some(cached.token.clone())
        } else {
            None
        }
    }

    fn store_token(&self, token: &str) {
        if let Ok(mut guard) = self.token.write() {
            *guard = Some(CachedToken {
                token: token.to_string(),
                issued_at: Instant::now(),
            });
        }
    }

    fn clear_token(&self) {
        if let Ok(mut guard) = self.token.write() {
            *guard = None;
        }
    }

    async fn fetch_token(&self, timeout_secs: Option<f64>) -> Result<String, ProviderError> {
        let response = self
            .transport
            .client()
            .get(AUTH_URL)
            .header(reqwest::header::USER_AGENT, EDGE_USER_AGENT)
            .timeout(http::effective_request_timeout(timeout_secs))
            .send()
            .await?;
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        if !status.is_success() {
            let detail = http::truncate_error_body(&body, 280);
            let suffix = if detail.is_empty() {
                String::new()
            } else {
                format!(" - {detail}")
            };
            return Err(ProviderError::Message(format!(
                "Microsoft Edge translate auth failed: HTTP {status}{suffix}"
            )));
        }
        let token = body.trim().to_string();
        if token.is_empty() {
            return Err(ProviderError::retryable(
                "Microsoft Edge translate auth returned an empty token.",
            ));
        }
        debug!(token_len = token.len(), "refreshed edge translate token");
        Ok(token)
    }

    async fn post_translate(
        &self,
        token: &str,
        body: &Value,
        from: Option<&str>,
        to: &str,
        timeout_secs: Option<f64>,
    ) -> Result<(StatusCode, String), ProviderError> {
        let mut query: Vec<(&str, &str)> = vec![("api-version", "3.0"), ("to", to)];
        if let Some(from) = from {
            query.push(("from", from));
        }
        let response = self
            .transport
            .client()
            .post(TRANSLATE_URL)
            .query(&query)
            .header(reqwest::header::USER_AGENT, EDGE_USER_AGENT)
            .bearer_auth(token)
            .json(body)
            .timeout(http::effective_request_timeout(timeout_secs))
            .send()
            .await?;
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        Ok((status, text))
    }
}

#[async_trait]
impl TranslationProvider for MicrosoftEdgeProvider {
    fn info(&self) -> ProviderInfo {
        ProviderInfo {
            name: "microsoft_edge",
            group: "experimental",
            experimental: true,
            local_provider: false,
            supports_live_partial: true,
        }
    }

    async fn translate(&self, request: TranslateRequest<'_>) -> Result<String, ProviderError> {
        let source = normalize_source_lang(request.source_lang);
        let from = if source == "auto" {
            None
        } else {
            Some(azure_lang(&source))
        };
        let to = azure_lang(request.target_lang);
        let body = json!([{ "Text": request.text }]);

        let mut token = match self.cached_token() {
            Some(token) => token,
            None => {
                let token = self.fetch_token(request.timeout_secs).await?;
                self.store_token(&token);
                token
            }
        };

        let mut attempt = self
            .post_translate(
                &token,
                &body,
                from.as_deref(),
                &to,
                request.timeout_secs,
            )
            .await?;

        // A cached token can be revoked before its TTL elapses; refresh once, then give up.
        if matches!(attempt.0, StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN) {
            self.clear_token();
            token = self.fetch_token(request.timeout_secs).await?;
            self.store_token(&token);
            attempt = self
                .post_translate(
                    &token,
                    &body,
                    from.as_deref(),
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
                "Microsoft Edge translate request failed: HTTP {status}{suffix}"
            )));
        }

        let value: Value = serde_json::from_str(&payload).map_err(|err| {
            ProviderError::Message(format!(
                "Microsoft Edge translate returned invalid JSON: {err}"
            ))
        })?;
        let translated = extract_edge_translation_text(&value);
        if translated.is_empty() {
            return Err(ProviderError::Message(
                "Microsoft Edge translate returned an empty translation.".into(),
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
                    "Experimental keyless Microsoft Translator via Edge anonymous token. \
                     No API key required; availability may change."
                ),
            );
            obj.insert("token_cached".into(), json!(self.cached_token().is_some()));
        }
        diag
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_edge_translation_text_reads_translations_array() {
        let payload = json!([{
            "detectedLanguage": { "language": "en", "score": 0.9 },
            "translations": [{ "text": "Привет, мир", "to": "ru" }]
        }]);
        assert_eq!(extract_edge_translation_text(&payload), "Привет, мир");
    }

    #[test]
    fn extract_edge_translation_text_is_empty_for_unexpected_shape() {
        assert_eq!(extract_edge_translation_text(&json!({})), "");
        assert_eq!(extract_edge_translation_text(&json!([])), "");
        assert_eq!(
            extract_edge_translation_text(&json!([{ "error": "nope" }])),
            ""
        );
    }

    #[test]
    fn token_cache_round_trips_and_clears() {
        let provider =
            MicrosoftEdgeProvider::new(SharedHttpClient::new(reqwest::Client::new()));
        assert_eq!(provider.cached_token(), None);
        provider.store_token("jwt-value");
        assert_eq!(provider.cached_token().as_deref(), Some("jwt-value"));
        provider.clear_token();
        assert_eq!(provider.cached_token(), None);
    }

    #[test]
    fn expired_token_is_not_reused() {
        let provider =
            MicrosoftEdgeProvider::new(SharedHttpClient::new(reqwest::Client::new()));
        if let Ok(mut guard) = provider.token.write() {
            *guard = Some(CachedToken {
                token: "stale".into(),
                issued_at: Instant::now() - (TOKEN_TTL + Duration::from_secs(1)),
            });
        }
        assert_eq!(provider.cached_token(), None);
    }
}
