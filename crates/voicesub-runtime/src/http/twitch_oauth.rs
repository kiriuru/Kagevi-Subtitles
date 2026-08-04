use std::sync::Arc;

use super::state::HttpState;
use axum::Json;
use axum::extract::State;
use serde::Deserialize;
use serde_json::{Value, json};
use tracing::info;
use voicesub_tts::TwitchOAuthPending;

#[derive(Debug, Deserialize)]
pub struct TwitchOAuthCompleteRequest {
    #[serde(default)]
    pub token: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
    /// CSRF state issued by `oauth-open` and echoed by Twitch redirect.
    #[serde(default)]
    pub state: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TwitchOAuthOpenRequest {
    pub url: String,
}

fn normalize_token(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if trimmed.to_ascii_lowercase().starts_with("oauth:") {
        trimmed.to_string()
    } else {
        format!("oauth:{trimmed}")
    }
}

fn with_oauth_state(url: &str, state: &str) -> Result<String, &'static str> {
    let mut parsed = url::Url::parse(url).map_err(|_| "invalid url")?;
    let mut pairs: Vec<(String, String)> = parsed
        .query_pairs()
        .filter(|(key, _)| key != "state")
        .map(|(key, value)| (key.into_owned(), value.into_owned()))
        .collect();
    pairs.push(("state".to_string(), state.to_string()));
    parsed.set_query(None);
    parsed
        .query_pairs_mut()
        .extend_pairs(pairs.iter().map(|(k, v)| (k.as_str(), v.as_str())));
    Ok(parsed.to_string())
}

pub async fn twitch_oauth_complete(
    State(state): State<Arc<HttpState>>,
    Json(body): Json<TwitchOAuthCompleteRequest>,
) -> Json<Value> {
    let provided_state = body.state.as_deref().unwrap_or("");
    if !state.twitch_oauth.consume_login_state(provided_state) {
        tracing::warn!(
            target: "voicesub.tts.oauth",
            "twitch oauth-complete rejected: missing or invalid state"
        );
        return Json(json!({ "ok": false, "error": "invalid_state" }));
    }

    let error_code = body
        .error
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    if let Some(code) = error_code {
        let message = body
            .message
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(code);
        info!(
            target: "voicesub.tts.oauth",
            error = %code,
            "twitch oauth denied or failed in system browser"
        );
        state.twitch_oauth.store_error(code, message);
        return Json(json!({ "ok": true, "status": "error" }));
    }

    let token = normalize_token(body.token.as_deref().unwrap_or(""));
    if token.is_empty() {
        return Json(json!({ "ok": false, "error": "empty token" }));
    }
    state.twitch_oauth.store_token(token);
    Json(json!({ "ok": true, "status": "token" }))
}

pub async fn twitch_oauth_pending(State(state): State<Arc<HttpState>>) -> Json<Value> {
    match state.twitch_oauth.take() {
        Some(TwitchOAuthPending::Token(token)) => {
            Json(json!({ "ok": true, "token": token, "status": "token" }))
        }
        Some(TwitchOAuthPending::Error { code, message }) => Json(json!({
            "ok": false,
            "status": "error",
            "error": code,
            "message": message,
        })),
        None => Json(json!({ "ok": false, "status": "none" })),
    }
}

pub async fn twitch_oauth_open(
    State(state): State<Arc<HttpState>>,
    Json(body): Json<TwitchOAuthOpenRequest>,
) -> Json<Value> {
    let trimmed = body.url.trim();
    if trimmed.is_empty() {
        return Json(json!({ "ok": false, "error": "empty url" }));
    }
    if !trimmed.starts_with("https://id.twitch.tv/") {
        return Json(json!({ "ok": false, "error": "only Twitch OAuth URLs are allowed" }));
    }
    let oauth_state = state.twitch_oauth.begin_login_state();
    let Ok(url) = with_oauth_state(trimmed, &oauth_state) else {
        return Json(json!({ "ok": false, "error": "invalid url" }));
    };
    info!(target: "voicesub.tts.oauth", url = %url, "opening twitch oauth in system browser");
    match open::that(&url) {
        Ok(()) => Json(json!({ "ok": true, "state": oauth_state })),
        Err(err) => Json(json!({ "ok": false, "error": err.to_string() })),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn with_oauth_state_replaces_existing_state() {
        let url = with_oauth_state(
            "https://id.twitch.tv/oauth2/authorize?client_id=x&state=old&scope=chat%3Aread",
            "new-state",
        )
        .expect("url");
        assert!(url.contains("state=new-state"));
        assert!(!url.contains("state=old"));
    }
}
