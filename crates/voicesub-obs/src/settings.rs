use serde_json::Value;
use voicesub_config::{
    OBS_CC_DEFAULT_CLEAR_AFTER_MS, OBS_CC_DEFAULT_DEBUG_INPUT,
    OBS_CC_DEFAULT_FINAL_REPLACE_DELAY_MS, OBS_CC_DEFAULT_HOST,
    OBS_CC_DEFAULT_MAX_PARTIAL_CAPTION_CHARS, OBS_CC_DEFAULT_MIN_PARTIAL_DELTA_CHARS,
    OBS_CC_DEFAULT_PARTIAL_THROTTLE_MS, OBS_CC_DEFAULT_PORT,
    OBS_CC_DEFAULT_SEND_TRANSLATION_PARTIALS, OBS_CC_DEFAULT_USE_SSL, OBS_CC_OUTPUT_MODES,
};

pub const CONNECTABLE_OUTPUT_MODES: &[&str] = &[
    "source_live",
    "source_final_only",
    "translation_1",
    "translation_2",
    "translation_3",
    "translation_4",
    "first_visible_line",
];

pub const SOURCE_EVENT_OUTPUT_MODES: &[&str] = &["source_live", "source_final_only"];

#[derive(Debug, Clone)]
pub struct ObsCaptionSettings {
    pub enabled: bool,
    pub output_mode: String,
    pub host: String,
    pub port: u16,
    pub password: String,
    pub use_ssl: bool,
    pub debug_enabled: bool,
    pub debug_input_name: String,
    pub debug_send_partials: bool,
    pub send_partials: bool,
    pub send_translation_partials: bool,
    pub partial_throttle_ms: u64,
    pub min_partial_delta_chars: u64,
    /// Trailing char window for realtime partials only (`0` = unlimited). Finals are never clipped.
    pub max_partial_caption_chars: u64,
    pub final_replace_delay_ms: u64,
    pub clear_after_ms: u64,
    pub avoid_duplicate_text: bool,
}

impl ObsCaptionSettings {
    pub fn from_config(payload: &Value) -> Self {
        let obs = payload.get("obs_closed_captions");
        let enabled = obs
            .and_then(|value| value.get("enabled"))
            .and_then(|value| value.as_bool())
            .unwrap_or(false);
        let raw_mode = obs
            .and_then(|value| value.get("output_mode"))
            .and_then(|value| value.as_str())
            .unwrap_or("disabled")
            .trim()
            .to_ascii_lowercase();
        let output_mode = if OBS_CC_OUTPUT_MODES.contains(&raw_mode.as_str()) {
            raw_mode
        } else {
            "disabled".to_string()
        };
        let connection = obs.and_then(|value| value.get("connection"));
        let host = connection
            .and_then(|value| value.get("host"))
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(OBS_CC_DEFAULT_HOST)
            .to_string();
        let port = connection
            .and_then(|value| value.get("port"))
            .and_then(|value| value.as_u64())
            .unwrap_or(u64::from(OBS_CC_DEFAULT_PORT))
            .clamp(1, 65535) as u16;
        let password = connection
            .and_then(|value| value.get("password"))
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .to_string();
        let use_ssl = connection
            .and_then(|value| value.get("use_ssl"))
            .and_then(|value| value.as_bool())
            .unwrap_or(OBS_CC_DEFAULT_USE_SSL);
        let debug_mirror = obs.and_then(|value| value.get("debug_mirror"));
        let debug_enabled = debug_mirror
            .and_then(|value| value.get("enabled"))
            .and_then(|value| value.as_bool())
            .unwrap_or(false);
        let debug_input_name = debug_mirror
            .and_then(|value| value.get("input_name"))
            .and_then(|value| value.as_str())
            .map(str::trim)
            .unwrap_or(OBS_CC_DEFAULT_DEBUG_INPUT)
            .to_string();
        let debug_send_partials = debug_mirror
            .and_then(|value| value.get("send_partials"))
            .and_then(|value| value.as_bool())
            .unwrap_or(true);
        let timing = obs.and_then(|value| value.get("timing"));
        Self {
            enabled,
            output_mode,
            host,
            port,
            password,
            use_ssl,
            debug_enabled,
            debug_input_name,
            debug_send_partials,
            send_partials: timing
                .and_then(|value| value.get("send_partials"))
                .and_then(|value| value.as_bool())
                .unwrap_or(true),
            send_translation_partials: timing
                .and_then(|value| value.get("send_translation_partials"))
                .and_then(|value| value.as_bool())
                .unwrap_or(OBS_CC_DEFAULT_SEND_TRANSLATION_PARTIALS),
            partial_throttle_ms: timing
                .and_then(|value| value.get("partial_throttle_ms"))
                .and_then(|value| value.as_u64())
                .unwrap_or(OBS_CC_DEFAULT_PARTIAL_THROTTLE_MS),
            min_partial_delta_chars: timing
                .and_then(|value| value.get("min_partial_delta_chars"))
                .and_then(|value| value.as_u64())
                .unwrap_or(OBS_CC_DEFAULT_MIN_PARTIAL_DELTA_CHARS),
            max_partial_caption_chars: timing
                .and_then(|value| value.get("max_partial_caption_chars"))
                .and_then(|value| value.as_u64())
                .unwrap_or(OBS_CC_DEFAULT_MAX_PARTIAL_CAPTION_CHARS),
            final_replace_delay_ms: timing
                .and_then(|value| value.get("final_replace_delay_ms"))
                .and_then(|value| value.as_u64())
                .unwrap_or(OBS_CC_DEFAULT_FINAL_REPLACE_DELAY_MS),
            clear_after_ms: timing
                .and_then(|value| value.get("clear_after_ms"))
                .and_then(|value| value.as_u64())
                .unwrap_or(OBS_CC_DEFAULT_CLEAR_AFTER_MS),
            avoid_duplicate_text: timing
                .and_then(|value| value.get("avoid_duplicate_text"))
                .and_then(|value| value.as_bool())
                .unwrap_or(true),
        }
    }

