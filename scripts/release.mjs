#!/usr/bin/env node
/**
 * Unified release entry: build NSIS (+ updater sig/manifest) then publish to GitHub.
 *
 * Prerequisites:
 *   - secrets/tauri-updater.key
 *   - build/release.config.json
 *   - gh auth login
 *
 * Typical version bump flow (minimal edits):
 *   1. npm run version:bump -- --patch    # or: -- 0.6.4
 *   2. npm run release                    # build-release.ps1 + release:github
 *
 * Flags:
 *   --publish-only   skip build; only upload staged release_root/v{version}
 *   --draft          create GitHub release as draft
 *   --help           print usage
 */

import path from "node:path";
import { spawnSync } from "node:child_process";
import { PROJECT_ROOT, readSyncedVersionAndRepo } from "./updater-release-lib.mjs";

const args = process.argv.slice(2);
const publishOnly = args.includes("--publish-only");
const draft = args.includes("--draft");
const help = args.includes("--help") || args.includes("-h");

if (help) {
  console.log(`Usage:
  npm run release
  npm run release -- --publish-only
  npm run release -- --draft
  npm run release -- --publish-only --draft`);
  process.exit(0);
}

const unknown = args.filter(
  (a) => !["--publish-only", "--draft"].includes(a),
);
if (unknown.length) {
  console.error(`Unknown flag(s): ${unknown.join(", ")}`);
  console.error("Use --help for usage.");
  process.exit(1);
}

function run(command, commandArgs, opts = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    shell: opts.shell ?? false,
    env: process.env,
  });
  if (result.error) {
    console.error(result.error.message || result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const { version } = readSyncedVersionAndRepo();
console.log(`Release pipeline for ${version}`);
console.log("");

if (!publishOnly) {
  const ps1 = path.join(PROJECT_ROOT, "build-release.ps1");
  run("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    ps1,
  ]);
}

const publishArgs = ["scripts/publish-github-release.mjs"];
if (draft) publishArgs.push("--draft");
run(process.execPath, publishArgs);
