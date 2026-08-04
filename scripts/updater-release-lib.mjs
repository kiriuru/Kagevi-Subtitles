/**
 * Shared helpers for Tauri updater release artifacts (latest.json + GitHub uploads).
 * Keep GitHub asset naming / URLs in one place so version bumps need no per-release edits.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, "..");

const VERSION_RS = path.join(
  PROJECT_ROOT,
  "crates",
  "voicesub-types",
  "src",
  "version.rs",
);
const TAURI_CONF = path.join(PROJECT_ROOT, "src-tauri", "tauri.conf.json");
const BRAND_TS = path.join(PROJECT_ROOT, "src", "lib", "brand.ts");
const RELEASE_CONFIG = path.join(PROJECT_ROOT, "build", "release.config.json");

const VERSION_RE =
  /^pub const PROJECT_VERSION:\s*&str\s*=\s*"([^"]+)";\s*$/m;
const GITHUB_REPO_RE =
  /^pub const DEFAULT_GITHUB_REPO:\s*&str\s*=\s*"([^"]+)";\s*$/m;

/** GitHub Release asset names replace spaces with '.'. */
export function githubSafeAssetName(fileName) {
  return String(fileName).replace(/ /g, ".");
}

export function githubLatestJsonEndpoint(repo) {
  return `https://github.com/${repo.trim()}/releases/latest/download/latest.json`;
}

export function githubDownloadUrl(repo, tagVersion, assetName) {
  const version = String(tagVersion).replace(/^v/i, "");
  // GitHub-safe names have no spaces; do not encode (keeps URLs identical to browser_download_url).
  const githubName = githubSafeAssetName(assetName);
  return `https://github.com/${repo.trim()}/releases/download/v${version}/${githubName}`;
}

export function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

export function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

export function readVersionRsConstants() {
  const source = readText(VERSION_RS);
  const versionMatch = source.match(VERSION_RE);
  if (!versionMatch) {
    throw new Error(`Could not parse PROJECT_VERSION from ${VERSION_RS}`);
  }
  const repoMatch = source.match(GITHUB_REPO_RE);
  if (!repoMatch) {
    throw new Error(`Could not parse DEFAULT_GITHUB_REPO from ${VERSION_RS}`);
  }
  return {
    version: versionMatch[1].trim(),
    githubRepo: repoMatch[1].trim(),
  };
}

export function readSyncedVersionAndRepo() {
  const fromRs = readVersionRsConstants();
  let version = fromRs.version;
  let githubRepo = fromRs.githubRepo;
  if (fs.existsSync(TAURI_CONF)) {
    const tauri = readJson(TAURI_CONF);
    if (tauri.version) version = String(tauri.version).trim();
  }
  if (fs.existsSync(BRAND_TS)) {
    const brand = readText(BRAND_TS);
    const match = brand.match(/GITHUB_REPO\s*=\s*["']([^"']+)["']/);
    if (match?.[1]) githubRepo = match[1].trim();
  }
  return { version, githubRepo };
}

export function readReleaseRoot() {
  if (!fs.existsSync(RELEASE_CONFIG)) {
    throw new Error(`Missing release config: ${RELEASE_CONFIG}`);
  }
  const cfg = readJson(RELEASE_CONFIG);
  const releaseRoot = String(cfg.release_root || "").trim();
  if (!releaseRoot) {
    throw new Error(`release_root is empty in ${RELEASE_CONFIG}`);
  }
  return releaseRoot;
}

export function releaseDirForVersion(version, releaseRoot = readReleaseRoot()) {
  return path.join(releaseRoot, `v${String(version).replace(/^v/i, "")}`);
}

export function findNewestSetupExe(searchRoots = null) {
  const roots = (
    searchRoots || [
      process.env.CARGO_TARGET_DIR,
      path.join(PROJECT_ROOT, "target"),
      path.join(PROJECT_ROOT, "src-tauri", "target"),
    ]
  ).filter(Boolean);

  let best = null;
  for (const searchRoot of roots) {
    if (!fs.existsSync(searchRoot)) continue;
    const stack = [searchRoot];
    while (stack.length) {
      const dir = stack.pop();
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === ".git") continue;
          stack.push(full);
          continue;
        }
        if (!entry.name.endsWith("-setup.exe")) continue;
        if (!full.replace(/\\/g, "/").includes("/bundle/nsis/")) continue;
        const stat = fs.statSync(full);
        if (!best || stat.mtimeMs > best.mtimeMs) {
          best = { path: full, mtimeMs: stat.mtimeMs };
        }
      }
    }
  }
  return best?.path ?? null;
}

