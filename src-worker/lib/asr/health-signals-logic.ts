import type { BrowserAsrState, TimingLimits } from "./types";
import { isMicHearingEnergy } from "./watchdog-logic";

export function computeHealthDegradedReason(ctx: {
  state: BrowserAsrState;
  nowMs: number;
  documentHidden: boolean;
  limits: TimingLimits;
}): string | null {
  const { state, nowMs, limits } = ctx;
  const trackReadyState = String(state.micTrackReadyState || "")
    .trim()
    .toLowerCase();
  const micActivityAgeMs = state.lastMicActivityAt > 0 ? Math.max(0, nowMs - Number(state.lastMicActivityAt)) : null;
  // Exclude lastEventAtMs (onsoundstart) — it masks dead continuous sessions while mic hears audio.
  const recognitionQuietMs = Math.max(
    0,
    nowMs - Math.max(Number(state.lastResultAtMs || 0), Number(state.lastStartAtMs || 0))
  );
  const recognitionQuietIncludingSoundMs = Math.max(
    0,
    nowMs - Math.max(Number(state.lastEventAtMs || 0), Number(state.lastResultAtMs || 0), Number(state.lastStartAtMs || 0))
  );
  state.micActiveRecentMs = micActivityAgeMs;

  if (!state.desiredRunning) {
    return null;
  }
  if (trackReadyState && trackReadyState !== "live") {
    return "mic_track_unavailable";
  }

  // Overlap/segmented sessions are intentionally short; silence rearm recovers them.
  // Do not surface web_speech_stalled — it falsely marks healthy ping-pong as degraded.
  const overlapOrSegmented =
    state.effectiveContinuousMode === "segmented_restart" ||
    (Array.isArray(state.recognitionOverlapSlots) && state.recognitionOverlapSlots.length === 2);

  const micHot = isMicHearingEnergy({
    state,
    nowMs,
    recentMicActivityWindowMs: limits.recentMicActivityWindowMs,
    voiceRmsThreshold: limits.voiceBelowRecognitionRmsThreshold,
  });

  // Stall before mic_silent — otherwise quiet-gate dips masked dead Web Speech for 12–15s.
  if (
    !overlapOrSegmented &&
    !ctx.documentHidden &&
    state.browserSupervisorState === "running" &&
    recognitionQuietMs >= limits.stallDegradedAfterMs &&
    micHot
  ) {
    return "web_speech_stalled";
  }

  if (
    !ctx.documentHidden &&
    state.browserSupervisorState === "running" &&
    micActivityAgeMs != null &&
    micActivityAgeMs >= limits.micSilentDegradedAfterMs
  ) {
    return "mic_silent";
  }
  const micRms = Number(state.micRms || 0);
  const voiceLevelGoodRecently =
    micRms >= limits.voiceBelowRecognitionRmsThreshold ||
    (micActivityAgeMs != null &&
      micActivityAgeMs <= limits.voiceBelowRecognitionMicWindowMs &&
      Number(state.noSpeechCount || 0) >= limits.voiceBelowRecognitionMinNoSpeech);
  if (
    !ctx.documentHidden &&
    state.browserSupervisorState === "running" &&
    recognitionQuietIncludingSoundMs >= limits.voiceBelowRecognitionGraceMs &&
    voiceLevelGoodRecently &&
    Number(state.noSpeechCount || 0) >= limits.voiceBelowRecognitionMinNoSpeech
  ) {
    return "voice_below_recognition_threshold";
  }
  return null;
}
