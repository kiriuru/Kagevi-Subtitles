#!/usr/bin/env node
/**
 * Bump PROJECT_VERSION in voicesub-types and run version:sync.
 *
 * Usage:
 *   npm run version:bump -- 0.6.4
 *   npm run version:bump -- --patch
 *   npm run version:bump -- --minor
 *   npm run version:bump -- --major
 *
 * After bump: .\build-release.ps1   then   npm run release:github
 * Or: npm run release
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PROJECT_ROOT, readVersionRsConstants } from "./updater-release-lib.mjs";

const VERSION_RS = path.join(
  PROJECT_ROOT,
  "crates",
  "voicesub-types",
  "src",
  "version.rs",
);

const VERSION_RE =
  /^(pub const PROJECT_VERSION:\s*&str\s*=\s*")([^"]+)(";\s*)$/m;

function parseSemver(value) {
  const m = String(value)
    .trim()
    .replace(/^v/i, "")
    .match(/^(\d+)\.(\d+)\.(\d+)(?:[.-].*)?$/);
  if (!m) {
    throw new Error(`Invalid semver: ${value}`);
  }
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
  };
}

function formatSemver({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function nextVersion(current, mode) {
  const v = parseSemver(current);
  if (mode === "major") return formatSemver({ major: v.major + 1, minor: 0, patch: 0 });
  if (mode === "minor") return formatSemver({ major: v.major, minor: v.minor + 1, patch: 0 });
  if (mode === "patch") return formatSemver({ major: v.major, minor: v.minor, patch: v.patch + 1 });
  throw new Error(`Unknown bump mode: ${mode}`);
}

function runNpm(args) {
  // Windows: npm.cmd requires shell:true; otherwise spawn status is null.
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCmd, args, {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const args = process.argv.slice(2).filter((a) => a !== "--");
let target = null;
if (args.includes("--major")) target = nextVersion(readVersionRsConstants().version, "major");
else if (args.includes("--minor")) target = nextVersion(readVersionRsConstants().version, "minor");
else if (args.includes("--patch")) target = nextVersion(readVersionRsConstants().version, "patch");
else if (args[0] && !args[0].startsWith("-")) {
  target = String(args[0]).trim().replace(/^v/i, "");
  parseSemver(target);
} else {
  console.error(`Usage:
  npm run version:bump -- 0.6.4
  npm run version:bump -- --patch | --minor | --major`);
  process.exit(1);
}

const { version: current } = readVersionRsConstants();
if (current === target) {
  console.log(`Already at ${target}`);
  process.exit(0);
}

const source = fs.readFileSync(VERSION_RS, "utf8");
if (!VERSION_RE.test(source)) {
  console.error(`Could not find PROJECT_VERSION in ${VERSION_RS}`);
  process.exit(1);
}
fs.writeFileSync(VERSION_RS, source.replace(VERSION_RE, `$1${target}$3`), "utf8");
console.log(`PROJECT_VERSION: ${current} → ${target}`);

runNpm(["run", "version:sync"]);

console.log("");
console.log("Next:");
console.log("  .\\build-release.ps1");
console.log("  npm run release:github");
console.log("Or: npm run release");
