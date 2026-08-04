import assert from "node:assert/strict";
import test from "node:test";
import {
  githubDownloadUrl,
  githubLatestJsonEndpoint,
  githubSafeAssetName,
} from "./updater-release-lib.mjs";

test("githubSafeAssetName replaces spaces for GitHub Releases", () => {
  assert.equal(
    githubSafeAssetName("Kagevi Subtitles_0.6.3_x64-setup.exe"),
    "Kagevi.Subtitles_0.6.3_x64-setup.exe",
  );
  assert.equal(
    githubSafeAssetName("Already.Safe_1.0.0_x64-setup.exe"),
    "Already.Safe_1.0.0_x64-setup.exe",
  );
});

test("githubDownloadUrl uses safe names matching GitHub asset URLs", () => {
  assert.equal(
    githubDownloadUrl(
      "kiriuru/Kagevi-Subtitles",
      "0.6.3",
      "Kagevi Subtitles_0.6.3_x64-setup.exe",
    ),
    "https://github.com/kiriuru/Kagevi-Subtitles/releases/download/v0.6.3/Kagevi.Subtitles_0.6.3_x64-setup.exe",
  );
});

test("githubLatestJsonEndpoint follows DEFAULT_GITHUB_REPO", () => {
  assert.equal(
    githubLatestJsonEndpoint("kiriuru/Kagevi-Subtitles"),
    "https://github.com/kiriuru/Kagevi-Subtitles/releases/latest/download/latest.json",
  );
});
