//! Per-session secret for `/api/*` and gated app HTML pages.
//!
//! Auth: request header (Tauri IPC) **or** HttpOnly cookie after one-time `bootstrap` query.
//! Cookie-authed mutating requests also require a loopback Origin / same-origin Fetch Metadata.
//! HTML pages must **not** embed the session token.

use std::collections::HashSet;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use axum::{
    body::Body,
    extract::{Request, State},
    http::{HeaderMap, HeaderValue, Method, StatusCode, header},
    middleware::Next,
    response::Response,
};
use uuid::Uuid;

use super::state::HttpState;

/// Primary loopback API auth header (Kagevi Subtitles).
pub const LOOPBACK_TOKEN_HEADER: &str = "x-kagevi-subtitles-token";
/// Previous Kagevi Voice header — still accepted during upgrades.
pub const LOOPBACK_TOKEN_HEADER_PREV: &str = "x-kagevi-voice-token";
/// Legacy VoiceSub header — still accepted for mixed-client upgrades.
pub const LOOPBACK_TOKEN_HEADER_LEGACY: &str = "x-voicesub-token";
/// HttpOnly cookie set after a one-time bootstrap nonce is consumed.
pub const LOOPBACK_COOKIE_NAME: &str = "kagevi_loopback";
/// Query param on gated app pages (consumed once → cookie).
pub const LOOPBACK_BOOTSTRAP_QUERY: &str = "bootstrap";
/// Query param for non-loopback WebSocket clients (LAN).
pub const LOOPBACK_WS_TOKEN_QUERY: &str = "loopback_token";

/// Cap concurrent pending bootstraps (dashboard + TTS + Local ASR + worker).
const MAX_PENDING_BOOTSTRAPS: usize = 32;

#[derive(Clone)]
pub struct LoopbackAuth {
    token: Arc<str>,
    bootstrap_nonces: Arc<Mutex<HashSet<String>>>,
}

