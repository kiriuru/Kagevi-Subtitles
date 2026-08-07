# Kagevi Subtitles Wiki

User guide for **Kagevi Subtitles `0.6.4`** — how to get live subtitles on stream, what each screen does, and how to fix common problems.

<p align="center">
  <a href="../README.md">README</a> ·
  <a href="./WIKI.ru.md">Русский</a> ·
  <a href="./TECHNICAL_ARCHITECTURE.en.md">Architecture</a> ·
  <a href="./CHANGELOG.en.md">Changelog</a>
</p>

> [!TIP]
> On GitHub, open **Outline** (list icon in the file header) for a sidebar from headings. Use **Quick links** below for jumps.

## Quick links

<p align="center">
  <a href="#quick-start"><code>Start</code></a> ·
  <a href="#choose-recognition"><code>Recognition</code></a> ·
  <a href="#troubleshooting"><code>Fix</code></a> ·
  <a href="#where-things-are"><code>UI map</code></a> ·
  <a href="#browser-speech-web-speech"><code>Web Speech</code></a> ·
  <a href="#local-asr"><code>Local ASR</code></a> ·
  <a href="#translation"><code>Translation</code></a> ·
  <a href="#subtitles"><code>Subtitles</code></a> ·
  <a href="#obs"><code>OBS</code></a> ·
  <a href="#tts-module"><code>TTS</code></a> ·
  <a href="#tools-and-data"><code>Tools</code></a> ·
  <a href="#settings"><code>Settings</code></a> ·
  <a href="#glossary"><code>Glossary</code></a>
</p>

## Table of contents

<details open>
<summary><strong>Expand / collapse contents</strong></summary>

