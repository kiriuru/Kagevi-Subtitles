//! Main dashboard WebView entry URL — must match embedded Axum static host.

use std::net::SocketAddr;

use voicesub_runtime::append_bootstrap_query;

/// HTTP URL the Tauri shell navigates to after loading bundled assets (`lib.rs` setup).
/// `bootstrap` is a one-time nonce so the page can set the HttpOnly session cookie.
pub fn main_dashboard_http_url(bind_addr: SocketAddr, bootstrap: &str) -> String {
    let base = format!("http://{}:{}/", bind_addr.ip(), bind_addr.port());
    append_bootstrap_query(&base, bootstrap)
}

#[cfg(test)]
mod tests {
    use std::net::{Ipv4Addr, SocketAddrV4};

    use super::*;

    #[test]
    fn main_dashboard_url_includes_bootstrap() {
        let addr = SocketAddrV4::new(Ipv4Addr::LOCALHOST, 8765).into();
        let url = main_dashboard_http_url(addr, "test-nonce");
        assert_eq!(url, "http://127.0.0.1:8765/?bootstrap=test-nonce");
    }

    #[test]
    fn main_dashboard_url_preserves_custom_port() {
        let addr = SocketAddrV4::new(Ipv4Addr::LOCALHOST, 9123).into();
        let url = main_dashboard_http_url(addr, "n");
        assert_eq!(url, "http://127.0.0.1:9123/?bootstrap=n");
    }
}
