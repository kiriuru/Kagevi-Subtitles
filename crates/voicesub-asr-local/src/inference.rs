use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use parakeet_rs::{ExecutionConfig, ExecutionProvider, ParakeetTDT};
use parking_lot::Mutex;
use thiserror::Error;
use tracing::{info, warn};

use crate::config::{
    EXECUTION_PROVIDER_CPU, EXECUTION_PROVIDER_CUDA, LocalAsrConfig, LocalAsrInferenceConfig,
    normalize_inference_session_options,
};
use crate::deps::{
    DepError, env_check, ort_dll_path_for_provider, preferred_ort_dll, prepare_ort_runtime,
    validate_deps_for_provider,
};
use crate::model_family::ModelFamily;
use crate::model_manager::{
    is_model_installed_for, resolve_model_dir, variant_cpu_bound_under_cuda,
};

#[derive(Debug, Error)]
pub enum InferenceError {
    #[error("dependency error: {0}")]
    Deps(#[from] DepError),
    #[error("inference error: {0}")]
    Runtime(String),
    #[error("model not installed")]
    ModelMissing,
    #[error(
        "ORT profiling decode budget reached — Chrome Trace JSON flushed under logs/ort-profile*.json"
    )]
    ProfilingBudgetReached,
}

#[derive(Debug, Clone, serde::Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProbeResult {
    pub provider: String,
    pub ok: bool,
    pub load_ms: u64,
    pub message: String,
    pub fallback_provider: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LoadResult {
    pub loaded: bool,
    pub load_ms: u64,
    pub active_execution_provider: String,
    pub message: String,
}

#[derive(Debug, Clone, Default, serde::Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InferenceSnapshot {
    pub model_loaded: bool,
    pub model_load_ms: Option<u64>,
    pub active_execution_provider: String,
    pub last_error: Option<String>,
    pub probe_cpu_ok: Option<bool>,
    pub probe_cuda_ok: Option<bool>,
    /// True while a warm session was created with ORT profiling enabled.
    pub ort_profiling_active: bool,
    /// Successful ONNX decodes recorded while the current profiled session is warm.
    pub ort_profiling_decode_count: u32,
    /// Decode budget for the active profiled session (`ort_profiling_max_decodes`).
    pub ort_profiling_max_decodes: u32,
    /// Set when the engine auto-unloaded after hitting the profiling decode budget.
    pub ort_profiling_stopped_budget: bool,
    /// Newest Chrome-trace JSON written under `logs/` (set after unload).
    pub last_ort_profile_path: Option<String>,
    /// Last instrumented decode timing (P0 outside-vs-parakeet breakdown).
    pub last_decode_timing: Option<crate::decode_timing::DecodeTimingBreakdown>,
}

struct ActiveSessionMeta {
    profiling_prefix: Option<PathBuf>,
    profiling_max_decodes: u32,
    profiled_decodes: u32,
}

pub struct InferenceEngine {
    inner: Mutex<Option<ParakeetTDT>>,
    snapshot: Mutex<InferenceSnapshot>,
    session_meta: Mutex<Option<ActiveSessionMeta>>,
}

