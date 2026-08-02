import { describe, expect, it, vi } from "vitest";
import { createBrowserAsrStateSeed } from "./session-state";
import {
  DEFAULT_LONG_SEGMENT_FLUSH_MIN_CHARS,
  maybeFlushAfterCommittedLongSegment,
  noteSegmentPartialPeak,
  shouldFlushAfterLongSegment,
} from "./long-segment-flush-logic";
import type { AsrManagerHost, BrowserAsrState } from "./types";

function stateWithPeak(peak: number, overrides: Partial<BrowserAsrState> = {}): BrowserAsrState {
  const state = createBrowserAsrStateSeed({
    desiredRunning: true,
    browserSupervisorState: "running",
    actualContinuous: true,
    currentSegmentPeakPartialChars: peak,
    ...overrides,
  });
  return state;
}

function mockManager(state: BrowserAsrState): AsrManagerHost {
  const SpeechRecognitionCtor = vi.fn(() => ({
    start: vi.fn(),
    abort: vi.fn(),
    stop: vi.fn(),
    maxAlternatives: 1,
  }));
  return {
    state,
    SpeechRecognitionCtor,
    appendLogInternal: vi.fn(),
    clearForceFinalizeTimerInternal: vi.fn(),
    setSupervisorStateInternal: vi.fn(),
    setRecognitionStateInternal: vi.fn(),
    setStatusInternal: vi.fn(),
    emitWorkerStatus: vi.fn(() => true),
    applyRecognitionSettings: vi.fn(),
    wireRecognitionHandlers: vi.fn(),
    now: () => 10_000,
    scheduleRestartInternal: vi.fn(),
  } as unknown as AsrManagerHost;
}

describe("long-segment-flush-logic", () => {
  it("requires peak or final length above threshold", () => {
    const state = stateWithPeak(0);
    expect(
      shouldFlushAfterLongSegment(state, "short phrase", DEFAULT_LONG_SEGMENT_FLUSH_MIN_CHARS),
    ).toBe(false);
    expect(
      shouldFlushAfterLongSegment(
        state,
        "x".repeat(DEFAULT_LONG_SEGMENT_FLUSH_MIN_CHARS),
        DEFAULT_LONG_SEGMENT_FLUSH_MIN_CHARS,
      ),
    ).toBe(true);
  });

  it("uses partial peak when final is shorter than peak", () => {
    const state = stateWithPeak(500);
    expect(shouldFlushAfterLongSegment(state, "corrected shorter final")).toBe(true);
  });

  it("skips flush while restart is already pending", () => {
    const state = stateWithPeak(500, { pendingRestartReason: "network" });
    expect(shouldFlushAfterLongSegment(state, "x".repeat(500))).toBe(false);
  });

  it("tracks partial peak growth", () => {
    const state = createBrowserAsrStateSeed();
    noteSegmentPartialPeak(state, "hello");
    noteSegmentPartialPeak(state, "hello world");
    expect(state.currentSegmentPeakPartialChars).toBe(11);
    noteSegmentPartialPeak(state, "hello");
    expect(state.currentSegmentPeakPartialChars).toBe(11);
  });

  it("requests native continuous flush after long committed final", () => {
    const state = stateWithPeak(500);
    const stop = vi.fn();
    state.recognition = { stop } as BrowserAsrState["recognition"];
    const manager = mockManager(state);
    maybeFlushAfterCommittedLongSegment(manager, "x".repeat(500), "natural-final");
    expect(state.longSegmentFlushCount).toBe(1);
    expect(state.currentSegmentPeakPartialChars).toBe(0);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(manager.appendLogInternal).toHaveBeenCalledWith(
      expect.stringContaining("long-segment flush scheduled"),
    );
  });

  it("does not flush below the raised continuous threshold", () => {
    const state = stateWithPeak(320);
    expect(shouldFlushAfterLongSegment(state, "x".repeat(320))).toBe(false);
  });

  it("stops only the active overlap slot after long committed final", () => {
    const state = stateWithPeak(500, { actualContinuous: false });
    const stop = vi.fn();
    const buddyStart = vi.fn();
    state.recognitionOverlapSlots = [
      { stop, abort: vi.fn() },
      { start: buddyStart, stop: vi.fn(), abort: vi.fn() },
    ] as BrowserAsrState["recognitionOverlapSlots"];
    state.recognitionOverlapActiveSlot = 0;
    state.recognitionOverlapSlotListening = [true, false];
    state.recognitionOverlapPrestarted = true;
    const manager = mockManager(state);
    maybeFlushAfterCommittedLongSegment(manager, "x".repeat(500), "natural-final");
    // 0.5.5: long-segment flush only stop()s active — prestart is the caller's job
    expect(buddyStart).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(manager.appendLogInternal).toHaveBeenCalledWith(
      expect.stringContaining("overlap: active slot flush"),
    );
  });
});
