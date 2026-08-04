# Updater signing keys (local)

Free Tauri minisign keys for in-app updates. **Not** a paid Authenticode certificate.

| File | Role |
| --- | --- |
| `tauri-updater.key` | Private key — **never commit** (gitignored) |
| `tauri-updater.key.pub` | Public key file (gitignored); content is embedded in `src-tauri/tauri.conf.json` → `plugins.updater.pubkey` |

## Generate (once)

```powershell
npx @tauri-apps/cli@2 signer generate -w secrets/tauri-updater.key --ci
```

Then copy the contents of `tauri-updater.key.pub` into `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`.

## Release (normal path)

After changing product version you should **not** hand-edit updater URLs or asset names:

```powershell
npm run version:bump -- --patch    # or: npm run version:bump -- 0.6.4
npm run release                    # build-release.ps1 + GitHub upload
```

Equivalents:

```powershell
.\build-release.ps1
npm run release:github

# or
.\build-release.ps1 -PublishGitHub
```

`build-release.ps1` sets signing env vars automatically:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = (Resolve-Path .\secrets\tauri-updater.key).Path
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
$env:CI = "true"
```

Staged artifacts use GitHub-safe names (spaces → `.`) so `latest.json` URLs match uploaded assets.

If you lose the private key, users on builds signed with the old pubkey cannot receive signed updates until you ship a new pubkey via a manual installer.
