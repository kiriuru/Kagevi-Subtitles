# <img src="./Images/Kagevi_icon.png" alt="" width="72" height="72" valign="middle"> Kagevi Subtitles

**配信者向けリアルタイム翻訳字幕 — ローカル優先・プライバシー優先・OBS対応。**

[![Version](https://img.shields.io/badge/version-0.7.2-blue.svg)](https://kiriuru.github.io/Kagevi-Subtitles/changelog.html)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11%20x64-lightgrey.svg)](#システム要件)
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
  <a href="./docs/TECHNICAL_ARCHITECTURE.en.md">アーキテクチャ</a> ·
  <a href="https://kiriuru.github.io/Kagevi-Subtitles/changelog.html">Changelog</a>
</p>

Kagevi Subtitles は、音声をリアルタイム字幕に変換し、任意で翻訳できる Windows デスクトップアプリです。認識は **Google Chrome Web Speech**、またはオフラインの **Local ASR**（Parakeet / ONNX）です。すべて自機上で動作します — 既定バインド `127.0.0.1:8765`、クラウドバックエンドやアカウントはありません。

Kagevi Subtitles 初回リリース: **`0.5.0`**。現行ライン: **`0.7.2`**。

<p align="center">
  <img src="./Images/kagevi_live.png" alt="Kagevi Subtitles Live タブ" width="860">
  <br>
  <em>Live — Start/Stop、認識状態、トランスクリプト、字幕プレビュー</em>
</p>

## 目次

- [機能](#機能)
- [スクリーンショット](#スクリーンショット)
- [システム要件](#システム要件)
- [クイックスタート](#クイックスタート)
- [データパス](#データパス)
- [トラブルシューティング](#トラブルシューティング)
- [ドキュメント](#ドキュメント)
- [コントリビューション](#コントリビューション)
- [ライセンス](#ライセンス)

## 機能

| 領域 | 内容 |
| --- | --- |
| **音声** | Google Chrome Web Speech ワーカー、またはオフライン Local ASR（Parakeet / ONNX、CPU または CUDA） |
| **テキスト形式** | このビルドでは非表示 / 無効（パイプラインはオフ） |
| **翻訳** | 17 プロバイダ（Baidu / Youdao / Tencent / Caiyun 含む）、最大 **4** 翻訳行（ソースは別）。クラシック MT 向け任意の **realtime** 翻訳（既定オフ）。**API キー不要**は 3 つ: Google Web、Free Web Translate、Bing Translator |
| **OBS** | Browser Source オーバーレイ（**字幕スクロール** + 速度）+ 任意の Closed Captions（OBS WebSocket、主に Twitch 向け） |
| **スタイル** | アニメ付き字幕プリセット、スロット別スタイル; ホバープレビュー付き UI テーマギャラリー |
| **TTS** | Native / Sonic 再生; 字幕読み上げ（ウィンドウなしで有効化可; Live Start が必要） |
| **Twitch** | IRC（Broadcaster が配信者チャットに自動参加; 追加チャンネルは任意・チャットのみ・最大 5 JOIN）、配信者チャンネルの EventSub アラート（フォロー / サブ / レイド / チア / チャンネルポイント報酬）、フィルタ、字幕 TTS とは独立したチャット・イベント TTS |
| **Local ASR** | `/local-asr` のセットアップウィザード; 準備完了時 Live モード `local_parakeet` |
| **VRChat** | Chatbox OSC 出力（`/vrchat`）— 最終文を VRChat ソーシャル Chatbox へ（144 文字） |
| **SteamVR HUD** | OpenVR オーバーレイ（`/vr-overlay`）— PCVR で装着者のみの字幕; OBS / VRChat とは独立 |
| **運用** | Diagnostics ZIP; 工場出荷リセットとプロファイル（dashboard + TTS / Twitch / Local ASR / VRChat / SteamVR HUD）; UI ロケール en / de / ru / ja / ko / zh |

サブモニター向けのコンパクトなスマホ風レイアウトあり。

## スクリーンショット

<details>
<summary><strong>スクリーンショットを表示</strong></summary>

<table>
  <tr>
    <td align="center" width="50%">
      <img src="./Images/kagevi_translation.png" alt="Translation タブ" width="420"><br>
      <strong>翻訳</strong><br>
      <sub>プロバイダ、キャッシュ、最大 4 翻訳行</sub>
    </td>
    <td align="center" width="50%">
      <img src="./Images/kagevi_subtitles.png" alt="Subtitles タブ" width="420"><br>
      <strong>字幕</strong><br>
      <sub>オーバーレイプリセット、表示、順序、TTL</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_style_1.png" alt="Subtitle Style タブ" width="420"><br>
      <strong>字幕スタイル</strong><br>
      <sub>フォント、色、効果、スロット別スタイル</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_obs_1.png" alt="OBS タブ" width="420"><br>
      <strong>OBS</strong><br>
      <sub>オーバーレイ URL と Closed Captions（Twitch）</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_modules_main.png" alt="Modules タブ" width="420"><br>
      <strong>モジュール</strong><br>
      <sub>TTS / Twitch / Local ASR / VRChat / SteamVR HUD のサイドカー窓を開く</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_settings.png" alt="Settings" width="420"><br>
      <strong>設定</strong><br>
      <sub>レイアウト、ディスパッチャ、フォント、Advanced Web Speech</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_localASR_1.png" alt="Local ASR モジュール" width="420"><br>
      <strong>Local ASR</strong><br>
      <sub>オフライン Parakeet / ONNX（CPU または CUDA）</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_tts_1.png" alt="TTS モジュール" width="420"><br>
      <strong>TTS</strong><br>
      <sub>字幕読み上げと再生</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_UI_theme.png" alt="UI Theme タブ" width="420"><br>
      <strong>UI テーマ</strong><br>
      <sub>ホバープレビュー付きプリセットギャラリー; ダーク/ライトとアクセント</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_compact_UI.png" alt="コンパクトレイアウト" width="420"><br>
      <strong>コンパクトレイアウト</strong><br>
      <sub>セカンドモニタ向けスマホ風ウィンドウ</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_tts_twitch_1.png" alt="Twitch モジュール" width="420"><br>
      <strong>Twitch</strong><br>
      <sub>IRC チャットログ、接続、任意のチャット TTS</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_tts_twitch_2.png" alt="Twitch フィルタ" width="420"><br>
      <strong>Twitch フィルタ</strong><br>
      <sub>エモート、言語、読み上げテンプレート、ニック置換</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_tts_twitch_voice_remaps.png" alt="Twitch ボイスリマップ" width="420"><br>
      <strong>Twitch ボイスリマップ</strong><br>
      <sub>チャット TTS の言語別エンジン／ボイス</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_localASR_setup.png" alt="Local ASR セットアップ" width="420"><br>
      <strong>Local ASR セットアップ</strong><br>
      <sub>ORT / CUDA コンポーネントと Parakeet モデル</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_vrchat_1.png" alt="VRChat モジュール" width="420"><br>
      <strong>VRChat</strong><br>
      <sub>VR 向けソーシャル字幕の OSC Chatbox 出力</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_vrchat_2.png" alt="VRChat テンプレート" width="420"><br>
      <strong>VRChat テンプレート</strong><br>
      <sub>送信内容、Mute/AFK 一時停止、Chatbox 制限</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_steamVR_1.png" alt="SteamVR HUD モジュール" width="420"><br>
      <strong>SteamVR HUD</strong><br>
      <sub>PCVR で装着者のみの OpenVR オーバーレイ</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_steamVR_2.png" alt="SteamVR 配置" width="420"><br>
      <strong>SteamVR 配置</strong><br>
      <sub>キャリブレーション、オフセット、表示内容</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_steamVR_3.png" alt="SteamVR 表示" width="420"><br>
      <strong>SteamVR 表示</strong><br>
      <sub>キャンバス、フォント、submit 間隔</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_steamVR_4.png" alt="SteamVR Twitch パネル" width="420"><br>
      <strong>SteamVR Twitch パネル</strong><br>
      <sub>OpenVR の任意チャットオーバーレイ</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_word_replace.png" alt="Word Replace タブ" width="420"><br>
      <strong>単語置換</strong><br>
      <sub>翻訳・オーバーレイ前に ASR 誤りを修正</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_tools_data.png" alt="Tools and Data タブ" width="420"><br>
      <strong>ツール &amp; データ</strong><br>
      <sub>プロファイル、Diagnostics ZIP、ランタイム状態</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_help.png" alt="Help タブ" width="420"><br>
      <strong>ヘルプ</strong><br>
      <sub>アプリ内ガイドとクイックスタートチェックリスト</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_webWorker_compact.png" alt="コンパクト Web Speech ワーカー" width="420"><br>
      <strong>コンパクトワーカー</strong><br>
      <sub>Chrome <code>/google-asr-compact</code> --app ウィンドウ</sub>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <img src="./Images/kagevi_webWorker.png" alt="Web Speech ワーカー" width="640"><br>
      <strong>Web Speech ワーカー</strong><br>
      <sub>Chrome <code>/google-asr</code> ウィンドウ — 認識中は表示を維持</sub>
    </td>
  </tr>
</table>

</details>

スロット上書き、OBS Closed Captions 追加設定、プロバイダ API キー、Local ASR テストベンチ、SteamVR HUD 配置、Twitch チャットフィルタ: [Wiki](https://kiriuru.github.io/Kagevi-Subtitles/wiki.html)。

## システム要件

- Windows 10 または 11（x64）
- **Microsoft Edge WebView2 Runtime**（Windows 11 では通常プリインストール; Windows 10 では NSIS インストーラがブートストラップ可能）
- **Google Chrome** — Web Speech ワーカー専用（Local ASR のみなら不要）
- マイクへのアクセス
- インターネット — クラウド翻訳プロバイダには任意; Local ASR の初回モデル / ORT ダウンロードにも使用

コアインストーラに Python / Node.js / CUDA は含まれません。CUDA は Local ASR の任意ダウンロードです。

## クイックスタート

1. `Kagevi Subtitles_0.7.2_x64-setup.exe`（またはリリースフォルダの最新ビルド）からインストール。
2. **Kagevi Subtitles.exe** を起動 — ダッシュボードは `http://127.0.0.1:8765/` で開きます。
3. OBS で **Browser Source** を追加 → `http://127.0.0.1:8765/overlay`。
4. 必要なら翻訳と字幕スタイルを設定し、**Start**。
5. 認識を選択:
   - **Web Speech** — Chrome ワーカーを最小化しない（他アプリの裏に置いて可; マイク許可はそこで付与）。任意のコンパクトワーカー: `/google-asr-compact`。
   - **Local ASR** — **モジュール → Local ASR**、ready までセットアップ → Live で Local ASR を選択 → Start。
6. 任意 **VRChat Chatbox** — **モジュール → VRChat** → VRChat で OSC オン → **接続テスト** / **テスト送信** → **出力を有効化** → Live で **Start** → ウィンドウを閉じる。
7. 任意 **PCVR HUD** — **モジュール → SteamVR HUD** → **SteamVR を開始**（ヒーローカード）→ 配置と **表示内容** を設定 → **字幕オーバーレイを有効化** および/または **チャットオーバーレイを有効化** → Live で **Start**（字幕用）→ モジュール窓を閉じる。Quest スタンドアロンではこの HUD は表示されません。
8. 任意 **Twitch チャット** — **モジュール → Twitch** → **Broadcaster トークンを取得**（`/tts` 経由リダイレクト）→ **接続**（配信者チャットに自動参加）。追加チャンネルとボットは任意。TTS が必要なら **チャットを読み上げ** / **チャンネルイベントを読み上げ**（字幕 TTS とは独立; IRC に Live **Start** は不要）。古いトークンに `chat:read` が無い場合は再度 **Broadcaster トークンを取得**。

ステータスバー（ASR / WebSocket / Worker / OBS CC + Start/Stop）は全タブに固定 — Live ではフル、他ではコンパクト。

UI の手順ガイド: [Wiki](https://kiriuru.github.io/Kagevi-Subtitles/wiki.html)

## データパス

| パス | 内容 |
| --- | --- |
| `user-data/config.toml` | メイン設定 |
| `user-data/profiles/` | 名前付きプロファイル |
| `user-data/modules/tts/` | TTS 設定 |
| `user-data/modules/twitch/` | Twitch IRC / チャット TTS 設定 |
| `user-data/modules/local-asr/` | Local ASR 設定、モデル、ORT / CUDA ランタイム |
| `user-data/modules/vrchat/` | VRChat Chatbox OSC 設定 |
| `user-data/modules/vr-overlay/` | SteamVR HUD オーバーレイ設定 |
| `user-data/translation-cache/` | 翻訳キャッシュ |
| `logs/` | `core.log`, `runtime-events.log`, `session-latest.jsonl` |
| `bin/fonts/` | 字幕フォント |

## トラブルシューティング

| 症状 | 確認すること |
| --- | --- |
| 字幕が出ない | **Start** 済み; Chrome ワーカー未最小化（Web Speech）**または** Local ASR ready + マイク選択 |
| ソースはあるが翻訳なし | 翻訳オン; 少なくとも 1 行アクティブ; プロバイダ認証情報 |
| OBS が空 | URL は `/overlay`; アプリ起動 + Live で **Start**。OBS をアプリより*先に*開いていた場合、一度 **Browser Source を右クリック → 更新**（OBS は失敗ページを自動再読込しません）。以降は Start/Stop/再起動で自動再接続 |
| OBS で文字が切れる | 字幕タブ: **字幕スクロール**（既定オン）と **スクロール速度**; オーバーレイ JS/CSS が変わる*アプリ更新*後は Browser Source を再読込 |
| Google Web / keyless MT 429 | 待つ、翻訳行を減らす、または設定の間隔を変更; Free Web Translate と Bing は別バケット |
| アプリ終了後も文字が残る | 再接続時に `/live` プローブ + idle replay でクリア; 古い Browser Source が最終フレームを保持する場合はビルドを更新 |
| ポート使用中 | `8765` を空けるか bind を変更（開発ビルド） |
| Live に Local ASR がない | モジュール → Local ASR: ウィザードを `ready` まで完了 |
| SteamVR HUD が見えない | PCVR のみ; ヒーローカードで **SteamVR を開始**; **字幕オーバーレイを有効化** および/または **チャットオーバーレイを有効化** + Live で **Start**（字幕）; SteamVR 起動中 |
| 手動終了後に SteamVR が再起動する | ビルドを更新 — モジュールから再度 SteamVR を開始するまで HUD は `VR_Init` を呼んではいけません |

完全ガイド: [Wiki → Troubleshooting](https://kiriuru.github.io/Kagevi-Subtitles/wiki.html)。

## ドキュメント

- [Wiki](https://kiriuru.github.io/Kagevi-Subtitles/wiki.html) — ユーザーガイド（サイトは EN/RU）
- [Changelog](https://kiriuru.github.io/Kagevi-Subtitles/changelog.html) — リリースノート（サイトは EN/RU）
- [Technical Architecture (EN)](./docs/TECHNICAL_ARCHITECTURE.en.md) / [(RU)](./docs/TECHNICAL_ARCHITECTURE.md)
- リポジトリ内 Markdown: [`docs/WIKI.*.md`](./docs/WIKI.en.md)、[`docs/CHANGELOG*.md`](./docs/CHANGELOG.en.md)

## コントリビューション

Pull request 歓迎です。大きな変更は先に issue を開いてください。

**コントリビューターガイド:** [CONTRIBUTING.md](./CONTRIBUTING.md) — 翻訳プロバイダや字幕フォント追加の PR チェックリスト、i18n、テスト（英語）。

関連: [Code of Conduct](./CODE_OF_CONDUCT.md) · [Security policy](./SECURITY.md) · [Support](./SUPPORT.md)

```powershell
cargo test --workspace
npm run build
npm run test:frontend
```

<details>
<summary><strong>開発者 — スタックとビルド</strong></summary>

### スタック

| 層 | 技術 |
| --- | --- |
| Core | Rust ワークスペース（`crates/voicesub-*`）+ Axum HTTP/WS |
| Shell | Tauri 2 → `Kagevi Subtitles.exe`（NSIS） |
| Dashboard | Svelte 5 + Vite → `bin/dashboard/` |
| Worker | Svelte 5 → `bin/worker/` |
| Overlay | Vanilla HTML/JS → `bin/overlay/` |
| TTS | Svelte + Rust サービス + 埋め込み `google_tts_fetch.exe` ランタイム |
| Twitch | Svelte + `voicesub-twitch`（共有サイドカー経由の任意チャット TTS） |
| Local ASR | Svelte + `voicesub-asr-local` + ONNX Runtime（遅延ダウンロード） |
| VRChat / SteamVR HUD | Svelte モジュール UI + Rust 出力クレート（`voicesub-vrchat`, `voicesub-vr-overlay`） |

Node.js は **ビルド時のみ** — インストーラには含まれません。

### ソースからビルド

```powershell
npm install
npm run build          # dashboard + worker + TTS + Twitch + Local ASR + VRChat + SteamVR HUD
npm run i18n:export    # scripts/i18n-source → locale JSON
npm run i18n:bundle    # overlay locales bundle
cargo test --workspace
build-release-msi.bat  # → release_root に NSIS setup.exe
```

Tauri `beforeBuildCommand`: `npm run build && npm run scrub:shipped-bin`。同梱: `bin/dashboard`, `overlay`, `worker`, `tts`, `twitch`, `local-asr`, `vrchat`, `vr-overlay`、および allowlist コピー `bin/.bundle-fonts/` → `bin/fonts`（トップレベル面 + ライセンス）と `bin/.bundle-modules/` → `bin/modules`（`module.toml` + プラットフォームバイナリ — TTS の Python/ビルドスクリプトや展開済みフォント家族ツリーは含めない）。

### 主要クレート

`voicesub-runtime` · `voicesub-subtitle` · `voicesub-translation` · `voicesub-browser` · `voicesub-ws` · `voicesub-tts` · `voicesub-twitch` · `voicesub-asr-local` · `voicesub-vrchat` · `voicesub-vr-overlay` · `voicesub-partial-emit` · `voicesub-obs`

`src-tauri/` は薄い IPC シェル — ドメインロジックなし。

バージョン元: `crates/voicesub-types/src/version.rs` の `voicesub-types::PROJECT_VERSION` — そこで bump し、`npm run version:sync`（`npm run build` からも実行）。

完全な参照: [Technical Architecture](./docs/TECHNICAL_ARCHITECTURE.en.md)。

</details>

## ライセンス

Copyright © 2026 Kiriuru. All rights reserved. 利用条件は **[Kagevi Subtitles License](./LICENSE)** を参照してください。

エンドユーザーツールとしてアプリを**無料で**利用でき、広告・サブスク・投げ銭などで収益化している配信やチャンネルでも使用できます。**アプリの販売、再配布、またはソフトウェア自体の商業化**（有料ビルド、有料機能、SaaS、有料バンドルなど）は許可されません。

**商標:** 「Kagevi」「Kagevi Subtitles」およびプロジェクトのロゴ/アイコンは Kiriuru の標章です。本ライセンスはソフトウェアの著作権を対象とし、これらの名称やブランディングの権利は**付与しません**。[LICENSE](./LICENSE) の Trademarks 節を参照してください。

サードパーティのモデル重みとランタイム（**CC-BY-4.0** の NVIDIA Parakeet、ONNX Runtime、Silero VAD、Sonic/libsonic など）は各々のライセンスのままです — [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) を参照。
