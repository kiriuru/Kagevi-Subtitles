// Build a layout fingerprint that is stable across pure-extension partial
// frames but changes whenever the *shape* of the render does — different
// row count, different slot composition, or a transient ↔ completed switch.
// Completed text is omitted so late MT / supersession patches stay on the
// fast path. When two consecutive renders share the same shape, we keep the
// existing wrapper/stage/row/content DOM nodes and only mutate the per-entry
// surfaces in place. That eliminates the wipe that was repainting the whole
// subtitle container on every keystroke and producing the v0.4.2 flicker.
export function _shapeSignatureForEntry(entry) {
  if (entry.transient) {
    return [
      "T",
      entry.style_slot || "source",
      entry.kind || "source",
      entry.lang || "",
    ].join(":");
  }
  return [
    "C",
    entry.style_slot || "source",
    entry.kind || "source",
    entry.lang || "",
  ].join(":");
}

export function _shapeSignatureForRows(rows, layoutPreset, compact, overlay) {
  const layoutTag = `${layoutPreset || "stacked"}|${compact ? "c" : "_"}|${overlay ? "o" : "_"}`;
  if (!rows.length) {
    return `0||${layoutTag}`;
  }
  const rowSigs = rows.map((rowConfig) => {
    const entrySigs = (rowConfig.entries || []).map(_shapeSignatureForEntry).join(",");
    return `${rowConfig.rowSlot || "source"}/${entrySigs}`;
  });
  return `${rows.length}||${rowSigs.join("|")}||${layoutTag}`;
}

// Apply the style map only when one of its values actually changed. CSS
// variable writes that match the current value are still treated as
// attribute mutations by some engines and can invalidate the parent
// container's style cache — when the fast-path is updating a still-running
// partial we want to touch as little as possible.
export function _applyStyleMapIfChanged(element, styleMap) {
  if (!element || !styleMap) {
    return;
  }
  const current = element.__sstAppliedStyleMap || {};
  let changed = false;
  Object.entries(styleMap).forEach(([key, value]) => {
    if (current[key] !== value) {
      element.style.setProperty(key, value);
      current[key] = value;
      changed = true;
    }
  });
  if (changed) {
    element.__sstAppliedStyleMap = current;
  }
}

export function _setClassNameIfChanged(element, className) {
  if (!element) {
    return;
  }
  if (element.className !== className) {
    element.className = className;
  }
}

const WEAKREF_SUPPORTED = typeof WeakRef === "function";

export function _surfaceRefFor(element) {
  if (!element || element.nodeType !== 1) {
    return null;
  }
  return WEAKREF_SUPPORTED ? new WeakRef(element) : element;
}

export function _derefSurfaceRef(ref) {
  if (!ref) {
    return null;
  }
  if (WEAKREF_SUPPORTED && ref instanceof WeakRef) {
    return ref.deref() || null;
  }
  return ref && ref.nodeType === 1 ? ref : null;
}

export function _derefSurfaceList(refs) {
  if (!Array.isArray(refs)) {
    return null;
  }
  const surfaces = [];
  refs.forEach((ref) => {
    const surface = _derefSurfaceRef(ref);
    if (surface) {
      surfaces.push(surface);
    }
  });
  return surfaces;
}

export function _surfaceRefsFromElements(elements) {
  if (!Array.isArray(elements)) {
    return [];
  }
  return elements.map((element) => _surfaceRefFor(element)).filter(Boolean);
}

export function _readPartialSurfaceBySlot(rawPartial) {
  const map = new Map();
  if (rawPartial instanceof Map) {
    rawPartial.forEach((ref, slot) => {
      const surface = _derefSurfaceRef(ref);
      if (surface) {
        map.set(slot, surface);
      }
    });
    return map;
  }
  if (rawPartial && typeof rawPartial === "object") {
    Object.entries(rawPartial).forEach(([slot, ref]) => {
      const surface = _derefSurfaceRef(ref);
      if (surface) {
        map.set(slot, surface);
      }
    });
  }
  return map;
}

export function _persistPartialSurfaceBySlot(partialSurfaceBySlot) {
  const persisted = {};
  partialSurfaceBySlot.forEach((surface, slot) => {
    const ref = _surfaceRefFor(surface);
    if (ref) {
      persisted[slot] = ref;
    }
  });
  return persisted;
}

export function _scrubSurfaceMetadata(surface) {
  if (!surface || surface.nodeType !== 1) {
    return;
  }
  delete surface.__sstAppliedStyleMap;
}

// Drop renderer-owned metadata from surfaces that will not be carried into
// the next frame. DOM nodes detached by `innerHTML = ""` are GC-eligible once
// we stop holding them in `__subtitleStyleRenderState` (WeakRef when supported).
export function _releaseOrphanedSurfaces(surfaceList, keepSet) {
  if (!Array.isArray(surfaceList)) {
    return;
  }
  const keep = keepSet || new Set();
  surfaceList.forEach((surface) => {
    if (!surface || keep.has(surface)) {
      return;
    }
    _scrubSurfaceMetadata(surface);
  });
}

