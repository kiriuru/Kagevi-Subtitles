#!/usr/bin/env node
/**
 * Publish staged NSIS + updater artifacts to GitHub Releases.
 *
 * Expects build-release.ps1 output under release_root/v{version}/:
 *   *-setup.exe, *-setup.exe.sig, latest.json  (GitHub-safe names; spaces → '.')
 *
 * Usage:
 *   npm run release:github
 *   node scripts/publish-github-release.mjs --dir "F:/.../v0.6.4"
 *   node scripts/publish-github-release.mjs --draft
 *   node scripts/publish-github-release.mjs --notes-file path.md
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  listStagedReleaseAssets,
  readSyncedVersionAndRepo,
  releaseDirForVersion,
} from "./updater-release-lib.mjs";

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function requireGh() {
  const probe = spawnSync("gh", ["--version"], { encoding: "utf8" });
  if (probe.status !== 0) {
    throw new Error("GitHub CLI `gh` is required (gh auth login).");
  }
}

function runGh(args) {
  const result = spawnSync("gh", args, { encoding: "utf8", stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`gh ${args.join(" ")} failed (exit ${result.status})`);
  }
}

const { version, githubRepo } = readSyncedVersionAndRepo();
const tag = `v${version}`;
const destDir = path.resolve(argValue("--dir") || releaseDirForVersion(version));
const draft = process.argv.includes("--draft");
const latest = !process.argv.includes("--no-latest");
const notesFile = argValue("--notes-file");
const title =
  argValue("--title") || `Kagevi Subtitles ${version}`;

if (!fs.existsSync(destDir)) {
  console.error(`Release folder missing: ${destDir}`);
  console.error("Run .\\build-release.ps1 first.");
  process.exit(1);
}

const { assets, setupPath, manifestPath, manifest } = listStagedReleaseAssets(destDir);
if (manifest.version !== version) {
  console.error(
    `latest.json version ${manifest.version} != PROJECT_VERSION ${version}. Re-run build-release.ps1 after version:sync.`,
  );
  process.exit(1);
}

requireGh();

const notes =
  (notesFile && fs.readFileSync(notesFile, "utf8")) ||
  [
    `## Kagevi Subtitles ${version}`,
    "",
    "### Installer / updater assets",
    `- \`${path.basename(setupPath)}\` — NSIS setup`,
    `- \`${path.basename(setupPath)}.sig\` — Tauri updater signature`,
    "- `latest.json` — auto-update manifest",
    "",
    "In-app update endpoint: `/releases/latest/download/latest.json`",
  ].join("\n");

const notesPath = path.join(destDir, ".gh-release-notes.md");
fs.writeFileSync(notesPath, notes, "utf8");

const list = spawnSync(
  "gh",
  ["release", "view", tag, "--repo", githubRepo],
  { encoding: "utf8" },
);
const exists = list.status === 0;

if (exists) {
  console.log(`Updating existing release ${tag} on ${githubRepo}...`);
  for (const asset of assets) {
    const name = path.basename(asset);
    spawnSync(
      "gh",
      ["release", "delete-asset", tag, name, "--repo", githubRepo, "--yes"],
      { encoding: "utf8" },
    );
  }
  runGh([
    "release",
    "upload",
    tag,
    ...assets,
    "--repo",
    githubRepo,
    "--clobber",
  ]);
} else {
  console.log(`Creating release ${tag} on ${githubRepo}...`);
  const createArgs = [
    "release",
    "create",
    tag,
    ...assets,
    "--repo",
    githubRepo,
    "--title",
    title,
    "--notes-file",
    notesPath,
  ];
  if (draft) createArgs.push("--draft");
  if (latest && !draft) createArgs.push("--latest");
  runGh(createArgs);
}

try {
  fs.unlinkSync(notesPath);
} catch {
  // ignore
}

console.log("");
console.log(`OK: https://github.com/${githubRepo}/releases/tag/${tag}`);
console.log(
  `Updater: https://github.com/${githubRepo}/releases/latest/download/latest.json`,
);
