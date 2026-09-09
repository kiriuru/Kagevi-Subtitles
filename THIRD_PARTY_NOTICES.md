# Third-party notices

Kagevi Subtitles (the application). Copyright © 2026 Kiriuru. All rights reserved. See [LICENSE](./LICENSE).

This document lists redistributed or lazy-downloaded third-party components that require attribution or have their own license terms. Optional downloads (Local ASR models, ONNX Runtime, CUDA redist, Silero VAD) are fetched into `user-data/modules/local-asr/` only when the user installs them in the Local ASR module.

---

## NVIDIA Parakeet ASR models (CC-BY-4.0)

Local ASR uses ONNX exports of **Parakeet TDT 0.6B v3**, derived from NVIDIA NeMo Parakeet ASR models (developed with Suno.ai).

- Upstream model family: [NVIDIA Parakeet](https://huggingface.co/nvidia) / [NeMo](https://github.com/NVIDIA/NeMo)
- Typical Hugging Face ONNX sources used by the module:
  - [`istupakov/parakeet-tdt-0.6b-v3-onnx`](https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx)
  - [`Olicorne/parakeet-tdt-0.6b-v3-smoothquant-onnx`](https://huggingface.co/Olicorne/parakeet-tdt-0.6b-v3-smoothquant-onnx) (optional SmoothQuant INT8)

**License:** [Creative Commons Attribution 4.0 International (CC-BY-4.0)](https://creativecommons.org/licenses/by/4.0/)

**Required attribution (CC-BY-4.0):**

> Parakeet ASR models © NVIDIA Corporation and contributors (NeMo / Suno.ai).  
> Licensed under CC-BY-4.0. Model cards: https://huggingface.co/nvidia

By downloading or using these model weights through Kagevi Subtitles, you accept the terms of CC-BY-4.0 for those model artifacts.

---

## Microsoft ONNX Runtime (MIT)

Local ASR inference runs on **ONNX Runtime** DLLs (CPU and optional CUDA Execution Provider), downloaded from official Microsoft releases (for example v1.24.2 win-x64 / win-x64-gpu).

- Project: https://github.com/microsoft/onnxruntime  
- **License:** MIT © Microsoft Corporation

---

## NVIDIA CUDA redistributable libraries (optional)

When the user installs the Local ASR GPU path, CUDA redistributable libraries may be downloaded for the ONNX Runtime CUDA Execution Provider.

- Governed by NVIDIA CUDA Toolkit / redistributable license terms:  
  https://docs.nvidia.com/cuda/eula/index.html

---

## Silero VAD (MIT)

Optional voice-activity detection model (`silero_vad.onnx`, silero-vad v6) for Local ASR.

- Project: https://github.com/snakers4/silero-vad  
- **License:** MIT © 2020–present Silero Team

---

## parakeet-rs (MIT OR Apache-2.0)

Rust bindings / inference helper used by the Local ASR module.

- Crate: https://crates.io/crates/parakeet-rs  
- Repository: https://github.com/altunenes/parakeet-rs  
- **License:** MIT OR Apache-2.0

---

## ort (MIT OR Apache-2.0)

Rust ONNX Runtime bindings (`ort` crate) used with `parakeet-rs`.

- Repository: https://github.com/pykeio/ort  
- **License:** MIT OR Apache-2.0

---

## WebRTC VAD (`webrtc-vad`) (MIT)

Energy-based VAD used as the default Local ASR VAD backend (when Silero is not selected).

- Crate: https://crates.io/crates/webrtc-vad  
- **License:** MIT

---

## Sonic / libsonic (Apache-2.0)

Pitch-preserving tempo for TTS playback (`crates/voicesub-audio/sonic/`, based on Bill Cox’s Sonic library).

- Upstream: https://github.com/waywardgeek/sonic  
- **License:** Apache License 2.0

---

## rosc (MIT)

OSC encode/decode for the VRChat Chatbox module (`voicesub-vrchat`).

- Crate: https://crates.io/crates/rosc  
- Repository: https://github.com/klingt/rosc  
- **License:** MIT

---

## Platform & UI stack (summary)

These are linked or bundled as part of the desktop app; full crate/npm notices are available from their upstream repositories:

| Component | Role | Typical license |
| --- | --- | --- |
| [Tauri](https://tauri.app/) | Desktop shell / WebView2 host | Apache-2.0 OR MIT |
| [Svelte](https://svelte.dev/) | Dashboard, worker, TTS, Local ASR, VRChat, SteamVR HUD UI | MIT |
| [cpal](https://github.com/RustAudio/cpal) / [rodio](https://github.com/RustAudio/rodio) | Audio capture & playback | Apache-2.0 / MIT OR Apache-2.0 |
| Google Chrome | System dependency for Web Speech worker only (not redistributed) | Google Chrome Terms of Service |
| Microsoft Edge WebView2 | Runtime for the Tauri UI | Microsoft software license terms |

Translation providers (DeepL, Google, Azure, Baidu, Youdao, Tencent, Caiyun, LibreTranslate, OpenAI-compatible endpoints, experimental web translators, etc.) are remote services. Their use is subject to each provider’s terms and any API keys you configure locally; Kagevi Subtitles does not redistribute those services.

---

## How notices appear in the product

- This file in the GitHub repository (and release sources)
- About / Credits dialog → third-party summary + link
- Presentation site → Licenses section

For the Kagevi Subtitles license, see [LICENSE](./LICENSE).
