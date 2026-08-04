import {
  OVERLAY_DENSE_PARTIAL_CHARS,
  OVERLAY_MAX_ANIMATED_DELTA_CHARS,
} from "./constants.js";
import { effectClassName } from "./css-vars.js";

// Compute the longest character prefix two strings share. Used to split a
// growing partial subtitle into "already-shown static prefix" and "freshly
// appended characters that should run the chosen effect" — the existing
// prefix must remain visually static across partial frames.
// Advances by Unicode code points so surrogate pairs (emoji) are never split.
export function commonPrefixLength(current, previous) {
  const cur = String(current || "");
  const prev = String(previous || "");
  const limit = Math.min(cur.length, prev.length);
  let index = 0;
  while (index < limit) {
    const c1 = cur.charCodeAt(index);
    const c2 = prev.charCodeAt(index);
    if (c1 !== c2) {
      break;
    }
    if (c1 >= 0xd800 && c1 <= 0xdbff) {
      if (index + 1 >= limit) {
        break;
      }
      if (cur.charCodeAt(index + 1) !== prev.charCodeAt(index + 1)) {
        break;
      }
      index += 2;
      continue;
    }
    index += 1;
  }
  return index;
}

// Classify a partial-frame transition between two consecutive partial texts
// so the debug trace (and downstream flicker heuristics) can distinguish
// healthy typewriter extensions from disruptive recogniser revisions.
// Values:
//   "initial"   - previous text was empty (first partial of a phrase)
//   "identical" - text unchanged across frames (no fresh chars)
//   "extension" - current text starts with previous text (pure append)
//   "shrink"    - current text is a strict prefix of previous text (rollback)
//   "revision"  - current text shares a non-empty prefix but is not a
//                 simple extension/shrink (recogniser changed mid-word)
//   "jump"      - current and previous share no prefix (full replacement)
export function classifyPartialTransition(currentText, previousText, sharedLength) {
  if (!previousText) {
    return "initial";
  }
  if (currentText === previousText) {
    return "identical";
  }
  if (sharedLength === previousText.length) {
    return "extension";
  }
  if (sharedLength === currentText.length && currentText.length < previousText.length) {
    return "shrink";
  }
  if (sharedLength === 0) {
    return "jump";
  }
  return "revision";
}

/** OBS Browser Source paint policy (also used by dashboard live preview). */
export function usesObsPaintPolicy(options) {
  return Boolean(options?.overlay || options?.obsPaintPolicy);
}

export function resolveFreshFragmentEffect(slotEffect, options, deltaLength, transition) {
  let base = String(slotEffect || "none");
  if (base === "none") {
    return "none";
  }
  if (!usesObsPaintPolicy(options)) {
    return base;
  }
  // First paint / full replacement must keep the configured effect — ASR's first
  // partial is often >12 chars, and skipping it made fade/blur_in/glow invisible.
  // Cap only mid-phrase typing bursts (extension/revision/shrink).
  const phraseEntrance = transition === "initial" || transition === "jump";
  if (!phraseEntrance && deltaLength > OVERLAY_MAX_ANIMATED_DELTA_CHARS) {
    return "none";
  }
  return base;
}

export function _transientSurfaceClassName(entry, options) {
  const slot = entry.style_slot || "source";
  const base = `subtitle-line__surface subtitle-slot-${slot} effect-none`;
  if (usesObsPaintPolicy(options) && String(entry.text || "").length >= OVERLAY_DENSE_PARTIAL_CHARS) {
    return `${base} is-dense-partial`;
  }
  return base;
}

// Commit the animated fresh suffix into the static prefix via append-only
// merge (O(delta) not O(total)). This is the unified streaming-text pattern
// used by LLM chat UIs: never rewrite the committed prefix on extension.
export function mergeFreshIntoStatic(surface) {
  const staticSpan = surface.querySelector(".subtitle-fragment-static");
  const freshSpan = surface.querySelector(".subtitle-fragment-fresh");
  if (!staticSpan || !freshSpan) {
    return;
  }
  const freshText = freshSpan.textContent || "";
  if (freshText) {
    staticSpan.append(freshText);
  }
  if (freshSpan.parentNode === surface) {
    surface.removeChild(freshSpan);
  }
}

export function appendFreshFragment(surface, delta, slotEffect, options, transition) {
  if (!delta) {
    return "none";
  }
  const resolvedEffect = resolveFreshFragmentEffect(
    slotEffect,
    options,
    delta.length,
    transition
  );
  const freshSpan = document.createElement("span");
  freshSpan.className = `subtitle-fragment-fresh ${effectClassName(resolvedEffect)}`;
  freshSpan.textContent = delta;
  surface.appendChild(freshSpan);
  return resolvedEffect;
}

