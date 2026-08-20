import { describe, expect, it } from "vitest";
import { createBrowserAsrStateSeed } from "./session-state";
import {
  asrQuietWhileMicHotMs,
  evaluateWatchdogTick,
  updateMicHotStreak,
} from "./watchdog-logic";

const limits = {
  maxBrowserSessionAgeMs: 180_000,
  prepareCycleBeforeMs: 15_000,
  maxStoppingMs: 2500,
  hiddenIdleRestartMs: 60_000,
  visibleIdleRestartMs: 30_000,
  activeSpeechStallMs: 9_000,
  coldStartStallMs: 4_500,
  recentMicActivityWindowMs: 3_000,
  voiceRmsThreshold: 0.025,
};

describe("watchdog-logic", () => {
  it("active_speech_stall after long quiet with prior ASR results", () => {
    const state = createBrowserAsrStateSeed({
      desiredRunning: true,
      browserSupervisorState: "running",
      lastSessionStartedAtMs: 0,
      lastStartAtMs: 1000,
      lastResultAtMs: 2000,
      lastEventAtMs: 20_000,
      lastMicActivityAt: 11_500,
      micHotSinceMs: 1500,
      micRms: 0.04,
    });
    const tick = evaluateWatchdogTick({
      state,
      nowMs: 12_000,
      limits,
      documentHidden: false,
    });
    expect(tick.type).toBe("active_speech_stall");
  });

  it("heartbeat during typical Chrome interim pause under activeSpeechStallMs", () => {
    const state = createBrowserAsrStateSeed({
      desiredRunning: true,
      browserSupervisorState: "running",
      lastStartAtMs: 1000,
      lastResultAtMs: 2000,
      lastMicActivityAt: 6500,
      micHotSinceMs: 1500,
      micRms: 0.05,
    });
    const tick = evaluateWatchdogTick({
      state,
      nowMs: 7000,
      limits,
      documentHidden: false,
    });
    expect(tick.type).toBe("heartbeat");
  });

  it("cold-start stall when mic is hot but generation never got ASR", () => {
    const state = createBrowserAsrStateSeed({
      desiredRunning: true,
      browserSupervisorState: "running",
      lastStartAtMs: 1000,
      lastResultAtMs: 0,
      lastMicActivityAt: 5000,
      micHotSinceMs: 1000,
      micRms: 0.05,
    });
    const tick = evaluateWatchdogTick({
      state,
      nowMs: 5600,
      limits,
      documentHidden: false,
    });
    expect(tick.type).toBe("active_speech_stall");
  });

  it("idle_rearm ignores recent sound events when no transcript activity", () => {
    const state = createBrowserAsrStateSeed({
      desiredRunning: true,
      browserSupervisorState: "running",
      lastSessionStartedAtMs: 0,
      lastStartAtMs: 1000,
      lastResultAtMs: 0,
      lastEventAtMs: 40_000,
      lastMicActivityAt: 0,
      micRms: 0,
    });
    const tick = evaluateWatchdogTick({
      state,
      nowMs: 35_000,
      limits,
      documentHidden: false,
    });
    expect(tick.type).toBe("idle_rearm");
  });

  it("heartbeat before visible idle threshold when mic is quiet", () => {
    const state = createBrowserAsrStateSeed({
      desiredRunning: true,
      browserSupervisorState: "running",
      lastSessionStartedAtMs: 0,
      lastStartAtMs: 1000,
      lastResultAtMs: 1000,
      lastEventAtMs: 14_000,
      lastMicActivityAt: 0,
      micRms: 0,
    });
    const tick = evaluateWatchdogTick({
      state,
      nowMs: 15_500,
      limits,
      documentHidden: false,
    });
    expect(tick.type).toBe("heartbeat");
  });

  it("heartbeat while interim/final results keep arriving", () => {
    const state = createBrowserAsrStateSeed({
      desiredRunning: true,
      browserSupervisorState: "running",
      lastSessionStartedAtMs: 0,
      lastStartAtMs: 1000,
      lastResultAtMs: 19_000,
      lastEventAtMs: 19_500,
      lastMicActivityAt: 19_400,
      micHotSinceMs: 18_000,
      micRms: 0.04,
    });
    const tick = evaluateWatchdogTick({
      state,
      nowMs: 20_000,
      limits,
      documentHidden: false,
    });
    expect(tick.type).toBe("heartbeat");
  });

  it("does not stall on the first words after a long pause", () => {
    const state = createBrowserAsrStateSeed({
      desiredRunning: true,
      browserSupervisorState: "running",
      lastStartAtMs: 1000,
      lastResultAtMs: 2000,
      lastMicActivityAt: 12_000,
      micHotSinceMs: 11_500,
      micRms: 0.05,
    });
    const tick = evaluateWatchdogTick({
      state,
      nowMs: 12_000,
      limits,
      documentHidden: false,
    });
    expect(tick.type).toBe("heartbeat");
    expect(asrQuietWhileMicHotMs(state, 12_000)).toBe(500);
  });

  it("does not cold-start stall when speech resumes after a quiet generation", () => {
    const state = createBrowserAsrStateSeed({
      desiredRunning: true,
      browserSupervisorState: "running",
      lastStartAtMs: 1000,
      lastResultAtMs: 0,
      lastMicActivityAt: 5600,
      micHotSinceMs: 5000,
      micRms: 0.05,
    });
    const tick = evaluateWatchdogTick({
      state,
      nowMs: 5600,
      limits,
      documentHidden: false,
    });
    expect(tick.type).toBe("heartbeat");
  });

  it("does not active_speech_stall in overlap mode", () => {
    const state = createBrowserAsrStateSeed({
      desiredRunning: true,
      browserSupervisorState: "running",
      lastStartAtMs: 1000,
      lastResultAtMs: 1000,
      lastMicActivityAt: 12_000,
      micRms: 0.05,
      recognitionOverlapSlots: [null, null],
      effectiveContinuousMode: "segmented_restart",
    });
    const tick = evaluateWatchdogTick({
      state,
      nowMs: 12_500,
      limits,
      documentHidden: false,
    });
    expect(tick.type).not.toBe("active_speech_stall");
  });
});

describe("mic hot streak", () => {
  it("starts on first energy and resets after the quiet break window", () => {
    const state = createBrowserAsrStateSeed({ lastMicActivityAt: 0, micHotSinceMs: 0 });
    updateMicHotStreak(state, 1000, true, 3000);
    expect(state.micHotSinceMs).toBe(1000);
    updateMicHotStreak(state, 1500, true, 3000);
    expect(state.micHotSinceMs).toBe(1000);
    updateMicHotStreak(state, 2000, false, 3000);
    expect(state.micHotSinceMs).toBe(1000);
    updateMicHotStreak(state, 5100, false, 3000);
    expect(state.micHotSinceMs).toBe(0);
  });
});
