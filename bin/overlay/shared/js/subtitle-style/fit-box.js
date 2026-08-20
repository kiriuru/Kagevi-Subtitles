import { _derefSurfaceRef } from "./render-state.js";

export const FIT_SAFETY_PX = 4;
export const FIT_MIN_VIEWPORT_PX = 8;
export const OVERFLOW_SCROLL_PX_PER_SEC = 48;
export const OVERFLOW_PAUSE_AT_BOTTOM_MS = 1600;
export const OVERFLOW_PAUSE_AT_TOP_MS = 1200;

/**
 * Keep designed font sizes. The stacked block sits on the top of the OBS
 * box and grows downward. Each physical line (source + up to 4 translations)
 * ping-pong scrolls inside its own slot when that line is taller than its share.
 */
export function computeOverflowPx(input) {
  const availableHeight = Number(input?.availableHeight);
  const contentHeight = Number(input?.contentHeight);
  if (
    !Number.isFinite(availableHeight)
    || availableHeight < FIT_MIN_VIEWPORT_PX
    || !Number.isFinite(contentHeight)
    || contentHeight <= 0
  ) {
    return 0;
  }
  return Math.max(0, Math.ceil(contentHeight - availableHeight));
}

/**
 * Split the OBS box among 1–N lines. Lines that fit keep their natural height;
 * leftover space is shared equally by the overflowing ones.
 */
export function allocateLineViewports(availableHeight, naturalHeights, gapPx) {
  const heights = (Array.isArray(naturalHeights) ? naturalHeights : []).map((h) => Math.max(0, Number(h) || 0));
  const n = heights.length;
  if (n === 0) {
    return [];
  }
  const gap = Math.max(0, Number(gapPx) || 0);
  const budget = Math.max(0, Number(availableHeight) || 0) - Math.max(0, n - 1) * gap;
  if (budget <= 0) {
    return heights.map((h) => ({
      height: 0,
      overflowPx: computeOverflowPx({ availableHeight: 0, contentHeight: h }),
    }));
  }
  const total = heights.reduce((sum, h) => sum + h, 0);
  if (total <= budget) {
    return heights.map((h) => ({ height: h, overflowPx: 0 }));
  }

  const allocated = new Array(n).fill(0);
  const frozen = new Array(n).fill(false);
  let remainingBudget = budget;
  let remainingCount = n;
  let progressed = true;
  while (progressed && remainingCount > 0) {
    progressed = false;
    const share = remainingBudget / remainingCount;
    for (let i = 0; i < n; i += 1) {
      if (frozen[i] || heights[i] > share) {
        continue;
      }
      allocated[i] = heights[i];
      frozen[i] = true;
      remainingBudget -= heights[i];
      remainingCount -= 1;
      progressed = true;
    }
  }
  const overflowShare = remainingCount > 0 ? remainingBudget / remainingCount : 0;
  for (let i = 0; i < n; i += 1) {
    if (!frozen[i]) {
      allocated[i] = Math.max(0, overflowShare);
    }
  }
  return allocated.map((height, i) => ({
    height,
    overflowPx: computeOverflowPx({ availableHeight: height, contentHeight: heights[i] }),
  }));
}

export function stepOverflowScroll(state, dtMs) {
  const overflowPx = Math.max(0, Number(state?.overflowPx) || 0);
  const dt = Math.max(0, Number(dtMs) || 0);
  if (overflowPx <= 0) {
    return {
      overflowPx: 0,
      scrollY: 0,
      phase: "bottom-pause",
      phaseAt: 0,
    };
  }
  let scrollY = Number(state?.scrollY) || 0;
  let phase = String(state?.phase || "bottom-pause");
  let phaseAt = Math.max(0, Number(state?.phaseAt) || 0) + dt;
  const delta = OVERFLOW_SCROLL_PX_PER_SEC * (dt / 1000);

  if (phase === "bottom-pause") {
    scrollY = 0;
    if (phaseAt >= OVERFLOW_PAUSE_AT_BOTTOM_MS) {
      phase = "to-top";
      phaseAt = 0;
    }
  } else if (phase === "to-top") {
    scrollY = Math.min(overflowPx, scrollY + delta);
    if (scrollY >= overflowPx) {
      scrollY = overflowPx;
      phase = "top-pause";
      phaseAt = 0;
    }
  } else if (phase === "top-pause") {
    scrollY = overflowPx;
    if (phaseAt >= OVERFLOW_PAUSE_AT_TOP_MS) {
      phase = "to-bottom";
      phaseAt = 0;
    }
  } else {
    scrollY = Math.max(0, scrollY - delta);
    if (scrollY <= 0) {
      scrollY = 0;
      phase = "bottom-pause";
      phaseAt = 0;
    }
  }

  return {
    overflowPx,
    scrollY: Number(scrollY.toFixed(2)),
    phase,
    phaseAt,
  };
}

