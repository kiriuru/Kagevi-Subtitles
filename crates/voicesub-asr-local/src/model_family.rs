//! ASR model families — Parakeet TDT (batch window decode).

use serde::{Deserialize, Serialize};

pub const FAMILY_PARAKEET_TDT: &str = "parakeet_tdt";

/// Legacy alias kept for older sidecar configs.
pub const MODEL_FAMILY: &str = FAMILY_PARAKEET_TDT;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModelFamily {
    ParakeetTdt,
}

impl ModelFamily {
    pub fn parse(raw: &str) -> Option<Self> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "" | "parakeet_tdt" | "parakeet-tdt" | "tdt" => Some(Self::ParakeetTdt),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        FAMILY_PARAKEET_TDT
    }

    pub fn variants(self) -> &'static [FamilyVariantSpec] {
        PARAKEET_TDT_VARIANTS
    }

    pub fn parse_variant(self, raw: &str) -> Option<&'static FamilyVariantSpec> {
        let key = raw.trim().to_ascii_lowercase();
        self.variants()
            .iter()
            .find(|spec| spec.variant.eq_ignore_ascii_case(&key))
    }

    pub fn default_variant(self) -> &'static str {
        self.variants()
            .first()
            .map(|spec| spec.variant)
            .unwrap_or("int8")
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FamilyVariantSpec {
    pub variant: &'static str,
    pub hf_repo: &'static str,
    /// Optional path prefix inside the HF repo.
    pub hf_subdir: Option<&'static str>,
    pub required_files: &'static [&'static str],
    /// Optional HF remote filename overrides: `(local_name, remote_name)`.
    /// Used when the on-disk names expected by `parakeet-rs` differ from HF.
    pub hf_remote_files: Option<&'static [(&'static str, &'static str)]>,
    pub size_mb: u32,
    pub author: &'static str,
    pub display_name: &'static str,
}

const PARAKEET_TDT_INT8_FILES: &[&str] = &[
    "encoder-model.int8.onnx",
    "decoder_joint-model.int8.onnx",
    "nemo128.onnx",
    "vocab.txt",
];

const PARAKEET_TDT_FP32_FILES: &[&str] = &[
    "encoder-model.onnx",
    "encoder-model.onnx.data",
    "decoder_joint-model.onnx",
    "nemo128.onnx",
    "vocab.txt",
];

/// Stored under fp32-compatible names so `parakeet-rs` TDT loader finds them
/// (it prefers `encoder-model.onnx` / `decoder_joint-model.onnx` and does not
/// list `*.fp16.onnx` for the decoder).
const PARAKEET_TDT_FP16_FILES: &[&str] = &[
    "encoder-model.onnx",
    "decoder_joint-model.onnx",
    "nemo128.onnx",
    "vocab.txt",
];

const PARAKEET_TDT_FP16_REMOTE: &[(&str, &str)] = &[
    ("encoder-model.onnx", "encoder-model.fp16.onnx"),
    ("decoder_joint-model.onnx", "decoder_joint-model.fp16.onnx"),
];

const PARAKEET_TDT_VARIANTS: &[FamilyVariantSpec] = &[
    FamilyVariantSpec {
        variant: "int8",
        hf_repo: "istupakov/parakeet-tdt-0.6b-v3-onnx",
        hf_subdir: None,
        required_files: PARAKEET_TDT_INT8_FILES,
        hf_remote_files: None,
        size_mb: 670,
        author: "istupakov",
        display_name: "Parakeet TDT int8",
    },
    FamilyVariantSpec {
        variant: "fp16",
        hf_repo: "grikdotnet/parakeet-tdt-0.6b-fp16",
        hf_subdir: None,
        required_files: PARAKEET_TDT_FP16_FILES,
        hf_remote_files: Some(PARAKEET_TDT_FP16_REMOTE),
        size_mb: 1220,
        author: "grikdotnet",
        display_name: "Parakeet TDT fp16",
    },
    FamilyVariantSpec {
        variant: "fp32",
        hf_repo: "istupakov/parakeet-tdt-0.6b-v3-onnx",
        hf_subdir: None,
        required_files: PARAKEET_TDT_FP32_FILES,
        hf_remote_files: None,
        size_mb: 2500,
        author: "istupakov",
        display_name: "Parakeet TDT fp32",
    },
    FamilyVariantSpec {
        variant: "int8_smoothquant",
        hf_repo: "Olicorne/parakeet-tdt-0.6b-v3-smoothquant-onnx",
        hf_subdir: None,
        required_files: PARAKEET_TDT_INT8_FILES,
        hf_remote_files: None,
        size_mb: 900,
        author: "Olicorne",
        display_name: "Parakeet TDT int8 SmoothQuant",
    },
];

