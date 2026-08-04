import { afterEach, describe, expect, it, vi } from "vitest";
import type { VersionInfo } from "./types";

vi.mock("./api", () => ({
  fetchVersion: vi.fn(),
  checkUpdates: vi.fn(),
}));

import { checkUpdates, fetchVersion } from "./api";
import { refreshVersionAfterStartupCheck } from "./update-check";

const fetchVersionMock = vi.mocked(fetchVersion);
const checkUpdatesMock = vi.mocked(checkUpdates);

describe("refreshVersionAfterStartupCheck", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("returns immediately when startup check already persisted last_checked_utc", async () => {
    const info: VersionInfo = {
      current_version: "0.6.2",
      sync: {
        last_checked_utc: "2026-08-04T00:00:00Z",
        update_available: false,
      },
    };
    fetchVersionMock.mockResolvedValue(info);

    await expect(refreshVersionAfterStartupCheck({ timeoutMs: 1000 })).resolves.toEqual(info);
    expect(checkUpdatesMock).not.toHaveBeenCalled();
  });

  it("falls back to force check when startup poll never writes last_checked", async () => {
    vi.useFakeTimers();
    const pending: VersionInfo = {
      current_version: "0.6.2",
      sync: { last_checked_utc: "", update_available: false },
    };
    const forced: VersionInfo = {
      current_version: "0.6.2",
      sync: {
        last_checked_utc: "2026-08-04T00:00:01Z",
        update_available: true,
        latest_known_version: "0.6.3",
      },
    };
    fetchVersionMock.mockResolvedValue(pending);
    checkUpdatesMock.mockResolvedValue(forced);

    const promise = refreshVersionAfterStartupCheck({ timeoutMs: 50, pollMs: 10 });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual(forced);
    expect(checkUpdatesMock).toHaveBeenCalledTimes(1);
  });
});
