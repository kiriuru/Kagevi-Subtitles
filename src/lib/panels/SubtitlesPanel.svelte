<script lang="ts">

  import { locale, t } from "../i18n";
  import { OVERLAY_PRESETS } from "../constants";
  import { getSubtitleSlotLabel, normalizeDisplayOrder } from "../translation-helpers";
  import type { ConfigPayload } from "../types";
  export let config: ConfigPayload;
  export let onChange: (next: ConfigPayload) => void;
  $: loc = $locale;
  $: tr = (key: string) => t(key, undefined, loc);
  $: overlay = (config.overlay || {}) as Record<string, unknown>;
  $: output = config.subtitle_output || {};
  $: lifecycle = (config.subtitle_lifecycle || {}) as Record<string, unknown>;
  $: displayOrder = output.display_order || ["source", "translation_1"];
  $: preset = String(overlay.preset || "single");
  $: presetHint =
    preset === "single"
      ? tr("overlay.preset_hint.single")
      : preset === "dual-line"
        ? tr("overlay.preset_hint.dual_line")
        : tr("overlay.preset_hint.stacked");
  function patchOverlay(partial: Record<string, unknown>) {
    onChange({ ...config, overlay: { ...overlay, ...partial } });
  }

  function patchOutput(partial: Record<string, unknown>) {
    onChange({
      ...config,
      subtitle_output: { ...output, ...partial },
    });
  }

  function patchLifecycle(partial: Record<string, unknown>) {
    onChange({
      ...config,
      subtitle_lifecycle: { ...lifecycle, ...partial },
    });
  }

  function secondsFromMs(ms: unknown, fallbackSec: number): number {
    const value = Number(ms);
    return Number.isFinite(value) ? Math.round(value / 100) / 10 : fallbackSec;
  }

  function setHoldSeconds(
    field: "completed_source_ttl_ms" | "completed_translation_ttl_ms",
    seconds: number,
  ) {
    const ms = Math.max(500, Math.round(seconds * 1000));
    const sourceMs =
      field === "completed_source_ttl_ms"
        ? ms
        : Number(lifecycle.completed_source_ttl_ms ?? 4500);
    const translationMs =
      field === "completed_translation_ttl_ms"
        ? ms
        : Number(lifecycle.completed_translation_ttl_ms ?? 4500);
    patchLifecycle({
      [field]: ms,
      completed_block_ttl_ms: Math.max(sourceMs, translationMs),
    });
  }

  function moveOrderItem(code: string, direction: -1 | 1) {
    const items = [...displayOrder];
    const index = items.indexOf(code);
    if (index < 0) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    const current = items[index];
    const next = items[nextIndex];
    if (!current || !next) return;
    [items[index], items[nextIndex]] = [next, current];
    patchOutput({ display_order: normalizeDisplayOrder(items) });
  }

</script>

