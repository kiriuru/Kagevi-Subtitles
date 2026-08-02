use std::sync::Arc;

use axum::Json;
use axum::extract::State;
use axum::response::{IntoResponse, Response};
use serde::Deserialize;
use serde_json::{Value, json};
use voicesub_asr_local::{CUDA_TOOLKIT_URL, DepDownloadKind, LocalAsrConfig, TransferProgress};

use super::state::HttpState;

/// Fan out `asr.local_module` changes to the main dashboard via `runtime_update`.
///
/// Coalescing (force=false) suppresses duplicates; readiness / phase flips still publish
/// immediately because they are part of the runtime material signature.
async fn publish_local_module_runtime(state: &HttpState) {
    state.orchestrator.publish_status(state, false).await;
}

pub async fn local_asr_status(State(state): State<Arc<HttpState>>) -> Json<Value> {
    // Use cached snapshot when warm; cold path still scans deps once via refresh_status.
    let status = state.local_asr.status();
    let diagnostics = state.local_asr.diagnostics();
    Json(json!({ "ok": true, "status": status, "diagnostics": diagnostics }))
}

pub async fn local_asr_config_get(State(state): State<Arc<HttpState>>) -> Response {
    match state.local_asr.load_config() {
        Ok(config) => Json(json!({ "ok": true, "config": config })).into_response(),
        Err(err) => Json(json!({ "ok": false, "message": err.to_string() })).into_response(),
    }
}

#[derive(Debug, Deserialize)]
pub struct LocalAsrConfigSaveBody {
    pub config: LocalAsrConfig,
}

pub async fn local_asr_config_save(
    State(state): State<Arc<HttpState>>,
    Json(body): Json<LocalAsrConfigSaveBody>,
) -> Response {
    match state.local_asr.save_config(&body.config) {
        Ok(()) => {
            let _ = state.local_asr.refresh_status();
            publish_local_module_runtime(&state).await;
            match state.local_asr.load_config() {
                Ok(config) => Json(json!({ "ok": true, "config": config })).into_response(),
                Err(err) => {
                    Json(json!({ "ok": false, "message": err.to_string() })).into_response()
                }
            }
        }
        Err(err) => Json(json!({ "ok": false, "message": err.to_string() })).into_response(),
    }
}

pub async fn local_asr_deps_check(State(state): State<Arc<HttpState>>) -> Json<Value> {
    let status = state.local_asr.refresh_status();
    publish_local_module_runtime(&state).await;
    Json(json!({ "ok": true, "status": status }))
}

#[derive(Debug, Deserialize)]
pub struct LocalAsrDepsDownloadBody {
    pub kind: String,
}

pub async fn local_asr_deps_download(
    State(state): State<Arc<HttpState>>,
    Json(body): Json<LocalAsrDepsDownloadBody>,
) -> Response {
    let Some(kind) = DepDownloadKind::parse(&body.kind) else {
        return Json(json!({
            "ok": false,
            "message": format!("unknown dependency kind: {}", body.kind),
        }))
        .into_response();
    };
    match state.local_asr.download_deps(kind).await {
        Ok(status) => {
            publish_local_module_runtime(&state).await;
            Json(json!({ "ok": true, "status": status })).into_response()
        }
        Err(err) => Json(json!({ "ok": false, "message": err.to_string() })).into_response(),
    }
}

#[derive(Debug, Deserialize)]
pub struct LocalAsrModelDownloadBody {
    pub variant: String,
    #[serde(default)]
    pub family: Option<String>,
}

pub async fn local_asr_model_download(
    State(state): State<Arc<HttpState>>,
    Json(body): Json<LocalAsrModelDownloadBody>,
) -> Response {
    let family = body.family.clone().unwrap_or_else(|| {
        state
            .local_asr
            .load_config()
            .map(|config| config.model.family)
            .unwrap_or_else(|_| "parakeet_tdt".into())
    });
    match state.local_asr.download_model(&family, &body.variant).await {
        Ok(status) => {
            publish_local_module_runtime(&state).await;
            Json(json!({ "ok": true, "status": status })).into_response()
        }
        Err(err) => Json(json!({ "ok": false, "message": err.to_string() })).into_response(),
    }
}

