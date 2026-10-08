# <img src="./Images/Kagevi_icon.png" alt="" width="72" height="72" valign="middle"> Kagevi Subtitles

**스트리머를 위한 실시간 번역 자막 — 로컬 우선, 프라이버시 우선, OBS 대응.**

[![Version](https://img.shields.io/badge/version-0.7.2-blue.svg)](https://kiriuru.github.io/Kagevi-Subtitles/changelog.html)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11%20x64-lightgrey.svg)](#시스템-요구-사항)
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
  <a href="./docs/TECHNICAL_ARCHITECTURE.en.md">아키텍처</a> ·
  <a href="https://kiriuru.github.io/Kagevi-Subtitles/changelog.html">Changelog</a>
</p>

Kagevi Subtitles는 음성을 실시간 자막으로 바꾸고 선택적 번역을 제공하는 Windows 데스크톱 앱입니다. 인식은 **Google Chrome Web Speech** 또는 오프라인 **Local ASR**(Parakeet / ONNX)입니다. 모든 처리는 로컬에서 이루어집니다 — 기본 바인드 `127.0.0.1:8765`, 클라우드 백엔드·계정 없음.

Kagevi Subtitles 첫 릴리스: **`0.5.0`**. 현재 라인: **`0.7.2`**.

<p align="center">
  <img src="./Images/kagevi_live.png" alt="Kagevi Subtitles Live 탭" width="860">
  <br>
  <em>Live — Start/Stop, 인식 상태, 트랜스크립트, 자막 미리보기</em>
</p>

## 목차

- [기능](#기능)
- [스크린샷](#스크린샷)
- [시스템 요구 사항](#시스템-요구-사항)
- [빠른 시작](#빠른-시작)
- [데이터 경로](#데이터-경로)
- [문제 해결](#문제-해결)
- [문서](#문서)
- [기여](#기여)
- [라이선스](#라이선스)

## 기능

| 영역 | 제공 내용 |
| --- | --- |
| **음성** | Google Chrome Web Speech 워커, 또는 오프라인 Local ASR (Parakeet / ONNX, CPU 또는 CUDA) |
| **텍스트 형식** | 이 빌드에서는 숨김 / 비활성 (파이프라인 꺼짐) |
| **번역** | 17개 제공자 (Baidu / Youdao / Tencent / Caiyun 포함), 최대 **4** 번역 줄 (소스는 별도). 클래식 MT용 선택적 **realtime** 번역 (기본 꺼짐). **API 키 불필요** 3종: Google Web, Free Web Translate, Bing Translator |
| **OBS** | Browser Source 오버레이 (**자막 스크롤** + 속도) + 선택적 Closed Captions (OBS WebSocket, 주로 Twitch) |
| **스타일** | 애니메이션 자막 프리셋, 슬롯별 스타일; 호버 미리보기 UI 테마 갤러리 |
| **TTS** | Native / Sonic 재생; 자막 음성 (창 없이 활성화 가능; Live Start 필요) |
| **Twitch** | IRC (Broadcaster가 스트리머 채팅에 자동 참여; 추가 채널 선택, 채팅만, 최대 5 JOIN), 스트리머 채널 EventSub 알림 (팔로우 / 구독 / 레이드 / 치어 / 채널 포인트 보상), 필터, 자막 TTS와 독립적인 채팅·이벤트 TTS |
| **Local ASR** | `/local-asr` 설정 마법사; 준비되면 Live 모드 `local_parakeet` |
| **VRChat** | Chatbox OSC 출력 (`/vrchat`) — 최종문을 VRChat 소셜 Chatbox로 (144자) |
| **SteamVR HUD** | OpenVR 오버레이 (`/vr-overlay`) — PCVR에서 착용자만 자막; OBS·VRChat과 분리 |
| **운영** | Diagnostics ZIP; 공장 초기화 및 프로필 (dashboard + TTS / Twitch / Local ASR / VRChat / SteamVR HUD); UI 로케일 en / de / ru / ja / ko / zh |

보조 모니터용 컴팩트 폰 스타일 레이아웃 제공.

## 스크린샷

<details>
<summary><strong>스크린샷 보기</strong></summary>

<table>
  <tr>
    <td align="center" width="50%">
      <img src="./Images/kagevi_translation.png" alt="Translation 탭" width="420"><br>
      <strong>번역</strong><br>
      <sub>제공자, 캐시, 최대 4 번역 줄</sub>
    </td>
    <td align="center" width="50%">
      <img src="./Images/kagevi_subtitles.png" alt="Subtitles 탭" width="420"><br>
      <strong>자막</strong><br>
      <sub>오버레이 프리셋, 가시성, 순서, TTL</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_style_1.png" alt="Subtitle Style 탭" width="420"><br>
      <strong>자막 스타일</strong><br>
      <sub>글꼴, 색, 효과, 슬롯별 스타일</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_obs_1.png" alt="OBS 탭" width="420"><br>
      <strong>OBS</strong><br>
      <sub>오버레이 URL 및 Closed Captions (Twitch)</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_modules_main.png" alt="Modules 탭" width="420"><br>
      <strong>모듈</strong><br>
      <sub>TTS, Twitch, Local ASR, VRChat, SteamVR HUD 사이드카 창 열기</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_settings.png" alt="Settings" width="420"><br>
      <strong>설정</strong><br>
      <sub>레이아웃, 디스패처, 글꼴, Advanced Web Speech</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_localASR_1.png" alt="Local ASR 모듈" width="420"><br>
      <strong>Local ASR</strong><br>
      <sub>오프라인 Parakeet / ONNX (CPU 또는 CUDA)</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_tts_1.png" alt="TTS 모듈" width="420"><br>
      <strong>TTS</strong><br>
      <sub>자막 음성 및 재생</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_UI_theme.png" alt="UI Theme 탭" width="420"><br>
      <strong>UI 테마</strong><br>
      <sub>호버 미리보기 프리셋 갤러리; 다크/라이트 및 액센트</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_compact_UI.png" alt="컴팩트 레이아웃" width="420"><br>
      <strong>컴팩트 레이아웃</strong><br>
      <sub>보조 모니터용 폰 스타일 창</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_tts_twitch_1.png" alt="Twitch 모듈" width="420"><br>
      <strong>Twitch</strong><br>
      <sub>IRC 채팅 로그, 연결, 선택적 채팅 TTS</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_tts_twitch_2.png" alt="Twitch 필터" width="420"><br>
      <strong>Twitch 필터</strong><br>
      <sub>이모트, 언어, 말하기 템플릿, 닉 치환</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_tts_twitch_voice_remaps.png" alt="Twitch 음성 리맵" width="420"><br>
      <strong>Twitch 음성 리맵</strong><br>
      <sub>채팅 TTS 언어별 엔진/보이스</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_localASR_setup.png" alt="Local ASR 설정" width="420"><br>
      <strong>Local ASR 설정</strong><br>
      <sub>ORT / CUDA 구성 요소 및 Parakeet 모델</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_vrchat_1.png" alt="VRChat 모듈" width="420"><br>
      <strong>VRChat</strong><br>
      <sub>VR 소셜 자막용 OSC Chatbox 출력</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_vrchat_2.png" alt="VRChat 템플릿" width="420"><br>
      <strong>VRChat 템플릿</strong><br>
      <sub>전송 내용, Mute/AFK 일시정지, Chatbox 한도</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_steamVR_1.png" alt="SteamVR HUD 모듈" width="420"><br>
      <strong>SteamVR HUD</strong><br>
      <sub>PCVR에서 착용자만 보는 OpenVR 오버레이</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_steamVR_2.png" alt="SteamVR 배치" width="420"><br>
      <strong>SteamVR 배치</strong><br>
      <sub>캘리브레이션, 오프셋, 표시 내용</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_steamVR_3.png" alt="SteamVR 디스플레이" width="420"><br>
      <strong>SteamVR 디스플레이</strong><br>
      <sub>캔버스 프리셋, 글꼴, submit 간격</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_steamVR_4.png" alt="SteamVR Twitch 패널" width="420"><br>
      <strong>SteamVR Twitch 패널</strong><br>
      <sub>OpenVR 선택적 채팅 오버레이</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_word_replace.png" alt="Word Replace 탭" width="420"><br>
      <strong>단어 치환</strong><br>
      <sub>번역·오버레이 전에 ASR 오류 수정</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_tools_data.png" alt="Tools and Data 탭" width="420"><br>
      <strong>도구 &amp; 데이터</strong><br>
      <sub>프로필, Diagnostics ZIP, 런타임 상태</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="./Images/kagevi_help.png" alt="Help 탭" width="420"><br>
      <strong>도움말</strong><br>
      <sub>앱 내 가이드 및 빠른 시작 체크리스트</sub>
    </td>
    <td align="center">
      <img src="./Images/kagevi_webWorker_compact.png" alt="컴팩트 Web Speech 워커" width="420"><br>
      <strong>컴팩트 워커</strong><br>
      <sub>Chrome <code>/google-asr-compact</code> --app 창</sub>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <img src="./Images/kagevi_webWorker.png" alt="Web Speech 워커" width="640"><br>
      <strong>Web Speech 워커</strong><br>
      <sub>Chrome <code>/google-asr</code> 창 — 인식 중 표시 유지</sub>
    </td>
  </tr>
</table>

</details>

슬롯 오버라이드, OBS Closed Captions 추가 설정, 제공자 API 키, Local ASR 테스트 벤치, SteamVR HUD 배치, Twitch 채팅 필터: [Wiki](https://kiriuru.github.io/Kagevi-Subtitles/wiki.html).

## 시스템 요구 사항

- Windows 10 또는 11 (x64)
- **Microsoft Edge WebView2 Runtime** (Windows 11에 보통 사전 설치; Windows 10에서는 NSIS 설치 프로그램이 부트스트랩 가능)
- **Google Chrome** — Web Speech 워커 전용 (Local ASR만 사용하면 불필요)
- 마이크 접근
- 인터넷 — 클라우드 번역 제공자에 선택적; Local ASR 최초 모델 / ORT 다운로드에도 사용

코어 설치 프로그램에 Python, Node.js, CUDA 없음. CUDA는 Local ASR 선택 다운로드입니다.

## 빠른 시작

1. `Kagevi Subtitles_0.7.2_x64-setup.exe`(또는 릴리스 폴더의 최신 빌드)에서 설치.
2. **Kagevi Subtitles.exe** 실행 — 대시보드가 `http://127.0.0.1:8765/`에서 열립니다.
3. OBS에서 **Browser Source** 추가 → `http://127.0.0.1:8765/overlay`.
4. 필요하면 번역과 자막 스타일을 설정한 뒤 **Start**.
5. 인식 선택:
   - **Web Speech** — Chrome 워커를 최소화하지 마세요 (다른 앱 뒤에 둬도 됨; 마이크 권한은 거기에서). 선택적 컴팩트 워커: `/google-asr-compact`.
   - **Local ASR** — **모듈 → Local ASR**, ready까지 설정 완료 → Live에서 Local ASR 선택 → Start.
6. 선택 **VRChat Chatbox** — **모듈 → VRChat** → VRChat에서 OSC 켜기 → **연결 테스트** / **테스트 전송** → **출력 사용** → Live에서 **Start** → 창 닫기.
7. 선택 **PCVR HUD** — **모듈 → SteamVR HUD** → **SteamVR 시작**(히어로 카드) → 배치 및 **표시 내용** 설정 → **자막 오버레이 사용** 및/또는 **채팅 오버레이 사용** → Live에서 **Start**(자막) → 모듈 창 닫기. Quest 스탠드얼론에서는 이 HUD를 표시할 수 없습니다.
8. 선택 **Twitch 채팅** — **모듈 → Twitch** → **Broadcaster 토큰 받기**(`/tts` 리다이렉트) → **연결**(스트리머 채팅에 자동 참여). 추가 채널·봇은 선택. TTS가 필요하면 **채팅 말하기** / **채널 이벤트 말하기**(자막 TTS와 독립; IRC에 Live **Start** 불필요). 예전 토큰에 `chat:read`가 없으면 다시 **Broadcaster 토큰 받기**.

상태 표시줄(ASR / WebSocket / Worker / OBS CC + Start/Stop)은 모든 탭에 고정 — Live에서는 전체, 그 외에는 컴팩트.

단계별 UI 가이드: [Wiki](https://kiriuru.github.io/Kagevi-Subtitles/wiki.html)

## 데이터 경로

| 경로 | 내용 |
| --- | --- |
| `user-data/config.toml` | 기본 설정 |
| `user-data/profiles/` | 이름 있는 프로필 |
| `user-data/modules/tts/` | TTS 설정 |
| `user-data/modules/twitch/` | Twitch IRC / 채팅 TTS 설정 |
| `user-data/modules/local-asr/` | Local ASR 설정, 모델, ORT / CUDA 런타임 |
| `user-data/modules/vrchat/` | VRChat Chatbox OSC 설정 |
| `user-data/modules/vr-overlay/` | SteamVR HUD 오버레이 설정 |
| `user-data/translation-cache/` | 번역 캐시 |
| `logs/` | `core.log`, `runtime-events.log`, `session-latest.jsonl` |
| `bin/fonts/` | 자막 글꼴 |

## 문제 해결

| 증상 | 확인할 것 |
| --- | --- |
| 자막 없음 | **Start** 눌림; Chrome 워커 최소화 안 됨(Web Speech) **또는** Local ASR ready + 마이크 선택 |
| 소스는 있는데 번역 없음 | 번역 켜짐; 최소 한 줄 활성; 제공자 자격 증명 |
| OBS가 비어 있음 | URL은 `/overlay`; 앱 실행 + Live에서 **Start**. OBS를 앱보다 *먼저* 열었다면 **Browser Source 우클릭 → 새로 고침** 한 번(OBS는 실패한 페이지를 스스로 다시 불러오지 않음). 이후 Start/Stop/재시작은 자동 재연결 |
| OBS에서 글자가 잘림 | 자막 탭: **자막 스크롤**(기본 켜짐) + **스크롤 속도**; 오버레이 JS/CSS가 바뀌는 *앱 업데이트* 후 Browser Source 새로 고침 |
| Google Web / keyless MT 429 | 기다리거나 번역 줄 줄이기, 또는 설정에서 간격 변경; Free Web Translate와 Bing은 별도 버킷 |
| 앱 종료 후에도 글자가 남음 | 재연결 시 `/live` 프로브 + idle replay로 지움; 예전 Browser Source가 마지막 프레임을 유지하면 빌드 업데이트 |
| 포트 사용 중 | `8765` 비우거나 bind 변경(개발 빌드) |
| Live에 Local ASR 없음 | 모듈 → Local ASR: 마법사를 `ready`까지 완료 |
| SteamVR HUD가 안 보임 | PCVR만; 히어로 카드에서 **SteamVR 시작**; **자막 오버레이 사용** 및/또는 **채팅 오버레이 사용** + Live에서 **Start**(자막); SteamVR 실행 중 |
| 수동 종료 후 SteamVR이 다시 시작됨 | 빌드 업데이트 — 모듈에서 다시 SteamVR을 시작할 때까지 HUD가 `VR_Init`을 호출하면 안 됨 |

전체 가이드: [Wiki → Troubleshooting](https://kiriuru.github.io/Kagevi-Subtitles/wiki.html).

## 문서

- [Wiki](https://kiriuru.github.io/Kagevi-Subtitles/wiki.html) — 사용자 가이드 (사이트 EN/RU)
- [Changelog](https://kiriuru.github.io/Kagevi-Subtitles/changelog.html) — 릴리스 노트 (사이트 EN/RU)
- [Technical Architecture (EN)](./docs/TECHNICAL_ARCHITECTURE.en.md) / [(RU)](./docs/TECHNICAL_ARCHITECTURE.md)
- 저장소 마크다운: [`docs/WIKI.*.md`](./docs/WIKI.en.md), [`docs/CHANGELOG*.md`](./docs/CHANGELOG.en.md)

## 기여

Pull request를 환영합니다. 큰 변경은 먼저 issue를 열어 주세요.

**기여자 가이드:** [CONTRIBUTING.md](./CONTRIBUTING.md) — 번역 제공자·자막 글꼴 추가 PR 체크리스트, i18n, 테스트(영어).

관련: [Code of Conduct](./CODE_OF_CONDUCT.md) · [Security policy](./SECURITY.md) · [Support](./SUPPORT.md)

```powershell
cargo test --workspace
npm run build
npm run test:frontend
```

<details>
<summary><strong>개발자 — 스택 및 빌드</strong></summary>

### 스택

| 계층 | 기술 |
| --- | --- |
| Core | Rust 워크스페이스 (`crates/voicesub-*`) + Axum HTTP/WS |
| Shell | Tauri 2 → `Kagevi Subtitles.exe` (NSIS) |
| Dashboard | Svelte 5 + Vite → `bin/dashboard/` |
| Worker | Svelte 5 → `bin/worker/` |
| Overlay | Vanilla HTML/JS → `bin/overlay/` |
| TTS | Svelte + Rust 서비스 + 내장 `google_tts_fetch.exe` 런타임 |
| Twitch | Svelte + `voicesub-twitch` (공유 사이드카 선택적 채팅 TTS) |
| Local ASR | Svelte + `voicesub-asr-local` + ONNX Runtime (지연 다운로드) |
| VRChat / SteamVR HUD | Svelte 모듈 UI + Rust 출력 크레이트 (`voicesub-vrchat`, `voicesub-vr-overlay`) |

Node.js는 **빌드 타임 전용** — 설치 프로그램에 포함되지 않습니다.

### 소스에서 빌드

```powershell
npm install
npm run build          # dashboard + worker + TTS + Twitch + Local ASR + VRChat + SteamVR HUD
npm run i18n:export    # scripts/i18n-source → locale JSON
npm run i18n:bundle    # overlay locales bundle
cargo test --workspace
build-release-msi.bat  # → release_root에 NSIS setup.exe
```

Tauri `beforeBuildCommand`: `npm run build && npm run scrub:shipped-bin`. 번들: `bin/dashboard`, `overlay`, `worker`, `tts`, `twitch`, `local-asr`, `vrchat`, `vr-overlay`, 및 allowlist 복사 `bin/.bundle-fonts/` → `bin/fonts`(최상위 페이스 + 라이선스), `bin/.bundle-modules/` → `bin/modules`(`module.toml` + 플랫폼 바이너리 — TTS Python/빌드 스크립트나 압축 해제된 글꼴 패밀리 트리 제외).

### 주요 크레이트

`voicesub-runtime` · `voicesub-subtitle` · `voicesub-translation` · `voicesub-browser` · `voicesub-ws` · `voicesub-tts` · `voicesub-twitch` · `voicesub-asr-local` · `voicesub-vrchat` · `voicesub-vr-overlay` · `voicesub-partial-emit` · `voicesub-obs`

`src-tauri/`는 얇은 IPC 셸 — 도메인 로직 없음.

버전 원본: `crates/voicesub-types/src/version.rs`의 `voicesub-types::PROJECT_VERSION` — 거기서 bump 후 `npm run version:sync`(`npm run build`에서도 실행).

전체 참조: [Technical Architecture](./docs/TECHNICAL_ARCHITECTURE.en.md).

</details>

## 라이선스

Copyright © 2026 Kiriuru. All rights reserved. 이용 조건은 **[Kagevi Subtitles License](./LICENSE)** 를 보세요.

최종 사용자 도구로 앱을 **무료로** 사용할 수 있으며, 광고·구독·후원으로 수익화되는 스트림이나 채널에서도 사용할 수 있습니다. **앱 판매, 재배포, 또는 소프트웨어 자체의 상업화**(유료 빌드, 유료 기능, SaaS, 유료 번들 등)는 허용되지 않습니다.

**상표:** “Kagevi”, “Kagevi Subtitles” 및 프로젝트 로고/아이콘은 Kiriuru의 표장입니다. 이 라이선스는 소프트웨어 저작권을 다루며, 해당 이름이나 브랜딩에 대한 권리는 **부여하지 않습니다**. [LICENSE](./LICENSE)의 Trademarks 절을 보세요.

서드파티 모델 가중치와 런타임(NVIDIA Parakeet **CC-BY-4.0**, ONNX Runtime, Silero VAD, Sonic/libsonic 등)은 각자의 라이선스를 유지합니다 — [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
