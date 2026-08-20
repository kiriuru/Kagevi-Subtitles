# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<p align="center">
  <a href="./CHANGELOG.en.md">English</a> ·
  <a href="./CHANGELOG.md">Русский</a>
</p>

This file covers the desktop line: **Kagevi Subtitles** (formerly VoiceSub, from `0.5.0`).

## [Unreleased]

## [0.6.5] - 2026-08-20

### Added

- OBS overlay: captions sit on the **top** of the Browser Source and grow **downward**. Each line (source + up to 4 translations) stays at the **designed font size** and **scrolls on its own** when it is too tall. Toggle **Keep captions inside the OBS box** on the Subtitles tab (`overlay.fit_to_box`, on by default). After updating, **reload** the Browser Source (cache-bust `?v=20260820f`).

### Removed

- Translation provider `microsoft_edge` (keyless Microsoft Edge Translate). Microsoft’s anonymous Edge path is dead (HTTP 404). Existing configs migrate to `bing_translator` (also keyless) on load/save; `public_libretranslate_mirror` now maps to Bing as well.

### Fixed

- Local ASR: first-install warm-load no longer fails after downloading ORT/CUDA in the same session. ONNX Runtime now initializes on warm-load (not immediately after the ORT zip), retries a failed first `init`, and registers extracted CUDA/ORT folders on the DLL search path before loading.
- Browser Web Speech: after a long pause, stall/hot-mic rearm no longer `stop()`s recognition on the first words of the next phrase (continuous **and** overlap). The stall clock is the **current** mic-hot streak, not wall time since the last ASR result.

## [0.6.4] - 2026-08-08

### Added

- Compact Browser Speech worker: Live-tab checkbox `asr.browser.compact_worker_ui` opens `/google-asr-compact` in a Chrome `--app=` window (no address bar) with a reduced UI (status, Start/Stop/Save, language, advanced checkboxes, Live Partial Text only).

### Fixed

- OBS CC: realtime partials (`source_live` / translation live drafts) no longer send the full accumulated phrase — trailing window via `timing.max_partial_caption_chars` (default **80**, `0` = unlimited) scrolls by **whole words**; a final that follows live partials uses the same window (no full-text duplicate); finals without prior partials stay unclipped. Pending `clear_after` / `final_replace_delay` no longer block the worker — the next phrase/partial cancels the sleep immediately.
- Browser Web Speech continuous: close multi-second gaps while the mic still hears speech — stall/rearm **9 s** (cold-start **4.5 s**); `mic_silent` no longer masks `web_speech_stalled`; recovery uses `stop()` (not abort) so phrases are not chopped into tiny finals.
- Browser Web Speech overlap: silence rearm **8 s** (was 2.5 s) + `stop()`, **3 s** while mic is hot; forced-final floor **8 s**; orphan interim on active `onend`; stale soft-join partial no longer blocks rearm.
- Browser Web Speech overlap: soft-join across handoffs (one `client_segment_id` until ~**1.8 s** ASR quiet or **450** chars); buddy shadow flush on handoff; soft-final does not blank the UI; hold display when Chrome trims the same interim hypothesis.
- Worker settings (`continuous` / interim / force-finalization): dashboard Start/Save no longer clobbers these with a stale snapshot — deep-merge `asr` + omit worker-only keys. Recognition language still saves from the main UI.

## [0.6.3] - 2026-08-05

### Added

- In-app auto-update via official `tauri-plugin-updater` (free minisign signatures, no paid Authenticode): banner **Install update** → download/install NSIS → relaunch; `latest.json` on GitHub Releases; keys under `secrets/` (gitignored).
- Unified updater release path: `npm run version:bump` → `npm run release` (`build-release.ps1` + `release:github`); GitHub-safe artifact names; `scripts/updater-release-lib.mjs`.
- Translation provider **`bing_translator`** (Bing Translator, no API key) — `bing.com/translator` → `ttranslatev3`.
- Style → font picker: custom `FontFamilyPicker` — each list row renders in its own typeface; English family names, alphabet tags in native scripts (`Latin`, `Кириллица`, `日本語`, `中文`, `한국어`).

### Changed

- Browser worker: visible-window idle watchdog rearm after **15 s** without transcript (was 30 s), so quiet Web Speech stalls recover sooner.
- Style → font picker: alphabet tags no longer follow UI locale — always shown in the matching script so CJK / Latin-only coverage is visible at a glance.
- Desktop updater: NSIS installer is staged under the install/project root (not `%TEMP%`); leftovers are deleted on the next launch after a successful update (or immediately on a failed attempt).
- NSIS upgrade: before copying resources, wipe shipped `$INSTDIR\bin\{dashboard,worker,tts,local-asr,overlay,fonts,modules}` (and the same under `resources\bin`) so orphaned Vite content-hash files and other leftovers from prior builds cannot accumulate across updates; `user-data/` and `logs/` are never touched.
- TTS sidecar: `build_runtime.py` builds Nuitka in a work tree and ships only `google_tts_fetch.exe`; `npm run scrub:shipped-bin` (from `build-release.ps1`) refuses to package `*.build` / `runtime/build`.
- Docs / UI: `microsoft_edge` marked unreliable — Microsoft’s anonymous Edge path can fail with **HTTP 404**; prefer Bing / Google Web when it breaks.

### Fixed

