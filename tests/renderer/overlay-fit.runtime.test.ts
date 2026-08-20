import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { partialOnlyPayload, renderer, minimalStyle } from "./helpers";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function mockBox(
  el: HTMLElement,
  size: { clientWidth: number; clientHeight: number; scrollWidth?: number; scrollHeight?: number },
) {
  Object.defineProperty(el, "clientWidth", { configurable: true, get: () => size.clientWidth });
  Object.defineProperty(el, "clientHeight", { configurable: true, get: () => size.clientHeight });
  Object.defineProperty(el, "scrollWidth", {
    configurable: true,
    get: () => size.scrollWidth ?? size.clientWidth,
  });
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    get: () => size.scrollHeight ?? size.clientHeight,
  });
  Object.defineProperty(el, "offsetWidth", { configurable: true, get: () => size.scrollWidth ?? size.clientWidth });
  Object.defineProperty(el, "offsetHeight", {
    configurable: true,
    get: () => size.scrollHeight ?? size.clientHeight,
  });
}

describe("overlay overflow scroll", () => {
  let container: HTMLDivElement;

  afterEach(() => {
    renderer().stopOverlayOverflowScroll?.();
    if (container) {
      renderer().disposeRenderContainer(container);
      container.remove();
    }
  });

  it("reports overflow only when content is taller than the box", () => {
    const R = renderer();
    expect(R.computeOverflowPx?.({
      availableHeight: 600,
      contentHeight: 400,
    })).toBe(0);
    expect(R.computeOverflowPx?.({
      availableHeight: 600,
      contentHeight: 900,
    })).toBe(300);
    expect(R.computeOverflowPx?.({
      availableHeight: 0,
      contentHeight: 900,
    })).toBe(0);
  });

  it("starts at the bottom (latest text) then crawls to the top", () => {
    const R = renderer();
    const start = R.stepOverflowScroll?.(
      { overflowPx: 200, scrollY: 0, phase: "bottom-pause", phaseAt: 0 },
      1600,
    );
    expect(start?.phase).toBe("to-top");
    expect(start?.scrollY).toBe(0);
    const moving = R.stepOverflowScroll?.(
      { overflowPx: 200, scrollY: 0, phase: "to-top", phaseAt: 0 },
      1000,
    );
    expect(moving?.scrollY).toBe(48);
    const arrived = R.stepOverflowScroll?.(
      { overflowPx: 200, scrollY: 190, phase: "to-top", phaseAt: 0 },
      1000,
    );
    expect(arrived?.phase).toBe("top-pause");
    expect(arrived?.scrollY).toBe(200);
  });

  it("resets when content fits again", () => {
    const R = renderer();
    const next = R.stepOverflowScroll?.(
      { overflowPx: 0, scrollY: 80, phase: "to-top", phaseAt: 400 },
      16,
    );
    expect(next).toEqual({
      overflowPx: 0,
      scrollY: 0,
      phase: "bottom-pause",
      phaseAt: 0,
    });
  });

  it("writes a scroll offset on each overflowing overlay line", () => {
    const R = renderer();
    container = document.createElement("div");
    document.body.appendChild(container);
    mockBox(container, { clientWidth: 800, clientHeight: 600 });
    R.render(container, partialOnlyPayload("Hello"), { overlay: true });
    const line = container.querySelector(".subtitle-line") as HTMLElement | null;
    const content = container.querySelector(".subtitle-line__content") as HTMLElement | null;
    expect(line).toBeTruthy();
    expect(content).toBeTruthy();
    if (!line || !content) {
      return;
    }
    mockBox(line, { clientWidth: 800, clientHeight: 1200, scrollWidth: 800, scrollHeight: 1200 });
    mockBox(content, { clientWidth: 800, clientHeight: 1200, scrollWidth: 800, scrollHeight: 1200 });
    const overflow = R.applyOverlayOverflow?.({
      viewport: container,
      shell: container.querySelector(".subtitle-stage-shell"),
      enabled: true,
    });
    expect(overflow).toBeGreaterThan(0);
    expect(line.classList.contains("is-overlay-line-clip")).toBe(true);
    expect(content.style.getPropertyValue("--overlay-scroll-y")).toBe("0px");
  });

  it("does not scroll dashboard preview chrome", () => {
    const R = renderer();
    container = document.createElement("div");
    document.body.appendChild(container);
    mockBox(container, { clientWidth: 800, clientHeight: 200 });
    R.render(container, partialOnlyPayload("Hello"), { overlay: false });
    const shell = container.querySelector(".subtitle-stage-shell") as HTMLElement | null;
    const line = container.querySelector(".subtitle-line") as HTMLElement | null;
    expect(shell).toBeTruthy();
    expect(shell?.classList.contains("is-overlay-shell")).toBe(false);
    expect(line?.classList.contains("is-overlay-line-clip")).toBe(false);
    expect(shell?.style.getPropertyValue("--overlay-scroll-y")).toBe("");
  });

  it("schedules only one overflow ticker while one is already running", () => {
    const R = renderer();
    const queued: FrameRequestCallback[] = [];
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCaf = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      queued.push(cb);
      return queued.length;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
    container = document.createElement("div");
    document.body.appendChild(container);
    mockBox(container, { clientWidth: 800, clientHeight: 600 });
    try {
      const shell = document.createElement("div");
      container.appendChild(shell);
      mockBox(shell, { clientWidth: 800, clientHeight: 1200, scrollWidth: 800, scrollHeight: 1200 });
      expect(R.applyOverlayOverflow?.({ viewport: container, shell, enabled: true })).toBeGreaterThan(0);
      expect(queued).toHaveLength(1);
      expect(R.applyOverlayOverflow?.({ viewport: container, shell, enabled: true })).toBeGreaterThan(0);
      expect(queued).toHaveLength(1);
      queued[0](16);
      expect(queued).toHaveLength(2);
      R.applyOverlayOverflow?.({ viewport: container, shell, enabled: true });
      expect(queued).toHaveLength(2);
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCaf;
    }
  });

  it("does not stop overlay scroll when dashboard preview renders", () => {
    const R = renderer();
    container = document.createElement("div");
    const preview = document.createElement("div");
    document.body.appendChild(container);
    document.body.appendChild(preview);
    mockBox(container, { clientWidth: 800, clientHeight: 600 });
    mockBox(preview, { clientWidth: 800, clientHeight: 200 });
    R.render(container, partialOnlyPayload("Hello"), { overlay: true });
    const overlayShell = container.querySelector(".subtitle-stage-shell") as HTMLElement | null;
    const content = container.querySelector(".subtitle-line__content") as HTMLElement | null;
    const line = container.querySelector(".subtitle-line") as HTMLElement | null;
    expect(overlayShell).toBeTruthy();
    expect(content).toBeTruthy();
    if (!overlayShell || !content || !line) {
      preview.remove();
      return;
    }
    mockBox(line, { clientWidth: 800, clientHeight: 1200, scrollWidth: 800, scrollHeight: 1200 });
    mockBox(content, { clientWidth: 800, clientHeight: 1200, scrollWidth: 800, scrollHeight: 1200 });
    expect(R.applyOverlayOverflow?.({
      viewport: container,
      shell: overlayShell,
      enabled: true,
    })).toBeGreaterThan(0);
    expect(content.style.getPropertyValue("--overlay-scroll-y")).toBe("0px");
    R.render(preview, partialOnlyPayload("Preview"), { overlay: false });
    expect(content.style.getPropertyValue("--overlay-scroll-y")).toBe("0px");
    preview.remove();
  });

  it("gives a single line the full box and splits leftover across overflowing lines", () => {
    const R = renderer();
    expect(R.allocateLineViewports?.(600, [900], 8)).toEqual([
      { height: 600, overflowPx: 300 },
    ]);
    const five = R.allocateLineViewports?.(500, [40, 40, 400, 400, 400], 10);
    expect(five).toHaveLength(5);
    expect(five?.[0]).toEqual({ height: 40, overflowPx: 0 });
    expect(five?.[1]).toEqual({ height: 40, overflowPx: 0 });
    expect(five?.[2]?.overflowPx).toBeGreaterThan(0);
    expect(five?.[2]?.height).toBeCloseTo(380 / 3, 5);
    expect(five?.[3]?.height).toBeCloseTo(380 / 3, 5);
    expect(five?.[4]?.height).toBeCloseTo(380 / 3, 5);
  });

  it("scrolls stacked overlay lines independently", () => {
    const R = renderer();
    container = document.createElement("div");
    document.body.appendChild(container);
    mockBox(container, { clientWidth: 800, clientHeight: 200 });
    R.render(container, {
      preset: "stacked",
      compact: false,
      lifecycle_state: "completed_only",
      completed_block_visible: true,
      show_source: true,
      show_translations: true,
      visible_items: [
        { kind: "source", text: "Source line", style_slot: "source" },
        { kind: "translation", text: "Translation one", style_slot: "translation_1" },
        { kind: "translation", text: "Translation two", style_slot: "translation_2" },
      ],
      style: minimalStyle(),
    }, { overlay: true });
    const lines = Array.from(container.querySelectorAll(".subtitle-line")) as HTMLElement[];
    expect(lines).toHaveLength(3);
    lines.forEach((line, index) => {
      const height = index === 0 ? 40 : 400;
      mockBox(line, { clientWidth: 800, clientHeight: height, scrollWidth: 800, scrollHeight: height });
      const content = line.querySelector(".subtitle-line__content") as HTMLElement | null;
      if (content) {
        mockBox(content, { clientWidth: 800, clientHeight: height, scrollWidth: 800, scrollHeight: height });
      }
    });
    const overflow = R.applyOverlayOverflow?.({
      viewport: container,
      shell: container.querySelector(".subtitle-stage-shell"),
      enabled: true,
    });
    expect(overflow).toBeGreaterThan(0);
    expect(lines[0].classList.contains("is-overlay-line-clip")).toBe(false);
    expect(lines[1].classList.contains("is-overlay-line-clip")).toBe(true);
    expect(lines[2].classList.contains("is-overlay-line-clip")).toBe(true);
    const firstContent = lines[0].querySelector(".subtitle-line__content") as HTMLElement;
    const secondContent = lines[1].querySelector(".subtitle-line__content") as HTMLElement;
    expect(firstContent.style.getPropertyValue("--overlay-scroll-y")).toBe("0px");
    expect(secondContent.style.getPropertyValue("--overlay-scroll-y")).toBe("0px");
  });
});

