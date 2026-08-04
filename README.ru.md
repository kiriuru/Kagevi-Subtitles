# <img src="./Images/Kagevi_icon.png" alt="" width="72" height="72" valign="middle"> Kagevi Subtitles

**Живые переводимые субтитры для стримеров — локально, privacy-first, готово для OBS.**

[![Version](https://img.shields.io/badge/version-0.6.2-blue.svg)](https://kiriuru.github.io/Kagevi-Subtitles/changelog.html)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11%20x64-lightgrey.svg)](#системные-требования)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Changelog](https://img.shields.io/badge/changelog-Keep%20a%20Changelog-E05735.svg)](https://kiriuru.github.io/Kagevi-Subtitles/changelog.html)
[![Поддержать](https://img.shields.io/badge/%D0%9F%D0%BE%D0%B4%D0%B4%D0%B5%D1%80%D0%B6%D0%B0%D1%82%D1%8C-DonationAlerts-ff4747.svg)](https://www.donationalerts.com/r/kiriuru)

<p align="center">
  <a href="https://kiriuru.github.io/Kagevi-Subtitles/">Сайт</a> ·
  <a href="./README.md">English</a> ·
  <a href="./README.ru.md">Русский</a> ·
  <a href="https://kiriuru.github.io/Kagevi-Subtitles/wiki.html">Wiki</a> ·
  <a href="./docs/TECHNICAL_ARCHITECTURE.md">Архитектура</a> ·
  <a href="https://kiriuru.github.io/Kagevi-Subtitles/changelog.html">Список изменений</a>
</p>

Kagevi Subtitles — Windows desktop-приложение, которое превращает речь в субтитры в реальном времени с опциональным переводом. Распознавание — через **Google Chrome Web Speech** или опциональный офлайн **Local ASR** (Parakeet / ONNX). Всё работает локально: bind по умолчанию `127.0.0.1:8765`, без cloud backend и аккаунтов.

Первый релиз Kagevi Subtitles: **`0.5.0`**. Текущая линия: **`0.6.2`**.

<p align="center">
  <img src="./Images/kagevi_live.png" alt="Вкладка Live в Kagevi Subtitles" width="860">
  <br>
  <em>Live — Start/Stop, статус распознавания, транскрипт и превью субтитров</em>
</p>

## Содержание

- [Возможности](#возможности)
- [Скриншоты](#скриншоты)
- [Системные требования](#системные-требования)
- [Быстрый старт](#быстрый-старт)
- [Локальные URL](#локальные-url)
- [Пути данных](#пути-данных)
- [Troubleshooting](#troubleshooting)
- [Документация](#документация)
- [Contributing](#contributing)
- [License](#license)

## Возможности

| Область | Что даёт |
| --- | --- |
| **Речь** | Google Chrome Web Speech worker или офлайн Local ASR (Parakeet / ONNX, CPU или CUDA) |
| **Перевод** | 18 провайдеров (в т.ч. Baidu / Youdao / Tencent / Caiyun), до **4** линий перевода (исходник отдельно). Опциональный **realtime**-перевод для классического MT (по умолчанию выкл.). Четыре работают **без API key**: Google Web, Free Web Translate, Microsoft Edge Translate и Bing Translator |
| **OBS** | Browser Source overlay + опциональные Closed Captions через OBS WebSocket (в основном для Twitch) |
| **Стиль** | Анимированные пресеты, стили по слотам, палитра темы |
| **TTS** | Native / Sonic playback; озвучка субтитров + Twitch chat TTS (до 5 каналов) |
| **Local ASR** | Wizard на `/local-asr`; режим `local_parakeet` на Эфире при `ready` |
| **Ops** | Экспорт diagnostics ZIP; локали UI en / ru / ja / ko / zh |

Компактный макет под второй монитор / узкое окно.

## Скриншоты

<table>
  <tr>
    <td align="center" width="50%">
      <img src="./Images/kagevi_translation.png" alt="Вкладка Translation" width="420"><br>
      <strong>Перевод</strong><br>
      <sub>Провайдеры, кэш и до 4 линий перевода</sub>
    </td>
    <td align="center" width="50%">
      <img src="./Images/kagevi_subtitles.png" alt="Вкладка Subtitles" width="420"><br>
      <strong>Субтитры</strong><br>
      <sub>Пресет overlay, видимость, порядок и TTL</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_style.png" alt="Вкладка Subtitle Style" width="420"><br>
      <strong>Стиль субтитров</strong><br>
      <sub>Шрифты, цвета, эффекты и стили по слотам</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_obs.png" alt="Вкладка OBS" width="420"><br>
      <strong>OBS</strong><br>
      <sub>URL overlay и Closed Captions (Twitch)</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_modules_main.png" alt="Вкладка Modules" width="420"><br>
      <strong>Модули</strong><br>
      <sub>Открытие sidecar-окон TTS и Local ASR</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_settings.png" alt="Settings" width="420"><br>
      <strong>Настройки</strong><br>
      <sub>Layout, dispatcher, шрифты, Advanced Web Speech</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_localASR_1.png" alt="Модуль Local ASR" width="420"><br>
      <strong>Local ASR</strong><br>
      <sub>Офлайн Parakeet / ONNX (CPU или CUDA)</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_tts_1.png" alt="Модуль TTS" width="420"><br>
      <strong>TTS</strong><br>
      <sub>Озвучка субтитров и playback</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_UI_theme.png" alt="Вкладка UI Theme" width="420"><br>
      <strong>Тема UI</strong><br>
      <sub>Тёмная/светлая тема и accent palette</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_compact_UI.png" alt="Компактный layout" width="420"><br>
      <strong>Компактный layout</strong><br>
      <sub>Узкое окно под второй монитор</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_tts_twitch.png" alt="Twitch TTS" width="420"><br>
      <strong>Twitch TTS</strong><br>
      <sub>Chat TTS до пяти каналов</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_localASR_setup.png" alt="Local ASR setup" width="420"><br>
      <strong>Local ASR setup</strong><br>
      <sub>Компоненты ORT / CUDA и модели Parakeet</sub>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <img src="./Images/kagevi_webWorker.png" alt="Web Speech worker" width="640"><br>
      <strong>Web Speech worker</strong><br>
      <sub>Окно Chrome <code>/google-asr</code> — держите видимым во время распознавания</sub>
    </td>
  </tr>
</table>

Остальные экраны (Word Replace, Tools & Data, More/Help, Local ASR test bench): [Wiki](https://kiriuru.github.io/Kagevi-Subtitles/wiki.html).

## Системные требования

- Windows 10 или 11 (x64)
- **Microsoft Edge WebView2 Runtime** (на Windows 11 обычно уже есть; NSIS-установщик может запустить bootstrapper на Windows 10)
- **Google Chrome** — только для Web Speech worker (не нужен, если используется только Local ASR)
- Доступ к микрофону
- Интернет — опционально для облачных провайдеров перевода; также для первой загрузки модели / ORT Local ASR

Python, Node.js и CUDA **не входят** в core-установщик. CUDA — опциональная загрузка модуля Local ASR.

## Быстрый старт

1. Установите из `Kagevi Subtitles_0.6.2_x64-setup.exe` (или последней сборки в папке релиза).
2. Запустите **Kagevi Subtitles.exe** — dashboard откроется на `http://127.0.0.1:8765/`.
3. В OBS добавьте **Browser Source** → `http://127.0.0.1:8765/overlay`.
4. При необходимости настройте перевод и стиль субтитров, нажмите **Start**.
5. Выберите распознавание:
   - **Web Speech** — не сворачивайте окно Chrome worker (можно перекрывать другими окнами; разрешение микрофона выдаётся там).
   - **Local ASR** — **Модули → Local ASR**, завершите setup до `ready`, выберите Local ASR на Эфире, затем Start.

Пошаговый гайд: [Wiki](https://kiriuru.github.io/Kagevi-Subtitles/wiki.html)

## Локальные URL

| URL | Назначение |
| --- | --- |
| `http://127.0.0.1:8765/` | Dashboard |
| `http://127.0.0.1:8765/overlay` | OBS Browser Source |
| `http://127.0.0.1:8765/google-asr?autostart=1` | Browser Speech worker |
| `http://127.0.0.1:8765/tts` | TTS-модуль |
| `http://127.0.0.1:8765/local-asr` | Модуль Local ASR |

Примеры query для overlay: `?preset=single` · `?compact=1` · `?profile=default`

## Пути данных

| Путь | Содержимое |
| --- | --- |
| `user-data/config.toml` | Основные настройки |
| `user-data/profiles/` | Именованные профили |
| `user-data/modules/tts/` | Настройки TTS |
| `user-data/modules/local-asr/` | Config Local ASR, модели, ORT / CUDA runtime |
| `user-data/translation-cache/` | Кэш перевода |
| `logs/` | `core.log`, `runtime-events.log`, `session-latest.jsonl` |
| `bin/fonts/` | Шрифты субтитров |

## Troubleshooting

| Симптом | Что проверить |
| --- | --- |
| Нет субтитров | Нажат **Start**; Chrome worker не свёрнут (Web Speech) **или** Local ASR ready + выбран mic |
| Есть исходник, нет перевода | Перевод включён; активна хотя бы одна линия; credentials провайдера |
| Пустой OBS | Browser Source на `/overlay`; видимость во вкладке «Субтитры»; после обновления — reload source |
| Текст не исчезает после TTL / Stop | Обновите сборку; перезагрузите Browser Source |
| Порт занят | Освободите `8765` или смените bind (dev-сборки) |
| Нет Local ASR на Эфире | Модули → Local ASR: завершите wizard до `ready` |

Полный гайд: [Wiki → Troubleshooting](https://kiriuru.github.io/Kagevi-Subtitles/wiki.html).

## Документация

- [Wiki](https://kiriuru.github.io/Kagevi-Subtitles/wiki.html) — пользовательский гайд (EN/RU на сайте)
- [Список изменений](https://kiriuru.github.io/Kagevi-Subtitles/changelog.html) — релизы (EN/RU на сайте)
- [Technical Architecture (RU)](./docs/TECHNICAL_ARCHITECTURE.md) / [(EN)](./docs/TECHNICAL_ARCHITECTURE.en.md)
- Исходники в репозитории: [`docs/WIKI.*.md`](./docs/WIKI.ru.md), [`docs/CHANGELOG*.md`](./docs/CHANGELOG.md)

## Contributing

PR приветствуются. Для крупных изменений — сначала issue.

```powershell
cargo test --workspace
npm run build
npm run test:frontend
```

<details>
<summary><strong>Разработчикам — стек и сборка</strong></summary>

### Стек

| Слой | Технологии |
| --- | --- |
| Core | Rust workspace (`crates/voicesub-*`) + Axum HTTP/WS |
| Shell | Tauri 2 → `Kagevi Subtitles.exe` (NSIS) |
| Dashboard | Svelte 5 + Vite → `bin/dashboard/` |
| Worker | Svelte 5 → `bin/worker/` |
| Overlay | Vanilla HTML/JS → `bin/overlay/` |
| TTS | Svelte + Rust service + встроенный runtime `google_tts_fetch.exe` |
| Local ASR | Svelte + `voicesub-asr-local` + ONNX Runtime (lazy download) |

Node.js — **только на этапе сборки**, не в установщике.

### Сборка из исходников

```powershell
npm install
npm run build          # dashboard + worker + TTS + Local ASR
npm run i18n:export    # scripts/i18n-source → locale JSON
npm run i18n:bundle    # overlay locales bundle
cargo test --workspace
build-release-msi.bat  # → NSIS setup.exe в release_root
```

Tauri `beforeBuildCommand`: `npm run build`. В bundle: `bin/dashboard`, `overlay`, `worker`, `tts`, `local-asr`, `fonts`, `modules`.

### Ключевые crates

`voicesub-runtime` · `voicesub-subtitle` · `voicesub-translation` · `voicesub-browser` · `voicesub-ws` · `voicesub-tts` · `voicesub-asr-local` · `voicesub-partial-emit` · `voicesub-obs`

`src-tauri/` — тонкая IPC-оболочка, без domain logic.

Источник версии: `voicesub-types::PROJECT_VERSION` в `crates/voicesub-types/src/version.rs` — bump только там, затем `npm run version:sync` (также из `npm run build`).

Полный справочник: [Technical Architecture](./docs/TECHNICAL_ARCHITECTURE.md).

</details>

## License

Copyright (c) 2026 Kiriuru. Исходный код лицензирован по [MIT License](./LICENSE).

**Товарные знаки / бренд:** «Kagevi», «Kagevi Subtitles» и логотипы/иконки проекта — обозначения Kiriuru. MIT покрывает только авторские права на ПО и **не** даёт права на эти имена и брендинг. Форки и распространения, которые не являются официальным проектом, должны использовать другое оформление. См. раздел Trademarks в [LICENSE](./LICENSE).

Сторонние модели и рантаймы (NVIDIA Parakeet — **CC-BY-4.0**, ONNX Runtime, Silero VAD, Sonic/libsonic и др.) остаются под своими лицензиями — см. [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
