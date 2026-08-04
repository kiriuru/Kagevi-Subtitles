import { checkUpdates, fetchVersion } from "./api";
import type { VersionInfo } from "./types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Prefer the runtime startup GitHub poll (force once) over a second dashboard force.
 * Polls GET /api/version until last_checked_utc appears, then falls back to POST check.
 */
export async function refreshVersionAfterStartupCheck(options?: {
  timeoutMs?: number;
  pollMs?: number;
  forceIfStale?: boolean;
}): Promise<VersionInfo> {
  const timeoutMs = options?.timeoutMs ?? 8_000;
  const pollMs = options?.pollMs ?? 400;
  const forceIfStale = options?.forceIfStale ?? true;

  let info = await fetchVersion();
  if (info.sync?.last_checked_utc?.trim()) {
    return info;
  }

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await sleep(pollMs);
    info = await fetchVersion();
    if (info.sync?.last_checked_utc?.trim()) {
      return info;
    }
  }

  if (!forceIfStale) {
    return info;
  }
  return checkUpdates();
}