export function appendTransientFragments(surface, entry, slotEffect, previousPartialText, options) {
  const currentText = String(entry.text || "");
  const sharedLength = commonPrefixLength(currentText, previousPartialText);
  const staticPart = currentText.slice(0, sharedLength);
  const freshPart = currentText.slice(sharedLength);
  const transition = classifyPartialTransition(
    currentText,
    String(previousPartialText || ""),
    sharedLength
  );
  // Always create the static span — even when empty on the very first
  // partial — so the next pure-extension frame can reuse this surface
  // via updateTransientSurfaceInPlace() instead of falling back to a
  // full DOM rebuild. The empty span has no animation and zero layout
  // impact; without it the in-place reuse fast-path was unreachable on
  // the second partial of every utterance, which produced the
  // "sometimes flickers" symptom reported against v0.4.2.
  const staticSpan = document.createElement("span");
  staticSpan.className = "subtitle-fragment-static";
  staticSpan.textContent = staticPart;
  surface.appendChild(staticSpan);
  const resolvedEffect = appendFreshFragment(
    surface,
    freshPart,
    slotEffect,
    options,
    transition
  );
  if (options && typeof options.onTrace === "function") {
    try {
      options.onTrace({
        slot: entry.style_slot || "source",
        kind: entry.kind || "source",
        transient: true,
        effect: String(resolvedEffect || slotEffect || "none"),
        current_text_length: currentText.length,
        previous_text_length: String(previousPartialText || "").length,
        shared_length: sharedLength,
        static_chars: staticPart.length,
        fresh_chars: freshPart.length,
        transition,
      });
    } catch (_error) {
      // Tracing must never break rendering.
    }
  }
}

// Debug tracing hook: callers may pass `options.onRenderTrace = (event) => void`
// (or `options.debugTrace`) to receive structured per-frame diagnostics. The
// renderer emits three event types:
//   { type: "partial_frame", slot, transition, shared_length, static_chars,
//     fresh_chars, current_text_length, previous_text_length, effect }
//   { type: "completed_frame", slot, text_length, effect, animated }
//   { type: "render_summary", rows, partial_entries, completed_entries,
//     state_carryover, ms_since_last_render, anomalies }
// Anomalies array currently flags partial frames where transition is
// "revision" or "jump" (most common cause of visible flicker when the ASR
// back-end revises its hypothesis mid-utterance), and frames where the
// per-container state was unexpectedly lost between calls.
export function _resolveTraceCallback(options) {
  if (!options) {
    return null;
  }
  const candidate = options.onRenderTrace || options.debugTrace || null;
  return typeof candidate === "function" ? candidate : null;
}

export function _safeEmit(trace, event) {
  if (!trace) {
    return;
  }
  try {
    trace(event);
  } catch (_error) {
    // Tracing must never break rendering.
  }
}

// Unified in-place partial updater: append-only static prefix + animated
// fresh delta. Same code path for all text lengths; OBS overlay only skips
// animation on large per-frame bursts (see resolveFreshFragmentEffect).
//
// On pure extension: commit the previous fresh suffix into static via append
// (O(δ) not O(n)), then mount a new fresh span for the frame delta only.
// Revision/jump returns false so the caller rebuilds fragments in-place.
export function updateTransientSurfaceInPlace(surface, entry, slotEffect, previousText, options) {
  const currentText = String(entry.text || "");
  if (currentText === previousText) {
    return true;
  }
  const sharedLength = commonPrefixLength(currentText, previousText);
  const isPureExtension =
    previousText.length > 0 && sharedLength === previousText.length;
  if (!isPureExtension) {
    return false;
  }
  let staticSpan = surface.querySelector(".subtitle-fragment-static");
  if (!staticSpan) {
    return false;
  }
  mergeFreshIntoStatic(surface);
  staticSpan = surface.querySelector(".subtitle-fragment-static");
  if (!staticSpan) {
    return false;
  }
  const delta = currentText.slice(previousText.length);
  const transition = classifyPartialTransition(currentText, previousText, sharedLength);
  const resolvedEffect = appendFreshFragment(
    surface,
    delta,
    slotEffect,
    options,
    transition
  );
  if (options && typeof options.onTrace === "function") {
    try {
      options.onTrace({
        slot: entry.style_slot || "source",
        kind: entry.kind || "source",
        transient: true,
        effect: String(resolvedEffect || slotEffect || "none"),
        current_text_length: currentText.length,
        previous_text_length: previousText.length,
        shared_length: sharedLength,
        static_chars: staticSpan.textContent?.length || 0,
        fresh_chars: delta.length,
        transition,
        reused_surface: true,
      });
    } catch (_error) {
      // Tracing must never break rendering.
    }
  }
  return true;
}
