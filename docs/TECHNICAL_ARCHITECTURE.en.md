# Kagevi Subtitles 0.7.0 — Technical Architecture Document

Valid for the codebase where `voicesub-types::PROJECT_VERSION = "0.7.0"`.

This document describes the Kagevi Subtitles project layout, HTTP/WebSocket/Tauri IPC contracts, configuration schema, data flow through the Rust runtime, and frontend surfaces. It is the **canonical technical reference** for active development. README is a short product overview; CHANGELOG is release history; agent policy is `AGENTS.md`.

**Maintenance rule:** any change to API/WS/IPC contracts, config schema, subtitle/translation lifecycle, overlay renderer, browser worker, or NSIS installer bundle **updates the corresponding sections in the same task**. Outdated wording is removed or rewritten — not kept "for history".

## Table of Contents

- [Related Documentation](#related-documentation)
- [Quick Reference](#quick-reference)
- [1. Purpose and System Boundaries](#1-purpose-and-system-boundaries)
- [2. Technology Stack](#2-technology-stack)
- [3. High-Level Runtime Diagram](#3-high-level-runtime-diagram)
- [4. Repository Layout](#4-repository-layout)
- [5. Rust Workspace (crates)](#5-rust-workspace-crates)
- [6. RuntimeService: Orchestration and Lifecycle](#6-runtimeservice-orchestration-and-lifecycle)
- [7. Configuration and Migrations](#7-configuration-and-migrations)
- [8. HTTP API (local)](#8-http-api-local)
- [9. WebSocket Surface](#9-websocket-surface)
- [10. Tauri IPC](#10-tauri-ipc)
- [11. Logs, Diagnostics, Export](#11-logs-diagnostics-export)
- [12. Browser Speech Worker](#12-browser-speech-worker)
- [13. Translation: Lifecycle and Invariants](#13-translation-lifecycle-and-invariants)
- [14. Subtitle Lifecycle and Presentation](#14-subtitle-lifecycle-and-presentation)
- [15. Subtitle Styles and Overlay](#15-subtitle-styles-and-overlay)
- [16. OBS Closed Captions](#16-obs-closed-captions)
- [17. TTS Module](#17-tts-module)
- [18. Local ASR Module](#18-local-asr-module)
- [18b. VRChat Chatbox OSC Module](#18b-vrchat-chatbox-osc-module)
- [18c. SteamVR OpenVR HUD Overlay Module](#18c-steamvr-openvr-hud-overlay-module)
- [19. Desktop Runtime and NSIS Release](#19-desktop-runtime-and-nsis-release)
- [20. Storage and Paths](#20-storage-and-paths)
- [21. Frontend: Dashboard (Svelte)](#21-frontend-dashboard-svelte)
- [22. Frontend: Overlay (vanilla)](#22-frontend-overlay-vanilla)
- [23. Frontend: Browser Worker (Svelte)](#23-frontend-browser-worker-svelte)
- [24. UI Localization (i18n)](#24-ui-localization-i18n)
- [25. Versioning and Update Checks](#25-versioning-and-update-checks)
- [26. Testing](#26-testing)
- [27. Product Invariants](#27-product-invariants)
- [28. Known Limitations & Technical Debt](#28-known-limitations--technical-debt)
- [29. Security & Privacy Model](#29-security--privacy-model)
- [30. Extension Points](#30-extension-points)
- [31. Glossary](#31-glossary)

## Related Documentation

| Document | Purpose |
| --- | --- |
| `docs/WIKI.en.md` | User guide (EN) |
| `docs/WIKI.ru.md` | User guide (RU) |
| `docs/TECHNICAL_ARCHITECTURE.en.md` | Technical architecture (English) |
| `docs/CHANGELOG.md` | Change history |
| `AGENTS.md` | Agent policy |

## Quick Reference

### Dev build and test

```bash
# Rust tests
cargo test --workspace

# Frontend build (dashboard + worker + TTS + Local ASR + VRChat + SteamVR HUD)
npm run build

# NSIS release (Windows)
build-release-msi.bat   # → build-release.ps1
```

Tauri dev: embedded HTTP on `http://127.0.0.1:8765`; main webview opens the dashboard at that URL.

### Key URLs (default bind)

| URL | Purpose |
| --- | --- |
| `http://127.0.0.1:8765/` | Svelte dashboard |
| `http://127.0.0.1:8765/overlay` | OBS Browser Source |
| `http://127.0.0.1:8765/google-asr?autostart=1` | Browser Speech worker (full UI) |
| `http://127.0.0.1:8765/google-asr-compact?autostart=1` | Compact Browser Speech worker (Chrome `--app=`) |
| `http://127.0.0.1:8765/tts` | TTS module UI |
| `http://127.0.0.1:8765/twitch` | Twitch module UI |
| `http://127.0.0.1:8765/local-asr` | Local ASR module UI |
| `http://127.0.0.1:8765/vrchat` | VRChat Chatbox OSC module UI |
| `http://127.0.0.1:8765/vr-overlay` | SteamVR OpenVR HUD overlay module UI |

### Key API endpoints

| Endpoint | Purpose |
| --- | --- |
| `POST /api/runtime/start` | Start session (Chrome worker **or** Local ASR) |
| `POST /api/runtime/stop` | Stop worker / local ASR, translation, OBS |
| `GET /api/runtime/status` | Runtime snapshot + diagnostics (`asr.local_module`) |
| `GET /api/settings/load` | Load config + presets + fonts |
| `POST /api/settings/save` | Normalize + save `config.toml` |
| `POST /api/ui/sync` | UI theme/locale/font sync → `ui_config_sync` |
| `GET /api/ui/sync` | Last live UI theme (preset without Save) or disk `ui` |
| `GET /api/exports/diagnostics` | Redacted diagnostics ZIP |
| `GET /api/obs/url` | `{ overlay_url }` for OBS |
| `GET /api/asr/local/status` | Local ASR module readiness / deps / model |
| `GET /api/tts/status` | Subtitle TTS enabled / waiting-for-Live |
| `GET /api/twitch/status` | Twitch IRC connection + optional chat TTS |
| `GET /api/vrchat/status` | VRChat Chatbox module enabled / layer / last send |
| `GET /api/vrchat/config` | VRChat module config |
| `POST /api/vrchat/config/save` | Save VRChat module config |
| `POST /api/vrchat/test` | Send a Chatbox OSC test message |
| `POST /api/vrchat/test-connection` | Listen on OSC-out (default 9001) for VRChat packets |
| `GET /api/vr-overlay/status` | SteamVR HUD module enabled / origin / last submit |
| `GET /api/vr-overlay/config` | SteamVR HUD overlay config |
| `POST /api/vr-overlay/config/save` | Save SteamVR HUD overlay config |
| `POST /api/vr-overlay/test` | Submit a test HUD frame via `SetOverlayTexture` (DXGI shared; `SetOverlayRaw` fallback) |
| `POST /api/vr-overlay/probe` | Probe SteamVR runtime / HMD / `IVROverlay` |
| `GET /api/vr-overlay/steamvr/status` | SteamVR process status (`vrserver` / compositor) + module status |
| `POST /api/vr-overlay/steamvr/start` | Launch SteamVR via `vrstartup.exe` (fallback `steam.exe -applaunch 250820`) — **user action only**; module never auto-starts |
| `POST /api/vr-overlay/steamvr/stop` | Graceful exit: abandon OpenVR session, then `WM_CLOSE` on visible `vrmonitor` windows (fallback HTTP `:8998/console_command.action?sCommand=quit`) |

### WebSocket channels

| Channel | Purpose |
| --- | --- |
| `/ws/events` | OBS overlay (+ optional external / legacy `src/lib/ws.ts`); live `overlay_update` + runtime events |
| `/ws/asr_worker` | Browser Speech worker transport |

Production Tauri dashboard and module windows use in-process `runtime-event` IPC (`src/lib/runtime-events.ts`), not `/ws/events`.

### Key files

| File | Purpose |
| --- | --- |
| `crates/voicesub-types/src/version.rs` | `PROJECT_VERSION` |
| `crates/voicesub-runtime/src/service.rs` | Orchestration, start/stop |
| `crates/voicesub-runtime/src/http/router.rs` | All HTTP/WS routes |
| `crates/voicesub-subtitle/src/lifecycle.rs` | Subtitle FSM/TTL |
| `crates/voicesub-translation/src/dispatcher.rs` | Translation queue + stale drop |
| `src-tauri/src/lib.rs` | Tauri shell + IPC |
| `bin/overlay/shared/js/subtitle-style/` | Shared overlay renderer (ESM modules; entry `index.js`) |

## 1. Purpose and System Boundaries

**Kagevi Subtitles** is a local Windows-first desktop app for real-time subtitles:

- speech capture via **Browser Speech worker** (separate Chrome window with visible address bar, Web Speech API) **or** optional **Local ASR** (Parakeet ONNX, in-process mic);
- optional translation to **0..4 lines** (`translation_1`…`translation_4`) with independent provider per slot;
- unified subtitle payload routing to Svelte dashboard, vanilla OBS overlay, and OBS Closed Captions;
- optional **TTS module** (subtitle speech; enable-without-window, requires Live Start);
- optional **Twitch module** (IRC, filters, optional chat TTS independent of subtitle TTS);
- optional **Local ASR module** (`/local-asr`, mode `local_parakeet` when `local_module.ready`);
- diagnostics ZIP export and client-side trace logs.

**ASR modes:** `browser_google` (default Web Speech at `/google-asr`) and optional `local_parakeet` (Local ASR module, gated on `asr.local_module.ready`).

Hard boundaries:

- local-first runtime, default bind `127.0.0.1:8765`;
- no cloud backend, accounts, or hosted database;
- **Node.js forbidden in shipped runtime**; Vite/Node only on dev/build machines;
- dashboard and worker are Svelte (compile-time bundle); overlay is **vanilla HTML/JS** (no Svelte);
- **WebView2 Runtime** — required for the Tauri shell (`Kagevi Subtitles.exe`, dashboard, `/tts`, `/twitch`, `/local-asr`, `/vrchat`, `/vr-overlay`); NSIS installer can run the bootstrapper if missing.
- Chrome is a separate system dependency for the Web Speech worker; core installer does not bundle Python/torch/Node. Local ASR ONNX/CUDA deps and model weights are **lazy-downloaded** into `user-data/modules/local-asr/` (not in the core installer).

## 2. Technology Stack

| Layer | Technologies |
| --- | --- |
| Core runtime | Rust 1.85+ (edition 2024), Tokio, Axum 0.8 |
| Desktop shell | Tauri 2 → `Kagevi Subtitles.exe` (NSIS `setup.exe`) |
| Dashboard UI | Svelte 5 + Vite → `bin/dashboard/` |
| Browser worker | Svelte 5 + Vite → `bin/worker/` |
| TTS UI | Svelte 5 + Vite → `bin/tts/` |
| Twitch UI | Svelte 5 + Vite → `bin/twitch/` |
| Local ASR UI | Svelte 5 + Vite → `bin/local-asr/` |
| VRChat UI | Svelte 5 + Vite → `bin/vrchat/` |
| SteamVR HUD UI | Svelte 5 + Vite → `bin/vr-overlay/` |
| OBS overlay | Vanilla HTML/CSS/JS → `bin/overlay/` |
| Config | TOML (`user-data/config.toml`), JSON-shaped document inside |
| HTTP client (providers) | `reqwest` + rustls |
| Logging | `tracing` + rotating files + opt-in JSONL |
| TTS sidecar | Embedded Python exe in `bin/modules/tts/runtime/` (not core Rust) |
| Local ASR inference | `parakeet-rs` + ONNX Runtime DLL (CPU / optional CUDA EP) |

**Forbidden in active tree:** React, Webpack, Electron, pywebview, FastAPI runtime, in-process NeMo/torch.

## 3. High-Level Runtime Diagram

```mermaid
flowchart LR
  subgraph Shell["Desktop shell"]
    TA["Tauri main window"]
  end

  subgraph Core["Rust core voicesub-runtime"]
    HTTP["Axum HTTP WS"]
    RT["RuntimeService"]
    SUB["SubtitleRouter Lifecycle"]
    TR["TranslationDispatcher"]
    OBS["OBS captions"]
  end

  subgraph Browser["Browser Speech"]
    CHR["Chrome google-asr"]
  end

  subgraph LocalAsr["Local ASR optional"]
    LASR["mic VAD Parakeet"]
  end

  subgraph Surfaces["Web surfaces"]
    DASH["Svelte dashboard"]
    OVL["Vanilla overlay"]
    TTS["TTS module"]
    TWITCH["Twitch module"]
    LASRUI["Local ASR UI"]
  end

  TA <-->|Tauri IPC| RT
  TA -->|runtime-event| DASH
  CHR -->|ws asr_worker| HTTP
  RT --> CHR
  RT --> LASR
  LASR -->|IngestedAsrUpdate| SUB
  HTTP -->|ws events| OVL
  RT --> SUB --> TR
  SUB --> OBS
  RT --> TTS
  RT --> TWITCH
  RT --> LASRUI
```

**Hot path (browser):** `external_asr_update` (WS) → transcript controller → subtitle lifecycle → translation dispatcher → `overlay_update` (WS live + Tauri `runtime-event`) → OBS overlay + dashboard. **Hot path (local ASR):** mic → VAD/decode → `PartialEmitCoordinator` (`should_emit`) → same ingest as browser. `subtitle_payload_update` is **Tauri IPC snapshot only** (not live on `/ws/events`). WS connect replay = `runtime_update` + `overlay_update` + `ui_config_sync`. Partial `transcript_update` is coalesced (default 90 ms); subtitle lifecycle and `overlay_update` still see every partial.

## 4. Repository Layout

```
F:\AI\VoiceSub\
├── Cargo.toml                  # workspace members, workspace.dependencies
├── Cargo.lock
├── package.json                # Vite/Svelte build scripts
├── vite.config.ts              # → bin/dashboard/
├── vite.worker.config.ts       # → bin/worker/
├── vite.tts.config.ts          # → bin/tts/
├── vite.twitch.config.ts       # → bin/twitch/
├── vite.local-asr.config.ts    # → bin/local-asr/
├── vite.vrchat.config.ts       # → bin/vrchat/
├── vite.vr-overlay.config.ts   # → bin/vr-overlay/
├── build-release-msi.bat       # back-compat → build-release.ps1
├── build-release.ps1           # NSIS release pipeline
├── build/release.config.json   # release_root for setup.exe copy
│
├── crates/                     # Rust domain + adapters (see §5)
├── src-tauri/                  # Tauri binary shell (thin)
├── src/                        # Svelte dashboard sources
├── src-worker/                 # Svelte browser worker sources
├── src-tts/                    # Svelte TTS module sources
├── src-twitch/                 # Svelte Twitch module sources
├── src-local-asr/              # Svelte Local ASR module sources
├── src-vrchat/                 # Svelte VRChat module sources
├── src-vr-overlay/             # Svelte SteamVR HUD overlay module sources
│
├── bin/                        # Shipped static assets (NSIS resources)
│   ├── dashboard/              # Vite build output
│   ├── worker/                 # Worker bundle
│   ├── tts/                    # TTS UI bundle
│   ├── twitch/                 # Twitch UI bundle
│   ├── local-asr/              # Local ASR UI bundle
│   ├── vrchat/                 # VRChat UI bundle
│   ├── vr-overlay/             # SteamVR HUD UI bundle
│   ├── overlay/                # Vanilla OBS overlay
│   ├── fonts/                  # Project fonts
│   └── modules/                # Sidecar modules (tts, twitch, local-asr, vrchat, vr-overlay)
│
├── tests/
│   ├── golden/                 # Regression fixtures
│   └── integration/
│
├── docs/
├── user-data/                  # runtime (gitignored)
└── logs/                       # runtime (gitignored)
```

### Source vs build artifacts

| Surface | In git | After `npm run build` / installer |
| --- | --- | --- |
| `crates/`, `src/`, `src-worker/`, `src-tts/`, `src-twitch/`, `src-local-asr/`, `src-vrchat/`, `src-vr-overlay/` | yes | compiled into exe + static |
| `bin/dashboard`, `bin/worker`, `bin/tts`, `bin/twitch`, `bin/local-asr`, `bin/vrchat`, `bin/vr-overlay` | build output | in NSIS `resources/bin/` |
| `bin/overlay/` | yes | in installer |
| `user-data/`, `logs/` | no | created at runtime |

## 5. Rust Workspace (crates)

Workspace members (`Cargo.toml`): 18 domain crates + `src-tauri` (no separate `xtask` crate).

### Dependency graph (simplified)

```
voicesub-types (Layer 0: DTO, WS types, errors)
    ↑
voicesub-config, voicesub-subtitle, voicesub-translation, voicesub-browser,
voicesub-ws, voicesub-logging, voicesub-export, voicesub-obs, voicesub-audio,
voicesub-tts, voicesub-twitch, voicesub-asr-local, voicesub-vrchat, voicesub-vr-overlay, voicesub-partial-emit (Layer 1–2)
    ↑
voicesub-runtime (Layer 3: wiring, HTTP router, orchestration)
    ↑
src-tauri (Layer 4: IPC, window, bundle only)
```

### Crate reference

| Crate | Purpose |
| --- | --- |
| `voicesub-types` | `PROJECT_VERSION`, WS envelope types, ASR event DTO |
| `voicesub-config` | TOML store, defaults, normalize/migrate, paths, bind policy |
| `voicesub-subtitle` | `SubtitleLifecycleCore`, `SubtitleRouter`, presentation, overlay contract |
| `voicesub-translation` | `TranslationDispatcher`, `TranslationEngine`, 17 providers |
| `voicesub-browser` | Chrome supervisor, worker launch flags, operational FSM |
| `voicesub-ws` | `/ws/events` hub, `/ws/asr_worker` hub, event sequence |
| `voicesub-http` | Re-export `voicesub-runtime::http` (thin) |
| `voicesub-logging` | `tracing` backbone, rotation, session JSONL, deep trace flags |
| `voicesub-export` | Diagnostics ZIP, config redaction |
| `voicesub-obs` | OBS WebSocket closed captions client |
| `voicesub-audio` | WASAPI device enum, native/Sonic `PlaybackHub`, legacy WinAPI per-process routing (TTS) |
| `voicesub-tts` | Subtitle TTS service, speech queue/planner (`TtsModuleService`) |
| `voicesub-twitch` | Twitch module: IRC (up to 5 channels), EventSub WebSocket alerts, OAuth bridge, emotes, filters, optional chat + event TTS |
| `voicesub-asr-local` | Local ASR module: deps, model, Parakeet ONNX, VAD/pipeline, test bench, status |
| `voicesub-vrchat` | VRChat Chatbox OSC output (`/chatbox/input`) |
| `voicesub-vr-overlay` | SteamVR OpenVR HUD (`VRApplication_Background` → `_Overlay` fallback, `IVROverlay_028` → `_027`) |
| `voicesub-partial-emit` | Shared partial emit policy (`word_growth` / `char_delta`, coalesce) — **applied on Local ASR path**; browser Web Speech does not run `should_emit` |
| `voicesub-runtime` | `RuntimeService`, HTTP router, transcript controller, session wiring |

**Rule:** business logic does not live in `src-tauri/`; Tauri is IPC + lifecycle hooks only.

## 6. RuntimeService: Orchestration and Lifecycle

**File:** `crates/voicesub-runtime/src/service.rs`

`RuntimeService` is the single wiring point:

1. **Start** (`POST /api/runtime/start`):
   - merge optional inline `config_payload`;
   - apply live settings (translation, OBS, subtitle, logging);
   - if `asr.mode = browser_google`: launch Chrome worker → `{base}/google-asr` or `/google-asr-compact` (`asr.browser.compact_worker_ui`) with `?autostart=1[&locale=…]` and browser speech ingest;
   - if `asr.mode = local_parakeet`: assert `asr.local_module.ready`, start `LocalAsrSpeechSource` (no Chrome worker);
   - start translation dispatcher, OBS captions;
   - broadcast `preflight_update`, `runtime_update`.

2. **Stop** (`POST /api/runtime/stop`):
   - browser mode: send `browser_asr_control` stop on `/ws/asr_worker`; kill Chrome process tree (`taskkill /T /F` on Windows);
   - local mode: stop `LocalAsrSpeechSource`;
   - stop translation, OBS; reset subtitle state/metrics.

3. **Tauri shutdown** (`src-tauri/src/lib.rs`):
   - TTS shutdown → `POST /api/runtime/stop` → runtime handle drop.

Embedded HTTP server: dedicated Tokio runtime in Tauri process; bind from `AppConfig` + `VOICESUB_ALLOW_LAN`.

**0.5.4 hot-path notes:**

- `browser_speech_source.rs` — sync `accept_update` + async `process_ingest_work` (ingest mutex not held across subtitle/WS work).
- `SubtitlePayloadForwarder` — TTS listener on dedicated ordered thread (`voicesub-subtitle-payload-forward`), not inside subtitle actor publish loop.
- Live subtitle WS fanout is **`overlay_update` only**; `subtitle_payload_update` is Tauri IPC snapshot / replay, not duplicated on `/ws/events`.

## 7. Configuration and Migrations

### Storage

- **Path:** `{project_root}/user-data/config.toml`
- **Format:** JSON-shaped document serialized as TOML (`voicesub-config::store`)
- **Current version:** `config_version = 8` (`defaults.rs`)

### Top-level keys

| Key | Role |
| --- | --- |
| `config_version` | Schema version (migrate on load) |
| `profile` | Active profile name |
| `ui` | `language`, `layout`, `theme`, `palette`, `font_family`, `show_translation_results` |
| `source_lang` | ASR source (`auto` default) |
| `targets` | Deprecated; normalized into `translation.lines` on load |
| `asr` | `mode` + `browser` tuning (+ legacy `realtime` keys for normalize/diagnostics; see §12) |
| `overlay` | `preset`, `compact` |
| `obs_closed_captions` | OBS WebSocket CC settings |
| `translation` | Provider, lines (up to 4), cache, limits, `live_partial`, `provider_settings` |
| `subtitle_output` | Source/translation display order |
| `subtitle_lifecycle` | TTL, sync flags; deprecated timing keys normalized only |
| `source_text_replacement` | Find/replace for ASR text (custom pairs + builtin stems/obfuscation normalize; applied in `TranscriptController` before subtitle/translation). Builtin Latin/Cyrillic always token-bounded (custom pairs honour `whole_words`); Hangul space-bounded; short katakana / single-char Han isolated; multi-char Han/hiragana substring. Builtin / empty target mask keeps first and last letter (`fuck`→`f**k`, `whore`→`w***e`); spans that already contain `*` are left alone |
| `transcript_format` | Post-ASR phrase format pipeline (currently **forced off / UI hidden**) |
| `logging` | `full_enabled` — master switch for deep diagnostics; `runtime_metrics_enabled` — detailed Tools runtime metrics / Local ASR decode counters (default off; avoids high-churn `diagnostics_update` while recognition is active) |
| `updates` | GitHub Releases check (`enabled`, `github_repo`, `check_interval_hours`, `latest_known_version`, …) |

### ASR mode (Kagevi Subtitles 0.6.0)

| `asr.mode` | Status |
| --- | --- |
| `browser_google` | **Active default** — Chrome Web Speech worker |
| `local_parakeet` | Optional Local ASR; Live selector only when `asr.local_module.ready` |

Readiness for `local_parakeet` is a runtime gate (`asr.local_module.ready`), not a config rewrite.

**Removed providers.** `resolve_translation_provider` in `translation_normalize.rs` maps names that no longer ship on the save path (mirrored in `src/lib/config-normalize.ts`):

| Removed | Maps to | Reason |
| --- | --- | --- |
| `mymemory` | `google_translate_v2` (caller fallback) | Anonymous quota of 5,000 chars/day is unusable for live subtitles |
| `public_libretranslate_mirror` | `bing_translator` | All keyless public LibreTranslate instances went offline or now refuse API traffic; the replacement is also keyless, so no API key is suddenly required |
| `microsoft_edge` | `bing_translator` | Microsoft’s anonymous Edge auth/translate path is dead (HTTP 404); Bing remains keyless |

Any other unrecognized provider name falls back to the caller's default provider.

### Profiles

`user-data/profiles/{name}.json` — named snapshots via `/api/profiles/*`.

Each profile stores the dashboard `config.toml` payload **plus** a `modules` object with TTS, Local ASR, VRChat, and SteamVR HUD (`vr_overlay`) `config.toml` snapshots. `POST /api/profiles/{name}` always captures the current module files. `POST /api/profiles/{name}/apply` writes core + modules to disk, broadcasts `ui_config_sync` (theme/locale/font for all windows) and `module_config_sync` (open module UIs reload). `POST /api/settings/reset-defaults` applies the `default` profile and fills any missing module snapshots with factory defaults. Downloaded Local ASR models/ORT are not deleted.

Legacy profiles without `modules` still apply dashboard settings; modules stay as they are unless this is a factory reset.

## 8. HTTP API (local)

**Router:** `crates/voicesub-runtime/src/http/router.rs`  
**Default bind:** `127.0.0.1:8765` (`voicesub-config::paths`)  
**LAN:** `VOICESUB_ALLOW_LAN=1` → bind `0.0.0.0`

**LAN security (OWASP ASVS V7):** with `VOICESUB_ALLOW_LAN=1`, HTTP `/api/*` still requires the per-session `x-kagevi-subtitles-token` (also accepted: `x-kagevi-voice-token`, legacy `x-voicesub-token`), and **non-loopback WebSocket clients must present `loopback_token` (query) or the same session header/cookie**. Loopback peers (OBS on the same PC) keep unauthenticated `/ws/events` + `/ws/asr_worker`. Prefer default `127.0.0.1` + OBS Browser Source on localhost.

Global middleware: CSP header, `Cache-Control: no-store`.

### Health / Version

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/live` | public | Minimal liveness probe (`{"ok":true}`) for OBS overlay |
| GET | `/api/health` | loopback token | Liveness + WS connections + worker connected |
| GET | `/api/version` | loopback token | Product metadata + `sync` (updates config, `update_available`, `latest_known_version`) |

**Loopback API auth:** Tauri UI windows obtain the per-session token via IPC `get_loopback_api_token` and send `x-kagevi-subtitles-token` (also accepted: `x-kagevi-voice-token`, legacy `x-voicesub-token`). App HTML (`/`, `/tts`, `/twitch`, `/local-asr`, `/vrchat`, `/vr-overlay`, `/google-asr`, `/google-asr-compact`) requires a one-time `?bootstrap=<nonce>` (sets HttpOnly cookie `kagevi_loopback`) **or** an already-valid session cookie/header — otherwise **401** (except unauthenticated `/tts`, which serves a minimal Twitch OAuth shell only). `POST /api/twitch/oauth-complete` and alias `POST /api/tts/twitch/oauth-complete` are public (system-browser Twitch redirect bridge — pending token/error only). OBS overlay does **not** call protected `/api/*` (only `/live` + WebSocket).

### Devices / OpenAI helpers

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/devices/audio-inputs` | Empty list (browser ASR uses `getUserMedia`) |
| GET | `/api/openai/recommended-models` | Static recommended models |
| POST | `/api/openai/models` | Live OpenAI-compatible `GET {base}/models` (chat filter for api.openai.com) |
| POST | `/api/openai/usable-models` | Alias |

### Settings / Profiles

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/settings/load` | Config + subtitle presets + font catalog |
| POST | `/api/settings/save` | Merge/save + live apply |
| GET/POST/DELETE | `/api/profiles`, `/api/profiles/{name}` | Profile CRUD (save snapshots core + `modules`) |
| POST | `/api/profiles/{name}/apply` | Persist profile (core + modules) and fan out UI/module sync |
| POST | `/api/settings/reset-defaults` | Apply `default` profile + factory module defaults, persist, fan out |
| POST | `/api/ui/sync` | Debounced UI-only sync → `ui_config_sync` on EventBus (theme/locale/`ui.font_family`/`palette` across dashboard, Web ASR, TTS, Local ASR, VRChat, SteamVR HUD) |
| GET | `/api/ui/sync` | Last live UI presentation (hot theme/preset) or disk `ui` — module windows apply this after `/api/settings/load` so they do not keep a stale saved theme |

### Runtime / OBS

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/runtime/start` | Start session (`config_payload?`) |
| POST | `/api/runtime/stop` | Stop session |
| GET | `/api/runtime/status` | Full runtime snapshot |
| GET | `/api/obs/url` | `{ overlay_url }` |

### Logging / Exports

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/logs/client-event` | Client → `session-latest.jsonl` |
| POST | `/api/logs/ui-trace` | UI render trace → `ui-trace.jsonl` |
| GET | `/api/exports` | List export bundles |
| GET | `/api/exports/diagnostics` | Diagnostics ZIP |

### TTS / Twitch OAuth

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/tts/status` | Subtitle TTS badge (`enabled`, `runtimeActive`, `waitingLive`) |
| GET | `/api/tts/config` | Load TTS config |
| POST | `/api/tts/config/save` | Save TTS config |
| GET | `/api/tts/google` | Google Translate TTS proxy |
| GET | `/api/tts/python` | TTS via embedded Python module |
| GET | `/api/tts/python/status` | Python runtime probe |
| GET | `/api/twitch/status` | Twitch module connection + `speakChat` |
| GET | `/api/twitch/config` | Load Twitch config |
| POST | `/api/twitch/config/save` | Save Twitch config (hot-applies filters/TTS; does not reconnect IRC/EventSub) |
| POST | `/api/twitch/connect` | Connect IRC |
| POST | `/api/twitch/disconnect` | Disconnect IRC |
| POST | `/api/twitch/oauth-open` | Open Twitch OAuth in system browser |
| GET | `/api/twitch/oauth-pending` | Poll pending token **or** OAuth error (`status`: `token` \| `error` \| `none`) |
| POST | `/api/twitch/oauth-complete` | **Public** bridge: store OAuth token **or** browser cancel/deny |
| POST | `/api/tts/twitch/oauth-open` | Alias of `/api/twitch/oauth-open` |
| GET | `/api/tts/twitch/oauth-pending` | Alias of `/api/twitch/oauth-pending` |
| POST | `/api/tts/twitch/oauth-complete` | Alias of `/api/twitch/oauth-complete` (registered redirect still `/tts`) |

### Local ASR (`/api/asr/local/*`)

Protected like other `/api/*`. Full table in [§18 Local ASR Module](#18-local-asr-module). Summary: status/config, deps check/download/delete/probe, model download/select/delete/load/unload, test bench, mic list, transfer progress, driver URL.

### Updates

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/updates/check` | Poll GitHub Releases (forced on dashboard bootstrap); persists `updates.latest_known_version`, `last_checked_utc` |

### HTML pages

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/` | `bin/dashboard/index.html` |
| GET | `/overlay` | `bin/overlay/overlay.html` |
| GET | `/google-asr` | `bin/worker/index.html` (full worker UI) |
| GET | `/google-asr-compact` | `bin/worker/index.html` (compact worker UI; same bundle) |
| GET | `/tts` | `bin/tts/index.html` (unauth = OAuth shell only) |
| GET | `/twitch` | `bin/twitch/index.html` |
| GET | `/local-asr` | `bin/local-asr/index.html` |
| GET | `/vrchat` | `bin/vrchat/index.html` |
| GET | `/vr-overlay` | `bin/vr-overlay/index.html` |
| GET | `/project-fonts.css` | Generated `@font-face` from `bin/fonts/` |

### Static mounts

| URL prefix | Disk path |
| --- | --- |
| `/overlay-assets` | `bin/overlay/` |
| `/static` | `bin/overlay/shared/` (legacy shared assets) |
| `/worker-assets` | `bin/worker/` |
| `/assets` | `bin/dashboard/assets/` |
| `/tts-assets` | `bin/tts/` |
| `/twitch-assets` | `bin/twitch/` |
| `/local-asr-assets` | `bin/local-asr/` |
| `/vrchat-assets` | `bin/vrchat/` |
| `/vr-overlay-assets` | `bin/vr-overlay/` |
| `/project-fonts` | `bin/fonts/` |

`bin/` resolved via `ProjectPaths::locate_bin_dir()` — workspace `bin/` or Tauri NSIS `resources/bin/`.

## 9. WebSocket Surface

**Authentication:** WebSocket from **loopback** stays unauthenticated (OBS overlay + Chrome worker on the same PC). **Non-loopback** clients must pass `loopback_token` query (or session header/cookie). With `VOICESUB_ALLOW_LAN=1` see §8.

### `/ws/events` — OBS overlay (+ optional external clients)

**Implementation:** `crates/voicesub-ws/src/events.rs`

- Client receive-only (inbound text ignored)
- On connect: `hello` (`type: "hello"`, `message: "connected"`)
- Replay last: `runtime_update`, `overlay_update`, `ui_config_sync`
- Bounded per-socket queue (default 128), dedupe by `type`

**Envelope:** `{ "type": "<channel>", "payload": {…} }`  
Payload enrichment: `event_sequence`, `created_at_ms`, `event_type` (`WsEventPublisher`).

| `type` | Transport | Purpose |
| --- | --- | --- |
| `hello` | WS | Handshake |
| `runtime_update` | WS + EventBus | Phase, ASR/worker state, metrics |
| `preflight_update` | WS + EventBus | `{ running: bool }` during start/stop |
| `diagnostics_update` | WS + EventBus | ASR diagnostics snapshot |
| `model_status_update` | WS + EventBus | Model/ASR readiness |
| `transcript_update` | WS + EventBus | ASR partial/final events (sole live ASR text channel since 0.5.4; partials coalesced) |
| `overlay_update` | WS + EventBus | Overlay render body (live + **replay on connect**) |
| `translation_update` | WS + EventBus | Per-sequence translation results |
| `twitch_connection_update` | WS + EventBus | Twitch connection state (also snapshot replay) |
| `ui_config_sync` | WS + EventBus | `{ ui: … }` theme/locale/`font_family` (via `/api/ui/sync`; **replay on connect**) |
| `subtitle_payload_update` | **EventBus / Tauri snapshot only** | Subtitle presentation — **not** published on `/ws/events`; live + WS replay use `overlay_update` |
| `twitch_chat_message` | **EventBus only** | Twitch chat log + chat TTS pipeline — `publish_event_bus_only` (no `/ws/events` fanout) |
| `twitch_channel_event` | **EventBus only** | Twitch channel alerts (follow / sub / resub / gift / raid / cheer) + event TTS — `publish_event_bus_only` |

**Stale guard:** overlay (`overlay.js` + `ws-stale-guard-logic.js`) drops stale events after stop/start (timestamp-first on sequence reset).

### In-process runtime events — Tauri dashboard + TTS (0.5.2+)

**Implementation:** `RuntimeEventBus` (`crates/voicesub-ws/src/event_bus.rs`) + Tauri emit `runtime-event` (`src-tauri/src/lib.rs`).

- Main dashboard (`src/lib/runtime-events.ts`), TTS module (`src-tts/App.svelte`), and Twitch module (`src-twitch/App.svelte`) **do not** open `ws://127.0.0.1:8765/ws/events`; they receive the same `{ type, payload }` envelopes via Tauri events.
- On subscribe: attach `listen(runtime-event)` **first** (buffer live frames), then IPC `get_runtime_state_snapshot`, then drain the buffer so a stale snapshot cannot overwrite newer live events. Dashboard replay prefers `overlay_update` (falls back to `subtitle_payload_update`); TTS replay is scoped to `runtime_update` + `twitch_connection_update` + `ui_config_sync`.
- `WsEventPublisher` mirrors most broadcasts into the EventBus for shell clients; OBS overlay remains WS-only. **Twitch chat** uses `publish_event_bus_only` (no `/ws/events` fanout); connection updates still hit the hub for snapshot replay.

**Legacy:** `src/lib/ws.ts` (`EventsSocket`) for dev/external browser clients; production Tauri shell uses `runtime-events.ts`.

### `/ws/asr_worker` — browser worker

**Implementation:** `crates/voicesub-ws/src/asr_worker.rs`

**Server → worker:**

| `type` | Fields | Purpose |
| --- | --- | --- |
| `hello` | `message: "browser_asr_worker_connected"`, `transport_id` | Handshake |
| `browser_asr_control` | `action`, `reason?`, `issued_at_ms`, `transport_id` | Control (e.g. `stop`) |

**Worker → server:**

| `type` | Handler |
| --- | --- |
| `external_asr_update` | ASR text ingest (partial/final, generation guards) |
| `browser_asr_status` | Worker state snapshot |
| `browser_asr_heartbeat` | Same as status |
| `hello` | Recognized, no special handling |

## 10. Tauri IPC

**Registration:** `src-tauri/src/lib.rs` → `tauri::generate_handler!`

**Capabilities (per window):** `src-tauri/capabilities/default.json` (main — shell-only `allow-voicesub-ipc`), `tts.json` (`allow-voicesub-tts-ipc`), `twitch.json` (`allow-voicesub-twitch-ipc`), `local-asr.json` (`allow-voicesub-local-asr-ipc`), `vrchat.json` (`allow-voicesub-vrchat-ipc`), `vr-overlay.json` (`allow-voicesub-vr-overlay-ipc`). `get_loopback_api_token` is allowlisted on all of them. All capabilities deny frontend `core:event` emit / emit-to (listen only). ACL matrix guarded by `src-tauri/src/acl_matrix.rs` tests.

### Shell commands (`main` only)

| Command | Purpose |
| --- | --- |
| `get_loopback_api_token` | Per-session token for protected `/api/*` (Tauri windows; HTML must not embed the token) |
| `get_runtime_state_snapshot` | Replay runtime/subtitle/overlay/translation/diagnostics for Tauri shell on connect |
| `set_dashboard_layout` | Compact (390×844) vs standard (1280×900) window |
| `tts_open_window` | Open/focus `/tts` webview |
| `twitch_open_window` | Open/focus `/twitch` webview |
| `local_asr_open_window` | Open/focus `/local-asr` webview |
| `vrchat_open_window` | Open/focus `/vrchat` webview |
| `vr_overlay_open_window` | Open/focus `/vr-overlay` webview |
| `open_external_https_url` | Open allowlisted HTTPS URL in system browser (update banner, translation provider setup, Credits donate link) |
| `open_local_http_url` | Open validated loopback HTTP URL in system browser |

### TTS and Twitch windows

Webview ACL: `get_loopback_api_token` + `get_runtime_state_snapshot` only. Open/focus are **main**-shell commands (`tts_open_window`, `twitch_open_window`). Module domain logic lives in `RuntimeService` (`voicesub-tts` / `voicesub-twitch`) + HTTP `/api/tts/*` and `/api/twitch/*`. Closing the **window** always **destroys** the WebView2 (Chromium RAM). Enable-without-window is the Rust service: subtitle speech / IRC / chat TTS keep running **only while the module stays enabled**. A disabled module plus a closed window must not leave a hidden webview.

### Local ASR window (`local-asr` capability)

Webview ACL: `get_loopback_api_token` + `open_external_https_url` only. Window open/focus is a **main**-shell command (`local_asr_open_window`). Module domain logic stays in `voicesub-asr-local` + HTTP.

### VRChat and SteamVR HUD windows

Webview ACL: `get_loopback_api_token` only. Open/focus are **main**-shell commands (`vrchat_open_window`, `vr_overlay_open_window`). Domain logic stays in `voicesub-vrchat` / `voicesub-vr-overlay` + HTTP. Windows receive `ui_config_sync`, `runtime_update`, `module_config_sync`; live `overlay_update` / `transcript_update` are **not** duplicated to them. Closing the window **destroys** the WebView2; OSC / OpenVR continue only while the matching HUD/output stays enabled.

### `src-tauri/` modules (shell only)

| File | Role |
| --- | --- |
| `lib.rs` | Tauri setup, HTTP runtime bootstrap, IPC registration, EventBus pump |
| `shell.rs` | Allowlisted `open_external_https_url` / `open_local_http_url` |
| `event_routing.rs` | Per-window `runtime-event` type filters + snapshot replay envelopes |
| `ipc_pump.rs` | Bus→IPC pump: overlay coalescing (dashboard only), lag-resync debounce, skip closed module windows |
| `module_windows.rs` | Module webview labels + close/destroy policy (WebView RAM vs enable-without-window) |
| `webview_memory.rs` | WebView2 suspend/memory policy (`WebviewMemoryManager`) |
| `dashboard_nav.rs` | Main webview URL helpers |
| `webview2_gate.rs` | WebView2 runtime presence check before window create |
| `tts.rs` | TTS window open/focus only |
| `twitch.rs` | Twitch window open/focus only |
| `local_asr.rs` | Local ASR window open/focus only |
| `vrchat.rs` | VRChat module window open/focus only |
| `vr_overlay.rs` | SteamVR HUD module window open/focus only |
| `acl_matrix.rs` | Capability ACL matrix tests |

**Tauri events (shell clients):** `runtime-event` (WS-shaped envelopes), `tts-speech-activity` / `playback-finished` — **`emit_to(tts)` only** (not global `emit`).

**`runtime-event` routing (per window):** the bus→IPC pump (`src-tauri/src/ipc_pump.rs`, filters in `event_routing.rs`) emits with `emit_to(label, …)`, not a global `emit`. The **main** dashboard window receives every envelope; the **tts** window receives `runtime_update`, `runtime_status`, `ui_config_sync`, `module_config_sync` (no `twitch_*`); the **twitch** window receives `twitch_chat_message`, `twitch_channel_event`, `twitch_connection_update`, `runtime_update`, `ui_config_sync`, `module_config_sync`; the **local-asr** window receives only `ui_config_sync` for live theme/locale/font sync without Save; **vrchat** and **vr-overlay** windows receive `ui_config_sync`, `runtime_update`, and `module_config_sync` only. The Local ASR, TTS, Twitch, VRChat, and SteamVR HUD module UIs must **not** open `/ws/events` for UI sync (BroadcastChannel + Tauri IPC only) — a WS client would still receive full-rate overlay/runtime frames. `setLocale` is idempotent so locale-changed / BroadcastChannel handlers cannot feedback-spin. This keeps the high-frequency `transcript_update` / `overlay_update` stream off module webview IPC channels. Payloads are forwarded by reference (no per-event deep clone). **`overlay_update` IPC to the main dashboard is trailing-edge coalesced** (default 90 ms, env `VOICESUB_OVERLAY_IPC_MIN_INTERVAL_MS`); OBS `/ws/events` still receives every frame. `runtime_update` / `translation_update` flush any pending coalesced overlay immediately. On `broadcast::RecvError::Lagged`, the pump records metrics (`event_bus_consumer_lagged_*`), queues a pending snapshot resync (never drops the last needed sync; 200 ms coalesce between follow-ups), then re-emits envelopes (`snapshot_to_envelopes` — overlay preferred over raw subtitle).

**Partial coalescing:** `transcript_update` partials are leading-edge throttled in `TranscriptController` (default 90 ms, env `VOICESUB_TRANSCRIPT_PARTIAL_MIN_INTERVAL_MS`; new phrase/`sequence` and all finals bypass). Subtitle lifecycle and WS `overlay_update` still see every partial; ingest applies subtitle state **before** async transcript fanout. Only the redundant transcript IPC/WS channel is rate-limited.

**Transcript text formatting (`transcript_format`):** rule-based layer in `voicesub-transcript-text` is **disabled and hidden** in the dashboard (More hub / command palette). Config normalize and runtime settings force `enabled = false` so legacy configs cannot activate it. Pipeline code remains for a future re-enable.

**Word replacement (`source_text_replacement`):** custom pairs plus optional builtin profanity/stems (`voicesub-twitch::source_text_replacement`, applied in `TranscriptController`). Builtin Latin/Cyrillic literals always require Unicode word boundaries even when `whole_words` is false (that flag only gates custom pairs and still allows CJK substring policies). Stem matching uses overlapping AC + leftmost-longest among *accepted* hits, with context guards for ambiguous RU roots (`ебл` in `потреблять`, `блят` in `оскорблять`). Empty / `***` target and builtin hits use first+last-letter mask (`fuck`→`f**k`, `whore`→`w***e`); matched spans that already contain `*` are left alone. Twitch chat TTS uses the same mask via `include_builtin_profanity` (pairs are not shared with the dashboard list).

**Lifecycle:** main webview is created hidden, then `navigate()` to `http://{bind_addr}/?bootstrap=…` (Tauri `devUrl` is public `/live` so CLI/webview probes do not 401 on gated `/`); on close → TTS shutdown → runtime stop. `RunEvent::Exit` also marks `session-lifecycle.json` graceful so Ctrl+C / process exit do not leave a stale `running` marker.

## 11. Logs, Diagnostics, Export

**Directory:** `{project_root}/logs/`

### Backbone (always)

| File | Purpose |
| --- | --- |
| `core.log` | `tracing` backbone (+ stderr); rotate → `core.old.log` on startup |
| `runtime-events.log` | Compact structured events (5 MB rotation) |
| `session-latest.jsonl` | Client events from `/api/logs/client-event` (max 5000 lines) |

### Opt-in JSONL traces

Master switch: `logging.full_enabled` in config **or** `VOICESUB_DEEP_DIAGNOSTICS`.

| File | Enable env |
| --- | --- |
| `subtitle-trace.jsonl` | `VOICESUB_TRACE_SUBTITLE` |
| `tts-trace.jsonl` | `VOICESUB_TRACE_TTS` |
| `browser-trace.jsonl` | `VOICESUB_TRACE_BROWSER` |
| `obs-trace.jsonl` | `VOICESUB_TRACE_OBS` |
| `ui-trace.jsonl` | `VOICESUB_TRACE_UI` |
| `ws-trace.jsonl` | `VOICESUB_TRACE_WS` |
| `pipeline-trace.jsonl` | `VOICESUB_TRACE_PIPELINE` |
| `session-lifecycle.json` | always (session marker); shutdown/panic steps also in `pipeline-trace.jsonl` when deep diagnostics on |

### Timestamp field formats (0.5.4+)

Several log and subtitle lifecycle fields that previously held **Unix epoch seconds as strings** now use **RFC 3339 UTC** strings (e.g. `2026-06-21T07:01:00Z`). Payload **keys are unchanged**; only the value format changed.

| Field | Where | Notes |
| --- | --- | --- |
| `timestamp_utc` | `session-latest.jsonl`, deep JSONL traces (`session.rs`, `jsonl_trace.rs`) | External tooling should accept both formats during transition |
| `finalized_at_utc`, `completed_expires_at_utc` | Subtitle lifecycle payload (`voicesub-subtitle/lifecycle.rs`) | Not parsed as numbers by overlay or dashboard render paths |

Helpers: `voicesub_types::utc_now_rfc3339()`, `epoch_secs_to_rfc3339()`.

With deep diagnostics, `pipeline-trace.jsonl` ASR ingest records may include `ingest_latency_ms` (`trace.rs` + `transcript_controller.rs`).

Disable: same vars `=0` / `false`.  
Verbose runtime-events: `VOICESUB_TRACE_RUNTIME_EVENTS_VERBOSE`.

With `logging.full_enabled`, close steps (`shutdown_begin`, `shutdown_step`, `shutdown_complete`) go to `core.log` (`voicesub.lifecycle`) and `pipeline-trace.jsonl`. `session-lifecycle.json` is always updated: `running` → `graceful` or `panic`. If the next start still finds `running` and the previous PID is dead, `core.log` records `previous session exited without graceful shutdown` at **info** (cargo tauri dev / Ctrl+C / Task Manager). WARN only if that PID is still alive.

### Other env vars

| Variable | Purpose |
| --- | --- |
| `VOICESUB_ALLOW_LAN` | Bind `0.0.0.0` |
| `VOICESUB_TRANSCRIPT_PARTIAL_MIN_INTERVAL_MS` | Min interval for partial `transcript_update` IPC/WS (default **90**; `0` = no coalescing; does not affect `overlay_update`) |
| `VOICESUB_OVERLAY_IPC_MIN_INTERVAL_MS` | Trailing-edge coalesce for dashboard `overlay_update` IPC only (default **90**; **`0`** = disabled; OBS WS unaffected) |
| `VOICESUB_BROWSER_AFFINITY` | Enable CPU affinity for browser worker (`1` / `true`) |
| `VOICESUB_BROWSER_AFFINITY_MASK` | Hex CPU affinity mask override |
| `VOICESUB_BROWSER_AFFINITY_EXCLUDE_LOW` | Exclude low-power cores from affinity mask (`1` default) |
| `RUST_LOG` | `tracing` filter override |
| `VOICESUB_TTS_PER_PROCESS_ROUTING` | WinAPI TTS audio routing |
| `VOICESUB_TTS_ALLOW_SYSTEM_PYTHON` | Allow system Python for TTS fetcher |

### Diagnostics ZIP

`GET /api/exports/diagnostics` bundles: `runtime_status.json`, `config_redacted.json`, `environment.txt`, `latest_session.jsonl`, `core.log`, `runtime-events.log` (plus deep JSONL traces when `logging.full_enabled`).

ZIP files are written under `user-data/exports/` as `diagnostics-{unix}_{ms}.zip`. The exporter keeps the newest **12** diagnostics ZIPs and deletes older ones.

## 12. Browser Speech Worker

### URL and launch

| Constant | Value |
| --- | --- |
| `WORKER_PATH` | `/google-asr` |
| `WORKER_COMPACT_PATH` | `/google-asr-compact` |
| Launch URL (full) | `{base}/google-asr?autostart=1[&locale={ui.language}]` |
| Launch URL (compact) | `{base}/google-asr-compact?autostart=1[&locale={ui.language}]` when `asr.browser.compact_worker_ui = true` |

`worker_launch_browser`: `auto` | `google_chrome` (unknown → `auto`).

`asr.browser.compact_worker_ui` (bool, default `false`): Live-tab checkbox; selects compact page + Chrome `--app=` launch.

### Chrome launch invariants

- **Full worker** (`/google-asr`): **separate** Chrome window with **visible address bar** (`--new-window` + trailing URL)
- **Compact worker** (`/google-asr-compact`): Chrome **`--app=<url>`** (no omnibox), `--window-size=420,720`; never `--new-window` for this path
- Isolated `--user-data-dir`: `{user-data}/browser-worker-profile-classic-{engine}/`
- **Never** `--disable-extensions` / `--bwsi`. Stored config never keeps `--app=` (stripped); `--app=` is applied only at launch for compact URLs
- **No** hidden windows or in-tab worker
- Anti-throttling Chrome flags + Windows EcoQoS opt-out (`launch_config.rs`, `ecoqos.rs`): occlusion/backgrounding switches, `IntensiveWakeUpThrottling` + `AllowAggressiveThrottlingWithWebSocket` + `BatterySaverModeAvailable` disabled, `--disable-field-trial-config`, `--audio-process-high-priority`, `--hide-crash-restore-bubble`
- Detached process at **`ABOVE_NORMAL_PRIORITY_CLASS`** when `use_high_priority` (default true): keeps ASR responsive without `HIGH_PRIORITY_CLASS` preempting foreground apps and starving the rest of the system. Falls back to normal priority on `ERROR_ACCESS_DENIED`. Stop via `taskkill /T /F` (only when real `pid > 0`)
- **Orphan reaping (`orphan_guard.rs`):** the live worker PID is persisted to `user-data/browser-worker.pid` on launch and cleared after a successful kill. `RuntimeService::start` reaps a leftover worker from a previous *crashed* session — but only if the persisted PID still maps to `chrome.exe`. Failed kills keep the PID file for retry.
- **Launch stability (0.5.2+):** `launch_stability.rs` (flag profile), `profile_bloat_guard.rs` (profile dir hygiene + clear `exit_type`/`exited_cleanly` before spawn so force-kill does not show Chrome’s “Restore pages?” bubble; launch also includes `--hide-crash-restore-bubble`), `process_affinity.rs` (opt-in Windows CPU affinity via `VOICESUB_BROWSER_AFFINITY`); contract tests in `crates/voicesub-browser/tests/chrome_launch_contract.rs`

### Test harness (no Chrome spawn)

- `voicesub-browser::browser_worker_launch_skipped()` — `cfg(test)` in crate unit tests + env `VOICESUB_SKIP_BROWSER_WORKER=1`
- Integration tests (`voicesub-http/tests/`, `voicesub-runtime/tests/`) set skip in `integration_lock()` — dependencies build **without** `cfg(test)`
- Stub launch: `pid: 0`, `worker_pid = None`; optional `VOICESUB_FORCE_BROWSER_WORKER=1` for manual verification

### Worker frontend (`src-worker/`)

| Module | Role |
| --- | --- |
| `worker-controller.ts` | Autostart, recognition lifecycle |
| `socket-bridge.ts` | `/ws/asr_worker` connect, `browser_asr_control` |
| `session-manager.ts` | Session age, reconnect, watchdog |
| `long-segment-flush-logic.ts` | Post-monologue Web Speech buffer flush (≥450 chars) |
| `web-speech-policy.ts` | Strip on-device hints, overlap policy |

**Worker UI defaults:** lang `ru-RU`, interim/continuous on, force-finalization idle **1600 ms** (worker settings panel), max session age **180 s**.

**Silence rearm (native continuous only):** with `continuous=true`, Chrome often waits ~8 s of silence before `no-speech`. The watchdog cycles recognition after **9000 ms** without start/result during the **current** mic-hot streak (`activeSpeechStallMs` / `web_speech_stalled`; cold-start **4.5 s**). A long pause then new speech does **not** immediately rearm — the stall clock starts when the mic becomes hot again. Overlap / `continuous=false` does **not** use this path (own silence rearm). `no_speech` restart delay is fixed (`no_speech_restart_delay_ms`, default 150) without accumulating +800 ms backoff. `network` / `audio_capture` restart delay is also fixed (`network_reconnect_initial_ms`, default 500) — no exponential growth.

**Visible idle rearm (all modes):** if the worker window is visible, the mic is quiet, and there is no transcript activity (`lastStartAtMs` / `lastResultAtMs`) for **30 s** (`visibleIdleRestartMs`; hidden window **60 s`), the watchdog force-rearms recognition (`watchdog forced rearm`). Separate from active-speech stall (**9 s** with mic energy).

**Overlap (dual-buffer):** with `continuous=false`, two `SpeechRecognition` slots alternate: **`preStartNextInstance`** on natural/forced final (immediate buddy `start()` while active lives); **`switchToNextInstance`** on active `onend` when the buddy is listening/warming; **`safeRestartRecognition`** (~50 ms in-generation flip+start) when no buddy is ready. Idle slots are recreated before `start()`. **Do not** early-warm buddy on active `onstart` — a second simultaneous `SpeechRecognition` makes Chrome abort/chop the active session (observed thrash: ~1–2 s slot flips, flood of `duplicate-partial`). Buddy hypotheses are **shadowed** until handoff. Hard errors (`network`, `audio_capture`) still force a global restart. **Phrase coalesce:** soft-join under one `client_segment_id` (~1.8 s quiet **and mic quiet**, or ≥450 chars). **Silence rearm:** slot with no ASR results since start — **8 s** quiet / **3 s** only after the **current** mic-hot streak has lasted 3 s without ASR (not merely “mic is hot now” after a pause); stale soft-join `currentPartial` does not block. **Buddy shadow:** flushed on handoff against 1–2 s stalls.

### Long-segment flush (Web Speech buffer)

After a **committed** segment (natural or forced final) whose peak partial or final text reaches **≥450 characters**, the worker clears a bloated in-session `SpeechRecognition.results` buffer that otherwise causes the **next** utterances to finalize as many short fragments (observable in `pipeline-trace.jsonl` as rapid `asr_ingest_final_published` with small `text_len`).

| Mode | Action |
| --- | --- |
| `native_continuous` (`continuous=true`, default) | `requestRecognitionFlush` → `recognition.stop()` → restart with reason `long_segment_flush` (~100 ms delay) |
| Overlap (`continuous=false`) | `preStartNextOverlapInstance` then `stop()` on the **active** slot → handoff to warming buddy |

**Not configurable** (hardcoded threshold `DEFAULT_LONG_SEGMENT_FLUSH_MIN_CHARS = 450` in `long-segment-flush-logic.ts`). State: `currentSegmentPeakPartialChars`, counter `longSegmentFlushCount`. Does **not** replace session-age rotation (`max_browser_session_age_ms`) or idle forced-final (`force_finalization_timeout_ms`). Native continuous stall: `web_speech_stalled` / `active_speech_stall` after **9 s** without ASR results during the current mic-hot streak; if a partial exists the watchdog **commits** it without restart (avoids multi-second gaps); empty stall rearms via `stop()` (`watchdog_stall`, ~100 ms).

### Advanced Web Speech settings (dashboard)

**UI:** Settings → More → Recognition → «Advanced Web Speech settings» (`WebSpeechAdvancedSettings.svelte`). Each numeric field has an **`!` help button** (`FieldHelpButton.svelte`) with a localized description (en, ru, ja, ko, zh); click opens a popover, hover shows `title`.

**Config mapping:**

| UI section | Config path | Runtime |
| --- | --- | --- |
| Forced-final thresholds | `asr.browser.force_final_min_*` | Browser worker (`transcript-logic.ts`) |
| Restart & recovery | `asr.browser.*_restart_delay_ms`, `minimum_reconnect_interval_ms`, `stuck_stopping_timeout_ms` | Worker session manager |
| Network reconnect | `asr.browser.network_reconnect_*` | Worker fixed restart delay (`network` / `audio_capture`) |
| Session rotation | `asr.browser.max_browser_session_age_ms`, `prepare_cycle_before_ms` | Worker session cycle |
| Partial filtering (UI) | `asr.realtime.partial_min_delta_chars`, `partial_coalescing_ms` | Stored + shown in browser ASR **diagnostics**; **not** applied on browser ingest (`browser_event_builder` skips `should_emit`). Live Local ASR uses module `realtime` in `user-data/modules/local-asr/config.toml` via `voicesub-partial-emit` |

**Canonical defaults** (single source `src/lib/webspeech-advanced-defaults.ts`, mirrored in `defaults.rs`, `config-normalize.ts`, `worker-defaults.ts`):

| Key | Default |
| --- | ---: |
| `force_final_min_chars` | 8 |
| `force_final_min_stable_ms` | 750 |
| `minimum_reconnect_interval_ms` | 500 |
| `normal_restart_delay_ms` | 150 |
| `no_speech_restart_delay_ms` | 150 |
| `stuck_stopping_timeout_ms` | 2000 |
| `network_reconnect_initial_ms` | 500 |
| `network_reconnect_max_ms` | 30000 (legacy; unused — retries stay at `network_reconnect_initial_ms`) |
| `max_browser_session_age_ms` | 180000 |
| `prepare_cycle_before_ms` | 30000 |
| `partial_min_delta_chars` | 0 |
| `partial_coalescing_ms` | 0 |

**Not in this panel:** `asr.browser.force_finalization_timeout_ms` — forced-final **idle** timeout; edited in the **Web Speech worker window** UI. Reopen the worker after changing advanced lifecycle keys.

## 13. Translation: Lifecycle and Invariants

**Crate:** `voicesub-translation`  
**Entry:** `TranslationDispatcher` (`dispatcher.rs`)

### Providers (17)

`SUPPORTED_PROVIDERS` in `providers/mod.rs`:

| ID | Group |
| --- | --- |
| `google_translate_v2` | API (default) |
| `google_cloud_translation_v3` | API |
| `azure_translator` | API |
| `deepl` | API |
| `libretranslate` | API/self-hosted |
| `openai` | llm |
| `openrouter` | llm |
| `lm_studio` | local_llm |
| `ollama` | local_llm |
| `baidu_translate` | china (free-tier quota) |
| `youdao_translate` | china (free-tier quota) |
| `tencent_tmt` | china (free-tier quota) |
| `caiyun_translator` | china (zh/en/ja) |
| `google_gas_url` | experimental |
| `google_web` | experimental |
| `bing_translator` | experimental (keyless) |
| `free_web_translate` | experimental (keyless) |

Provider notes: DeepL maps UI codes (`en`/`zh-cn`/`pt`) to API targets and picks Free vs Pro URL from the key (`:fx` → free) unless a custom `api_url` is set. Google v3 short model ids expand to full resource names. Azure prefers `zh-Hans`/`zh-Hant`; LibreTranslate maps Chinese to `zh`/`zt`. China providers: Baidu / Youdao / Tencent use free monthly quotas after console registration; Caiyun supports zh/en/ja only.

**Keyless providers.** Three providers need no API key and are the free path for users without accounts. They are deliberately on **independent hosts** so a throttle or block on one does not take out the others:

| ID | Endpoint | Notes |
| --- | --- | --- |
| `google_web` | `translate-pa.googleapis.com/v1/translateHtml` | Google Translate Element (`te_lib`) path. POST JSON+protobuf with the public widget key; HTML-escape inbound, unescape outbound. Replaced `translate_a/single?client=gtx` after that host started 429/`sorry`-walling many IPs |
| `free_web_translate` | `clients5.google.com/translate_a/t?client=dict-chrome-ex` | Chrome-extension dictionary path; separate throttle bucket from `google_web`. `sl=auto` answers `[[text, lang]]`, an explicit `sl` answers `[text]` — both shapes are parsed |
| `bing_translator` | `bing.com/translator` → `ttranslatev3` | Keyless Bing Translator web session. Scrapes IG/IID + AbusePreventionHelper token (TTL from page, minus skew); concurrent partials share one bootstrap mutex. Target codes reuse `azure_lang`; `fromLang=auto-detect` for auto |

`microsoft_edge` was **removed**: Microsoft’s anonymous Edge auth/translate path (`edge.microsoft.com/translate/auth` → `api-edge.cognitive.microsofttranslator.com`) is dead (HTTP 404). Existing configs migrate to `bing_translator` — see *Removed providers* above. `public_libretranslate_mirror` was already removed (every keyless public LibreTranslate instance is offline or refuses API traffic); those configs now also map to `bing_translator`.

Up to **4 translation lines** (`translation_1`…`translation_4`). Test stub `stub` — not in production registry.

### Optional live-partial MT (opt-in)

Config `translation.live_partial` (default **off**):

| Key | Default | Role |
| --- | --- | --- |
| `enabled` | `false` | Translate throttled ASR partials, not only finals |
| `min_interval_ms` | `400` | Coalesce window between live jobs |
| `min_delta_chars` | `6` | Used when `word_growth = false` (default) |
| `word_growth` | `false` | When true, require new words (misses mid-word ASR growth) |

Semantics: incremental **full-text** HTTP `translate()` on growing ASR text (Google/DeepL-style typing), **not** LLM token streams.

- Capability `ProviderInfo.supports_live_partial`: **true** for classic MT / china / experimental web; **false** for `llm` / `local_llm` (`openai`, `openrouter`, `lm_studio`, `ollama`). Mixed lines: only eligible slots get partial jobs; LLM slots wait for final.
- Path: `TranscriptController` → `LivePartialGate` → `submit_partial` → dispatcher `JobKind::Partial` → `TranslationEvent.is_live_partial = true`.
- Gate defaults: **char_delta** (`word_growth = false`), `min_interval_ms = 400`, strict cumulative `min_delta_chars` (default 6) for **leading-edge** mid-speech submits, and one replaceable trailing timer. ASR corrections (including shorter hypotheses) are eligible after the coalesce window. **Below-delta** growth still arms the trailing flush so quiet gaps / slow ASR updates keep the live draft moving instead of waiting for final.
- When `translation.live_partial.enabled`, presentation **ignores** `subtitle_lifecycle.keep_completed_translation_during_active_partial`: previous-phrase completed MT is never painted onto a new active partial (source-only until the first live draft, then live drafts only).
- Dispatcher is segment-scoped **single-flight/latest-pending**: one already-started HTTP request may complete so continuous speech cannot starve the display; queued revisions collapse to the newest. Finals cancel only older **final** jobs (not in-flight live drafts), drop queued previews, and keep queue priority. Partials do not retry.
- Live drafts use an isolated bounded **memory-only** LRU. An exact final-text hit is promoted into the persistent final cache; ephemeral churn cannot evict or leak into persistent entries.
- Rendering: `composeRenderRows` takes the `partial_only` source-only shortcut **only** when the payload has no translation row; with live-partial rows it renders source (transient) + drafts. `bin/overlay/overlay.js` keeps `partial_only` rows in `livePartialItems` (separate from `completedItems`) and still reports `completed_block_visible: false`.
- Presentation: per-slot merge of live draft over completed uses ASR-revision hysteresis (not language-dependent target character counts). A completed in-flight draft may lag the current source revision, but per-slot source-sequence ordering prevents regression and segment lineage rejects a previous phrase. On ASR **final**, last drafts are carried as explicitly non-final entries until authoritative final MT replaces them (avoids a blank translation gap without satisfying final bookkeeping).
- TTS / OBS closed captions use **final** translations only (lifecycle `completed_*`); live drafts are overlay/dashboard only.
- Metrics: `translation_live_partial_submitted`, `translation_live_partial_superseded`.
- Full logging (`logging.full_enabled` / `VOICESUB_DEEP_DIAGNOSTICS`): pipeline-trace events `live_partial_asr_seen`, `live_partial_gate`, `live_partial_enqueued`, `live_partial_final_submit`, plus dispatcher `live_partial_line_published` / `translation_final_cache_hit` and subtitle `live_partial_draft_applied`.

### Critical lifecycle invariant (non-negotiable)

- Completed subtitle block **stays on screen** until a **new** phrase is finalized
- Late translations **allowed** (no wall-clock stale drop on browser path)
- Preview lineage by `segment_id`; queued revisions are superseded by generation
- One in-flight partial per segment may complete; only monotonically newer drafts for the active segment are presented
- Persistent cache under `user-data/translation-cache/` survives restart when settings are unchanged (first `apply_live_settings` does not wipe disk)
- Per-request HTTP timeouts honor `timeout_ms` (client ceiling 300s); local LLM providers (`lm_studio` / `ollama`) use a ≥120s floor so JIT model load is not aborted; provider concurrency limits refresh on live settings apply
- Default `translation.provider_limits` for keyless web providers (`google_web`, `free_web_translate`, `bing_translator`): factory install writes `min_interval_ms` 750/750/500. Runtime applies the same built-in **interval** when a live config omits the provider (empty `provider_limits` is **not** rewritten on load/save). There is **no** built-in `max_concurrent_targets` — global `translation.max_concurrent_jobs` remains the shared parallel-job cap; a per-provider concurrent value is an optional extra cap. User overrides merge per field. HTTP 429 retries use longer backoff (1.5s base, 8s cap) within the line `timeout_ms` budget. Dashboard Settings shows both layers in the dispatcher section.

## 14. Subtitle Lifecycle and Presentation

**Crate:** `voicesub-subtitle`

| Component | File | Role |
| --- | --- | --- |
| `SubtitleLifecycleCore` | `lifecycle.rs` | FSM, TTL, relevance, expiry scheduling |
| `SubtitleRouter` | `router.rs` | Transcript + translation → presentation events |
| `SubtitlePresentation` | `presentation.rs` | Payload assembly |
| Overlay contract | `tests/overlay_contract.rs` | Golden regression |

**Config keys (`subtitle_lifecycle`):**

- `completed_block_ttl_ms` (default 4500, min 500)
- `completed_source_ttl_ms`, `completed_translation_ttl_ms`
- sync flags (`allow_early_replace_on_next_final`, `sync_source_and_translation_expiry`, `keep_completed_translation_during_active_partial`)

**Deprecated (normalized on load only; no runtime effect):**

- `subtitle_lifecycle.pause_to_finalize_ms` ↔ `asr.realtime.finalization_hold_ms` — use `asr.browser.force_finalization_timeout_ms` (worker UI) for forced-final idle timing
- `subtitle_lifecycle.hard_max_phrase_ms` ↔ `asr.realtime.max_segment_ms` — legacy; no active replacement

**Router actor** (`router_actor.rs`) — async publish path; live fanout is `overlay_update` only (`OverlayBroadcaster` dedupe). TTS and snapshot still receive the same presentation payload from the router callback. Overlay payloads may include `completed_sequence` when `lifecycle_state` is `completed_with_partial` (active partial uses `sequence`; completed block uses `completed_sequence` for TTS dedupe).

## 15. Subtitle Styles and Overlay

### Backend config

Subtitle style presets loaded via `/api/settings/load` together with config (built-in catalog from `crates/voicesub-config/data/builtin_style_presets.json` via `include_str!`; legacy `beat_saber` migrates to `streamer_bold`). Font catalog from `bin/fonts/` + `project-fonts.css` (creative + dramatic/anime-title faces across Latin / Cyrillic / JP / CN / KR — e.g. Dela Gothic One, Rampart One, Metal Mania, Black Ops One, Stalinist One, Yeon Sung, Zhi Mang Xing). Dashboard `FontFamilyPicker` renders each list row in its own typeface; alphabet tags use **native scripts** (`Latin`, `Кириллица`, `日本語`, `中文`, `한국어`) and do not follow UI locale. Presets that already had Cyrillic stacks include matching CJK fallbacks. Style slots are `source` + `translation_1`…`translation_4` only (`inferStyleSlot` clamp 1…4).

### Overlay presets

`overlay.preset`: `single` | `dual-line` | `stacked`  
`overlay.compact`: `bool` — tighter gaps / slightly smaller scale (independent of preset).  
`overlay.fit_to_box`: `bool` (default **true**) — keep designed font size and scroll overflow inside the OBS Browser Source.
`overlay.scroll_speed_px_per_sec`: `number` (default **48**, clamped **12–120**) — vertical overflow crawl speed when `fit_to_box` is on.

| Preset | Row grouping |
| --- | --- |
| `single` | All visible items share one physical row (left→right in display order) |
| `dual-line` | First visible item on the top row; remaining items share the second row |
| `stacked` | Each visible item gets its own row |

Legacy `preset=compact` (config or `?preset=compact`) normalizes to `preset=stacked` + `compact=true`.  
Query param override: `?preset=…&compact=1&profile=…&debug=…&fit=0`

### Fit-to-box (OBS Browser Source)

`overlay.fit_to_box` (default **true**; Subtitles **Subtitle scrolling** checkbox). Captions sit on the **top** of the Browser Source and grow **downward**. Text wraps at designed font sizes. Each physical line (source + up to 4 translations, `single` / `dual-line` / `stacked`) that is taller than its share of the box **scrolls on its own** (`translateY(--overlay-scroll-y)` on `.subtitle-line__content`): pause on the latest wrapped text, crawl up, pause, crawl back. Speed is `overlay.scroll_speed_px_per_sec` (default 48). Short lines keep their natural height; leftover space goes to overflowing lines. Dashboard preview does **not** scroll (`overlay: false`). `ResizeObserver` + `document.fonts.ready` recompute overflow without a new payload. `?fit=0` / `?fit=1` override the checkbox for a single Browser Source. Unchecked `fit_to_box` still top-aligns and clips the bottom (no per-line scroll).

### Shared renderer

`bin/overlay/shared/js/subtitle-style/` (`index.js` + modules) — fast/slow path invariants. Dashboard preview uses the same payload **shape** via Tauri `runtime-event` / snapshot (not `/ws/events` in the production shell; not necessarily the same JS file).

### OBS overlay URL (Kagevi Subtitles 0.5.0)

```
http://127.0.0.1:8765/overlay
```

**Query-param backward compatibility with older products is not guaranteed.** Users update OBS Browser Source manually when overlay URL or params change.

### Empty-state cleanup (caller responsibility)

After fast-path optimizations the renderer keeps DOM/state across frames. Shape-equal fast-path frames still refresh **stage/row layout CSS** (`--subtitle-text-align`, `--subtitle-justify`, `--subtitle-line-gap`) so idle dashboard preview picks up alignment / line-gap edits without a full reload. On an empty payload (TTL expiry, Stop, `lifecycle_state: idle`) the caller **must** call `disposeRenderContainer`:

| Surface | Caller |
| --- | --- |
| Dashboard preview | `src/lib/components/SubtitleOutputPreview.svelte` |
| OBS overlay | `bin/overlay/overlay.js` — after `render()`, when `result?.empty` |

Without cleanup the last subtitle frame can stick in OBS. Contract: `crates/voicesub-subtitle/tests/overlay_contract.rs` → `overlay_disposes_renderer_when_payload_is_empty`.

## 16. OBS Closed Captions

**Crate:** `voicesub-obs`  
**Config:** `obs_closed_captions` in config

- OBS WebSocket v5 client (`host`, `port`, `password`)
- `output_mode`: `disabled` | `source_live` | `source_final_only` | `translation_1`…`translation_4` | `first_visible_line` (`translation_N` matches Translation line `slot_id`, not the Nth visible translation)
- `debug_mirror` — optional OBS Text Source mirror (`SetInputSettings`)
- `timing` — partial throttle, final replace delay, clear after ms, dedup; `send_partials` (source_live); optional `send_translation_partials` (default off) for live MT drafts on `translation_N`; `max_partial_caption_chars` (default **80**, `0` = unlimited) trailing **word** window for realtime partials (longest trailing whitespace-separated words that fit the budget). A completed final that follows live growth for the same phrase uses the same window so OBS CC does not dump the full phrase after scrolled partials; finals with no prior partial stay unclipped. Delayed clear/final-replace sleeps are interruptible — the next source partial or translation draft bumps generation and unblocks the worker immediately.
- Two inputs: ASR **source events** (`source_live` / `source_final_only`) and **subtitle payload** (`translation_*`, `first_visible_line`, debug mirror)
- Translation live partials: when `send_translation_partials` is on, growing `is_live_draft` text for the selected slot is throttled like source_live; completed non-draft finals still send (fallback for LLM / providers without live partials). On `CompletedWithPartial`, the completed final is delivered before the next-phrase draft in the same payload; publishing a sendable translation draft cancels pending `clear_after` so an in-flight DelayedClear cannot wipe the next phrase. Final dedupe keys on `completed_sequence` (not active partial `sequence`); payload queue coalesces sticky/draft frames only and retains distinct completed finals; `avoid_duplicate_text` blocks sticky republish of the same phrase after `clear_after`. Presentation keeps completed non-draft translations in `items` (possibly `visible=false`) during live-partial merge for OBS/TTS.
- Send/clear/dedup algorithm with 0.5.2 fixes (501 debug clear, supersede generation, partial native stop after 501)

Enabled when `obs_closed_captions.enabled = true` and connection succeeds (`enabled` is the master gate for both native captions and the optional debug mirror). Native `SendStreamCaption` only during an active stream; `stream_not_running` (obs-websocket 501) is readiness, not a connection error. Debug-mirror `SetInputSettings` failures must not block native caption delivery or tear down the WebSocket. Stop/disable clears remote outputs with short retries; empty native clear accepts 501 (no active stream).

**Twitch language / encoding note:** Twitch Live Closed Captions accept CEA-708/EIA-608 (CC1 / line 21) embedded in the stream or via RTMP `onCaptionInfo` ([Twitch Help](https://help.twitch.tv/s/article/guide-to-closed-captions)). OBS `SendStreamCaption` feeds that path; Latin-script text is reliable, while Cyrillic / CJK / Arabic and other non-Latin scripts usually fail or garble. Browser overlay and debug-mirror text sources are Unicode and are not limited by CEA-608.

## 17. TTS Module

Shipped as **module** under `bin/modules/tts/` + Svelte UI at `/tts`. Subtitle speech only: enable-without-window; requires Live **Start** (`runtime_active`) **and** `config.enabled`. Closing `/tts` does **not** stop playback.

### Manifest

`bin/modules/tts/module.toml` — `entry_url_path = "/tts"`, requires core `>=0.5.0`.

### Components

| Layer | Path |
| --- | --- |
| UI | `src-tts/` → `bin/tts/` |
| Rust service | `crates/voicesub-tts/` (`TtsModuleService` in `RuntimeService`) |
| Native playback | `crates/voicesub-audio/src/playback.rs` (`PlaybackHub`, `speech` worker) |
| Python sidecar | `bin/modules/tts/runtime/win-x64/google_tts_fetch.exe` (shared binary with Twitch chat TTS; never `*.build`, `google_tts_fetch.py`, `build_runtime.py` / `.bat`, `runtime/README.md`, `.gitkeep`) |

### Dual sink (speech + twitch) — Rust hot path (0.5.2+)

One process-wide `PlaybackHub` with two named workers. Subtitle TTS and Twitch chat TTS are **independent enables**:

| Channel | Source | Owner | Config device fields |
| --- | --- | --- | --- |
| `speech` | `subtitle_payload` → `TtsSpeechPipeline` | TTS module | `user-data/modules/tts/config.toml` root `audio_output_device_*` |
| `twitch` | IRC → `TwitchModuleService` | Twitch module | `user-data/modules/twitch/config.toml` `chat.audio_output_device_*` |

Live path: plan → **`google_fetch.rs`** (HTTP + **`upstream_retry.rs`** 3× retry on transport/5xx/429/408) → enqueue → prefetch → in-process `PlaybackHub` (no webview IPC for audio bytes). Long text: `assemble_ordered_chunks` preserves chunk order after parallel fetch. TTS WebView — settings UI + manual sample test via `POST /api/tts/speak-sample` (Rust orchestrator; no JS queue pump).

**0.5.4 pipeline hardening:**

| Area | Module | Behavior |
| --- | --- | --- |
| Network | `upstream_retry.rs`, `google_fetch.rs`, `python_runtime.rs` | Shared retry helper; connect/read timeouts |
| Prefetch | `channel_orchestrator.rs` | Single in-flight prefetch per channel; `Notify` wait (no busy-poll); symmetric cancel on `clear` / `set_enabled(false)` |
| Config I/O | `config.rs` | In-memory cache; atomic save (temp + rename); corrupt backup |
| Planner | `subtitle_speech.rs` | `completed_with_partial` speech planning; `completed_sequence` for dedupe |
| Voice gain | `voicesub-audio/playback.rs`, `config.rs` | `speech_volume` clamp **0–150%**; Twitch chat override inherits or overrides Twitch module root |

**Removed in 0.5.4 TTS cleanup:** `speech-engine.ts`, browser HTMLAudio/WebAudio in `google-tts.ts`, deprecated IPC (`tts_enqueue`, `tts_plan_subtitle_speech`, `tts_channel_enqueue` / `begin_next` / `finish`, `tts_sync_source_text_replacement`).

### Playback modes (`playback_mode` in `user-data/modules/tts/config.toml`)

| Mode | Mechanism | When |
| --- | --- | --- |
| `native` (default) | `PlaybackHub` (cpal) @ 1.0× in-process | Lowest latency |
| `sonic` | libsonic tempo stretch, pitch-preserving rate | Queue / rate boost |
| `browser` (legacy) | — | **Migrates to `sonic`** on config load |

Tauri event: `playback-finished` `{ channel, item_id, ok, error? }`.

Devices: **label-first** (WASAPI friendly name → `cpal::Device`). List via `GET /api/tts/devices`.

### Voice gain and rate (`speech_volume`, `speech_rate`)

| Field | Range | Application |
| --- | --- | --- |
| `speech_volume` (root) | **0.0–1.5** (0–150%) | `clamp_speech_volume` in `voicesub-audio`; native `PlaybackHub` via `rodio` `amplify()` |
| Twitch `chat.speech_volume` | **≥ 0** override, **−1** inherit | Same clamp when override active (`effective_speech_volume`) |
| `speech_rate` / Twitch `chat.speech_rate` | **0.5–2.0×** | Sonic/browser path only; native mode forces 1.0× |

Normalization on every config save/load (`normalize_tts_config`). UI: `src-tts/lib/playback-format.ts` — `formatSpeechVolume` (`85%`, `150%`), `formatPlaybackRate` (`1.25×`); live values next to range sliders.

**Playback implementation:** MP3 is decoded to `f32` PCM; `apply_speech_volume_to_pcm` applies linear gain ≤100%. Above 100%: gentle compression + makeup gain + brick-wall limit at 0 dBFS (standard limiter/input-gain pattern — Web Audio / mastering docs). Browser sample path uses the same algorithm on decoded `AudioBuffer` samples.

### Legacy audio routing

- WinAPI per-process routing: `VOICESUB_TTS_PER_PROCESS_ROUTING` + `tts_bind_window_audio` — one device per WebView process; **do not use** for dual sink (use native/Sonic `PlaybackHub` instead).

## 17.1 Twitch Module

Independent module (`id = "twitch"`) under `bin/modules/twitch/` + Svelte UI at `/twitch` (`src-twitch/` → `bin/twitch/`). Enable-without-window: closing the webview does **not** disconnect IRC/EventSub or mute chat/event TTS. Chat TTS (`speak_chat`) and event TTS (`events.speak_events`) do **not** require subtitle TTS `enabled`. On app start, if the module is enabled and bot/broadcaster credentials exist, IRC **and EventSub auto-connect**. Saving filters, alert templates, or other UI settings hot-applies live state and **does not** reconnect. Explicit Connect / module enable / profile apply still establish a session.

Config: `user-data/modules/twitch/config.toml`. First start copies a legacy `[twitch]` section from the TTS config (if present) then strips it. Profiles snapshot `modules.twitch`; old `modules.tts.twitch` is lifted on apply. Chat TTS engine is **independent** of subtitle TTS: `tts_provider` (`browser_google` Google HTTP proxy vs `python_stdlib` embedded `google_tts_fetch` sidecar) and `playback_mode` live on the Twitch config; UI: engine + playback selects, **rate/volume sliders** (module-local, no inherit from subtitle TTS; native playback ignores rate), and `POST /api/twitch/speak-sample`. Optional `forward_to_vr_overlay` (default `false`) fans raw chat + channel events (ignores TTS `speakable` filters) into the SteamVR HUD Twitch panel via a second `TwitchModuleService` listener in `RuntimeService`.

OAuth redirect URI remains `http://localhost:{port}/tts` (Twitch Console). Two implicit-grant accounts (Streamer.bot-style): **bot** `chat:read` for extra-channel IRC (optional), **broadcaster** `chat:read moderator:read:followers channel:read:subscriptions bits:read` for the streamer's own chat JOIN + EventSub on **that streamer's channel only**. Connect works with Broadcaster alone (auto-JOIN `#<token owner>`, marked Broadcaster); extra `chat.channels` are optional. Unauthenticated `GET /tts` is the public OAuth shell. Canonical HTTP is `/api/twitch/oauth-*` with aliases `/api/tts/twitch/oauth-*`.

Event hook: `TwitchModuleService` listeners receive processed chat (`twitch_chat_message`), channel alerts (`twitch_channel_event`), and `twitch_connection_update` (includes `eventsub_state` / `eventsub_login`). Same EventBus as today — **not** OBS `/ws/events`. Snapshot replay of `twitch_connection_update` goes to the twitch window and dashboard, not TTS. When `forward_to_vr_overlay` is on, the same raw payloads are also enqueued into `VrOverlayModuleService` as `TwitchHudEvent` (no EventBus dependency for the HUD raster path).

### Channel events (EventSub + IRC)

| Source | Events | Notes |
| --- | --- | --- |
| EventSub WebSocket `wss://eventsub.wss.twitch.tv/ws` | `channel.follow` v2, `channel.subscribe`, `channel.subscription.message` (resub), `channel.subscription.gift`, `channel.cheer`, `channel.raid` (`to_broadcaster_user_id`) | Uses **`[events].broadcaster_oauth_token` only** (not the bot IRC token). Helix `POST /helix/eventsub/subscriptions` after `session_welcome` for the **token owner's** channel (`broadcaster_user_id` = `moderator_user_id` = authenticated user). Gifted `channel.subscribe` (`is_gift`) is skipped; the gift event is used instead. No broadcaster token → EventSub stays idle. |
| IRC `USERNOTICE` | `sub`, `resub`, `subgift` / `anonsubgift` / `submysterygift`, `raid` | Fallback **on the streamer channel only** when EventSub is idle or missing. Extra JOINed channels stay chat-only. |
| IRC `PRIVMSG` `bits` tag | Cheer | Spoken as a cheer event **on the streamer channel only**; the chat line still appears in the log on every joined channel. |

Semantic dedupe (15 s) on `kind|channel|user|extra` prevents EventSub + IRC double-speak. Per-kind enable + editable templates in `[events]` (`{user}`, `{login}`, `{channel}`, `{tier}`, `{months}`, `{count}`, `{viewers}`, `{bits}`, `{message}`).

### IRC and filters (`voicesub-twitch`)

| Aspect | Behavior |
| --- | --- |
| Channels | Broadcaster token auto-JOINs the streamer login (Helix token owner) first; optional extras in `TwitchTtsSettings.channels`; total IRC `JOIN` cap **5**; legacy `channel` → `channels[0]`. Extra channels: **chat only** (no USERNOTICE / bits events). Streamer channel: chat + EventSub + IRC event fallback. |
| Hot-apply | `TwitchChatService.apply_settings()` on config save — no reconnect for filter changes |
| Reconnect | `run_session_with_reconnect()` — auto-retry on stream/TCP/TLS loss; backoff 1→30 s; auth/settings errors stop the loop |
| Emotes | Twitch IRC tag (indices applied **before** trim) + BTTV/7TV/FFZ/Twitch lexical; edge punctuation peeled (`Kappa!`); **pure numeric tokens** are not matched as emote codes |
| Emoji strip | `strip_unicode_emoji` preserves decimal digits (ASCII / Arabic-Indic / Fullwidth); `\p{Emoji}` does not eat `0–9` in chat text |
| Invisible chars | `strip_invisible_chat_characters` (U+034F, U+3164, `\p{Cf}`, …) before symbol/link/lang filters |
| Links | When **`strip_links=true`**: `links.rs` removes URLs; link-only → `speakable: false`. When **`strip_links=false`**: URLs stay in speak text; rejection only if no linguistic content without link stripping |
| Mentions | TTS path: `normalize_twitch_mentions` (`@user` → `user`, message text kept). Clean/detection path: `strip_twitch_mentions` |
| Symbols | `strip_symbols` — comma-separated tokens (default `@, &, $, _`); `&`/`$` between digits → space only (URL query `&` preserved); digit groups (`500&100`) stay speakable; optional `replace_underscore_with_space` |
| Lang | Lingua 1.8 subset + Unicode heuristics + whatlang; `strip_leading_speaker_label` (does not treat `https:` as speaker label) |
| Profanity | Optional builtin list (`include_builtin_profanity`); independent from dashboard word replace. Default mask: first + last letter (`fuck`→`f**k`); forms with `*` left alone |
| UI | `src-twitch/components/TwitchPanel.svelte`: connection card, EventSub badge, `speak_chat` / `speak_events`, per-event templates, **TTS engine** + playback + rate/volume sliders, sample speak, save queue (`saveNow` / debounce + `pagehide` flush), “Settings applied” badge |
| Chat log UI | `src-twitch/lib/twitch-chat-log.ts` — dedupe by Twitch `id` / `event_sequence` before prepend |

Config: `user-data/modules/twitch/config.toml`.

## 18. Local ASR Module

Optional sidecar module (TTS pattern): offline **Parakeet TDT** via ONNX Runtime (`parakeet-rs`), no Python/NeMo/torch. Shipped in Kagevi Subtitles **0.6.0**.

### Manifest

`bin/modules/local-asr/module.toml` — `entry_url_path = "/local-asr"`, `requires_core = ">=0.6.0"`, capabilities: CPU/CUDA ORT, streaming partials, mic capture.

### Components

| Layer | Path |
| --- | --- |
| UI | `src-local-asr/` → `bin/local-asr/` (`vite.local-asr.config.ts`, base `/local-asr-assets/`) |
| Rust service | `crates/voicesub-asr-local/` — `LocalAsrModuleService` |
| Partial emit | `crates/voicesub-partial-emit/` — `PartialEmitCoordinator` (`word_growth`, coalesce) |
| Runtime ingest | `voicesub-runtime/src/local_asr_speech_source.rs` — `LocalAsrSpeechSource` |
| HTTP | `voicesub-runtime/src/http/local_asr.rs` — `/api/asr/local/*` |
| Tauri shell | `src-tauri/src/local_asr.rs` — `local_asr_open_window` only |

### Config split

| File | Contents | Who edits |
| --- | --- | --- |
| `user-data/modules/local-asr/config.toml` | model, deps, EP, VAD, realtime presets, mic, recognition | Module UI only |
| `user-data/config.toml` → `asr.mode` | `browser_google` \| `local_parakeet` | Live tab (when ready) |

Lazy downloads land under `user-data/modules/local-asr/` (models, ORT CPU/GPU DLL, CUDA redist). **Not** bundled in the core NSIS installer. Model catalog includes **fp16** (`grikdotnet/parakeet-tdt-0.6b-fp16`) as a lighter floating-point option for CUDA; **`int8` / `int8_smoothquant` decode stays on CPU** (no CUDA kernels for integer-quant ops) — use **fp16** or **fp32** for GPU.

ONNX Runtime is initialized **lazily on first warm-load / probe / Live Start**, not when ORT DLLs finish downloading. Download only refreshes PATH / `AddDllDirectory` so CUDA redist extracted later in the same process is visible. A failed first `ort::init` is retried on the next warm-load (not cached for the process). Switching the configured **execution provider** (`cpu` ↔ `cuda`) does **not** require a restart — the GPU ORT package includes both EPs. An app restart is only needed if this process already loaded `runtime/cpu/onnxruntime.dll` and a later download prefers `runtime/gpu/onnxruntime.dll` (Windows cannot unmap ORT).

### Readiness gate

`GET /api/runtime/status` → `asr.local_module`:

| Field | Meaning |
| --- | --- |
| `ready` | CPU path usable (deps + model + warm load) — Live can show `local_parakeet` |
| `cuda_ready` | CUDA EP deps + probe OK |
| `phase` | setup / ready / error / … |
| `execution_provider` | configured `cpu` \| `cuda` |
| `active_execution_provider` | EP actually used (may fall back to CPU) |

Dashboard Modules card + Live mode selector read this snapshot (HTTP poll / runtime status). There is **no** dedicated `local_asr_module_update` runtime-event in 0.6.0.

### Runtime Start / Stop

When `asr.mode = local_parakeet`:

1. `POST /api/runtime/start` asserts `local_module.ready`;
2. starts `LocalAsrSpeechSource` (cpal mic → 16 kHz → VAD → Parakeet decode → partial/final);
3. **does not** launch Chrome Web Speech worker;
4. emits typed partial/final into the same `IngestedAsrUpdate` path as browser ASR (subtitle FSM / translation / overlay unchanged).
5. Local ASR omits `source_lang` on ingest; runtime resolves a concrete language for TTS/subtitle (`source_lang` if not `auto`, else `asr.browser.recognition_language`, else `en`) so Google TTS never sees `tl=auto`.

Stop tears down the local pipeline (and browser path when that mode is active).

### HTTP API (`x-kagevi-subtitles-token` / also `x-kagevi-voice-token` / legacy `x-voicesub-token`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/asr/local/status` | deps + model + ready + cuda_ready + EP |
| GET | `/api/asr/local/config` | module config |
| POST | `/api/asr/local/config/save` | save module config |
| POST | `/api/asr/local/deps/check` | re-run env check |
| POST | `/api/asr/local/deps/download` | `{ kind: ort_cpu \| ort_gpu \| cuda_redist \| silero_vad \| vcruntime }` |
| POST | `/api/asr/local/deps/delete` | remove downloaded dep kind |
| POST | `/api/asr/local/deps/probe` | `{ provider: cpu \| cuda }` |
| POST | `/api/asr/local/model/download` | `{ variant, family? }` |
| POST | `/api/asr/local/model/select` | select installed variant |
| POST | `/api/asr/local/model/delete` | delete model files |
| POST | `/api/asr/local/model/load` | warm ONNX session |
| POST | `/api/asr/local/model/unload` | free session RAM |
| POST | `/api/asr/local/test/start` | module test bench |
| POST | `/api/asr/local/test/stop` | stop test |
| GET | `/api/asr/local/test/status` | test bench snapshot |
| GET | `/api/asr/local/mics/list` | cpal microphone enumeration |
| GET | `/api/asr/local/transfer` | download progress |
| POST | `/api/asr/local/transfer/cancel` | cancel transfer |
| GET | `/api/asr/local/driver-url` | CUDA Toolkit 13 download URL |

Pages: `GET /local-asr`, static ` /local-asr-assets`.

### Emit invariant

Module produces ready-to-display **partial** or **final** text. Core subtitle/translation/overlay and browser Web Speech **do not** special-case Parakeet smoothness — they consume the same ingest contract as `browser_google`.

### Realtime UX (module)

- Latency presets: `low` / `balanced` / `quality`
- Partial policy: `word_growth` via `voicesub-partial-emit`
- VAD:
  - Default backend **WebRTC**; optional **Silero** ONNX (`vad.backend = silero`, lazy download via `POST /api/asr/local/deps/download` `{ kind: "silero_vad" }` → `user-data/modules/local-asr/runtime/silero_vad_v6/silero_vad.onnx`). Missing Silero falls back to WebRTC.
  - `vad.speech_pad_ms` extends finalize hold and keeps trailing pad audio in the segment
  - `vad.text_hold_enabled` + `vad.text_hold_extra_ms`: when the latest ASR draft looks incomplete (EN/RU/JA heuristics), silence must last longer before Final
  - Force-final ceiling: `vad.max_segment_ms` default **5500** (silence hold remains primary; ceiling stops sticky-speech partial growth)
- Hallucination filter, emit telemetry, setup checklist (deps → model → mic test → final received)
- After realtime/VAD changes: **Stop → Start** required for Live session

### Tests

- Golden fixtures: `tests/golden/local_asr/`
- Crate tests: `voicesub-asr-local`, `voicesub-partial-emit` (`tests/golden_*.rs`)

### Non-goals (v1)

- Other model families / diarization / Sortformer
- Model weights inside the core installer
- TensorRT EP
- Changing browser Web Speech or subtitle FSM for local ASR

## 18b. VRChat Chatbox OSC Module

Optional **output** module (TTS-like sink, Local ASR-like enable lifecycle): sends final subtitle/translation text to VRChat Chatbox via OSC (`/chatbox/input`). **No KAT** in this version.

### Manifest

`bin/modules/vrchat/module.toml` — `entry_url_path = "/vrchat"`, `requires_core = ">=0.7.0"`.

### Components

| Layer | Path |
| --- | --- |
| UI | `src-vrchat/` → `bin/vrchat/` (`vite.vrchat.config.ts`, base `/vrchat-assets/`) |
| Rust | `crates/voicesub-vrchat/` — OSC client (`rosc`), inbound listener (`MuteSelf`/`AFK`), template/truncate, min-interval + latest-wins |
| HTTP | `/api/vrchat/status`, `/api/vrchat/config`, `/api/vrchat/config/save`, `/api/vrchat/test`, `/api/vrchat/test-connection` |
| Tauri | `vrchat_open_window` only; output keeps running while `enabled` even if the window is closed |
| Config | `user-data/modules/vrchat/config.toml` |

### Runtime badge

`GET /api/runtime/status` → `vrchat`: `enabled`, `paused`, `contentMode`, `layerLabel`, `listening`, `oscHeard`, last-send fields. Modules panel shows enabled/paused/muted/AFK + layer. Flow: open → configure → enable → close window.

Default OSC target: `127.0.0.1:9000` (app → VRChat Chatbox). OSC listen: `127.0.0.1:9001` (VRChat → app) for **Test connection** and optional **pause when muted / AFK** (`/avatar/parameters/MuteSelf`, `/avatar/parameters/AFK`). **Test connection** probes VRChat OSCQuery HTTP `/?HOST_INFO` on localhost (explicit listen port plus local TCP listeners). Mute/AFK pause **polls** those parameters from OSCQuery about twice a second (UDP change-only packets are not sufficient). Inbound UDP bind is **loopback only** (`127.0.0.1`); there is **no LAN mDNS advertise** (that made Windows 11 ask for local-network access under a process name that is not **Kagevi Subtitles**). Chatbox limit 144 chars / 9 lines. UTF-8 supported. `/chatbox/input` always sends notification SFX `false` (the Chatbox beep is unreliable and is not exposed in the UI).

**What to send** matches OBS Closed Captions: source (with recognition language) plus enabled Translation lines and their languages (`formatOutputSlotLabel`). Extra modes: first visible line, source+tr1, template. The module window reloads dashboard translation settings every 2s while open. **Clear Chatbox after** (`clear_after_ms`, default **5000**, `0` = keep until the next phrase, otherwise clamp **500–60000**) sends an empty `/chatbox/input` when the timer elapses; a newer send cancels the previous timer. After a timed clear the same completed overlay block is **not** sent again until the text changes.

### Runtime active gate

Chatbox sends run only while the core Live session is active (`set_runtime_active(true)` after `POST /api/runtime/start`). `handle_subtitle_payload` returns `SkippedRuntimeInactive` when Live is stopped. **Test send** and **Test connection** bypass the enabled/runtime gates.

### Subtitle fanout

Tauri `subtitle_payload_listener` (`src-tauri/src/lib.rs`) forwards each subtitle presentation payload to the TTS pipeline, **VRChat output**, and SteamVR HUD in the same hook — not via coalesced dashboard `overlay_update` IPC.

### Event filter

VRChat window (`event_routing.rs` → `vrchat_window_wants`): `ui_config_sync`, `runtime_update`, `module_config_sync` only — not live `overlay_update` / `transcript_update`.

### Config schema (`user-data/modules/vrchat/config.toml`)

| Key | Default / notes |
| --- | --- |
| `enabled`, `paused` | `false`, `false` — master switch; `paused` is config-only (no hero Pause button in v0.7.0 UI) |
| `host`, `port` | `127.0.0.1`, `9000` — OSC target (app → VRChat Chatbox) |
| `listen_port` | `9001` — OSC out from VRChat (test connection + optional mute/AFK pause) |
| `content_mode` | `translation_1` — also `source`, `translation_2..4`, `source_and_tr1`, `template`, `first_visible_line` |
| `template` | `{tr1}` — placeholders `{source}`, `{tr1}`…`{tr4}` |
| `send_on_final_only` | `true` — skips partial lifecycle items |
| `max_chars` | `144` (clamped 1–144) |
| `min_interval_ms` | `1000` (200–10000) — latest-wins coalescing between sends |
| `skip_unchanged` | `true` — dedupe + post-clear guard |
| `clear_after_ms` | `5000` — `0` = keep until next phrase; else clamp **500–60000** |
| `pause_when_muted`, `pause_when_afk` | `false` — requires inbound OSC listen when enabled |

Auto-created on first load if missing (`VrchatConfigStore`). Profiles and factory reset include VRChat snapshots (`profile_bundle.rs`).

### Tests

- Unit tests in `voicesub-vrchat` modules (`config`, `format`, `osc`, `listen`, `output`, `oscquery`)
- **No** `tests/golden/vrchat/` fixtures yet (unlike Local ASR)

## 18c. SteamVR OpenVR HUD Overlay Module

Optional **output** module: rasterizes the same subtitle presentation payload OBS uses onto an OpenVR `IVROverlay` quad in SteamVR. **Wearer-only** (any SteamVR scene). **Not** VRChat Chatbox (that is §18b, social, 144 chars). **Not** an OpenXR API layer (`XR_EXTX_overlay` is experimental and not advertised by SteamVR). Quest standalone cannot show this HUD (no SteamVR compositor).

Official usage is locked to Valve / OpenVR docs (constants in `crates/voicesub-vr-overlay/src/standards.rs`):

| Topic | Official source / rule |
| --- | --- |
| App type | `EVRApplicationType::VRApplication_Background` (3) first — attaches to a **running** SteamVR and never launches it; falls back to `VRApplication_Overlay` (2) when the runtime rejects Background with `INVALID_APPLICATION_TYPE` (108/`InvalidApplicationType`). Background is what removes the need to gate `VR_Init` on a process probe ([API-Documentation](https://github.com/ValveSoftware/openvr/wiki/API-Documentation)) |
| Unique key | `kagevi.subtitles.hud` — must be unique across overlay apps; `k_unVROverlayMaxKeyLength` = 128 including NUL (`openvr.h`, [CreateOverlay](https://github.com/ValveSoftware/openvr/wiki/IVROverlay::CreateOverlay)) |
| Create | `FindOverlay` first; `CreateOverlay` only on `UnknownOverlay`. Re-enable after a previous session would otherwise fail with `KeyInUse` ([CreateOverlay](https://github.com/ValveSoftware/openvr/wiki/IVROverlay::CreateOverlay)) |
| Create then show | Overlay starts hidden; call `ShowOverlay` after the first non-empty frame ([IVROverlay Overview](https://github.com/ValveSoftware/openvr/wiki/IVROverlay_Overview)). `DestroyOverlay` then `VR_Shutdown` on disable |
| Width | `SetOverlayWidthInMeters` — Valve default **1.0 m**; HUD default **0.55 m** so captions sit in the lower FOV ([SetOverlayWidthInMeters](https://github.com/ValveSoftware/openvr/wiki/IVROverlay::SetOverlayWidthInMeters)) |
| Transform | `SetOverlayTransformTrackedDeviceRelative` on HMD index 0 (`k_unTrackedDeviceIndex_Hmd`), or `IVRSystem::GetTrackedDeviceIndexForControllerRole` for left/right. OpenVR local space: +X right, +Y up, **−Z forward**. Euler **R = Rz × Ry × Rx**. HMD: identity + `{0, -0.28, -1.15}`. Controllers: **watch-scale wrist base** `{−0.05, +0.02, +0.12}` / mirrored right with Euler `(-65, ±165, ±115)` (cm offsets; Kurohuku/OpenVR practice — not meter-scale). Stored `offset_*` / pitch / yaw / roll are **user offsets** composed as `WRIST_CALIBRATION_BASE @ user_offset` (identity = default wrist). Presets Wrist / Near / Far / Above / Below / Palm (±2.5 cm). Pose re-submits while the HUD is already visible. Legacy HMD / Kurohuku / identity-wrist / Index-wrist / far-wrist (`z=+0.31`) / baked-absolute offsets migrate on save. Do **not** yaw 180° with `NoBackside` — that hides the HUD |
| HUD flags | `VROverlayInputMethod_None`, `NoDashboardTab`, `SortWithNonSceneOverlays`, `HideLaserIntersection`, `IsPremultiplied` (`openvr_capi.h`) |
| Texture | Primary: `SetOverlayTexture` every paint with `TextureType_DXGISharedHandle` + legacy `IDXGIResource::GetSharedHandle` on `D3D11_RESOURCE_MISC_SHARED` ([SetOverlayTexture](https://github.com/ValveSoftware/openvr/wiki/IVROverlay::SetOverlayTexture); Valve sample `helloworldoverlay`). Shared texture bind flags are `RENDER_TARGET \| SHADER_RESOURCE`. **Not** a raw `ID3D11Texture2D*` (`TextureType_DirectX`) for a long-running overlay (flicker — Fred Emmott / OpenKneeboard). While the HUD is visible the OpenVR thread rebinds `SetOverlayTexture` (~250 ms) so a **scene app** (game) does not drop the quad. The Twitch chat overlay uses a **second** DXGI shared texture (portrait size, independent of 1920×512 HUD) on the same GPU path; keep-alive rebinds both. Fallback: `SetOverlayRaw` **premultiplied** RGBA8, infrequent CPU updates — **not** per-frame video (Joe Ludwig, [openvr#772](https://github.com/ValveSoftware/openvr/issues/772)). Raw recovery still: `WaitFrameSync` + `ClearOverlayTexture`, recreate overlay handle, optional ½-resolution (recreate first — [openvr#1521](https://github.com/ValveSoftware/openvr/issues/1521)), then session recycle. |
| Size | Fixed **1920×512**, even, ≤2048 px so SteamVR compositor does not DXT-compress ([Compositor Skinning](https://github.com/ValveSoftware/openvr/wiki/Compositor-Skinning); resizing submitted textures is unreliable — openvr#1521) |
| FFI | Runtime `libloading` of SteamVR `openvr_api.dll`. FnTables are addressed by **vtable slot index** (`OverlayLayout` / `SystemLayout` in `compositor/steamvr.rs`), not hand-padded `repr(C)` structs: `IVROverlay_028` with fallback to `_027`, `IVRSystem_026` with fallback to `_022`. No `openvr`/`openvr_sys` crate (those need CMake) |
| GPU adapter | `IVRSystem::GetDXGIOutputInfo` selects the adapter for `D3D11CreateDevice` via `CreateDXGIFactory1` + `EnumAdapters`, so the shared handle comes from the GPU the compositor reads on multi-GPU hosts. Device is created **without** `BGRA_SUPPORT` (texture is `R8G8B8A8_UNORM`, no D2D interop). `GetDeviceRemovedReason` after upload detects `DXGI_ERROR_DEVICE_REMOVED`; the GPU path is then disabled for a cooldown (`gpu_disabled_until`) and retried instead of falling back to raw forever |
| Text layout | `rustybuzz` shaping for Arabic / Devanagari / Thai (joining forms, matra reorder, mark stacking); visual order comes from **UAX#9** (`unicode-bidi` `visual_runs`), so a Latin brand name or a number inside an Arabic sentence keeps its own embedding level instead of being flipped by a whole-row reverse. Runs are split by **font coverage**, not by script — a neutral character joins the surrounding run only if that face maps it, otherwise `123` inside Thai would shape to `.notdef`. `measure_text` and `blit_text` walk the same runs so wrapping cannot measure one face and draw another. Wrapping is UAX#29 word-bounded (`unicode-segmentation`) with grapheme-cluster fallback for space-less scripts and over-long tokens, plus kinsoku shori: a row never opens on `。、）」…` (or their Latin/Arabic/Devanagari equivalents) and never ends on a dangling `「（`; the offending character is pushed down to the next row, never hung past the panel |
| Font fallback | Coverage is decided by the **cmap** (`Font::lookup_glyph_index != 0`), then by ink. Rasterizing alone is not enough: an unmapped char resolves to glyph 0, and Noto's `.notdef` is an inked box, so the Latin face would claim `、` and print tofu. CJK punctuation (`U+3000–303F`) and fullwidth forms (`U+FF00–FFEF`) are classified as Han so they resolve to `ZenMaruGothic` / `ZCOOLXiaoWei` instead of a Latin face. The `bin/fonts` files are Google Fonts `latin` subsets and stop at Latin-1, so `%SystemRoot%\Fonts\{segoeui,arial,tahoma}.ttf` are appended **after** the shipped stack to cover Polish `ą ć ś ż ł`, Turkish `İ ş ğ` and Vietnamese `ế ệ ấ đ`. Unlike the browser surfaces, the HUD rasterizes itself and has no implicit system fallback. `raster.rs` tests assert per-character coverage for every `TRANSLATION_TARGET_LANGS` entry |

Empty payload hides the overlay (same idea as OBS `disposeRenderContainer`). Enable-without-window: configure → **Enable subtitle overlay** and/or **Enable chat overlay** (independent buttons) → close the window; submit continues while the core runtime is running and SteamVR is available. Subtitle fanout is the Tauri `subtitle_payload_listener` (same as TTS/VRChat), not the coalesced dashboard `overlay_update` IPC stream. **HUD submits are enqueued** onto a dedicated `voicesub-vr-overlay-subtitle` worker (latest-wins); OpenVR `VR_Init` / `WaitFrameSync` must never block the shared forwarder that also drives VRChat OSC and TTS. **What to show** lists source (with recognition language) and **enabled** translation lines only — same labels as OBS / VRChat (`formatOutputSlotLabel`); checkboxes, not a single dropdown.

### Manifest

`bin/modules/vr-overlay/module.toml` — `entry_url_path = "/vr-overlay"`, `requires_core = ">=0.7.0"`.

### Components

| Layer | Path |
| --- | --- |
| UI | `src-vr-overlay/` → `bin/vr-overlay/` (`vite.vr-overlay.config.ts`, base `/vr-overlay-assets/`) |
| Rust | `crates/voicesub-vr-overlay/` — config, raster (`fontdue` + `rustybuzz` shaping), OpenVR host client |
| OpenVR host | `kageviSub-vr-overlay-host` → `bin/modules/vr-overlay/runtime/win-x64/kageviSub-vr-overlay-host.exe` (separate process; framed stdin/stdout IPC). Core rasters `OverlayFrame`; host owns `VR_Init` / `IVROverlay` / D3D11. Missing host or `VOICESUB_VR_OVERLAY_INPROCESS=1` → in-process `ThreadedCompositor`. Orphan PID: `user-data/modules/vr-overlay/openvr-host.pid` |
| HTTP | `/api/vr-overlay/status`, `/api/vr-overlay/config`, `/api/vr-overlay/config/save`, `/api/vr-overlay/test`, `/api/vr-overlay/probe`, `/api/vr-overlay/steamvr/{status,start,stop}` |
| Tauri | `vr_overlay_open_window` only; HUD keeps running while `enabled` even if the window is closed |
| Config | `user-data/modules/vr-overlay/config.toml` |

### Runtime badge

`GET /api/runtime/status` → `vrOverlay`: `enabled`, `paused`, `origin`, `steamvrConnected`, `steamvrRunning`, `waitingForSteamvr`, last-submit fields, `twitchChatEnabled`. Modules panel: Off / Waiting for SteamVR / Enabled when **either** subtitle HUD or chat overlay is on. Flow: open → **Start SteamVR** (hero card) → configure → **Enable subtitle overlay** and/or **Enable chat overlay** → **Start** on Live (subtitles) → close window.

### SteamVR process control

User-initiated only (`crates/voicesub-vr-overlay/src/steamvr_process.rs`):

| Action | Implementation |
| --- | --- |
| **Start** | Prefer `vrstartup.exe` / `vrstartup64.exe`; fallback `steam.exe -applaunch 250820` |
| **Stop** | `begin_steamvr_stop()` tears down OpenVR peer session first, then `WM_CLOSE` on visible `vrmonitor.exe` windows; HTTP `:8998/console_command.action?sCommand=quit` only when no vrmonitor window is found |
| **Status** | `CreateToolhelp32Snapshot` walk (not `tasklist.exe` — no child process per poll): `running` = `vrserver.exe` present (OpenVR #611); also reports `vrcompositor`, `vrmonitor`. Cached snapshot; **always** drives Start/Stop even when both overlays are off. `lastError` omits the waiting-for-SteamVR copy (`waitingForSteamvr` + localized hint instead) |

**Never auto-start SteamVR.** `VRApplication_Background` cannot launch the runtime, so `VR_Init` needs no process gate: with SteamVR down it fails fast with `NoServerForBackgroundApp` (surfaced as "waiting for SteamVR"). Retries are spaced by `STEAMVR_RECONNECT_BACKOFF` (5 s). Empty HUD submits and hide paths do not trigger init.

### OpenVR session lifecycle

Prefer **out-of-process** OpenVR: core spawns `kageviSub-vr-overlay-host` and speaks framed IPC (`host_protocol`: magic `KVOH`, **version 3**, apply/submit/probe/status/shutdown; submit carries `layer` 0=HUD / 1=Twitch chat). Frame bodies are capped at `MAX_BODY_LEN` = 24 MiB so a corrupt header cannot become a multi-gigabyte allocation, and hide frames carry `empty` with **no** pixel buffer. The host owns all OpenVR FFI, runs its own ~250 ms `SetOverlayTexture` keep-alive, and writes `tracing` output to `user-data/modules/vr-overlay/openvr-host.log` (stdout is the IPC stream; override `VOICESUB_VR_OVERLAY_HOST_LOG`, truncated past 4 MiB, panics captured by a hook). The core IPC worker uses latest-wins apply/submit slots, never joins a stuck host on drop (kill + detach), and a **watchdog** thread kills a host that misses the IPC call deadline; the worker respawns it with exponential backoff. Fallback in-process path: all OpenVR FFI on one compositor thread (`compositor/thread.rs`).

On **`VREvent_Quit` (700)** the compositor calls `AcknowledgeQuit_Exiting()`, hides/destroys the overlay, and `VR_Shutdown` (OpenVR #878, #1490). There is **no reconnect FSM and no process gate**: quit, session loss (`session_active() == false`), and failing submits all funnel into `note_steamvr_disconnected`, which clears `cached_connected` and arms the 5 s backoff. Because a Background app cannot relaunch SteamVR, a manual SteamVR exit simply leaves the HUD waiting. The one explicit block is a user-initiated **Stop SteamVR** (`steamvr_user_stop`), cleared once `vrserver` is gone.

**Threading:** rasterization runs **outside** the output mutex (`submit_with_config` decides under a short lock, rasters, then re-locks to submit), and every HTTP handler reaches the module through `spawn_blocking` (`http/vr_overlay.rs` and the `vrOverlay` block in `build_runtime_status`) — `status()` reads `config.toml` and takes the same mutex the OpenVR thread holds across `VR_Init` / `SetOverlayTexture`.

A `VR_Init` that returns `ShuttingDown` while `vrserver` winds down is just another backoff tick. `WaitFrameSync` uses a short timeout and is skipped when SteamVR is already gone.

VR overlay window event filter (`event_routing.rs`): `ui_config_sync`, `runtime_update`, `module_config_sync` only — not live `overlay_update` / `transcript_update`.

### Config schema (`user-data/modules/vr-overlay/config.toml`)

| Key | Default / notes |
| --- | --- |
| `config_version` | `4` — missing or `0` marks a pre-versioning file: the legacy placement migrations run once, then never again (no float heuristics). `v2` adds nested `twitch_chat`; `v3` watch-scale wrist base + controller chat defaults; `v4` Twitch chat pose persists via `placement_memory` keys `twitch_chat::{origin}` (same remember/restore pattern as the subtitle HUD) and controller dashboard-distance wipe is one-shot only |
| `enabled`, `paused` | `false`, `false` — OpenVR session stays up if either `enabled` **or** `twitch_chat.enabled` |
| `overlay_key`, `overlay_name` | `kagevi.subtitles.hud`, `Kagevi Subtitles`; both truncated to the OpenVR 128-byte limit **on a char boundary** |
| `origin` | `hmd` \| `left_controller` \| `right_controller` \| `absolute` |
| `width_meters`, `alpha`, `curvature` | 0.55 m (HMD) / 0.14 m (controller), 1.0, 0.0 |
| `offset_x/y/z`, `pitch_deg`, `yaw_deg`, `roll_deg` | HMD `{0, -0.28, -1.15}`; controller offsets compose on watch-scale wrist base |
| `placement_memory` | Map of last pose per origin (`hmd` / `absolute` / …), optional wrist preset keys (`left_controller::near`), and Twitch chat keys (`twitch_chat::left_controller`). Switching origin (HUD or chat) restores the saved pose instead of factory defaults |
| `show_source`, `show_translation_1..4` | source + tr1 on; tr2–4 off |
| `finals_only` | `false` — when true, partial lifecycle items are skipped |
| `min_submit_interval_ms` | 90 (16–1000) |
| `texture_width`, `texture_height` | 1920×512 (even, 256–2048) |
| `font_size_px` | `0` = auto-fit to texture height and line count |
| `corner_radius_px` | Scrim corner radius on the rasterized panel (**16** default, **0** = sharp). Applies separately on root HUD and `twitch_chat`; text padding clears the fillet |
| `twitch_chat.*` | Optional second OpenVR overlay (`kagevi.subtitles.twitch_chat`, default texture **480×900** portrait). Independent enable button (same style as the subtitle HUD). Default origin **left controller** with watch-scale pose (width **0.2 m**); HMD uses dashboard-scale `{0, -0.05, -1.0}` / **0.45 m**. Own pose/alpha/font/corner radius; `show_broadcaster` / `show_extra_channels`; channel label color (default yellow); event color (default red); `auto_hide_ms` (`0` = always visible; otherwise hide this many ms after the **last accepted message**, timer restarts on each new line); scroll `bottom_up` \| `top_down`. On the streamer channel, `[channel]:` is replaced by Twitch badge icons from IRC `badges` (mod/VIP/sub/broadcaster/…; Helix global+channel sets when OAuth is available); extra channels keep the text label plus badges. Fixed body `nick: text` (or italic `/me`). Requires Twitch `forward_to_vr_overlay`. Host IPC `VERSION = 3` submit `layer` 0=HUD / 1=chat |

UI texture presets (default / tall / large / compact) are client-side. Wrist presets, per-origin HUD poses, and Twitch chat poses persist via `placement_memory` (HUD keys + `twitch_chat::{origin}`) plus the active offset fields. Status includes `twitchChatEnabled` / `twitchChatVisible` / `twitchChatPreview`.

## 19. Desktop Runtime and NSIS Release

### Tauri config

`src-tauri/tauri.conf.json`:

- `productName`: Kagevi Subtitles
- `identifier`: `com.kagevi.subtitles`
- `frontendDist`: `../bin/dashboard`
- `beforeBuildCommand`: `npm run build && npm run scrub:shipped-bin`
- Bundle: **NSIS** (`targets: ["nsis"]`, `installMode: currentUser`, languages en/ru/ja/ko/zh)
- `createUpdaterArtifacts: true` + `plugins.updater` (GitHub `latest.json` endpoint, minisign pubkey, Windows `installMode: passive`)
- NSIS template: `src-tauri/windows/installer.nsi`, hooks: `src-tauri/windows/hooks.nsh` (wired via `bundle.windows.nsis.template` / `installerHooks`)
- **Upgrade wipe:** `NSIS_HOOK_PREINSTALL` removes shipped `$INSTDIR\bin\{dashboard,worker,tts,local-asr,vrchat,vr-overlay,overlay,fonts,modules}` (and the same under `resources\bin`) before copying new resources, so Vite content-hash orphans and Nuitka `*.build` leftovers cannot survive updates. `user-data/` and `logs/` are never deleted.
- WebView2: `downloadBootstrapper` (silent=false)
- Resources: `bin/dashboard`, `overlay`, `worker`, `tts`, `local-asr`, `vrchat`, `vr-overlay`, **staged** `bin/.bundle-fonts/` → `bin/fonts/` (top-level `.ttf`/`.otf`/`.woff`/`.woff2` + `OFL.txt` / `*-LICENSE.txt` only — no unpacked family folders or Google Fonts zip metadata), **staged** `bin/.bundle-modules/` → `bin/modules/` (allowlist: each `module.toml` + `runtime/<platform>/*.{exe,dll}` / extensionless host binaries). Live workspace `bin/modules/` and `bin/fonts/` are **not** copied wholesale.

Legacy WiX `src-tauri/wix/main.wxs` — **not used** (reference only).

### Release pipeline

```
build-release-msi.bat          # back-compat entry
  → build-release-msi.ps1
  → build-release.ps1
    1. npm run build (+ build:tts + build:local-asr + build:vrchat + build:vr-overlay)
    2. bin\modules\tts\build_runtime.bat (if google_tts_fetch.exe missing); cargo build OpenVR host → bin\modules\vr-overlay\runtime\win-x64\; npm run scrub:shipped-bin (drop *.build / runtime/build; stage allowlisted bin/.bundle-modules/)
    3. node scripts/validate-nsis-i18n.mjs
    4. cargo tauri build (NSIS + updater .sig; requires secrets/tauri-updater.key)
    5. Stage GitHub-safe names → release_root/v{version}/
    6. latest.json via scripts/generate-updater-manifest.mjs
    7. optional: npm run release:github  (or build-release.ps1 -PublishGitHub)
```

Unified npm entry: `npm run version:bump -- --patch` then `npm run release`.

Default `release_root`: `F:\AI\Kagevi Subtitles - release\v{version}\`

Upload assets must match `latest.json` URLs (spaces in product names become `.` on GitHub).

### Install layout

- Per-user install (`currentUser`) — typically `%LOCALAPPDATA%\Programs\Kagevi Subtitles\`
- `user-data/` and `logs/` — next to install dir / project root (`ProjectPaths`)

### Dev workflow

- `npm run dev` — Vite dashboard on port 5173 (optional; production path uses embedded server)
- Tauri loads `http://127.0.0.1:8765` (Axum serves built dashboard)

**End user install:** NSIS `setup.exe` only. No Python/Node/torch in core installer. Chrome is a system dependency for Web Speech. Local ASR model/ORT/CUDA are downloaded on demand in the module UI.

## 20. Storage and Paths

| Path | Purpose |
| --- | --- |
| `user-data/config.toml` | Main config |
| `user-data/profiles/` | Named profiles |
| `user-data/browser-worker.pid` | Last Chrome worker PID (orphan reap) |
| `user-data/browser-worker-profile-classic-*/` | Chrome isolated profiles |
| `user-data/modules/tts/` | TTS module config + runtime state (+ `webview2/`) |
| `user-data/modules/twitch/` | Twitch module config + runtime state (+ `webview2/`) |
| `user-data/modules/local-asr/` | Local ASR config, models, ORT/CUDA runtime (+ `webview2-local-asr/`) |
| `user-data/modules/vrchat/` | VRChat Chatbox OSC module config (+ `webview2/`) |
| `user-data/modules/vr-overlay/` | SteamVR HUD overlay config (+ `webview2/`, `openvr-host.pid`) |
| `user-data/translation-cache/` | Persistent translation cache |
| `user-data/exports/` | Diagnostics ZIP bundles (newest 12 kept) |
| `logs/` | Runtime logs |
| `bin/` | Shipped static (workspace or NSIS resources) |

`ProjectPaths::discover(project_root)` resolves all paths relative to project root or Tauri resource dir.

## 21. Frontend: Dashboard (Svelte)

**Sources:** `src/`  
**Build:** `vite.config.ts` → `bin/dashboard/`

### Navigation (Material 3 shell, 0.5.3+)

Single-page app with **primary destinations** (`src/lib/navigation.ts`) — no SvelteKit router:

| Destination ID | Panel / hub |
| --- | --- |
| `live` | Live overview (`OverviewSection.svelte`) — compact layout primary pane |
| `translation` | `TranslationPanel.svelte` |
| `subtitles` | Hub → `SubtitlesPanel.svelte` + `StylePanel.svelte` |
| `obs` | `ObsPanel.svelte` |
| `modules` | `ModulesPanel.svelte` — compact square tiles (icon / status / Open / `?` help) for TTS, Twitch, Local ASR, VRChat, SteamVR HUD |
| `more` | Hub → `ThemePanel`, `ReplacementPanel`, `ToolsPanel`, `SettingsPanel`, `HelpPanel` |

Standard layout uses the same destinations via `NavRail` / `BottomNav`. Command palette (`Ctrl+K`) resolves deep links via `NavTarget`.

**Live runtime status bar:** `RuntimeBar.svelte` (`RuntimeStatusStrip` + `RuntimeDetailsSheet`) is pinned above content on **every** destination. On Live (`collapsed=false`) it shows full KPI chips (ASR / WebSocket / Worker / OBS CC), phase/status copy, Details, Start/Stop. On other tabs (`collapsed={standardNav !== "live"}`) it is a compact strip without the Live eyebrow / phase / status copy. Same bar in `StandardShell` and `CompactShell`.

**UI Theme:** `ThemePanel.svelte` preset gallery (`UI_THEME_PRESETS`). Click applies theme+palette and syncs via `/api/ui/sync`. Sample includes chips, input, primary/ghost buttons.

### Key libs

| File | Role |
| --- | --- |
| `src/lib/api.ts` | REST helpers (prefer `loopback-api-client.ts` for authed fetch) |
| `src/lib/loopback-api.ts` | Token bootstrap (`get_loopback_api_token`; cookie-tolerant fetch for Chrome worker) |
| `src/lib/runtime-events.ts` | **Production** Tauri `runtime-event` consumer + snapshot replay |
| `src/lib/ui-config-sync.ts` | Cross-window UI sync → `POST`/`GET /api/ui/sync` + `ui_config_sync` |
| `src/lib/ws.ts` | Legacy `/ws/events` client (dev / external browser) |
| `src/lib/stores/app.ts` | App state + WS/event dispatch |
| `src/lib/config-*.ts` | Config normalize/save |

### Layout IPC

`set_dashboard_layout` Tauri command — compact vs standard window sizes.

### Idle subtitle preview (before Start)

**Files:** `src/lib/preview-payload.ts`, `src/lib/components/SubtitleOutputPreview.svelte` (embedded from `OverviewSection.svelte`)

While runtime is in `idle` phase, the dashboard shows **placeholder preview** with native-script sample text (source line from `source_lang` or browser `recognition_language`; translation lines from each target lang — not UI-locale copy) instead of live `overlay_update`. An empty `overlay_update` after Save **does not clear** the preview. When `running=true`, preview switches to live `overlay_update` (and `subtitle_payload_update` from Tauri snapshot on connect). Test: `src/lib/preview-payload.test.ts`.

## 22. Frontend: Overlay (vanilla)

**Path:** `bin/overlay/`

| File | Role |
| --- | --- |
| `overlay.html` | Shell |
| `overlay.js` | WS consumer, render loop; `disposeRenderContainer` on empty |
| `overlay.css` | Viewport fill + clip; compact padding |
| `shared/js/subtitle-style/` | Renderer ESM (`index.js`, `fit-box.js`, …; `source` + `translation_1`…`translation_4`; fit-to-box) |
| `shared/js/core/ws-stale-guard-logic.js` | Stale filter |
| `shared/js/i18n/` | Minimal overlay locale bundle (`document.title.overlay` only) |

**WS:** `ws(s)://{host}/ws/events` — **`overlay_update` only** (live subtitle frames + replay on connect). `transcript_update` is not consumed by OBS overlay (dashboard / external WS clients may still use it). Payloads are normalized in `overlay.js` (`normalizeOverlayPayload`, lifecycle allowlist aligned with `src/lib/overlay-normalizer.ts`); **`is_live_draft` is forwarded** so draft MT rows share the transient/fast-path with source partials. Completed previous-phrase MT in `completed_with_partial` stays non-transient. Shape signatures omit completed text so late MT supersession patches `textContent` in place.  
**Reconnect:** exponential backoff 1s → 10s max; last frame preserved on disconnect (OBS UX).  
**Debug:** `?debug=1` gates `writeDebug` → `console.debug`; `?debug-subtitles=1` enables subtitle-effect trace ring. No production `console.log` on hot path.  
**Paint coalesce:** long partials (≥200 chars) → ~66 ms; visible live drafts → ~40 ms; `completed_only` first paint uncapped.  
**Empty payload:** `disposeRenderContainer(linesContainer)` when render returns `empty: true` (TTL / Stop / idle). Idle TTL also requires `hasVisibleRenderedFrame()` so state-only clear does not skip DOM teardown. Pending RAF frames are cancelled on explicit clear. Cache-bust: `overlay.html` → `subtitle-style/index.js?v=20260827b` (reload the OBS Browser Source after updating). Dashboard preview passes `obsPaintPolicy: true` (same paint budget as OBS: mid-phrase large deltas skip fragment animation; phrase-start/`jump` always keep the configured effect). Entrance `fade`/`blur_in`/`glow` start at opacity 0; glow also uses `text-shadow` for older CEF. Remount/finalize keep `effect-none`. Translation draft→final (including refined text) and duplicate finals do not replay entrance. OBS overlay applies overflow-scroll after render (`applyOverlayOverflow`; Subtitles **Subtitle scrolling** / `overlay.fit_to_box`, speed `overlay.scroll_speed_px_per_sec`; `?fit=0` disables).

## 23. Frontend: Browser Worker (Svelte)

**Sources:** `src-worker/`  
**Build:** `vite.worker.config.ts` → `bin/worker/` (`base: "/worker-assets/"`)

Entry: `main.ts` → `WorkerApp.svelte`  
Autostart: `?autostart=1` query param.

## 24. UI Localization (i18n)

**Locales:** `en`, `ru`, `ja`, `ko`, `zh`

| Surface | Catalog / source of truth |
| --- | --- |
| Dashboard / Local ASR / worker | **Edit** `scripts/voicesub-locale-overrides.mjs` (+ `scripts/local-asr-locale-supplement.mjs` for ja/ko/zh Local ASR). **Generated:** `src/lib/i18n/locales/{locale}.json` via `npm run i18n:export` |
| TTS module | Edit `src/lib/i18n/locales/tts-{locale}.json` directly |
| Twitch module | Edit `src/lib/i18n/locales/twitch-{locale}.json` directly |
| Overlay | **Edit** `scripts/i18n-source/locales/*.js` → `npm run i18n:bundle` → `bin/overlay/shared/js/i18n/` (whitelist: `document.title.overlay` only) |
| Worker locale | `locale` query param + worker i18n from dashboard catalogs |

Merge at runtime: `src/lib/i18n/index.ts` — main + TTS + Twitch catalogs per locale.  
Export: `npm run i18n:export` → `scripts/export-i18n.mjs` (SST `scripts/i18n-source/locales/*.js` + extras, then **overrides win**).  
Overlay bundle: `npm run i18n:bundle` → `scripts/build-locale-bundle.mjs` (minimal CEF payload).  
Config key: `ui.language` (empty = browser default).

## 25. Versioning and Update Checks

- **Single source of truth:** `voicesub-types::PROJECT_VERSION` and `DEFAULT_GITHUB_REPO` (`kiriuru/Kagevi-Subtitles`) in `crates/voicesub-types/src/version.rs`
- Bump: `npm run version:bump -- --patch` (or `-- 0.7.0`) → edits `PROJECT_VERSION` + `npm run version:sync` (Cargo / package.json / tauri.conf.json / `project-version.ts` / brand / **updater endpoint**)
- Drift guards: `npm run version:check`; Rust test `project_version_matches_cargo_pkg`
- `GET /api/version`, `POST /api/updates/check` — GitHub Releases poll for dashboard metadata (`update_service.rs`); runtime force-check on HTTP start; dashboard reuses via `refreshVersionAfterStartupCheck`
- **In-app install:** `tauri-plugin-updater` + `tauri-plugin-process`; endpoint synced to `https://github.com/{DEFAULT_GITHUB_REPO}/releases/latest/download/latest.json`; minisign keys in `secrets/` (gitignored). Before download, shell IPC `prepare_updater_staging` redirects process `TEMP`/`TMP` to the install/project root (`discover_project_root`) so the NSIS exe is staged there (not `%TEMP%`). On failure, `abort_updater_staging` restores env and deletes partial staging. Successful install exits before NSIS finishes, so leftovers (`{product}-{ver}-updater-*`) are removed on the **next** app launch (`cleanup_updater_staging`).
- Prefer `npm run push:safe` when publishing commits: it **refuses** to push when `origin` is ahead (no auto `pull --rebase`, which checkouts remote and can look like a local docs/code rollback in the IDE).
- **Unified release (minimal edits after bump):**
  1. `npm run version:bump -- --patch`
  2. `npm run release`  (= `build-release.ps1` + `npm run release:github`)
  - Staging uses GitHub-safe asset names (spaces → `.`); shared helpers in `scripts/updater-release-lib.mjs`
  - Or step-by-step: `.\build-release.ps1` then `npm run release:github` / `.\build-release.ps1 -PublishGitHub`

## 26. Testing

### Policy

- **No new Rust module without tests** in the same task
- Golden fixtures in `tests/golden/` — update when behavioral contracts change
- `cargo test --workspace` required before done
- CI: `cargo clippy --workspace --all-targets -- -D warnings`; workspace lints in root `Cargo.toml` — `clippy::pedantic = warn` (curated allows for docs/API/cast/style noise), deny `unused_async` / `await_holding_lock` / `await_holding_refcell_ref` / `redundant_clone` + `clippy.toml` MSRV `1.85`
- Hot-path async hygiene: Chrome / Local ASR process work and Local ASR zip extract via `spawn_blocking`; avoid holding orchestrator / translation controller locks across status broadcast or enqueue awaits

### Levels

| Level | Where | What |
| --- | --- | --- |
| Unit | `crates/*/src/**` | FSM, stale drop, normalization |
| Golden | `tests/golden/` + crate `tests/golden_*.rs` | Payload parity |
| Integration | `tests/integration/`, `voicesub-http/tests/` | HTTP/WS smoke |
| Frontend | `npm run test:frontend` (Vitest: `test:lib` + `test:worker` + `test:renderer`) | i18n, normalizers, worker, preview, twitch-chat-log, loopback-api |

### Key test files

- `voicesub-subtitle/tests/golden_subtitle.rs`, `golden_ttl_lifecycle.rs`
- `voicesub-translation/tests/golden_translation.rs`, `golden_stale_translation.rs`
- `voicesub-http/tests/http_ws_smoke.rs` — runtime start **without** Chrome (`VOICESUB_SKIP_BROWSER_WORKER`)
- `voicesub-twitch` — pipeline/links/lang/emoji digits/emotes/`apply_settings` (105+ unit tests)
- `voicesub-browser/tests/worker_svelte_contract.rs`, `launcher.rs` launch skip
- `voicesub-subtitle/tests/overlay_contract.rs` — overlay lifecycle + empty cleanup
- `src/lib/preview-payload.test.ts`, `tests/renderer/dashboard-panel.contract.test.ts` — idle/live preview + `SubtitleOutputPreview` renderer contract
- `src-twitch/lib/twitch-chat-log.test.ts`, `src-twitch/lib/twitch-channels.test.ts`, `src-twitch/lib/twitch-oauth.test.ts` (redirect stays `/tts`)
- `src-tts/lib/popover-position.test.ts`
- `tests/golden/local_asr/*`, `voicesub-asr-local` / `voicesub-partial-emit` golden tests
- `src/lib/local-asr-labels.test.ts`

## 27. Product Invariants

1. **Local-first:** default localhost bind; no cloud assumptions.
2. **Browser worker visibility:** full worker keeps a visible URL bar; compact worker uses Chrome `--app=` (still a separate window, not hidden/throttled-to-death).
3. **Subtitle lifecycle:** completed block persists until new phrase finalized; late translations allowed on browser path.
4. **Translation:** 17 providers, full dispatcher semantics (queue, stale drop, supersession).
5. **Overlay separation:** vanilla HTML for OBS; not bundled in dashboard Vite chunk.
6. **No Node in runtime:** only compile-time frontend toolchain.

## 28. Known Limitations & Technical Debt

### 28.1 Current limitations

- In-app updates use free Tauri minisign signatures only (no Authenticode). Windows SmartScreen may still warn on first/rare runs of an unsigned publisher exe.
- `POST /api/openai/models` — live OpenAI-compatible model list; official OpenAI host filters to chat models
- Browser ASR: audio input enumeration empty in core devices API (mic lives in Chrome). Local ASR enumerates mics via `GET /api/asr/local/mics/list` (cpal).

### 28.2 Technical debt

- _(none tracked)_

## 29. Security & Privacy Model

- **Bind policy:** localhost default; LAN only via explicit `VOICESUB_ALLOW_LAN=1`
- **Loopback API auth:** `/api/*` requires per-session `x-kagevi-subtitles-token` (also `x-kagevi-voice-token`, legacy `x-voicesub-token`) **or** HttpOnly `kagevi_loopback` cookie from Chrome worker bootstrap; HTML pages do not embed the token; `POST /api/twitch/oauth-complete` (alias `/api/tts/twitch/oauth-complete`) is a public OAuth bridge; WS endpoints unauthenticated by design
- **CSP** on all HTTP responses (restrictive `default-src 'self'`)
- **Diagnostics export:** config redaction before ZIP
- **No telemetry** to vendor servers by default
- Translation provider API keys stored locally in `config.toml` / `provider_settings`
- Twitch OAuth tokens stored locally in `user-data/modules/twitch/config.toml` (`voicesub-twitch`)
- Browser worker uses isolated Chrome profile (no sync)

## 30. Extension Points

### Safe extension

| Extension | How |
| --- | --- |
| New translation provider | Add to `voicesub-translation/src/providers/`, register in `mod.rs`, golden tests |
| New WS event type | Add to `voicesub-ws`, document in §9, update dashboard/overlay consumers |
| New config key | `voicesub-config` defaults + migrate + normalize + TECH_ARCH §7 |
| New module | `bin/modules/{name}/module.toml` + sidecar |
| Dashboard panel | New `src/lib/panels/*.svelte` + register in `navigation.ts` (`NavRail` / `BottomNav`); optional `PanelListDetailLayout` for long panels |

### Unsafe (forbidden without contract update)

- Changing subtitle lifecycle semantics
- Adding Node.js to runtime
- Reintroducing experimental routes in core HTTP server
- Business logic in `src-tauri/`

## 31. Glossary

| Term | Meaning |
| --- | --- |
| **ASR** | Automatic Speech Recognition |
| **Browser worker** | Chrome window running Web Speech at `/google-asr` or `/google-asr-compact` |
| **Completed block** | Finalized subtitle segment shown until next phrase finalizes |
| **Golden test** | Fixture-based regression test |
| **Overlay** | Vanilla OBS Browser Source page at `/overlay` |
| **Segment / revision** | Translation supersession identity `(segment_id, revision)` |
| **Sidecar module** | Optional feature (TTS, Local ASR) under `bin/modules/` |
| **Stale drop** | Discarding in-flight translation superseded by newer segment |
| **Local ASR** | Offline Parakeet module (`/local-asr`, mode `local_parakeet`) |
| **Kagevi Subtitles** | Product name for the 0.6.x line (baseline first release: 0.5.0) |