pub fn model_display_label(family_raw: &str, variant_raw: &str) -> String {
    let family = ModelFamily::parse(family_raw).unwrap_or(ModelFamily::ParakeetTdt);
    family
        .parse_variant(variant_raw)
        .map(|spec| spec.display_name.to_string())
        .unwrap_or_else(|| format!("{} {variant_raw}", family.as_str()))
}

/// Resolve the Hugging Face filename for a locally required file.
pub fn hf_remote_file_name<'a>(spec: &FamilyVariantSpec, local_file: &'a str) -> &'a str {
    if let Some(map) = spec.hf_remote_files {
        for (local, remote) in map {
            if *local == local_file {
                return remote;
            }
        }
    }
    local_file
}

pub fn hf_file_url(spec: &FamilyVariantSpec, file: &str) -> String {
    let remote = hf_remote_file_name(spec, file);
    match spec.hf_subdir {
        Some(subdir) => format!(
            "https://huggingface.co/{}/resolve/main/{}/{}",
            spec.hf_repo, subdir, remote
        ),
        None => format!(
            "https://huggingface.co/{}/resolve/main/{}",
            spec.hf_repo, remote
        ),
    }
}

/// Coerce removed / unknown families (Unified, Nemotron, …) back to Parakeet TDT int8.
pub fn normalize_model_selection(family_raw: &str, variant_raw: &str) -> (String, String) {
    let key = family_raw.trim().to_ascii_lowercase();
    if matches!(
        key.as_str(),
        "parakeet_unified"
            | "parakeet-unified"
            | "unified"
            | "nemotron_streaming"
            | "nemotron-streaming"
            | "nemotron"
    ) || ModelFamily::parse(family_raw).is_none()
    {
        return (
            FAMILY_PARAKEET_TDT.into(),
            ModelFamily::ParakeetTdt.default_variant().into(),
        );
    }

    let family = ModelFamily::ParakeetTdt;
    let variant = family
        .parse_variant(variant_raw)
        .map(|spec| spec.variant.to_string())
        .unwrap_or_else(|| family.default_variant().to_string());
    (family.as_str().into(), variant)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_display_label_uses_variant_name() {
        assert_eq!(
            model_display_label("parakeet_tdt", "int8"),
            "Parakeet TDT int8"
        );
    }

    #[test]
    fn parses_tdt_variants() {
        let tdt = ModelFamily::ParakeetTdt;
        assert_eq!(tdt.parse_variant("int8").unwrap().variant, "int8");
        assert_eq!(tdt.parse_variant("fp16").unwrap().variant, "fp16");
        assert_eq!(tdt.parse_variant("fp32").unwrap().variant, "fp32");
        assert_eq!(
            tdt.parse_variant("int8_smoothquant").unwrap().variant,
            "int8_smoothquant"
        );
    }

    #[test]
    fn fp16_downloads_fp16_remote_names_to_fp32_local_names() {
        let spec = ModelFamily::ParakeetTdt.parse_variant("fp16").unwrap();
        assert_eq!(
            hf_remote_file_name(spec, "encoder-model.onnx"),
            "encoder-model.fp16.onnx"
        );
        assert_eq!(
            hf_remote_file_name(spec, "decoder_joint-model.onnx"),
            "decoder_joint-model.fp16.onnx"
        );
        assert_eq!(hf_remote_file_name(spec, "nemo128.onnx"), "nemo128.onnx");
        assert!(
            hf_file_url(spec, "encoder-model.onnx").ends_with("encoder-model.fp16.onnx")
        );
    }

    #[test]
    fn removed_families_are_not_parsed() {
        assert!(ModelFamily::parse("parakeet_unified").is_none());
        assert!(ModelFamily::parse("nemotron_streaming").is_none());
        assert!(ModelFamily::parse("nemotron").is_none());
    }

    #[test]
    fn normalize_coerces_nemotron_unified_and_unknown() {
        let (family, variant) = normalize_model_selection("nemotron_streaming", "multilingual");
        assert_eq!(family, FAMILY_PARAKEET_TDT);
        assert_eq!(variant, "int8");

        let (family, variant) = normalize_model_selection("parakeet_unified", "en");
        assert_eq!(family, FAMILY_PARAKEET_TDT);
        assert_eq!(variant, "int8");

        let (family, variant) = normalize_model_selection("unknown_family", "fp32");
        assert_eq!(family, FAMILY_PARAKEET_TDT);
        assert_eq!(variant, "int8");
    }

    #[test]
    fn normalize_keeps_valid_tdt_variant() {
        let (family, variant) = normalize_model_selection("parakeet_tdt", "fp32");
        assert_eq!(family, FAMILY_PARAKEET_TDT);
        assert_eq!(variant, "fp32");

        let (family, variant) = normalize_model_selection("parakeet_tdt", "fp16");
        assert_eq!(family, FAMILY_PARAKEET_TDT);
        assert_eq!(variant, "fp16");
    }
}