function applyScrollVar(target, scrollY) {
  if (!target || !target.style) {
    return;
  }
  const next = `${Number(scrollY) || 0}px`;
  if (target.style.getPropertyValue("--overlay-scroll-y") !== next) {
    target.style.setProperty("--overlay-scroll-y", next);
  }
}

function applyLineScroll(target, scrollY) {
  // Positive engine offset (0 = start of line). CSS translateY must be negative
  // so the line crawls upward toward the latest wrapped text.
  applyScrollVar(target, -Math.max(0, Number(scrollY) || 0));
}

function lineElements(shell) {
  if (!shell || typeof shell.querySelectorAll !== "function") {
    return [];
  }
  return Array.from(shell.querySelectorAll(".subtitle-line"));
}

function scrollTargetFor(el) {
  if (!el) {
    return null;
  }
  return (typeof el.querySelector === "function" && el.querySelector(".subtitle-line__content")) || el;
}

function measureHeight(el) {
  if (!el) {
    return 0;
  }
  return Math.max(Number(el.scrollHeight) || 0, Number(el.offsetHeight) || 0);
}

function readGapPx(stage) {
  if (!stage) {
    return 0;
  }
  if (typeof getComputedStyle === "function") {
    const computed = getComputedStyle(stage);
    const parsed = [computed.gap, computed.rowGap]
      .map((value) => {
        if (!value || value === "normal") {
          return null;
        }
        const n = parseFloat(value);
        return Number.isFinite(n) && n >= 0 ? n : null;
      })
      .find((n) => n !== null && n !== undefined);
    if (parsed !== undefined) {
      return parsed;
    }
  }
  const fromVar = parseFloat(stage.style?.getPropertyValue?.("--subtitle-line-gap") || "");
  return Number.isFinite(fromVar) && fromVar >= 0 ? fromVar : 0;
}

function unclipLine(line) {
  if (!line) {
    return;
  }
  line.classList.remove("is-overlay-line-clip");
  if (line.style) {
    line.style.removeProperty("--overlay-line-height");
    line.style.removeProperty("--overlay-scroll-y");
  }
  const target = scrollTargetFor(line);
  if (target && target !== line && target.style) {
    target.style.removeProperty("--overlay-scroll-y");
  }
}

export function clearOverlayFit(shell) {
  if (shell && shell.style) {
    shell.style.removeProperty("--overlay-scroll-y");
    shell.style.removeProperty("--overlay-fit-scale");
    shell.style.removeProperty("--overlay-fit-origin");
  }
  lineElements(shell).forEach((line) => {
    unclipLine(line);
  });
}

function lineKey(line, index) {
  const slot = line && line.dataset ? String(line.dataset.slot || "").trim() : "";
  return slot || `row-${index}`;
}

const overflowController = {
  viewport: null,
  shell: null,
  lines: [],
  raf: 0,
  lastTs: 0,
  running: false,
};

function stopOverflowRaf() {
  overflowController.running = false;
  if (overflowController.raf && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(overflowController.raf);
  }
  overflowController.raf = 0;
  overflowController.lastTs = 0;
}

function tickOverflowScroll(ts) {
  overflowController.raf = 0;
  const shell = overflowController.shell;
  const lines = overflowController.lines || [];
  if (!overflowController.running || !shell || !shell.isConnected) {
    overflowController.running = false;
    lines.forEach((line) => {
      line.scrollY = 0;
      line.phase = "bottom-pause";
      line.phaseAt = 0;
      applyLineScroll(line.content, 0);
    });
    return;
  }
  const lastTs = overflowController.lastTs;
  overflowController.lastTs = ts;
  const dt = lastTs ? Math.min(48, Math.max(0, ts - lastTs)) : 16;
  let anyOverflow = false;
  lines.forEach((line) => {
    if (!line.content || (line.viewport && !line.viewport.isConnected)) {
      return;
    }
    const next = stepOverflowScroll(line, dt);
    line.overflowPx = next.overflowPx;
    line.scrollY = next.scrollY;
    line.phase = next.phase;
    line.phaseAt = next.phaseAt;
    applyLineScroll(line.content, next.scrollY);
    if (next.overflowPx > 0) {
      anyOverflow = true;
    }
  });
  if (!anyOverflow) {
    overflowController.running = false;
    return;
  }
  if (typeof requestAnimationFrame === "function") {
    overflowController.raf = requestAnimationFrame(tickOverflowScroll);
  }
}

