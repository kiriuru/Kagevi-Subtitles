(() => {
  /** Synced from voicesub-types::DEFAULT_GITHUB_REPO via `npm run version:sync`. */
  const GITHUB_REPO = "kiriuru/Kagevi-Subtitles";
  const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;
  const GITHUB_RELEASES_LATEST = `${GITHUB_URL}/releases/latest`;
  const GITHUB_LICENSE = `${GITHUB_URL}/blob/main/LICENSE`;

  const STRINGS = {
    en: {
      brandAria: "Kagevi Subtitles home",
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
      heroLede:
        "Speech to on-screen captions with optional translation — local-first, privacy-first, ready for OBS.",
      ctaDownload: "Download for Windows",
      ctaGuide: "Feature guide",
      heroMeta: "Windows 10/11 · MIT · v0.6.4",
      heroScroll: "Explore",
      guideTitle: "How the product works",
      guideLede:
        "Wiki-style walkthrough of each major surface — recognition, translation, overlay, modules, and style.",
      tabLive: "Live",
      tabSpeech: "Web Speech",
      tabLocal: "Local ASR",
      tabTranslate: "Translation",
      tabSubs: "Subtitles",
      tabObs: "OBS",
      tabTts: "TTS",
      tabStyle: "Style",
      gLiveTitle: "Live — the control desk",
      gLiveIntro:
        "Start and stop recognition, watch status chips, read the live transcript, and preview subtitle output before it hits OBS.",
      gLive1: "Start sends the current config snapshot (including unsaved edits).",
      gLive2: "Choose Web Speech or Local ASR when the module is ready.",
      gLive3: "Subtitle preview mirrors the OBS overlay payload shape.",
      gLive4: "Compact layout fits a secondary monitor or phone-style window.",
      gSpeechTitle: "Web Speech — Chrome worker",
      gSpeechIntro:
        "Production mode browser_google runs Google Chrome Web Speech in a separate visible window with an address bar — not a hidden tab.",
      gSpeech1: "Microphone permission is granted inside Chrome (getUserMedia).",
      gSpeech2: "Isolated worker profile under user-data; anti-throttling flags on Windows.",
      gSpeech3: "Recognition language and advanced restart / force-final options in Settings.",
      gSpeech4: "Don't minimize the worker window — it can stay behind other apps.",
      gLocalTitle: "Local ASR — offline Parakeet",
      gLocalIntro:
        "Optional sidecar module: Parakeet TDT via ONNX Runtime (CPU or CUDA). No Chrome worker when Live mode is local_parakeet.",
      gLocal1: "Open Modules → Local ASR and finish setup until ready.",
      gLocal2: "Lazy-download ORT, model weights, optional Silero VAD and CUDA redist.",
      gLocal3: "Native mic capture (cpal) with WebRTC or Silero VAD.",
      gLocal4: "Same subtitle / translation / overlay path as Web Speech after ingest.",
      gTranslateTitle: "Translation — up to four lines",
      gTranslateIntro:
        "Seventeen providers with queueing, cache, and stale-drop protection. ASR still works with translation turned off (source-only).",
      gTranslate1: "Up to four translation lines (source text is separate).",
      gTranslate2: "Keyless options: Google Web, Free Web Translate, Microsoft Edge Translate.",
      gTranslate3:
        "Optional realtime translation — captions update while you speak, without waiting for the phrase to finish (off by default).",
      gTranslate4:
        "Memory/disk cache; late translations allowed; completed blocks stay until the next phrase finalizes.",
      gSubsTitle: "Subtitles — overlay layout",
      gSubsIntro:
        "Control which lines appear on the OBS overlay, their order, preset, and how long completed text remains visible.",
      gSubs1: "Presets: single, dual-line, stacked, compact (URL query overrides available).",
      gSubs2: "Toggle source and translation visibility independently.",
      gSubs3: "TTL / lifecycle settings keep completed text stable during the next partial.",
      gSubs4: "Reorder lines to control what appears first on the overlay.",
      gObsTitle: "OBS — Browser Source & CC",
      gObsIntro:
        "Primary output is a lightweight vanilla overlay page over WebSocket. Optional Closed Captions via OBS WebSocket are mainly for Twitch.",
      gObs1: "Add Browser Source → http://127.0.0.1:8765/overlay",
      gObs2: "Copy URL / open overlay helpers live on the OBS tab.",
      gObs3: "Closed Captions: meant for Twitch stream captions (other uses are uncommon).",
      gObs4: "After app updates, reload the Browser Source if the overlay looks stale.",
      gTtsTitle: "TTS — speech & Twitch chat",
      gTtsIntro:
        "Sidecar module for subtitle speech and Twitch chat TTS with native or Sonic pitch-preserving playback.",
      gTts1: "Open from Modules → TTS (separate window, /tts).",
      gTts2: "Speak translated or source lines as they finalize.",
      gTts3: "Twitch chat TTS for up to five channels.",
      gTts4: "Audio devices and tempo are configured in the TTS module, not OBS.",
      gStyleTitle: "Style — look of the captions",
      gStyleIntro:
        "Fonts, colors, outline, shadow, backgrounds, and animated entrance effects — shared by dashboard preview and OBS overlay.",
      gStyle1: "Built-in and custom presets; Save after edits.",
      gStyle2: "Per-slot overrides for source and each translation line.",
      gStyle3: "Effects: fade, slide-up, zoom, blur-in, glow, and more.",
      gStyle4: "UI Theme (dark/light palette) styles the dashboard only — not the overlay.",
      pipeTitle: "One local pipeline",
      pipeLede:
        "From microphone to OBS — without shipping your stream audio to a proprietary backend.",
      pipe1: "ASR",
      pipe2: "Translate",
      pipe3: "Overlay / TTS",
      startTitle: "Quick start",
      startLede: "Four steps from installer to OBS captions.",
      s1Title: "Install",
      s1Body: "Run the Windows x64 setup from the latest GitHub Release.",
      s2Title: "Launch",
      s2Body: "Open Kagevi Subtitles — the dashboard opens in the main window.",
      s3Title: "Add OBS source",
      s3Body: "Browser Source → http://127.0.0.1:8765/overlay",
      s4Title: "Start recognition",
      s4Body:
        "Web Speech (don't minimize the Chrome worker) or Local ASR when the module is ready — then press Start.",
      dlTitle: "Get Kagevi Subtitles",
      dlLede:
        "Free and open source under MIT. WebView2 required; Chrome only for the Web Speech worker.",
      req1: "Windows 10 or 11 (x64)",
      req2: "Microsoft Edge WebView2 Runtime",
      req3: "Microphone access",
      req4: "Internet optional (cloud translation / first Local ASR download)",
      ctaSource: "Source on GitHub",
      ctaSupport: "Support the project",
      licTitle: "Licenses & attribution",
      licLede:
        "Application code is MIT. Local ASR models and several runtimes keep their own licenses — key attributions below.",
      licAppName: "Kagevi Subtitles",
      licAppBody: "MIT © 2026 Kiriuru",
      licParaName: "NVIDIA Parakeet ASR",
      licParaBody: "CC-BY-4.0 — NeMo / Suno.ai models via ONNX exports",
      licOrtName: "ONNX Runtime",
      licOrtBody: "MIT © Microsoft",
      licSilName: "Silero VAD",
      licSilBody: "MIT © Silero Team (optional)",
      licSonicName: "Sonic / libsonic",
      licSonicBody: "Apache-2.0 — TTS tempo",
      licMitLink: "MIT License",
      footerTag: "Local-first live subtitles for streamers.",
      linkWiki: "Wiki",
      linkChangelog: "Changelog",
      footerPowered: "Powered by Kiriuru",
      closeAria: "Close",
      navMenu: "Menu",
    },
    ru: {
      brandAria: "Kagevi Subtitles — на главную",
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
      heroLede:
        "Речь → субтитры на экране с опциональным переводом. Локально, privacy-first, готово для OBS.",
      ctaDownload: "Скачать для Windows",
      ctaGuide: "Обзор функций",
      heroMeta: "Windows 10/11 · MIT · v0.6.4",
      heroScroll: "Смотреть",
      guideTitle: "Как устроен продукт",
      guideLede:
        "Обзор в стиле Wiki по главным экранам — распознавание, перевод, overlay, модули и стиль.",
      tabLive: "Эфир",
      tabSpeech: "Web Speech",
      tabLocal: "Local ASR",
      tabTranslate: "Перевод",
      tabSubs: "Субтитры",
      tabObs: "OBS",
      tabTts: "TTS",
      tabStyle: "Стиль",
      gLiveTitle: "Эфир — пульт управления",
      gLiveIntro:
        "Старт и стоп распознавания, статусы, живой транскрипт и превью субтитров до вывода в OBS.",
      gLive1: "Start отправляет текущий снимок настроек (включая несохранённые правки).",
      gLive2: "Выберите Web Speech или Local ASR, когда модуль готов.",
      gLive3: "Превью субтитров совпадает по форме с payload OBS overlay.",
      gLive4: "Компактный макет удобен для второго монитора или узкого окна.",
      gSpeechTitle: "Web Speech — Chrome worker",
      gSpeechIntro:
        "Режим browser_google запускает Google Chrome Web Speech в отдельном видимом окне с адресной строкой — не во вкладке и не скрыто.",
      gSpeech1: "Разрешение микрофона выдаётся в Chrome (getUserMedia).",
      gSpeech2: "Изолированный профиль worker в user-data; anti-throttling флаги на Windows.",
      gSpeech3: "Язык распознавания и advanced restart / force-final — в Settings.",
      gSpeech4: "Не сворачивайте окно worker — поверх него могут быть другие окна.",
      gLocalTitle: "Local ASR — офлайн Parakeet",
      gLocalIntro:
        "Опциональный sidecar: Parakeet TDT через ONNX Runtime (CPU или CUDA). Без Chrome worker в режиме local_parakeet.",
      gLocal1: "Modules → Local ASR — завершите setup до статуса ready.",
      gLocal2: "Lazy-download ORT, весов модели, опционально Silero VAD и CUDA redist.",
      gLocal3: "Нативный захват микрофона (cpal) с WebRTC или Silero VAD.",
      gLocal4: "Тот же путь субтитров / перевода / overlay, что и у Web Speech после ingest.",
      gTranslateTitle: "Перевод — до четырёх линий",
      gTranslateIntro:
        "Семнадцать провайдеров с очередью, кэшем и защитой от stale. ASR работает и с выключенным переводом (только source).",
      gTranslate1: "До четырёх линий перевода (исходный текст отдельно).",
      gTranslate2: "Без API key: Google Web, Free Web Translate, Microsoft Edge Translate.",
      gTranslate3:
        "Опциональный realtime-перевод — субтитры обновляются уже во время речи, не дожидаясь конца фразы (по умолчанию выкл.).",
      gTranslate4:
        "Кэш в памяти/на диске; поздние переводы допускаются; completed-блок держится до финала следующей фразы.",
      gSubsTitle: "Субтитры — раскладка overlay",
      gSubsIntro:
        "Какие линии видны в OBS, их порядок, пресет и как долго остаётся completed-текст.",
      gSubs1: "Пресеты: single, dual-line, stacked, compact (есть query-override в URL).",
      gSubs2: "Видимость source и перевода переключается независимо.",
      gSubs3: "TTL / lifecycle удерживают completed-текст, пока идёт следующий partial.",
      gSubs4: "Порядок линий задаёт, что сверху на overlay.",
      gObsTitle: "OBS — Browser Source и CC",
      gObsIntro:
        "Основной вывод — лёгкий vanilla overlay по WebSocket. Опциональные Closed Captions через OBS WebSocket — в основном для Twitch.",
      gObs1: "Добавьте Browser Source → http://127.0.0.1:8765/overlay",
      gObs2: "Copy URL / Open overlay — на вкладке OBS.",
      gObs3: "Closed Captions: рассчитаны на субтитры стрима Twitch (другие сценарии почти не встречаются).",
      gObs4: "После обновления приложения перезагрузите Browser Source, если overlay «залип».",
      gTtsTitle: "TTS — озвучка и Twitch chat",
      gTtsIntro:
        "Sidecar-модуль озвучки субтитров и Twitch chat TTS с native или Sonic (сохранение высоты тона).",
      gTts1: "Modules → TTS (отдельное окно, /tts).",
      gTts2: "Озвучка source или перевода по мере финализации строк.",
      gTts3: "Twitch chat TTS до пяти каналов.",
      gTts4: "Устройства и темп настраиваются в модуле TTS, не в OBS.",
      gStyleTitle: "Стиль — вид субтитров",
      gStyleIntro:
        "Шрифты, цвета, обводка, тень, фон и анимации появления — общие для превью дашборда и OBS overlay.",
      gStyle1: "Встроенные и свои пресеты; после правок — Save.",
      gStyle2: "Переопределения по слотам: source и каждая линия перевода.",
      gStyle3: "Эффекты: fade, slide-up, zoom, blur-in, glow и другие.",
      gStyle4: "UI Theme (тёмная/светлая палитра) влияет только на дашборд — не на overlay.",
      pipeTitle: "Один локальный пайплайн",
      pipeLede: "От микрофона до OBS — без отправки аудио стрима в чужой backend.",
      pipe1: "ASR",
      pipe2: "Перевод",
      pipe3: "Overlay / TTS",
      startTitle: "Быстрый старт",
      startLede: "Четыре шага от установщика до субтитров в OBS.",
      s1Title: "Установка",
      s1Body: "Запустите Windows x64 setup из последнего GitHub Release.",
      s2Title: "Запуск",
      s2Body: "Откройте Kagevi Subtitles — дашборд в главном окне.",
      s3Title: "Источник в OBS",
      s3Body: "Browser Source → http://127.0.0.1:8765/overlay",
      s4Title: "Старт распознавания",
      s4Body:
        "Web Speech (не сворачивайте окно Chrome worker) или Local ASR при ready — затем Start.",
      dlTitle: "Скачать Kagevi Subtitles",
      dlLede:
        "Бесплатно, открытый код (MIT). Нужен WebView2; Chrome — только для Web Speech worker.",
      req1: "Windows 10 или 11 (x64)",
      req2: "Microsoft Edge WebView2 Runtime",
      req3: "Доступ к микрофону",
      req4: "Интернет опционален (облачный перевод / первая загрузка Local ASR)",
      ctaSource: "Исходники на GitHub",
      ctaSupport: "Поддержать проект",
      licTitle: "Лицензии и атрибуция",
      licLede:
        "Код приложения — MIT. Модели Local ASR и ряд рантаймов имеют свои лицензии — ключевые указания ниже.",
      licAppName: "Kagevi Subtitles",
      licAppBody: "MIT © 2026 Kiriuru",
      licParaName: "NVIDIA Parakeet ASR",
      licParaBody: "CC-BY-4.0 — модели NeMo / Suno.ai через ONNX-экспорты",
      licOrtName: "ONNX Runtime",
      licOrtBody: "MIT © Microsoft",
      licSilName: "Silero VAD",
      licSilBody: "MIT © Silero Team (опционально)",
      licSonicName: "Sonic / libsonic",
      licSonicBody: "Apache-2.0 — темп TTS",
      licMitLink: "Лицензия MIT",
      footerTag: "Локальные живые субтитры для стримеров.",
      linkWiki: "Wiki",
      linkChangelog: "Список изменений",
      footerPowered: "Powered by Kiriuru",
      closeAria: "Закрыть",
      navMenu: "Меню",
    },
    ja: {
      brandAria: "Kagevi Subtitles ホーム",
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
      heroLede:
        "音声から画面上の字幕へ。翻訳は任意。ローカル優先・プライバシー優先で OBS にすぐ使えます。",
      ctaDownload: "Windows 用をダウンロード",
      ctaGuide: "機能ガイド",
      heroMeta: "Windows 10/11 · MIT · v0.6.4",
      heroScroll: "Explore",
      guideTitle: "製品の仕組み",
      guideLede:
        "認識・翻訳・オーバーレイ・モジュール・スタイルなど、主な画面を Wiki 風に案内します。",
      tabLive: "ライブ",
      tabSpeech: "Web Speech",
      tabLocal: "Local ASR",
      tabTranslate: "翻訳",
      tabSubs: "字幕",
      tabObs: "OBS",
      tabTts: "TTS",
      tabStyle: "スタイル",
      gLiveTitle: "ライブ — 操作デスク",
      gLiveIntro:
        "認識の開始／停止、ステータス、ライブ文字起こし、OBS へ出す前の字幕プレビュー。",
      gLive1: "Start は現在の設定スナップショット（未保存の変更も含む）を送ります。",
      gLive2: "モジュールが ready なら Web Speech か Local ASR を選べます。",
      gLive3: "字幕プレビューは OBS オーバーレイと同じペイロード形です。",
      gLive4: "コンパクトレイアウトはサブモニターや細いウィンドウ向きです。",
      gSpeechTitle: "Web Speech — Chrome worker",
      gSpeechIntro:
        "browser_google モードは、アドレスバー付きの別 Chrome ウィンドウで Web Speech を動かします（非表示タブではありません）。",
      gSpeech1: "マイク許可は Chrome 内（getUserMedia）で行います。",
      gSpeech2: "user-data 下の分離プロファイル。Windows ではアンチスロットリング対応。",
      gSpeech3: "認識言語と advanced の restart / force-final は Settings にあります。",
      gSpeech4: "worker ウィンドウは最小化しないでください。他アプリの裏でも構いません。",
      gLocalTitle: "Local ASR — オフライン Parakeet",
      gLocalIntro:
        "任意のサイドカー：ONNX Runtime（CPU / CUDA）の Parakeet TDT。local_parakeet 時は Chrome worker 不要。",
      gLocal1: "Modules → Local ASR で setup を ready まで完了。",
      gLocal2: "ORT・モデル・任意の Silero VAD / CUDA を遅延ダウンロード。",
      gLocal3: "ネイティブマイク（cpal）と WebRTC または Silero VAD。",
      gLocal4: "取り込み後の字幕／翻訳／オーバーレイ経路は Web Speech と同じ。",
      gTranslateTitle: "翻訳 — 最大 4 行",
      gTranslateIntro:
        "17 プロバイダー、キュー、キャッシュ、stale 保護。翻訳オフでも ASR（原文のみ）は動作します。",
      gTranslate1: "翻訳行は最大 4（原文は別）。",
      gTranslate2: "キー不要：Google Web、Free Web Translate、Microsoft Edge Translate。",
      gTranslate3:
        "任意のリアルタイム翻訳 — 発話中に字幕が更新され、文の完了を待ちません（既定オフ）。",
      gTranslate4:
        "メモリ／ディスクキャッシュ。遅延翻訳可。完了ブロックは次フレーズの確定まで保持。",
      gSubsTitle: "字幕 — オーバーレイ配置",
      gSubsIntro:
        "OBS オーバーレイに出す行、順序、プリセット、完了テキストの表示時間を制御します。",
      gSubs1: "プリセット：single、dual-line、stacked、compact（URL クエリ上書き可）。",
      gSubs2: "原文と翻訳の表示は個別に切り替え。",
      gSubs3: "TTL / lifecycle で次の partial 中も完了テキストを安定表示。",
      gSubs4: "行の並び替えでオーバーレイの先頭を決めます。",
      gObsTitle: "OBS — Browser Source と CC",
      gObsIntro:
        "主出力は WebSocket の軽い vanilla オーバーレイ。任意の Closed Captions（OBS WebSocket）は主に Twitch 向け。",
      gObs1: "Browser Source → http://127.0.0.1:8765/overlay",
      gObs2: "Copy URL / Open overlay は OBS タブにあります。",
      gObs3: "Closed Captions は Twitch 配信字幕向け（他用途はほぼありません）。",
      gObs4: "アプリ更新後、オーバーレイが古い場合は Browser Source を再読み込み。",
      gTtsTitle: "TTS — 読み上げと Twitch chat",
      gTtsIntro:
        "字幕読み上げと Twitch chat TTS のサイドカー。native または Sonic（ピッチ維持）再生。",
      gTts1: "Modules → TTS（別ウィンドウ /tts）。",
      gTts2: "確定した原文または翻訳行を読み上げ。",
      gTts3: "Twitch chat TTS は最大 5 チャンネル。",
      gTts4: "出力デバイスとテンポは TTS モジュールで設定（OBS ではありません）。",
      gStyleTitle: "スタイル — 字幕の見た目",
      gStyleIntro:
        "フォント、色、縁取り、影、背景、登場アニメ — ダッシュボードプレビューと OBS で共有。",
      gStyle1: "内蔵／カスタムプリセット。編集後は Save。",
      gStyle2: "原文と各翻訳行のスロット別上書き。",
      gStyle3: "効果：fade、slide-up、zoom、blur-in、glow など。",
      gStyle4: "UI Theme（ダーク／ライト）はダッシュボードのみ — オーバーレイには影響しません。",
      pipeTitle: "ひとつのローカルパイプライン",
      pipeLede:
        "マイクから OBS まで — 配信音声を外部バックエンドへ送らずに。",
      pipe1: "ASR",
      pipe2: "翻訳",
      pipe3: "Overlay / TTS",
      startTitle: "クイックスタート",
      startLede: "インストーラーから OBS 字幕までの 4 ステップ。",
      s1Title: "インストール",
      s1Body: "最新 GitHub Release の Windows x64 セットアップを実行。",
      s2Title: "起動",
      s2Body: "Kagevi Subtitles を開くとメインウィンドウにダッシュボードが表示されます。",
      s3Title: "OBS ソースを追加",
      s3Body: "Browser Source → http://127.0.0.1:8765/overlay",
      s4Title: "認識を開始",
      s4Body:
        "Web Speech（Chrome worker は最小化しない）または ready な Local ASR — それから Start。",
      dlTitle: "Kagevi Subtitles を入手",
      dlLede:
        "MIT の無料オープンソース。WebView2 必須。Chrome は Web Speech worker 用のみ。",
      req1: "Windows 10 または 11（x64）",
      req2: "Microsoft Edge WebView2 Runtime",
      req3: "マイクへのアクセス",
      req4: "インターネットは任意（クラウド翻訳／初回 Local ASR ダウンロード）",
      ctaSource: "GitHub のソース",
      ctaSupport: "プロジェクトを支援",
      licTitle: "ライセンスと帰属",
      licLede:
        "アプリコードは MIT。Local ASR モデルや一部ランタイムは独自ライセンス — 主な帰属は以下。",
      licAppName: "Kagevi Subtitles",
      licAppBody: "MIT © 2026 Kiriuru",
      licParaName: "NVIDIA Parakeet ASR",
      licParaBody: "CC-BY-4.0 — NeMo / Suno.ai モデル（ONNX エクスポート）",
      licOrtName: "ONNX Runtime",
      licOrtBody: "MIT © Microsoft",
      licSilName: "Silero VAD",
      licSilBody: "MIT © Silero Team（任意）",
      licSonicName: "Sonic / libsonic",
      licSonicBody: "Apache-2.0 — TTS テンポ",
      licMitLink: "MIT ライセンス",
      footerTag: "配信者向けローカル・ライブ字幕。",
      linkWiki: "Wiki",
      linkChangelog: "変更履歴",
      footerPowered: "Powered by Kiriuru",
      closeAria: "閉じる",
      navMenu: "メニュー",
    },
    zh: {
      brandAria: "Kagevi Subtitles 首页",
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
      heroLede:
        "语音到屏幕字幕，可选翻译。本地优先、隐私优先，即刻对接 OBS。",
      ctaDownload: "下载 Windows 版",
      ctaGuide: "功能指南",
      heroMeta: "Windows 10/11 · MIT · v0.6.4",
      heroScroll: "探索",
      guideTitle: "产品如何工作",
      guideLede:
        "以 Wiki 风格介绍识别、翻译、叠加层、模块与样式等主要界面。",
      tabLive: "直播",
      tabSpeech: "Web Speech",
      tabLocal: "Local ASR",
      tabTranslate: "翻译",
      tabSubs: "字幕",
      tabObs: "OBS",
      tabTts: "TTS",
      tabStyle: "样式",
      gLiveTitle: "直播 — 控制台",
      gLiveIntro:
        "开始/停止识别、查看状态、实时转写，以及发送到 OBS 前的字幕预览。",
      gLive1: "Start 会发送当前配置快照（含未保存的修改）。",
      gLive2: "模块就绪时可选择 Web Speech 或 Local ASR。",
      gLive3: "字幕预览与 OBS 叠加层 payload 形状一致。",
      gLive4: "紧凑布局适合副屏或窄窗口。",
      gSpeechTitle: "Web Speech — Chrome worker",
      gSpeechIntro:
        "browser_google 模式在带地址栏的独立 Chrome 窗口中运行 Web Speech——不是隐藏标签页。",
      gSpeech1: "麦克风权限在 Chrome 内授予（getUserMedia）。",
      gSpeech2: "user-data 下的隔离配置文件；Windows 有防节流处理。",
      gSpeech3: "识别语言与 advanced restart / force-final 在 Settings。",
      gSpeech4: "请勿最小化 worker 窗口——可以被其他窗口挡住。",
      gLocalTitle: "Local ASR — 离线 Parakeet",
      gLocalIntro:
        "可选侧车：通过 ONNX Runtime（CPU/CUDA）的 Parakeet TDT。local_parakeet 时无需 Chrome worker。",
      gLocal1: "Modules → Local ASR，完成 setup 至 ready。",
      gLocal2: "惰性下载 ORT、模型权重，以及可选 Silero VAD / CUDA。",
      gLocal3: "原生麦克风（cpal），配合 WebRTC 或 Silero VAD。",
      gLocal4: "接入后的字幕/翻译/叠加路径与 Web Speech 相同。",
      gTranslateTitle: "翻译 — 最多四行",
      gTranslateIntro:
        "十七种提供商，含队列、缓存与过期保护。关闭翻译时 ASR（仅原文）仍可用。",
      gTranslate1: "最多四条翻译行（原文单独计算）。",
      gTranslate2: "免密钥：Google Web、Free Web Translate、Microsoft Edge Translate。",
      gTranslate3:
        "可选实时翻译 — 说话过程中字幕即更新，不必等句子结束（默认关闭）。",
      gTranslate4:
        "内存/磁盘缓存；允许迟来翻译；完成块保留到下一句定稿。",
      gSubsTitle: "字幕 — 叠加布局",
      gSubsIntro:
        "控制 OBS 叠加层显示哪些行、顺序、预设，以及完成文本停留多久。",
      gSubs1: "预设：single、dual-line、stacked、compact（可用 URL 查询覆盖）。",
      gSubs2: "原文与翻译可见性可分别开关。",
      gSubs3: "TTL / lifecycle 在下一段 partial 期间保持完成文本稳定。",
      gSubs4: "调整行顺序以控制叠加层顶部内容。",
      gObsTitle: "OBS — Browser Source 与 CC",
      gObsIntro:
        "主输出是经 WebSocket 的轻量 vanilla 叠加页。可选 Closed Captions（OBS WebSocket）主要用于 Twitch。",
      gObs1: "添加 Browser Source → http://127.0.0.1:8765/overlay",
      gObs2: "Copy URL / Open overlay 在 OBS 标签页。",
      gObs3: "Closed Captions 面向 Twitch 直播字幕（其他场景很少见）。",
      gObs4: "应用更新后若叠加层过旧，请重新加载 Browser Source。",
      gTtsTitle: "TTS — 朗读与 Twitch 聊天",
      gTtsIntro:
        "字幕朗读与 Twitch 聊天 TTS 侧车，支持 native 或 Sonic（保音调）播放。",
      gTts1: "Modules → TTS（独立窗口 /tts）。",
      gTts2: "在行定稿时朗读原文或译文。",
      gTts3: "Twitch 聊天 TTS 最多五个频道。",
      gTts4: "音频设备与语速在 TTS 模块中配置，不在 OBS。",
      gStyleTitle: "样式 — 字幕外观",
      gStyleIntro:
        "字体、颜色、描边、阴影、背景与入场动画 — 仪表盘预览与 OBS 共用。",
      gStyle1: "内置与自定义预设；修改后请 Save。",
      gStyle2: "原文与各翻译行的按槽覆盖。",
      gStyle3: "效果：fade、slide-up、zoom、blur-in、glow 等。",
      gStyle4: "UI Theme（深/浅色）只影响仪表盘 — 不影响叠加层。",
      pipeTitle: "一条本地流水线",
      pipeLede: "从麦克风到 OBS — 不必把直播音频送到第三方后端。",
      pipe1: "ASR",
      pipe2: "翻译",
      pipe3: "Overlay / TTS",
      startTitle: "快速开始",
      startLede: "从安装到 OBS 字幕的四步。",
      s1Title: "安装",
      s1Body: "运行最新 GitHub Release 中的 Windows x64 安装包。",
      s2Title: "启动",
      s2Body: "打开 Kagevi Subtitles — 主窗口即为仪表盘。",
      s3Title: "添加 OBS 源",
      s3Body: "Browser Source → http://127.0.0.1:8765/overlay",
      s4Title: "开始识别",
      s4Body:
        "Web Speech（勿最小化 Chrome worker）或就绪的 Local ASR — 然后按 Start。",
      dlTitle: "获取 Kagevi Subtitles",
      dlLede:
        "MIT 免费开源。需要 WebView2；Chrome 仅用于 Web Speech worker。",
      req1: "Windows 10 或 11（x64）",
      req2: "Microsoft Edge WebView2 Runtime",
      req3: "麦克风访问权限",
      req4: "网络可选（云翻译 / 首次 Local ASR 下载）",
      ctaSource: "GitHub 源码",
      ctaSupport: "支持项目",
      licTitle: "许可与归属",
      licLede:
        "应用代码为 MIT。Local ASR 模型与部分运行时另有许可 — 主要归属如下。",
      licAppName: "Kagevi Subtitles",
      licAppBody: "MIT © 2026 Kiriuru",
      licParaName: "NVIDIA Parakeet ASR",
      licParaBody: "CC-BY-4.0 — NeMo / Suno.ai 模型（ONNX 导出）",
      licOrtName: "ONNX Runtime",
      licOrtBody: "MIT © Microsoft",
      licSilName: "Silero VAD",
      licSilBody: "MIT © Silero Team（可选）",
      licSonicName: "Sonic / libsonic",
      licSonicBody: "Apache-2.0 — TTS 语速",
      licMitLink: "MIT 许可",
      footerTag: "面向主播的本地实时字幕。",
      linkWiki: "Wiki",
      linkChangelog: "更新日志",
      footerPowered: "Powered by Kiriuru",
      closeAria: "关闭",
      navMenu: "菜单",
    },
    ko: {
      brandAria: "Kagevi Subtitles 홈",
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
      heroLede:
        "음성을 화면 자막으로. 번역은 선택. 로컬·프라이버시 우선, OBS에 바로 연결.",
      ctaDownload: "Windows용 다운로드",
      ctaGuide: "기능 가이드",
      heroMeta: "Windows 10/11 · MIT · v0.6.4",
      heroScroll: "둘러보기",
      guideTitle: "제품 동작 방식",
      guideLede:
        "인식·번역·오버레이·모듈·스타일 등 주요 화면을 Wiki 스타일로 안내합니다.",
      tabLive: "라이브",
      tabSpeech: "Web Speech",
      tabLocal: "Local ASR",
      tabTranslate: "번역",
      tabSubs: "자막",
      tabObs: "OBS",
      tabTts: "TTS",
      tabStyle: "스타일",
      gLiveTitle: "라이브 — 제어 데스크",
      gLiveIntro:
        "인식 시작/중지, 상태, 실시간 전사, OBS로 보내기 전 자막 미리보기.",
      gLive1: "Start는 현재 설정 스냅샷(저장되지 않은 변경 포함)을 보냅니다.",
      gLive2: "모듈이 ready면 Web Speech 또는 Local ASR를 선택하세요.",
      gLive3: "자막 미리보기는 OBS 오버레이와 같은 payload 형태입니다.",
      gLive4: "컴팩트 레이아웃은 보조 모니터나 좁은 창에 적합합니다.",
      gSpeechTitle: "Web Speech — Chrome worker",
      gSpeechIntro:
        "browser_google 모드는 주소 표시줄이 있는 별도 Chrome 창에서 Web Speech를 실행합니다(숨은 탭 아님).",
      gSpeech1: "마이크 권한은 Chrome 안에서 허용합니다(getUserMedia).",
      gSpeech2: "user-data 아래 격리 프로필. Windows 안티스로틀링 적용.",
      gSpeech3: "인식 언어와 advanced restart / force-final은 Settings에 있습니다.",
      gSpeech4: "worker 창을 최소화하지 마세요 — 다른 앱 뒤에 둬도 됩니다.",
      gLocalTitle: "Local ASR — 오프라인 Parakeet",
      gLocalIntro:
        "선택 사이드카: ONNX Runtime(CPU/CUDA) Parakeet TDT. local_parakeet일 때 Chrome worker 불필요.",
      gLocal1: "Modules → Local ASR에서 setup을 ready까지 완료.",
      gLocal2: "ORT·모델·선택 Silero VAD/CUDA를 지연 다운로드.",
      gLocal3: "네이티브 마이크(cpal)와 WebRTC 또는 Silero VAD.",
      gLocal4: "인제스트 후 자막/번역/오버레이 경로는 Web Speech와 동일.",
      gTranslateTitle: "번역 — 최대 네 줄",
      gTranslateIntro:
        "17개 제공자, 큐·캐시·stale 보호. 번역을 꺼도 ASR(원문만)은 동작합니다.",
      gTranslate1: "번역 줄 최대 4개(원문은 별도).",
      gTranslate2: "키 없음: Google Web, Free Web Translate, Microsoft Edge Translate.",
      gTranslate3:
        "선택적 실시간 번역 — 말하는 동안 자막이 갱신되며 문장 끝을 기다리지 않습니다(기본 꺼짐).",
      gTranslate4:
        "메모리/디스크 캐시. 늦은 번역 허용. 완료 블록은 다음 문장 확정까지 유지.",
      gSubsTitle: "자막 — 오버레이 배치",
      gSubsIntro:
        "OBS 오버레이에 보일 줄, 순서, 프리셋, 완료 텍스트 유지 시간을 제어합니다.",
      gSubs1: "프리셋: single, dual-line, stacked, compact(URL 쿼리 덮어쓰기 가능).",
      gSubs2: "원문과 번역 표시를 독립적으로 전환.",
      gSubs3: "TTL / lifecycle로 다음 partial 동안 완료 텍스트를 안정적으로 유지.",
      gSubs4: "줄 순서로 오버레이 맨 위 내용을 정합니다.",
      gObsTitle: "OBS — Browser Source & CC",
      gObsIntro:
        "주 출력은 WebSocket 기반 가벼운 vanilla 오버레이. 선택 Closed Captions(OBS WebSocket)는 주로 Twitch용.",
      gObs1: "Browser Source 추가 → http://127.0.0.1:8765/overlay",
      gObs2: "Copy URL / Open overlay는 OBS 탭에 있습니다.",
      gObs3: "Closed Captions는 Twitch 스트림 자막용(다른 용도는 드묾).",
      gObs4: "앱 업데이트 후 오버레이가 오래되면 Browser Source를 다시 로드.",
      gTtsTitle: "TTS — 음성 & Twitch 채팅",
      gTtsIntro:
        "자막 음성 및 Twitch 채팅 TTS 사이드카. native 또는 Sonic(피치 유지) 재생.",
      gTts1: "Modules → TTS(별도 창 /tts).",
      gTts2: "확정된 원문 또는 번역 줄을 읽어 줍니다.",
      gTts3: "Twitch 채팅 TTS 최대 5채널.",
      gTts4: "오디오 장치와 템포는 TTS 모듈에서 설정(OBS 아님).",
      gStyleTitle: "스타일 — 자막 모습",
      gStyleIntro:
        "글꼴, 색, 외곽선, 그림자, 배경, 등장 효과 — 대시보드 미리보기와 OBS가 공유.",
      gStyle1: "내장/사용자 프리셋. 수정 후 Save.",
      gStyle2: "원문과 각 번역 줄의 슬롯 덮어쓰기.",
      gStyle3: "효과: fade, slide-up, zoom, blur-in, glow 등.",
      gStyle4: "UI Theme(다크/라이트)는 대시보드만 — 오버레이에는 영향 없음.",
      pipeTitle: "하나의 로컬 파이프라인",
      pipeLede:
        "마이크에서 OBS까지 — 스트림 오디오를 외부 백엔드로 보내지 않습니다.",
      pipe1: "ASR",
      pipe2: "번역",
      pipe3: "Overlay / TTS",
      startTitle: "빠른 시작",
      startLede: "설치부터 OBS 자막까지 네 단계.",
      s1Title: "설치",
      s1Body: "최신 GitHub Release의 Windows x64 설치 파일을 실행하세요.",
      s2Title: "실행",
      s2Body: "Kagevi Subtitles를 열면 메인 창에 대시보드가 표시됩니다.",
      s3Title: "OBS 소스 추가",
      s3Body: "Browser Source → http://127.0.0.1:8765/overlay",
      s4Title: "인식 시작",
      s4Body:
        "Web Speech(Chrome worker 최소화 금지) 또는 ready인 Local ASR — 그다음 Start.",
      dlTitle: "Kagevi Subtitles 받기",
      dlLede:
        "MIT 무료 오픈소스. WebView2 필요. Chrome은 Web Speech worker 전용.",
      req1: "Windows 10 또는 11(x64)",
      req2: "Microsoft Edge WebView2 Runtime",
      req3: "마이크 접근",
      req4: "인터넷 선택(클라우드 번역 / 최초 Local ASR 다운로드)",
      ctaSource: "GitHub 소스",
      ctaSupport: "프로젝트 후원",
      licTitle: "라이선스 및 고지",
      licLede:
        "앱 코드는 MIT. Local ASR 모델과 일부 런타임은 별도 라이선스 — 주요 고지는 아래.",
      licAppName: "Kagevi Subtitles",
      licAppBody: "MIT © 2026 Kiriuru",
      licParaName: "NVIDIA Parakeet ASR",
      licParaBody: "CC-BY-4.0 — NeMo / Suno.ai 모델(ONNX 내보내기)",
      licOrtName: "ONNX Runtime",
      licOrtBody: "MIT © Microsoft",
      licSilName: "Silero VAD",
      licSilBody: "MIT © Silero Team(선택)",
      licSonicName: "Sonic / libsonic",
      licSonicBody: "Apache-2.0 — TTS 템포",
      licMitLink: "MIT 라이선스",
      footerTag: "스트리머를 위한 로컬 실시간 자막.",
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
              : null;
      if (href) {
        el.setAttribute("href", href);
      }
    });
  }

  let lang = detectSiteLang();

  const lightbox = document.getElementById("lightbox");
  const lightboxImg = lightbox?.querySelector("img");
  const lightboxCap = lightbox?.querySelector(".lightbox__cap");
  const lightboxClose = lightbox?.querySelector(".lightbox__close");

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
  });

  window.matchMedia("(min-width: 720px)").addEventListener("change", (event) => {
    if (event.matches) setNavOpen(false);
  });

  function openLightbox(src, caption) {
    if (!lightbox || !lightboxImg || !lightboxCap || !src) return;
    lightboxImg.src = src;
    lightboxImg.alt = caption || "";
    lightboxCap.textContent = caption || "";
    if (typeof lightbox.showModal === "function") {
      lightbox.showModal();
    }
  }

  function slideCaption(img) {
    const key =
      lang === "ru" ? "data-caption-ru" : "data-caption-en";
    return img.getAttribute(key) || img.getAttribute("data-caption-en") || "";
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

    slides.forEach((img) => {
      img.addEventListener("click", () => {
        openLightbox(img.getAttribute("src") || "", slideCaption(img));
      });
    });
  });

  lightboxClose?.addEventListener("click", () => lightbox?.close());
  lightbox?.addEventListener("click", (event) => {
    if (event.target === lightbox) lightbox.close();
  });

  applyGithubLinks();
  applyLang(lang);
})();