- OBS overlay: entrance effects readable again — opacity start lowered from ≥0.85; first (often long) ASR partial no longer drops `fade`/`blur_in`/`glow` via the 12-char cap (cap applies only to mid-phrase bursts); stronger glow + `text-shadow` CEF fallback; cache-bust `?v=20260805c`.
- OBS overlay: final translation after a live draft no longer replays entrance (including draft→final text refine / duplicate finals) — fade/glow from opacity 0 was re-blinking already-painted glyphs; cache-bust `?v=20260805d`.
- Loopback API: session token is no longer embedded in HTML for `/`, `/tts`, `/local-asr`, `/google-asr` (any local browser could previously control `/api/*`). App HTML itself now requires bootstrap/cookie (401 otherwise); unauthenticated `/tts` serves only a minimal Twitch OAuth shell. Tauri/Chrome launch URLs carry one-time `bootstrap`; Twitch `oauth-complete` requires CSRF `state`. Non-loopback WebSocket clients need `loopback_token` (localhost OBS/worker unchanged).
- TTS: settings apply more reliably — flush debounced saves on `pagehide`/blur, Twitch rate/volume debounce on `oninput`, clear queue+prefetch when provider/playback mode changes; UI exposes `speech.max_queue_items` and `speak_chat`.
- Twitch emotes: IRC `emotes` indices applied before trim; lexical strip removes punctuated codes (`Kappa!`, `(OMEGALUL)`); added **FFZ** (FrankerFaceZ) emote source; Clear queue stops playback and drops prefetch.
- Twitch OAuth: cancelling auth in the system browser (`?error=access_denied`) shows a minimal page and forwards the error into the app TTS module via the bridge — full `/tts` UI is not mounted in the browser.
- OBS CC (`send_translation_partials`): completed translation finals are no longer dropped on `CompletedWithPartial` (a next-phrase live draft used to preempt the payload); pending `clear_after` is cancelled when the next draft arrives so growing caption text is not wiped.
- OBS CC: `translation_1…4` modes select by `slot_id`, not the Nth visible translation line — otherwise with `translation_1`+`translation_3` and output `translation_3`, finals never sent (especially with live-partials off).
- OBS CC: dedupe finals by `completed_sequence` (not the active partial sequence) — sticky completed-block republishes under keep_completed were flooding the queue and dropping phrases; sticky republish of the same text after `clear_after` no longer bypasses `avoid_duplicate_text`; payload queue coalesces only sticky/draft frames and keeps distinct completed finals (needed for realtime translation with OBS live-partials off).
- Installer / release package: Nuitka intermediate `google_tts_fetch.build` (~13 MB) is no longer left next to the sidecar and does not survive upgrades; orphaned hashed assets under worker/dashboard/tts/local-asr are cleared on upgrade.
- OBS overlay: live-partial translation flicker — `is_live_draft` is forwarded into the renderer so draft MT uses the transient/fast path (like source); completed-text changes patch in place without remount; entrance effects start at opacity ≥0.85; dashboard preview uses the same OBS paint policy (`obsPaintPolicy`); ~40 ms coalesce while drafts are visible; glow keyframes drop `color-mix` for older OBS CEF.
- UI locale: style slot tabs (“Translation 1 · Russian”) and OBS Output mode options update immediately when the interface language changes, without a page reload; same for Modules badges and Translation provider field labels.
- Update check: dashboard no longer force-polls GitHub again on bootstrap (reuses the runtime startup check).
- Style → font picker: dropdown list uses an opaque surface (glass tokens previously showed through underlying form fields).
- Style (base and slot override): all fields (font, colors, alignment, effect, metrics) update in the UI immediately after edits — no dashboard reload (Svelte 5 + reactive `resolveStyleFields`).

## [0.6.2] - 2026-08-02

### Added

- Neon-style display fonts (OFL): **Tilt Neon**, **Audiowide**, **Monoton**, **Neonderthaw** in `bin/fonts/` (Latin). **Neon Tubes** (FontStruct) is non-commercial — not shipped; use Tilt Neon as the tube-lettering stand-in. Cyrillic/CJK neon stacks already covered by **Unbounded** / **Exo 2**, **Reggae One** / **Mochiy Pop One** / **Yusei Magic**, **ZCOOL KuaiLe**, **Gugi**.
- Pruned ~49 near-duplicate `bin/fonts/` faces (~41 MB): old workhorse twins (Roboto, JetBrains Mono, Source Code Pro, Bebas Neue, …) and creative near-clones (horror twins, Londrina/Bungee outline variants, oversized Stylish/QingKe, …); kept distinct creative/texture pack.
- Eight creative built-in style presets from the new pack: **Titan Gothic**, **Dirt Grunge**, **Spray Street**, **Glitch Neon**, **Pixel Arcade**, **Brush Ink**, **Military Stencil**, **Metal Horror**. Built-in catalog now loaded from `crates/voicesub-config/data/builtin_style_presets.json` via `include_str!`.
- Creative subtitle fonts in `bin/fonts/`: Latin (**Press Start 2P**, **Silkscreen**, **Lobster**, **Pacifico**, **Righteous**, **Bungee**, **Fredoka**); Latin+Cyrillic (**Russo One**, **Caveat**, **Philosopher**, **Neucha**, **Yeseva One**, **Marck Script**, **Bad Script**, **Poetsen One**, **Rubik**, **Nunito**, **Manrope**, **Onest**, **Unbounded**); Japanese (**DotGothic16**, **Yusei Magic**, **Hachi Maru Pop**, **Stick**); Chinese (**ZCOOL KuaiLe**, **Ma Shan Zheng**); Korean (**Do Hyeon**, **Gaegu**, **Single Day**, **Poor Story**).
- Dramatic / anime-title fonts (AoT-adjacent energy): JP+Cyrillic **Dela Gothic One**, **Rampart One**, **Reggae One**, **Train One**, **Zen Old Mincho Black**; JP **New Tegomin**, **Potta One**, **Chokokutai**; Latin horror/military **Metal Mania**, **Creepster**, **Nosifer**, **Eater**, **Butcherman**, **Pirata One**, **Black Ops One**, **Germania One**, **Cinzel Decorative**, **Keania One**, **Limelight**, **Unifraktur Cook**; Cyrillic display **Stalinist One**, **Kelly Slab**, **Poiret One**, **Ruslan Display**; KR **Gugi**, **Stylish**, **Yeon Sung**, **Dokdo**, **Song Myung**; CN brush/display **Liu Jian Mao Cao**, **Zhi Mang Xing**, **Long Cang**, **ZCOOL QingKe HuangYou**.
- Textured / distressed / stencil fonts: Latin+Cyrillic **Rubik Dirt / Distressed / Burned / Glitch / Wet Paint / Spray Paint / Marker Hatch / Moonrocks / Beastly / Broken Fax / Vinyl / Iso / Puddles**; Latin outline/stencil **Londrina Sketch/Outline/Shadow**, **Bungee Shade/Inline/Outline**, **Stardos Stencil**, **Wallpoet**, **Big Shoulders Stencil**, **Rock Salt**, **Permanent Marker**; JP brush **Yomogi**, **Zen Kurenaido**; KR brush/texture **Nanum Brush/Pen Script**, **East Sea Dokdo**, **Bagel Fat One**.
- OBS CC: optional `timing.send_translation_partials` — live-partial translations in `translation_1…4` modes (throttled like source); finals remain the fallback for LLM / providers without partials.
- OBS panel: hint for Twitch native CC languages (CEA-608/708 — Latin scripts reliable; Cyrillic/CJK → browser overlay).
- CJK fonts in `bin/fonts/`: **Zen Maru Gothic** (JP), **RocknRoll One** (JP display), **ZCOOL XiaoWei** (CN), **Black Han Sans** / **Jua** (KR); font pickers show alphabet tags with ` · ` (`Oswald Bold · Latin`, `Noto Sans Regular · Latin · Cyrillic`, …).
- Presets that already had Cyrillic stacks now include matching CJK fallbacks (soft: Zen Maru / ZCOOL / Jua; bold/HUD: RocknRoll / ZCOOL / Black Han Sans; anime: ZCOOL / Jua on top of Mochiy).

