import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBrowserAsrStateSeed } from "./session-state";

import {
  buildOverlapTelemetrySnapshot,
  evaluateOverlapBuddyGhost,
  handleInactiveOverlapBuddyEnded,
  handleOverlapRecognitionEnded,
  overlapResultAllowed,
  overlapSlotInactive,
  recognitionOverlapActive,
  preStartNextOverlapInstance,
  recoverGhostOverlapBuddy,
  shouldIgnoreOverlapBuddyError,
  tryOverlapSoftRearmOnActiveEnd,
} from "./overlap-logic";

import type { AsrManagerHost, BrowserAsrState } from "./types";



function overlapState(activeSlot = 0, nowMs = 10_000): BrowserAsrState {

  const state = createBrowserAsrStateSeed({

    desiredRunning: true,

    browserSupervisorState: "running",

    lastResultAtMs: nowMs - 500,

    lastMicActivityAt: nowMs - 500,

  });

  state.recognitionOverlapSlots = [{ start: vi.fn(), abort: vi.fn() }, { start: vi.fn(), abort: vi.fn() }] as BrowserAsrState["recognitionOverlapSlots"];

  state.recognitionOverlapActiveSlot = activeSlot;

  state.recognitionOverlapPrestarted = true;

  state.recognitionOverlapSlotListening = [true, true];

  state.recognition = state.recognitionOverlapSlots![activeSlot];

  state.recognitionOverlapSlotListenSinceMs = [nowMs - 9000, nowMs - 7000];

  state.recognitionOverlapSlotActivityAtMs = [nowMs - 500, null];

  return state;

}



function mockManager(state: BrowserAsrState, nowMs = 10_000): AsrManagerHost {
  const SpeechRecognitionCtor = vi.fn(() => ({
    start: vi.fn(),
    abort: vi.fn(),
    maxAlternatives: 1,
  }));

  return {
    state,
    SpeechRecognitionCtor,
    now: () => nowMs,
    appendLogInternal: vi.fn(),
    emitWorkerStatus: vi.fn(() => true),
    applyRecognitionSettings: vi.fn(),
    wireRecognitionHandlers: vi.fn(),
    setSupervisorStateInternal: vi.fn(),
    setRecognitionStateInternal: vi.fn(),
    setStatusInternal: vi.fn(),
    clearForceFinalizeTimerInternal: vi.fn(),
    scheduleRestartInternal: vi.fn(),
  } as unknown as AsrManagerHost;
}



