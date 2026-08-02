import { describe, expect, it } from "vitest";
import { createBrowserAsrStateSeed } from "./session-state";
import {
  minimumReconnectGuardDelayMs,
  registerNetworkErrorBurst,
  restartDelayForReason,
  shouldRunNetworkPreflight,
} from "./restart-timing-logic";

const limits = {
  restartDelayByReasonMs: { normal_onend: 350 },
  initialNoSpeechDelayMs: 350,
  maxNoSpeechDelayMs: 5000,
  initialNetworkBackoffMs: 1000,
  maxNetworkBackoffMs: 30000,
  networkPreflightBurstThreshold: 3,
  networkPreflightBurstWindowMs: 12000,
  networkPreflightCooldownMs: 30000,
  micSilentDegradedAfterMs: 5000,
  voiceBelowRecognitionRmsThreshold: 0.025,
  voiceBelowRecognitionGraceMs: 8000,
  voiceBelowRecognitionMicWindowMs: 2000,
  voiceBelowRecognitionMinNoSpeech: 1,
  stallDegradedAfterMs: 12000,
  recentMicActivityWindowMs: 2000,
};

describe("restart-timing-logic", () => {
  it("keeps a fixed no_speech restart delay (no accumulating backoff)", () => {
    const state = createBrowserAsrStateSeed({ noSpeechRestartDelayMs: 150 });
    const first = restartDelayForReason(state, "no_speech", limits);
    const second = restartDelayForReason(state, "no_speech", limits);
    expect(first).toBe(150);
    expect(second).toBe(150);
  });

  it("extends reconnect delay when minimum interval not met", () => {
    const state = createBrowserAsrStateSeed({ minimumReconnectIntervalMs: 500, lastStartAtMs: 1000 });
    const now = 1100;
    const delay = minimumReconnectGuardDelayMs(state, 100, now, 500);
    expect(delay).toBeGreaterThan(100);
    expect(state.browserMinimumReconnectSuppressedCount).toBe(1);
  });

  it("keeps a fixed network and audio_capture restart delay (no growing backoff)", () => {
    const state = createBrowserAsrStateSeed({ networkReconnectInitialMs: 500 });
    const firstNetwork = restartDelayForReason(state, "network", limits);
    const secondNetwork = restartDelayForReason(state, "network", limits);
    const firstCapture = restartDelayForReason(state, "audio_capture", limits);
    const secondCapture = restartDelayForReason(state, "audio_capture", limits);
    expect(firstNetwork).toBe(500);
    expect(secondNetwork).toBe(500);
    expect(firstCapture).toBe(500);
    expect(secondCapture).toBe(500);
  });

  it("triggers network preflight after burst threshold", () => {
    const state = createBrowserAsrStateSeed();
    const now = 10_000;
    registerNetworkErrorBurst(state, now, limits);
    registerNetworkErrorBurst(state, now + 100, limits);
    expect(shouldRunNetworkPreflight(state, now + 200, limits)).toBe(false);
    registerNetworkErrorBurst(state, now + 200, limits);
    expect(shouldRunNetworkPreflight(state, now + 300, limits)).toBe(true);
  });
});
