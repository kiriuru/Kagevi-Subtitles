use serde_json::{Map, Value, json};

pub const OBS_CC_OUTPUT_MODES: &[&str] = &[
    "disabled",
    "source_live",
    "source_final_only",
    "translation_1",
    "translation_2",
    "translation_3",
    "translation_4",
    "first_visible_line",
];

/// Canonical OBS Closed Captions defaults (keep schema / TS / voicesub-obs in sync via these).
pub const OBS_CC_DEFAULT_HOST: &str = "127.0.0.1";
pub const OBS_CC_DEFAULT_PORT: u16 = 4455;
pub const OBS_CC_DEFAULT_USE_SSL: bool = false;
pub const OBS_CC_DEFAULT_DEBUG_INPUT: &str = "CC_DEBUG";
pub const OBS_CC_DEFAULT_PARTIAL_THROTTLE_MS: u64 = 140;
pub const OBS_CC_DEFAULT_MIN_PARTIAL_DELTA_CHARS: u64 = 1;
pub const OBS_CC_DEFAULT_FINAL_REPLACE_DELAY_MS: u64 = 0;
pub const OBS_CC_DEFAULT_CLEAR_AFTER_MS: u64 = 2500;
pub const OBS_CC_DEFAULT_SEND_TRANSLATION_PARTIALS: bool = false;

fn obs_defaults() -> Value {
    json!({
        "enabled": false,
        "output_mode": "disabled",
        "connection": {
            "host": OBS_CC_DEFAULT_HOST,
            "port": OBS_CC_DEFAULT_PORT,
            "password": "",
            "use_ssl": OBS_CC_DEFAULT_USE_SSL
        },
        "debug_mirror": {
            "enabled": false,
            "input_name": OBS_CC_DEFAULT_DEBUG_INPUT,
            "send_partials": true
        },
        "timing": {
            "send_partials": true,
            "send_translation_partials": OBS_CC_DEFAULT_SEND_TRANSLATION_PARTIALS,
            "partial_throttle_ms": OBS_CC_DEFAULT_PARTIAL_THROTTLE_MS,
            "min_partial_delta_chars": OBS_CC_DEFAULT_MIN_PARTIAL_DELTA_CHARS,
            "final_replace_delay_ms": OBS_CC_DEFAULT_FINAL_REPLACE_DELAY_MS,
            "clear_after_ms": OBS_CC_DEFAULT_CLEAR_AFTER_MS,
            "avoid_duplicate_text": true
        }
    })
}

fn clamp_obs_int(section: &Map<String, Value>, key: &str, default: i64) -> i64 {
    let value = section
        .get(key)
        .and_then(|value| value.as_i64().or_else(|| value.as_u64().map(|n| n as i64)))
        .unwrap_or(default);
    value.max(0)
}

fn enabled_translation_slot_ids(root: &Map<String, Value>) -> Vec<String> {
    root.get("translation")
        .and_then(|value| value.get("lines"))
        .and_then(|value| value.as_array())
        .map(|lines| {
            lines
                .iter()
                .filter_map(|line| {
                    let obj = line.as_object()?;
                    if !obj.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true) {
                        return None;
                    }
                    let slot = obj.get("slot_id")?.as_str()?.trim().to_ascii_lowercase();
                    if OBS_CC_OUTPUT_MODES.contains(&slot.as_str())
                        && slot.starts_with("translation_")
                    {
                        Some(slot)
                    } else {
                        None
                    }
                })
                .collect()
        })
        .unwrap_or_default()
}

