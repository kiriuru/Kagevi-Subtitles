# <img src="./Images/Kagevi_icon.png" alt="" width="72" height="72" valign="middle"> Kagevi Subtitles

**Live übersetzte Untertitel für Streamer — lokal, privacy-first, OBS-bereit.**

[![Version](https://img.shields.io/badge/version-0.7.2-blue.svg)](https://kiriuru.github.io/Kagevi-Subtitles/changelog.html)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11%20x64-lightgrey.svg)](#systemanforderungen)
[![License](https://img.shields.io/badge/license-All%20rights%20reserved-lightgrey.svg)](./LICENSE)
[![Changelog](https://img.shields.io/badge/changelog-Keep%20a%20Changelog-E05735.svg)](https://kiriuru.github.io/Kagevi-Subtitles/changelog.html)
[![Support](https://img.shields.io/badge/Support-DonationAlerts-ff4747.svg)](https://www.donationalerts.com/r/kiriuru)

<p align="center">
  <a href="https://kiriuru.github.io/Kagevi-Subtitles/">Website</a> ·
  <a href="./README.md">English</a> ·
  <a href="./README.de.md">Deutsch</a> ·
  <a href="./README.ru.md">Русский</a> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.ko.md">한국어</a> ·
  <a href="./README.zh.md">中文</a> ·
  <a href="https://kiriuru.github.io/Kagevi-Subtitles/wiki.html">Wiki</a> ·
  <a href="./docs/TECHNICAL_ARCHITECTURE.en.md">Architektur</a> ·
  <a href="https://kiriuru.github.io/Kagevi-Subtitles/changelog.html">Changelog</a>
</p>

Kagevi Subtitles ist eine Windows-Desktop-App, die Sprache in Echtzeit-Untertitel mit optionaler Übersetzung umwandelt. Die Erkennung läuft über **Google Chrome Web Speech** oder optionales Offline-**Local ASR** (Parakeet / ONNX). Alles bleibt auf Ihrem Rechner — Standard-Bind `127.0.0.1:8765`, kein Cloud-Backend, keine Konten.

Erste Kagevi-Subtitles-Version: **`0.5.0`**. Aktuelle Linie: **`0.7.2`**.

<p align="center">
  <img src="./Images/kagevi_live.png" alt="Kagevi Subtitles Live-Tab" width="860">
  <br>
  <em>Live — Start/Stop, Erkennungsstatus, Transkript und Untertitel-Vorschau</em>
</p>

## Inhaltsverzeichnis

- [Funktionen](#funktionen)
- [Screenshots](#screenshots)
- [Systemanforderungen](#systemanforderungen)
- [Schnellstart](#schnellstart)
- [Datenpfade](#datenpfade)
- [Fehlerbehebung](#fehlerbehebung)
- [Dokumentation](#dokumentation)
- [Mitwirken](#mitwirken)
- [Lizenz](#lizenz)

## Funktionen

| Bereich | Was Sie bekommen |
| --- | --- |
| **Sprache** | Google Chrome Web Speech Worker oder Offline Local ASR (Parakeet / ONNX, CPU oder CUDA) |
| **Textformat** | In diesem Build ausgeblendet / deaktiviert (Pipeline bleibt aus) |
| **Übersetzung** | 17 Anbieter (inkl. Baidu / Youdao / Tencent / Caiyun), bis zu **4** Übersetzungszeilen (Quelle separat). Optionale **Realtime**-Übersetzung für klassisches MT (standardmäßig aus). Drei ohne **API-Key**: Google Web, Free Web Translate und Bing Translator |
| **OBS** | Browser-Source-Overlay (**Untertitel-Scrollen** + Geschwindigkeit) + optionale Closed Captions über OBS WebSocket (vor allem für Twitch) |
| **Stil** | Animierte Untertitel-Presets, Stile pro Slot; UI-Themen-Galerie mit Hover-Vorschau |
| **TTS** | Native / Sonic-Wiedergabe; Untertitel-Sprache (ohne Fenster aktivierbar; braucht Live Start) |
| **Twitch** | IRC (Broadcaster tritt dem Streamer-Chat automatisch bei; Extra-Kanäle optional, nur Chat, bis 5 JOIN), EventSub-Alerts auf dem Streamer-Kanal (Follow / Sub / Raid / Cheer / Channel-Point-Rewards), Filter, optionales Chat- + Event-TTS unabhängig vom Untertitel-TTS |
| **Local ASR** | Setup-Assistent unter `/local-asr`; Live-Modus `local_parakeet` wenn bereit |
| **VRChat** | Chatbox-OSC-Ausgabe (`/vrchat`) — Finals in die VRChat Social Chatbox (144 Zeichen) |
| **SteamVR HUD** | OpenVR-Overlay (`/vr-overlay`) — Untertitel nur für den Träger in PCVR; getrennt von OBS und VRChat |
| **Ops** | Diagnostics-ZIP; Werksreset und Profile (Dashboard + TTS / Twitch / Local ASR / VRChat / SteamVR HUD); UI-Locales en / de / ru / ja / ko / zh |

Kompaktes Telefon-Layout für Zweitmonitore verfügbar.

## Screenshots

<details>
<summary><strong>Screenshots anzeigen</strong></summary>

<table>
  <tr>
    <td align="center" width="50%">
      <img src="./Images/kagevi_translation.png" alt="Translation-Tab" width="420"><br>
      <strong>Übersetzung</strong><br>
      <sub>Anbieter, Cache und bis zu 4 Übersetzungszeilen</sub>
    </td>
    <td align="center" width="50%">
      <img src="./Images/kagevi_subtitles.png" alt="Subtitles-Tab" width="420"><br>
      <strong>Untertitel</strong><br>
      <sub>Overlay-Preset, Sichtbarkeit, Reihenfolge und TTL</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_style_1.png" alt="Subtitle Style-Tab" width="420"><br>
      <strong>Untertitel-Stil</strong><br>
      <sub>Schriftarten, Farben, Effekte und Slot-Stile</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_obs_1.png" alt="OBS-Tab" width="420"><br>
      <strong>OBS</strong><br>
      <sub>Overlay-URL und Closed Captions (Twitch)</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_modules_main.png" alt="Modules-Tab" width="420"><br>
      <strong>Module</strong><br>
      <sub>Sidecar-Fenster TTS, Twitch, Local ASR, VRChat und SteamVR HUD öffnen</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_settings.png" alt="Settings" width="420"><br>
      <strong>Einstellungen</strong><br>
      <sub>Layout, Dispatcher, Schriftarten, Advanced Web Speech</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_localASR_1.png" alt="Local ASR-Modul" width="420"><br>
      <strong>Local ASR</strong><br>
      <sub>Offline Parakeet / ONNX (CPU oder CUDA)</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_tts_1.png" alt="TTS-Modul" width="420"><br>
      <strong>TTS</strong><br>
      <sub>Untertitel-Sprache und Wiedergabe</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_UI_theme.png" alt="UI Theme-Tab" width="420"><br>
      <strong>UI-Thema</strong><br>
      <sub>Preset-Galerie mit Hover-Vorschau; Dunkel/Hell und Akzentpalette</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_compact_UI.png" alt="Kompaktes Layout" width="420"><br>
      <strong>Kompaktes Layout</strong><br>
      <sub>Telefon-Fenster für einen Zweitmonitor</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_tts_twitch_1.png" alt="Twitch-Modul" width="420"><br>
      <strong>Twitch</strong><br>
      <sub>IRC-Chat-Log, Verbindung und optionales Chat-TTS</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_tts_twitch_2.png" alt="Twitch-Filter" width="420"><br>
      <strong>Twitch-Filter</strong><br>
      <sub>Emotes, Sprache, Speak-Vorlage, Nick-Ersetzungen</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_tts_twitch_voice_remaps.png" alt="Twitch-Stimm-Remaps" width="420"><br>
      <strong>Twitch-Stimm-Remaps</strong><br>
      <sub>Engine und Stimme pro Sprache für Chat-TTS</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_localASR_setup.png" alt="Local ASR Setup" width="420"><br>
      <strong>Local ASR Setup</strong><br>
      <sub>ORT / CUDA-Komponenten und Parakeet-Modelle</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_vrchat_1.png" alt="VRChat-Modul" width="420"><br>
      <strong>VRChat</strong><br>
      <sub>OSC-Chatbox-Ausgabe für soziale Untertitel in VR</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_vrchat_2.png" alt="VRChat-Vorlagen" width="420"><br>
      <strong>VRChat-Vorlagen</strong><br>
      <sub>Inhaltstemplate, Mute/AFK-Pause, Chatbox-Limits</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_steamVR_1.png" alt="SteamVR HUD-Modul" width="420"><br>
      <strong>SteamVR HUD</strong><br>
      <sub>OpenVR-Overlay nur für den Träger in PCVR</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_steamVR_2.png" alt="SteamVR-Platzierung" width="420"><br>
      <strong>SteamVR-Platzierung</strong><br>
      <sub>Kalibrierung, Offsets und Anzeigeinhalt</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_steamVR_3.png" alt="SteamVR-Display" width="420"><br>
      <strong>SteamVR-Display</strong><br>
      <sub>Canvas-Presets, Schriften, Submit-Intervall</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_steamVR_4.png" alt="SteamVR-Twitch-Panel" width="420"><br>
      <strong>SteamVR-Twitch-Panel</strong><br>
      <sub>Optionales Chat-Overlay in OpenVR</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_word_replace.png" alt="Word Replace-Tab" width="420"><br>
      <strong>Wortersetzung</strong><br>
      <sub>ASR-Fehler vor Übersetzung und Overlay korrigieren</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_tools_data.png" alt="Tools and Data-Tab" width="420"><br>
      <strong>Tools &amp; Daten</strong><br>
      <sub>Profile, Diagnostics-ZIP, Runtime-Status</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_help.png" alt="Help-Tab" width="420"><br>
      <strong>Hilfe</strong><br>
      <sub>In-App-Guide und Schnellstart-Checkliste</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_webWorker_compact.png" alt="Kompakter Web Speech Worker" width="420"><br>
      <strong>Kompakter Worker</strong><br>
      <sub>Chrome <code>/google-asr-compact</code> --app-Fenster</sub>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <img src="./Images/kagevi_webWorker.png" alt="Web Speech Worker" width="640"><br>
      <strong>Web Speech Worker</strong><br>
      <sub>Chrome <code>/google-asr</code>-Fenster — während des Hörens sichtbar lassen</sub>
    </td>
  </tr>
</table>

</details>

Slot-Overrides, OBS Closed Captions Extras, Anbieter-API-Keys, Local ASR Test Bench, SteamVR-HUD-Platzierung und Twitch-Chat-Filter: [Wiki](https://kiriuru.github.io/Kagevi-Subtitles/wiki.html).

## Systemanforderungen

- Windows 10 oder 11 (x64)
- **Microsoft Edge WebView2 Runtime** (unter Windows 11 meist vorinstalliert; der NSIS-Installer kann es unter Windows 10 bootstrappen)
- **Google Chrome** — nur für den Web Speech Worker (nicht nötig bei nur Local ASR)
- Mikrofonzugriff
- Internet — optional für Cloud-Übersetzungsanbieter; auch für erstmalige Local-ASR-Modell- / ORT-Downloads

Kein Python, Node.js oder CUDA im Core-Installer. CUDA ist ein optionaler Local-ASR-Download.

## Schnellstart

1. Installieren aus `Kagevi Subtitles_0.7.2_x64-setup.exe` (oder dem neuesten Build in Ihrem Release-Ordner).
2. **Kagevi Subtitles.exe** starten — das Dashboard öffnet sich unter `http://127.0.0.1:8765/`.
3. In OBS eine **Browser Source** hinzufügen → `http://127.0.0.1:8765/overlay`.
4. Bei Bedarf Übersetzung und Untertitel-Stil konfigurieren, dann **Start**.
5. Erkennung wählen:
   - **Web Speech** — Chrome-Worker nicht minimieren (darf hinter anderen Apps liegen; Mikrofonberechtigung dort). Optional kompakter Worker: `/google-asr-compact`.
   - **Local ASR** — **Module → Local ASR**, Setup bis ready abschließen, Local ASR auf Live wählen, dann Start.
6. Optional **VRChat Chatbox** — **Module → VRChat** → OSC in VRChat an → **Verbindung testen** / **Test senden** → **Ausgabe aktivieren** → **Start** auf Live → Fenster schließen.
7. Optional **PCVR HUD** — **Module → SteamVR HUD** → **SteamVR starten** (Hero-Karte) → Platzierung und **Was anzeigen** konfigurieren → **Untertitel-Overlay aktivieren** und/oder **Chat-Overlay aktivieren** → **Start** auf Live (für Untertitel) → Modulfenster schließen. Quest Standalone zeigt dieses HUD nicht.
8. Optional **Twitch-Chat** — **Module → Twitch** → **Broadcaster-Token holen** (Redirect über `/tts`) → **Verbinden** (tritt dem Streamer-Chat automatisch bei). Extra-Kanäle und Bot-Konto optional. **Chat sprechen** / **Kanalereignisse sprechen** für TTS (unabhängig vom Untertitel-TTS; für IRC kein Live-**Start** nötig). Bei altem Token ohne `chat:read` erneut **Broadcaster-Token holen**.

Eine Statusleiste (ASR / WebSocket / Worker / OBS CC + Start/Stop) bleibt auf jedem Tab angepinnt — vollständig auf Live, kompakt sonst.

Schritt-für-Schritt-UI-Guide: [Wiki](https://kiriuru.github.io/Kagevi-Subtitles/wiki.html)

## Datenpfade

| Pfad | Inhalt |
| --- | --- |
| `user-data/config.toml` | Haupteinstellungen |
| `user-data/profiles/` | Benannte Profile |
| `user-data/modules/tts/` | TTS-Einstellungen |
| `user-data/modules/twitch/` | Twitch IRC / Chat-TTS-Einstellungen |
| `user-data/modules/local-asr/` | Local ASR Config, Modelle, ORT / CUDA Runtime |
| `user-data/modules/vrchat/` | VRChat Chatbox OSC-Einstellungen |
| `user-data/modules/vr-overlay/` | SteamVR HUD Overlay-Einstellungen |
| `user-data/translation-cache/` | Übersetzungs-Cache |
| `logs/` | `core.log`, `runtime-events.log`, `session-latest.jsonl` |
| `bin/fonts/` | Untertitel-Schriftarten |

## Fehlerbehebung

| Symptom | Was prüfen |
| --- | --- |
| Keine Untertitel | **Start** gedrückt; Chrome-Worker nicht minimiert (Web Speech) **oder** Local ASR ready + Mikrofon gewählt |
| Quelltext, keine Übersetzung | Übersetzung an; mindestens eine Zeile aktiv; Anbieter-Credentials |
| Leeres OBS | URL muss `/overlay` sein; App läuft + **Start** auf Live. Wenn OBS *vor* der App offen war, einmal **Rechtsklick Browser Source → Refresh** (OBS lädt eine fehlgeschlagene Seite nicht selbst neu). Danach reconnecten Start/Stop/Neustart automatisch |
| Text in OBS abgeschnitten | Untertitel-Tab: **Untertitel-Scrollen** (standardmäßig an) plus **Scrollgeschwindigkeit**; Browser Source nach *App-Updates* neu laden, die Overlay-JS/CSS ändern |
| Google Web / keyless MT 429 | Warten, weniger Übersetzungszeilen oder Intervall in Einstellungen ändern; Free Web Translate und Bing sind getrennte Buckets |
| Text bleibt nach App-Schließung | Overlay löscht über `/live`-Probe + Idle-Replay beim Reconnect; Build aktualisieren, wenn eine alte Browser Source den letzten Frame behält |
| Port belegt | `8765` freigeben oder Bind ändern (Dev-Builds) |
| Local ASR fehlt auf Live | Module → Local ASR: Wizard bis `ready` abschließen |
| SteamVR HUD nicht sichtbar | Nur PCVR; **SteamVR starten** in der Hero-Karte; **Untertitel-Overlay aktivieren** und/oder **Chat-Overlay aktivieren** + **Start** auf Live (Untertitel); SteamVR läuft |
| SteamVR startet nach manuellem Beenden neu | Build aktualisieren — HUD darf `VR_Init` erst wieder aufrufen, wenn Sie SteamVR erneut aus dem Modul starten |

Vollständiger Guide: [Wiki → Troubleshooting](https://kiriuru.github.io/Kagevi-Subtitles/wiki.html).

## Dokumentation

- [Wiki](https://kiriuru.github.io/Kagevi-Subtitles/wiki.html) — Benutzerhandbuch (EN/RU auf der Site)
- [Changelog](https://kiriuru.github.io/Kagevi-Subtitles/changelog.html) — Release Notes (EN/RU auf der Site)
- [Technical Architecture (EN)](./docs/TECHNICAL_ARCHITECTURE.en.md) / [(RU)](./docs/TECHNICAL_ARCHITECTURE.md)
- Quell-Markdown im Repo: [`docs/WIKI.*.md`](./docs/WIKI.en.md), [`docs/CHANGELOG*.md`](./docs/CHANGELOG.en.md)

## Mitwirken

Pull Requests sind willkommen. Bei größeren Änderungen zuerst ein Issue öffnen.

**Contributor-Guide:** [CONTRIBUTING.md](./CONTRIBUTING.md) — PR-Checklisten für Übersetzungsanbieter oder Untertitel-Schriftart, i18n-Workflow und Tests (Englisch).

Auch: [Code of Conduct](./CODE_OF_CONDUCT.md) · [Security policy](./SECURITY.md) · [Support](./SUPPORT.md)

```powershell
cargo test --workspace
npm run build
npm run test:frontend
```

<details>
<summary><strong>Entwickler — Stack und Build</strong></summary>

### Stack

| Schicht | Technik |
| --- | --- |
| Core | Rust-Workspace (`crates/voicesub-*`) + Axum HTTP/WS |
| Shell | Tauri 2 → `Kagevi Subtitles.exe` (NSIS) |
| Dashboard | Svelte 5 + Vite → `bin/dashboard/` |
| Worker | Svelte 5 → `bin/worker/` |
| Overlay | Vanilla HTML/JS → `bin/overlay/` |
| TTS | Svelte + Rust-Service + eingebettetes `google_tts_fetch.exe`-Runtime |
| Twitch | Svelte + `voicesub-twitch` (optionales Chat-TTS über gemeinsamen Sidecar) |
| Local ASR | Svelte + `voicesub-asr-local` + ONNX Runtime (Lazy Download) |
| VRChat / SteamVR HUD | Svelte-Modul-UIs + Rust-Output-Crates (`voicesub-vrchat`, `voicesub-vr-overlay`) |

Node.js ist **nur Build-Zeit** — nicht im Installer.

### Aus dem Quellcode bauen

```powershell
npm install
npm run build          # dashboard + worker + TTS + Twitch + Local ASR + VRChat + SteamVR HUD
npm run i18n:export    # scripts/i18n-source → locale JSON
npm run i18n:bundle    # overlay locales bundle
cargo test --workspace
build-release-msi.bat  # → NSIS setup.exe in release_root
```

Tauri `beforeBuildCommand`: `npm run build && npm run scrub:shipped-bin`. Bundled Resources: `bin/dashboard`, `overlay`, `worker`, `tts`, `twitch`, `local-asr`, `vrchat`, `vr-overlay`, plus Allowlist-Kopien `bin/.bundle-fonts/` → `bin/fonts` (Top-Level-Faces + Lizenzen) und `bin/.bundle-modules/` → `bin/modules` (`module.toml` + Plattform-Binaries — keine TTS-Python/Build-Skripte oder entpackte Font-Familienbäume).

### Wichtige Crates

`voicesub-runtime` · `voicesub-subtitle` · `voicesub-translation` · `voicesub-browser` · `voicesub-ws` · `voicesub-tts` · `voicesub-twitch` · `voicesub-asr-local` · `voicesub-vrchat` · `voicesub-vr-overlay` · `voicesub-partial-emit` · `voicesub-obs`

`src-tauri/` ist eine dünne IPC-Shell — keine Domain-Logik.

Versionsquelle: `voicesub-types::PROJECT_VERSION` in `crates/voicesub-types/src/version.rs` — dort bumpen, dann `npm run version:sync` (auch aus `npm run build`).

Vollständige Referenz: [Technical Architecture](./docs/TECHNICAL_ARCHITECTURE.en.md).

</details>

## Lizenz

Copyright © 2026 Kiriuru. Alle Rechte vorbehalten. Nutzungsbedingungen siehe **[Kagevi Subtitles License](./LICENSE)**.

Sie dürfen die App **kostenlos** als Endnutzer-Tool verwenden, auch auf einem Stream oder Kanal mit Monetarisierung (Werbung, Abos, Spenden). **Verkauf, Weitergabe oder sonstige Kommerzialisierung der Software** (bezahlte Builds, bezahlte Features, SaaS, gebündelte bezahlte Produkte u. Ä.) ist nicht erlaubt.

**Marken:** „Kagevi“, „Kagevi Subtitles“ und die Projektlogos/Icons sind Kennzeichen von Kiriuru. Diese Lizenz deckt das Urheberrecht an der Software ab — sie gewährt **keine** Rechte an diesen Namen oder dem Branding. Siehe Abschnitt Trademarks in [LICENSE](./LICENSE).

Drittanbieter-Modellgewichte und Runtimes (NVIDIA Parakeet unter **CC-BY-4.0**, ONNX Runtime, Silero VAD, Sonic/libsonic und andere) behalten ihre eigenen Lizenzen — siehe [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