impl Default for InferenceEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl InferenceEngine {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
            snapshot: Mutex::new(InferenceSnapshot::default()),
            session_meta: Mutex::new(None),
        }
    }

    /// Load ONNX Runtime from the preferred module DLL. Failures are not sticky: a later
    /// warm-load can retry after CUDA redist / GPU ORT lands on disk.
    ///
    /// Switching the *execution provider* (`cpu` ↔ `cuda`) does not need a restart — the GPU
    /// ORT package exposes both EPs. A restart is only required if this process already mapped
    /// `runtime/cpu/onnxruntime.dll` and a later download prefers `runtime/gpu/onnxruntime.dll`
    /// (Windows cannot replace a loaded ORT DLL).
    pub fn ensure_ort_initialized(module_dir: &Path) -> Result<(), InferenceError> {
        static ORT_LOADED_DLL: Mutex<Option<PathBuf>> = Mutex::new(None);
        let preferred = preferred_ort_dll(module_dir).ok_or_else(|| {
            InferenceError::Deps(DepError::Check(
                "ONNX Runtime DLL missing (download CPU or GPU package)".into(),
            ))
        })?;
        let mut loaded = ORT_LOADED_DLL.lock();
        match decide_ort_init(loaded.as_deref(), &preferred) {
            OrtInitDecision::AlreadyReady => Ok(()),
            OrtInitDecision::RestartRequired {
                loaded: current,
                preferred: next,
            } => Err(InferenceError::Runtime(format!(
                "ONNX Runtime DLL is already mapped from {}. The GPU package at {} cannot replace it until Kagevi Subtitles is restarted (then cpu/cuda EP switching works as usual).",
                current.display(),
                next.display()
            ))),
            OrtInitDecision::Init => {
                init_ort_environment(module_dir)?;
                *loaded = Some(preferred);
                Ok(())
            }
        }
    }

    pub fn snapshot(&self) -> InferenceSnapshot {
        self.snapshot.lock().clone()
    }

    /// Record P0 decode phase timings (prepare / preprocess / parakeet black-box).
    pub fn record_decode_timing(&self, timing: crate::decode_timing::DecodeTimingBreakdown) {
        info!(
            target: "voicesub.asr_local.decode_timing",
            audio_ms = timing.audio_ms,
            prepare_us = timing.prepare_us,
            preprocess_us = timing.preprocess_us,
            parakeet_us = timing.parakeet_transcribe_us,
            outside_us = timing.outside_us,
            total_us = timing.total_us,
            outside_pct = timing.outside_pct,
            parakeet_pct = timing.parakeet_pct,
            "decode phase timing"
        );
        self.snapshot.lock().last_decode_timing = Some(timing);
    }

    pub fn unload(&self) {
        self.unload_inner(false);
    }

    fn unload_inner(&self, stopped_for_budget: bool) {
        let meta = self.session_meta.lock().take();
        let mut guard = self.inner.lock();
        if guard.take().is_some() {
            info!(target: "voicesub.asr_local.inference", "unloaded ASR model session");
        }
        // ORT flushes profiling JSON in session destructor when EnableProfiling was set.
        let profile_path = meta
            .as_ref()
            .and_then(|m| m.profiling_prefix.as_ref())
            .and_then(|prefix| find_newest_ort_profile(prefix));
        let decode_count = meta.as_ref().map(|m| m.profiled_decodes).unwrap_or(0);
        let max_decodes = meta.as_ref().map(|m| m.profiling_max_decodes).unwrap_or(0);

        let mut snap = self.snapshot.lock();
        snap.model_loaded = false;
        snap.model_load_ms = None;
        snap.last_error = None;
        snap.ort_profiling_active = false;
        snap.ort_profiling_decode_count = decode_count;
        snap.ort_profiling_max_decodes = max_decodes;
        snap.ort_profiling_stopped_budget = stopped_for_budget;
        if let Some(path) = profile_path {
            info!(
                target: "voicesub.asr_local.inference",
                path = %path.display(),
                decode_count,
                max_decodes,
                stopped_for_budget,
                "ORT profiling JSON ready (open in chrome://tracing)"
            );
            snap.last_ort_profile_path = Some(path.display().to_string());
        }
    }

    pub fn probe(
        module_dir: &Path,
        config: &LocalAsrConfig,
        provider: &str,
    ) -> Result<ProbeResult, InferenceError> {
        let provider = normalize_probe_provider(provider);
        let env = env_check(module_dir);
        validate_deps_for_provider(&env, &provider)?;
        let family = model_family(config);
        let model_dir = resolve_model_dir(
            &config.model.path,
            &config.model.family,
            &config.model.variant,
            module_dir,
        );
        if !is_model_installed_for(&model_dir, family, &config.model.variant) {
            return Err(InferenceError::ModelMissing);
        }

        let mut config = config.clone();
        // Probe must not enable ORT profiling (avoids empty JSON noise on session create/drop).
        config.inference.ort_profiling = false;
        let started = Instant::now();
        match try_load_session(module_dir, &config, family, &model_dir, &provider) {
            Ok(active_provider) => {
                let load_ms = started.elapsed().as_millis() as u64;
                Ok(ProbeResult {
                    provider: provider.clone(),
                    ok: true,
                    load_ms,
                    message: format!("Session created with {active_provider} EP"),
                    fallback_provider: if active_provider == provider {
                        None
                    } else {
                        Some(active_provider)
                    },
                })
            }
            Err(err) => Ok(ProbeResult {
                provider,
                ok: false,
                load_ms: started.elapsed().as_millis() as u64,
                message: err.to_string(),
                fallback_provider: None,
            }),
        }
    }

    pub fn load(
        &self,
        module_dir: &Path,
        logs_dir: &Path,
        config: &LocalAsrConfig,
    ) -> Result<LoadResult, InferenceError> {
        let requested = config.inference.execution_provider.clone();
        let env = env_check(module_dir);
        validate_deps_for_provider(&env, &requested)?;
        let family = model_family(config);
        let model_dir = resolve_model_dir(
            &config.model.path,
            &config.model.family,
            &config.model.variant,
            module_dir,
        );
        if !is_model_installed_for(&model_dir, family, &config.model.variant) {
            return Err(InferenceError::ModelMissing);
        }

        self.unload();

        let started = Instant::now();
        let (model, active_provider) =
            match try_load_tdt(module_dir, logs_dir, config, family, &model_dir, &requested) {
                Ok(model) => (model, requested.clone()),
                Err(err)
                    if requested == EXECUTION_PROVIDER_CUDA
                        && config.inference.cuda_fallback_to_cpu =>
                {
                    warn!(
                        target: "voicesub.asr_local.inference",
                        error = %err,
                        "CUDA warm load failed — retrying CPU EP"
                    );
                    let model = try_load_tdt(
                        module_dir,
                        logs_dir,
                        config,
                        family,
                        &model_dir,
                        EXECUTION_PROVIDER_CPU,
                    )?;
                    (model, EXECUTION_PROVIDER_CPU.into())
                }
                Err(err) => {
                    let mut snap = self.snapshot.lock();
                    snap.model_loaded = false;
                    snap.last_error = Some(err.to_string());
                    snap.ort_profiling_active = false;
                    return Err(err);
                }
            };
        let load_ms = started.elapsed().as_millis() as u64;
        let profiling_prefix = if config.inference.ort_profiling {
            Some(ort_profile_prefix(logs_dir))
        } else {
            None
        };
        let profiling_max_decodes = config.inference.ort_profiling_max_decodes.max(1);
        {
            let mut guard = self.inner.lock();
            *guard = Some(model);
        }
        {
            *self.session_meta.lock() = Some(ActiveSessionMeta {
                profiling_prefix: profiling_prefix.clone(),
                profiling_max_decodes,
                profiled_decodes: 0,
            });
        }
        {
            let mut snap = self.snapshot.lock();
            snap.model_loaded = true;
            snap.model_load_ms = Some(load_ms);
            snap.active_execution_provider = active_provider.clone();
            snap.last_error = None;
            snap.ort_profiling_active = profiling_prefix.is_some();
            snap.ort_profiling_decode_count = 0;
            snap.ort_profiling_max_decodes = if profiling_prefix.is_some() {
                profiling_max_decodes
            } else {
                0
            };
            snap.ort_profiling_stopped_budget = false;
            if active_provider == EXECUTION_PROVIDER_CPU {
                snap.probe_cpu_ok = Some(true);
            } else {
                snap.probe_cuda_ok = Some(true);
            }
        }

        let cuda_quant_cpu_bound = active_provider == EXECUTION_PROVIDER_CUDA
            && variant_cpu_bound_under_cuda(&config.model.variant);
        if cuda_quant_cpu_bound {
            warn!(
                target: "voicesub.asr_local.inference",
                variant = %config.model.variant,
                "CUDA EP registered, but quantized Parakeet ops (MatMulInteger/ConvInteger/DynamicQuantizeLinear) have no CUDA kernels — decode stays on CPU. Use fp16 or fp32 for GPU acceleration."
            );
        }

        info!(
            target: "voicesub.asr_local.inference",
            path = %model_dir.display(),
            family = family.as_str(),
            variant = %config.model.variant,
            provider = %active_provider,
            load_ms,
            cuda_quant_cpu_bound,
            intra_op = config.inference.intra_op_threads,
            inter_op = config.inference.inter_op_threads,
            graph_opt = config.inference.graph_optimization_level,
            parallel = config.inference.parallel_execution,
            mem_pattern = config.inference.enable_memory_pattern,
            ort_profiling = config.inference.ort_profiling,
            ort_profiling_max_decodes = profiling_max_decodes,
            "ASR warm load complete"
        );

        let message = if active_provider != requested {
            format!(
                "Loaded with {active_provider} EP (requested {requested}; CUDA fallback applied)"
            )
        } else if cuda_quant_cpu_bound {
            format!(
                "Model loaded with CUDA EP — {} keeps most decode on CPU (no CUDA kernels for integer-quant ops). Switch to fp16 or fp32 for GPU.",
                config.model.variant
            )
        } else if config.inference.ort_profiling {
            format!(
                "Model loaded with {active_provider} EP (ORT profiling on — auto-unload after {profiling_max_decodes} decode(s))"
            )
        } else {
            format!("Model loaded with {active_provider} EP")
        };

        Ok(LoadResult {
            loaded: true,
            load_ms,
            active_execution_provider: active_provider,
            message,
        })
    }

    pub fn with_tdt_model<T>(
        &self,
        f: impl FnOnce(&mut ParakeetTDT) -> Result<T, InferenceError>,
    ) -> Result<T, InferenceError> {
        if self.snapshot.lock().ort_profiling_stopped_budget {
            return Err(InferenceError::ProfilingBudgetReached);
        }
        let result = {
            let mut guard = self.inner.lock();
            if let Some(model) = guard.as_mut() {
                f(model)
            } else {
                if self.snapshot.lock().ort_profiling_stopped_budget {
                    return Err(InferenceError::ProfilingBudgetReached);
                }
                Err(InferenceError::Runtime("model is not loaded".into()))
            }
        };
        if result.is_ok() {
            self.note_profiled_decode();
        }
        result
    }

    /// Count a successful ONNX decode; auto-unload when the profiling budget is reached.
    fn note_profiled_decode(&self) {
        let should_stop = {
            let mut meta = self.session_meta.lock();
            let Some(meta) = meta.as_mut() else {
                return;
            };
            if meta.profiling_prefix.is_none() {
                return;
            }
            meta.profiled_decodes = meta.profiled_decodes.saturating_add(1);
            let count = meta.profiled_decodes;
            let max = meta.profiling_max_decodes.max(1);
            {
                let mut snap = self.snapshot.lock();
                snap.ort_profiling_decode_count = count;
                snap.ort_profiling_max_decodes = max;
            }
            count >= max
        };
        if should_stop {
            warn!(
                target: "voicesub.asr_local.inference",
                "ORT profiling decode budget reached — unloading to flush Chrome Trace JSON"
            );
            self.unload_inner(true);
        }
    }

    pub fn record_probe(&self, result: &ProbeResult) {
        let mut snap = self.snapshot.lock();
        if result.provider == EXECUTION_PROVIDER_CUDA {
            snap.probe_cuda_ok = Some(result.ok);
        } else {
            snap.probe_cpu_ok = Some(result.ok);
        }
        if !result.ok {
            snap.last_error = Some(result.message.clone());
        }
    }
}