1. [About](#about)
2. [Quick start](#quick-start)
3. [Choose recognition](#choose-recognition)
4. [Troubleshooting](#troubleshooting)
5. [Where things are](#where-things-are)
6. [Browser Speech (Web Speech)](#browser-speech-web-speech)
7. [Local ASR](#local-asr)
8. [Translation](#translation)
9. [Subtitles](#subtitles)
10. [Subtitle style](#subtitle-style)
11. [UI theme](#ui-theme)
12. [OBS](#obs)
13. [Word replacement](#word-replacement)
14. [TTS module](#tts-module)
15. [Tools and data](#tools-and-data)
16. [Settings](#settings)
17. [Help](#help)
18. [Privacy and local-first](#privacy-and-local-first)
19. [Glossary](#glossary)

</details>

---

## About

Kagevi Subtitles turns your microphone speech into **live subtitles** for OBS — with optional translation, styling, TTS, and Twitch chat reading.

Everything runs on **your PC**. There is no account and no Kagevi cloud. The app listens on `http://127.0.0.1:8765` by default (this machine only).

| You want… | Use… |
| --- | --- |
| Fast setup, Google recognition in Chrome | **Web Speech** (default) |
| Offline recognition, no Chrome worker | **Local ASR** (Parakeet / ONNX) |
| Subtitles in OBS | Browser Source → `/overlay` |
| Optional cloud / free translation | **Translation** tab (up to 4 lines) |
| Read subtitles or chat aloud | **TTS** module |

Current version line: **`0.6.4`** (first Kagevi release was `0.5.0`).

> [!IMPORTANT]
> In OBS, use exactly: `http://127.0.0.1:8765/overlay`  
> After updating the app, **reload** that Browser Source if the overlay looks stuck or blank.

### System requirements

| Need | Why |
| --- | --- |
| Windows 10 or 11 (64-bit) | Supported platform |
| WebView2 Runtime | Powers the app windows (usually already on Windows 11; installer can add it on Windows 10) |
| Google Chrome | Only if you use **Web Speech**. Not required for Local ASR alone |
| Microphone | Granted in Chrome (Web Speech) or chosen in the Local ASR window |
| Internet | Optional for cloud translation; also needed the first time Local ASR downloads models / runtimes |

No Python or Node.js is required to run the installed app.

### Install and update

1. Run `Kagevi Subtitles_0.6.4_x64-setup.exe` (or the latest setup from the [releases page](https://github.com/kiriuru/Kagevi-Subtitles/releases)).
2. Open **Kagevi Subtitles.exe**.
3. Later updates: the dashboard can show an **update banner**. **Install update** downloads the signed NSIS installer (minisign), runs it, and relaunches the app. You can still close the app and install a new setup over the old one from GitHub. Settings in `user-data/` stay put.

Manual **Download** / release-page links remain available if you prefer not to install from inside the app.

### Useful local addresses

| Address | What it is |
| --- | --- |
| `http://127.0.0.1:8765/` | Main dashboard |
| `http://127.0.0.1:8765/overlay` | OBS Browser Source page |
| `http://127.0.0.1:8765/google-asr` | Chrome Web Speech worker |
| `http://127.0.0.1:8765/tts` | TTS module window |
| `http://127.0.0.1:8765/local-asr` | Local ASR module window |

<p align="right"><a href="#quick-links">↑ Quick links</a> · <a href="#table-of-contents">↑ Contents</a></p>

---

## Quick start

<p align="center">
  <img src="../Images/kagevi_live.png" alt="Live tab" width="820"><br>
  <em><strong>Live</strong> — Start/Stop, recognition status, transcript, subtitle preview</em>
</p>

### First stream setup (about 5 minutes)

1. **Install and launch** Kagevi Subtitles.
2. In **OBS**, add a **Browser Source**:
   - URL: `http://127.0.0.1:8765/overlay`
   - Width/height: match your canvas (or full canvas and crop).
3. On the **Live** tab, pick recognition:
   - **Web Speech** (default) — Chrome will open when you Start.
   - **Local ASR** — only appears after setup is finished (see [Local ASR](#local-asr)).
4. Optional: open **Translation**, turn translation on, enable at least one line, pick a provider (four work with **no API key** — see below).
5. Optional: open **Subtitles** / **Style** to set preset, TTL, fonts, and colors.
6. Press **Start**.
7. Speak — check the Live preview, then check OBS.

### Start and Stop (plain English)

| Button | What happens |
| --- | --- |
| **Start** | Begins recognition, translation (if enabled), and optional OBS captions. Uses your **current** on-screen settings, even if you have not pressed Save yet. |
| **Stop** | Stops recognition. For Web Speech, the Chrome worker is closed. Subtitle state resets. |

### Preview on Live

Before Start, the preview shows sample text so you can tune style. After Start, it shows what OBS should see. Saving settings alone will not wipe that preview when idle.

### Compact window

Use compact layout for a tall, phone-like window on a second monitor (**Settings** → Layout, or `Ctrl+K`). Live stays in focus; other hubs stay one tap away.

<p align="right"><a href="#quick-links">↑ Quick links</a> · <a href="#table-of-contents">↑ Contents</a></p>

---

## Choose recognition

<a id="choose-recognition"></a>

You only need **one** path at a time.

| | Web Speech (default) | Local ASR |
| --- | --- | --- |
| Engine | Google Chrome Web Speech | Parakeet on your PC (ONNX) |
| Chrome window | Yes — keep it open while streaming | No |
| Internet for recognition | Usually yes (Google) | No (after models are downloaded) |
| Best when… | You want the familiar Chrome path | You want offline / no worker window |
| Setup | Mic permission in Chrome | Modules → Local ASR wizard until **ready** |

> [!TIP]
> New users: start with **Web Speech**. Switch to Local ASR later if you want offline recognition.

<p align="right"><a href="#quick-links">↑ Quick links</a> · <a href="#table-of-contents">↑ Contents</a></p>

---

## Troubleshooting

> [!TIP]
> Check in this order: **Start pressed?** → **recognition working?** → **translation on?** → **OBS URL correct?**

### No subtitles anywhere

- [ ] Pressed **Start** on Live?
- [ ] **Web Speech:** Is the Chrome `/google-asr` window open? Mic allowed **in Chrome**? Prefer not minimizing it for long periods (it can sit behind other apps).
- [ ] **Local ASR:** Is Local ASR selected on Live? Did Modules → Local ASR show **ready**? Mic selected there?
- [ ] Open **More → Tools & Data** and check runtime / recognition status.

### I see source text, but no translation

- [ ] **Translation** tab → translation is enabled.
- [ ] At least one translation line is enabled.
- [ ] Provider needs a key? Add it under provider settings. Or switch to a **keyless** provider (Google Web, Free Web Translate, Bing Translator; Microsoft Edge may return **HTTP 404**).
- [ ] Look at translation results / errors on the same tab — delays can also mean a newer phrase cancelled an older request (normal).

### OBS is empty

- [ ] Browser Source URL ends with `/overlay`, not `/` (dashboard).
- [ ] **Subtitles**: source and/or translations are set to visible.
- [ ] TTL is not extremely short (text can vanish before you notice).
- [ ] After an app update: right‑click the source → **Refresh**.
- [ ] Brief disconnects: overlay often keeps the last frame while reconnecting — that is expected.

### Local ASR mode missing on Live

Finish **Modules → Local ASR** until the module reports ready (deps + model + warm load). CPU is enough; CUDA is optional.

### Worker keeps dying (Web Speech)

- Unstable network to Google speech endpoints.
- **Stop → Start**, or relaunch the worker from Tools.
- Advanced: `VOICESUB_TRACE_BROWSER=1` writes `logs/browser-trace.jsonl` (for bug reports).

### Text stuck on screen after Stop / expiry

Update to the latest build and **refresh** the OBS Browser Source. The overlay must clear empty frames; an old build can leave a ghost line.

<p align="right"><a href="#quick-links">↑ Quick links</a> · <a href="#table-of-contents">↑ Contents</a></p>

---

## Where things are

<a id="where-things-are"></a>

Primary destinations (left rail / bottom nav):

| Place | What you do there |
| --- | --- |
| **Live** | Start/Stop, recognition mode, status, transcript, subtitle preview |
| **Translation** | Providers, up to 4 lines, cache, live/realtime options |
| **Subtitles** | Overlay layout, visibility, order, how long completed lines stay |
| **OBS** | Copy overlay URL; optional Closed Captions |
| **Modules** | Open **TTS** and **Local ASR** windows |
| **More** | Theme, Word Replace, Tools & Data, Settings, Help |

**Command palette** (`Ctrl+K` or header search): jump to a panel, Start/Stop, Save, export diagnostics.

| Tab under More / hubs | Guide section |
| --- | --- |
| Style (under Subtitles) | [Subtitle style](#subtitle-style) |
| UI Theme | [UI theme](#ui-theme) |
| Word Replace | [Word replacement](#word-replacement) |
| Tools & Data | [Tools and data](#tools-and-data) |
| Settings | [Settings](#settings) |
| Help | [Help](#help) |

<table>
  <tr>
    <td align="center" width="33%">
      <img src="../Images/kagevi_translation.png" alt="Translation" width="280"><br>
      <sub><a href="#translation">Translation</a></sub>
    </td>
    <td align="center" width="33%">
      <img src="../Images/kagevi_subtitles.png" alt="Subtitles" width="280"><br>
      <sub><a href="#subtitles">Subtitles</a></sub>
    </td>
    <td align="center" width="33%">
      <img src="../Images/kagevi_style.png" alt="Style" width="280"><br>
      <sub><a href="#subtitle-style">Style</a></sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="../Images/kagevi_UI_theme.png" alt="UI Theme" width="280"><br>
      <sub><a href="#ui-theme">UI Theme</a></sub>
    </td>
    <td align="center">
      <img src="../Images/kagevi_obs.png" alt="OBS" width="280"><br>
      <sub><a href="#obs">OBS</a></sub>
    </td>
    <td align="center">
      <img src="../Images/kagevi_wordReplace.png" alt="Word Replace" width="280"><br>
      <sub><a href="#word-replacement">Word Replace</a></sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="../Images/kagevi_modules_main.png" alt="Modules" width="280"><br>
      <sub><a href="#tts-module">Modules / TTS</a> · <a href="#local-asr">Local ASR</a></sub>
    </td>
    <td align="center">
      <img src="../Images/kagevi_settings.png" alt="Settings" width="280"><br>
      <sub><a href="#settings">Settings</a></sub>
    </td>
    <td align="center">
      <img src="../Images/kagevi_more.png" alt="More" width="280"><br>
      <sub><a href="#help">More / Help</a></sub>
    </td>
  </tr>
</table>

<p align="right"><a href="#quick-links">↑ Quick links</a> · <a href="#table-of-contents">↑ Contents</a></p>

---

## Browser Speech (Web Speech)

<p align="center">
  <img src="../Images/kagevi_webWorker.png" alt="Web Speech worker" width="820"><br>
  <em><strong>Web Speech worker</strong> — Chrome window at <code>/google-asr</code> (keep open while listening)</em>
</p>

### How it feels day to day

1. On Live, leave recognition on **Web Speech** (browser Google).
2. Press **Start** — a separate Chrome window opens to the worker page.
3. Allow the microphone **in that Chrome window**.
4. Leave the window open (it may sit behind OBS/game). Closing it stops recognition.

The microphone list in the main dashboard stays empty on purpose — the mic is chosen in Chrome, not in Kagevi settings.

### Worker window rules (important)

- It is a **normal Chrome window** with an address bar (not a hidden tab, not app mode).
- It uses its own Chrome profile under `user-data/` so it does not mess with your daily browser.
- Windows is tuned so Chrome is less likely to “sleep” the tab while you stream.

### Recognition language

Set the speech language in **Settings** (Web Speech / recognition language). Match the language you actually speak. The worker window also shows live text — if it shows words but Live does not, recognition works and the problem is downstream (restart the session).

<details>
<summary><strong>Advanced Web Speech (optional)</strong></summary>

**Settings → Advanced Web Speech settings** — forced finals, reconnect delays, session length, and related knobs. Each field has an **`!` help** tip.

After big changes: **Save → Stop → Start**, and reopen the worker if it was already open.

Idle “force final” timing is edited in the **worker window** itself (`force_finalization_timeout_ms`), not only in Advanced settings.

Some older config names (`pause_to_finalize_ms`, `hard_max_phrase_ms`, …) are ignored at runtime — leave them alone.

</details>

<details>
<summary><strong>Stability notes</strong></summary>

- Sessions rotate about every 3 minutes by default to keep Chrome recognition healthy.
- After a long finalized phrase (≥200 characters), the worker refreshes its internal buffer so the next lines stay clean.
- Screen wake lock can keep the machine from sleeping while recognition runs.

</details>

<p align="right"><a href="#quick-links">↑ Quick links</a> · <a href="#table-of-contents">↑ Contents</a></p>

---

## Local ASR

Offline speech recognition on your machine (Parakeet + ONNX). No Chrome worker while Live uses this mode.

<p align="center">
  <img src="../Images/kagevi_modules_main.png" alt="Modules" width="400">
  &nbsp;
  <img src="../Images/kagevi_localASR_1.png" alt="Local ASR module" width="400"><br>
  <em><strong>Modules</strong> / <strong>Local ASR</strong> — open the sidecar and finish setup</em>
</p>

<p align="center">
  <img src="../Images/kagevi_localASR_setup.png" alt="Local ASR setup" width="720"><br>
  <em><strong>Setup</strong> — download ORT / optional CUDA pieces and a Parakeet model</em>
</p>

### Setup once

1. Open **Modules → Local ASR** (separate window).
2. Follow the checklist: check/download runtime → download a model → warm-load → pick a mic → run a short test until you see final text.
3. When the module is **ready**, close the window if you like — settings stay in `user-data/modules/local-asr/`.
4. On **Live**, choose **Local ASR**, then **Start**.

CPU is enough for Live. CUDA is optional (faster on supported NVIDIA GPUs after extra downloads). For CUDA pick **fp16** or **fp32** models — **int8** stays on CPU.

### After changing VAD / realtime options

**Stop → Start** on Live so the new mic/pipeline settings apply.

### What you get

Same subtitle, translation, style, and OBS path as Web Speech — only the speech engine changes.

<p align="right"><a href="#quick-links">↑ Quick links</a> · <a href="#table-of-contents">↑ Contents</a></p>

---

## Translation

<p align="center">
  <img src="../Images/kagevi_translation.png" alt="Translation tab" width="820"><br>
  <em><strong>Translation</strong> — turn the pipeline on, pick providers, up to 4 lines</em>
</p>

### Simple setup

1. Enable **translation**.
2. Enable one or more lines (`translation_1` … `translation_4`).
3. Pick target language and provider per line.
4. Save (or just Start — Start also takes the current UI snapshot).

ASR still works with translation off (source-only subtitles).

### Lines

Each line is independent: on/off, language, provider, short label. More enabled lines = more work for providers. Order on screen is controlled under **Subtitles**.

### Providers without an API key

Good starting points if you do not want cloud accounts:

| Provider | Notes |
| --- | --- |
| **Google Web** | Free browser-style Google path |
| **Free Web Translate** | Separate free Google path (own rate limits) |
| **Microsoft Edge Translate** | Anonymous Edge / Azure-quality path when it works. May fail with **HTTP 404** if Microsoft blocks the endpoint — switch to Bing / Google Web. |
| **Bing Translator** | Keyless Bing web session (`ttranslatev3`) |

There are **18** providers total (Google API, DeepL, Azure, LibreTranslate, OpenAI-compatible, China providers, and more). Keys stay only in your local `config.toml`.

### Cache

Memory and optional disk cache (`user-data/translation-cache/`) avoid repeating the same request. If you change LLM prompts a lot, clear or expect old cached answers until the text changes.

### Optional realtime translation

Off by default. When enabled for classic MT providers, growing speech can show draft translations before the phrase finishes. LLM providers still wait for finals. Good for snappy overlays; use finals-only if you prefer stable text.

### How lines behave on screen

A finished subtitle **stays** until the **next** phrase finishes. Late translations can still arrive. If a newer phrase supersedes an old request, the old job is dropped — that is intentional, not a random failure.

<p align="right"><a href="#quick-links">↑ Quick links</a> · <a href="#table-of-contents">↑ Contents</a></p>

---

## Subtitles

<p align="center">
  <img src="../Images/kagevi_subtitles.png" alt="Subtitles tab" width="820"><br>
  <em><strong>Subtitles</strong> — layout preset, what is visible, order, how long lines stay</em>
</p>

| Setting | In plain words |
| --- | --- |
| Overlay preset | How rows are stacked: **single**, **dual-line**, or **stacked**. Compact spacing is a separate toggle. OBS URL can override with `?preset=…&compact=1`. |
| Visibility | Show source and translations. How many translation lines appear follows the **enabled** Translation lines (no separate max-lines control). |
| TTL / lifetime | How long a finished line stays after speech stops. |
| Line order | Order for preview, OBS overlay, and “first visible line” Closed Captions. |

> [!IMPORTANT]
> While you start a new sentence, the previous finished translation can stay until the new sentence **finalizes**. That keeps the screen readable during natural pauses.

<p align="right"><a href="#quick-links">↑ Quick links</a> · <a href="#table-of-contents">↑ Contents</a></p>

---

## Subtitle style

<p align="center">
  <img src="../Images/kagevi_style.png" alt="Subtitle Style tab" width="820"><br>
  <em><strong>Subtitle Style</strong> — fonts, colors, effects, per-line overrides</em>
</p>

- Pick a built-in preset or customize fonts, size, outline, shadow, background, alignment.
- Font picker shows each face in its own typeface; alphabet tags stay in native scripts (`Latin`, `Кириллица`, `日本語`, …) so CJK / Latin-only coverage is obvious.
- Effects include fade, slide, zoom, glow, and similar.
- Style **source** and each **enabled** `translation_1…4` separately if you want (tabs only for active lines).
- Live preview and OBS share the same look — Save (or Start) after edits.

<p align="right"><a href="#quick-links">↑ Quick links</a> · <a href="#table-of-contents">↑ Contents</a></p>

---

## UI theme

<p align="center">
  <img src="../Images/kagevi_UI_theme.png" alt="UI Theme tab" width="820"><br>
  <em><strong>UI Theme</strong> — dark/light and accent colors for the app chrome</em>
</p>

This only changes the **dashboard / module windows**. OBS subtitle look comes from **Subtitle style**, not this theme.

Theme, language, and UI font can sync live across windows without a full Save when the app pushes a UI sync.

<p align="right"><a href="#quick-links">↑ Quick links</a> · <a href="#table-of-contents">↑ Contents</a></p>

---

## OBS

<p align="center">
  <img src="../Images/kagevi_obs.png" alt="OBS tab" width="820"><br>
  <em><strong>OBS</strong> — overlay URL and optional Closed Captions</em>
</p>

### Overlay (what most streamers need)

1. Copy the URL from the **OBS** tab (default `http://127.0.0.1:8765/overlay`).
2. Paste into an OBS **Browser Source**.
3. Leave Kagevi running while you stream.

Optional URL tweaks: `?preset=stacked&compact=1` (and similar). Prefer changing presets in the app unless you need a one-off OBS override.

### Closed Captions (optional)

Sends captions into OBS via WebSocket (handy for platforms that surface CC, e.g. Twitch).

- Enable in the OBS tab; set host / port / password to match OBS WebSocket v5.
- Choose what to send: live source, finals only, a translation line (`translation_1`…`translation_4`), or the first visible line.
- Optional: send **live-partial translations** in `translation_*` modes (`send_translation_partials`; throttled like source). Finals still cover LLM / providers without partials.
- Native stream captions only work while OBS is actually streaming.
- Twitch native CC is reliable for **Latin** scripts; Cyrillic / CJK usually need the **browser overlay** instead.
- Debug mirror can push text into an OBS text source for testing.

<p align="right"><a href="#quick-links">↑ Quick links</a> · <a href="#table-of-contents">↑ Contents</a></p>

---

## Word replacement

<p align="center">
  <img src="../Images/kagevi_wordReplace.png" alt="Word Replace tab" width="820"><br>
  <em><strong>Word Replace</strong> — fix ASR mistakes before translation and display</em>
</p>

Use this to clean names, slang, or misheard words **before** they hit translation and the overlay.

- Custom find/replace pairs.
- Optional built-in lists / stem rules (en/ru) and light obfuscation cleanup.
- Case and whole-word options (CJK uses substring matching).

Twitch chat TTS has its **own** filter switches in the TTS window; dashboard pairs do not automatically apply there.

<p align="right"><a href="#quick-links">↑ Quick links</a> · <a href="#table-of-contents">↑ Contents</a></p>

---

## TTS module

<p align="center">
  <img src="../Images/kagevi_tts_1.png" alt="TTS module" width="820"><br>
  <em><strong>TTS</strong> — speak subtitles aloud</em>
</p>

<p align="center">
  <img src="../Images/kagevi_tts_twitch.png" alt="Twitch TTS" width="820"><br>
  <em><strong>Twitch TTS</strong> — read chat from up to five channels</em>
</p>

Open from **Modules → TTS**. Settings live in `user-data/modules/tts/` (you can close the window).

### Subtitle speech

- Turn the speech channel on, pick voice / rate / volume.
- Volume goes up to **150%**.
- Playback modes:
  - **Native** — lowest latency, rate fixed at 1.0×
  - **Sonic** — change speaking rate while keeping pitch
- You can send speech and Twitch to **different** output devices.

Use the sample / Speak control in the module to test without going Live.

<details>
<summary><strong>Twitch chat TTS</strong></summary>

1. Connect with Twitch OAuth (system browser).
2. Add up to **5** channel logins (without `#`).
3. Filters (emotes, links, symbols, language) apply live — usually no reconnect needed.
4. If IRC drops, the module retries with backoff; bad auth stops instead of looping forever.
5. **?** next to bot nick explains the IRC login used for `JOIN`.

</details>

The Google TTS helper binary is bundled under the TTS module runtime — you do not install Python yourself.

<p align="right"><a href="#quick-links">↑ Quick links</a> · <a href="#table-of-contents">↑ Contents</a></p>

---

## Tools and data

<p align="center">
  <img src="../Images/kagevi_tools%26data.png" alt="Tools and Data tab" width="820"><br>
  <em><strong>Tools & Data</strong> — profiles, status, diagnostics ZIP</em>
</p>

| Feature | Why you care |
| --- | --- |
| Runtime status | See if recognition / translation / OBS CC are alive |
| Profiles | Save and switch named setups (`user-data/profiles/*.json`) |
| Export diagnostics | ZIP with redacted config + logs — attach when asking for help |
| Logs folder | `logs/core.log`, `runtime-events.log`, `session-latest.jsonl` next to the app data |

<details>
<summary><strong>Deep diagnostics (advanced)</strong></summary>

Turn on full logging in Settings / config (`logging.full_enabled`) or set `VOICESUB_DEEP_DIAGNOSTICS=1`. Extra JSONL traces can be enabled with `VOICESUB_TRACE_*` variables. Detailed Tools metrics / Local ASR decode counters need `logging.runtime_metrics_enabled` (off by default). Only needed when hunting a tough bug.

</details>

<p align="right"><a href="#quick-links">↑ Quick links</a> · <a href="#table-of-contents">↑ Contents</a></p>

---

## Settings

<p align="center">
  <img src="../Images/kagevi_settings.png" alt="Settings tab" width="820"><br>
  <em><strong>Settings</strong> — language, layout, Advanced Web Speech</em>
</p>

### UI language

English, Russian, Japanese, Korean, Chinese. Saved with your config. The Web Speech worker follows the locale when it launches.

### Layout

**Standard** desktop window vs **compact** second-monitor layout.

### Fonts / other

Project subtitle fonts come from `bin/fonts/`. Advanced Web Speech options are described in [Browser Speech](#browser-speech-web-speech).

<p align="right"><a href="#quick-links">↑ Quick links</a> · <a href="#table-of-contents">↑ Contents</a></p>

---

## Help

<p align="center">
  <img src="../Images/kagevi_more.png" alt="More hub" width="820"><br>
  <em><strong>More</strong> — Theme, Word Replace, Settings, Tools & Data, Help</em>
</p>

In-app Help summarizes recognition, translation, subtitles, OBS, and tools. For deeper contracts (HTTP/WS/IPC), see [Technical Architecture](./TECHNICAL_ARCHITECTURE.en.md).

<p align="right"><a href="#quick-links">↑ Quick links</a> · <a href="#table-of-contents">↑ Contents</a></p>

---

## Privacy and local-first

- By default the app listens only on **localhost** (`127.0.0.1`). Other devices on your LAN cannot reach it.
- LAN bind (`VOICESUB_ALLOW_LAN=1`) is for advanced setups — WebSockets then have **no login**, so use only on trusted networks.
- Translation API keys and Twitch tokens stay on your disk.
- Diagnostics ZIP **redacts** secrets before export.
- The Chrome worker uses an isolated profile (not your everyday Chrome sync).

<p align="right"><a href="#quick-links">↑ Quick links</a> · <a href="#table-of-contents">↑ Contents</a></p>

---

## Glossary

| Term | Meaning |
| --- | --- |
| **Live** | Main screen with Start/Stop and preview |
| **partial** | Text still being recognized (draft) |
| **final** | Phrase finished by the recognizer |
| **translation line / slot** | One of up to four translated rows (`translation_1`…`translation_4`) |
| **overlay** | The `/overlay` page you add in OBS |
| **Web Speech / browser worker** | Chrome window that listens with Google Web Speech |
| **Local ASR** | Offline Parakeet recognition module |
| **completed block** | Finished subtitle that stays until the next phrase finishes |
| **TTS module** | Separate window for speaking subtitles / Twitch chat |
| **TTL** | How long a finished line remains on screen |

<p align="right"><a href="#quick-links">↑ Quick links</a> · <a href="#table-of-contents">↑ Contents</a></p>

---

<p align="center">
  <a href="#quick-links">↑ Top</a> ·
  <a href="../README.md">README</a> ·
  <a href="./WIKI.ru.md">Русский</a> ·
  <a href="./TECHNICAL_ARCHITECTURE.en.md">Architecture</a>
</p>
