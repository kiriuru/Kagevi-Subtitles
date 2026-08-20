import { describe, expect, it } from "vitest";
import { createBrowserAsrStateSeed } from "./session-state";
import { computeHealthDegradedReason } from "./health-signals-logic";
import { INSTANCE_DEFAULTS } from "./session-defaults";

const limits = {
  restartDelayByReasonMs: { ...INSTANCE_DEFAULTS.restartDelayByReasonMs },
  initialNoSpeechDelayMs: INSTANCE_DEFAULTS.initialNoSpeechDelayMs,
  maxNoSpeechDelayMs: INSTANCE_DEFAULTS.maxNoSpeechDelayMs,
  initialNetworkBackoffMs: INSTANCE_DEFAULTS.initialNetworkBackoffMs,
  maxNetworkBackoffMs: INSTANCE_DEFAULTS.maxNetworkBackoffMs,
  networkPreflightBurstThreshold: INSTANCE_DEFAULTS.networkPreflightBurstThreshold,
  networkPreflightBurstWindowMs: INSTANCE_DEFAULTS.networkPreflightBurstWindowMs,
  networkPreflightCooldownMs: INSTANCE_DEFAULTS.networkPreflightCooldownMs,
  micSilentDegradedAfterMs: INSTANCE_DEFAULTS.micSilentDegradedAfterMs,
  voiceBelowRecognitionRmsThreshold: INSTANCE_DEFAULTS.voiceBelowRecognitionRmsThreshold,
  voiceBelowRecognitionGraceMs: INSTANCE_DEFAULTS.voiceBelowRecognitionGraceMs,
  voiceBelowRecognitionMicWindowMs: INSTANCE_DEFAULTS.voiceBelowRecognitionMicWindowMs,
  voiceBelowRecognitionMinNoSpeech: INSTANCE_DEFAULTS.voiceBelowRecognitionMinNoSpeech,
  stallDegradedAfterMs: INSTANCE_DEFAULTS.stallDegradedAfterMs,
  recentMicActivityWindowMs: INSTANCE_DEFAULTS.recentMicActivityWindowMs,
};

describe("health-signals-logic", () => {
  it("reports web_speech_stalled before mic_silent when ASR is quiet and mic is hot", () => {
    const state = createBrowserAsrStateSeed({
      desiredRunning: true,
      browserSupervisorState: "running",
      micTrackReadyState: "live",
      lastStartAtMs: 1000,
      lastResultAtMs: 1000,
      lastEventAtMs: 9000,
      lastMicActivityAt: 10_200,
      micHotSinceMs: 1000,
      micRms: 0.05,
    });
    const reason = computeHealthDegradedReason({
      state,
      nowMs: 10_500,
      documentHidden: false,
      limits,
    });
    expect(reason).toBe("web_speech_stalled");
  });

  it("does not treat onsoundstart alone as ASR activity for stall", () => {
    const state = createBrowserAsrStateSeed({
      desiredRunning: true,
      browserSupervisorState: "running",
      micTrackReadyState: "live",
      lastStartAtMs: 1000,
      lastResultAtMs: 1000,
      lastEventAtMs: 10_300,
      lastMicActivityAt: 10_300,
      micHotSinceMs: 1000,
      micRms: 0.04,
    });
    const reason = computeHealthDegradedReason({
      state,
      nowMs: 10_500,
      documentHidden: false,
      limits,
    });
    expect(reason).toBe("web_speech_stalled");
  });

  it("does not report web_speech_stalled on the first words after a pause", () => {
    const state = createBrowserAsrStateSeed({
      desiredRunning: true,
      browserSupervisorState: "running",
      micTrackReadyState: "live",
      lastStartAtMs: 1000,
      lastResultAtMs: 1000,
      lastEventAtMs: 2000,
      lastMicActivityAt: 10_400,
      micHotSinceMs: 10_200,
      micRms: 0.05,
    });
    const reason = computeHealthDegradedReason({
      state,
      nowMs: 10_500,
      documentHidden: false,
      limits,
    });
    expect(reason).not.toBe("web_speech_stalled");
  });
});