### Changed

- Idle subtitle preview: translation lines show short sample phrases in every supported target language instead of tags like `RU`/`JA`, so font stacks can be judged on Cyrillic, CJK, and other scripts.
- Style → slot overrides: tabs only for `source` and enabled translation lines (same rule as OBS `translation_*` modes), with language in the label.
- OBS panel: `translation_*` modes list only enabled Translation lines (with language in the label); a selected inactive slot is marked and normalize resets it to `disabled`.
- OBS overlay renderer split into ESM modules under `bin/overlay/shared/js/subtitle-style/` (entry `index.js`) instead of the `subtitle-style.js` monolith. Public `window.SubtitleStyleRenderer` API and fast/slow-path behavior are unchanged.
- Subtitle style slots aligned with the **4** translation-line cap: dropped leftover `translation_5` from JS/Rust `LINE_SLOT_NAMES` and built-in presets; `inferStyleSlot` clamp is 1…4.
- Overlay i18n: `npm run i18n:bundle` emits a minimal CEF bundle (`document.title.overlay` only) instead of the full dashboard catalog (~193 KB → ~0.5 KB).

### Fixed

- Overlay stacked: line background/frame hugs the text again (like `single` / `dual-line`) instead of stretching to full stage width.
- Idle subtitle preview: changing text alignment (or line gap) updates immediately — fast-path re-renders now refresh stage/row layout CSS vars, not only surface styles (no full page reload).
- Idle subtitle preview: source line uses a native-script sample for the recognition language (`asr.browser.recognition_language` / `source_lang`), not UI-locale copy — e.g. Japanese recognition no longer shows Russian “Предпросмотр исходной строки” when the UI is Russian.
- Browser Web Speech: suppress Chrome “Restore pages?” / unclean-shutdown bubble on every worker relaunch — add `--hide-crash-restore-bubble` and clear `exit_type`/`exited_cleanly` in the isolated profile before spawn (worker stop uses `taskkill /F`).
- Browser Web Speech: harden worker Chrome launch for current Stable (133+) — disable `AllowAggressiveThrottlingWithWebSocket` + `BatterySaverModeAvailable`, add `--disable-field-trial-config`, `--disable-hang-monitor`, `--audio-process-high-priority`.
- Browser Web Speech: `network` / `audio_capture` restart delay is fixed (`network_reconnect_initial_ms`, default 500 ms) — no exponential growth up to `network_reconnect_max_ms`.
- Runtime Diagnostics (Tools): translation metrics (`jobs started`, latency, provider) show again — summarized `translation_diagnostics` no longer wipes `translation_*` keys in `metrics`; for Local ASR — live decode/partial/final counters, capture/EP instead of a misleading `worker: Disconnected`.
- Runtime Diagnostics: `logging.runtime_metrics_enabled` (Tools, default off) — detailed translation/Local ASR metrics and high-churn `diagnostics_update` only on demand, so active recognition does not pay extra fanout cost.
- Local ASR: translation to Russian (and other targets) works again — ingest no longer labels Parakeet text with `asr.browser.recognition_language` (e.g. `ru-RU`), which made EN→RU look like a same-language copy of the English ASR line. With `source_lang=auto`, Local ASR keeps `auto` for MT; TTS still maps `auto`→`en`.
- Local ASR CUDA: `int8` / `int8_smoothquant` decode stays on CPU (no CUDA kernels for integer-quant ops) — UI/log warning; use **fp16** (~1.2 GB) or **fp32** (~2.5 GB) for GPU. ORT `1.24.2` cuda13 still registers correctly; bumping to 1.28 alone does not move int8 onto the GPU.
- Local ASR: catalog adds **fp16** (`grikdotnet/parakeet-tdt-0.6b-fp16`) — lighter floating-point analog of int8 for CUDA.
- Local ASR: module readiness on the main dashboard (Modules badge + Live mode selector) updates immediately after setup / window focus, without switching tabs (`runtime_update` + focus refresh).
- OBS Closed Captions: Live chip no longer turns red for `stream_not_running` (connected, stream not started yet); status uses `connection_state`.
- OBS CC: debug-mirror `SetInputSettings` failures no longer block native `SendStreamCaption`.
- OBS CC: `enabled` is the master gate for the debug mirror (no WS without it); hot path skips enqueue when OBS is off.
- OBS CC: queue overflow prefers dropping partials/payloads over `DelayedClear`; enqueue uses an atomic worker flag (no `try_lock` drops); faster stream-status poll (3s) while inactive.
- OBS panel: `connection_state` via i18n; partial-throttle UI in `source_live` and `translation_*`.
- Browser Web Speech continuous: stall with orphan partial commits without full restart; stall grace 12 s; long-segment flush ≥450 chars; faster `watchdog_stall` / flush restart delays.

