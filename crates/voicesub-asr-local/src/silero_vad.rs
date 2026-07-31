//! Optional Silero VAD (ONNX) — upstream silero-vad v6 chunk protocol.

use std::path::{Path, PathBuf};

use ort::session::Session;
use ort::value::{Tensor, TensorRef};
use thiserror::Error;
use tracing::{info, warn};

use crate::inference::InferenceEngine;

/// Official silero-vad v6.0 ONNX from the upstream Silero release tag.
pub const SILERO_VAD_URL: &str =
    "https://github.com/snakers4/silero-vad/raw/refs/tags/v6.0/src/silero_vad/data/silero_vad.onnx";

pub const SILERO_VAD_FILENAME: &str = "silero_vad.onnx";
pub const SILERO_CHUNK_SAMPLES: usize = 512;
pub const SILERO_CONTEXT_SAMPLES: usize = 64;
const SILERO_INPUT_SAMPLES: usize = SILERO_CONTEXT_SAMPLES + SILERO_CHUNK_SAMPLES;
const SILERO_STATE_LEN: usize = 2 * 128;

#[derive(Debug, Error)]
pub enum SileroVadError {
    #[error("silero VAD model not found: {0}")]
    Missing(String),
    #[error("silero VAD init failed: {0}")]
    Init(String),
    #[error("silero VAD inference failed: {0}")]
    Infer(String),
}

pub fn silero_vad_dir(module_dir: &Path) -> PathBuf {
    module_dir.join("runtime").join("silero_vad_v6")
}

pub fn silero_vad_model_path(module_dir: &Path) -> PathBuf {
    silero_vad_dir(module_dir).join(SILERO_VAD_FILENAME)
}

pub fn is_silero_vad_installed(module_dir: &Path) -> bool {
    silero_vad_model_path(module_dir).is_file()
}

pub struct SileroVadEngine {
    session: Session,
    state: Vec<f32>,
    context: Vec<f32>,
    pending: Vec<f32>,
    threshold: f32,
    last_is_speech: bool,
}

impl SileroVadEngine {
    pub fn try_open(module_dir: &Path, threshold: f32) -> Result<Self, SileroVadError> {
        InferenceEngine::ensure_ort_initialized(module_dir)
            .map_err(|err| SileroVadError::Init(err.to_string()))?;
        let model_path = silero_vad_model_path(module_dir);
        if !model_path.is_file() {
            return Err(SileroVadError::Missing(model_path.display().to_string()));
        }
        let session = Session::builder()
            .map_err(|err| SileroVadError::Init(err.to_string()))?
            .with_intra_threads(1)
            .map_err(|err| SileroVadError::Init(err.to_string()))?
            .commit_from_file(&model_path)
            .map_err(|err| SileroVadError::Init(err.to_string()))?;
        info!(
            target: "voicesub.asr_local.silero_vad",
            path = %model_path.display(),
            threshold,
            "loaded Silero VAD session"
        );
        Ok(Self {
            session,
            state: vec![0.0; SILERO_STATE_LEN],
            context: vec![0.0; SILERO_CONTEXT_SAMPLES],
            pending: Vec::with_capacity(SILERO_CHUNK_SAMPLES * 2),
            threshold: threshold.clamp(0.05, 0.95),
            last_is_speech: false,
        })
    }

    pub fn set_threshold(&mut self, threshold: f32) {
        self.threshold = threshold.clamp(0.05, 0.95);
    }

    pub fn reset(&mut self) {
        self.state.fill(0.0);
        self.context.fill(0.0);
        self.pending.clear();
        self.last_is_speech = false;
    }

    /// Classify a PCM16 LE frame; Silero runs when ≥512 samples are buffered.
    pub fn is_speech_pcm16(&mut self, frame: &[u8]) -> bool {
        for chunk in frame.chunks_exact(2) {
            let sample = i16::from_le_bytes([chunk[0], chunk[1]]) as f32 / 32768.0;
            self.pending.push(sample);
        }
        while self.pending.len() >= SILERO_CHUNK_SAMPLES {
            let chunk: Vec<f32> = self.pending.drain(..SILERO_CHUNK_SAMPLES).collect();
            match self.predict_chunk(&chunk) {
                Ok(is_speech) => self.last_is_speech = is_speech,
                Err(err) => {
                    warn!(
                        target: "voicesub.asr_local.silero_vad",
                        error = %err,
                        "Silero VAD infer failed — keeping last decision"
                    );
                }
            }
        }
        self.last_is_speech
    }

    fn predict_chunk(&mut self, chunk: &[f32]) -> Result<bool, SileroVadError> {
        let mut input_samples = Vec::with_capacity(SILERO_INPUT_SAMPLES);
        input_samples.extend_from_slice(&self.context);
        input_samples.extend_from_slice(chunk);

        let input = TensorRef::from_array_view(([1_usize, SILERO_INPUT_SAMPLES], input_samples.as_slice()))
            .map_err(|err| SileroVadError::Infer(err.to_string()))?;
        let sr = Tensor::from_array(((), vec![16_000_i64]))
            .map_err(|err| SileroVadError::Infer(err.to_string()))?;
        let state = TensorRef::from_array_view(([2_usize, 1, 128], self.state.as_slice()))
            .map_err(|err| SileroVadError::Infer(err.to_string()))?;

        let outputs = self
            .session
            .run(ort::inputs![
                "input" => input,
                "sr" => sr,
                "state" => state,
            ])
            .map_err(|err| SileroVadError::Infer(err.to_string()))?;

        let (_, out) = outputs[0]
            .try_extract_tensor::<f32>()
            .map_err(|err| SileroVadError::Infer(err.to_string()))?;
        let (_, state_out) = outputs[1]
            .try_extract_tensor::<f32>()
            .map_err(|err| SileroVadError::Infer(err.to_string()))?;
        if state_out.len() == self.state.len() {
            self.state.copy_from_slice(state_out);
        }
        self.context
            .copy_from_slice(&chunk[SILERO_CHUNK_SAMPLES - SILERO_CONTEXT_SAMPLES..]);

        let probability = out.first().copied().unwrap_or(0.0);
        Ok(probability > self.threshold)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_path_layout() {
        let dir = Path::new("user-data/modules/local-asr");
        assert!(silero_vad_model_path(dir)
            .to_string_lossy()
            .replace('\\', "/")
            .ends_with("runtime/silero_vad_v6/silero_vad.onnx"));
        assert!(!is_silero_vad_installed(dir));
    }
}
