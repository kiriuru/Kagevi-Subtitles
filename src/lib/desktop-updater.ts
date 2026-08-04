import { isTauriDesktopShell } from "./shell-platform";

export type DesktopUpdateProgress = {
  phase: "idle" | "checking" | "downloading" | "installing" | "done" | "error";
  downloadedBytes: number;
  totalBytes: number | null;
  version: string;
  error: string;
};

export function emptyDesktopUpdateProgress(): DesktopUpdateProgress {
  return {
    phase: "idle",
    downloadedBytes: 0,
    totalBytes: null,
    version: "",
    error: "",
  };
}

export function desktopUpdaterSupported(win: Window = window): boolean {
  return isTauriDesktopShell(win);
}

export function formatDownloadProgress(
  downloadedBytes: number,
  totalBytes: number | null,
): string {
  if (totalBytes && totalBytes > 0) {
    const pct = Math.min(100, Math.round((downloadedBytes / totalBytes) * 100));
    return `${pct}%`;
  }
  if (downloadedBytes > 0) {
    const mb = downloadedBytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }
  return "";
}

type ProgressCallback = (progress: DesktopUpdateProgress) => void;

async function prepareUpdaterStaging(): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("prepare_updater_staging");
}

async function abortUpdaterStaging(): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("abort_updater_staging");
  } catch {
    // Best-effort rollback after a failed install attempt.
  }
}

/**
 * Download + install a newer release via tauri-plugin-updater, then relaunch.
 * Stages the NSIS installer under the install/project root (not %TEMP%).
 * Leftover staging is removed on the next app launch after NSIS finishes.
 * Caller should stop the recognition runtime before invoking when possible.
 */
export async function downloadAndInstallDesktopUpdate(
  onProgress?: ProgressCallback,
): Promise<{ installed: boolean; version: string }> {
  if (!desktopUpdaterSupported()) {
    throw new Error("Desktop updater is only available in the Tauri shell");
  }

  const emit = (partial: Partial<DesktopUpdateProgress>) => {
    onProgress?.({
      ...emptyDesktopUpdateProgress(),
      phase: "checking",
      ...partial,
    });
  };

  emit({ phase: "checking" });
  await prepareUpdaterStaging();

  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    let update;
    try {
      update = await check();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        detail.trim()
          || "Could not reach the update manifest (latest.json).",
      );
    }
    if (!update) {
      // Banner may know about a newer GitHub tag before latest.json is uploaded.
      throw new Error(
        "No signed installer is published yet (missing or outdated latest.json).",
      );
    }

    let downloaded = 0;
    let total: number | null = null;
    emit({
      phase: "downloading",
      version: update.version,
      downloadedBytes: 0,
      totalBytes: null,
    });

    await update.downloadAndInstall((event) => {
      if (event.event === "Started") {
        total = event.data.contentLength ?? null;
        downloaded = 0;
        emit({
          phase: "downloading",
          version: update.version,
          downloadedBytes: downloaded,
          totalBytes: total,
        });
        return;
      }
      if (event.event === "Progress") {
        downloaded += event.data.chunkLength;
        emit({
          phase: "downloading",
          version: update.version,
          downloadedBytes: downloaded,
          totalBytes: total,
        });
        return;
      }
      if (event.event === "Finished") {
        emit({
          phase: "installing",
          version: update.version,
          downloadedBytes: downloaded,
          totalBytes: total,
        });
      }
    });

    emit({
      phase: "done",
      version: update.version,
      downloadedBytes: downloaded,
      totalBytes: total,
    });

    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
    return { installed: true, version: update.version };
  } catch (err) {
    await abortUpdaterStaging();
    throw err;
  }
}