impl LoopbackAuth {
    pub fn generate() -> Self {
        Self {
            token: Arc::from(Uuid::new_v4().to_string()),
            bootstrap_nonces: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    pub fn token(&self) -> &str {
        &self.token
    }

    /// Issue a fresh one-time nonce for a window/worker launch URL.
    pub fn issue_bootstrap_nonce(&self) -> String {
        let nonce = Uuid::new_v4().to_string();
        let mut set = self
            .bootstrap_nonces
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if set.len() >= MAX_PENDING_BOOTSTRAPS {
            if let Some(oldest) = set.iter().next().cloned() {
                set.remove(&oldest);
            }
        }
        set.insert(nonce.clone());
        nonce
    }

    /// Consume a bootstrap nonce (single use). Returns true when it was pending.
    pub fn consume_bootstrap_nonce(&self, provided: &str) -> bool {
        let trimmed = provided.trim();
        if trimmed.is_empty() {
            return false;
        }
        let mut set = self
            .bootstrap_nonces
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let Some(matched) = set
            .iter()
            .find(|expected| constant_time_eq(trimmed.as_bytes(), expected.as_bytes()))
            .cloned()
        else {
            return false;
        };
        set.remove(&matched);
        true
    }

    pub fn authorize_headers(&self, headers: &HeaderMap) -> bool {
        self.token_from_headers(headers).is_some()
    }

    pub fn authorize_request(&self, headers: &HeaderMap) -> bool {
        self.authorize_http(headers, &Method::GET)
    }

    /// Authorize an HTTP API request.
    ///
    /// - Custom header → always OK (Tauri / explicit clients).
    /// - Cookie on safe methods → OK (Chrome worker reads).
    /// - Cookie on mutating methods → OK only with loopback Origin / same-origin fetch metadata
    ///   (OWASP CSRF defense-in-depth; SameSite=Lax already blocks most cross-site POSTs).
    pub fn authorize_http(&self, headers: &HeaderMap, method: &Method) -> bool {
        if self.token_from_headers(headers).is_some() {
            return true;
        }
        if self.token_from_cookie(headers).is_none() {
            return false;
        }
        if is_safe_method(method) {
            return true;
        }
        cookie_mutation_origin_ok(headers)
    }

    pub fn authorize_ws_client(
        &self,
        peer: SocketAddr,
        headers: &HeaderMap,
        query_token: Option<&str>,
    ) -> bool {
        if is_loopback_socket(peer) {
            return true;
        }
        if let Some(token) = query_token.map(str::trim).filter(|t| !t.is_empty())
            && constant_time_eq(token.as_bytes(), self.token.as_bytes())
        {
            return true;
        }
        self.token_from_headers(headers).is_some() || self.token_from_cookie(headers).is_some()
    }

    fn token_from_headers(&self, headers: &HeaderMap) -> Option<()> {
        for name in [
            LOOPBACK_TOKEN_HEADER,
            LOOPBACK_TOKEN_HEADER_PREV,
            LOOPBACK_TOKEN_HEADER_LEGACY,
        ] {
            if let Some(value) = headers.get(name)
                && let Ok(provided) = value.to_str()
                && constant_time_eq(provided.as_bytes(), self.token.as_bytes())
            {
                return Some(());
            }
        }
        None
    }

    fn token_from_cookie(&self, headers: &HeaderMap) -> Option<()> {
        cookie_value(headers, LOOPBACK_COOKIE_NAME)
            .filter(|provided| constant_time_eq(provided.as_bytes(), self.token.as_bytes()))
            .map(|_| ())
    }

    /// Append a one-time `bootstrap` query to a launch URL (`?` or `&` as needed).
    pub fn append_bootstrap_to_url(&self, url: &str) -> String {
        let bootstrap = self.issue_bootstrap_nonce();
        append_bootstrap_query(url, &bootstrap)
    }

    pub fn append_bootstrap_to_worker_url(&self, worker_url_with_query: &str) -> String {
        self.append_bootstrap_to_url(worker_url_with_query)
    }

    /// `Set-Cookie` value for the session token (HttpOnly, SameSite=Lax, Path=/).
    pub fn session_set_cookie_value(&self) -> String {
        format!(
            "{LOOPBACK_COOKIE_NAME}={}; HttpOnly; SameSite=Lax; Path=/",
            self.token()
        )
    }

    pub fn session_set_cookie_header(&self) -> HeaderValue {
        HeaderValue::from_str(&self.session_set_cookie_value())
            .unwrap_or_else(|_| HeaderValue::from_static("kagevi_loopback=; Path=/"))
    }
}

/// Attach `bootstrap=<nonce>` to a URL (public helper for Tauri URL builders).
pub fn append_bootstrap_query(url: &str, nonce: &str) -> String {
    let sep = if url.contains('?') { '&' } else { '?' };
    format!(
        "{url}{sep}{LOOPBACK_BOOTSTRAP_QUERY}={}",
        urlencoding::encode(nonce)
    )
}

pub fn is_loopback_socket(addr: SocketAddr) -> bool {
    match addr.ip() {
        std::net::IpAddr::V4(v4) => v4.is_loopback(),
        std::net::IpAddr::V6(v6) => {
            v6.is_loopback() || v6.to_ipv4_mapped().is_some_and(|v4| v4.is_loopback())
        }
    }
}

pub async fn loopback_auth_middleware(
    State(state): State<Arc<HttpState>>,
    request: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    if state
        .loopback_auth
        .authorize_http(request.headers(), request.method())
    {
        return Ok(next.run(request).await);
    }

    tracing::warn!(
        path = %request.uri().path(),
        method = %request.method(),
        "loopback API request rejected: missing/invalid token or disallowed Origin"
    );
    Err(StatusCode::UNAUTHORIZED)
}

fn is_safe_method(method: &Method) -> bool {
    matches!(*method, Method::GET | Method::HEAD | Method::OPTIONS)
}

fn cookie_mutation_origin_ok(headers: &HeaderMap) -> bool {
    if let Some(site) = headers
        .get("sec-fetch-site")
        .and_then(|value| value.to_str().ok())
    {
        let site = site.trim();
        if site.eq_ignore_ascii_case("same-origin") {
            return true;
        }
        if site.eq_ignore_ascii_case("cross-site") {
            return false;
        }
    }
    if let Some(origin) = headers
        .get(header::ORIGIN)
        .and_then(|value| value.to_str().ok())
    {
        return is_loopback_http_origin(origin);
    }
    // Non-browser clients often omit Origin; cookie+Lax already blocks classic cross-site POST.
    true
}

pub fn is_loopback_http_origin(origin: &str) -> bool {
    let origin = origin.trim();
    let Some(rest) = origin
        .strip_prefix("http://")
        .or_else(|| origin.strip_prefix("https://"))
    else {
        return false;
    };
    let host = rest
        .split('/')
        .next()
        .unwrap_or("")
        .split(':')
        .next()
        .unwrap_or("");
    matches!(host, "127.0.0.1" | "localhost" | "[::1]" | "::1")
}

fn cookie_value(headers: &HeaderMap, name: &str) -> Option<String> {
    let cookie_header = headers.get(header::COOKIE)?.to_str().ok()?;
    for part in cookie_header.split(';') {
        let part = part.trim();
        let Some((key, value)) = part.split_once('=') else {
            continue;
        };
        if key.trim() == name {
            let value = value.trim();
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    let mut diff = 0u8;
    for (a, b) in left.iter().zip(right.iter()) {
        diff |= a ^ b;
    }
    diff == 0
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;
    use std::net::{Ipv4Addr, SocketAddrV4};

    #[test]
    fn authorize_accepts_matching_header() {
        let auth = LoopbackAuth::generate();
        let mut headers = HeaderMap::new();
        headers.insert(
            LOOPBACK_TOKEN_HEADER,
            HeaderValue::from_str(auth.token()).expect("token header"),
        );
        assert!(auth.authorize_http(&headers, &Method::POST));
    }

    #[test]
    fn cookie_get_ok_cookie_cross_site_post_rejected() {
        let auth = LoopbackAuth::generate();
        let mut headers = HeaderMap::new();
        headers.insert(
            header::COOKIE,
            HeaderValue::from_str(&format!("{LOOPBACK_COOKIE_NAME}={}", auth.token()))
                .expect("cookie"),
        );
        assert!(auth.authorize_http(&headers, &Method::GET));

        headers.insert(
            header::ORIGIN,
            HeaderValue::from_static("https://evil.example"),
        );
        headers.insert("sec-fetch-site", HeaderValue::from_static("cross-site"));
        assert!(!auth.authorize_http(&headers, &Method::POST));
    }

    #[test]
    fn cookie_post_ok_with_loopback_origin() {
        let auth = LoopbackAuth::generate();
        let mut headers = HeaderMap::new();
        headers.insert(
            header::COOKIE,
            HeaderValue::from_str(&format!("{LOOPBACK_COOKIE_NAME}={}", auth.token()))
                .expect("cookie"),
        );
        headers.insert(
            header::ORIGIN,
            HeaderValue::from_static("http://127.0.0.1:8765"),
        );
        assert!(auth.authorize_http(&headers, &Method::POST));
    }

    #[test]
    fn ws_loopback_allowed_without_token() {
        let auth = LoopbackAuth::generate();
        let peer = SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::LOCALHOST, 12345));
        assert!(auth.authorize_ws_client(peer, &HeaderMap::new(), None));
    }

    #[test]
    fn ws_lan_requires_token() {
        let auth = LoopbackAuth::generate();
        let peer = SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::new(192, 168, 1, 10), 12345));
        assert!(!auth.authorize_ws_client(peer, &HeaderMap::new(), None));
        assert!(auth.authorize_ws_client(peer, &HeaderMap::new(), Some(auth.token())));
    }

