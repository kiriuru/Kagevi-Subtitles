# VoiceSub — Tauri Capabilities / IPC ACL Audit

**Date:** 2026-07-18  
**Scope:** `src-tauri/capabilities/*`, `src-tauri/permissions/*`, `src-tauri/build.rs`, registered commands vs frontend `invoke`  
**Threat model:** XSS / compromised script in a trusted loopback webview (`main`, `tts`, `local-asr`); local process on same machine  
**Recommendation:** **CONDITIONAL** — split-by-window ACL is correct and intentional; tighten least-privilege and remove dead IPC before treating ACL as “done”

---

## 1. Executive Summary

| Severity | Count | Top theme |
| --- | --- | --- |
| HIGH | 1 | Dead `launch_browser_worker` still allowlisted on `main` |
| MEDIUM | 4 | Over-broad `allow-voicesub-ipc` / TTS URL ACL; unused create-window core perms; `core:event` emit |
| LOW | 3 | Dead `voicesub_version` / unused `tts_play_audio`·`tts_stop_channel`; CSP `unsafe-inline` context |

**Verdict:** Per-window capability split (`default` / `tts` / `local-asr`) is real and matches the documented design. Custom command allowlists exist and `AppManifest::commands` is wired in `build.rs` (Tauri 2 ACL is active, not “allow all”). Remaining risk is **least-privilege drift**: `main` still carries the full TTS surface, and several permissions have no frontend callers.

---

## 2. Capability Map (as shipped)

| Capability | Window label | Custom permission | Core extras |
| --- | --- | --- | --- |
| `default` | `main` | `allow-voicesub-ipc` (full shell + all TTS cmds) | `core:default` + set-size/min/max/center + **create** + **create-webview-window** + show/focus |
| `tts` | `tts` | `allow-voicesub-tts-ipc` | `core:default` + show/focus |
| `local-asr` | `local-asr` | `allow-voicesub-local-asr-ipc` | `core:default` + show/focus |

**Remote ACL (all three):**

```json
"remote": { "urls": ["http://localhost:*", "http://127.0.0.1:*"] }
```

Required because UIs load from the embedded Axum server, not `frontendDist` asset origin. Caps IPC to loopback HTTP origins (not arbitrary remote sites).

**URL command validators (defense in depth, not ACL):**

| Command | Validation |
| --- | --- |
| `open_external_https_url` | HTTPS + explicit host allowlist (`shell.rs`) |
| `open_local_http_url` | `http` + loopback host only |
| `tts_open_system_url` | prefix `https://id.twitch.tv/` only |

---

## 3. Command × Window × Caller Matrix

| Command | main | tts | local-asr | Frontend caller(s) |
| --- | :---: | :---: | :---: | --- |
| `voicesub_version` | ✅ | ✅ | ✅ | **none** |
| `get_loopback_api_token` | ✅ | ✅ | ✅ | `src/lib/loopback-api.ts` (fallback; all windows via `initLoopbackApiToken`) |
| `launch_browser_worker` | ✅ | — | — | **none** (Rust + docs only) |
| `get_runtime_state_snapshot` | ✅ | ✅ | — | `src/lib/runtime-events.ts` (dashboard + TTS) |
| `set_dashboard_layout` | ✅ | — | — | `src/lib/compact-window.ts` |
| `tts_open_window` | ✅ | — | — | `src/lib/api.ts` |
| `local_asr_open_window` | ✅ | — | — | `src/lib/api.ts` |
| `open_external_https_url` | ✅ | ✅ | ✅ | dashboard + local-asr; **not TTS** |
| `open_local_http_url` | ✅ | ✅ | — | dashboard only; **not TTS** |
| `tts_open_system_url` | ✅ | ✅ | — | `src-tts` OAuth only |
| TTS config/playback/Twitch cmds | ✅ | ✅ | — | `src-tts/lib/tts-ipc.ts` (TTS window) |
| `tts_play_audio` / `tts_stop_channel` | ✅ | ✅ | — | **none** (registered only) |