function startOverflowRaf() {
  if (overflowController.running || typeof requestAnimationFrame !== "function") {
    return;
  }
  overflowController.running = true;
  overflowController.lastTs = 0;
  overflowController.raf = requestAnimationFrame(tickOverflowScroll);
}

export function stopOverlayOverflowScroll(shell) {
  if (shell && overflowController.shell && overflowController.shell !== shell) {
    clearOverlayFit(shell);
    return;
  }
  stopOverflowRaf();
  const active = overflowController.shell;
  overflowController.viewport = null;
  overflowController.shell = null;
  overflowController.lines = [];
  clearOverlayFit(active);
  if (shell && shell !== active) {
    clearOverlayFit(shell);
  }
}

function buildLineStates(shell, availableHeight, previousLines) {
  const rows = lineElements(shell);
  const targets = rows.length > 0 ? rows : [shell];
  const stage = typeof shell.querySelector === "function" ? shell.querySelector(".subtitle-stage") : null;
  const gapPx = rows.length > 1 ? readGapPx(stage) : 0;
  const prevByKey = new Map((previousLines || []).map((line) => [line.key, line]));

  targets.forEach((el) => {
    if (el !== shell) {
      unclipLine(el);
    }
  });

  const naturalHeights = targets.map((el) => measureHeight(el === shell ? el : scrollTargetFor(el) || el));
  const allocated = allocateLineViewports(availableHeight, naturalHeights, gapPx);

  return targets.map((el, index) => {
    const alloc = allocated[index] || { height: 0, overflowPx: 0 };
    const key = el === shell ? "shell" : lineKey(el, index);
    const content = el === shell ? el : scrollTargetFor(el);
    const prev = prevByKey.get(key);
    if (el !== shell) {
      if (alloc.overflowPx > 0) {
        el.classList.add("is-overlay-line-clip");
        el.style.setProperty("--overlay-line-height", `${Math.ceil(alloc.height)}px`);
      } else {
        unclipLine(el);
      }
    }
    const overflowPx = alloc.overflowPx;
    const scrollY = prev && overflowPx > 0 ? Math.min(Number(prev.scrollY) || 0, overflowPx) : 0;
    const phase = prev && overflowPx > 0 ? String(prev.phase || "bottom-pause") : "bottom-pause";
    const phaseAt = prev && overflowPx > 0 ? Math.max(0, Number(prev.phaseAt) || 0) : 0;
    applyLineScroll(content, scrollY);
    return {
      key,
      viewport: el,
      content,
      overflowPx,
      scrollY,
      phase,
      phaseAt,
    };
  });
}

export function applyOverlayOverflow(options) {
  const viewport = options?.viewport;
  const shell = options?.shell;
  const enabled = options?.enabled !== false;
  if (!enabled || !viewport || !shell) {
    if (shell) {
      clearOverlayFit(shell);
    }
    if (overflowController.shell === shell) {
      stopOverlayOverflowScroll();
    }
    return 0;
  }
  const availableHeight = Math.max(0, Number(viewport.clientHeight) - FIT_SAFETY_PX);
  if (overflowController.shell && overflowController.shell !== shell) {
    clearOverlayFit(overflowController.shell);
  }
  overflowController.viewport = viewport;
  overflowController.shell = shell;
  overflowController.lines = buildLineStates(shell, availableHeight, overflowController.lines);
  const totalOverflow = overflowController.lines.reduce((sum, line) => sum + (line.overflowPx || 0), 0);
  if (totalOverflow <= 0) {
    stopOverflowRaf();
    return 0;
  }
  startOverflowRaf();
  return totalOverflow;
}

export function applyOverlayFitToContainer(container, options) {
  if (!container) {
    return 0;
  }
  const state = container.__subtitleStyleRenderState || {};
  const wrapper = _derefSurfaceRef(state.wrapper)
    || container.querySelector(".subtitle-stage-shell");
  if (!wrapper) {
    return Number.isFinite(state.overflowPx) ? state.overflowPx : 0;
  }
  if (options?.fitToBox === false || state.fitToBoxEnabled === false) {
    clearOverlayFit(wrapper);
    if (overflowController.shell === wrapper) {
      stopOverlayOverflowScroll();
    }
    if (container.__subtitleStyleRenderState) {
      container.__subtitleStyleRenderState.overflowPx = 0;
      container.__subtitleStyleRenderState.fitToBoxEnabled = false;
    }
    return 0;
  }
  const overflowPx = applyOverlayOverflow({
    viewport: container,
    shell: wrapper,
    enabled: true,
  });
  if (container.__subtitleStyleRenderState) {
    container.__subtitleStyleRenderState.overflowPx = overflowPx;
    container.__subtitleStyleRenderState.fitToBoxEnabled = true;
  }
  return overflowPx;
}
