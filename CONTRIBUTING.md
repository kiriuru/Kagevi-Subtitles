# Contributing to Kagevi Subtitles

Thank you for helping improve Kagevi Subtitles. Pull requests are welcome; for larger changes, open an issue first so we can agree on scope.

This guide focuses on the two most common community contributions: **translation providers** and **subtitle fonts**. For architecture, invariants, and the full workspace layout, see [AGENTS.md](./AGENTS.md) and [Technical Architecture (EN)](./docs/TECHNICAL_ARCHITECTURE.en.md).

By participating, you agree to follow the [Code of Conduct](./CODE_OF_CONDUCT.md). Security issues go to [SECURITY.md](./SECURITY.md), not public issues. Support links: [SUPPORT.md](./SUPPORT.md).

---

## Before you open a PR

1. Fork / branch from `main`.
2. Prefer the issue templates under **New issue** (Bug report / Feature request) and the PR template when opening a pull request.
3. Run the project checks locally:

   ```powershell
   cargo test --workspace
   npm run build
   npm run test:frontend
   ```

4. Keep PRs focused — one provider or one font family per PR is easiest to review.
5. Do **not** commit secrets, API keys, or personal `user-data/` / `logs/` artifacts.
6. UI strings: edit locale **sources**, not generated JSON alone (see [Internationalization](#internationalization)).

---

## Adding a translation provider

VoiceSub ships **18** built-in providers. Each provider is a Rust adapter behind the shared `TranslationProvider` trait, plus dashboard metadata and i18n.

Good reference implementations:

| Kind | Example file | Notes |
| --- | --- | --- |
| Keyless / web session | [`bing_translator.rs`](./crates/voicesub-translation/src/providers/bing_translator.rs) | Session bootstrap, retryable errors |
| Keyless / token scrape | [`microsoft_edge.rs`](./crates/voicesub-translation/src/providers/microsoft_edge.rs) | Cached token, experimental flag |
| API key + REST | [`caiyun.rs`](./crates/voicesub-translation/src/providers/caiyun.rs) | Settings map, diagnostics |
| LLM chat | [`openai_compatible.rs`](./crates/voicesub-translation/src/providers/openai_compatible.rs) | Reused for OpenAI / Ollama / LM Studio |

### 1. Choose a stable provider ID

Use a lowercase `snake_case` ID, e.g. `my_service_translate`. This ID is stored in user configs and must stay stable after release.

Add it to `SUPPORTED_PROVIDERS` in [`crates/voicesub-translation/src/providers/mod.rs`](./crates/voicesub-translation/src/providers/mod.rs).

### 2. Implement the Rust provider

Create `crates/voicesub-translation/src/providers/<your_provider>.rs`:

```rust
use async_trait::async_trait;
use super::{
    ProviderError, ProviderInfo, TranslateRequest, TranslationProvider,
    base_diagnostics, http::SharedHttpClient,
};

pub struct MyServiceProvider {
    transport: SharedHttpClient,
}

impl MyServiceProvider {
    pub fn new(transport: SharedHttpClient) -> Self {
        Self { transport }
    }
}

#[async_trait]
impl TranslationProvider for MyServiceProvider {
    fn info(&self) -> ProviderInfo {
        ProviderInfo {
            name: "my_service_translate",
            group: "stable",               // Rust group — see table below
            experimental: false,
            local_provider: false,
            supports_live_partial: true,   // false for LLM / local LLM
        }
    }

    async fn translate(&self, request: TranslateRequest<'_>) -> Result<String, ProviderError> {
        // Read credentials from request.settings
        // Map langs via lang_codes.rs if the API uses non-standard codes
        // Return ProviderError::retryable(...) for transient failures
        todo!()
    }

    fn diagnostics(&self, settings: &std::collections::HashMap<String, String>) -> serde_json::Value {
        base_diagnostics(&self.info(), settings)
    }
}
```

**Rust `ProviderInfo.group`** (diagnostics / readiness):

| Rust group | Typical `supports_live_partial` | Example providers |
| --- | --- | --- |
| `stable` | `true` | Google v2, DeepL, Azure, LibreTranslate |
| `experimental` | `true` | Google Web, Bing, Microsoft Edge, GAS URL |
| `china` | `true` | Baidu, Youdao, Tencent, Caiyun |
| `llm` | **`false`** | OpenAI, OpenRouter |
| `local_llm` | **`false`** | LM Studio, Ollama |

**Dashboard `PROVIDERS[].group`** in [`constants.ts`](./src/lib/constants.ts) is separate — it controls the picker section label (`Stable / Recommended`, `Classic MT`, `Experimental / Emergency`, …). DeepL uses Rust group `stable` but dashboard group `Classic MT`; both fields must be set intentionally.

Register the module in [`mod.rs`](./crates/voicesub-translation/src/providers/mod.rs): `mod`, `pub use`, `SUPPORTED_PROVIDERS`, and `build_default_registry`.

If the upstream API uses custom language codes, add mappers in [`lang_codes.rs`](./crates/voicesub-translation/src/providers/lang_codes.rs).

**Error handling:** use `ProviderError::Message` for user-facing config errors; `ProviderError::retryable(...)` for HTTP 429/5xx, timeouts, and connection failures so the dispatcher can retry.

**Logging:** `tracing` only — no `println!`.

### 3. Wire the dashboard (TypeScript)

Update these files so the Translation panel shows your provider:

| File | What to add |
| --- | --- |
| [`src/lib/constants.ts`](./src/lib/constants.ts) | Entry in `PROVIDERS` (`label`, `group`, `fields`, optional `setupUrl`) |
| [`src/lib/translation-provider-settings.ts`](./src/lib/translation-provider-settings.ts) | Default settings object + normalization branch if non-standard |
| [`src/lib/translation-helpers.ts`](./src/lib/translation-helpers.ts) | `REQUIRED_PROVIDER_FIELDS` entry when credentials are mandatory |

Keyless providers (`fields: []`) should normalize to `{}` like `bing_translator` / `microsoft_edge`.

### 4. Add i18n strings

Edit [`scripts/voicesub-locale-overrides.mjs`](./scripts/voicesub-locale-overrides.mjs):

- `provider.<id>.hint` — short help under provider settings
- `provider.<id>.status` — readiness / experimental warning (if applicable)

Add **en** in `voicesubNewKeysEn` and **ru**, **ja**, **ko**, **zh** in `voicesubExtrasLocalized`.

Then run:

```powershell
npm run i18n:export
```

Do not edit `src/lib/i18n/locales/{en,ru,ja,ko,zh}.json` by hand — they are generated.

### 5. Tests

| Area | Minimum |
| --- | --- |
| Rust | Unit tests in the provider module (parsing, lang mapping, error paths); registry tests in `mod.rs` already assert all `SUPPORTED_PROVIDERS` are registered |
| Frontend | If you hard-code provider counts, update [`src/lib/translation-helpers.test.ts`](./src/lib/translation-helpers.test.ts) |
| Integration | Optional HTTP smoke with mocked responses; follow patterns in `crates/voicesub-translation/tests/` |

Run `cargo test --workspace` and `npm run test:frontend`.

### 6. Docs and release notes

- Bump provider count in [`README.md`](./README.md) / [`README.ru.md`](./README.ru.md) if user-facing.
- Add a line to [`docs/CHANGELOG.md`](./docs/CHANGELOG.md) (and `CHANGELOG.en.md` if you touch EN release notes).
- If behavior or HTTP contracts change, update [`docs/TECHNICAL_ARCHITECTURE.en.md`](./docs/TECHNICAL_ARCHITECTURE.en.md) (and RU parity in `TECHNICAL_ARCHITECTURE.md` for the same section).

### Example PR title and description

**Title:** `feat(translation): add MyService Translate provider`

**Body:**

```markdown
## Summary
- Adds `my_service_translate` (Classic MT, API token).
- Maps UI langs via `lang_codes::my_service_lang`.
- Dashboard fields: token + setup link.

## Test plan
- [ ] `cargo test -p voicesub-translation`
- [ ] Manual: Translation → select provider → translate EN→RU in preview
- [ ] `npm run i18n:export` — no raw keys in EN/RU
```

---

## Adding a subtitle font

Project fonts live in [`bin/fonts/`](./bin/fonts/). They are scanned at runtime; no npm build step is required beyond shipping the file in the installer bundle.

### 1. License and file format

- Prefer **OFL**, **Apache 2.0**, or another license compatible with redistribution in an MIT-licensed app.
- Ship **TTF** or **OTF** (WOFF2 also supported).
- Filename pattern: `FamilyName-Regular.ttf`, `FamilyName-Bold.ttf` (PascalCase stem; hyphens/underscores become spaces in the UI label).
- If the license requires it, add `FamilyName-LICENSE.txt` next to the font (see [`PixelOperator-LICENSE.txt`](./bin/fonts/PixelOperator-LICENSE.txt)).
- Add a short entry to [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) when the license is not OFL/Apache and needs attribution.

### 2. Script coverage metadata

The font picker shows alphabet tags (`Latin`, `Кириллица`, `日本語`, …). Register scripts in [`crates/voicesub-config/src/fonts.rs`](./crates/voicesub-config/src/fonts.rs):

1. **`scripts_for_font_filename`** — which scripts the face covers (`latin`, `cyrillic`, `japanese`, `chinese`, `korean`).
2. **`unicode_range_for_font_filename`** — only for **Latin-only** faces so Cyrillic/JP/CN/KR text falls through to the next font in the preset stack instead of rendering with missing glyphs.

Default for unknown files: `["latin", "cyrillic"]` scripts, no unicode-range restriction.

Update the unit tests at the bottom of `fonts.rs` (`catalog_entries_expose_script_tags_for_picker_labels`, `latin_only_faces_get_unicode_range`, etc.).

### 3. Verify in the UI

```powershell
cargo test -p voicesub-config fonts::
npm run build   # or run the dev shell
```

In the dashboard: **Subtitles → Style → Font** — confirm the label, script tags, and that Russian/CJK sample text renders correctly in preview and OBS overlay (`/project-fonts.css` serves `@font-face` rules automatically).

### 4. Optional: preset stacks

Built-in style presets are in [`crates/voicesub-config/data/builtin_style_presets.json`](./crates/voicesub-config/data/builtin_style_presets.json). Only change presets if the new font should become a default for a shipped look; otherwise users can pick it manually.

### Example PR title and description

**Title:** `feat(fonts): add Bungee Inline for Latin display titles`

**Body:**

```markdown
## Summary
- Adds `BungeeInline-Regular.ttf` (OFL, Google Fonts).
- Registers as Latin-only with unicode-range so Cyrillic uses stack fallback.
- Updates THIRD_PARTY_NOTICES (OFL attribution).

## Test plan
- [ ] `cargo test -p voicesub-config fonts::`
- [ ] Font appears in picker with `Latin` tag
- [ ] RU preview uses fallback from preset stack, EN uses Bungee Inline
```

---

## Internationalization

| Surface | Edit | Regenerate |
| --- | --- | --- |
| Dashboard, Local ASR, worker | `scripts/voicesub-locale-overrides.mjs` | `npm run i18n:export` |
| OBS overlay | `scripts/i18n-source/locales/*.js` | `npm run i18n:bundle` |
| TTS module | `src/lib/i18n/locales/tts-*.json` | — |

Skill reference: [`.cursor/skills/voicesub-i18n/SKILL.md`](./.cursor/skills/voicesub-i18n/SKILL.md).

Supported UI locales: `en`, `ru`, `ja`, `ko`, `zh`.

---

## Code conventions (short)

- Domain logic in `crates/voicesub-*`; **`src-tauri/` is IPC only** — no translation/subtitle logic there.
- Preserve behavioral contracts (subtitle lifecycle, translation queue, overlay payload shape) unless the task explicitly updates contracts **and** golden tests + architecture docs.
- `tracing` in Rust; no `println!` on production paths.
- Match existing naming and file layout — see [AGENTS.md](./AGENTS.md).

---

## Questions

Open a [GitHub issue](https://github.com/kiriuru/Kagevi-Subtitles/issues) for design questions, or mention `@kiriuru` on a draft PR if you are unsure about provider grouping or licensing.