---

## 4. Findings

### HIGH-1 — Dead but privileged: `launch_browser_worker` on `main`

- **Where:** `permissions/allow-voicesub-ipc.toml`, `lib.rs` handler, `build.rs`
- **Evidence:** No `invoke("launch_browser_worker")` in `src/`, `src-tts/`, `src-local-asr/`
- **Attack (XSS on main):** spawn/reap Chrome worker profile → local process / mic UX impact, orphan-guard churn
- **Fix:** Remove from ACL + `generate_handler!` + `build.rs` if truly unused; **or** restore the single intentional caller and keep ACL only on `main`

### MEDIUM-1 — `main` allowlists entire TTS IPC surface

- **Where:** `allow-voicesub-ipc.toml` lists all `tts_*` commands
- **Evidence:** Dashboard only invokes `tts_open_window` (+ shell helpers). TTS UI runs in label `tts`
- **Blast radius:** XSS in dashboard can mutate TTS config, Twitch connect, speak samples, clear channels without opening the TTS window
- **Fix:** Shrink `allow-voicesub-ipc` to shell-only: token, snapshot, layout, open windows, URL openers. Keep TTS commands exclusively on `allow-voicesub-tts-ipc`

### MEDIUM-2 — TTS ACL grants unused URL openers

- **Where:** `allow-voicesub-tts-ipc.toml` → `open_external_https_url`, `open_local_http_url`
- **Evidence:** TTS uses `tts_open_system_url` only
- **Fix:** Remove both from TTS permission (keep `tts_open_system_url`)

### MEDIUM-3 — Frontend window-create permissions on `main` unused

- **Where:** `capabilities/default.json` → `core:window:allow-create`, `core:webview:allow-create-webview-window`
- **Evidence:** Module windows are created in Rust (`WebviewWindowBuilder` in `tts.rs` / `local_asr.rs`). No frontend `WebviewWindow` create
- **Note:** Rust-side builders do **not** need these frontend ACL entries
- **Risk:** XSS on `main` can try to create labeled webviews; capability matching is by label — creating `tts` / `local-asr` with attacker-controlled loopback URL is the interesting case
- **Fix:** Drop both from `default.json` unless a documented frontend create path appears

### MEDIUM-4 — `core:event:default` includes `emit` / `emit-to` on all windows

