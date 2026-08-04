import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  isBuildIntermediateDirName,
  scrubTtsRuntimeIntermediates,
} from "./scrub-shipped-bin.mjs";

test("isBuildIntermediateDirName matches Nuitka/PyInstaller leftovers", () => {
  assert.equal(isBuildIntermediateDirName("google_tts_fetch.build"), true);
  assert.equal(isBuildIntermediateDirName("google_tts_fetch.dist"), true);
  assert.equal(isBuildIntermediateDirName("google_tts_fetch.onefile-build"), true);
  assert.equal(isBuildIntermediateDirName("build"), true);
  assert.equal(isBuildIntermediateDirName("Build"), true);
  assert.equal(isBuildIntermediateDirName("win-x64"), false);
  assert.equal(isBuildIntermediateDirName("google_tts_fetch.exe"), false);
});

test("scrubTtsRuntimeIntermediates keeps shipped exe and removes .build", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "voicesub-scrub-"));
  try {
    const win = path.join(root, "win-x64");
    const buildDir = path.join(win, "google_tts_fetch.build");
    const blobs = path.join(buildDir, "blobs");
    fs.mkdirSync(blobs, { recursive: true });
    fs.writeFileSync(path.join(blobs, "__constant.bin"), "x");
    fs.writeFileSync(path.join(win, "google_tts_fetch.exe"), "exe");
    fs.mkdirSync(path.join(root, "build", "nuitka"), { recursive: true });
    fs.writeFileSync(path.join(root, "build", "nuitka", "tmp"), "t");

    const removed = scrubTtsRuntimeIntermediates(root);
    assert.ok(removed.some((p) => p.endsWith("google_tts_fetch.build")));
    assert.ok(removed.some((p) => p.endsWith(`${path.sep}build`) || p.endsWith("/build") || path.basename(p) === "build"));
    assert.equal(fs.existsSync(path.join(win, "google_tts_fetch.exe")), true);
    assert.equal(fs.existsSync(buildDir), false);
    assert.equal(fs.existsSync(path.join(root, "build")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
