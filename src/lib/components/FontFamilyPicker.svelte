<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import {
    extractPrimaryFontFamily,
    fontFamilyCssStack,
    formatFontOptionLabel,
    primaryFontFamiliesMatch,
    type FontCatalogEntry,
  } from "../font-catalog";

  export let fonts: FontCatalogEntry[] = [];
  /** Primary quoted family token, e.g. `"Oswald Bold"`. */
  export let value = "";
  export let disabled = false;
  export let allowEmpty = false;
  export let emptyLabel = "";
  export let ariaLabel = "Font family";

  const dispatch = createEventDispatcher<{ change: string }>();

  let open = false;
  let rootEl: HTMLDivElement | null = null;
  let listEl: HTMLUListElement | null = null;
  /** Optimistic selection until parent `value` catches up (Svelte 5 prop granularity). */
  let pendingPrimary = "";

  $: if (pendingPrimary && primaryFontFamiliesMatch(pendingPrimary, value)) {
    pendingPrimary = "";
  }

  $: effectiveValue = pendingPrimary || value;

  $: selectedFont =
    fonts.find((font) => primaryFontFamiliesMatch(font.family, effectiveValue)) ?? null;
  $: triggerLabel =
    allowEmpty && !String(effectiveValue || "").trim()
      ? emptyLabel
      : selectedFont
        ? formatFontOptionLabel(selectedFont)
        : String(effectiveValue || "").trim() || emptyLabel;
  $: triggerFontFamily =
    allowEmpty && !String(effectiveValue || "").trim()
      ? ""
      : fontFamilyCssStack(effectiveValue || selectedFont?.family || "");

  function select(next: string) {
    pendingPrimary = extractPrimaryFontFamily(next) || next;
    dispatch("change", next);
    open = false;
  }

  function toggleOpen() {
    if (disabled) return;
    open = !open;
  }

  function onDocumentClick(event: MouseEvent) {
    if (!open || !rootEl) return;
    const target = event.target;
    if (target instanceof Node && !rootEl.contains(target)) {
      open = false;
    }
  }

  function onDocumentKeydown(event: KeyboardEvent) {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      open = false;
    }
  }

  onMount(() => {
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onDocumentKeydown);
    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onDocumentKeydown);
    };
  });
</script>

<div class="font-family-picker" bind:this={rootEl}>
  <button
    type="button"
    class="font-family-picker__trigger control"
    style:font-family={triggerFontFamily || undefined}
    {disabled}
    aria-label={ariaLabel}
    aria-haspopup="listbox"
    aria-expanded={open}
    on:click|stopPropagation={toggleOpen}
  >
    <span class="font-family-picker__trigger-text">{triggerLabel}</span>
  </button>

  {#if open}
    <ul
      class="font-family-picker__list"
      role="listbox"
      aria-label={ariaLabel}
      bind:this={listEl}
    >
      {#if allowEmpty}
        <li role="presentation">
          <button
            type="button"
            class="font-family-picker__option"
            class:selected={!String(effectiveValue || "").trim()}
            role="option"
            aria-selected={!String(effectiveValue || "").trim()}
            on:click={() => select("")}
          >
            {emptyLabel}
          </button>
        </li>
      {/if}
      {#each fonts as font (font.id)}
        {@const selected = primaryFontFamiliesMatch(font.family, effectiveValue)}
        <li role="presentation">
          <button
            type="button"
            class="font-family-picker__option"
            class:selected
            role="option"
            aria-selected={selected}
            style:font-family={fontFamilyCssStack(font.family)}
            on:click={() => select(font.family)}
          >
            {formatFontOptionLabel(font)}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .font-family-picker {
    position: relative;
    min-width: 0;
    z-index: 1;
  }

  .font-family-picker:has(.font-family-picker__list) {
    z-index: 40;
  }

  .font-family-picker__trigger {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    text-align: left;
    cursor: pointer;
    padding-inline-end: calc(var(--space-3) + 14px);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right var(--space-3) center;
    background-size: 12px;
  }

  :global(:root[data-ui-theme="dark"]) .font-family-picker__trigger {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  }

  .font-family-picker__trigger:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .font-family-picker__trigger-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .font-family-picker__list {
    position: absolute;
    z-index: 40;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    max-height: min(320px, 50vh);
    margin: 0;
    padding: var(--space-1);
    list-style: none;
    overflow: auto;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    /* Opaque surface — glass tokens are too transparent over stacked form fields. */
    background-color: #1c1e2a;
    box-shadow: var(--shadow-panel);
    isolation: isolate;
  }

  :global(html[data-ui-theme="light"]) .font-family-picker__list {
    background-color: #ffffff;
  }

  .font-family-picker__option {
    width: 100%;
    display: block;
    min-height: calc(var(--control-height) - 4px);
    padding: var(--space-2) var(--space-3);
    border: 0;
    border-radius: var(--radius-sm);
    background-color: inherit;
    color: var(--text-primary);
    text-align: left;
    cursor: pointer;
    font-size: 14px;
    line-height: 1.35;
  }

  .font-family-picker__option:hover,
  .font-family-picker__option:focus-visible {
    background: rgb(var(--ui-accent-rgb) / 0.12);
    outline: none;
  }

  .font-family-picker__option.selected {
    background: rgb(var(--ui-accent-rgb) / 0.18);
  }
</style>