pub async fn local_asr_model_select(
    State(state): State<Arc<HttpState>>,
    Json(body): Json<LocalAsrModelDownloadBody>,
) -> Response {
    let family = body.family.clone().unwrap_or_else(|| {
        state
            .local_asr
            .load_config()
            .map(|config| config.model.family)
            .unwrap_or_else(|_| "parakeet_tdt".into())
    });
    match state.local_asr.select_model(&family, &body.variant) {
        Ok(status) => {
            publish_local_module_runtime(&state).await;
            Json(json!({ "ok": true, "status": status })).into_response()
        }
        Err(err) => Json(json!({ "ok": false, "message": err.to_string() })).into_response(),
    }
}

pub async fn local_asr_driver_url() -> Json<Value> {
    Json(json!({ "ok": true, "url": CUDA_TOOLKIT_URL }))
}

pub async fn local_asr_transfer(State(state): State<Arc<HttpState>>) -> Json<Value> {
    let transfer: TransferProgress = state.local_asr.transfer_snapshot();
    Json(json!({ "ok": true, "transfer": transfer }))
}

pub async fn local_asr_transfer_cancel(State(state): State<Arc<HttpState>>) -> Json<Value> {
    let transfer = state.local_asr.cancel_transfer();
    Json(json!({ "ok": true, "transfer": transfer }))
}

#[derive(Debug, Deserialize)]
pub struct LocalAsrDepsDeleteBody {
    pub kind: String,
}

pub async fn local_asr_deps_delete(
    State(state): State<Arc<HttpState>>,
    Json(body): Json<LocalAsrDepsDeleteBody>,
) -> Response {
    let Some(kind) = DepDownloadKind::parse(&body.kind) else {
        return Json(json!({
            "ok": false,
            "message": format!("unknown dependency kind: {}", body.kind),
        }))
        .into_response();
    };
    match state.local_asr.delete_deps(kind) {
        Ok(status) => {
            publish_local_module_runtime(&state).await;
            Json(json!({ "ok": true, "status": status })).into_response()
        }
        Err(err) => Json(json!({ "ok": false, "message": err.to_string() })).into_response(),
    }
}

#[derive(Debug, Deserialize)]
pub struct LocalAsrModelDeleteBody {
    pub variant: String,
    #[serde(default)]
    pub family: Option<String>,
}

pub async fn local_asr_model_delete(
    State(state): State<Arc<HttpState>>,
    Json(body): Json<LocalAsrModelDeleteBody>,
) -> Response {
    let family = body.family.clone().unwrap_or_else(|| {
        state
            .local_asr
            .load_config()
            .map(|config| config.model.family)
            .unwrap_or_else(|_| "parakeet_tdt".into())
    });
    match state.local_asr.delete_model(&family, &body.variant) {
        Ok(status) => {
            publish_local_module_runtime(&state).await;
            Json(json!({ "ok": true, "status": status })).into_response()
        }
        Err(err) => Json(json!({ "ok": false, "message": err.to_string() })).into_response(),
    }
}

#[derive(Debug, Deserialize)]
pub struct LocalAsrDepsProbeBody {
    pub provider: String,
}

pub async fn local_asr_deps_probe(
    State(state): State<Arc<HttpState>>,
    Json(body): Json<LocalAsrDepsProbeBody>,
) -> Response {
    let service = Arc::clone(&state.local_asr);
    let refresh = Arc::clone(&service);
    let provider = body.provider.clone();
    match tokio::task::spawn_blocking(move || service.probe_provider(&provider)).await {
        Ok(Ok(probe)) => {
            let status = refresh.refresh_status();
            publish_local_module_runtime(&state).await;
            Json(json!({ "ok": true, "probe": probe, "status": status })).into_response()
        }
        Ok(Err(err)) => Json(json!({ "ok": false, "message": err.to_string() })).into_response(),
        Err(err) => Json(json!({ "ok": false, "message": err.to_string() })).into_response(),
    }
}

