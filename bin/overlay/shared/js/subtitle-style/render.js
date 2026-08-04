import { resolveEffectiveStyle } from "./style-model.js";
import { composeRenderRows, textAlignToJustify } from "./compose.js";
import {
  applyStyleMap,
  buildCssVariables,
  effectClassName,
  renderEntrySignature,
  shouldAnimateEntry,
} from "./css-vars.js";
import {
  appendTransientFragments,
  updateTransientSurfaceInPlace,
  _transientSurfaceClassName,
  _resolveTraceCallback,
  _safeEmit,
} from "./partials.js";
import {
  _shapeSignatureForRows,
  _shapeLayoutTag,
  _canFastPathFinalize,
  _finalizeTransientSurfaceInPlace,
  _derefSurfaceList,
  _derefSurfaceRef,
  _readPartialSurfaceBySlot,
  _persistPartialSurfaceBySlot,
  _surfaceRefsFromElements,
  _surfaceRefFor,
  _releaseOrphanedSurfaces,
  _scrubSurfaceMetadata,
  _applyStyleMapIfChanged,
  _setClassNameIfChanged,
} from "./render-state.js";

/**
 * Layout CSS lives on stage/row ancestors (not surfaces). Fast path must refresh
 * these when text_align / line_gap change without a shape rebuild — otherwise
 * dashboard idle preview stays stuck until a full page reload.
 */
function applyStageAndRowLayout(wrapper, rows, effectiveStyle, cachedLayout) {
  if (!wrapper) {
    return { stage: null, rows: [] };
  }
  const stage =
    (cachedLayout?.stage && cachedLayout.stage.isConnected && cachedLayout.stage.parentNode === wrapper
      ? cachedLayout.stage
      : null)
    || wrapper.querySelector(".subtitle-stage");
  if (stage) {
    stage.style.setProperty(
      "--subtitle-line-gap",
      `${Math.max(0, effectiveStyle?.container?.line_gap_px || 0)}px`
    );
  }
  const cachedRows = Array.isArray(cachedLayout?.rows) ? cachedLayout.rows : null;
  const rowEls =
    cachedRows
    && cachedRows.length === (rows || []).length
    && cachedRows.every((row) => row && row.isConnected)
      ? cachedRows
      : Array.from(wrapper.querySelectorAll(".subtitle-line"));
  (rows || []).forEach((rowConfig, rowIndex) => {
    const row = rowEls[rowIndex];
    if (!row) {
      return;
    }
    const textAlign =
      effectiveStyle?.line_slots?.[rowConfig.rowSlot]?.text_align ||
      effectiveStyle?.container?.text_align ||
      "center";
    row.style.setProperty("--subtitle-text-align", textAlign);
    row.style.setProperty("--subtitle-justify", textAlignToJustify(textAlign));
  });
  return { stage, rows: rowEls };
}

