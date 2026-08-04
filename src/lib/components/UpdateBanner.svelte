<script lang="ts">
  import { locale, t } from "../i18n";
  import {
    desktopUpdaterSupported,
    formatDownloadProgress,
    type DesktopUpdateProgress,
  } from "../desktop-updater";
  import type { VersionInfo } from "../types";

  export let versionInfo: VersionInfo | null = null;
  export let visible = false;
  export let progress: DesktopUpdateProgress | null = null;
  export let onClose: () => void = () => {};
  export let onInstall: () => void = () => {};
  export let onOpenRelease: (url: string) => void = () => {};

  $: loc = $locale;
  $: tr = (key: string, vars?: Record<string, string | number>) => t(key, vars, loc);
  $: sync = versionInfo?.sync;
  $: current = versionInfo?.current_version || versionInfo?.version || "";
  $: latest = sync?.latest_known_version || "";
  $: canInstall = desktopUpdaterSupported();
  $: busy =
    progress?.phase === "checking"
    || progress?.phase === "downloading"
    || progress?.phase === "installing";
  $: progressLabel = formatDownloadProgress(
    progress?.downloadedBytes || 0,
    progress?.totalBytes ?? null,
  );

  function releaseUrlForVersion(
    repo: string | null | undefined,
    version: string,
  ): string {
    const normalized = version.trim().replace(/^v/i, "");
    if (!normalized || !repo?.trim()) {
      return "";
    }
    return `https://github.com/${repo.trim()}/releases/tag/v${normalized}`;
  }

  $: releaseUrl =
    sync?.release_url
    || releaseUrlForVersion(
      typeof sync?.github_repo === "string" ? sync.github_repo : "",
      latest,
    );

  $: statusText = (() => {
    if (!progress || progress.phase === "idle") return "";
    if (progress.phase === "checking") return tr("updates.banner.status.checking");
    if (progress.phase === "downloading") {
      return progressLabel
        ? tr("updates.banner.status.downloading_pct", { progress: progressLabel })
        : tr("updates.banner.status.downloading");
    }
    if (progress.phase === "installing") return tr("updates.banner.status.installing");
    if (progress.phase === "done") return tr("updates.banner.status.restarting");
    if (progress.phase === "error") {
      return progress.error
        ? tr("updates.banner.status.error_detail", { error: progress.error })
        : tr("updates.banner.status.error");
    }
    return "";
  })();
</script>

{#if visible && sync?.update_available && latest}
  <div class="update-banner surface-card" role="status" aria-live="polite">
    <div class="update-banner__copy">
      <p class="update-banner__text">
        {tr("updates.banner.message", { current, latest })}
      </p>
      {#if statusText}
        <p class="update-banner__status">{statusText}</p>
      {/if}
    </div>
    <div class="update-banner__actions">
      <button type="button" class="btn" disabled={busy} on:click={onClose}>
        {tr("updates.banner.close")}
      </button>
      {#if canInstall && progress?.phase === "error" && releaseUrl}
        <button
          type="button"
          class="btn"
          on:click={() => onOpenRelease(releaseUrl)}
        >
          {tr("updates.banner.download")}
        </button>
      {/if}
      {#if canInstall}
        <button
          type="button"
          class="btn btn-primary"
          disabled={busy}
          on:click={onInstall}
        >
          {busy ? tr("updates.banner.installing") : tr("updates.banner.install")}
        </button>
      {:else}
        <button
          type="button"
          class="btn btn-primary"
          disabled={!releaseUrl || busy}
          on:click={() => releaseUrl && onOpenRelease(releaseUrl)}
        >
          {tr("updates.banner.download")}
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .update-banner {
    position: fixed;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1200;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    max-width: min(720px, calc(100vw - 24px));
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-lg);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
    border-color: rgba(255, 191, 87, 0.45);
  }

  .update-banner__copy {
    flex: 1;
    min-width: 0;
  }

  .update-banner__text {
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--text-primary);
  }

  .update-banner__status {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.4;
    color: var(--text-secondary);
  }

  .update-banner__actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  @media (max-width: 640px) {
    .update-banner {
      flex-direction: column;
      align-items: stretch;
    }

    .update-banner__actions {
      justify-content: flex-end;
    }
  }
</style>
