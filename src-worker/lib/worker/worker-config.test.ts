import { describe, expect, it } from "vitest";
import { resolveWorkerSettings } from "./worker-config";

describe("resolveWorkerSettings", () => {
  it("prefers backend continuous_results over stale localStorage", () => {
    const resolved = resolveWorkerSettings(
      { continuous_results: false, interim_results: true, recognition_language: "ru-RU" },
      { continuous_results: true, interim_results: true, recognition_language: "en-US" }
    );
    expect(resolved.continuous_results).toBe(false);
    expect(resolved.recognition_language).toBe("ru-RU");
  });

  it("uses localStorage when backend omits continuous_results", () => {
    const resolved = resolveWorkerSettings(
      { recognition_language: "ru-RU" },
      { continuous_results: false }
    );
    expect(resolved.continuous_results).toBe(false);
  });
});
