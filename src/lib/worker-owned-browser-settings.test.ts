import { describe, expect, it } from "vitest";
import { omitWorkerOwnedBrowserSettings } from "./worker-owned-browser-settings";
import type { ConfigPayload } from "./types";

describe("omitWorkerOwnedBrowserSettings", () => {
  it("removes worker-only browser keys and keeps dashboard-owned keys", () => {
    const input = {
      asr: {
        mode: "browser_google",
        browser: {
          continuous_results: false,
          interim_results: true,
          force_finalization_enabled: true,
          force_finalization_timeout_ms: 5000,
          recognition_language: "ru-RU",
          stuck_stopping_timeout_ms: 500,
          max_browser_session_age_ms: 180000,
        },
      },
    } as ConfigPayload;

    const out = omitWorkerOwnedBrowserSettings(input);
    expect(out.asr?.browser?.continuous_results).toBeUndefined();
    expect(out.asr?.browser?.interim_results).toBeUndefined();
    expect(out.asr?.browser?.force_finalization_enabled).toBeUndefined();
    expect(out.asr?.browser?.force_finalization_timeout_ms).toBeUndefined();
    expect(out.asr?.browser?.recognition_language).toBe("ru-RU");
    expect(out.asr?.browser?.stuck_stopping_timeout_ms).toBe(500);
    expect(out.asr?.browser?.max_browser_session_age_ms).toBe(180000);
    // original untouched
    expect(input.asr?.browser?.continuous_results).toBe(false);
  });
});
