<script lang="ts">
  import { locale, t } from "../i18n";
  import type { RuntimeStatus } from "../types";
  import { buildRuntimeConnectionChips } from "../runtime-status";
  import { formatObsCaptionError, formatObsChipLabel } from "../obs-status-i18n";
  import RuntimeDetailsSheet from "./RuntimeDetailsSheet.svelte";
  import Info from "lucide-svelte/icons/info";

  export let runtime: RuntimeStatus;
  export let obsDiagnostics: Record<string, unknown> | undefined = undefined;
  export let wsConnected = false;

  let detailsOpen = false;

  $: loc = $locale;
  $: tr = (key: string) => t(key, undefined, loc);
  $: chips = buildRuntimeConnectionChips(runtime, wsConnected, obsDiagnostics);
  $: obsLabel = formatObsChipLabel(chips.obsLabelKind, chips.obsLabelCode, tr);
  $: obsChipTitle =
    chips.obsLabelKind === "error" ? formatObsCaptionError(chips.obsLabelCode, tr) : undefined;
</script>

<div class="runtime-mini-strip surface-card" role="status" aria-label={tr("runtime.strip.connections")}>
  <div class="runtime-mini-strip__chips" role="list">
    <span
      class="filter-chip filter-chip--compact"
      class:ok={chips.wsConnected}
      class:warn={!chips.wsConnected}
      role="listitem"
    >
      {tr("runtime.chip.ws")}: {chips.wsConnected ? tr("common.connected") : tr("common.disconnected")}
    </span>
    {#if chips.showBrowserWorkerChip}
      <span
        class="filter-chip filter-chip--compact"
        class:ok={chips.workerConnected}
        class:warn={!chips.workerConnected}
        role="listitem"
      >
        {tr("runtime.chip.worker")}: {chips.workerConnected ? tr("common.connected") : tr("common.disconnected")}
      </span>
    {/if}
    {#if chips.showLocalAsrChip}
      <span
        class="filter-chip filter-chip--compact"
        class:ok={chips.asrSourceConnected}
        class:warn={!chips.asrSourceConnected}
        role="listitem"
      >
        {tr("runtime.chip.local_asr")}: {chips.asrSourceConnected ? tr("common.connected") : tr("common.disconnected")}
      </span>
    {/if}
    <span
      class="filter-chip filter-chip--compact"
      class:ok={chips.obsStatus === "ready"}
      class:warn={chips.obsStatus === "warn" || chips.obsStatus === "waiting"}
      class:err={chips.obsStatus === "error"}
      role="listitem"
      title={obsChipTitle}
    >
      {tr("runtime.chip.obs")}: {obsLabel}
    </span>
  </div>
  <button type="button" class="btn btn-ghost btn-sm runtime-mini-strip__details" on:click={() => (detailsOpen = true)}>
    <Info size={15} strokeWidth={1.75} />
    {tr("runtime.details.open")}
  </button>
</div>

<RuntimeDetailsSheet bind:open={detailsOpen} {runtime} {obsDiagnostics} {wsConnected} />