fn model_family(config: &LocalAsrConfig) -> ModelFamily {
    ModelFamily::parse(&config.model.family).unwrap_or(ModelFamily::ParakeetTdt)
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum OrtInitDecision {
    Init,
    AlreadyReady,
    RestartRequired { loaded: PathBuf, preferred: PathBuf },
}

fn decide_ort_init(loaded: Option<&Path>, preferred: &Path) -> OrtInitDecision {
    match loaded {
        None => OrtInitDecision::Init,
        Some(path) if dll_paths_match(path, preferred) => OrtInitDecision::AlreadyReady,
        Some(path) => OrtInitDecision::RestartRequired {
            loaded: path.to_path_buf(),
            preferred: preferred.to_path_buf(),
        },
    }
}

fn dll_paths_match(left: &Path, right: &Path) -> bool {
    if left == right {
        return true;
    }
    #[cfg(windows)]
    {
        left.to_string_lossy()
            .eq_ignore_ascii_case(&right.to_string_lossy())
    }
    #[cfg(not(windows))]
    {
        false
    }
}

fn init_ort_environment(module_dir: &Path) -> Result<(), InferenceError> {
    match init_ort_environment_once(module_dir) {
        Ok(()) => Ok(()),
        Err(first) => {
            warn!(
                target: "voicesub.asr_local.inference",
                error = %first,
                "ORT init failed — retrying once after DLL search path refresh"
            );
            std::thread::sleep(Duration::from_millis(250));
            init_ort_environment_once(module_dir)
        }
    }
}

fn init_ort_environment_once(module_dir: &Path) -> Result<(), InferenceError> {
    let env = env_check(module_dir);
    let provider = if env.ort_gpu.ok {
        EXECUTION_PROVIDER_CUDA
    } else {
        EXECUTION_PROVIDER_CPU
    };
    prepare_ort_runtime(module_dir, provider)?;
    let dll = ort_dll_path_for_provider(module_dir, provider);
    if !dll.is_file() {
        return Err(InferenceError::Deps(DepError::Check(format!(
            "ONNX Runtime DLL missing at {}",
            dll.display()
        ))));
    }
    info!(
        target: "voicesub.asr_local.inference",
        dll = %dll.display(),
        provider,
        "initializing ONNX Runtime from module DLL"
    );
    ort::init_from(&dll)
        .map_err(|err| InferenceError::Runtime(err.to_string()))?
        .commit();
    Ok(())
}

fn normalize_probe_provider(provider: &str) -> String {
    match provider.trim().to_ascii_lowercase().as_str() {
        EXECUTION_PROVIDER_CUDA => EXECUTION_PROVIDER_CUDA.into(),
        _ => EXECUTION_PROVIDER_CPU.into(),
    }
}

fn try_load_session(
    module_dir: &Path,
    config: &LocalAsrConfig,
    family: ModelFamily,
    model_dir: &Path,
    provider: &str,
) -> Result<String, InferenceError> {
    // Probe / session check: no profiling artifacts.
    let logs_dir = module_dir; // unused when ort_profiling is false
    let _model = try_load_tdt(module_dir, logs_dir, config, family, model_dir, provider)?;
    Ok(provider.to_string())
}

fn try_load_tdt(
    module_dir: &Path,
    logs_dir: &Path,
    config: &LocalAsrConfig,
    family: ModelFamily,
    model_dir: &Path,
    provider: &str,
) -> Result<ParakeetTDT, InferenceError> {
    InferenceEngine::ensure_ort_initialized(module_dir)?;
    prepare_ort_runtime(module_dir, provider)?;
    if provider == EXECUTION_PROVIDER_CUDA {
        verify_cuda_session(model_dir, config, family, &config.model.variant)?;
    }
    let exec = execution_config(logs_dir, &config.inference, provider);
    ParakeetTDT::from_pretrained(model_dir, Some(exec)).map_err(map_parakeet_err)
}

fn encoder_probe_path(
    model_dir: &Path,
    family: ModelFamily,
    variant: &str,
) -> Result<PathBuf, InferenceError> {
    let encoder_name = family
        .parse_variant(variant)
        .and_then(|spec| {
            spec.required_files
                .iter()
                .find(|name| name.contains("encoder") && !name.ends_with(".data"))
                .copied()
        })
        .unwrap_or("encoder-model.int8.onnx");
    Ok(model_dir.join(encoder_name))
}

pub fn ort_profile_prefix(logs_dir: &Path) -> PathBuf {
    logs_dir.join("ort-profile")
}

fn ensure_logs_dir(logs_dir: &Path) -> Result<(), InferenceError> {
    fs::create_dir_all(logs_dir).map_err(|err| {
        InferenceError::Runtime(format!(
            "failed to create logs dir {}: {err}",
            logs_dir.display()
        ))
    })?;
    Ok(())
}

fn find_newest_ort_profile(prefix: &Path) -> Option<PathBuf> {
    let parent = prefix.parent()?;
    let stem = prefix.file_name()?.to_string_lossy();
    let mut best: Option<(std::time::SystemTime, PathBuf)> = None;
    let entries = fs::read_dir(parent).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = path.file_name()?.to_string_lossy();
        if !name.starts_with(stem.as_ref()) || !name.ends_with(".json") {
            continue;
        }
        let modified = entry.metadata().ok()?.modified().ok()?;
        match &best {
            Some((prev, _)) if *prev >= modified => {}
            _ => best = Some((modified, path)),
        }
    }
    best.map(|(_, path)| path)
}

