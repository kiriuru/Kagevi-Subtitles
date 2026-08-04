# TTS module embedded Python runtime

Shipped layout (built locally or in CI, not required in git for dev):

```
bin/modules/tts/runtime/
  win-x64/google_tts_fetch.exe
  macos-arm64/google_tts_fetch
  macos-x64/google_tts_fetch
  linux-x64/google_tts_fetch
```

Do **not** ship Nuitka/PyInstaller intermediates (`*.build`, `*.dist`, `*.onefile-build`, `runtime/build/`).
`build_runtime.py` compiles into a work tree under `runtime/build/`, copies only the onefile binary into the platform dir, then deletes the work tree. `npm run scrub:shipped-bin` (also run from `build-release.ps1`) removes any leftovers before NSIS packaging.

Build (developer machine only):

```bat
bin\modules\tts\build_runtime.bat
```

Kagevi Subtitles uses this embedded binary instead of system `python`/`py`.
`build_runtime.py` tries Nuitka first, then PyInstaller if Nuitka fails (common on embeddable CPython).
Dev debug builds may fall back to `google_tts_fetch.py` + system Python when the embedded binary is missing.

**Rebuild after changing `google_tts_fetch.py`** (Cyrillic/UTF-8 fixes require a fresh binary).