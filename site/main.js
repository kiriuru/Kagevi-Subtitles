(() => {
  /** Synced from voicesub-types::DEFAULT_GITHUB_REPO via `npm run version:sync`. */
  const GITHUB_REPO = "kiriuru/Kagevi-Subtitles";
  const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;
  const GITHUB_RELEASES_LATEST = `${GITHUB_URL}/releases/latest`;
  const GITHUB_LICENSE = `${GITHUB_URL}/blob/main/LICENSE`;
  const GITHUB_NOTICES = `${GITHUB_URL}/blob/main/THIRD_PARTY_NOTICES.md`;

  const STRINGS = {
    en: {
      brandAria: "Kagevi Subtitles home",
      navWhatsNew: "0.7",
      navGuide: "Guide",
      navWiki: "Wiki",
      navChangelog: "Changelog",
      navStart: "Quick start",
      navDownload: "Download",
      navLicenses: "Licenses",
      navGithub: "GitHub",
      carouselPrev: "Previous screenshot",
      carouselNext: "Next screenshot",
      heroTitle: "Live translated subtitles for streamers",
      heroLede: "Speech to captions with optional translation — OBS, VRChat Chatbox, and SteamVR HUD. Local-first, privacy-first, no cloud accounts.",
      ctaDownload: "Download for Windows",
      ctaGuide: "Feature guide",
      ctaWhatsNew: "What's new in 0.7",
      heroMeta: "Windows 10/11 · Free to use · v0.7.0",
      heroScroll: "Explore",
      whatsEyebrow: "Version 0.7.0",
      whatsTitle: "Built for streams — and for VR",
      whatsLede: "The same local pipeline now reaches OBS viewers, VRChat friends, and your own SteamVR headset.",
      whats1Tag: "Modules",
      whats1Title: "VRChat Chatbox OSC",
      whats1Body: "Send finals to the social Chatbox (144 chars). Enable output, close the window — no KAT. Pause on mute/AFK optional.",
      whats2Tag: "PCVR",
      whats2Title: "SteamVR wearer HUD",
      whats2Body: "OpenVR overlay for you only — HMD, wrist, or world. Separate from OBS and VRChat. Start SteamVR from the module hero card.",
      whats3Tag: "Overlay",
      whats3Title: "Subtitle scrolling",
      whats3Body: "Captions stay full-size in the OBS box — long lines scroll vertically, with adjustable speed.",
      guideTitle: "How the product works",
      guideLede: "Walkthrough of recognition, translation, OBS, VR modules, style, and More.",
      tabLive: "Live",
      tabSpeech: "Web Speech",
      tabLocal: "Local ASR",
      tabTranslate: "Translation",
      tabSubs: "Subtitles",
      tabObs: "OBS",
      tabModules: "Modules",
      tabVrchat: "VRChat",
      tabSteamvr: "SteamVR",
      tabTts: "TTS",
      tabTwitch: "Twitch",
      tabStyle: "Style",
      tabMore: "More",
      gLiveTitle: "Live — the control desk",
      gLiveIntro: "Start and stop recognition, watch status chips on every tab, read the live transcript, and preview subtitle output before it hits OBS or VR.",
      gLive1: "Press Start — recognition uses your latest settings, even if you have not saved yet.",
      gLive2: "Choose Web Speech or Local ASR when the module is ready.",
      gLive3: "Status bar stays pinned on all tabs — full KPI on Live, compact strip elsewhere.",
      gLive4: "Compact layout fits a secondary monitor; optional compact Chrome worker from Live.",
      gSpeechTitle: "Web Speech — Chrome worker",
      gSpeechIntro: "Production mode browser_google runs Google Chrome Web Speech in a separate window — full UI with address bar by default, or optional compact --app= from the Live tab.",
      gSpeech1: "Microphone permission is granted inside Chrome (getUserMedia).",
      gSpeech2: "Isolated worker profile under user-data; anti-throttling flags on Windows.",
      gSpeech3: "Choose the spoken language and optional restart tuning in Settings.",
      gSpeech4: "Recognition runs in its own Chrome window — leave it open behind OBS or your game.",
      gLocalTitle: "Local ASR — offline Parakeet",
      gLocalIntro: "Optional module: offline Parakeet via ONNX Runtime (CPU or CUDA). No Chrome worker when Live mode is Local ASR.",
      gLocal1: "Open Modules → Local ASR and finish setup until ready.",
      gLocal2: "Lazy-download ORT, model weights, optional Silero VAD and CUDA redist.",
      gLocal3: "Native mic capture (cpal) with WebRTC or Silero VAD.",
      gLocal4: "Same subtitle / translation / overlay path as Web Speech after ingest.",
      gTranslateTitle: "Translation — up to four lines",
      gTranslateIntro: "Seventeen providers with queueing, cache, and stale-drop protection. ASR still works with translation turned off (source-only).",
      gTranslate1: "Up to four translation lines (source text is separate).",
      gTranslate2: "Keyless options: Google Web, Free Web Translate, Bing Translator.",
      gTranslate3: "Optional realtime translation — captions update while you speak, without waiting for the phrase to finish (off by default).",
      gTranslate4: "Memory/disk cache; late translations allowed; completed blocks stay until the next phrase finalizes.",
      gSubsTitle: "Subtitles — overlay layout",
      gSubsIntro: "Control which lines appear on the OBS overlay, their order, preset, scroll speed, and how long completed text remains visible.",
      gSubs1: "Presets: single, dual-line, stacked + compact spacing (URL query overrides available).",
      gSubs2: "Subtitle scrolling keeps captions full-size — long lines scroll vertically; speed is adjustable.",
      gSubs3: "TTL / lifecycle settings keep completed text stable during the next partial.",
      gSubs4: "Drag lines to choose which language appears on top in OBS.",
      gObsTitle: "OBS — Browser Source & CC",
      gObsIntro: "Primary output is a lightweight vanilla overlay page over WebSocket. Optional Closed Captions via OBS WebSocket are mainly for Twitch.",
      gObs1: "Add Browser Source → http://127.0.0.1:8765/overlay",
      gObs2: "Copy URL / open overlay helpers live on the OBS tab.",
      gObs3: "Closed Captions: meant for Twitch stream captions (other uses are uncommon).",
      gObs4: "After app updates, reload the Browser Source so scroll / style assets refresh.",
      gModulesTitle: "Modules — sidecar windows",
      gModulesIntro: "Compact cards open TTS, Twitch, Local ASR, VRChat, and SteamVR HUD. Enable each module, then close the window — output keeps running.",
      gModules1: "Square cards with status badges and a short help popup.",
      gModules2: "Theme presets hot-apply to every open module window and the Chrome worker.",
      gModules3: "Profiles and factory reset include all module configs together.",
      gModules4: "Official NVIDIA, VRChat, and SteamVR branding on the cards.",
      gVrchatTitle: "VRChat — Chatbox OSC",
      gVrchatIntro: "Social output: pipeline finals go to the VRChat Chatbox over OSC. Other players see the text — this is not a headset HUD.",
      gVrchat1: "Modules → VRChat → enable output → Start on Live → close the window.",
      gVrchat2: "OSC 127.0.0.1:9000 / 9001 · max 144 characters / 9 lines · no KAT.",
      gVrchat3: "What to send matches OBS CC modes, including {source} / {tr1}…{tr4} templates.",
      gVrchat4: "Optional pause on MuteSelf / AFK; Chatbox auto-clear (default 5 s).",
      gSteamvrTitle: "SteamVR — wearer HUD",
      gSteamvrIntro: "Wearer-only OpenVR overlay in PCVR. Stream viewers still use OBS; Quest standalone cannot show this HUD.",
      gSteamvr1: "Start SteamVR from the module hero card, then Enable HUD + Live Start.",
      gSteamvr2: "Attach to HMD, controller (wrist / palm / above), or world.",
      gSteamvr3: "What to show: source plus enabled translation lines.",
      gSteamvr4: "Manual SteamVR exit does not auto-relaunch — start again from the module.",
      gTtsTitle: "TTS — subtitle speech",
      gTtsIntro: "Optional module that speaks finalized subtitle lines. Requires Live Start while enabled; closing the window does not stop playback.",
      gTts1: "Open from Modules → TTS (separate window, /tts).",
      gTts2: "Speak translated or source lines as they finalize.",
      gTts3: "Google HTTP proxy or Python sidecar engine; Native or Sonic playback.",
      gTts4: "Output device and tempo are configured in the TTS module, not OBS.",
      gTwitchTitle: "Twitch — IRC, events, and TTS",
      gTwitchIntro: "Separate module for Twitch IRC (up to five channels), EventSub alerts (follow / sub / raid / cheer), and optional chat + event TTS independent of subtitle speech. Enable-without-window; OAuth redirect stays on /tts.",
      gTwitch1: "Open from Modules → Twitch (/twitch).",
      gTwitch2: "Connect with Twitch OAuth (re-authorize after EventSub); IRC and EventSub auto-connect when enabled.",
      gTwitch3: "Own TTS engine, playback sliders, per-event speak templates, filters, and output device.",
      gTwitch4: "Test phrase and clear queue without waiting for chat.",
      gStyleTitle: "Style — look of the captions",
      gStyleIntro: "Fonts, colors, outline, shadow, backgrounds, and animated entrance effects — shared by dashboard preview and OBS overlay.",
      gStyle1: "Built-in and creative presets; Save after edits.",
      gStyle2: "Per-slot overrides for source and each translation line.",
      gStyle3: "Effects: fade, slide-up, zoom, blur-in, glow, and more.",
      gStyle4: "UI Theme gallery with live hover preview — dashboard and modules, not the OBS overlay glyphs.",
      gMoreTitle: "More — replace, profiles, tools",
      gMoreIntro: "Word replace, profiles, diagnostics, theme, and factory defaults — everything that sits beside the live pipeline.",
      gMore1: "Word replace fixes ASR mistakes (and optional masking) before translation and outputs.",
      gMore2: "Profiles save dashboard + TTS + Twitch + Local ASR + VRChat + SteamVR together.",
      gMore3: "Factory reset restores the default profile and all module configs in one step.",
      gMore4: "UI Theme, Tools & Data, and Help live under More.",
      pipeTitle: "One local pipeline",
      pipeLede: "From microphone to OBS, VRChat, SteamVR, and TTS — without shipping your stream audio to a proprietary backend.",
      pipe1: "ASR",
      pipe2: "Word replace",
      pipe3: "Translate",
      pipe4: "OBS · TTS · Twitch · VRChat · SteamVR",
      startTitle: "Quick start",
      startLede: "Five steps from installer to live captions.",
      s1Title: "Install",
      s1Body: "Run the Windows x64 setup from the latest GitHub Release (v0.7.0+).",
      s2Title: "Launch",
      s2Body: "Open Kagevi Subtitles — the dashboard opens on Live.",
      s3Title: "Add OBS source",
      s3Body: "Browser Source → http://127.0.0.1:8765/overlay",
      s4Title: "Start recognition",
      s4Body: "Web Speech (leave the Chrome window open) or Local ASR when ready — then press Start.",
      s5Title: "Optional VR",
      s5Body: "Modules → VRChat or SteamVR HUD → enable → keep Live running. PCVR only for the HUD.",
      dlTitle: "Get Kagevi Subtitles",
      dlLede: "v0.7.0 for Windows 10/11 (x64). WebView2 required; Chrome only for the Web Speech worker.",
      req1: "Windows 10 or 11 (x64)",
      req2: "Microsoft Edge WebView2 Runtime",
      req3: "Microphone access",
      req4: "Internet optional (cloud translation / first Local ASR download)",
      ctaSource: "GitHub",
      ctaSupport: "Support the project",
      licTitle: "Licenses & attribution",
      licLede: "Copyright © 2026 Kiriuru. All rights reserved. Local ASR models and several runtimes keep their own licenses — key attributions below.",
      licAppName: "Kagevi Subtitles",
      licAppBody: "Copyright © 2026 Kiriuru. All rights reserved.",
      licParaName: "NVIDIA Parakeet ASR",
      licParaBody: "CC-BY-4.0 — NeMo / Suno.ai models via ONNX exports",
      licOrtName: "ONNX Runtime",
      licOrtBody: "MIT © Microsoft",
      licSilName: "Silero VAD",
      licSilBody: "MIT © Silero Team (optional)",
      licSonicName: "Sonic / libsonic",
      licSonicBody: "Apache-2.0 — TTS tempo",
      licAppLink: "Application license",
      licFooterLink: "License",
      footerTag: "Local-first live subtitles — OBS, VRChat, SteamVR.",
      linkWiki: "Wiki",
      linkChangelog: "Changelog",
      footerPowered: "Powered by Kiriuru",
      closeAria: "Close",
      navMenu: "Menu",
    },
    ru: {
      brandAria: "Kagevi Subtitles — на главную",
      navWhatsNew: "0.7",
      navGuide: "Гид",
      navWiki: "Wiki",
      navChangelog: "Список изменений",
      navStart: "Быстрый старт",
      navDownload: "Скачать",
      navLicenses: "Лицензии",
      navGithub: "GitHub",
      carouselPrev: "Предыдущий скриншот",
      carouselNext: "Следующий скриншот",
      heroTitle: "Живые переводимые субтитры для стримеров",
      heroLede: "Речь → субтитры с опциональным переводом — OBS, Chatbox VRChat и SteamVR HUD. Локально, privacy-first, без облачных аккаунтов.",
      ctaDownload: "Скачать для Windows",
      ctaGuide: "Обзор функций",
      ctaWhatsNew: "Что нового в 0.7",
      heroMeta: "Windows 10/11 · Free to use · v0.7.0",
      heroScroll: "Смотреть",
      whatsEyebrow: "Версия 0.7.0",
      whatsTitle: "Для стримов — и для VR",
      whatsLede: "Один локальный пайплайн доходит до зрителей OBS, друзей в VRChat и вашего шлема SteamVR.",
      whats1Tag: "Модули",
      whats1Title: "VRChat Chatbox OSC",
      whats1Body: "Финалы в социальный Chatbox (144 символа). Включили вывод — окно можно закрыть. Без KAT. Пауза по mute/AFK по желанию.",
      whats2Tag: "PCVR",
      whats2Title: "SteamVR HUD для носителя",
      whats2Body: "OpenVR overlay только для вас — HMD, запястье или мир. Отдельно от OBS и VRChat. SteamVR запускается с hero-карточки модуля.",
      whats3Tag: "Overlay",
      whats3Title: "Прокручивание субтитров",
      whats3Body: "Субтитры остаются крупными в окне OBS — длинные строки прокручиваются вертикально, скорость настраивается.",
      guideTitle: "Как устроен продукт",
      guideLede: "Распознавание, перевод, OBS, VR-модули, стиль и раздел «Ещё».",
      tabLive: "Эфир",
      tabSpeech: "Web Speech",
      tabLocal: "Local ASR",
      tabTranslate: "Перевод",
      tabSubs: "Субтитры",
      tabObs: "OBS",
      tabModules: "Модули",
      tabVrchat: "VRChat",
      tabSteamvr: "SteamVR",
      tabTts: "TTS",
      tabTwitch: "Twitch",
      tabStyle: "Стиль",
      tabMore: "Ещё",
      gLiveTitle: "Эфир — пульт управления",
      gLiveIntro: "Старт и стоп распознавания, статусы на всех вкладках, живой транскрипт и превью субтитров до OBS или VR.",
      gLive1: "Нажмите Start — распознавание идёт с текущими настройками, даже если вы их ещё не сохранили.",
      gLive2: "Выберите Web Speech или Local ASR, когда модуль готов.",
      gLive3: "Статус-бар закреплён на всех вкладках — полный KPI на Эфире, сжатая полоска на остальных.",
      gLive4: "Компактный макет для второго монитора; опциональный компактный Chrome worker с Эфира.",
      gSpeechTitle: "Web Speech — Chrome worker",
      gSpeechIntro: "Режим browser_google запускает Google Chrome Web Speech в отдельном окне — полный UI с адресной строкой по умолчанию или опциональный компактный --app= с вкладки Эфир.",
      gSpeech1: "Разрешение микрофона выдаётся в Chrome (getUserMedia).",
      gSpeech2: "Изолированный профиль worker в user-data; anti-throttling флаги на Windows.",
      gSpeech3: "Язык речи и опциональная тонкая настройка перезапуска — в Настройках.",
      gSpeech4: "Распознавание живёт в отдельном окне Chrome — оставьте его открытым за OBS или игрой.",
      gLocalTitle: "Local ASR — офлайн Parakeet",
      gLocalIntro: "Опциональный модуль: офлайн Parakeet через ONNX Runtime (CPU или CUDA). Без Chrome worker в режиме Local ASR.",
      gLocal1: "Modules → Local ASR — завершите setup до статуса ready.",
      gLocal2: "Lazy-download ORT, весов модели, опционально Silero VAD и CUDA redist.",
      gLocal3: "Нативный захват микрофона (cpal) с WebRTC или Silero VAD.",
      gLocal4: "Тот же путь субтитров / перевода / overlay, что и у Web Speech после ingest.",
      gTranslateTitle: "Перевод — до четырёх линий",
      gTranslateIntro: "Семнадцать провайдеров с очередью, кэшем и защитой от stale. ASR работает и с выключенным переводом (только source).",
      gTranslate1: "До четырёх линий перевода (исходный текст отдельно).",
      gTranslate2: "Без API key: Google Web, Free Web Translate, Bing Translator.",
      gTranslate3: "Опциональный realtime-перевод — субтитры обновляются уже во время речи, не дожидаясь конца фразы (по умолчанию выкл.).",
      gTranslate4: "Кэш в памяти/на диске; поздние переводы допускаются; completed-блок держится до финала следующей фразы.",
      gSubsTitle: "Субтитры — раскладка overlay",
      gSubsIntro: "Какие линии видны в OBS, их порядок, пресет, скорость прокрутки и как долго остаётся completed-текст.",
      gSubs1: "Пресеты: single, dual-line, stacked + компактные отступы (есть query-override в URL).",
      gSubs2: "Прокручивание субтитров сохраняет крупный шрифт — длинные строки крутятся вертикально; скорость настраивается.",
      gSubs3: "TTL / lifecycle удерживают completed-текст, пока идёт следующий partial.",
      gSubs4: "Перетащите строки, чтобы выбрать, какой язык сверху в OBS.",
      gObsTitle: "OBS — Browser Source и CC",
      gObsIntro: "Основной вывод — лёгкий vanilla overlay по WebSocket. Опциональные Closed Captions через OBS WebSocket — в основном для Twitch.",
      gObs1: "Добавьте Browser Source → http://127.0.0.1:8765/overlay",
      gObs2: "Copy URL / Open overlay — на вкладке OBS.",
      gObs3: "Closed Captions: рассчитаны на субтитры стрима Twitch (другие сценарии почти не встречаются).",
      gObs4: "После обновления приложения перезагрузите Browser Source, чтобы подтянуть прокрутку / стили.",
      gModulesTitle: "Модули — отдельные окна",
      gModulesIntro: "Компактные карточки открывают TTS, Twitch, Local ASR, VRChat и SteamVR HUD. Включили модуль — окно можно закрыть, вывод продолжает работать.",
      gModules1: "Квадратные карточки со статусом и краткой справкой «?».",
      gModules2: "Пресеты темы сразу применяются ко всем открытым модулям и Chrome worker.",
      gModules3: "Профили и заводской сброс включают конфиги всех модулей.",
      gModules4: "Официальные логотипы NVIDIA, VRChat и SteamVR на карточках.",
      gVrchatTitle: "VRChat — Chatbox OSC",
      gVrchatIntro: "Социальный вывод: финалы пайплайна уходят в Chatbox VRChat по OSC. Текст видят другие игроки — это не HUD шлема.",
      gVrchat1: "Модули → VRChat → включить вывод → Start на Эфире → окно можно закрыть.",
      gVrchat2: "OSC 127.0.0.1:9000 / 9001 · до 144 символов / 9 строк · без KAT.",
      gVrchat3: "Что отправлять — как в OBS CC, включая шаблоны {source} / {tr1}…{tr4}.",
      gVrchat4: "Опциональная пауза по MuteSelf / AFK; автоочистка Chatbox (по умолчанию 5 с).",
      gSteamvrTitle: "SteamVR — HUD носителя",
      gSteamvrIntro: "OpenVR overlay только для вас в PCVR. Зрители стрима по-прежнему смотрят OBS; Quest standalone этот HUD не показывает.",
      gSteamvr1: "Запустите SteamVR с hero-карточки модуля, затем Enable HUD + Start на Эфире.",
      gSteamvr2: "Привязка к HMD, контроллеру (запястье / ладонь / сверху) или миру.",
      gSteamvr3: "Что показывать: исходник и включённые линии перевода.",
      gSteamvr4: "Ручной выход из SteamVR не перезапускает runtime — снова Start из модуля.",
      gTtsTitle: "TTS — озвучка субтитров",
      gTtsIntro: "Опциональный модуль озвучки финализированных строк. Нужен Start на Эфире; закрытие окна не останавливает playback.",
      gTts1: "Модули → TTS (отдельное окно, /tts).",
      gTts2: "Озвучка source или перевода по мере финализации строк.",
      gTts3: "Движок Google HTTP proxy или Python sidecar; Native или Sonic.",
      gTts4: "Устройство вывода и темп — в модуле TTS, не в OBS.",
      gTwitchTitle: "Twitch — IRC, события и TTS",
      gTwitchIntro: "Отдельный модуль IRC Twitch (до пяти каналов), EventSub-алерты (фоллоу / саб / рейд / чир) и опциональная озвучка чата и событий независимо от субтитрового TTS. Enable-without-window; OAuth redirect остаётся на /tts.",
      gTwitch1: "Модули → Twitch (/twitch).",
      gTwitch2: "Подключение через Twitch OAuth (после EventSub — повторный токен); IRC и EventSub подключаются сами при включённом модуле.",
      gTwitch3: "Свой движок TTS, ползунки playback, шаблоны событий, фильтры и устройство вывода.",
      gTwitch4: "Тестовая фраза и очистка очереди без ожидания чата.",
      gStyleTitle: "Стиль — вид субтитров",
      gStyleIntro: "Шрифты, цвета, обводка, тень, фон и анимации появления — общие для превью дашборда и OBS overlay.",
      gStyle1: "Встроенные и креативные пресеты; после правок — Save.",
      gStyle2: "Переопределения по слотам: source и каждая линия перевода.",
      gStyle3: "Эффекты: fade, slide-up, zoom, blur-in, glow и другие.",
      gStyle4: "Галерея UI Theme с live-превью при наведении — дашборд и модули, не глифы OBS overlay.",
      gMoreTitle: "Ещё — замена, профили, инструменты",
      gMoreIntro: "Замена слов, профили, диагностика, тема и заводской сброс — всё рядом с живым пайплайном.",
      gMore1: "Замена слов чинит ошибки ASR (и опциональную маскировку) до перевода и выводов.",
      gMore2: "Профили сохраняют dashboard + TTS + Twitch + Local ASR + VRChat + SteamVR вместе.",
      gMore3: "Заводской сброс восстанавливает профиль default и конфиги всех модулей за один шаг.",
      gMore4: "Тема UI, Инструменты и Справка — в разделе «Ещё».",
      pipeTitle: "Один локальный пайплайн",
      pipeLede: "От микрофона до OBS, VRChat, SteamVR и TTS — без отправки аудио стрима в чужой backend.",
      pipe1: "ASR",
      pipe2: "Замена слов",
      pipe3: "Перевод",
      pipe4: "OBS · TTS · Twitch · VRChat · SteamVR",
      startTitle: "Быстрый старт",
      startLede: "Пять шагов от установщика до живых субтитров.",
      s1Title: "Установка",
      s1Body: "Запустите Windows x64 setup из последнего GitHub Release (v0.7.0+).",
      s2Title: "Запуск",
      s2Body: "Откройте Kagevi Subtitles — дашборд сразу на Эфире.",
      s3Title: "Источник в OBS",
      s3Body: "Browser Source → http://127.0.0.1:8765/overlay",
      s4Title: "Старт распознавания",
      s4Body: "Web Speech (оставьте окно Chrome открытым) или Local ASR при ready — затем Start.",
      s5Title: "Опционально VR",
      s5Body: "Модули → VRChat или SteamVR HUD → включить → держите Эфир запущенным. HUD только для PCVR.",
      dlTitle: "Скачать Kagevi Subtitles",
      dlLede: "v0.7.0 для Windows 10/11 (x64). Нужен WebView2; Chrome — только для Web Speech worker.",
      req1: "Windows 10 или 11 (x64)",
      req2: "Microsoft Edge WebView2 Runtime",
      req3: "Доступ к микрофону",
      req4: "Интернет опционален (облачный перевод / первая загрузка Local ASR)",
      ctaSource: "GitHub",
      ctaSupport: "Поддержать проект",
      licTitle: "Лицензии и атрибуция",
      licLede: "Copyright © 2026 Kiriuru. Все права защищены. Модели Local ASR и ряд рантаймов имеют свои лицензии — ключевые указания ниже.",
      licAppName: "Kagevi Subtitles",
      licAppBody: "Copyright © 2026 Kiriuru. Все права защищены.",
      licParaName: "NVIDIA Parakeet ASR",
      licParaBody: "CC-BY-4.0 — модели NeMo / Suno.ai через ONNX-экспорты",
      licOrtName: "ONNX Runtime",
      licOrtBody: "MIT © Microsoft",
      licSilName: "Silero VAD",
      licSilBody: "MIT © Silero Team (опционально)",
      licSonicName: "Sonic / libsonic",
      licSonicBody: "Apache-2.0 — темп TTS",
      licAppLink: "Лицензия приложения",
      licFooterLink: "Лицензия",
      footerTag: "Локальные живые субтитры — OBS, VRChat, SteamVR.",
      linkWiki: "Wiki",
      linkChangelog: "Список изменений",
      footerPowered: "Powered by Kiriuru",
      closeAria: "Закрыть",
      navMenu: "Меню",
    },
    ja: {
      brandAria: "Kagevi Subtitles ホーム",
      navWhatsNew: "0.7",
      navGuide: "ガイド",
      navWiki: "Wiki",
      navChangelog: "変更履歴",
      navStart: "クイックスタート",
      navDownload: "ダウンロード",
      navLicenses: "ライセンス",
      navGithub: "GitHub",
      carouselPrev: "前の画像",
      carouselNext: "次の画像",
      heroTitle: "配信者向けのライブ翻訳字幕",
      heroLede: "音声から字幕へ。翻訳は任意。OBS・VRChat Chatbox・SteamVR HUD 対応。ローカル優先・プライバシー優先、クラウドアカウント不要。",
      ctaDownload: "Windows 用をダウンロード",
      ctaGuide: "機能ガイド",
      ctaWhatsNew: "0.7 の新機能",
      heroMeta: "Windows 10/11 · Free to use · v0.7.0",
      heroScroll: "Explore",
      whatsEyebrow: "Version 0.7.0",
      whatsTitle: "配信向け — VR にも",
      whatsLede: "同じローカルパイプラインが OBS 視聴者、VRChat の友人、自分の SteamVR ヘッドセットへ。",
      whats1Tag: "Modules",
      whats1Title: "VRChat Chatbox OSC",
      whats1Body: "確定文をソーシャル Chatbox（144 文字）へ。出力を有効化したらウィンドウを閉じて OK。KAT なし。mute/AFK 一時停止は任意。",
      whats2Tag: "PCVR",
      whats2Title: "SteamVR 装着者 HUD",
      whats2Body: "自分だけが見る OpenVR オーバーレイ — HMD / 手首 / ワールド。OBS・VRChat とは別。SteamVR はモジュール hero から起動。",
      whats3Tag: "Overlay",
      whats3Title: "字幕スクロール",
      whats3Body: "OBS 枠内で設計サイズを維持 — 長い行は縦スクロール、速度は調整可能。",
      guideTitle: "製品の仕組み",
      guideLede: "認識・翻訳・OBS・VR モジュール・スタイル・More を案内します。",
      tabLive: "ライブ",
      tabSpeech: "Web Speech",
      tabLocal: "Local ASR",
      tabTranslate: "翻訳",
      tabSubs: "字幕",
      tabObs: "OBS",
      tabModules: "Modules",
      tabVrchat: "VRChat",
      tabSteamvr: "SteamVR",
      tabTts: "TTS",
      tabTwitch: "Twitch",
      tabStyle: "スタイル",
      tabMore: "More",
      gLiveTitle: "ライブ — 操作デスク",
      gLiveIntro: "認識の開始／停止、全タブのステータス、ライブ文字起こし、OBS や VR へ出す前の字幕プレビュー。",
      gLive1: "Start を押すと、未保存でもいまの設定で認識が始まります。",
      gLive2: "モジュールが ready なら Web Speech か Local ASR を選べます。",
      gLive3: "ステータスバーは全タブに固定 — ライブはフル KPI、他タブはコンパクト帯。",
      gLive4: "コンパクトレイアウトはサブモニター向け。Live から任意のコンパクト Chrome worker も。",
      gSpeechTitle: "Web Speech — Chrome worker",
      gSpeechIntro: "browser_google モードは別 Chrome ウィンドウで Web Speech を動かします — 既定はアドレスバー付きフル UI、Live タブから任意のコンパクト --app= も可。",
      gSpeech1: "マイク許可は Chrome 内（getUserMedia）で行います。",
      gSpeech2: "user-data 下の分離プロファイル。Windows ではアンチスロットリング対応。",
      gSpeech3: "話す言語と任意の再開チューニングは Settings で選べます。",
      gSpeech4: "認識は専用の Chrome ウィンドウで動きます — OBS やゲームの裏に開いたままにしてください。",
      gLocalTitle: "Local ASR — オフライン Parakeet",
      gLocalIntro: "任意モジュール：ONNX Runtime（CPU / CUDA）のオフライン Parakeet。Live が Local ASR のときは Chrome worker 不要。",
      gLocal1: "Modules → Local ASR で setup を ready まで完了。",
      gLocal2: "ORT・モデル・任意の Silero VAD / CUDA を遅延ダウンロード。",
      gLocal3: "ネイティブマイク（cpal）と WebRTC または Silero VAD。",
      gLocal4: "取り込み後の字幕／翻訳／オーバーレイ経路は Web Speech と同じ。",
      gTranslateTitle: "翻訳 — 最大 4 行",
      gTranslateIntro: "17 プロバイダー、キュー、キャッシュ、stale 保護。翻訳オフでも ASR（原文のみ）は動作します。",
      gTranslate1: "翻訳行は最大 4（原文は別）。",
      gTranslate2: "キー不要：Google Web、Free Web Translate、Bing Translator。",
      gTranslate3: "任意のリアルタイム翻訳 — 発話中に字幕が更新され、文の完了を待ちません（既定オフ）。",
      gTranslate4: "メモリ／ディスクキャッシュ。遅延翻訳可。完了ブロックは次フレーズの確定まで保持。",
      gSubsTitle: "字幕 — オーバーレイ配置",
      gSubsIntro: "OBS に出す行、順序、プリセット、スクロール速度、完了テキストの表示時間を制御します。",
      gSubs1: "プリセット：single、dual-line、stacked + コンパクト余白（URL クエリ上書き可）。",
      gSubs2: "字幕スクロールで設計フォントを維持 — 長い行は縦スクロール、速度は調整可能。",
      gSubs3: "TTL / lifecycle で次の partial 中も完了テキストを安定表示。",
      gSubs4: "行をドラッグして、OBS で上に出す言語を決めます。",
      gObsTitle: "OBS — Browser Source と CC",
      gObsIntro: "主出力は WebSocket の軽い vanilla オーバーレイ。任意の Closed Captions（OBS WebSocket）は主に Twitch 向け。",
      gObs1: "Browser Source → http://127.0.0.1:8765/overlay",
      gObs2: "Copy URL / Open overlay は OBS タブにあります。",
      gObs3: "Closed Captions は Twitch 配信字幕向け（他用途はほぼありません）。",
      gObs4: "アプリ更新後は Browser Source を再読み込みし、スクロール／スタイルを反映。",
      gModulesTitle: "Modules — サイドカー窓",
      gModulesIntro: "コンパクトカードから TTS・Twitch・Local ASR・VRChat・SteamVR HUD を開きます。有効化後はウィンドウを閉じても出力は継続。",
      gModules1: "ステータス付きスクエアカードと短いヘルプ。",
      gModules2: "テーマプリセットは開いている全モジュールと Chrome worker に即時適用。",
      gModules3: "プロファイルと工場出荷リセットは全モジュール設定を含めます。",
      gModules4: "NVIDIA・VRChat・SteamVR の公式ブランディング。",
      gVrchatTitle: "VRChat — Chatbox OSC",
      gVrchatIntro: "ソーシャル出力：確定文を OSC で VRChat Chatbox へ。他プレイヤーが見るテキスト — ヘッドセット HUD ではありません。",
      gVrchat1: "Modules → VRChat → 出力を有効化 → Live で Start → ウィンドウを閉じ可。",
      gVrchat2: "OSC 127.0.0.1:9000 / 9001 · 最大 144 文字 / 9 行 · KAT なし。",
      gVrchat3: "送信内容は OBS CC と同じ（{source} / {tr1}…{tr4} テンプレート含む）。",
      gVrchat4: "MuteSelf / AFK で任意一時停止。Chatbox 自動クリア（既定 5 秒）。",
      gSteamvrTitle: "SteamVR — 装着者 HUD",
      gSteamvrIntro: "PCVR で自分だけが見る OpenVR オーバーレイ。配信視聴者は OBS のまま。Quest 単体では表示不可。",
      gSteamvr1: "モジュール hero から SteamVR を起動し、Enable HUD + Live Start。",
      gSteamvr2: "HMD・コントローラ（手首／手のひら／上）・ワールドに配置。",
      gSteamvr3: "表示：原文＋有効な翻訳行。",
      gSteamvr4: "手動で SteamVR を終了しても自動再起動しません — モジュールから再 Start。",
      gTtsTitle: "TTS — 字幕読み上げ",
      gTtsIntro: "確定した字幕行を読み上げる任意モジュール。有効時はライブ Start が必要。ウィンドウを閉じても再生は続きます。",
      gTts1: "Modules → TTS（別ウィンドウ /tts）。",
      gTts2: "確定した原文または翻訳行を読み上げ。",
      gTts3: "Google HTTP proxy または Python sidecar；Native / Sonic 再生。",
      gTts4: "出力デバイスとテンポは TTS モジュールで設定（OBS ではありません）。",
      gTwitchTitle: "Twitch — IRC・イベント・TTS",
      gTwitchIntro: "Twitch IRC（最大 5 チャンネル）、EventSub アラート（フォロー / サブ / レイド / チア）、字幕 TTS とは独立した chat/event TTS の別モジュール。ウィンドウを閉じても継続。OAuth redirect は /tts のまま。",
      gTwitch1: "Modules → Twitch（/twitch）。",
      gTwitch2: "Twitch OAuth で接続（EventSub 後は再認可）；有効時は IRC と EventSub が自動接続。",
      gTwitch3: "独自の TTS エンジン、再生スライダー、イベント読み上げテンプレート、フィルター、出力デバイス。",
      gTwitch4: "チャットを待たずにテストフレーズとキュークリア。",
      gStyleTitle: "スタイル — 字幕の見た目",
      gStyleIntro: "フォント、色、縁取り、影、背景、登場アニメ — ダッシュボードプレビューと OBS で共有。",
      gStyle1: "内蔵／クリエイティブプリセット。編集後は Save。",
      gStyle2: "原文と各翻訳行のスロット別上書き。",
      gStyle3: "効果：fade、slide-up、zoom、blur-in、glow など。",
      gStyle4: "UI Theme ギャラリー（ホバーでライブプレビュー）— ダッシュボードとモジュール。OBS の字形には影響しません。",
      gMoreTitle: "More — 置換・プロファイル・ツール",
      gMoreIntro: "単語置換、プロファイル、診断、テーマ、工場出荷リセット — ライブパイプラインの横。",
      gMore1: "単語置換で ASR 誤り（任意マスク）を翻訳・出力前に修正。",
      gMore2: "プロファイルは dashboard + TTS + Twitch + Local ASR + VRChat + SteamVR をまとめて保存。",
      gMore3: "工場出荷リセットは default プロファイルと全モジュール設定を一括復元。",
      gMore4: "UI Theme、Tools & Data、Help は More にあります。",
      pipeTitle: "ひとつのローカルパイプライン",
      pipeLede: "マイクから OBS・VRChat・SteamVR・TTS まで — 配信音声を外部バックエンドへ送らずに。",
      pipe1: "ASR",
      pipe2: "単語置換",
      pipe3: "翻訳",
      pipe4: "OBS · TTS · Twitch · VRChat · SteamVR",
      startTitle: "クイックスタート",
      startLede: "インストーラーからライブ字幕までの 5 ステップ。",
      s1Title: "インストール",
      s1Body: "最新 GitHub Release の Windows x64 セットアップを実行（v0.7.0+）。",
      s2Title: "起動",
      s2Body: "Kagevi Subtitles を開くとメインウィンドウが Live で開きます。",
      s3Title: "OBS ソースを追加",
      s3Body: "Browser Source → http://127.0.0.1:8765/overlay",
      s4Title: "認識を開始",
      s4Body: "Web Speech（Chrome ウィンドウは開いたまま）または ready な Local ASR — それから Start。",
      s5Title: "任意の VR",
      s5Body: "Modules → VRChat または SteamVR HUD → 有効化 → Live を維持。HUD は PCVR のみ。",
      dlTitle: "Kagevi Subtitles を入手",
      dlLede: "v0.7.0 · Windows 10/11 (x64)。WebView2 必須。Chrome は Web Speech worker 用のみ。",
      req1: "Windows 10 または 11（x64）",
      req2: "Microsoft Edge WebView2 Runtime",
      req3: "マイクへのアクセス",
      req4: "インターネットは任意（クラウド翻訳／初回 Local ASR ダウンロード）",
      ctaSource: "GitHub",
      ctaSupport: "プロジェクトを支援",
      licTitle: "ライセンスと帰属",
      licLede: "Copyright © 2026 Kiriuru. All rights reserved. Local ASR モデルと一部ランタイムは独自ライセンス — 主な帰属は以下。",
      licAppName: "Kagevi Subtitles",
      licAppBody: "Copyright © 2026 Kiriuru. All rights reserved.",
      licParaName: "NVIDIA Parakeet ASR",
      licParaBody: "CC-BY-4.0 — NeMo / Suno.ai モデル（ONNX エクスポート）",
      licOrtName: "ONNX Runtime",
      licOrtBody: "MIT © Microsoft",
      licSilName: "Silero VAD",
      licSilBody: "MIT © Silero Team（任意）",
      licSonicName: "Sonic / libsonic",
      licSonicBody: "Apache-2.0 — TTS テンポ",
      licAppLink: "アプリライセンス",
      licFooterLink: "ライセンス",
      footerTag: "ローカル・ライブ字幕 — OBS、VRChat、SteamVR。",
      linkWiki: "Wiki",
      linkChangelog: "変更履歴",
      footerPowered: "Powered by Kiriuru",
      closeAria: "閉じる",
      navMenu: "メニュー",
    },
    zh: {
      brandAria: "Kagevi Subtitles 首页",
      navWhatsNew: "0.7",
      navGuide: "指南",
      navWiki: "Wiki",
      navChangelog: "更新日志",
      navStart: "快速开始",
      navDownload: "下载",
      navLicenses: "许可",
      navGithub: "GitHub",
      carouselPrev: "上一张",
      carouselNext: "下一张",
      heroTitle: "面向主播的实时翻译字幕",
      heroLede: "语音到字幕，可选翻译 — 支持 OBS、VRChat Chatbox 与 SteamVR HUD。本地优先、隐私优先，无需云账号。",
      ctaDownload: "下载 Windows 版",
      ctaGuide: "功能指南",
      ctaWhatsNew: "0.7 新特性",
      heroMeta: "Windows 10/11 · Free to use · v0.7.0",
      heroScroll: "探索",
      whatsEyebrow: "版本 0.7.0",
      whatsTitle: "为直播而生 — 也为 VR",
      whatsLede: "同一本地流水线抵达 OBS 观众、VRChat 好友与你的 SteamVR 头显。",
      whats1Tag: "模块",
      whats1Title: "VRChat Chatbox OSC",
      whats1Body: "将定稿发送到社交 Chatbox（144 字符）。启用输出后可关窗。无 KAT。可选按静音/AFK 暂停。",
      whats2Tag: "PCVR",
      whats2Title: "SteamVR 佩戴者 HUD",
      whats2Body: "仅自己可见的 OpenVR 叠加 — HMD、手腕或世界。与 OBS、VRChat 分离。从模块顶部卡片启动 SteamVR。",
      whats3Tag: "叠加",
      whats3Title: "字幕滚动",
      whats3Body: "OBS 框内保持设计字号 — 过长行纵向滚动，速度可调。",
      guideTitle: "产品如何工作",
      guideLede: "识别、翻译、OBS、VR 模块、样式与「更多」。",
      tabLive: "直播",
      tabSpeech: "Web Speech",
      tabLocal: "Local ASR",
      tabTranslate: "翻译",
      tabSubs: "字幕",
      tabObs: "OBS",
      tabModules: "模块",
      tabVrchat: "VRChat",
      tabSteamvr: "SteamVR",
      tabTts: "TTS",
      tabTwitch: "Twitch",
      tabStyle: "样式",
      tabMore: "更多",
      gLiveTitle: "直播 — 控制台",
      gLiveIntro: "开始/停止识别、各标签页状态条、实时转写，以及发送到 OBS 或 VR 前的字幕预览。",
      gLive1: "按 Start 即可开始识别——即使用户尚未保存，也会使用当前设置。",
      gLive2: "模块就绪时可选择 Web Speech 或 Local ASR。",
      gLive3: "状态栏固定在所有标签 — 直播页完整 KPI，其余为紧凑条。",
      gLive4: "紧凑布局适合副屏；直播页可选紧凑 Chrome worker。",
      gSpeechTitle: "Web Speech — Chrome worker",
      gSpeechIntro: "browser_google 模式在独立 Chrome 窗口中运行 Web Speech——默认带地址栏的完整 UI，也可在 Live 页启用紧凑 --app=。",
      gSpeech1: "麦克风权限在 Chrome 内授予（getUserMedia）。",
      gSpeech2: "user-data 下的隔离配置文件；Windows 有防节流处理。",
      gSpeech3: "在 Settings 中选择口语语言，并可按需调整重启行为。",
      gSpeech4: "识别在独立 Chrome 窗口中运行——可留在 OBS 或游戏后面，保持打开即可。",
      gLocalTitle: "Local ASR — 离线 Parakeet",
      gLocalIntro: "可选模块：通过 ONNX Runtime（CPU/CUDA）的离线 Parakeet。Live 为 Local ASR 时无需 Chrome worker。",
      gLocal1: "Modules → Local ASR，完成 setup 至 ready。",
      gLocal2: "惰性下载 ORT、模型权重，以及可选 Silero VAD / CUDA。",
      gLocal3: "原生麦克风（cpal），配合 WebRTC 或 Silero VAD。",
      gLocal4: "接入后的字幕/翻译/叠加路径与 Web Speech 相同。",
      gTranslateTitle: "翻译 — 最多四行",
      gTranslateIntro: "十七种提供商，含队列、缓存与过期保护。关闭翻译时 ASR（仅原文）仍可用。",
      gTranslate1: "最多四条翻译行（原文单独计算）。",
      gTranslate2: "免密钥：Google Web、Free Web Translate、Bing Translator。",
      gTranslate3: "可选实时翻译 — 说话过程中字幕即更新，不必等句子结束（默认关闭）。",
      gTranslate4: "内存/磁盘缓存；允许迟来翻译；完成块保留到下一句定稿。",
      gSubsTitle: "字幕 — 叠加布局",
      gSubsIntro: "控制 OBS 显示哪些行、顺序、预设、滚动速度，以及完成文本停留多久。",
      gSubs1: "预设：single、dual-line、stacked + 紧凑间距（可用 URL 查询覆盖）。",
      gSubs2: "字幕滚动保持设计字号 — 过长行纵向滚动，速度可调。",
      gSubs3: "TTL / lifecycle 在下一段 partial 期间保持完成文本稳定。",
      gSubs4: "拖动行顺序，决定哪种语言在 OBS 中显示在最上方。",
      gObsTitle: "OBS — Browser Source 与 CC",
      gObsIntro: "主输出是经 WebSocket 的轻量 vanilla 叠加页。可选 Closed Captions（OBS WebSocket）主要用于 Twitch。",
      gObs1: "添加 Browser Source → http://127.0.0.1:8765/overlay",
      gObs2: "Copy URL / Open overlay 在 OBS 标签页。",
      gObs3: "Closed Captions 面向 Twitch 直播字幕（其他场景很少见）。",
      gObs4: "应用更新后请重新加载 Browser Source，以刷新滚动 / 样式资源。",
      gModulesTitle: "模块 — 侧窗",
      gModulesIntro: "紧凑卡片打开 TTS、Twitch、Local ASR、VRChat 与 SteamVR HUD。启用后可关窗，输出继续运行。",
      gModules1: "带状态徽章与简短帮助的方卡。",
      gModules2: "主题预设即时应用到所有已打开模块与 Chrome worker。",
      gModules3: "配置文件与出厂重置包含全部模块配置。",
      gModules4: "卡片上有 NVIDIA、VRChat、SteamVR 官方标识。",
      gVrchatTitle: "VRChat — Chatbox OSC",
      gVrchatIntro: "社交输出：定稿经 OSC 进入 VRChat Chatbox。其他玩家可见 — 不是头显 HUD。",
      gVrchat1: "模块 → VRChat → 启用输出 → 直播页 Start → 可关窗。",
      gVrchat2: "OSC 127.0.0.1:9000 / 9001 · 最多 144 字符 / 9 行 · 无 KAT。",
      gVrchat3: "发送内容与 OBS CC 一致，含 {source} / {tr1}…{tr4} 模板。",
      gVrchat4: "可选按 MuteSelf / AFK 暂停；Chatbox 自动清除（默认 5 秒）。",
      gSteamvrTitle: "SteamVR — 佩戴者 HUD",
      gSteamvrIntro: "PCVR 中仅自己可见的 OpenVR 叠加。直播观众仍看 OBS；Quest 独立机无法显示。",
      gSteamvr1: "从模块顶部卡片启动 SteamVR，然后 Enable HUD + 直播 Start。",
      gSteamvr2: "附着到 HMD、手柄（腕/掌/上方）或世界。",
      gSteamvr3: "显示：原文与已启用的翻译行。",
      gSteamvr4: "手动退出 SteamVR 不会自动重启 — 请从模块再次 Start。",
      gTtsTitle: "TTS — 字幕朗读",
      gTtsIntro: "朗读已定稿字幕行的可选模块。启用后需要直播 Start；关闭窗口不会停止播放。",
      gTts1: "Modules → TTS（独立窗口 /tts）。",
      gTts2: "在行定稿时朗读原文或译文。",
      gTts3: "Google HTTP 代理或 Python sidecar 引擎；Native 或 Sonic 播放。",
      gTts4: "音频设备与语速在 TTS 模块中配置，不在 OBS。",
      gTwitchTitle: "Twitch — IRC、事件与 TTS",
      gTwitchIntro: "Twitch IRC（最多五个频道）、EventSub 提醒（关注 / 订阅 / raid / cheer）与可选聊天和事件 TTS 的独立模块，与字幕 TTS 无关。可关窗继续；OAuth 重定向仍在 /tts。",
      gTwitch1: "Modules → Twitch（/twitch）。",
      gTwitch2: "通过 Twitch OAuth 连接（EventSub 后请重新授权）；启用后 IRC 与 EventSub 自动连接。",
      gTwitch3: "独立的 TTS 引擎、播放滑块、事件朗读模板、过滤器和输出设备。",
      gTwitch4: "无需等待聊天即可测试短语并清空队列。",
      gStyleTitle: "样式 — 字幕外观",
      gStyleIntro: "字体、颜色、描边、阴影、背景与入场动画 — 仪表盘预览与 OBS 共用。",
      gStyle1: "内置与创意预设；修改后请 Save。",
      gStyle2: "原文与各翻译行的按槽覆盖。",
      gStyle3: "效果：fade、slide-up、zoom、blur-in、glow 等。",
      gStyle4: "UI Theme 画廊（悬停实时预览）— 仪表盘与模块，不影响 OBS 字形。",
      gMoreTitle: "更多 — 替换、配置、工具",
      gMoreIntro: "词语替换、配置文件、诊断、主题与出厂重置 — 位于直播流水线旁。",
      gMore1: "词语替换在翻译与输出前修正 ASR 错误（及可选遮罩）。",
      gMore2: "配置文件一并保存 dashboard + TTS + Twitch + Local ASR + VRChat + SteamVR。",
      gMore3: "出厂重置一步恢复 default 配置与全部模块设置。",
      gMore4: "UI Theme、工具与数据、帮助在「更多」中。",
      pipeTitle: "一条本地流水线",
      pipeLede: "从麦克风到 OBS、VRChat、SteamVR 与 TTS — 不必把直播音频送到第三方后端。",
      pipe1: "ASR",
      pipe2: "词语替换",
      pipe3: "翻译",
      pipe4: "OBS · TTS · Twitch · VRChat · SteamVR",
      startTitle: "快速开始",
      startLede: "从安装到实时字幕的五步。",
      s1Title: "安装",
      s1Body: "运行最新 GitHub Release 中的 Windows x64 安装包（v0.7.0+）。",
      s2Title: "启动",
      s2Body: "打开 Kagevi Subtitles — 主窗口直接进入直播页。",
      s3Title: "添加 OBS 源",
      s3Body: "Browser Source → http://127.0.0.1:8765/overlay",
      s4Title: "开始识别",
      s4Body: "Web Speech（保持 Chrome 窗口打开）或就绪的 Local ASR — 然后按 Start。",
      s5Title: "可选 VR",
      s5Body: "模块 → VRChat 或 SteamVR HUD → 启用 → 保持直播运行。HUD 仅限 PCVR。",
      dlTitle: "获取 Kagevi Subtitles",
      dlLede: "v0.7.0 · Windows 10/11 (x64)。需要 WebView2；Chrome 仅用于 Web Speech worker。",
      req1: "Windows 10 或 11（x64）",
      req2: "Microsoft Edge WebView2 Runtime",
      req3: "麦克风访问权限",
      req4: "网络可选（云翻译 / 首次 Local ASR 下载）",
      ctaSource: "GitHub",
      ctaSupport: "支持项目",
      licTitle: "许可与归属",
      licLede: "Copyright © 2026 Kiriuru. 保留所有权利。Local ASR 模型与部分运行时另有许可 — 主要归属如下。",
      licAppName: "Kagevi Subtitles",
      licAppBody: "Copyright © 2026 Kiriuru. 保留所有权利。",
      licParaName: "NVIDIA Parakeet ASR",
      licParaBody: "CC-BY-4.0 — NeMo / Suno.ai 模型（ONNX 导出）",
      licOrtName: "ONNX Runtime",
      licOrtBody: "MIT © Microsoft",
      licSilName: "Silero VAD",
      licSilBody: "MIT © Silero Team（可选）",
      licSonicName: "Sonic / libsonic",
      licSonicBody: "Apache-2.0 — TTS 语速",
      licAppLink: "应用许可",
      licFooterLink: "许可",
      footerTag: "本地实时字幕 — OBS、VRChat、SteamVR。",
      linkWiki: "Wiki",
      linkChangelog: "更新日志",
      footerPowered: "Powered by Kiriuru",
      closeAria: "关闭",
      navMenu: "菜单",
    },
    ko: {
      brandAria: "Kagevi Subtitles 홈",
      navWhatsNew: "0.7",
      navGuide: "가이드",
      navWiki: "Wiki",
      navChangelog: "변경 로그",
      navStart: "빠른 시작",
      navDownload: "다운로드",
      navLicenses: "라이선스",
      navGithub: "GitHub",
      carouselPrev: "이전 이미지",
      carouselNext: "다음 이미지",
      heroTitle: "스트리머를 위한 실시간 번역 자막",
      heroLede: "음성을 자막으로. 번역은 선택. OBS·VRChat Chatbox·SteamVR HUD. 로컬·프라이버시 우선, 클라우드 계정 없음.",
      ctaDownload: "Windows용 다운로드",
      ctaGuide: "기능 가이드",
      ctaWhatsNew: "0.7의 새로운 점",
      heroMeta: "Windows 10/11 · Free to use · v0.7.0",
      heroScroll: "둘러보기",
      whatsEyebrow: "버전 0.7.0",
      whatsTitle: "스트림용 — VR까지",
      whatsLede: "같은 로컬 파이프라인이 OBS 시청자, VRChat 친구, SteamVR 헤드셋으로.",
      whats1Tag: "모듈",
      whats1Title: "VRChat Chatbox OSC",
      whats1Body: "확정을 소셜 Chatbox(144자)로. 출력을 켠 뒤 창을 닫아도 됩니다. KAT 없음. mute/AFK 일시정지는 선택.",
      whats2Tag: "PCVR",
      whats2Title: "SteamVR 착용자 HUD",
      whats2Body: "나만 보는 OpenVR 오버레이 — HMD, 손목, 월드. OBS·VRChat과 분리. SteamVR은 모듈 hero에서 시작.",
      whats3Tag: "오버레이",
      whats3Title: "자막 스크롤",
      whats3Body: "OBS 박스에서 설계 글꼴 유지 — 긴 줄은 세로 스크롤, 속도 조절 가능.",
      guideTitle: "제품 동작 방식",
      guideLede: "인식·번역·OBS·VR 모듈·스타일·More 안내.",
      tabLive: "라이브",
      tabSpeech: "Web Speech",
      tabLocal: "Local ASR",
      tabTranslate: "번역",
      tabSubs: "자막",
      tabObs: "OBS",
      tabModules: "모듈",
      tabVrchat: "VRChat",
      tabSteamvr: "SteamVR",
      tabTts: "TTS",
      tabTwitch: "Twitch",
      tabStyle: "스타일",
      tabMore: "More",
      gLiveTitle: "라이브 — 제어 데스크",
      gLiveIntro: "인식 시작/중지, 모든 탭의 상태, 실시간 전사, OBS·VR로 보내기 전 자막 미리보기.",
      gLive1: "Start를 누르면 저장하지 않아도 현재 설정으로 인식이 시작됩니다.",
      gLive2: "모듈이 ready면 Web Speech 또는 Local ASR를 선택하세요.",
      gLive3: "상태 표시줄이 모든 탭에 고정 — 라이브는 전체 KPI, 나머지는 컴팩트 띠.",
      gLive4: "컴팩트 레이아웃은 보조 모니터용; Live에서 선택적 컴팩트 Chrome worker.",
      gSpeechTitle: "Web Speech — Chrome worker",
      gSpeechIntro: "browser_google 모드는 별도 Chrome 창에서 Web Speech를 실행합니다 — 기본은 주소 표시줄 전체 UI, Live 탭에서 선택적 컴팩트 --app=도 가능.",
      gSpeech1: "마이크 권한은 Chrome 안에서 허용합니다(getUserMedia).",
      gSpeech2: "user-data 아래 격리 프로필. Windows 안티스로틀링 적용.",
      gSpeech3: "말하는 언어와 선택적 재시작 조정은 Settings에서 설정합니다.",
      gSpeech4: "인식은 전용 Chrome 창에서 실행됩니다 — OBS나 게임 뒤에 열어 두세요.",
      gLocalTitle: "Local ASR — 오프라인 Parakeet",
      gLocalIntro: "선택 모듈: ONNX Runtime(CPU/CUDA) 오프라인 Parakeet. Live가 Local ASR일 때 Chrome worker 불필요.",
      gLocal1: "Modules → Local ASR에서 setup을 ready까지 완료.",
      gLocal2: "ORT·모델·선택 Silero VAD/CUDA를 지연 다운로드.",
      gLocal3: "네이티브 마이크(cpal)와 WebRTC 또는 Silero VAD.",
      gLocal4: "인제스트 후 자막/번역/오버레이 경로는 Web Speech와 동일.",
      gTranslateTitle: "번역 — 최대 네 줄",
      gTranslateIntro: "17개 제공자, 큐·캐시·stale 보호. 번역을 꺼도 ASR(원문만)은 동작합니다.",
      gTranslate1: "번역 줄 최대 4개(원문은 별도).",
      gTranslate2: "키 없음: Google Web, Free Web Translate, Bing Translator.",
      gTranslate3: "선택적 실시간 번역 — 말하는 동안 자막이 갱신되며 문장 끝을 기다리지 않습니다(기본 꺼짐).",
      gTranslate4: "메모리/디스크 캐시. 늦은 번역 허용. 완료 블록은 다음 문장 확정까지 유지.",
      gSubsTitle: "자막 — 오버레이 배치",
      gSubsIntro: "OBS에 보일 줄, 순서, 프리셋, 스크롤 속도, 완료 텍스트 유지 시간을 제어합니다.",
      gSubs1: "프리셋: single, dual-line, stacked + 컴팩트 간격(URL 쿼리 덮어쓰기 가능).",
      gSubs2: "자막 스크롤로 설계 글꼴 유지 — 긴 줄은 세로 스크롤, 속도 조절 가능.",
      gSubs3: "TTL / lifecycle로 다음 partial 동안 완료 텍스트를 안정적으로 유지.",
      gSubs4: "줄을 끌어 어떤 언어가 OBS 맨 위에 보일지 정합니다.",
      gObsTitle: "OBS — Browser Source & CC",
      gObsIntro: "주 출력은 WebSocket 기반 가벼운 vanilla 오버레이. 선택 Closed Captions(OBS WebSocket)는 주로 Twitch용.",
      gObs1: "Browser Source 추가 → http://127.0.0.1:8765/overlay",
      gObs2: "Copy URL / Open overlay는 OBS 탭에 있습니다.",
      gObs3: "Closed Captions는 Twitch 스트림 자막용(다른 용도는 드묾).",
      gObs4: "앱 업데이트 후 Browser Source를 다시 로드해 스크롤 / 스타일을 반영하세요.",
      gModulesTitle: "모듈 — 사이드카 창",
      gModulesIntro: "컴팩트 카드로 TTS, Twitch, Local ASR, VRChat, SteamVR HUD를 엽니다. 활성화 후 창을 닫아도 출력은 계속됩니다.",
      gModules1: "상태 배지와 짧은 도움이 있는 사각 카드.",
      gModules2: "테마 프리셋이 열린 모든 모듈과 Chrome worker에 즉시 적용.",
      gModules3: "프로필과 공장 초기화에 모든 모듈 설정이 포함됩니다.",
      gModules4: "NVIDIA·VRChat·SteamVR 공식 브랜딩.",
      gVrchatTitle: "VRChat — Chatbox OSC",
      gVrchatIntro: "소셜 출력: 확정을 OSC로 VRChat Chatbox에. 다른 플레이어가 봄 — 헤드셋 HUD가 아님.",
      gVrchat1: "모듈 → VRChat → 출력 켜기 → Live에서 Start → 창 닫기 가능.",
      gVrchat2: "OSC 127.0.0.1:9000 / 9001 · 최대 144자 / 9줄 · KAT 없음.",
      gVrchat3: "보낼 내용은 OBS CC와 동일({source} / {tr1}…{tr4} 템플릿 포함).",
      gVrchat4: "MuteSelf / AFK 선택 일시정지. Chatbox 자동 지우기(기본 5초).",
      gSteamvrTitle: "SteamVR — 착용자 HUD",
      gSteamvrIntro: "PCVR에서 나만 보는 OpenVR 오버레이. 스트림 시청자는 OBS. Quest 단독은 표시 불가.",
      gSteamvr1: "모듈 hero에서 SteamVR 시작 후 Enable HUD + Live Start.",
      gSteamvr2: "HMD, 컨트롤러(손목/손바닥/위), 월드에 부착.",
      gSteamvr3: "표시: 원문 + 켜진 번역 줄.",
      gSteamvr4: "수동으로 SteamVR을 종료해도 자동 재시작하지 않음 — 모듈에서 다시 Start.",
      gTtsTitle: "TTS — 자막 음성",
      gTtsIntro: "확정된 자막 줄을 읽어 주는 선택 모듈. 활성화 시 라이브 Start 필요. 창을 닫아도 재생은 계속됩니다.",
      gTts1: "Modules → TTS(별도 창 /tts).",
      gTts2: "확정된 원문 또는 번역 줄을 읽어 줍니다.",
      gTts3: "Google HTTP proxy 또는 Python sidecar 엔진; Native 또는 Sonic 재생.",
      gTts4: "오디오 장치와 템포는 TTS 모듈에서 설정(OBS 아님).",
      gTwitchTitle: "Twitch — IRC, 이벤트, TTS",
      gTwitchIntro: "Twitch IRC(최대 5채널), EventSub 알림(팔로우 / 구독 / 레이드 / 치어), 자막 TTS와 독립된 선택적 채팅·이벤트 TTS 모듈. 창을 닫아도 유지. OAuth redirect는 /tts.",
      gTwitch1: "Modules → Twitch(/twitch).",
      gTwitch2: "Twitch OAuth로 연결(EventSub 후 재인증); 활성화 시 IRC와 EventSub 자동 연결.",
      gTwitch3: "별도 TTS 엔진, 재생 슬라이더, 이벤트 읽기 템플릿, 필터, 출력 장치.",
      gTwitch4: "채팅 없이 테스트 문구 및 큐 비우기.",
      gStyleTitle: "스타일 — 자막 모습",
      gStyleIntro: "글꼴, 색, 외곽선, 그림자, 배경, 등장 효과 — 대시보드 미리보기와 OBS가 공유.",
      gStyle1: "내장/크리에이티브 프리셋. 수정 후 Save.",
      gStyle2: "원문과 각 번역 줄의 슬롯 덮어쓰기.",
      gStyle3: "효과: fade, slide-up, zoom, blur-in, glow 등.",
      gStyle4: "UI Theme 갤러리(호버 라이브 미리보기) — 대시보드와 모듈. OBS 글리프에는 영향 없음.",
      gMoreTitle: "More — 치환, 프로필, 도구",
      gMoreIntro: "단어 치환, 프로필, 진단, 테마, 공장 초기화 — 라이브 파이프라인 옆.",
      gMore1: "단어 치환으로 ASR 오류(선택 마스킹)를 번역·출력 전에 수정.",
      gMore2: "프로필은 dashboard + TTS + Twitch + Local ASR + VRChat + SteamVR을 함께 저장.",
      gMore3: "공장 초기화는 default 프로필과 모든 모듈 설정을 한 번에 복원.",
      gMore4: "UI Theme, Tools & Data, Help는 More에 있습니다.",
      pipeTitle: "하나의 로컬 파이프라인",
      pipeLede: "마이크에서 OBS·VRChat·SteamVR·TTS까지 — 스트림 오디오를 외부 백엔드로 보내지 않습니다.",
      pipe1: "ASR",
      pipe2: "단어 치환",
      pipe3: "번역",
      pipe4: "OBS · TTS · Twitch · VRChat · SteamVR",
      startTitle: "빠른 시작",
      startLede: "설치부터 실시간 자막까지 다섯 단계.",
      s1Title: "설치",
      s1Body: "최신 GitHub Release의 Windows x64 설치 파일을 실행하세요(v0.7.0+).",
      s2Title: "실행",
      s2Body: "Kagevi Subtitles를 열면 메인 창이 Live로 열립니다.",
      s3Title: "OBS 소스 추가",
      s3Body: "Browser Source → http://127.0.0.1:8765/overlay",
      s4Title: "인식 시작",
      s4Body: "Web Speech(Chrome 창을 열어 둔 채) 또는 ready인 Local ASR — 그다음 Start.",
      s5Title: "선택 VR",
      s5Body: "모듈 → VRChat 또는 SteamVR HUD → 활성화 → Live 유지. HUD는 PCVR만.",
      dlTitle: "Kagevi Subtitles 받기",
      dlLede: "v0.7.0 · Windows 10/11 (x64). WebView2 필요. Chrome은 Web Speech worker 전용.",
      req1: "Windows 10 또는 11(x64)",
      req2: "Microsoft Edge WebView2 Runtime",
      req3: "마이크 접근",
      req4: "인터넷 선택(클라우드 번역 / 최초 Local ASR 다운로드)",
      ctaSource: "GitHub",
      ctaSupport: "프로젝트 후원",
      licTitle: "라이선스 및 고지",
      licLede: "Copyright © 2026 Kiriuru. All rights reserved. Local ASR 모델과 일부 런타임은 별도 라이선스 — 주요 고지는 아래.",
      licAppName: "Kagevi Subtitles",
      licAppBody: "Copyright © 2026 Kiriuru. All rights reserved.",
      licParaName: "NVIDIA Parakeet ASR",
      licParaBody: "CC-BY-4.0 — NeMo / Suno.ai 모델(ONNX 내보내기)",
      licOrtName: "ONNX Runtime",
      licOrtBody: "MIT © Microsoft",
      licSilName: "Silero VAD",
      licSilBody: "MIT © Silero Team(선택)",
      licSonicName: "Sonic / libsonic",
      licSonicBody: "Apache-2.0 — TTS 템포",
      licAppLink: "앱 라이선스",
      licFooterLink: "라이선스",
      footerTag: "로컬 실시간 자막 — OBS, VRChat, SteamVR.",
      linkWiki: "Wiki",
      linkChangelog: "변경 로그",
      footerPowered: "Powered by Kiriuru",
      closeAria: "닫기",
      navMenu: "메뉴",
    },
  };
  function detectSiteLang() {
    const saved = localStorage.getItem("kagevi-site-lang");
    if (saved && STRINGS[saved]) return saved;
    const nav = (navigator.language || "").toLowerCase();
    if (nav.startsWith("ru")) return "ru";
    if (nav.startsWith("ja")) return "ja";
    if (nav.startsWith("zh")) return "zh";
    if (nav.startsWith("ko")) return "ko";
    return "en";
  }

  function applyGithubLinks() {
    document.querySelectorAll("[data-github]").forEach((el) => {
      const kind = el.getAttribute("data-github");
      const href =
        kind === "home"
          ? GITHUB_URL
          : kind === "releases-latest"
            ? GITHUB_RELEASES_LATEST
            : kind === "license"
              ? GITHUB_LICENSE
              : kind === "notices"
                ? GITHUB_NOTICES
                : null;
      if (href) {
        el.setAttribute("href", href);
      }
    });
  }

  function scrollToId(id) {
    const el = document.getElementById(id);
    if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }

  // Honor deep links like index.html#licenses / #guide after sticky header offset.
  if (location.hash.length > 1) {
    const id = decodeURIComponent(location.hash.slice(1));
    requestAnimationFrame(() => scrollToId(id));
  }

  let lang = detectSiteLang();

  const lightbox = document.getElementById("lightbox");
  const lightboxImg = lightbox?.querySelector("img");
  const lightboxCap = lightbox?.querySelector(".lightbox__cap");
  const lightboxClose = lightbox?.querySelector(".lightbox__close");
  const lightboxPrev = lightbox?.querySelector("[data-lightbox-prev]");
  const lightboxNext = lightbox?.querySelector("[data-lightbox-next]");
  let lightboxCarousel = null;
  let lightboxScrollY = 0;

  function restoreLightboxScroll() {
    // Force instant jump — page CSS uses scroll-behavior: smooth.
    const root = document.documentElement;
    const prev = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, lightboxScrollY);
    root.style.scrollBehavior = prev;
  }

  function slideCaption(img) {
    const key = lang === "ru" ? "data-caption-ru" : "data-caption-en";
    return img.getAttribute(key) || img.getAttribute("data-caption-en") || "";
  }

  function applyLang(next) {
    lang = STRINGS[next] ? next : "en";
    localStorage.setItem("kagevi-site-lang", lang);
    document.documentElement.lang = lang;
    const dict = STRINGS[lang] || STRINGS.en;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key && dict[key] != null) {
        el.textContent = dict[key];
      }
    });

    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      if (key && dict[key] != null) {
        el.setAttribute("aria-label", dict[key]);
      }
    });

    document.querySelectorAll(".lang__btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-lang") === lang);
    });

    if (lightbox?.open && lightboxCarousel) {
      renderLightboxSlide();
    }
  }

  function activateGuideTab(tabId) {
    document.querySelectorAll(".guide-tab").forEach((tab) => {
      const on = tab.getAttribute("data-tab") === tabId;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.querySelectorAll(".guide-panel").forEach((panel) => {
      const on = panel.getAttribute("data-panel") === tabId;
      panel.classList.toggle("is-active", on);
      if (on) {
        panel.removeAttribute("hidden");
      } else {
        panel.setAttribute("hidden", "");
      }
    });
  }

  document.querySelectorAll(".lang__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyLang(btn.getAttribute("data-lang") || "en");
    });
  });

  document.querySelectorAll(".guide-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      activateGuideTab(tab.getAttribute("data-tab") || "live");
      tab.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
    });
  });

  const topbar = document.querySelector(".topbar");
  const navToggle = document.querySelector(".nav-toggle");
  const siteNav = document.getElementById("site-nav");

  function setNavOpen(open) {
    if (!topbar || !navToggle) return;
    topbar.classList.toggle("is-nav-open", open);
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  navToggle?.addEventListener("click", () => {
    setNavOpen(!topbar?.classList.contains("is-nav-open"));
  });

  siteNav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setNavOpen(false));
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setNavOpen(false);
    if (!lightbox?.open) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      stepLightbox(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      stepLightbox(1);
    }
  });

  window.matchMedia("(min-width: 720px)").addEventListener("change", (event) => {
    if (event.matches) setNavOpen(false);
  });

  function renderLightboxSlide() {
    if (!lightbox || !lightboxImg || !lightboxCap || !lightboxCarousel) return;
    const img = lightboxCarousel.slides[lightboxCarousel.index];
    if (!img) return;
    const caption = slideCaption(img);
    lightboxImg.src = img.getAttribute("src") || "";
    lightboxImg.alt = caption;
    lightboxCap.textContent = caption;
    const multi = lightboxCarousel.slides.length > 1;
    lightbox.classList.toggle("is-multi", multi);
    lightboxPrev?.toggleAttribute("hidden", !multi);
    lightboxNext?.toggleAttribute("hidden", !multi);
  }

  function openLightbox(carousel, slideIndex) {
    if (!lightbox || !carousel) return;
    lightboxCarousel = carousel;
    carousel.show(slideIndex);
    renderLightboxSlide();
    if (typeof lightbox.showModal === "function" && !lightbox.open) {
      // Chromium scrolls the page when focusing a <dialog>; keep the guide in place.
      lightboxScrollY = window.scrollY;
      lightbox.showModal();
      restoreLightboxScroll();
      requestAnimationFrame(restoreLightboxScroll);
    }
  }

  function stepLightbox(delta) {
    if (!lightboxCarousel || lightboxCarousel.slides.length < 2) return;
    lightboxCarousel.show(lightboxCarousel.index + delta);
    renderLightboxSlide();
  }

  document.querySelectorAll("[data-carousel]").forEach((root) => {
    const slides = [...root.querySelectorAll("[data-slide]")];
    if (!slides.length) return;

    const dotsHost = root.querySelector("[data-carousel-dots]");
    let index = Math.max(
      0,
      slides.findIndex((img) => img.classList.contains("is-active"))
    );

    function show(next) {
      index = (next + slides.length) % slides.length;
      slides.forEach((img, i) => {
        img.classList.toggle("is-active", i === index);
      });
      if (dotsHost) {
        [...dotsHost.children].forEach((dot, i) => {
          dot.classList.toggle("is-active", i === index);
        });
      }
    }

    const api = {
      slides,
      get index() {
        return index;
      },
      show,
    };

    if (slides.length > 1 && dotsHost) {
      dotsHost.innerHTML = "";
      slides.forEach((_, i) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "guide-carousel__dot" + (i === index ? " is-active" : "");
        dot.setAttribute("aria-label", `Slide ${i + 1}`);
        dot.addEventListener("click", () => show(i));
        dotsHost.appendChild(dot);
      });
      root.querySelector("[data-carousel-prev]")?.addEventListener("click", () =>
        show(index - 1)
      );
      root.querySelector("[data-carousel-next]")?.addEventListener("click", () =>
        show(index + 1)
      );
    } else {
      root.removeAttribute("data-multi");
    }

    slides.forEach((img, i) => {
      img.addEventListener("click", () => openLightbox(api, i));
    });
  });

  lightboxPrev?.addEventListener("click", (event) => {
    event.stopPropagation();
    stepLightbox(-1);
  });
  lightboxNext?.addEventListener("click", (event) => {
    event.stopPropagation();
    stepLightbox(1);
  });
  lightboxClose?.addEventListener("click", () => lightbox?.close());
  lightbox?.addEventListener("click", (event) => {
    if (event.target === lightbox) lightbox.close();
  });
  lightbox?.addEventListener("close", () => {
    lightboxCarousel = null;
    lightbox?.classList.remove("is-multi");
    restoreLightboxScroll();
    requestAnimationFrame(restoreLightboxScroll);
  });

  applyGithubLinks();
  applyLang(lang);
})();