fn graph_optimization_level(level: u8) -> ort::session::builder::GraphOptimizationLevel {
    use ort::session::builder::GraphOptimizationLevel;
    match level {
        0 => GraphOptimizationLevel::Disable,
        1 => GraphOptimizationLevel::Level1,
        2 => GraphOptimizationLevel::Level2,
        _ => GraphOptimizationLevel::Level3,
    }
}

fn apply_session_options(
    builder: ort::session::builder::SessionBuilder,
    inference: &LocalAsrInferenceConfig,
    profiling_prefix: Option<&Path>,
) -> ort::Result<ort::session::builder::SessionBuilder> {
    let mut builder = builder
        .with_optimization_level(graph_optimization_level(inference.graph_optimization_level))?
        .with_intra_threads(inference.intra_op_threads as usize)?
        .with_inter_threads(inference.inter_op_threads as usize)?
        .with_parallel_execution(inference.parallel_execution)?
        .with_memory_pattern(inference.enable_memory_pattern)?;
    if let Some(prefix) = profiling_prefix {
        builder = builder.with_profiling(prefix)?;
    }
    Ok(builder)
}

#[cfg(windows)]
fn verify_cuda_session(
    model_dir: &Path,
    config: &LocalAsrConfig,
    family: ModelFamily,
    variant: &str,
) -> Result<(), InferenceError> {
    use ort::ep::CUDA;
    use ort::session::Session;

    let encoder = encoder_probe_path(model_dir, family, variant)?;
    if !encoder.is_file() {
        return Err(InferenceError::ModelMissing);
    }
    let mut inference = config.inference.clone();
    normalize_inference_session_options(&mut inference);
    // Probe session should not leave profiling artifacts.
    inference.ort_profiling = false;
    let builder = Session::builder()
        .map_err(|err| InferenceError::Runtime(err.to_string()))?
        .with_execution_providers([CUDA::default().build().error_on_failure()])
        .map_err(|err| InferenceError::Runtime(err.to_string()))?;
    let mut builder = apply_session_options(builder, &inference, None)
        .map_err(|err| InferenceError::Runtime(err.to_string()))?;
    builder.commit_from_file(&encoder).map_err(|err| {
        InferenceError::Runtime(format!(
            "CUDA execution provider failed to initialize (model stayed on CPU): {err}"
        ))
    })?;
    Ok(())
}

