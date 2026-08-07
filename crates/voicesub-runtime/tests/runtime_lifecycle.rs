#![allow(clippy::await_holding_lock)]

mod common;

use std::time::Duration;

use common::{AuthedApi, EphemeralRuntime, integration_lock};
use voicesub_runtime::{LOOPBACK_COOKIE_NAME, LOOPBACK_TOKEN_HEADER};

#[tokio::test]
async fn runtime_start_and_stop_serves_health() {
    let _guard = integration_lock();
    let runtime = EphemeralRuntime::new();
    let handle = runtime.start().await;
    let addr = handle.bind_addr;

    let client = reqwest::Client::new();
    let api = AuthedApi::new(&client, &runtime.service);
    let response = api
        .get(format!("http://{addr}/api/health"))
        .timeout(Duration::from_secs(3))
        .send()
        .await
        .expect("health request");
    assert!(response.status().is_success());

    handle.shutdown().await;
}

#[tokio::test]
async fn protected_api_rejects_missing_token() {
    let _guard = integration_lock();
    let runtime = EphemeralRuntime::new();
    let handle = runtime.start().await;
    let addr = handle.bind_addr;

    let client = reqwest::Client::new();
    let response = client
        .get(format!("http://{addr}/api/settings/load"))
        .timeout(Duration::from_secs(3))
        .send()
        .await
        .expect("settings load");
    assert_eq!(response.status(), reqwest::StatusCode::UNAUTHORIZED);

    handle.shutdown().await;
}

#[tokio::test]
async fn protected_api_rejects_invalid_token() {
    let _guard = integration_lock();
    let runtime = EphemeralRuntime::new();
    let handle = runtime.start().await;
    let addr = handle.bind_addr;

    let client = reqwest::Client::new();
    let response = client
        .get(format!("http://{addr}/api/settings/load"))
        .header(LOOPBACK_TOKEN_HEADER, "not-the-session-token")
        .timeout(Duration::from_secs(3))
        .send()
        .await
        .expect("settings load");
    assert_eq!(response.status(), reqwest::StatusCode::UNAUTHORIZED);

    handle.shutdown().await;
}

#[tokio::test]
async fn runtime_settings_load_after_start() {
    let _guard = integration_lock();
    let runtime = EphemeralRuntime::new();
    let handle = runtime.start().await;
    let addr = handle.bind_addr;

    let client = reqwest::Client::new();
    let api = AuthedApi::new(&client, &runtime.service);
    let response = api
        .get(format!("http://{addr}/api/settings/load"))
        .timeout(Duration::from_secs(3))
        .send()
        .await
        .expect("settings load");
    assert!(response.status().is_success());
    let body: serde_json::Value = response.json().await.expect("json");
    assert!(body.get("payload").is_some());

    handle.shutdown().await;
}

#[tokio::test]
async fn protected_health_rejects_missing_token() {
    let _guard = integration_lock();
    let runtime = EphemeralRuntime::new();
    let handle = runtime.start().await;
    let addr = handle.bind_addr;

    let client = reqwest::Client::new();
    let response = client
        .get(format!("http://{addr}/api/health"))
        .timeout(Duration::from_secs(3))
        .send()
        .await
        .expect("health request");
    assert_eq!(response.status(), reqwest::StatusCode::UNAUTHORIZED);

    handle.shutdown().await;
}

#[tokio::test]
async fn public_live_endpoint_without_token() {
    let _guard = integration_lock();
    let runtime = EphemeralRuntime::new();
    let handle = runtime.start().await;
    let addr = handle.bind_addr;

    let client = reqwest::Client::new();
    let response = client
        .get(format!("http://{addr}/live"))
        .timeout(Duration::from_secs(3))
        .send()
        .await
        .expect("live request");
    assert!(response.status().is_success());
    let body: serde_json::Value = response.json().await.expect("json");
    assert_eq!(body["ok"], true);

    handle.shutdown().await;
}

#[tokio::test]
async fn gated_app_pages_reject_unauthenticated_browser() {
    let _guard = integration_lock();
    let runtime = EphemeralRuntime::new();
    let handle = runtime.start().await;
    let addr = handle.bind_addr;

    let client = reqwest::Client::new();
    for path in ["/", "/google-asr", "/google-asr-compact", "/local-asr"] {
        let response = client
            .get(format!("http://{addr}{path}"))
            .timeout(Duration::from_secs(3))
            .send()
            .await
            .unwrap_or_else(|_| panic!("{path} request"));
        assert_eq!(
            response.status(),
            reqwest::StatusCode::UNAUTHORIZED,
            "{path} must require bootstrap/cookie"
        );
    }

    let tts = client
        .get(format!("http://{addr}/tts"))
        .timeout(Duration::from_secs(3))
        .send()
        .await
        .expect("tts unauth");
    assert!(tts.status().is_success());
    let html = tts.text().await.expect("tts html");
    assert!(
        html.contains("/api/tts/twitch/oauth-complete"),
        "unauth /tts must be Twitch OAuth shell"
    );
    assert!(
        !html.contains("__KAGEVI_SUBTITLES_API_TOKEN__"),
        "oauth shell must not inject session token"
    );
    assert!(
        !html.contains("tts-assets"),
        "oauth shell must not load full TTS SPA"
    );

    handle.shutdown().await;
}

