/**
 * Build the GitHub Pages presentation site.
 *
 * Content-collections-at-build-time pattern (Astro-style):
 * Markdown from docs/ is prerendered into wiki.html / changelog.html so the
 * browser never fetch()es .md and never depends on a CDN markdown parser.
 *
 * Usage: npm run pages:build
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const siteDir = path.join(root, "site");
const imagesSrc = path.join(root, "Images");
const docsDir = path.join(root, "docs");

marked.setOptions({ gfm: true, breaks: false });

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyGlob(srcDir, destDir, exts) {
  ensureDir(destDir);
  for (const name of fs.readdirSync(srcDir)) {
    const ext = path.extname(name).toLowerCase();
    if (!exts.includes(ext)) continue;
    fs.copyFileSync(path.join(srcDir, name), path.join(destDir, name));
  }
}

function rewriteMarkdown(md) {
  let out = md;
  out = out.replace(/\((?:\.\.\/)+Images\//g, "(images/");
  out = out.replace(/\(\.\/Images\//g, "(images/");
  out = out.replace(/src="(?:\.\.\/)+Images\//g, 'src="images/');
  out = out.replace(/\(\.\/WIKI(?:\.en)?\.md\)/gi, "(wiki.html)");
  out = out.replace(/\(\.\/WIKI\.ru\.md\)/gi, "(wiki.html)");
  out = out.replace(/\(\.\/CHANGELOG(?:\.en)?\.md\)/gi, "(changelog.html)");
  out = out.replace(/\(\.\/CHANGELOG\.md\)/gi, "(changelog.html)");
  out = out.replace(/\(\.\.\/README(?:\.ru)?\.md\)/gi, "(index.html)");
  out = out.replace(/\(\.\.\/README\.md\)/gi, "(index.html)");
  out = out.replace(
    /^>\s*\[!(TIP|NOTE|IMPORTANT|WARNING|CAUTION)\]\s*$/gim,
    (_, kind) => `> **${kind}**`
  );
  return out;
}

const GITHUB_DOCS = "https://github.com/kiriuru/Kagevi-Subtitles/blob/main/docs";

/** Site-only transforms: working HTML links, no duplicate TOC chrome, no changelog fluff. */
function prepareForSite(md, kind) {
  // Normalize before regex (Windows CRLF + BOM break ^/$ and \n patterns)
  let out = md.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  out = rewriteMarkdown(out);

  // HTML <a href> (wiki/changelog cross-links) — not markdown () syntax
  out = out.replace(/href="\.\.\/README(?:\.ru)?\.md"/g, 'href="index.html"');
  out = out.replace(/href="\.\/WIKI(?:\.en|\.ru)?\.md"/g, 'href="wiki.html"');
  out = out.replace(/href="\.\/CHANGELOG(?:\.en)?\.md"/g, 'href="changelog.html"');
  out = out.replace(/href="\.\/CHANGELOG\.md"/g, 'href="changelog.html"');
  out = out.replace(
    /href="\.\/TECHNICAL_ARCHITECTURE\.en\.md"/g,
    `href="${GITHUB_DOCS}/TECHNICAL_ARCHITECTURE.en.md" target="_blank" rel="noopener noreferrer"`
  );
  out = out.replace(
    /href="\.\/TECHNICAL_ARCHITECTURE\.md"/g,
    `href="${GITHUB_DOCS}/TECHNICAL_ARCHITECTURE.md" target="_blank" rel="noopener noreferrer"`
  );

  // Markdown architecture links → GitHub (rendered HTML, not raw)
  out = out.replace(
    /\(\.\/TECHNICAL_ARCHITECTURE\.en\.md(#[^)]*)?\)/g,
    (_, hash = "") => `(${GITHUB_DOCS}/TECHNICAL_ARCHITECTURE.en.md${hash})`
  );
  out = out.replace(
    /\(\.\/TECHNICAL_ARCHITECTURE\.md(#[^)]*)?\)/g,
    (_, hash = "") => `(${GITHUB_DOCS}/TECHNICAL_ARCHITECTURE.md${hash})`
  );

  if (kind === "wiki") {
    // Drop GitHub Outline tip (site has sticky TOC); run before/after admonition rewrite
    out = out.replace(/^>\s*\[!TIP\]\n(?:>.*\n)*/m, "\n");
    out = out.replace(/^>\s*\*\*TIP\*\*\n(?:>.*\n)*/m, "\n");

    // Sticky TOC already covers navigation — remove duplicate Quick links + Contents
    out = out.replace(/^## Quick links\n[\s\S]*?(?=^## )/m, "");
    out = out.replace(/^## Быстрые ссылки\n[\s\S]*?(?=^## )/m, "");
    out = out.replace(/^## Table of contents\n[\s\S]*?(?=^---\s*\n)/m, "");
    out = out.replace(/^## Содержание\n[\s\S]*?(?=^---\s*\n)/m, "");
    out = out.replace(/^---\s*\n+(?=## )/m, "");

    // Site has EN/RU toggle — drop in-doc locale sibling (keeps README · Arch · Changelog)
    out = out.replace(/\s*·\s*<a href="wiki\.html">(?:English|Русский)<\/a>/g, "");

    // Section footers (always followed by --- before the next ##) — match one <p> only
    out = out.replace(
      /<p align="right">\s*<a href="#(?:jump-bar|quick-links|быстрые-ссылки)"[\s\S]*?<\/p>\s*/gi,
      '<p align="right"><a href="#doc-main">↑ Top</a></p>\n\n'
    );
    // Bottom bar: drop ↑ Top / ↑ Наверх (sticky TOC); keep README · Arch links
    out = out.replace(
      /<p align="center">\s*<a href="#(?:jump-bar|quick-links|быстрые-ссылки)">↑(?:\s*Top|\s*Наверх)<\/a>\s*·\s*/gi,
      '<p align="center">\n  '
    );
  }

  if (kind === "changelog") {
    // Drop Keep a Changelog / SemVer blurb + EN↔RU switcher (site has lang toggle)
    out = out.replace(
      /^All notable changes to this project will be documented in this file\.\n+/m,
      ""
    );
    out = out.replace(
      /^Все заметные изменения этого проекта документируются в этом файле\.\n+/m,
      ""
    );
    out = out.replace(/^The format is based on[\s\S]*?<\/p>\n+/m, "");
    out = out.replace(/^Формат основан на[\s\S]*?<\/p>\n+/m, "");
  }

  return out;
}

function enhanceHtml(html) {
  let out = html.replace(/^\s*<h1[\s\S]*?<\/h1>\s*/i, "");
  out = out.replace(
    /<blockquote>\s*<p><strong>(TIP|NOTE|IMPORTANT|WARNING|CAUTION)<\/strong>/gi,
    (_, kind) => {
      const upper = kind.toUpperCase();
      const cls =
        upper === "TIP"
          ? "doc-callout--tip"
          : upper === "NOTE"
            ? "doc-callout--note"
            : "doc-callout--important";
      return `<blockquote class="${cls}"><p><strong>${kind}</strong>`;
    }
  );
  out = out.replace(/<img /g, '<img loading="lazy" ');
  // Hide empty callouts left after tip strip
  out = out.replace(/<blockquote class="doc-callout--tip">\s*<p><strong>TIP<\/strong><\/p>\s*<\/blockquote>\s*/gi, "");
  return out;
}

function renderDoc(relPath, kind) {
  const raw = fs.readFileSync(path.join(docsDir, relPath), "utf8");
  return enhanceHtml(marked.parse(prepareForSite(raw, kind)));
}

function inject(html, replacements) {
  let out = html;
  for (const [key, value] of Object.entries(replacements)) {
    const token = `<!-- BUILD:${key} -->`;
    if (!out.includes(token)) {
      throw new Error(`Missing build token ${token} in template`);
    }
    out = out.replace(token, `\n${value}\n`);
  }
  return out;
}

function syncAssets() {
  const imagesDest = path.join(siteDir, "images");
  fs.rmSync(imagesDest, { recursive: true, force: true });
  copyGlob(imagesSrc, imagesDest, [".jpg", ".jpeg", ".png", ".webp"]);
  ensureDir(path.join(siteDir, "assets"));
  fs.copyFileSync(
    path.join(imagesSrc, "Kagevi_icon.png"),
    path.join(siteDir, "assets", "kagevi-icon.png")
  );
  fs.writeFileSync(path.join(siteDir, ".nojekyll"), "");
}

function buildDocs() {
  const wikiSrc = fs.readFileSync(path.join(siteDir, "wiki.src.html"), "utf8");
  const changelogSrc = fs.readFileSync(path.join(siteDir, "changelog.src.html"), "utf8");

  fs.writeFileSync(
    path.join(siteDir, "wiki.html"),
    inject(wikiSrc, {
      WIKI_EN: renderDoc("WIKI.en.md", "wiki"),
      WIKI_RU: renderDoc("WIKI.ru.md", "wiki"),
    })
  );
  fs.writeFileSync(
    path.join(siteDir, "changelog.html"),
    inject(changelogSrc, {
      CHANGELOG_EN: renderDoc("CHANGELOG.en.md", "changelog"),
      CHANGELOG_RU: renderDoc("CHANGELOG.md", "changelog"),
    })
  );
}

function main() {
  ensureDir(siteDir);
  syncAssets();
  buildDocs();
  console.log("pages:build OK — assets synced, wiki/changelog prerendered");
}

main();