#[cfg(not(windows))]
fn verify_cuda_session(
    _model_dir: &Path,
    _config: &LocalAsrConfig,
    _family: ModelFamily,
    _variant: &str,
) -> Result<(), InferenceError> {
    Err(InferenceError::Runtime(
        "CUDA execution provider is supported on Windows only in this module".into(),
    ))
}

fn execution_config(
    logs_dir: &Path,
    inference: &LocalAsrInferenceConfig,
    provider: &str,
) -> ExecutionConfig {
    let mut inference = inference.clone();
    normalize_inference_session_options(&mut inference);
    let profiling_prefix = if inference.ort_profiling {
        let _ = ensure_logs_dir(logs_dir);
        Some(ort_profile_prefix(logs_dir))
    } else {
        None
    };
    let use_cuda = provider == EXECUTION_PROVIDER_CUDA;
    // Always leave parakeet-rs on Cpu for EP selection. Its Cuda path registers
    // CUDA without error_on_failure; if we then re-register CUDA in custom_configure,
    // ORT fails with "Provider CUDAExecutionProvider has already been registered."
    // Register CUDA once here with error_on_failure (probe already ran in verify_cuda_session).
    ExecutionConfig::new()
        .with_execution_provider(ExecutionProvider::Cpu)
        .with_intra_threads(inference.intra_op_threads as usize)
        .with_inter_threads(inference.inter_op_threads as usize)
        .with_custom_configure(move |builder| {
            #[cfg(windows)]
            let builder = if use_cuda {
                use ort::ep::{CPU, CUDA};
                builder.with_execution_providers([
                    CUDA::default().build().error_on_failure(),
                    CPU::default().build().error_on_failure(),
                ])?
            } else {
                builder
            };
            apply_session_options(builder, &inference, profiling_prefix.as_deref())
        })
}

