import type { BrowserAsrState } from "./types";
import { currentSessionAgeMs } from "./restart-timing-logic";

export function isMicHearingEnergy(ctx: {
  state: BrowserAsrState;
  nowMs: number;
  recentMicActivityWindowMs: number;
  voiceRmsThreshold: number;
}): boolean {
  const { state } = ctx;
  const now = Number(ctx.nowMs || 0);
  const micActivityAgeMs =
    state.lastMicActivityAt > 0 ? Math.max(0, now - Number(state.lastMicActivityAt)) : null;
  if (micActivityAgeMs != null && micActivityAgeMs <= Number(ctx.recentMicActivityWindowMs || 0)) {
    return true;
  }
  return Number(state.micRms || 0) >= Number(ctx.voiceRmsThreshold || 0);
}

/** Track when the current mic-energy streak began so stall/rearm do not fire on the first word after a pause. */
export function updateMicHotStreak(
  state: Pick<BrowserAsrState, "lastMicActivityAt" | "micHotSinceMs">,
  nowMs: number,
  hearingEnergy: boolean,
  streakBreakMs: number
): void {
  const now = Number(nowMs || 0);
  if (hearingEnergy) {
    state.lastMicActivityAt = now;
    if (!Number(state.micHotSinceMs || 0)) {
      state.micHotSinceMs = now;
    }
    return;
  }
  const lastActivity = Number(state.lastMicActivityAt || 0);
  if (state.micHotSinceMs && lastActivity > 0 && now - lastActivity > Number(streakBreakMs || 0)) {
    state.micHotSinceMs = 0;
  }
}

/**
 * How long ASR has been quiet during the *current* mic-hot streak.
 * A pause then new speech resets this clock (micHotSinceMs), so we do not
 * treat "first utterance after a gap" as a dead Web Speech session.
 */
export function asrQuietWhileMicHotMs(state: BrowserAsrState, nowMs: number): number {
  const hotSince = Number(state.micHotSinceMs || 0);
  if (hotSince <= 0) {
    return 0;
  }
  const lastAsrAt = Math.max(Number(state.lastStartAtMs || 0), Number(state.lastResultAtMs || 0));
  const anchor = Math.max(lastAsrAt, hotSince);
  return Math.max(0, Number(nowMs || 0) - anchor);
}

export function evaluateWatchdogTick(ctx: {
  state: BrowserAsrState;
  nowMs: number;
  limits: {
    maxBrowserSessionAgeMs: number;
    prepareCycleBeforeMs: number;
    maxStoppingMs: number;
    hiddenIdleRestartMs: number;
    visibleIdleRestartMs: number;
    /** Dead Web Speech while mic still hears energy (after prior ASR activity). */
    activeSpeechStallMs: number;
    /** Dead start: mic hot but this generation never emitted ASR yet. */
    coldStartStallMs: number;
    recentMicActivityWindowMs: number;
    voiceRmsThreshold: number;
  };
  documentHidden: boolean;
}): { type: string } {
  const { state, limits } = ctx;
  const now = Number(ctx.nowMs || 0);
  const documentHidden = Boolean(ctx.documentHidden);

  if (!state?.desiredRunning) {
    return { type: "noop" };
  }

  const sessionAgeMs = currentSessionAgeMs(state, now);
  const maxSessionAgeMs = Number(state.maxBrowserSessionAgeMs || limits.maxBrowserSessionAgeMs || 0);
  const prepareCycleBeforeMs = Number(state.prepareCycleBeforeMs || limits.prepareCycleBeforeMs || 0);
  const prepareAtMs = Math.max(0, maxSessionAgeMs - prepareCycleBeforeMs);

  if (
    state.browserSupervisorState === "running" &&
    sessionAgeMs != null &&
    maxSessionAgeMs > 0 &&
    sessionAgeMs >= maxSessionAgeMs
  ) {
    return { type: "session_cycle" };
  }

  if (
    state.browserSupervisorState === "running" &&
    sessionAgeMs != null &&
    sessionAgeMs >= prepareAtMs &&
    !state.browserCyclePending
  ) {
    return { type: "cycle_pending" };
  }

  if (
    state.browserSupervisorState === "stopping" &&
    state.stoppingSinceMs &&
    now - Number(state.stoppingSinceMs) >= Number(limits.maxStoppingMs || 2500)
  ) {
    return { type: "stopping_timeout" };
  }

  // Transcript/session markers only — onsoundstart updates lastEventAtMs and would
  // mask a stalled native-continuous session while the mic still hears audio.
  const lastStartAtMs = Number(state.lastStartAtMs || 0);
  const lastResultAtMs = Number(state.lastResultAtMs || 0);
  const lastActivityAt = Math.max(lastStartAtMs, lastResultAtMs);
  const recognitionQuietMs = lastActivityAt > 0 ? Math.max(0, now - lastActivityAt) : 0;
  const micHot = isMicHearingEnergy({
    state,
    nowMs: now,
    recentMicActivityWindowMs: limits.recentMicActivityWindowMs,
    voiceRmsThreshold: limits.voiceRmsThreshold,
  });
  const neverGotResultThisGeneration = lastStartAtMs > 0 && lastResultAtMs < lastStartAtMs;
  const stallBudgetMs = neverGotResultThisGeneration
    ? Number(limits.coldStartStallMs || limits.activeSpeechStallMs || 4500)
    : Number(limits.activeSpeechStallMs || 9000);
  const quietWhileHotMs = asrQuietWhileMicHotMs(state, now);

  // Speech present, ASR quiet. Overlap/segmented modes have their own silence rearm.
  // Clock is the current mic-hot streak — not wall time since the last result —
  // so a long pause then new speech does not immediately stop()/restart.
  const overlapOrSegmented =
    state.effectiveContinuousMode === "segmented_restart" ||
    (Array.isArray(state.recognitionOverlapSlots) && state.recognitionOverlapSlots.length === 2);
  if (
    !overlapOrSegmented &&
    !documentHidden &&
    state.browserSupervisorState === "running" &&
    micHot &&
    quietWhileHotMs >= stallBudgetMs
  ) {
    return { type: "active_speech_stall" };
  }

  const idleThresholdMs = documentHidden
    ? Number(limits.hiddenIdleRestartMs || 60000)
    : Number(limits.visibleIdleRestartMs || 30000);
  if (lastActivityAt > 0 && recognitionQuietMs >= idleThresholdMs && state.browserSupervisorState === "running") {
    return { type: "idle_rearm" };
  }

  return { type: "heartbeat" };
}