export function render(container, payload, options) {
  if (!container) {
    return { empty: true };
  }
  const presets = options?.presets || null;
  const effectiveStyle = payload?.style && Object.keys(payload.style).length
    ? payload.style
    : resolveEffectiveStyle(options?.styleConfig || null, presets);
  const rows = composeRenderRows(payload);
  const traceCallback = _resolveTraceCallback(options);
  // Empty frames must not rebuild a stage shell; callers dispose state/DOM.
  if (rows.length === 0) {
    if (traceCallback) {
      _safeEmit(traceCallback, {
        type: "render_summary",
        overlay: Boolean(options?.overlay),
        rows: 0,
        partial_entries: 0,
        completed_entries: 0,
        reused_partial_surfaces: 0,
        finalized_in_place: 0,
        state_carryover: Boolean(container.__subtitleStyleRenderState),
        fast_path: false,
        empty: true,
      });
    }
    return {
      empty: true,
      rowCount: 0,
      effectiveStyle,
      rows,
    };
  }
  const renderStartedAt = (typeof performance !== "undefined" && performance && typeof performance.now === "function")
    ? performance.now()
    : Date.now();
  const hadPriorRenderState = Boolean(container.__subtitleStyleRenderState);
  const renderState = container.__subtitleStyleRenderState || {};
  const previousEntrySignatures = new Set(renderState.entrySignatures || []);
  const previousPartialBySlot = new Map(
    renderState.partialBySlot instanceof Map
      ? renderState.partialBySlot
      : Object.entries(renderState.partialBySlot || {})
  );
  const previousPartialSurfaceBySlot = _readPartialSurfaceBySlot(renderState.partialSurfaceBySlot);
  const lastRenderedAt = Number.isFinite(renderState.lastRenderedAt) ? renderState.lastRenderedAt : null;
  const previousShape = typeof renderState.shapeSignature === "string" ? renderState.shapeSignature : null;
  const previousEntrySurfaces = _derefSurfaceList(renderState.entrySurfaces);
  const cachedWrapper = _derefSurfaceRef(renderState.wrapper);
  const previousEntryDescriptors = Array.isArray(renderState.entryDescriptors) ? renderState.entryDescriptors : null;
  const layoutPreset = payload?.preset || "stacked";
  const overlay = Boolean(options?.overlay);
  const compact = Boolean(payload?.compact);
  const shapeSignature = _shapeSignatureForRows(rows, layoutPreset, compact, overlay);
  const stageScale = compact ? 0.88 : 1;
  const nextEntrySignatures = [];
  const nextPartialBySlot = new Map();
  const nextPartialSurfaceBySlot = new Map();
  const nextEntrySurfaces = [];
  const nextEntryDescriptors = [];
  const traceFrameEvents = traceCallback ? [] : null;
  let partialEntryCount = 0;
  let completedEntryCount = 0;
  let reusedPartialSurfaceCount = 0;
  let finalizedInPlaceCount = 0;
  let usedFastPath = false;
  const exactShapeMatch = previousShape !== null && previousShape === shapeSignature;
  // Finalization fast path must keep the same layout tag (preset|compact|overlay).
  // Otherwise single↔dual-line↔stacked switches reuse the old row DOM/classes.
  const finalizationCompatible = !exactShapeMatch
    && _shapeLayoutTag(previousShape) !== null
    && _shapeLayoutTag(previousShape) === _shapeLayoutTag(shapeSignature)
    && _canFastPathFinalize(rows, previousEntryDescriptors, previousPartialBySlot);

  // -----------------------------------------------------------------
  // Fast path: same wrapper as last frame; either the shape is identical
  // (pure partial extension / unchanged completed) OR the only change is
  // one or more partials finalizing with text matching what was already
  // shown. In both cases we mutate the existing surfaces in place and
  // leave the wrapper alone. This kills the full-block re-render at
  // finalization that the user reported, while letting translation rows
  // (which only appear once and *do* change the row count) fall through
  // to the slow path so they follow the old logic.
  // -----------------------------------------------------------------
  if (
    (exactShapeMatch || finalizationCompatible)
    && previousEntrySurfaces
    && cachedWrapper
    && cachedWrapper.parentNode === container
    && rows.length > 0
  ) {
    const totalEntries = rows.reduce((sum, rowConfig) => sum + (rowConfig.entries || []).length, 0);
    // Pre-validate every surface before mutating. Aborting mid-loop after
    // updateTransientSurfaceInPlace already extended a surface let the slow
    // path re-append the same delta against stale previousPartialBySlot.
    let allSurfacesReady = previousEntrySurfaces.length === totalEntries;
    if (allSurfacesReady) {
      for (let i = 0; i < totalEntries; i += 1) {
        const surface = previousEntrySurfaces[i];
        if (!surface || !surface.isConnected) {
          allSurfacesReady = false;
          break;
        }
      }
    }
    if (allSurfacesReady) {
      usedFastPath = true;
      const previousLayout = {
        stage: _derefSurfaceRef(renderState.stage),
        rows: _derefSurfaceList(renderState.rowElements) || [],
      };
      // Shape-equal frames still need ancestor layout vars (align / gap).
      const layoutRefs = applyStageAndRowLayout(
        cachedWrapper,
        rows,
        effectiveStyle,
        previousLayout
      );
      let surfaceCursor = 0;
      rows.forEach((rowConfig) => {
        rowConfig.entries.forEach((entry) => {
          const surface = previousEntrySurfaces[surfaceCursor];
          const prevDescriptor = previousEntryDescriptors ? previousEntryDescriptors[surfaceCursor] : null;
          surfaceCursor += 1;
          const lineStyle = effectiveStyle.line_slots?.[entry.style_slot] || effectiveStyle.base || {};
          const slotEffect = lineStyle.effect || effectiveStyle.effect || "none";
          _applyStyleMapIfChanged(surface, buildCssVariables(lineStyle, stageScale));
          const wasTransient = Boolean(prevDescriptor && prevDescriptor.transient);
          if (entry.transient) {
            partialEntryCount += 1;
            const slotName = entry.style_slot || "source";
            const previousText = previousPartialBySlot.get(slotName) || "";
            const partialTraceHook = traceCallback
              ? (partialEvent) => {
                  const enriched = { type: "partial_frame", ...partialEvent };
                  traceFrameEvents.push(enriched);
                  _safeEmit(traceCallback, enriched);
                }
              : null;
            _setClassNameIfChanged(
              surface,
              _transientSurfaceClassName(entry, options)
            );
            const reused = updateTransientSurfaceInPlace(surface, entry, slotEffect, previousText, {
              ...options,
              onTrace: partialTraceHook,
            });
            if (!reused) {
              // Revision/jump within the same shape — wipe the surface and
              // re-render its fragments inside the same DOM node. We still
              // avoid the wrapper rebuild, but the fresh span will play its
              // animation on the whole replacement, which matches user
              // expectations (the recogniser changed the hypothesis).
              while (surface.firstChild) {
                surface.removeChild(surface.firstChild);
              }
              appendTransientFragments(surface, entry, slotEffect, previousText, {
                ...options,
                onTrace: partialTraceHook,
              });
            } else {
              reusedPartialSurfaceCount += 1;
            }
            nextPartialBySlot.set(slotName, String(entry.text || ""));
            nextPartialSurfaceBySlot.set(slotName, surface);
          } else if (wasTransient) {
            // T → C finalization at *the same position with matching text*.
            // Consolidate the static/fresh spans into plain text on the
            // *same DOM node* so the user sees zero visual change at
            // finalization. This is the load-bearing optimisation that
            // eliminates the "renders the whole block again" jump.
            completedEntryCount += 1;
            finalizedInPlaceCount += 1;
            const finalizationTraceHook = traceCallback
              ? (event) => {
                  traceFrameEvents.push(event);
                  _safeEmit(traceCallback, event);
                }
              : null;
            _finalizeTransientSurfaceInPlace(surface, entry, finalizationTraceHook);
            nextEntrySignatures.push(renderEntrySignature(entry));
          } else {
            completedEntryCount += 1;
            // Shape omits completed text — patch in place on supersession /
            // late MT without replaying entrance effects.
            const prevText = prevDescriptor ? String(prevDescriptor.text || "") : "";
            const nextText = String(entry.text || "");
            if (surface.textContent !== nextText) {
              surface.textContent = nextText;
            }
            _setClassNameIfChanged(
              surface,
              `subtitle-line__surface subtitle-slot-${entry.style_slot} effect-none`
            );
            nextEntrySignatures.push(renderEntrySignature(entry));
            if (traceCallback) {
              const event = {
                type: "completed_frame",
                slot: entry.style_slot || "source",
                kind: entry.kind || "source",
                effect: String(slotEffect || "none"),
                text_length: nextText.length,
                animated: false,
                reused_surface: true,
                text_patched: prevText !== nextText,
              };
              traceFrameEvents.push(event);
              _safeEmit(traceCallback, event);
            }
          }
          nextEntrySurfaces.push(surface);
          nextEntryDescriptors.push({
            slot: entry.style_slot || "source",
            kind: entry.kind || "source",
            lang: entry.lang || "",
            transient: Boolean(entry.transient),
            text: String(entry.text || ""),
          });
        });
      });
      // Stash layout refs for the fast-path state write below.
      cachedWrapper.__sstLayoutRefs = layoutRefs;
    }
  }

  if (usedFastPath) {
    const renderFinishedAt = (typeof performance !== "undefined" && performance && typeof performance.now === "function")
      ? performance.now()
      : Date.now();
    const layoutRefs = cachedWrapper.__sstLayoutRefs || {};
    delete cachedWrapper.__sstLayoutRefs;
    container.__subtitleStyleRenderState = {
      entrySignatures: nextEntrySignatures,
      partialBySlot: Object.fromEntries(nextPartialBySlot.entries()),
      partialSurfaceBySlot: _persistPartialSurfaceBySlot(nextPartialSurfaceBySlot),
      entrySurfaces: _surfaceRefsFromElements(nextEntrySurfaces),
      entryDescriptors: nextEntryDescriptors,
      shapeSignature,
      wrapper: _surfaceRefFor(cachedWrapper),
      stage: _surfaceRefFor(layoutRefs.stage || null),
      rowElements: _surfaceRefsFromElements(layoutRefs.rows || []),
      lastRenderedAt: renderFinishedAt,
    };
    if (traceCallback) {
      const anomalies = [];
      traceFrameEvents.forEach((event) => {
        if (event.type !== "partial_frame") {
          return;
        }
        if (event.transition === "revision" || event.transition === "jump") {
          anomalies.push({
            kind: "partial_revision",
            slot: event.slot,
            transition: event.transition,
            shared_length: event.shared_length,
            fresh_chars: event.fresh_chars,
            previous_text_length: event.previous_text_length,
            current_text_length: event.current_text_length,
          });
        }
      });
      _safeEmit(traceCallback, {
        type: "render_summary",
        overlay,
        rows: rows.length,
        partial_entries: partialEntryCount,
        completed_entries: completedEntryCount,
        reused_partial_surfaces: reusedPartialSurfaceCount,
        finalized_in_place: finalizedInPlaceCount,
        state_carryover: hadPriorRenderState,
        fast_path: true,
        fast_path_reason: exactShapeMatch ? "shape_equal" : "finalization_compatible",
        shape_signature: shapeSignature,
        ms_since_last_render: lastRenderedAt !== null ? Math.max(0, renderStartedAt - lastRenderedAt) : null,
        render_duration_ms: Math.max(0, renderFinishedAt - renderStartedAt),
        anomalies,
      });
    }
    return {
      empty: rows.length === 0,
      rowCount: rows.length,
      effectiveStyle,
      rows,
    };
  }

  // -----------------------------------------------------------------
  // Slow path: structural change (or first render). Rebuild the wrapper
  // top-down. We still reuse the per-slot partial surface where possible
  // so the static prefix span is preserved even when, for example, a new
  // translation row arrives.
  // -----------------------------------------------------------------
  const wrapper = document.createElement("div");
  wrapper.className = `subtitle-stage-shell${overlay ? " is-overlay-shell" : ""}`;
  const stage = document.createElement("div");
  stage.className = `subtitle-stage layout-${layoutPreset}${compact ? " is-compact" : ""}`;
  stage.style.setProperty("--subtitle-line-gap", `${Math.max(0, effectiveStyle.container?.line_gap_px || 0)}px`);

  rows.forEach((rowConfig, rowIndex) => {
    const row = document.createElement("div");
    row.className = "subtitle-line";
    row.dataset.slot = rowConfig.rowSlot || "source";
    const textAlign =
      effectiveStyle.line_slots?.[rowConfig.rowSlot]?.text_align ||
      effectiveStyle.container?.text_align ||
      "center";
    row.style.setProperty("--subtitle-text-align", textAlign);
    row.style.setProperty("--subtitle-justify", textAlignToJustify(textAlign));
    const content = document.createElement("div");
    content.className = `subtitle-line__content subtitle-line__content--${layoutPreset}`;

    rowConfig.entries.forEach((entry, entryIndex) => {
      const lineStyle = effectiveStyle.line_slots?.[entry.style_slot] || effectiveStyle.base || {};
      const slotEffect = lineStyle.effect || effectiveStyle.effect || "none";
      // Transient (live partial) entries never animate the surface itself —
      // we add a per-fragment span animation below so the growing prefix
      // stays visually static while only freshly appended characters run
      // the configured effect. Completed entries keep the surface-level
      // animation gated by signature dedup so they fire exactly once per
      // distinct text+slot combination.
      const animateCompleted = !entry.transient && shouldAnimateEntry(entry, previousEntrySignatures);
      const surfaceEffectClass = animateCompleted
        ? effectClassName(slotEffect)
        : "effect-none";

      let surface = null;
      if (entry.transient) {
        partialEntryCount += 1;
        const slotName = entry.style_slot || "source";
        const previousText = previousPartialBySlot.get(slotName) || "";
        const previousSurface = previousPartialSurfaceBySlot.get(slotName) || null;
        const partialTraceHook = traceCallback
          ? (partialEvent) => {
              const enriched = { type: "partial_frame", ...partialEvent };
              traceFrameEvents.push(enriched);
              _safeEmit(traceCallback, enriched);
            }
          : null;
        if (previousSurface) {
          // Detach from any prior parent (will be moved into the new wrapper
          // when we appendChild below). DOM moves don't restart CSS
          // animations on existing children, so this preserves the static
          // prefix span untouched.
          if (previousSurface.parentNode) {
            previousSurface.parentNode.removeChild(previousSurface);
          }
          const reused = updateTransientSurfaceInPlace(
            previousSurface,
            entry,
            slotEffect,
            previousText,
            { ...options, onTrace: partialTraceHook },
          );
          if (reused) {
            surface = previousSurface;
            reusedPartialSurfaceCount += 1;
            surface.dataset.row = String(rowIndex);
            surface.dataset.index = String(entryIndex);
            surface.className = _transientSurfaceClassName(entry, options);
            applyStyleMap(surface, buildCssVariables(lineStyle, stageScale));
          }
        }
        if (!surface) {
          surface = document.createElement("div");
          surface.className = _transientSurfaceClassName(entry, options);
          surface.dataset.slot = entry.style_slot || "source";
          surface.dataset.kind = entry.kind || "source";
          surface.dataset.row = String(rowIndex);
          surface.dataset.index = String(entryIndex);
          applyStyleMap(surface, buildCssVariables(lineStyle, stageScale));
          appendTransientFragments(surface, entry, slotEffect, previousText, {
            ...options,
            onTrace: partialTraceHook,
          });
        }
        nextPartialBySlot.set(slotName, String(entry.text || ""));
        nextPartialSurfaceBySlot.set(slotName, surface);
      } else {
        completedEntryCount += 1;
        // Slow-path completed reuse strategy. The wrapper is being
        // rebuilt here (because the shape changed — typically a new
        // translation row just arrived), but the SOURCE row's content
        // hasn't actually changed visually since the previous frame.
        // We look for an existing surface to reuse, in priority order:
        //   1. A *partial* surface in the same slot whose text matches
        //      the new completed text — classic "ASR just finalized"
        //      flow with no animation needed.
        //   2. A *completed* surface from the previous render with the
        //      same slot/kind/lang/text — handles "completed source
        //      persists while translation arrives in the next frame".
        //      Without this, the source re-animates each time a
        //      translation row is added/changed, which is exactly the
        //      'got worse for effects' regression.
        // Translation rows that were already painted as live drafts must
        // reuse that surface even when final text differs — remount +
        // entrance animation re-blinks glyphs (fade/blur/glow from opacity 0).
        // Brand-new translation slots (no prior partial) still get a fresh
        // animated surface below.
        const slotName = entry.style_slot || "source";
        const entryKind = entry.kind || "source";
        const entryLang = entry.lang || "";
        const entryText = String(entry.text || "");
        const partialSurfaceForSlot = previousPartialSurfaceBySlot.get(slotName) || null;
        const lastPartialTextForSlot = String(previousPartialBySlot.get(slotName) || "");
        const hasPartialSurfaceForSlot =
          Boolean(partialSurfaceForSlot) && previousPartialBySlot.has(slotName);
        const canReuseAsFinalization =
          hasPartialSurfaceForSlot && lastPartialTextForSlot === entryText;
        const canReuseDraftTranslation =
          entryKind === "translation" && hasPartialSurfaceForSlot;
        let reusableCompletedSurface = null;
        if (
          !canReuseAsFinalization
          && !canReuseDraftTranslation
          && previousEntryDescriptors
          && previousEntrySurfaces
        ) {
          for (let i = 0; i < previousEntryDescriptors.length; i += 1) {
            const prev = previousEntryDescriptors[i];
            if (
              prev
              && prev.transient === false
              && prev.slot === slotName
              && prev.kind === entryKind
              && prev.lang === entryLang
              && prev.text === entryText
            ) {
              reusableCompletedSurface = previousEntrySurfaces[i] || null;
              break;
            }
          }
        }
        const reuseSurface = (canReuseAsFinalization || canReuseDraftTranslation)
          ? partialSurfaceForSlot
          : reusableCompletedSurface;
        if (reuseSurface) {
          // Detach from its old wrapper and (for the finalization case
          // only) flush <span.static>/<span.fresh> children to plain
          // text. The completed-reuse case is already plain text and
          // doesn't need a children wipe — but a defensive wipe is
          // cheap and keeps the behaviour identical between branches.
          if (reuseSurface.parentNode) {
            reuseSurface.parentNode.removeChild(reuseSurface);
          }
          surface = reuseSurface;
          if (canReuseAsFinalization || canReuseDraftTranslation) {
            finalizedInPlaceCount += 1;
          }
          while (surface.firstChild) {
            surface.removeChild(surface.firstChild);
          }
          surface.className = `subtitle-line__surface subtitle-slot-${entry.style_slot} effect-none`;
          surface.dataset.slot = entry.style_slot || "source";
          surface.dataset.kind = entry.kind || "source";
          surface.dataset.row = String(rowIndex);
          surface.dataset.index = String(entryIndex);
          applyStyleMap(surface, buildCssVariables(lineStyle, stageScale));
          surface.textContent = entry.text;
          nextEntrySignatures.push(renderEntrySignature(entry));
          if (traceCallback) {
            const event = {
              type: "completed_frame",
              slot: entry.style_slot || "source",
              kind: entry.kind || "source",
              effect: "none",
              text_length: entryText.length,
              animated: false,
              finalized_in_place: Boolean(canReuseAsFinalization || canReuseDraftTranslation),
              text_patched: Boolean(
                canReuseDraftTranslation && lastPartialTextForSlot !== entryText
              ),
              reused_completed_surface: Boolean(reusableCompletedSurface && !canReuseAsFinalization),
            };
            traceFrameEvents.push(event);
            _safeEmit(traceCallback, event);
          }
        } else {
          surface = document.createElement("div");
          surface.className = `subtitle-line__surface subtitle-slot-${entry.style_slot} ${surfaceEffectClass}`;
          surface.dataset.slot = entry.style_slot || "source";
          surface.dataset.kind = entry.kind || "source";
          surface.dataset.row = String(rowIndex);
          surface.dataset.index = String(entryIndex);
          applyStyleMap(surface, buildCssVariables(lineStyle, stageScale));
          surface.textContent = entry.text;
          nextEntrySignatures.push(renderEntrySignature(entry));
          if (traceCallback) {
            const event = {
              type: "completed_frame",
              slot: entry.style_slot || "source",
              kind: entry.kind || "source",
              effect: String(slotEffect || "none"),
              text_length: entryText.length,
              animated: animateCompleted,
            };
            traceFrameEvents.push(event);
            _safeEmit(traceCallback, event);
          }
        }
      }
      content.appendChild(surface);
      nextEntrySurfaces.push(surface);
      nextEntryDescriptors.push({
        slot: entry.style_slot || "source",
        kind: entry.kind || "source",
        lang: entry.lang || "",
        transient: Boolean(entry.transient),
        text: String(entry.text || ""),
      });
    });

    row.appendChild(content);
    stage.appendChild(row);
  });

  wrapper.appendChild(stage);
  const keepSurfaces = new Set(nextEntrySurfaces);
  _releaseOrphanedSurfaces(previousEntrySurfaces, keepSurfaces);
  previousPartialSurfaceBySlot.forEach((surface) => {
    if (surface && !keepSurfaces.has(surface)) {
      _scrubSurfaceMetadata(surface);
    }
  });
  if (cachedWrapper && !keepSurfaces.has(cachedWrapper) && cachedWrapper !== wrapper) {
    _scrubSurfaceMetadata(cachedWrapper);
  }
  if (typeof container.replaceChildren === "function") {
    container.replaceChildren(wrapper);
  } else {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(wrapper);
  }
  const renderFinishedAt = (typeof performance !== "undefined" && performance && typeof performance.now === "function")
    ? performance.now()
    : Date.now();
  const slowPathRows = Array.from(stage.querySelectorAll(".subtitle-line"));
  container.__subtitleStyleRenderState = {
    entrySignatures: nextEntrySignatures,
    partialBySlot: Object.fromEntries(nextPartialBySlot.entries()),
    partialSurfaceBySlot: _persistPartialSurfaceBySlot(nextPartialSurfaceBySlot),
    entrySurfaces: _surfaceRefsFromElements(nextEntrySurfaces),
    entryDescriptors: nextEntryDescriptors,
    shapeSignature,
    wrapper: _surfaceRefFor(wrapper),
    stage: _surfaceRefFor(stage),
    rowElements: _surfaceRefsFromElements(slowPathRows),
    lastRenderedAt: renderFinishedAt,
  };
  if (traceCallback) {
    const anomalies = [];
    // Detect the common "fresh suffix is most of the line because the ASR
    // back-end revised its hypothesis" case — this is the dominant cause of
    // visible flicker when the renderer otherwise looks healthy.
    traceFrameEvents.forEach((event) => {
      if (event.type !== "partial_frame") {
        return;
      }
      if (event.transition === "revision" || event.transition === "jump") {
        anomalies.push({
          kind: "partial_revision",
          slot: event.slot,
          transition: event.transition,
          shared_length: event.shared_length,
          fresh_chars: event.fresh_chars,
          previous_text_length: event.previous_text_length,
          current_text_length: event.current_text_length,
        });
      }
    });
    if (!hadPriorRenderState && partialEntryCount > 0) {
      anomalies.push({
        kind: "state_carryover_missing",
        partial_entries: partialEntryCount,
        detail: "Container had no prior __subtitleStyleRenderState when a partial entry was rendered — the previous-text prefix is unavailable, so the whole partial will animate.",
      });
    }
    const summary = {
      type: "render_summary",
      overlay: Boolean(options?.overlay),
      rows: rows.length,
      partial_entries: partialEntryCount,
      completed_entries: completedEntryCount,
      reused_partial_surfaces: reusedPartialSurfaceCount,
      finalized_in_place: finalizedInPlaceCount,
      state_carryover: hadPriorRenderState,
      fast_path: false,
      shape_signature: shapeSignature,
      previous_shape_signature: previousShape,
      ms_since_last_render: lastRenderedAt !== null ? Math.max(0, renderStartedAt - lastRenderedAt) : null,
      render_duration_ms: Math.max(0, renderFinishedAt - renderStartedAt),
      anomalies,
    };
    _safeEmit(traceCallback, summary);
  }
  return {
    empty: rows.length === 0,
    rowCount: rows.length,
    effectiveStyle,
    rows,
  };
}
