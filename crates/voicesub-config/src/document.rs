use serde_json::{Map, Value};

use crate::defaults::default_config_payload;

#[derive(Debug, Clone)]
pub struct ConfigDocument {
    payload: Value,
    loaded_from: String,
}

impl ConfigDocument {
    pub fn with_defaults() -> Self {
        Self {
            payload: default_config_payload(),
            loaded_from: "defaults".into(),
        }
    }

    pub fn from_payload(payload: Value, loaded_from: impl Into<String>) -> Self {
        Self {
            payload,
            loaded_from: loaded_from.into(),
        }
    }

    pub fn payload(&self) -> &Value {
        &self.payload
    }

    pub fn payload_mut(&mut self) -> &mut Value {
        &mut self.payload
    }

    pub fn loaded_from(&self) -> &str {
        &self.loaded_from
    }

    pub fn set_loaded_from(&mut self, loaded_from: impl Into<String>) {
        self.loaded_from = loaded_from.into();
    }

    /// Merge a save request into the live document.
    ///
    /// Top-level keys still replace (dashboard/profile full sections). `asr` is deep-merged so
    /// omitted worker-owned `asr.browser` keys (continuous/interim/force-final/lang) survive
    /// Start/Save from a stale dashboard snapshot. Arrays/scalars inside a merge still replace.
    pub fn merge_save_request(&mut self, incoming: &Value) {
        let Some(incoming_obj) = incoming.as_object() else {
            return;
        };
        let Some(root) = self.payload.as_object_mut() else {
            return;
        };
        for (key, value) in incoming_obj {
            if key == "asr" {
                let existing = root.get("asr").cloned().unwrap_or(Value::Null);
                root.insert(key.clone(), deep_merge_objects(&existing, value));
            } else {
                root.insert(key.clone(), value.clone());
            }
        }
    }
}

fn deep_merge_objects(existing: &Value, incoming: &Value) -> Value {
    match (existing, incoming) {
        (Value::Object(existing_map), Value::Object(incoming_map)) => {
            let mut out: Map<String, Value> = existing_map.clone();
            for (key, incoming_value) in incoming_map {
                let merged = match out.get(key) {
                    Some(existing_value) => deep_merge_objects(existing_value, incoming_value),
                    None => incoming_value.clone(),
                };
                out.insert(key.clone(), merged);
            }
            Value::Object(out)
        }
        (_, incoming_value) => incoming_value.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn merge_save_request_preserves_omitted_browser_worker_keys() {
        let mut doc = ConfigDocument::from_payload(
            json!({
                "asr": {
                    "mode": "browser_google",
                    "browser": {
                        "continuous_results": false,
                        "interim_results": true,
                        "recognition_language": "ru-RU",
                        "stuck_stopping_timeout_ms": 500
                    }
                },
                "ui": { "language": "ru" }
            }),
            "test",
        );

        doc.merge_save_request(&json!({
            "asr": {
                "mode": "browser_google",
                "browser": {
                    "stuck_stopping_timeout_ms": 2000
                }
            },
            "ui": { "language": "en" }
        }));

        let browser = doc.payload()["asr"]["browser"].as_object().unwrap();
        assert_eq!(browser["continuous_results"], json!(false));
        assert_eq!(browser["interim_results"], json!(true));
        assert_eq!(browser["recognition_language"], json!("ru-RU"));
        assert_eq!(browser["stuck_stopping_timeout_ms"], json!(2000));
        assert_eq!(doc.payload()["ui"]["language"], json!("en"));
    }

    #[test]
    fn merge_save_request_allows_worker_to_overwrite_continuous() {
        let mut doc = ConfigDocument::from_payload(
            json!({
                "asr": {
                    "browser": { "continuous_results": true }
                }
            }),
            "test",
        );
        doc.merge_save_request(&json!({
            "asr": {
                "browser": { "continuous_results": false }
            }
        }));
        assert_eq!(
            doc.payload()["asr"]["browser"]["continuous_results"],
            json!(false)
        );
    }
}
