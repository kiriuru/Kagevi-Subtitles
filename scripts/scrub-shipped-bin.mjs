#!/usr/bin/env node
/**
 * Remove non-shipped build intermediates under bin/ before NSIS packaging.
 * Keeps platform google_tts_fetch(.exe) binaries; drops Nuitka/PyInstaller work trees.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, "..");
export const TTS_RUNTIME_ROOT = path.join(
  PROJECT_ROOT,
  "bin",
  "modules",
  "tts",
  "runtime",
);

export function isBuildIntermediateDirName(name) {
  const lower = String(name).toLowerCase();
  return (
    lower.endsWith(".build") ||
    lower.endsWith(".dist") ||
    lower.endsWith(".onefile-build") ||
    lower === "build"
  );
}

/**
 * @param {string} runtimeRoot
 * @returns {string[]} removed absolute paths
 */
export function scrubTtsRuntimeIntermediates(runtimeRoot = TTS_RUNTIME_ROOT) {
  const removed = [];
  if (!fs.existsSync(runtimeRoot)) {
    return removed;
  }

  /** @type {string[]} */
  const stack = [runtimeRoot];
  /** @type {string[]} */
  const dirs = [];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (!entry.isDirectory()) continue;
      if (isBuildIntermediateDirName(entry.name)) {
        dirs.push(full);
        continue;
      }
      stack.push(full);
    }
  }

  // Deepest first so nested trees delete cleanly.
  dirs.sort((a, b) => b.length - a.length);
  for (const dir of dirs) {
    fs.rmSync(dir, { recursive: true, force: true });
    removed.push(dir);
  }
  return removed;
}

function main() {
  const removed = scrubTtsRuntimeIntermediates();
  if (removed.length === 0) {
    console.log("scrub-shipped-bin: no TTS runtime intermediates to remove");
    return;
  }
  for (const dir of removed) {
    console.log(`scrub-shipped-bin: removed ${path.relative(PROJECT_ROOT, dir)}`);
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main();
}