pub fn normalize_obs_closed_captions(root: &mut Map<String, Value>) {
    let defaults = obs_defaults();
    let default_connection = defaults["connection"]
        .as_object()
        .cloned()
        .unwrap_or_default();
    let default_debug = defaults["debug_mirror"]
        .as_object()
        .cloned()
        .unwrap_or_default();
    let enabled_translation_slots = enabled_translation_slot_ids(root);

    let section_value = root
        .entry("obs_closed_captions".to_string())
        .or_insert_with(|| json!({}));
    let section = section_value
        .as_object_mut()
        .expect("obs_closed_captions object");

    let raw_mode = section
        .get("output_mode")
        .and_then(|value| value.as_str())
        .unwrap_or("disabled")
        .trim()
        .to_ascii_lowercase();
    let raw_mode = if raw_mode == "translation_5" {
        "translation_4".to_string()
    } else {
        raw_mode
    };
    let mut output_mode = if OBS_CC_OUTPUT_MODES.contains(&raw_mode.as_str()) {
        raw_mode
    } else {
        "disabled".to_string()
    };
    if output_mode.starts_with("translation_")
        && !enabled_translation_slots
            .iter()
            .any(|slot| slot == &output_mode)
    {
        output_mode = "disabled".to_string();
    }

    let enabled = section
        .get("enabled")
        .and_then(|value| value.as_bool())
        .unwrap_or(false);

    let connection_host = section
        .get("connection")
        .and_then(|value| value.get("host"))
        .and_then(|value| value.as_str())
        .unwrap_or(
            default_connection["host"]
                .as_str()
                .unwrap_or(OBS_CC_DEFAULT_HOST),
        )
        .trim()
        .to_string();
    let connection_port = section
        .get("connection")
        .and_then(|value| value.get("port"))
        .and_then(|value| value.as_i64().or_else(|| value.as_u64().map(|n| n as i64)))
        .unwrap_or(i64::from(OBS_CC_DEFAULT_PORT))
        .clamp(1, 65535);
    let connection_password = section
        .get("connection")
        .and_then(|value| value.get("password"))
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .to_string();
    let connection_use_ssl = section
        .get("connection")
        .and_then(|value| value.get("use_ssl"))
        .and_then(|value| value.as_bool())
        .unwrap_or(OBS_CC_DEFAULT_USE_SSL);

    let debug_enabled = section
        .get("debug_mirror")
        .and_then(|value| value.get("enabled"))
        .and_then(|value| value.as_bool())
        .unwrap_or(false);
    let debug_input_name = section
        .get("debug_mirror")
        .and_then(|value| value.get("input_name"))
        .and_then(|value| value.as_str())
        .unwrap_or(
            default_debug["input_name"]
                .as_str()
                .unwrap_or(OBS_CC_DEFAULT_DEBUG_INPUT),
        )
        .trim()
        .to_string();
    let debug_send_partials = section
        .get("debug_mirror")
        .and_then(|value| value.get("send_partials"))
        .and_then(|value| value.as_bool())
        .unwrap_or(true);

    let timing_send_partials = section
        .get("timing")
        .and_then(|value| value.get("send_partials"))
        .and_then(|value| value.as_bool())
        .unwrap_or(true);
    let timing_send_translation_partials = section
        .get("timing")
        .and_then(|value| value.get("send_translation_partials"))
        .and_then(|value| value.as_bool())
        .unwrap_or(OBS_CC_DEFAULT_SEND_TRANSLATION_PARTIALS);
    let timing_map = section
        .get("timing")
        .and_then(|value| value.as_object())
        .cloned()
        .unwrap_or_default();
    let partial_throttle_ms = clamp_obs_int(
        &timing_map,
        "partial_throttle_ms",
        OBS_CC_DEFAULT_PARTIAL_THROTTLE_MS as i64,
    );
    let min_partial_delta_chars = clamp_obs_int(
        &timing_map,
        "min_partial_delta_chars",
        OBS_CC_DEFAULT_MIN_PARTIAL_DELTA_CHARS as i64,
    );
    let final_replace_delay_ms = clamp_obs_int(
        &timing_map,
        "final_replace_delay_ms",
        OBS_CC_DEFAULT_FINAL_REPLACE_DELAY_MS as i64,
    );
    let clear_after_ms = clamp_obs_int(
        &timing_map,
        "clear_after_ms",
        OBS_CC_DEFAULT_CLEAR_AFTER_MS as i64,
    );
    let avoid_duplicate_text = section
        .get("timing")
        .and_then(|value| value.get("avoid_duplicate_text"))
        .and_then(|value| value.as_bool())
        .unwrap_or(true);

    section.insert("enabled".into(), json!(enabled));
    section.insert("output_mode".into(), json!(output_mode));
    section.insert(
        "connection".into(),
        json!({
            "host": if connection_host.is_empty() { OBS_CC_DEFAULT_HOST } else { connection_host.as_str() },
            "port": connection_port,
            "password": connection_password,
            "use_ssl": connection_use_ssl,
        }),
    );
    section.insert(
        "debug_mirror".into(),
        json!({
            "enabled": debug_enabled,
            "input_name": debug_input_name,
            "send_partials": debug_send_partials,
        }),
    );
    section.insert(
        "timing".into(),
        json!({
            "send_partials": timing_send_partials,
            "send_translation_partials": timing_send_translation_partials,
            "partial_throttle_ms": partial_throttle_ms,
            "min_partial_delta_chars": min_partial_delta_chars,
            "final_replace_delay_ms": final_replace_delay_ms,
            "clear_after_ms": clear_after_ms,
            "avoid_duplicate_text": avoid_duplicate_text,
        }),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_invalid_output_mode_to_disabled() {
        let mut root = Map::new();
        root.insert(
            "obs_closed_captions".into(),
            json!({ "output_mode": "bogus", "timing": {} }),
        );
        normalize_obs_closed_captions(&mut root);
        assert_eq!(root["obs_closed_captions"]["output_mode"], "disabled");
        assert_eq!(
            root["obs_closed_captions"]["timing"]["partial_throttle_ms"],
            OBS_CC_DEFAULT_PARTIAL_THROTTLE_MS
        );
    }

    #[test]
    fn normalizes_use_ssl_default_false() {
        let mut root = Map::new();
        root.insert("obs_closed_captions".into(), json!({ "connection": {} }));
        normalize_obs_closed_captions(&mut root);
        assert_eq!(root["obs_closed_captions"]["connection"]["use_ssl"], false);
    }

    #[test]
    fn clamps_translation_output_mode_to_enabled_slots() {
        let mut root = Map::new();
        root.insert(
            "translation".into(),
            json!({
                "lines": [
                    { "slot_id": "translation_1", "enabled": true, "target_lang": "en" },
                    { "slot_id": "translation_2", "enabled": false, "target_lang": "ja" }
                ]
            }),
        );
        root.insert(
            "obs_closed_captions".into(),
            json!({ "output_mode": "translation_2" }),
        );
        normalize_obs_closed_captions(&mut root);
        assert_eq!(root["obs_closed_captions"]["output_mode"], "disabled");

        root.insert(
            "obs_closed_captions".into(),
            json!({ "output_mode": "translation_1" }),
        );
        normalize_obs_closed_captions(&mut root);
        assert_eq!(root["obs_closed_captions"]["output_mode"], "translation_1");
    }
}