export function buildUpdaterManifest({
  version,
  githubRepo,
  setupPath,
  notes = null,
  pubDate = null,
}) {
  const sigPath = `${setupPath}.sig`;
  if (!fs.existsSync(setupPath)) {
    throw new Error(`setup.exe not found: ${setupPath}`);
  }
  if (!fs.existsSync(sigPath)) {
    throw new Error(
      `Missing signature file: ${sigPath}\nSet TAURI_SIGNING_PRIVATE_KEY and rebuild with createUpdaterArtifacts.`,
    );
  }
  const assetName = path.basename(setupPath);
  const signature = readText(sigPath).trim();
  return {
    version: String(version).replace(/^v/i, ""),
    notes:
      notes ||
      `Kagevi Subtitles ${version}. See the GitHub release notes for details.`,
    pub_date: pubDate || new Date().toISOString(),
    platforms: {
      "windows-x86_64": {
        signature,
        url: githubDownloadUrl(githubRepo, version, assetName),
      },
    },
  };
}

/**
 * Stage setup.exe + .sig + latest.json into release_root/v{version}
 * using GitHub-safe filenames (spaces → '.').
 */
export function stageUpdaterReleaseArtifacts({
  setupPath,
  version,
  githubRepo,
  releaseRoot = readReleaseRoot(),
  notes = null,
}) {
  const ver = String(version).replace(/^v/i, "");
  const destDir = releaseDirForVersion(ver, releaseRoot);
  fs.mkdirSync(destDir, { recursive: true });
  for (const name of fs.readdirSync(destDir)) {
    fs.rmSync(path.join(destDir, name), { recursive: true, force: true });
  }

  const safeName = githubSafeAssetName(path.basename(setupPath));
  const destSetup = path.join(destDir, safeName);
  const destSig = `${destSetup}.sig`;
  const srcSig = `${setupPath}.sig`;

  fs.copyFileSync(setupPath, destSetup);
  if (!fs.existsSync(srcSig)) {
    throw new Error(`Missing signature next to setup: ${srcSig}`);
  }
  fs.copyFileSync(srcSig, destSig);

  const manifest = buildUpdaterManifest({
    version: ver,
    githubRepo,
    setupPath: destSetup,
    notes,
  });
  const manifestPath = path.join(destDir, "latest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    destDir,
    setupPath: destSetup,
    sigPath: destSig,
    manifestPath,
    version: ver,
    githubRepo,
    assets: [destSetup, destSig, manifestPath],
  };
}

export function listStagedReleaseAssets(destDir) {
  const setup = fs
    .readdirSync(destDir)
    .find((name) => name.endsWith("-setup.exe") && !name.endsWith(".sig"));
  if (!setup) {
    throw new Error(`No *-setup.exe in ${destDir}`);
  }
  if (setup.includes(" ")) {
    throw new Error(
      `Staged setup still has spaces (GitHub will rename it): ${setup}\nRe-run build-release.ps1 so assets use '.' instead of ' '.`,
    );
  }
  const setupPath = path.join(destDir, setup);
  const sigPath = `${setupPath}.sig`;
  const manifestPath = path.join(destDir, "latest.json");
  if (!fs.existsSync(sigPath)) {
    throw new Error(`Missing ${sigPath}`);
  }
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing ${manifestPath}`);
  }
  const manifest = JSON.parse(readText(manifestPath));
  const url = manifest?.platforms?.["windows-x86_64"]?.url || "";
  if (!url.endsWith(`/${setup}`) && !url.endsWith(`/${encodeURIComponent(setup)}`)) {
    throw new Error(
      `latest.json url does not match staged setup name.\n  staged: ${setup}\n  url:    ${url}`,
    );
  }
  return {
    setupPath,
    sigPath,
    manifestPath,
    assets: [setupPath, sigPath, manifestPath],
    manifest,
  };
}
