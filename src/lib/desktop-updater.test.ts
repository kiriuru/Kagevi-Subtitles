import { afterEach, describe, expect, it, vi } from "vitest";
import {
  desktopUpdaterSupported,
  downloadAndInstallDesktopUpdate,
  emptyDesktopUpdateProgress,
  formatDownloadProgress,
} from "./desktop-updater";

describe("desktop-updater", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("reports unsupported outside Tauri shell", () => {
    expect(desktopUpdaterSupported({} as Window)).toBe(false);
    expect(
      desktopUpdaterSupported({
        __TAURI_INTERNALS__: {},
      } as Window & { __TAURI_INTERNALS__: object }),
    ).toBe(true);
  });

  it("formats download progress", () => {
    expect(formatDownloadProgress(0, null)).toBe("");
    expect(formatDownloadProgress(5 * 1024 * 1024, null)).toBe("5.0 MB");
    expect(formatDownloadProgress(25, 100)).toBe("25%");
    expect(formatDownloadProgress(100, 100)).toBe("100%");
  });

  it("starts with idle progress", () => {
    expect(emptyDesktopUpdateProgress()).toEqual({
      phase: "idle",
      downloadedBytes: 0,
      totalBytes: null,
      version: "",
      error: "",
    });
  });

  it("throws when Tauri check finds no signed update (avoids stuck checking UI)", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const invoke = vi.fn().mockResolvedValue("F:/AI/VoiceSub");
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    vi.doMock("@tauri-apps/plugin-updater", () => ({
      check: vi.fn().mockResolvedValue(null),
    }));
    await expect(downloadAndInstallDesktopUpdate()).rejects.toThrow(/latest\.json/i);
    expect(invoke).toHaveBeenCalledWith("prepare_updater_staging");
    expect(invoke).toHaveBeenCalledWith("abort_updater_staging");
  });
});