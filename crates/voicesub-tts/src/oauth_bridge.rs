use std::sync::Mutex;
use std::time::{Duration, Instant};

use uuid::Uuid;

const PENDING_TTL: Duration = Duration::from_secs(600);
const STATE_TTL: Duration = Duration::from_secs(600);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TwitchOAuthPending {
    Token(String),
    Error { code: String, message: String },
}

struct PendingOAuth {
    value: TwitchOAuthPending,
    received_at: Instant,
}

struct ExpectedState {
    value: String,
    issued_at: Instant,
}

#[derive(Default)]
pub struct TwitchOAuthBridge {
    pending: Mutex<Option<PendingOAuth>>,
    expected_state: Mutex<Option<ExpectedState>>,
}

impl TwitchOAuthBridge {
    /// Issue (or replace) the CSRF `state` for the next system-browser OAuth round-trip.
    pub fn begin_login_state(&self) -> String {
        let state = Uuid::new_v4().to_string();
        let mut guard = self
            .expected_state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        *guard = Some(ExpectedState {
            value: state.clone(),
            issued_at: Instant::now(),
        });
        state
    }

    /// Consume a matching OAuth `state` (single use). Returns false when missing/expired/wrong.
    pub fn consume_login_state(&self, provided: &str) -> bool {
        let trimmed = provided.trim();
        if trimmed.is_empty() {
            return false;
        }
        let mut guard = self
            .expected_state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let Some(expected) = guard.take() else {
            return false;
        };
        if expected.issued_at.elapsed() > STATE_TTL {
            return false;
        }
        constant_time_eq(trimmed.as_bytes(), expected.value.as_bytes())
    }

    pub fn store_token(&self, token: String) {
        let trimmed = token.trim();
        if trimmed.is_empty() {
            return;
        }
        self.put(TwitchOAuthPending::Token(trimmed.to_string()));
    }

    pub fn store_error(&self, code: impl Into<String>, message: impl Into<String>) {
        let code = code.into().trim().to_string();
        let message = message.into().trim().to_string();
        if code.is_empty() && message.is_empty() {
            return;
        }
        self.put(TwitchOAuthPending::Error {
            code: if code.is_empty() {
                "oauth_error".into()
            } else {
                code
            },
            message,
        });
    }

    /// Legacy helper — stores a successful token only.
    pub fn store(&self, token: String) {
        self.store_token(token);
    }

    fn put(&self, value: TwitchOAuthPending) {
        let mut guard = self
            .pending
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        *guard = Some(PendingOAuth {
            value,
            received_at: Instant::now(),
        });
    }

    pub fn take(&self) -> Option<TwitchOAuthPending> {
        let mut guard = self
            .pending
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let entry = guard.take()?;
        if entry.received_at.elapsed() > PENDING_TTL {
            return None;
        }
        Some(entry.value)
    }
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

    #[test]
    fn stores_and_takes_token() {
        let bridge = TwitchOAuthBridge::default();
        bridge.store_token("oauth:abc".into());
        assert_eq!(
            bridge.take(),
            Some(TwitchOAuthPending::Token("oauth:abc".into()))
        );
        assert_eq!(bridge.take(), None);
    }

    #[test]
    fn stores_and_takes_error() {
        let bridge = TwitchOAuthBridge::default();
        bridge.store_error("access_denied", "The user denied you access.");
        assert_eq!(
            bridge.take(),
            Some(TwitchOAuthPending::Error {
                code: "access_denied".into(),
                message: "The user denied you access.".into(),
            })
        );
        assert_eq!(bridge.take(), None);
    }

    #[test]
    fn error_overwrites_token() {
        let bridge = TwitchOAuthBridge::default();
        bridge.store_token("oauth:abc".into());
        bridge.store_error("access_denied", "denied");
        match bridge.take() {
            Some(TwitchOAuthPending::Error { code, .. }) => {
                assert_eq!(code, "access_denied");
            }
            other => panic!("expected error, got {other:?}"),
        }
    }

    #[test]
    fn login_state_is_single_use() {
        let bridge = TwitchOAuthBridge::default();
        let state = bridge.begin_login_state();
        assert!(bridge.consume_login_state(&state));
        assert!(!bridge.consume_login_state(&state));
    }

    #[test]
    fn login_state_rejects_wrong_value() {
        let bridge = TwitchOAuthBridge::default();
        let _ = bridge.begin_login_state();
        assert!(!bridge.consume_login_state("nope"));
    }
}