<section class="subtitles-layout bento-root stack">
  <article class="surface-card panel-padding bento-tile subtitles-order-panel stack">
    <p class="muted subtitles-order-label">{tr("subtitles.display_order")}</p>
    <ul class="ordered-list subtitles-order-list">
      {#each displayOrder as code, index}
        <li>
          <span class="order-item-label">{getSubtitleSlotLabel(code, loc)}</span>
          <div class="order-item-actions">
            <button
              type="button"
              class="btn btn-ghost order-arrow-btn"
              disabled={index === 0}
              aria-label={tr("subtitles.move_up")}
              title={tr("subtitles.move_up")}
              on:click={() => moveOrderItem(code, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              class="btn btn-ghost order-arrow-btn"
              disabled={index === displayOrder.length - 1}
              aria-label={tr("subtitles.move_down")}
              title={tr("subtitles.move_down")}
              on:click={() => moveOrderItem(code, 1)}
            >
              ↓
            </button>
          </div>
        </li>
      {/each}
    </ul>
  </article>

  <div class="subtitles-top bento-grid">
    <article class="surface-card panel-padding bento-tile stack">
      <div class="section-heading">
        <div>
          <p class="eyebrow">{tr("subtitles.eyebrow")}</p>
          <h2>{tr("subtitles.title")}</h2>
        </div>

      </div>

      <label class="stack-field">
        <span>{tr("subtitles.overlay_preset")}</span>
        <select
          class="control"
          value={preset}
          on:change={(e) => patchOverlay({ preset: (e.currentTarget as HTMLSelectElement).value })}
        >
          {#each OVERLAY_PRESETS as item}

            <option value={item}>{tr(`subtitles.overlay_preset.${item}`)}</option>
          {/each}

        </select>

      </label>

      <p class="muted">{presetHint}</p>
      <label class="checkbox-row">
        <input
          type="checkbox"
          checked={overlay.compact === true}
          on:change={(e) => patchOverlay({ compact: (e.currentTarget as HTMLInputElement).checked })}
        />
        <span>{tr("subtitles.compact")}</span>
      </label>
      <label class="checkbox-row">
        <input
          type="checkbox"
          checked={overlay.fit_to_box !== false}
          on:change={(e) => patchOverlay({ fit_to_box: (e.currentTarget as HTMLInputElement).checked })}
        />
        <span>{tr("subtitles.fit_to_box")}</span>
      </label>
      <p class="muted">{tr("subtitles.fit_to_box.help")}</p>

      <label class="checkbox-row">
        <input
          type="checkbox"
          checked={output.show_source !== false}
          on:change={(e) => patchOutput({ show_source: (e.currentTarget as HTMLInputElement).checked })}
        />
        <span>{tr("subtitles.show_source")}</span>
      </label>

      <label class="checkbox-row">
        <input
          type="checkbox"
          checked={output.show_translations !== false}
          on:change={(e) =>
            patchOutput({ show_translations: (e.currentTarget as HTMLInputElement).checked })}
        />
        <span>{tr("subtitles.show_translations")}</span>
      </label>

    </article>

    <article class="surface-card panel-padding bento-tile stack">
      <h2>{tr("subtitles.timing.title")}</h2>
      <div class="grid-2">
        <label class="stack-field">
          <span>{tr("subtitles.source_hold")}</span>
          <input
            class="control"
            type="number"
            min="0.5"
            max="60"
            step="0.1"
            value={secondsFromMs(lifecycle.completed_source_ttl_ms, 4.5)}
            on:input={(e) =>
              setHoldSeconds(
                "completed_source_ttl_ms",
                Number((e.currentTarget as HTMLInputElement).value),
              )}
          />
        </label>

        <label class="stack-field">
          <span>{tr("subtitles.translation_hold")}</span>
          <input
            class="control"
            type="number"
            min="0.5"
            max="60"
            step="0.1"
            value={secondsFromMs(lifecycle.completed_translation_ttl_ms, 4.5)}
            on:input={(e) =>
              setHoldSeconds(
                "completed_translation_ttl_ms",
                Number((e.currentTarget as HTMLInputElement).value),
              )}
          />
        </label>

      </div>

      <label class="checkbox-row">
        <input
          type="checkbox"
          checked={lifecycle.sync_source_and_translation_expiry !== false}
          on:change={(e) =>
            patchLifecycle({
              sync_source_and_translation_expiry: (e.currentTarget as HTMLInputElement).checked,
            })}
        />
        <span>{tr("subtitles.sync_expiry")}</span>
      </label>

      <label class="checkbox-row">
        <input
          type="checkbox"
          checked={lifecycle.allow_early_replace_on_next_final !== false}
          on:change={(e) =>
            patchLifecycle({
              allow_early_replace_on_next_final: (e.currentTarget as HTMLInputElement).checked,
            })}
        />
        <span>{tr("subtitles.allow_replace")}</span>
      </label>

      <label class="checkbox-row">
        <input
          type="checkbox"
          checked={lifecycle.keep_completed_translation_during_active_partial !== false}
          on:change={(e) =>
            patchLifecycle({
              keep_completed_translation_during_active_partial: (e.currentTarget as HTMLInputElement)
                .checked,
            })}
        />
        <span>{tr("subtitles.keep_completed_during_partial")}</span>
      </label>

      <p class="muted subtitles-timing-hint">{tr("subtitles.keep_completed_during_partial.note")}</p>
      <p class="muted">{tr("subtitles.timing.note.order")}</p>
    </article>

  </div>

</section>

<style>
  .subtitles-order-label {
    margin: 0;
    font-size: 13px;
  }
  .subtitles-order-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--space-2);
  }
  .subtitles-order-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    border: 1px solid var(--line-subtle);
    border-radius: var(--radius-md);
    background: var(--bg-control);
    padding: 6px 8px 6px 12px;
  }
  .order-item-label {
    min-width: 0;
    flex: 1;
    font: inherit;
    color: inherit;
  }
  .order-item-actions {
    display: flex;
    flex-shrink: 0;
    gap: 2px;
  }
  .order-arrow-btn {
    min-width: 32px;
    width: 32px;
    height: 32px;
    padding: 0;
    font-size: 14px;
    line-height: 1;
  }
  .order-arrow-btn:disabled {
    opacity: 0.35;
  }
  .subtitles-timing-hint {
    margin: 0 0 var(--space-2);
    font-size: 12px;
    line-height: 1.45;
  }
</style>