#[tokio::test]
async fn gated_app_pages_serve_html_with_session_cookie() {
    let _guard = integration_lock();
    let runtime = EphemeralRuntime::new();
    let handle = runtime.start().await;
    let addr = handle.bind_addr;
    let cookie = format!(
        "{LOOPBACK_COOKIE_NAME}={}",
        runtime.service.loopback_api_token()
    );

    let client = reqwest::Client::new();
    for path in [
        "/",
        "/google-asr",
        "/google-asr-compact",
        "/tts",
        "/local-asr",
    ] {
        let response = client
            .get(format!("http://{addr}{path}"))
            .header(reqwest::header::COOKIE, &cookie)
            .timeout(Duration::from_secs(3))
            .send()
            .await
            .unwrap_or_else(|_| panic!("{path} request"));
        assert!(
            response.status().is_success(),
            "{path} status {}",
            response.status()
        );
        let html = response.text().await.expect("html body");
        assert!(
            !html.contains("__KAGEVI_SUBTITLES_API_TOKEN__"),
            "{path} must not inject loopback API token"
        );
    }

    handle.shutdown().await;
}

#[tokio::test]
async fn protected_api_rejects_unauthenticated_requests() {
    let _guard = integration_lock();
    let runtime = EphemeralRuntime::new();
    let handle = runtime.start().await;
    let addr = handle.bind_addr;

    let client = reqwest::Client::new();
    let response = client
        .get(format!("http://{addr}/api/settings/load"))
        .timeout(Duration::from_secs(3))
        .send()
        .await
        .expect("settings load");
    assert_eq!(response.status(), reqwest::StatusCode::UNAUTHORIZED);

    handle.shutdown().await;
}

#[tokio::test]
async fn google_asr_bootstrap_sets_cookie_and_authorizes_api() {
    let _guard = integration_lock();
    let runtime = EphemeralRuntime::new();
    let handle = runtime.start().await;
    let addr = handle.bind_addr;
    let nonce = runtime.service.issue_loopback_bootstrap_nonce();

    let client = reqwest::Client::new();
    let bootstrap = client
        .get(format!(
            "http://{addr}/google-asr?autostart=1&bootstrap={nonce}"
        ))
        .timeout(Duration::from_secs(3))
        .send()
        .await
        .expect("bootstrap");
    assert!(
        bootstrap.status().is_success(),
        "bootstrap must serve HTML immediately, got {}",
        bootstrap.status()
    );
    let set_cookie = bootstrap
        .headers()
        .get(reqwest::header::SET_COOKIE)
        .and_then(|v| v.to_str().ok())
        .expect("Set-Cookie")
        .to_string();
    assert!(set_cookie.contains(LOOPBACK_COOKIE_NAME));
    assert!(set_cookie.contains("HttpOnly"));
    assert!(set_cookie.contains("SameSite=Lax"));
    let html = bootstrap.text().await.expect("html");
    assert!(
        !html.contains("__KAGEVI_SUBTITLES_API_TOKEN__"),
        "must not inject session token into HTML"
    );
    assert!(
        html.contains("history.replaceState"),
        "bootstrap response should scrub nonce from the address bar"
    );

    let cookie_pair = set_cookie
        .split(';')
        .next()
        .expect("cookie pair")
        .to_string();
    let api = client
        .get(format!("http://{addr}/api/settings/load"))
        .header(reqwest::header::COOKIE, &cookie_pair)
        .timeout(Duration::from_secs(3))
        .send()
        .await
        .expect("settings load with cookie");
    assert!(api.status().is_success());

    let reused = client
        .get(format!(
            "http://{addr}/google-asr?autostart=1&bootstrap={nonce}"
        ))
        .timeout(Duration::from_secs(3))
        .send()
        .await
        .expect("reused bootstrap");
    assert_eq!(reused.status(), reqwest::StatusCode::UNAUTHORIZED);

    handle.shutdown().await;
}

#[tokio::test]
async fn twitch_oauth_complete_requires_state() {
    let _guard = integration_lock();
    let runtime = EphemeralRuntime::new();
    let handle = runtime.start().await;
    let addr = handle.bind_addr;

    let client = reqwest::Client::new();
    let rejected = client
        .post(format!("http://{addr}/api/tts/twitch/oauth-complete"))
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .body(r#"{"token":"oauth:test-token"}"#)
        .timeout(Duration::from_secs(3))
        .send()
        .await
        .expect("oauth-complete without state");
    assert!(rejected.status().is_success());
    let rejected_body: serde_json::Value = rejected.json().await.expect("json");
    assert_eq!(rejected_body["ok"], false);
    assert_eq!(rejected_body["error"], "invalid_state");

    let state = runtime.service.begin_twitch_oauth_state();
    let ok = client
        .post(format!("http://{addr}/api/tts/twitch/oauth-complete"))
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .body(format!(
            r#"{{"token":"oauth:test-token","state":"{state}"}}"#
        ))
        .timeout(Duration::from_secs(3))
        .send()
        .await
        .expect("oauth-complete with state");
    assert!(ok.status().is_success());
    let body: serde_json::Value = ok.json().await.expect("json");
    assert_eq!(body["ok"], true);

    handle.shutdown().await;
}

#[tokio::test]
async fn protected_api_accepts_runtime_token_without_html_injection() {
    let _guard = integration_lock();
    let runtime = EphemeralRuntime::new();
    let handle = runtime.start().await;
    let addr = handle.bind_addr;
    let token = runtime.service.loopback_api_token();

    let client = reqwest::Client::new();
    let response = client
        .get(format!("http://{addr}/api/settings/load"))
        .header(LOOPBACK_TOKEN_HEADER, token)
        .timeout(Duration::from_secs(3))
        .send()
        .await
        .expect("settings load");
    assert!(response.status().is_success());

    handle.shutdown().await;
}