describe("OBS overlay fit wiring contract", () => {
  const overlayJs = readFileSync(join(root, "bin/overlay/overlay.js"), "utf8");
  const overlayHtml = readFileSync(join(root, "bin/overlay/overlay.html"), "utf8");
  const subtitles = readFileSync(join(root, "src/lib/panels/SubtitlesPanel.svelte"), "utf8");

  it("reads fit_to_box from payload and allows ?fit=0 override", () => {
    expect(overlayJs).toContain("fit_to_box");
    expect(overlayJs).toContain("resolveFitToBox");
    expect(overlayJs).toContain('fitParam === "0"');
    expect(overlayJs).toContain("is-fit");
    expect(overlayJs).toContain("stopOverlayOverflowScroll");
  });

  it("exposes a Subtitles checkbox next to overlay layout", () => {
    expect(subtitles).toContain("subtitles.fit_to_box");
    expect(subtitles).toContain("overlay.fit_to_box !== false");
  });

  it("cache-busts overlay assets together with the overflow CSS", () => {
    expect(overlayHtml).toContain("subtitle-style.css?v=20260820f");
    expect(overlayHtml).toContain("overlay.css?v=20260820f");
    expect(overlayHtml).toContain("subtitle-style/index.js?v=20260820f");
    expect(overlayHtml).toContain("overlay.js?v=20260820f");
  });
});
