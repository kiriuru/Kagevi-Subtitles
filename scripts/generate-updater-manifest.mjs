#!/usr/bin/env node
/**
 * Generate latest.json for Tauri updater.
 *
 * Usage:
 *   npm run updater:manifest
 *   node scripts/generate-updater-manifest.mjs --setup path/to/setup.exe --out path/to/latest.json
 */

import fs from "node:fs";
import path from "node:path";
import {
  buildUpdaterManifest,
  findNewestSetupExe,
  readSyncedVersionAndRepo,
} from "./updater-release-lib.mjs";

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

const setupPath = path.resolve(argValue("--setup") || findNewestSetupExe() || "");
if (!setupPath || !fs.existsSync(setupPath)) {
  console.error(
    "NSIS setup.exe not found. Pass --setup <path> or build with cargo tauri build first.",
  );
  process.exit(1);
}

const { version, githubRepo } = readSyncedVersionAndRepo();
const notes = argValue("--notes");
const manifest = buildUpdaterManifest({
  version,
  githubRepo,
  setupPath,
  notes,
});

const defaultOut = path.join(path.dirname(setupPath), "latest.json");
const outPath = path.resolve(argValue("--out") || defaultOut);
fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Wrote ${outPath}`);
console.log(`  version: ${manifest.version}`);
console.log(`  asset:   ${path.basename(setupPath)}`);
console.log(`  url:     ${manifest.platforms["windows-x86_64"].url}`);
console.log("");
console.log(
  "Prefer: npm run release:github  (uploads GitHub-safe names from release_root).",
);
