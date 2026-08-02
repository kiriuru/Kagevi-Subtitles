use std::fs;
use std::path::Path;

use serde_json::Value;

pub fn read_full_logging_enabled(payload: &Value) -> bool {
    payload
        .get("logging")
        .and_then(|section| section.get("full_enabled"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

/// Detailed Tools / runtime metrics (Local ASR decode counters, translation dispatcher stats).
/// Default off — avoids high-churn `diagnostics_update` fanout while recognition is active.
pub fn read_runtime_metrics_enabled(payload: &Value) -> bool {
    payload
        .get("logging")
        .and_then(|section| section.get("runtime_metrics_enabled"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

pub fn read_full_logging_enabled_from_config_path(config_path: &Path) -> bool {
    read_logging_bool_from_config_path(config_path, "full_enabled")
}

pub fn read_runtime_metrics_enabled_from_config_path(config_path: &Path) -> bool {
    read_logging_bool_from_config_path(config_path, "runtime_metrics_enabled")
}

fn read_logging_bool_from_config_path(config_path: &Path, key: &str) -> bool {
    if !config_path.is_file() {
        return false;
    }
    let raw = match fs::read_to_string(config_path) {
        Ok(text) => text,
        Err(_) => return false,
    };
    let payload = if config_path
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("json"))
    {
        match serde_json::from_str(&raw) {
            Ok(value) => value,
            Err(_) => return false,
        }
    } else {
        let toml_value: toml::Value = match toml::from_str(&raw) {
            Ok(value) => value,
            Err(_) => return false,
        };
        match serde_json::to_value(toml_value) {
            Ok(value) => value,
            Err(_) => return false,
        }
    };
    payload
        .get("logging")
        .and_then(|section| section.get(key))
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

/// Read logging preferences before `config.toml` exists (SST `config.json` import path).
pub fn read_full_logging_enabled_from_user_data(user_data_dir: &Path) -> bool {
    read_logging_bool_from_user_data(user_data_dir, "full_enabled")
}

pub fn read_runtime_metrics_enabled_from_user_data(user_data_dir: &Path) -> bool {
    read_logging_bool_from_user_data(user_data_dir, "runtime_metrics_enabled")
}

fn read_logging_bool_from_user_data(user_data_dir: &Path, key: &str) -> bool {
    let toml_path = user_data_dir.join(crate::paths::RUNTIME_CONFIG_TOML);
    if toml_path.is_file() {
        return read_logging_bool_from_config_path(&toml_path, key);
    }
    let json_path = user_data_dir.join(crate::paths::LEGACY_SST_CONFIG_JSON);
    if json_path.is_file() {
        return read_logging_bool_from_config_path(&json_path, key);
    }
    false
}

pub fn normalize_logging_config(payload: &Value) -> Value {
    let current = payload
        .get("logging")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();
    serde_json::json!({
        "full_enabled": current.get("full_enabled").and_then(|v| v.as_bool()).unwrap_or(false),
        "runtime_metrics_enabled": current
            .get("runtime_metrics_enabled")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn defaults_logging_flags_to_false() {
        assert!(!read_full_logging_enabled(&json!({})));
        assert!(!read_runtime_metrics_enabled(&json!({})));
        assert_eq!(
            normalize_logging_config(&json!({})),
            json!({ "full_enabled": false, "runtime_metrics_enabled": false })
        );
    }

    #[test]
    fn reads_true_flags() {
        let payload = json!({
            "logging": {
                "full_enabled": true,
                "runtime_metrics_enabled": true
            }
        });
        assert!(read_full_logging_enabled(&payload));
        assert!(read_runtime_metrics_enabled(&payload));
    }
}