## [0.6.1] - 2026-07-30

### Added

- Local ASR VAD: `speech_pad_ms` is applied (extends finalize + trailing pad); **text-aware silence hold** (`text_hold_enabled` / `text_hold_extra_ms`) avoids cutting mid-phrase pauses when the draft looks incomplete (EN/RU/JA heuristics).
- Local ASR: optional **Silero VAD** backend (`vad.backend = silero`, `silero_threshold`); ~2 MB model via `deps/download` `silero_vad`. Missing model falls back to WebRTC.
- Optional **live-partial** translation for classic MT providers (Google/DeepL/Azure, etc.): translate growing ASR partials without waiting for the final. LLM lines always wait for final. Off by default (`translation.live_partial`).
- Translation provider **`microsoft_edge`** (Microsoft Edge Translate) — no API key. Fetches the anonymous JWT from `edge.microsoft.com/translate/auth` (cached 7 min in-process, refreshed once on `401`/`403`) and calls `api-edge.cognitive.microsofttranslator.com`, so quality is real Azure Translator.

### Changed

- GitHub repository renamed to [`kiriuru/Kagevi-Subtitles`](https://github.com/kiriuru/Kagevi-Subtitles). Update checks and release links use the new slug (`DEFAULT_GITHUB_REPO`); existing configs with `kiriuru/VoiceSub` migrate on load.
- `free_web_translate` now uses `clients5.google.com/translate_a/t?client=dict-chrome-ex`. It was previously a duplicate of `google_web` hitting the identical `translate.googleapis.com` URL, so it shared one quota and could not act as a fallback when Google throttled. The three keyless providers now sit on three independent hosts.
- Overlay row layout: removed “Compact stacked” from the preset select (it was an alias → `stacked` + compact flag that normalize immediately rewrote, so the select snapped back). Compact spacing remains a separate checkbox.
- Subtitles line order: per-row ↑/↓ controls instead of a shared Move Up/Down toolbar.
- Visible translation line count follows enabled Translation lines; removed the separate “Maximum translated lines on screen” control (`subtitle_output.max_translation_languages` is derived on normalize).
- Translation lines capped at **4** (`translation_1`…`translation_4`).
- Product rebrand to **Kagevi Subtitles** (Kagevi = main brand, Subtitles = sub-brand): UI, installer/`productName`, bundle id `com.kagevi.subtitles`, npm `kagevi-subtitles`, cargo bin `kagevi-subtitles`, loopback header `x-kagevi-subtitles-token` (previous `x-kagevi-voice-token` and legacy `x-voicesub-token` still accepted). Internal crates remain `voicesub-*`.
- Clippy: enable workspace `clippy::pedantic = warn` (with curated allows for high-churn docs/API/cast/style noise so CI `-D warnings` stays green); keep deny for async hygiene + `redundant_clone`.
- Single version source: `voicesub-types::PROJECT_VERSION`; `scripts/sync-version.mjs` syncs Cargo / package.json / tauri.conf.json / `src/lib/project-version.ts` (`npm run version:sync` / `version:check`).

### Fixed

- Overlay layout: `single` / `dual-line` again place multiple items on one physical row (horizontal). CSS always used `flex-direction: column`, so single, dual-line, and stacked looked identical. Preset switches no longer stick on the finalize fast-path without rebuilding the DOM.
- TTS: source speech works again with Local ASR — ingest no longer leaves `source_lang=auto` (Google TTS `tl=auto` failed silently); falls back to `asr.browser.recognition_language` or `en`. Web Speech was unaffected (worker already sent a concrete language).

### Removed

- Translation provider `public_libretranslate_mirror`. Every keyless public LibreTranslate instance is now offline or refuses API traffic — the shipped default `translate.fedilab.app` answers `403 Request forbidden by administrative rules` at the edge, regardless of headers. Existing configs migrate to `microsoft_edge` (also keyless, so no API key suddenly becomes required) on both save and legacy import.

## [0.6.0] - 2026-07-18

### Added

- Fonts in `bin/fonts/`: **IBM Plex Mono**, **IBM Plex Serif**, **Source Code Pro** for dual-script presets and Cyrillic.
- Subtitle effects `pulse` and `reveal`.
- UI Theme: interface font picker (`ui.font_family`) applied to dashboard, Web ASR, TTS, and Local ASR via `ui_config_sync`.
- About VoiceSub credits dialog from the nav-rail avatar.
- Built-in **Help**: quick-start checklist and topic cards (recognition, translation, subtitles, style, OBS, tools) instead of a single prose block.
- **Local ASR** module (`/local-asr`) вЂ” offline Parakeet TDT via ONNX Runtime (CPU / optional CUDA), setup wizard, Modules card with ready / CPU / CUDA badges.
- Live ASR mode `local_parakeet` when the module is `ready` (in-process mic + VAD + decode; no Chrome Web Speech worker).
- Protected HTTP API `/api/asr/local/*` for status, config, deps, model download/load, EP probe, mic list, and test bench.
- Module settings under `user-data/modules/local-asr/`; project `asr.mode` stays in `user-data/config.toml`.
- `voicesub-partial-emit` crate (`word_growth` partial policy) wired into the existing subtitle / translation / overlay path.
- Latency presets `low` / `balanced` / `quality`, hallucination filter, emit telemetry, and setup checklist (deps в†’ model в†’ mic test в†’ final).
- China-market translation providers with free-tier quotas: `baidu_translate`, `youdao_translate`, `tencent_tmt`, and `caiyun_translator` (zh/en/ja); **17** providers total, grouped as **China / Free-tier** (i18n hints/status).
- вЂњOpen provider setup / API keysвЂќ button for cloud providers (Google, Azure, DeepL, OpenAI, OpenRouter, LibreTranslate, Baidu, Youdao, Tencent, Caiyun, etc.; local LLMs excluded).
- LLM: **Override default subtitle prompt** checkbox (hideable custom prompt) for OpenAI / OpenRouter / LM Studio / Ollama.
- OpenAI: **Show models** loads a live list via `POST /api/openai/models` (official `/v1/models`, chat-model filter); curated list updated from the 2026 OpenAI catalog (`gpt-5.6-*`, `gpt-5.4-*`, вЂ¦); **Show all chat models** toggle.
- LM Studio: **Test connection** probes `base_url` and loads available models.
- Installer artifact `VoiceSub_0.6.0_x64-setup.exe`.

### Fixed

- TTS (and Local ASR) module window open: restore `async` Tauri commands for `WebviewWindowBuilder::build` вЂ” sync IPC deadlocked the whole app on Windows (WebView2).
- Local ASR: restore `max_segment_ms` to **5500** (UI / SST parity). The **120000** preset/default disabled force-final вЂ” partials could grow for minutes without a Final when WebRTC VAD stayed sticky; loading a config with exactly `120000` heals it back to `5500`.
- Local ASR / runtime idle CPU: heartbeat no longer runs a full `env_check` (CUDA/DLL scan) every tick вЂ” `diagnostics()` and `GET /api/asr/local/status` use the status cache; DLL lookup indexes each directory once; mic enumeration runs in `spawn_blocking`; Local ASR window defers mic list until after first paint; dialog open/close avoids re-entrancy spin.
- Local ASR: WebView2 memory/CPU blow-up on module open вЂ” `setLocale` is idempotent (stops `sst:locale-changed` + BroadcastChannel feedback loops); module no longer connects to `/ws/events` for UI sync (Tauri IPC is enough).
- TTS: same вЂ” disable `/ws/events` for UI sync (IPC already delivers `ui_config_sync`); locale sync uses `applyDashboardLocale` / idempotent `setLocale` (no Local-ASR-style leak thanks to the existing guard, but WS was still receiving overlay/runtime frames).
- Main dashboard: not affected by that leak (UI sync publisher only вЂ” no subscribe / `sst:locale-changed` loop; `ui_config_sync` ignored in the store); `applyUiFromConfig` skips re-applying theme/locale/sync when the presentation signature is unchanged.
- Startup/shutdown: Local ASR `env_check` no longer blocks service construction (CUDA Toolkit bin scans); DLL lookup checks direct paths first again; dashboard applies settings/theme before waiting on runtime status; last-known theme restored from localStorage before HTTP.
- Tools & Data: clear success/error feedback correctly; confirm before load/overwrite profiles; block deleting `default`; validate profile names; warn on importing redacted config; disable import while busy; show Local ASR readiness; drop duplicate stale-dropped metric; full logging applied live after Save (no false restart hint); save/delete no longer report success if profile list refresh fails; `diagnostics_update` keeps `local_module` / `active_mode`; success/error modal explains where files were saved (Downloads / `user-data/exports` / `user-data/profiles`).
- Profiles: seed/upgrade sparse `default.json` from full factory defaults; reject Windows reserved names.
- Diagnostics export: unique `diagnostics-{secs}_{ms}.zip` names; keep newest 12 ZIPs (prune is best-effort so export still succeeds); clearer HTTP error messages for delete/export.
- Docs: profiles are `{name}.json` (not `.toml`); diagnostics ZIP retention documented.
- Dashboard: checkbox/select edits no longer reset window size and position (resize+center only when `ui.layout` changes).
- UI language change persists the current in-memory config (no longer overwrites import/profile via stale `lastSavedConfig`).
- Web Speech advanced settings no longer force `asr.mode = browser_google`.
- OBS overlay: stale-guard activates after the module script loads; runtime-gone timers no longer pile up.
- Browser worker: autostart timer and lifecycle listeners cleared in `destroy()`.
- Section scroll-spy uses the shell scroll container; Subtitles nav opens the panel with top tabs Subtitles/Style directly (no intermediate hub).
- Primary tab icons (nav rail / bottom nav) enlarged ~15%.
- TTS / Local ASR / Web Speech worker scroll: `overflow: hidden` scoped to the dashboard standard shell only (not global `html/body`).
- Local ASR: setup Close and вЂњRe-checkвЂќ buttons match the rest of the UI.
- Dark-theme dialogs readable again (runtime Details, credits, Local ASR status/alert/setup) вЂ” `color-scheme` plus explicit text color instead of UA `CanvasText`.
- UI theme hot-applies to Local ASR and TTS without Save (IPC + WS fallback); i18n for `style.ui_theme.font` / `font.default`.
- Browser Google ASR lifecycle:
  - failed Chrome launch clears `runtime_running` and stops browser speech ingest (same as Local ASR failure path);
  - PID tracking / `browser-worker.pid` cleared only when Chrome is actually gone; a still-live process after failed `taskkill` is kept for orphan reap;
  - IPC `launch_browser_worker` records PID in the shared orchestrator and terminates any previous worker (no second orphan Chrome);
  - Local ASR start reaps leftover Chrome first;
  - `generationId` bumps on every controlled start; pending restart cancel uses `stopEpoch` (user/control stop);
  - WS transport replace drops the previous outbound **without** sending `stop` (avoids killing recognition on reconnect).
- **Word replace (pre-translation):** cached Aho-Corasick/regex; CJK with default whole-words; stems; mask form `fuck`в†’`f*ck` (not `***`); already-masked `f*ck` is left alone. Subtitle lifecycle unchanged.
- IPC ACL: `get_loopback_api_token` allowlisted again (fallback when HTML injection is missing).
- `runtime-event`: `listen` в†’ buffer в†’ snapshot в†’ drain (live frames are not overwritten by a stale snapshot); dashboard snapshot prefers `overlay_update`; TTS snapshot is `runtime_update` + `twitch_connection_update` only.
- `tts-speech-activity` / `playback-finished` use `emit_to(tts)` only (not a global emit into main/local-asr).
- Twitch chat в†’ `RuntimeEventBus` only (no OBS `/ws/events` flood); connection updates still hit the hub for replay.
- Lag-resync: pending queue (last needed sync is never dropped); discard coalesced overlay on `Lagged` so a timer cannot regress UI after snapshot.
- `Jet Brains Mono` name matches the font catalog; `JetBrains Mono` alias on normalize.
- OBS overlay keeps `style_slot` / `slot_id`; dashboard preview calls `disposeRenderContainer` on `render().empty`.
- Renderer: `colorToRgba` (named/`rgb()`/`#rrggbbaa`); emoji on code-point boundaries; whitespace-only filtered; `inferStyleSlot` + `slot_id`; fast path skips disconnected surfaces.
- LM Studio / Ollama: JIT model load is no longer aborted by the default 10s timeout (`Engine protocol startup was aborted` / `Model is unloaded`); local providers get a **в‰Ґ120s** timeout floor; LM Studio requests include `ttl`.
- Provider setup buttons open the system browser (`open_external_https_url` allowlist includes provider console hosts).
- Baidu Translate: POST form-urlencoded instead of GET; `sv` в†’ `swe` language map; Youdao parses numeric `errorCode`.
- Translation persistent cache no longer wiped on every runtime start; disk cache survives restart when settings are unchanged.
- Translation dispatcher no longer leaks `active_jobs` when the same sequence is submitted twice; queue overflow no longer holds the dispatcher lock across relevance checks.
- Live settings apply for translation awaits the engine lock (API keys / lines are not silently skipped) and refreshes provider concurrency limits.
- HTTP translation timeouts honor configured `timeout_ms` (per-request timeout wired through all providers).
- Local LLM readiness probe accepts hostnames such as `localhost` (DNS resolve), not only IP literals.
- Preview supersession is robust to generation counter edge cases; short-circuit empty/identical-lang results no longer report a false cache hit.

### Changed

- Rust: workspace lints + `clippy.toml` (MSRV 1.85) вЂ” deny `unused_async` / `await_holding_lock` / `await_holding_refcell_ref` / `redundant_clone` (pedantic-light); CI `clippy -D warnings` green again.
- Async hot paths: runtime start/stop moves Chrome kill/launch and Local ASR start/stop to `spawn_blocking`; config-save error path drops the write lock before status/broadcast; translation finals release the controller mutex before enqueue; Local ASR ORT unload/init and zip extract run off the Tokio worker.
- Style panel: compact numeric field grid; text align and effect on one row.
- Built-in style catalog rebuilt (**20** presets): themed dual-script stacks (Film Noir, Retro Terminal, Fallout, Anime Stream, and others); near-identical dark plates collapsed to **4 materials** вЂ” Max Contrast, Podcast Subtle (parchment), Glass Frost (milky ice ~44%), Twitch Lower-Third (`#9146FF` + Oswald). Removed `sakura_soft`, `minimal_mono`, `editorial_news` (migrate в†’ `meeting_soft` / `glass_frost` / `dark_cinema`).
- **Retro Terminal**: Cyrillic via **IBM Plex Serif Regular**.
- Latin-only faces in `/project-fonts.css` declare `unicode-range` so Cyrillic falls through to the next stack face (Plex / Ubuntu / Noto / ComfortaaвЂ¦).
- Outline width: **ASS/Aegisub 0вЂ“4 px** scale (step 0.1).
- Effects: `fade` is opacity-only; `glow` follows fill color; OBS partials cheapen heavy `blur_in`/`glow` to `fade`; `prefers-reduced-motion` honored.
- Tauri IPC capabilities split per window: **main** (full shell), **tts** (playback/Twitch/snapshot), **local-asr** (token + allowlisted URLs).
- TTS: HTTP `/api/runtime/status` poll only when `runtime-event` is down; speech-context poll slower while IPC is healthy (focus still refreshes immediately).
- Browser Speech worker is **Google Chrome only** (`/google-asr`): removed `/google-asr-edge`; import `browser_google_edge` в†’ `browser_google`; orphan reap only for `chrome.exe`.
- Browser worker CPU affinity is **opt-in** (`VOICESUB_BROWSER_AFFINITY` / `VOICESUB_BROWSER_AFFINITY_MASK`); off by default.
- `runtime-event` routing: **local-asr** window receives `ui_config_sync` (live theme/locale/font); `/ws/events` replays the last `ui_config_sync` on connect.
- Help copy updated for Local ASR / Modules / word replace; HelpPanel i18n reacts to locale changes.
- Documentation and wiki mark Local ASR as shipped; Technical Architecture В§18 documents the module.
- SST JSON import preserves `local_parakeet`; legacy `local` / experimental modes still map to `browser_google`.
- Translation `timeout_ms` / HTTP client ceiling: **300s** (was 60s); Settings UI and config normalize aligned.
- Persistent translation cache path is `user-data/translation-cache/` (legacy `user-data/cache/translation_cache.json` is copied once on upgrade).
- Translation cache keys hash source text; cache flushes on engine drop; LLM `used_default_prompt` / `override_prompt` settings.
- DeepL maps UI language codes (`en`/`zh-cn`/`pt`, вЂ¦) to API targets and auto-selects Free vs Pro URL from the API key (`:fx` в†’ free).
- Google Cloud Translation v3 expands short model ids to full resource names; Google v3 settings labels i18n added.
- Azure / LibreTranslate map Chinese UI codes (`zh-Hans`/`zh-Hant`, `zh`/`zt`); readiness surfaces soft warnings for empty Azure region and public LibreTranslate.

### Security

- Tauri IPC ACL least-privilege: `main` is shell-only (token, snapshot, layout, open module windows, URL openers); TTS commands only on the `tts` window; removed dead `launch_browser_worker` / `voicesub_version` / `tts_play_audio` / `tts_stop_channel`; deny frontend `emit`/`emit-to`; no dashboard `create-webview-window`.

## [0.5.5] - 2026-06-26

### Added

- Dedicated Tauri IPC pump with trailing-edge coalescing of dashboard `overlay_update` (default 90 ms; `VOICESUB_OVERLAY_IPC_MIN_INTERVAL_MS`; `0` disables). OBS `/ws/events` still receives every frame.
- Runtime metrics for bus lag and overlay IPC coalescing on `/api/runtime/status`.

### Changed

- Subtitle lifecycle runs before WS/IPC fanout; partial `transcript_update` broadcast is async so ingest is not blocked.
- Lock-free WS `global_sequence`; safer debounced snapshot resync after bus lag.
- Dashboard skips the frequent HTTP runtime poll when Tauri IPC is connected (30 s safety-net remains).

### Fixed

- Web Speech `audio-capture` errors auto-retry with exponential backoff instead of stopping recognition permanently.

## [0.5.4] - 2026-06-21

### Added

- Per-window Tauri `runtime-event` routing (dashboard vs TTS window).
- Leading-edge coalescing for partial `transcript_update` (default 90 ms; `VOICESUB_TRANSCRIPT_PARTIAL_MIN_INTERVAL_MS`).
- Browser worker: orphan PID reap on start; long-segment flush after monologues; overlap ASR handoff hardening.
- Advanced Web Speech settings in the dashboard; ingest latency diagnostics when full logging is on.

### Changed

- Live subtitle WebSocket fanout is `overlay_update` only; ASR is `transcript_update` only.
- `subtitle_payload_update` is Tauri IPC snapshot/replay only (not published on `/ws/events`).
- Browser worker process priority uses `ABOVE_NORMAL_PRIORITY_CLASS`.
- Diagnostic timestamps use RFC 3339 strings instead of epoch seconds.
- TTS volume range up to 150%; Twitch chat filters (mentions, digits, links) and IRC reconnect hardening.
- Deprecated subtitle lifecycle timing keys cleaned up in config.

### Removed

- Duplicate live broadcasts: `transcript_segment_event` and `subtitle_payload_update` on `/ws/events`.
- TTS module JS queue pump and deprecated TTS IPC surface.

### Fixed

- HTTP/WS fanout path correctness; Twitch chat log in the TTS module.
- TTS pipeline reliability (prefetch, config I/O, audio-chunk ordering).

## [0.5.3] - 2026-06-17

### Added

- Loopback API auth completion for protected `/api/*` (`x-voicesub-token`).
- GitHub Releases update check (`POST /api/updates/check`) with dashboard banner.
- Material 3 primary navigation shell on the dashboard.
- Background-tasks diagnostics on the HTTP status surface.

### Changed

- Browser Speech worker UI polish; TTS module loopback/styling; Twitch IRC auto-reconnect.
- Toolchain edition **Rust 2024**; CI and commit-convention docs.
- Migration: loopback token required for protected dashboard HTTP helpers (trusted pages inject `window.__VOICESUB_API_TOKEN__`).

### Fixed

- OBS overlay logging hardening (follow-up).
- Dead-code and unused i18n key prune.

## [0.5.2] - 2026-06-14

### Added

- Loopback API auth + overlay liveness checks.
- Rust TTS speech pipeline on the hot path; RuntimeEventBus snapshot improvements.
- Browser worker launch stability and overlap / browser-trace telemetry.

### Changed

- OBS Closed Captions send algorithm.

### Fixed

- TTS / Twitch issues on top of 0.5.1; dashboard UI polish.

## [0.5.1] - 2026-06-13

### Added

- Native dual-sink TTS (speech + Twitch) via Rust/cpal; **Sonic** tempo mode (pitch-preserving).
- Twitch multi-channel (up to 5 IRC joins per OAuth) with hot-apply chat filters.
- Resource telemetry bar; WebView2 power/memory policy; size-based log rotation.
- Translation / Web Speech top-20 language lists; OBS CC stable error codes with UI i18n.

### Changed

- TTS `playback_mode: "browser"` migrates to `sonic` on load; HTMLAudio playback path removed.
- Twitch legacy `channel` в†’ `channels[0]`; digit preservation in chat TTS.
- Compact client logging by default (TTS UI traces require full logging).

### Fixed

- TTS enqueue IPC when `dropped_ids` is empty; Twitch language detection for link-only lines.
- Mic monitor leaks and cleaner Web Speech abort on worker stop.

### Removed

- Browser `HTMLAudio` / `setSinkId` playback path for TTS.

## [0.5.0] - 2026-06-10

First VoiceSub release (successor to SST Desktop `0.4.4`). Stack and delivery are new; subtitle/translation meaning preserved.

### Added

- Rust + Tauri 2 desktop app (`VoiceSub.exe`, NSIS `VoiceSub_{version}_x64-setup.exe`).
- Svelte 5 dashboard, vanilla OBS overlay, Svelte Web Speech worker (`/google-asr`).
- TTS module (`/tts`) with Twitch chat TTS; OBS Closed Captions (`voicesub-obs`).
- TOML config (`config_version` 8), SST `config.json` import, profiles, diagnostics ZIP.
- UI locales: en, ru, ja, ko, zh; GitHub Releases update check.

### Changed

- Product renamed to **VoiceSub**; default bind `127.0.0.1:8765`.
- Production ASR mode in core: `browser_google` (Chrome/Edge worker).

### Removed

- FastAPI / pywebview / PyInstaller SST desktop stack from active core.
- Legacy local ASR, remote controller/worker, experimental browser routes (archived under `legacy/`).
- Splash startup profiles.

## [0.4.4] - 2026-05-31

> Frozen SST Desktop line. Active development continues as VoiceSub.

### Security

- SSRF policy for OpenAI helper model routes when LAN bind is enabled.

### Added

- Shared overlay WebSocket stale-guard; desktop context store bridge.
- UI locales ja / ko / zh for dashboard, worker, and overlay.

### Changed

- Desktop launcher split into modules; overlay reconnect preserves last frame.

### Fixed

- Dashboard bootstrap error banner; bind/profile path safety tests.

## [0.4.3] - 2026-05-27

### Added

- Desktop profile lock and related launcher hardening (SST).

### Fixed

- Overlay and runtime stability follow-ups on the 0.4.2 line.

## [0.4.2] - 2026-05-25

### Added

- Further SST desktop polish toward the 0.4.x frozen line.

### Fixed

- Browser worker and overlay reconnect edge cases.

## [0.4.1] - 2026-05-20

### Added

- SST Desktop incremental features and config migrations on the 0.4.0 base.

### Fixed

- Dashboard and worker reliability patches.

## [0.4.0] - 2026-05-16

### Added

- SST Desktop 0.4.0 feature set (config_version lineage toward 7).

### Changed

- Architecture and packaging steps toward the frozen 0.4.4 baseline.

## [0.3.2] - 2026-05-14

### Fixed

- SST Desktop stability patches after 0.3.1.

## [0.3.1] - 2026-05-12

### Fixed

- SST Desktop follow-up fixes after the 0.3.0 modularization release.

## [0.3.0] - 2026-05-08

### Added

- Modular FastAPI backend services and frontend module stack (SST).
- Browser Speech session supervisor FSM; config migrations / schema export.

### Changed

- Thinner API routes; shared paths, logging, redaction utilities.

### Fixed

- WebSocket disconnect cleanup; runtime event coalescing; client log best-effort mode.

### Removed

- Unsupported backend ASR experiments from the active product surface.

## [0.2.9.2] - 2026-04-30

Earlier `0.2.9.*` SST Desktop history lives in archived GitHub release notes and is not expanded here.

[unreleased]: https://github.com/kiriuru/Kagevi-Subtitles/compare/v0.6.5...HEAD
[0.6.5]: https://github.com/kiriuru/Kagevi-Subtitles/compare/v0.6.4...v0.6.5
[0.6.4]: https://github.com/kiriuru/Kagevi-Subtitles/compare/v0.6.3...v0.6.4
[0.6.3]: https://github.com/kiriuru/Kagevi-Subtitles/compare/v0.6.2...v0.6.3
[0.6.2]: https://github.com/kiriuru/Kagevi-Subtitles/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/kiriuru/Kagevi-Subtitles/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/kiriuru/Kagevi-Subtitles/compare/v0.5.5...v0.6.0
[0.5.5]: https://github.com/kiriuru/Kagevi-Subtitles/compare/v0.5.4...v0.5.5
[0.5.4]: https://github.com/kiriuru/Kagevi-Subtitles/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/kiriuru/Kagevi-Subtitles/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/kiriuru/Kagevi-Subtitles/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/kiriuru/Kagevi-Subtitles/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/kiriuru/Kagevi-Subtitles/releases/tag/v0.5.0
[0.4.4]: https://github.com/kiriuru/stream_sub_translator/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/kiriuru/stream_sub_translator/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/kiriuru/stream_sub_translator/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/kiriuru/stream_sub_translator/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/kiriuru/stream_sub_translator/compare/v0.3.2...v0.4.0
[0.3.2]: https://github.com/kiriuru/stream_sub_translator/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/kiriuru/stream_sub_translator/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/kiriuru/stream_sub_translator/compare/v0.2.9.2...v0.3.0
[0.2.9.2]: https://github.com/kiriuru/stream_sub_translator/releases/tag/v0.2.9.2
