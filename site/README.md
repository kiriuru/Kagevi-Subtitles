# Kagevi Subtitles — presentation site

Static marketing + docs site for **GitHub Pages**.

## Architecture

- **Landing** (`index.html`) — hand-authored, islands for lang / guide tabs + carousels
- **Docs** (`wiki.html`, `changelog.html`) — Markdown from `docs/` **prerendered at build time**
  (content-collections pattern; no runtime `fetch` of `.md`, no CDN markdown parser)
- Sources: `wiki.src.html`, `changelog.src.html` + `scripts/build-site.mjs`

## Local preview

```powershell
npm run pages:preview
```

Or:

```powershell
npm run pages:build
npx --yes serve site -l 4173
```

- Home: `/`
- Wiki: `/wiki.html`
- Changelog: `/changelog.html`

## Deploy

Workflow runs `npm run pages:build` then uploads `site/`.

Site URL: `https://kiriuru.github.io/Kagevi-Subtitles/`