    pub fn should_connect(&self) -> bool {
        self.native_enabled() || self.debug_text_input_enabled()
    }

    pub fn native_enabled(&self) -> bool {
        self.enabled && CONNECTABLE_OUTPUT_MODES.contains(&self.output_mode.as_str())
    }

    pub fn debug_text_input_enabled(&self) -> bool {
        // Master `enabled` gate: debug mirror must not open a WS session on its own.
        self.enabled && self.debug_enabled && !self.debug_input_name.trim().is_empty()
    }

    pub fn connection_key(&self) -> (String, u16, String, bool) {
        (
            self.host.clone(),
            self.port,
            self.password.clone(),
            self.use_ssl,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn default_timing_matches_canonical_constants() {
        let settings = ObsCaptionSettings::from_config(&json!({
            "obs_closed_captions": { "enabled": true, "output_mode": "source_live" }
        }));
        assert_eq!(
            settings.partial_throttle_ms,
            OBS_CC_DEFAULT_PARTIAL_THROTTLE_MS
        );
        assert_eq!(
            settings.min_partial_delta_chars,
            OBS_CC_DEFAULT_MIN_PARTIAL_DELTA_CHARS
        );
        assert_eq!(
            settings.max_partial_caption_chars,
            OBS_CC_DEFAULT_MAX_PARTIAL_CAPTION_CHARS
        );
        assert!(!settings.use_ssl);
        assert!(!settings.send_translation_partials);
    }

    #[test]
    fn parses_obs_settings_from_config() {
        let settings = ObsCaptionSettings::from_config(&json!({
            "obs_closed_captions": {
                "enabled": true,
                "output_mode": "translation_1",
                "connection": {
                    "host": "10.0.0.2",
                    "port": 4456,
                    "password": "secret",
                    "use_ssl": true
                }
            }
        }));
        assert!(settings.native_enabled());
        assert_eq!(settings.host, "10.0.0.2");
        assert_eq!(settings.port, 4456);
        assert!(settings.use_ssl);
        assert!(settings.should_connect());
    }

    #[test]
    fn debug_mirror_requires_enabled_flag() {
        let settings = ObsCaptionSettings::from_config(&json!({
            "obs_closed_captions": {
                "enabled": false,
                "output_mode": "disabled",
                "debug_mirror": { "enabled": true, "input_name": "CC_DEBUG" }
            }
        }));
        assert!(!settings.debug_text_input_enabled());
        assert!(!settings.should_connect());

        let enabled = ObsCaptionSettings::from_config(&json!({
            "obs_closed_captions": {
                "enabled": true,
                "output_mode": "disabled",
                "debug_mirror": { "enabled": true, "input_name": "CC_DEBUG" }
            }
        }));
        assert!(enabled.debug_text_input_enabled());
        assert!(enabled.should_connect());
    }
}