export function _releaseAllSurfacesFromRenderState(state) {
  if (!state || typeof state !== "object") {
    return;
  }
  const keep = new Set();
  _releaseOrphanedSurfaces(_derefSurfaceList(state.entrySurfaces), keep);
  _readPartialSurfaceBySlot(state.partialSurfaceBySlot).forEach((surface) => {
    if (!keep.has(surface)) {
      _scrubSurfaceMetadata(surface);
    }
  });
  const wrapper = _derefSurfaceRef(state.wrapper);
  if (wrapper) {
    _scrubSurfaceMetadata(wrapper);
  }
}

export function disposeRenderContainer(container) {
  if (!container) {
    return;
  }
  _releaseAllSurfacesFromRenderState(container.__subtitleStyleRenderState);
  delete container.__subtitleStyleRenderState;
  if (typeof container.replaceChildren === "function") {
    container.replaceChildren();
    return;
  }
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}

// Decide whether the new render is *just a finalization* of the previous
// render: every entry is in the same position with the same slot/kind/lang
// as last frame, and the only change is that one or more transient entries
// have flipped to completed with text matching what was last shown as a
// partial. In this case we can keep the existing wrapper/stage/row/content
// DOM nodes — and, critically, reuse the partial surface element by simply
// consolidating its `<span.static>...</span><span.fresh>...</span>` children
// into plain text. No surface-level animation fires (the text was already
// visible to the user), and no `container.innerHTML = ""` wipe happens.
// This is the dominant finalization shape in practice: translations arrive
// in a *later* frame (which falls through to the slow path because the row
// count actually changes), so source finalization frames are
// finalization-compatible.
export function _shapeLayoutTag(shapeSignature) {
  if (typeof shapeSignature !== "string" || !shapeSignature) {
    return null;
  }
  const parts = shapeSignature.split("||");
  return parts.length >= 2 ? parts[parts.length - 1] : null;
}

export function _canFastPathFinalize(rows, previousDescriptors, previousPartialBySlot) {
  if (!Array.isArray(previousDescriptors) || rows.length === 0) {
    return false;
  }
  let totalEntries = 0;
  for (const rowConfig of rows) {
    totalEntries += (rowConfig.entries || []).length;
  }
  if (totalEntries !== previousDescriptors.length) {
    return false;
  }
  let idx = 0;
  for (const rowConfig of rows) {
    for (const entry of (rowConfig.entries || [])) {
      const prev = previousDescriptors[idx];
      idx += 1;
      if (!prev) {
        return false;
      }
      const slot = entry.style_slot || "source";
      const kind = entry.kind || "source";
      const lang = entry.lang || "";
      const text = String(entry.text || "");
      if (prev.slot !== slot || prev.kind !== kind || prev.lang !== lang) {
        return false;
      }
      if (prev.transient === Boolean(entry.transient)) {
        // Same transient state: completed text may differ (late MT / draft
        // finalize). Fast path patches textContent in place — do not bail.
      } else if (prev.transient && !entry.transient) {
        // T → C finalization. Only compatible if the completed text matches
        // what was last shown as a partial in this slot. If they differ,
        // the user would see the text mutate at finalize time — that's
        // exactly the kind of jump we want the slow path to handle (with
        // its built-in completion animation).
        const lastPartial = String(previousPartialBySlot.get(slot) || "");
        if (lastPartial !== text) {
          return false;
        }
      } else {
        // C → T transitions are not a finalization. Defer to slow path.
        return false;
      }
    }
  }
  return true;
}

// Convert a previously-transient surface into a completed surface IN PLACE.
// The surface DOM node is preserved (same identity, same children parent),
// its <span.static>/<span.fresh> children are replaced with a single text
// node, and the surface-level effect class is forced to `effect-none`
// because the text was already visible — playing the completion animation
// would just create the "full re-render" jump the user reported.
export function _finalizeTransientSurfaceInPlace(surface, entry, traceCallback) {
  const text = String(entry.text || "");
  while (surface.firstChild) {
    surface.removeChild(surface.firstChild);
  }
  surface.textContent = text;
  _setClassNameIfChanged(
    surface,
    `subtitle-line__surface subtitle-slot-${entry.style_slot} effect-none`
  );
  if (traceCallback) {
    try {
      traceCallback({
        type: "completed_frame",
        slot: entry.style_slot || "source",
        kind: entry.kind || "source",
        effect: "none",
        text_length: text.length,
        animated: false,
        finalized_in_place: true,
      });
    } catch (_error) {
      // Tracing must never break rendering.
    }
  }
}
