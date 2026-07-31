//! SST `local_asr_vad_tuning.py` — apply resolved settings to WebRTC/Silero VAD engine.

use std::path::Path;

use tracing::warn;

use crate::config::{LocalAsrConfig, LocalAsrVadBackend, LocalAsrVadConfig};
use crate::realtime_settings::ResolvedRealtimeSettings;
use crate::silero_vad::SileroVadEngine;
use crate::vad_engine::{VadEngine, VadEngineConfig};

pub fn root_mean_square(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let sum: f32 = samples.iter().map(|s| s * s).sum();
    (sum / samples.len() as f32).sqrt()
}

pub fn vad_engine_config_from_settings(
    config: &LocalAsrConfig,
    settings: &ResolvedRealtimeSettings,
) -> VadEngineConfig {
    let vad_cfg = &config.vad;
    VadEngineConfig {
        sample_rate: config.microphone.sample_rate.max(8_000),
        frame_duration_ms: 30,
        mode: vad_cfg.vad_mode,
        silence_hold_ms: settings.silence_hold_ms,
        finalization_hold_ms: settings.finalization_hold_ms,
        speech_pad_ms: vad_cfg.speech_pad_ms,
        text_hold_enabled: vad_cfg.text_hold_enabled,
        text_hold_extra_ms: vad_cfg.text_hold_extra_ms,
        min_speech_ms: settings.min_speech_ms,
        partial_emit_interval_ms: vad_cfg
            .partial_emit_interval_ms
            .unwrap_or(settings.partial_emit_interval_ms),
        max_segment_ms: vad_cfg.max_segment_ms,
        energy_gate_enabled: vad_cfg.energy_gate_enabled,
        min_rms_for_recognition: effective_min_rms_for_recognition(vad_cfg),
        min_voiced_ratio: vad_cfg.min_voiced_ratio,
        first_partial_min_speech_ms: settings.first_partial_min_speech_ms,
        speech_attack_frames: vad_cfg.speech_attack_frames,
        speech_preroll_frames: vad_cfg.speech_preroll_frames,
    }
}

pub fn apply_vad_tuning_from_settings(
    vad: &mut VadEngine,
    config: &LocalAsrConfig,
    settings: &ResolvedRealtimeSettings,
) {
    vad.configure(vad_engine_config_from_settings(config, settings));
}

fn effective_min_rms_for_recognition(vad: &LocalAsrVadConfig) -> f32 {
    const DEFAULT_MIN_RMS: f32 = 0.0018;
    const DEFAULT_SPEECH_THRESHOLD: f32 = 0.015;
    if (vad.min_rms_for_recognition - DEFAULT_MIN_RMS).abs() > f32::EPSILON {
        return vad.min_rms_for_recognition;
    }
    if (vad.speech_threshold - DEFAULT_SPEECH_THRESHOLD).abs() > f32::EPSILON {
        return vad.speech_threshold;
    }
    vad.min_rms_for_recognition
}

pub fn vad_engine_from_config(
    config: &LocalAsrConfig,
    settings: &ResolvedRealtimeSettings,
) -> VadEngine {
    vad_engine_from_config_with_module_dir(config, settings, None)
}

pub fn vad_engine_from_config_with_module_dir(
    config: &LocalAsrConfig,
    settings: &ResolvedRealtimeSettings,
    module_dir: Option<&Path>,
) -> VadEngine {
    let engine_cfg = vad_engine_config_from_settings(config, settings);
    let silero = match (config.vad.backend, module_dir) {
        (LocalAsrVadBackend::Silero, Some(dir)) => match SileroVadEngine::try_open(dir, config.vad.silero_threshold)
        {
            Ok(engine) => Some(engine),
            Err(err) => {
                warn!(
                    target: "voicesub.asr_local.vad",
                    error = %err,
                    "Silero VAD unavailable — falling back to WebRTC"
                );
                None
            }
        },
        (LocalAsrVadBackend::Silero, None) => {
            warn!(
                target: "voicesub.asr_local.vad",
                "Silero VAD selected but module dir missing — falling back to WebRTC"
            );
            None
        }
        (LocalAsrVadBackend::Webrtc, _) => None,
    };
    VadEngine::new_with_classifier(engine_cfg, silero)
}

pub fn legacy_vad_defaults() -> LocalAsrVadConfig {
    LocalAsrVadConfig::default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::LocalAsrConfig;

    #[test]
    fn effective_min_rms_honors_legacy_speech_threshold() {
        let mut config = LocalAsrConfig::default();
        config.vad.speech_threshold = 0.025;
        let settings = ResolvedRealtimeSettings::from_config(&config);
        let mut vad = VadEngine::new(VadEngineConfig::default());
        apply_vad_tuning_from_settings(&mut vad, &config, &settings);
        assert_eq!(effective_min_rms_for_recognition(&config.vad), 0.025);
    }

    #[test]
    fn maps_speech_pad_and_text_hold() {
        let mut config = LocalAsrConfig::default();
        config.vad.speech_pad_ms = 200;
        config.vad.text_hold_enabled = true;
        config.vad.text_hold_extra_ms = 400;
        let settings = ResolvedRealtimeSettings::from_config(&config);
        let engine_cfg = vad_engine_config_from_settings(&config, &settings);
        assert_eq!(engine_cfg.speech_pad_ms, 200);
        assert!(engine_cfg.text_hold_enabled);
        assert_eq!(engine_cfg.text_hold_extra_ms, 400);
    }
}
