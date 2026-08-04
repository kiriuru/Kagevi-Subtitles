#!/usr/bin/env node
/**
 * Local parity for GitHub Actions CI (`.github/workflows/ci.yml`):
 *   - Frontend:  check:all → test:frontend → build
 *   - Rust (Windows): build → cargo fmt --check → clippy -D warnings → test --workspace
 *
 * `npm run build` runs once (shared by both jobs).
 *
 * Usage:
 *   npm run ci:local
 *   npm run ci:local -- --frontend
 *   npm run ci:local -- --rust
 *   npm run ci:local -- --install
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = new Set(process.argv.slice(2));
const wantInstall = args.has("--install");
const frontendOnly = args.has("--frontend");
const rustOnly = args.has("--rust");
if (args.has("--help") || args.has("-h")) {
  console.log(`Usage: node scripts/ci-local.mjs [options]

Options:
  --frontend   Only Frontend job steps (check:all, test:frontend, build)
  --rust       Only Rust (Windows) job steps (build, fmt, clippy, test)
  --install    Run npm ci before checks
  -h, --help   Show this help

Default: run both jobs (build once).`);
  process.exit(0);
}
if (frontendOnly && rustOnly) {
  console.error("ci:local: use at most one of --frontend / --rust");
  process.exit(1);
}

const runFrontend = !rustOnly;
const runRust = !frontendOnly;

/** @type {{ name: string; cmd: string; args: string[] }[]} */
const steps = [];

if (wantInstall) {
  steps.push({ name: "npm ci", cmd: "npm", args: ["ci"] });
}

if (runFrontend) {
  steps.push({
    name: "Frontend / svelte-check",
    cmd: "npm",
    args: ["run", "check:all"],
  });
  steps.push({
    name: "Frontend / vitest",
    cmd: "npm",
    args: ["run", "test:frontend"],
  });
}

// Shared production build (Frontend last step + Rust tauri resources).
if (runFrontend || runRust) {
  steps.push({
    name: runFrontend && runRust
      ? "Shared / npm run build (Frontend + Rust resources)"
      : runFrontend
        ? "Frontend / vite production build"
        : "Rust / frontend build outputs for tauri resources",
    cmd: "npm",
    args: ["run", "build"],
  });
}

if (runRust) {
  steps.push({
    name: "Rust / cargo fmt --check",
    cmd: "cargo",
    args: ["fmt", "--all", "--", "--check"],
  });
  steps.push({
    name: "Rust / cargo clippy",
    cmd: "cargo",
    args: ["clippy", "--workspace", "--all-targets", "--", "-D", "warnings"],
  });
  steps.push({
    name: "Rust / cargo test --workspace",
    cmd: "cargo",
    args: ["test", "--workspace"],
  });
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = (s % 60).toFixed(0);
  return `${m}m ${rem}s`;
}

function runStep(step) {
  console.log(`\n==> ${step.name}`);
  console.log(`    ${step.cmd} ${step.args.join(" ")}`);
  const started = Date.now();
  const result = spawnSync(step.cmd, step.args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  const elapsed = Date.now() - started;
  if (result.error) {
    console.error(`\nci:local: FAILED ${step.name}`);
    console.error(String(result.error.message || result.error));
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(
      `\nci:local: FAILED ${step.name} (exit ${result.status}, ${formatDuration(elapsed)})`,
    );
    process.exit(result.status ?? 1);
  }
  console.log(`    ok (${formatDuration(elapsed)})`);
}

console.log("ci:local: mirroring GitHub Actions CI");
console.log(
  `  jobs: ${[runFrontend && "Frontend", runRust && "Rust (Windows)"].filter(Boolean).join(" + ")}`,
);
console.log(`  steps: ${steps.length}`);

const totalStarted = Date.now();
for (const step of steps) {
  runStep(step);
}

console.log(
  `\nci:local: all ${steps.length} steps passed (${formatDuration(Date.now() - totalStarted)})`,
);
