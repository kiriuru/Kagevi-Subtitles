# Security Policy

## Supported Versions

Security fixes are applied to the **latest released version** of Kagevi Subtitles
on the `main` branch and in GitHub Releases. Older installers are not patched
in place - please upgrade to the newest release when a fix ships.

| Version | Supported |
| ------- | ------------------ |
| Latest release (`0.6.x` and newer on `main`) | :white_check_mark: |
| Older releases | :x: |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Use one of these private channels instead:

1. **GitHub private vulnerability reporting** (preferred):  
   https://github.com/kiriuru/Kagevi-Subtitles/security/advisories/new
2. Contact the maintainer on GitHub: https://github.com/kiriuru

Please include:

- Affected version / commit
- Impact (local loopback API, installer, update channel, dependency, etc.)
- Steps to reproduce
- A proof of concept only if it is safe to share privately

You should receive an acknowledgment within a few days. We will discuss
severity, fix timeline, and disclosure with you before publishing details.

## Scope

Kagevi Subtitles is a local-first Windows desktop app. Default bind is
`127.0.0.1`. High-priority reports include:

- Auth / token handling for the loopback HTTP API
- Path traversal or unsafe file handling under `user-data/` / export paths
- Privilege issues in the installer or update pipeline
- Supply-chain issues in release artifacts

Out of scope for private advisories (use normal issues instead):

- Feature requests and UX bugs
- Crashes without a security impact
- Issues that require changing the user's machine policy outside the app

## Safe Harbor

Good-faith research and private reporting that follows this policy is
appreciated. Do not exploit a vulnerability beyond what is needed to
demonstrate it, and do not access other users' data.
