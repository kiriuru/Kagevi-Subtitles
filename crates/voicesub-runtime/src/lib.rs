//! Runtime orchestration — wires HTTP, WS, browser worker, subtitle and translation pipeline.

pub mod http;

mod browser_event_builder;
mod browser_speech_source;
mod local_asr_speech_source;
mod segment_state;
mod service;
mod trace;
mod transcript_controller;

pub use http::{
    BackgroundTaskRegistry, HttpState, LOOPBACK_BOOTSTRAP_QUERY, LOOPBACK_COOKIE_NAME,
    LOOPBACK_TOKEN_HEADER, LOOPBACK_WS_TOKEN_QUERY, LoopbackAuth, PartialEmitCoordinator,
    RuntimeMetricsCollector, StylePresetsFn, append_bootstrap_query, build_router,
    partial_emit_settings_from_config,
};
pub use service::{RuntimeError, RuntimeHandle, RuntimeService, SubtitlePayloadListener};
pub use voicesub_ws::RuntimeStateSnapshot;
