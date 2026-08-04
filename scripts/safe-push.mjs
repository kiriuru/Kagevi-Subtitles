/**
 * Fail-closed push helper: never pull/rebase to "fix" a rejected push.
 *
 * Usage: npm run push:safe
 *
 * - Aborts if secrets/key paths are staged
 * - Aborts if local branch is behind origin (agent must ask the user — no auto-rebase)
 * - Otherwise: git push -u origin HEAD
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function git(args, opts = {}) {
  const out = execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: opts.stdio ?? ["ignore", "pipe", "pipe"],
  });
  if (out == null) return "";
  return String(out).trim();
}

function main() {
  try {
    git(["fetch", "origin"]);
  } catch (err) {
    console.error("push:safe: git fetch failed");
    console.error(String(err?.stderr || err?.message || err));
    process.exit(1);
  }

  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch === "HEAD") {
    console.error("push:safe: detached HEAD — refuse to push");
    process.exit(1);
  }

  const staged = git(["diff", "--cached", "--name-only"]);
  const banned = staged
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((f) =>
      /(^|\/)secrets\/tauri-updater\.key(\.pub)?$|\.env$|token_body\.txt$/i.test(
        f,
      ),
    );
  if (banned.length) {
    console.error("push:safe: refuse — secrets/token files are staged:");
    for (const f of banned) console.error(`  ${f}`);
    process.exit(1);
  }

  let behind = "0";
  let ahead = "0";
  try {
    const counts = git([
      "rev-list",
      "--left-right",
      "--count",
      `origin/${branch}...HEAD`,
    ]);
    // "behind ahead" when comparing origin...HEAD with --left-right
    const parts = counts.split(/\s+/);
    behind = parts[0] || "0";
    ahead = parts[1] || "0";
  } catch {
    // No upstream yet — plain push is fine.
    console.log(`push:safe: no upstream for ${branch}; pushing HEAD`);
    git(["push", "-u", "origin", "HEAD"], { stdio: "inherit" });
    return;
  }

  if (behind !== "0") {
    console.error(
      `push:safe: REFUSE — origin/${branch} is ahead by ${behind} commit(s).`,
    );
    console.error(
      "Do NOT git pull / pull --rebase automatically (that checkouts remote and looks like a local rollback).",
    );
    console.error("Ask the user which integration to use, then proceed only if they name it.");
    try {
      const remoteOnly = git([
        "log",
        "--oneline",
        `HEAD..origin/${branch}`,
      ]);
      if (remoteOnly) {
        console.error("Remote-only commits:");
        console.error(remoteOnly);
      }
    } catch {
      /* ignore */
    }
    process.exit(2);
  }

  console.log(
    `push:safe: pushing ${branch} (ahead=${ahead}, behind=0) — no pull/rebase`,
  );
  git(["push", "-u", "origin", "HEAD"], { stdio: "inherit" });
}

main();
