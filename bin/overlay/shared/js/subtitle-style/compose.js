export function inferStyleSlot(item, translationIndex) {
  const explicitSlot = String(item?.style_slot || item?.slot_id || "").trim();
  if (explicitSlot) {
    return explicitSlot;
  }
  if (item?.kind === "translation") {
    return `translation_${Math.max(1, Math.min(4, translationIndex + 1))}`;
  }
  return "source";
}

export function textAlignToJustify(textAlign) {
  const align = String(textAlign || "center").trim().toLowerCase();
  if (align === "left" || align === "start") return "flex-start";
  if (align === "right" || align === "end") return "flex-end";
  return "center";
}

export function composeRenderRows(payload) {
  const visibleItems = Array.isArray(payload?.visible_items)
    ? payload.visible_items.filter((item) => item && String(item.text || "").trim())
    : [];
  const activePartialText = String(payload?.active_partial_text || "");
  const allowSourcePartialPreview = payload?.show_source !== false;

  const lifecycleState = String(payload?.lifecycle_state || "idle");
  const isCompletedWithPartial = lifecycleState === "completed_with_partial";
  const isPartialOnly = lifecycleState === "partial_only";
  // Live-partial MT publishes the draft translation alongside the growing
  // source while the phrase is still partial. Those rows must render, so the
  // source-only shortcut below applies only when no translation row exists.
  const hasLivePartialTranslation =
    (isPartialOnly || (!isCompletedWithPartial && !payload?.completed_block_visible))
    && payload?.show_translations !== false
    && visibleItems.some((item) => item.kind === "translation");

  // partial_only: no completed block yet — preview just the live source.
  // Never use this shortcut for completed_with_partial: that state mixes
  // the live partial with the previous phrase's completed translations.
  if (
    !isCompletedWithPartial
    && !payload?.completed_block_visible
    && !hasLivePartialTranslation
    && allowSourcePartialPreview
    && activePartialText
  ) {
    return [
      {
        rowSlot: "source",
        entries: [{ kind: "source", text: activePartialText, style_slot: "source", transient: true }],
      },
    ];
  }

  if (
    (!payload?.completed_block_visible && !isCompletedWithPartial && !hasLivePartialTranslation)
    || !visibleItems.length
  ) {
    return [];
  }

  // When the backend lifecycle state is "completed_with_partial" — i.e. the
  // PREVIOUS phrase's completed translation is still visible while the
  // NEXT phrase is being typed — the presentation layer mixes the live
  // partial text into `visible_items[source]` instead of leaving the old
  // completed source there. Without explicitly marking that source entry
  // as transient here, the renderer treats every keystroke as a brand
  // new completed entry: the shape signature changes on every frame,
  // the fast path bails to the slow path, a fresh surface is created,
  // and the completion animation fires repeatedly. That's the
  // "когда появляется перевод, исходник постоянно перерендерится"
  // regression. Translations keep their completed semantics because
  // they appear once per phrase and don't need typewriter-incremental
  // treatment (matches the explicit user request to leave translations
  // on the old logic).
  const livePartialSourceInVisibleItems =
    (payload?.lifecycle_state === "completed_with_partial" || isPartialOnly)
    && activePartialText.length > 0;
  let translationIndex = 0;
  const entries = visibleItems.map((item) => {
    const slotName = inferStyleSlot(item, translationIndex);
    if (item.kind === "translation") {
      translationIndex += 1;
    }
    const isLivePartialSource =
      livePartialSourceInVisibleItems
      && item.kind === "source"
      && String(item.text || "") === activePartialText;
    return {
      kind: item.kind || "source",
      lang: item.lang || "",
      text: item.text || "",
      style_slot: slotName,
      transient: isLivePartialSource,
    };
  });

  if (payload.preset === "single") {
    return [{ rowSlot: entries[0]?.style_slot || "source", entries }];
  }

  if (payload.preset === "dual-line") {
    const firstEntry = entries[0] ? [{ ...entries[0] }] : [];
    const remainingEntries = entries.slice(1);
    return [
      firstEntry.length ? { rowSlot: firstEntry[0].style_slot, entries: firstEntry } : null,
      remainingEntries.length ? { rowSlot: remainingEntries[0].style_slot, entries: remainingEntries } : null,
    ].filter(Boolean);
  }

  return entries.map((entry) => ({
    rowSlot: entry.style_slot,
    entries: [entry],
  }));
}