describe("overlap-logic", () => {

  beforeEach(() => {

    vi.useFakeTimers();

  });



  afterEach(() => {

    vi.useRealTimers();

  });



  it("detects inactive overlap slot", () => {

    const state = overlapState(0);

    expect(recognitionOverlapActive(state)).toBe(true);

    expect(overlapSlotInactive(state, 0)).toBe(false);

    expect(overlapSlotInactive(state, 1)).toBe(true);

  });



  it("ignores expected buddy errors while active slot listens", () => {

    const state = overlapState(0);

    expect(shouldIgnoreOverlapBuddyError(state, 1, "no-speech")).toBe(true);

    expect(shouldIgnoreOverlapBuddyError(state, 1, "aborted")).toBe(true);

    expect(shouldIgnoreOverlapBuddyError(state, 1, "network")).toBe(true);

    expect(shouldIgnoreOverlapBuddyError(state, 0, "no-speech")).toBe(false);

    expect(shouldIgnoreOverlapBuddyError(state, 1, "not-allowed")).toBe(false);

    expect(shouldIgnoreOverlapBuddyError(state, 1, "language-not-supported")).toBe(false);

    expect(shouldIgnoreOverlapBuddyError(state, 1, "phrases-not-supported")).toBe(false);

  });



  it("does not consume buddy onend when any restart is pending (0.5.5)", () => {
    const state = overlapState(0);
    state.pendingRestartReason = "network";
    const manager = mockManager(state);
    expect(handleInactiveOverlapBuddyEnded(manager, 1)).toBe(false);
    expect(state.recognitionOverlapSlotListening).toEqual([true, true]);
    expect(state.recognitionOverlapSlots![1].start).not.toHaveBeenCalled();
  });

  it("consumes inactive buddy onend without auto-retry", () => {
    const state = overlapState(0);
    state.recognitionOverlapPrestarted = true;
    const manager = mockManager(state);

    expect(handleInactiveOverlapBuddyEnded(manager, 1)).toBe(true);
    expect(state.recognitionOverlapSlotListening).toEqual([true, false]);
    expect(state.recognitionOverlapPrestarted).toBe(false);
    expect(state.recognitionOverlapSlots![1].start).not.toHaveBeenCalled();
    expect(manager.emitWorkerStatus).toHaveBeenCalledWith("overlap-buddy-ended");
  });

  it("prestarts buddy by recreating idle slot before start", () => {
    const state = overlapState(0, 0);
    state.recognitionOverlapPrestarted = false;
    state.recognitionOverlapSlotListening = [true, false];
    const manager = mockManager(state, 0);
    const oldBuddy = state.recognitionOverlapSlots![1];
    preStartNextOverlapInstance(manager, "natural-final");
    expect(manager.clearForceFinalizeTimerInternal).toHaveBeenCalled();
    expect(state.recognitionOverlapSlots![1]).not.toBe(oldBuddy);
    expect(state.recognitionOverlapSlots![1].start).toHaveBeenCalled();
    expect(state.recognitionOverlapPrestarted).toBe(true);
  });

  it("only active slot publishes results (0.5.5)", () => {
    const state = overlapState(0);
    state.recognitionOverlapPrestarted = true;
    state.recognitionOverlapSlotListening = [true, true];

    expect(overlapResultAllowed(state, 0)).toBe(true);
    expect(overlapResultAllowed(state, 1)).toBe(false);

    state.recognitionOverlapActiveSlot = 1;
    expect(overlapResultAllowed(state, 1)).toBe(true);
    expect(overlapResultAllowed(state, 0)).toBe(false);
  });


  it("does not treat silent buddy as ghost while active slot is transcribing", () => {

    const state = overlapState(0, 20_000);

    expect(evaluateOverlapBuddyGhost(state, 20_000)).toBe(false);

  });



  it("does not treat buddy as ghost during short inter-phrase pause", () => {

    const state = overlapState(0, 20_000);

    state.lastResultAtMs = 16_000;

    state.lastMicActivityAt = 16_000;

    state.recognitionOverlapSlotActivityAtMs = [16_000, null];

    expect(evaluateOverlapBuddyGhost(state, 20_000)).toBe(false);

  });



  it("detects ghost buddy only after sustained idle on both slots", () => {

    const state = overlapState(0, 20_000);

    state.lastResultAtMs = 0;

    state.lastMicActivityAt = 0;

    state.recognitionOverlapSlotActivityAtMs = [null, null];

    expect(evaluateOverlapBuddyGhost(state, 20_000)).toBe(true);

  });



  it("does not treat buddy as ghost when it has slot activity", () => {

    const state = overlapState(0, 20_000);

    state.lastResultAtMs = 0;

    state.lastMicActivityAt = 0;

    state.recognitionOverlapSlotActivityAtMs = [null, 19_800];

    expect(evaluateOverlapBuddyGhost(state, 20_000)).toBe(false);

  });



  it("handoff promotes a listening buddy", () => {
    const state = overlapState(0);
    state.pendingRestartReason = "no_speech";
    state.recognitionOverlapSlotListening = [true, true];
    const manager = mockManager(state, 10_000);

    expect(handleOverlapRecognitionEnded(manager, 0)).toBe(true);
    expect(state.recognitionOverlapActiveSlot).toBe(1);
    expect(state.pendingRestartReason).toBeNull();
    expect(manager.emitWorkerStatus).toHaveBeenCalledWith("recognition-ended");
    expect(state.recognitionOverlapPrestarted).toBe(false);
    expect(state.overlapPrestartTimerArmed).toBe(false);
  });

  it("promotes a warming buddy that started but has no onstart yet (0.5.5)", () => {
    const state = overlapState(0);
    state.recognitionOverlapSlotListening = [true, false];
    state.recognitionOverlapPrestarted = true;
    state.pendingRestartReason = null;
    const manager = mockManager(state, 10_000);

    expect(handleOverlapRecognitionEnded(manager, 0)).toBe(true);
    expect(state.recognitionOverlapActiveSlot).toBe(1);
    expect(state.recognitionOverlapPrestarted).toBe(false);
  });

  it("does not warm-promote when any restart reason is pending (0.5.5)", () => {
    const state = overlapState(0);
    state.recognitionOverlapSlotListening = [true, false];
    state.recognitionOverlapPrestarted = true;
    state.pendingRestartReason = "no_speech";
    const manager = mockManager(state, 10_000);

    expect(handleOverlapRecognitionEnded(manager, 0)).toBe(false);
    expect(state.recognitionOverlapActiveSlot).toBe(0);
  });

  it("safeRestart flips to next slot when no buddy is ready", () => {
    const state = overlapState(0);
    state.recognitionOverlapSlotListening = [true, false];
    state.recognitionOverlapPrestarted = false;
    state.pendingRestartReason = "no_speech";
    state.overlapSoftRearmEmptyCount = 0;
    state.overlapSafeRestartInProgress = false;
    const manager = mockManager(state, 10_000);
    const oldNext = state.recognitionOverlapSlots![1];

    expect(handleOverlapRecognitionEnded(manager, 0)).toBe(false);
    expect(tryOverlapSoftRearmOnActiveEnd(manager, 0)).toBe(true);
    expect(state.recognitionOverlapActiveSlot).toBe(1);
    expect(state.recognitionOverlapSlots![1]).not.toBe(oldNext);
    expect(manager.emitWorkerStatus).toHaveBeenCalledWith("overlap-safe-restart");

    vi.advanceTimersByTime(60);
    expect(state.recognitionOverlapSlots![1].start).toHaveBeenCalled();
    expect(state.overlapSafeRestartInProgress).toBe(false);
  });

  it("does not safeRestart on hard network pending", () => {
    const state = overlapState(0);
    state.recognitionOverlapSlotListening = [true, false];
    state.pendingRestartReason = "network";
    const manager = mockManager(state, 10_000);

    expect(tryOverlapSoftRearmOnActiveEnd(manager, 0)).toBe(false);
    expect(state.recognitionOverlapActiveSlot).toBe(0);
  });

  it("caps empty safeRestarts before generation restart", () => {
    const state = overlapState(0);
    state.recognitionOverlapSlotListening = [true, false];
    state.recognitionOverlapPrestarted = false;
    state.pendingRestartReason = "no_speech";
    state.overlapSoftRearmEmptyCount = 3;
    const manager = mockManager(state, 10_000);

    expect(tryOverlapSoftRearmOnActiveEnd(manager, 0)).toBe(false);
  });

  it("builds overlap telemetry snapshot for browser trace", () => {
    const state = overlapState(0);
    state.effectiveContinuousMode = "segmented_restart";

    expect(buildOverlapTelemetrySnapshot(state)).toEqual({
      overlap_mode_desired: true,
      overlap_active: true,
      overlap_active_slot: 0,
      overlap_buddy_slot: 1,
      overlap_prestarted: true,
      overlap_active_listening: true,
      overlap_buddy_listening: true,
      overlap_slot0_listening: true,
      overlap_slot1_listening: true,
      overlap_buddy_prestart_ok_count: 0,
      overlap_buddy_prestart_fail_count: 0,
      overlap_buddy_onstart_count: 0,
      overlap_buddy_onend_count: 0,
      overlap_last_prestart_reason: null,
      overlap_last_prestart_error: null,
      overlap_last_buddy_error: null,
      overlap_prestart_timer_armed: false,
      overlap_buddy_arm_attempts: 0,
    });
  });

  it("recovers ghost buddy by aborting and retrying prestart on a fresh instance", () => {
    const state = overlapState(0, 20_000);
    state.lastResultAtMs = 0;
    state.lastMicActivityAt = 0;
    state.recognitionOverlapSlotActivityAtMs = [null, null];
    state.recognitionOverlapPrestarted = true;
    const oldBuddy = state.recognitionOverlapSlots![1];
    const manager = mockManager(state, 20_000);

    expect(recoverGhostOverlapBuddy(manager, 20_000)).toBe(true);
    expect(oldBuddy.abort).toHaveBeenCalled();
    expect(state.recognitionOverlapSlots![1]).not.toBe(oldBuddy);
    expect(state.recognitionOverlapSlots![1].start).toHaveBeenCalled();
    expect(state.recognitionOverlapPrestarted).toBe(true);
    expect(manager.emitWorkerStatus).toHaveBeenCalledWith(
      "overlap-buddy-ghost-recovered",
    );
  });
});
