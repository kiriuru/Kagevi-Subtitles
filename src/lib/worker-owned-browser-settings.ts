import type { ConfigPayload } from "./types";

/**
 * `asr.browser` keys owned **only** by the Chrome worker UI (`/google-asr`).
 * Dashboard save/start must omit them so deep-merge keeps worker values instead of
 * clobbering with a stale in-memory snapshot after Stop/Start.
 *
 * Do **not** put `recognition_language` here — Live/Overview in the main UI owns it.
 */
export const WORKER_OWNED_BROWSER_SETTING_KEYS = [
  "continuous_results",
  "interim_results",
  "force_finalization_enabled",
  "force_finalization_timeout_ms",
] as const;

export type WorkerOwnedBrowserSettingKey = (typeof WORKER_OWNED_BROWSER_SETTING_KEYS)[number];

/** Clone config and drop worker-owned browser keys (for dashboard → `/api/settings/save` / start). */
export function omitWorkerOwnedBrowserSettings(config: ConfigPayload): ConfigPayload {
  const next = structuredClone(config) as ConfigPayload;
  const browser = next.asr?.browser;
  if (!browser || typeof browser !== "object") {
    return next;
  }
  for (const key of WORKER_OWNED_BROWSER_SETTING_KEYS) {
    delete browser[key];
  }
  return next;
}