fn map_parakeet_err(err: parakeet_rs::Error) -> InferenceError {
    InferenceError::Runtime(err.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model_family::ModelFamily;

    #[test]
    fn encoder_probe_path_uses_fp32_encoder_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = encoder_probe_path(dir.path(), ModelFamily::ParakeetTdt, "fp32").unwrap();
        assert!(path.ends_with("encoder-model.onnx"));
        let fp16 = encoder_probe_path(dir.path(), ModelFamily::ParakeetTdt, "fp16").unwrap();
        assert!(fp16.ends_with("encoder-model.onnx"));
        let int8 = encoder_probe_path(dir.path(), ModelFamily::ParakeetTdt, "int8").unwrap();
        assert!(int8.ends_with("encoder-model.int8.onnx"));
    }

    #[test]
    fn inference_snapshot_defaults_unloaded() {
        let engine = InferenceEngine::new();
        let snap = engine.snapshot();
        assert!(!snap.model_loaded);
        assert!(snap.model_load_ms.is_none());
        assert!(!snap.ort_profiling_active);
        assert!(!snap.ort_profiling_stopped_budget);
        assert_eq!(snap.ort_profiling_decode_count, 0);
        assert!(snap.last_ort_profile_path.is_none());
    }

    #[test]
    fn ort_init_retries_when_nothing_is_loaded_yet() {
        let preferred = PathBuf::from("runtime/gpu/onnxruntime.dll");
        assert_eq!(decide_ort_init(None, &preferred), OrtInitDecision::Init);
    }

    #[test]
    fn ort_init_is_ready_when_preferred_dll_already_loaded() {
        let preferred = PathBuf::from("runtime/gpu/onnxruntime.dll");
        assert_eq!(
            decide_ort_init(Some(preferred.as_path()), &preferred),
            OrtInitDecision::AlreadyReady
        );
    }

    #[test]
    fn ort_init_requires_restart_when_preferred_dll_changes() {
        let loaded = PathBuf::from("runtime/cpu/onnxruntime.dll");
        let preferred = PathBuf::from("runtime/gpu/onnxruntime.dll");
        assert_eq!(
            decide_ort_init(Some(loaded.as_path()), &preferred),
            OrtInitDecision::RestartRequired {
                loaded: loaded.clone(),
                preferred,
            }
        );
    }

    #[test]
    fn ort_profile_prefix_under_logs() {
        let dir = tempfile::tempdir().unwrap();
        let prefix = ort_profile_prefix(dir.path());
        assert_eq!(prefix, dir.path().join("ort-profile"));
    }

    #[test]
    fn find_newest_ort_profile_picks_latest_json() {
        let dir = tempfile::tempdir().unwrap();
        let logs = dir.path();
        fs::create_dir_all(logs).unwrap();
        let older = logs.join("ort-profile_old.json");
        let newer = logs.join("ort-profile_new.json");
        fs::write(&older, "{}").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        fs::write(&newer, "{}").unwrap();
        let found = find_newest_ort_profile(&logs.join("ort-profile")).unwrap();
        assert_eq!(found, newer);
    }
}