    #[test]
    fn bootstrap_nonce_is_single_use() {
        let auth = LoopbackAuth::generate();
        let nonce = auth.issue_bootstrap_nonce();
        assert!(auth.consume_bootstrap_nonce(&nonce));
        assert!(!auth.consume_bootstrap_nonce(&nonce));
    }

    #[test]
    fn multiple_bootstrap_nonces_remain_valid_until_consumed() {
        let auth = LoopbackAuth::generate();
        let first = auth.issue_bootstrap_nonce();
        let second = auth.issue_bootstrap_nonce();
        assert!(auth.consume_bootstrap_nonce(&first));
        assert!(auth.consume_bootstrap_nonce(&second));
    }

    #[test]
    fn chrome_worker_launch_url_includes_bootstrap_query() {
        let auth = LoopbackAuth::generate();
        let url = auth.append_bootstrap_to_worker_url(
            "http://127.0.0.1:9123/google-asr?autostart=1&locale=ru",
        );
        assert!(url.contains("&bootstrap="));
        let nonce = url
            .rsplit_once("bootstrap=")
            .map(|(_, value)| value)
            .expect("bootstrap");
        assert!(auth.consume_bootstrap_nonce(nonce));
    }

    #[test]
    fn append_bootstrap_query_uses_question_mark_when_needed() {
        assert_eq!(
            append_bootstrap_query("http://127.0.0.1:8765/", "abc"),
            "http://127.0.0.1:8765/?bootstrap=abc"
        );
    }

    #[test]
    fn session_set_cookie_is_httponly_samesite_lax() {
        let auth = LoopbackAuth::generate();
        let value = auth.session_set_cookie_value();
        assert!(value.contains("HttpOnly"));
        assert!(value.contains("SameSite=Lax"));
    }

    #[test]
    fn is_loopback_http_origin_accepts_localhost_variants() {
        assert!(is_loopback_http_origin("http://127.0.0.1:8765"));
        assert!(is_loopback_http_origin("http://localhost:8765"));
        assert!(!is_loopback_http_origin("https://evil.example"));
    }
}