- **Where:** all three capabilities include `core:default` → `core:event:default` → `allow-emit`, `allow-emit-to`
- **Evidence:** [Tauri core permissions](https://v2.tauri.app/reference/acl/core-permissions/); dashboard/TTS `listen("runtime-event", …)`
- **Attack:** Compromised module webview emits forged `runtime-event` envelopes to `main` / self → UI spoofing (Twitch/runtime status). State-changing APIs still need HTTP token, so this is integrity/UX more than RCE
- **Fix:** Replace broad `core:default` event bundle with listen/unlisten-only (deny emit / emit-to) if build still works

### LOW-1 — Dead commands still ACL’d

- `voicesub_version` — no frontend invoke
- `tts_play_audio`, `tts_stop_channel` — registered + ACL’d, zero TS callers

**Fix:** Remove from handler/ACL/build.rs or wire the intended callers

### LOW-2 — Local ASR shares full external HTTPS host list

- Uses shared `open_external_https_url` (NVIDIA/GitHub needed; also gets all translation-provider hosts)
- Acceptable if command stays shared; optional narrower command for ASR-only hosts

### LOW-3 — CSP + token injection context

- `tauri.conf.json` CSP: `script-src 'self' 'unsafe-inline'` (needed for `__VOICESUB_API_TOKEN__` injection)
- Amplifies impact of XSS once present; not an ACL bug, but sets the residual risk floor for `get_loopback_api_token`

---

## 5. What Is Working Well

1. **Real per-window split** — Local ASR cannot call TTS/Twitch/browser-worker IPC (narrow `allow-voicesub-local-asr-ipc`)
2. **`AppManifest::commands` in `build.rs`** — ACL generation covers the custom command set (not default “all commands for everyone”)
3. **URL openers are allowlisted in Rust**, with unit tests in `shell.rs` / `voicesub-tts` IPC
4. **Event fanout is filtered in Rust** (`event_routing.rs`) so TTS/local-asr do not receive hot-path subtitle floods — orthogonal to ACL but reduces confusion / DoS
5. **No dangerous Tauri plugins** in `Cargo.toml` (no `fs` / `shell` / `http` plugin ACL sprawl); `tauri` features empty
6. **Token on module windows is intentional** — HTTP `/api/*` from TTS/Local ASR needs loopback token fallback when HTML injection fails

---

## 6. Suggested Least-Privilege Targets

### `allow-voicesub-ipc` (main only)

```toml
commands.allow = [
  "get_loopback_api_token",
  "get_runtime_state_snapshot",
  "set_dashboard_layout",
  "tts_open_window",
  "local_asr_open_window",
  "open_external_https_url",
  "open_local_http_url",
]
```

(Drop `launch_browser_worker` / `voicesub_version` unless restored; drop all other `tts_*`.)

### `allow-voicesub-tts-ipc`

Keep TTS + Twitch + snapshot + token + `tts_open_system_url` + `tts_report_webview_activity`.  
Remove `open_external_https_url`, `open_local_http_url`, and unused play/stop if deleted from handler.

### `capabilities/default.json`

Remove `core:window:allow-create` and `core:webview:allow-create-webview-window`.  
Keep size/center permissions only if the non-invoke fallback in `compact-window.ts` must keep working in-shell (primary path already uses `set_dashboard_layout`).

---

## 7. Test Coverage

| Area | Coverage |
| --- | --- |
| External/local URL validation | Unit tests in `src-tauri/src/shell.rs` |
| Twitch OAuth URL prefix | `crates/voicesub-tts/src/ipc.rs` |
| Trusted HTML token injection | `voicesub-runtime` HTTP tests |
| ACL allow/deny matrix | **Missing** — no automated test that window A cannot invoke command B |
| Dead-command detection | **Missing** — static audit only |

**Gap:** Add a small ACL regression test or CI script: parse permission TOMLs vs `rg 'invoke\\("…"'` call sites.

---

## 8. Blast Radius (XSS on each window)

| Window | With current ACL | After suggested tighten |
| --- | --- | --- |
| `main` | Token + snapshot + **launch Chrome** + **full TTS/Twitch** + open windows + URL open + create webview | Token + snapshot + layout + open module windows + URL open |
| `tts` | Token + snapshot + full TTS/Twitch + broad URL openers | Token + snapshot + TTS/Twitch + Twitch OAuth URL only |
| `local-asr` | Token + external HTTPS allowlist | Unchanged (already minimal) |

---

## 9. Methodology & Limits

- **Strategy:** FOCUSED ACL audit (capabilities + permissions + handler + all TS `invoke` sites)
- **Not covered:** Full XSS hunt in Svelte UI; WebView2 process isolation; LAN bind (`VOICESUB_ALLOW_LAN`) beyond noting HTTP token remains the API boundary
- **Confidence:** High on dead/over-permission findings (static call-graph); Medium on `emit_to` practical impact without a live PoC
- **Sources:** workspace files listed above; Tauri 2 core permission reference

---

## 10. Action Checklist

- [x] Remove or re-home `launch_browser_worker` (HIGH)
- [x] Split TTS commands out of `allow-voicesub-ipc` (MEDIUM)
- [x] Drop unused URL perms from TTS ACL (MEDIUM)
- [x] Drop frontend create-window perms from `default.json` (MEDIUM)
- [x] Consider deny `emit` / `emit-to` while keeping listen (MEDIUM)
- [x] Prune dead `voicesub_version` / `tts_play_audio` / `tts_stop_channel` (LOW)
- [x] Optional: ACL matrix CI check (`src-tauri/src/acl_matrix.rs`)