pub async fn local_asr_model_load(State(state): State<Arc<HttpState>>) -> Response {
    let service = Arc::clone(&state.local_asr);
    let refresh = Arc::clone(&service);
    match tokio::task::spawn_blocking(move || {
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| service.load_model()))
    })
    .await
    {
        Ok(Ok(Ok(load))) => {
            let status = refresh.refresh_status();
            publish_local_module_runtime(&state).await;
            Json(json!({ "ok": true, "load": load, "status": status })).into_response()
        }
        Ok(Ok(Err(err))) => Json(json!({ "ok": false, "message": err.to_string() })).into_response(),
        Ok(Err(_panic)) => Json(json!({
            "ok": false,
            "message": "Model warm load panicked — check logs/core.log and ONNX Runtime dependencies.",
        }))
        .into_response(),
        Err(err) => Json(json!({ "ok": false, "message": err.to_string() })).into_response(),
    }
}

pub async fn local_asr_model_unload(State(state): State<Arc<HttpState>>) -> Response {
    let status = state.local_asr.unload_model();
    publish_local_module_runtime(&state).await;
    Json(json!({ "ok": true, "status": status })).into_response()
}

#[derive(Debug, Deserialize)]
pub struct LocalAsrTestStartBody {
    #[serde(default = "default_test_duration_ms")]
    pub duration_ms: u64,
    #[serde(default, alias = "deviceId")]
    pub device_id: Option<String>,
}

fn default_test_duration_ms() -> u64 {
    0
}

pub async fn local_asr_mics_list(State(state): State<Arc<HttpState>>) -> Response {
    let service = Arc::clone(&state.local_asr);
    match tokio::task::spawn_blocking(move || service.list_microphones()).await {
        Ok(Ok(devices)) => Json(json!({ "ok": true, "devices": devices })).into_response(),
        Ok(Err(err)) => Json(json!({ "ok": false, "message": err.to_string() })).into_response(),
        Err(err) => Json(json!({ "ok": false, "message": err.to_string() })).into_response(),
    }
}

pub async fn local_asr_test_start(
    State(state): State<Arc<HttpState>>,
    Json(body): Json<LocalAsrTestStartBody>,
) -> Response {
    let service = Arc::clone(&state.local_asr);
    let duration_ms = body.duration_ms;
    let device_id = body.device_id.clone();
    match tokio::task::spawn_blocking(move || service.start_test(duration_ms, device_id.as_deref()))
        .await
    {
        Ok(Ok(test)) => {
            publish_local_module_runtime(&state).await;
            Json(json!({ "ok": true, "test": test })).into_response()
        }
        Ok(Err(err)) => Json(json!({ "ok": false, "message": err.to_string() })).into_response(),
        Err(err) => Json(json!({ "ok": false, "message": err.to_string() })).into_response(),
    }
}

pub async fn local_asr_test_stop(State(state): State<Arc<HttpState>>) -> Response {
    let service = Arc::clone(&state.local_asr);
    match tokio::task::spawn_blocking(move || service.stop_test()).await {
        Ok(Ok(test)) => {
            // stop_test may finalize the one-time setup checklist → ready flips.
            let _ = state.local_asr.refresh_status();
            publish_local_module_runtime(&state).await;
            Json(json!({ "ok": true, "test": test })).into_response()
        }
        Ok(Err(err)) => Json(json!({ "ok": false, "message": err.to_string() })).into_response(),
        Err(err) => Json(json!({ "ok": false, "message": err.to_string() })).into_response(),
    }
}

pub async fn local_asr_test_status(State(state): State<Arc<HttpState>>) -> Json<Value> {
    // May commit setup checklist when the bench reaches Done (side effect → cache invalidate).
    let before = state.local_asr.status();
    let test = state.local_asr.test_bench_snapshot();
    let after = state.local_asr.status();
    if before.ready != after.ready || before.phase != after.phase {
        publish_local_module_runtime(&state).await;
    }
    Json(json!({ "ok": true, "test": test }))
}

pub fn local_asr_module_json(status: &voicesub_asr_local::LocalAsrModuleStatus) -> Value {
    serde_json::to_value(status).unwrap_or(Value::Null)
}
