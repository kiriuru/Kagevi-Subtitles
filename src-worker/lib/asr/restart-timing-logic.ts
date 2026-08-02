import type { BrowserAsrState, TimingLimits } from "./types";

export function currentSessionAgeMs(state: BrowserAsrState, nowMs: number): number | null {
  if (!state.lastSessionStartedAtMs) {
    return null;
  }
  return Math.max(0, nowMs - Number(state.lastSessionStartedAtMs || 0));
}

export function minimumReconnectGuardDelayMs(
  state: BrowserAsrState,
  delayMs: number,
  nowMs: number,
  instanceMinimumReconnectIntervalMs: number
): number {
  const minimumIntervalMs = Math.max(
    0,
    Number(state.minimumReconnectIntervalMs || instanceMinimumReconnectIntervalMs || 0)
  );
  if (!minimumIntervalMs) {
    return delayMs;
  }
  const anchorMs = Math.max(
    Number(state.lastSessionEndedAtMs || 0),
    Number(state.lastEndAtMs || 0),
    Number(state.lastStartAtMs || 0)
  );
  if (!anchorMs) {
    return delayMs;
  }
  const remainingMs = minimumIntervalMs - Math.max(0, nowMs - anchorMs);
  if (remainingMs <= 0 || remainingMs <= delayMs) {
    return delayMs;
  }
  state.browserMinimumReconnectSuppressedCount = Number(state.browserMinimumReconnectSuppressedCount || 0) + 1;
  return remainingMs;
}

export function restartDelayForReason(state: BrowserAsrState, reason: string, limits: TimingLimits): number {
  const normalized = String(reason || "")
    .trim()
    .toLowerCase();
  if (normalized === "no_speech") {
    // Fixed delay — accumulating +800 ms backoff opened multi-second gaps between
    // overlap/segmented restarts when Chrome ends on silence without a buddy armed.
    const delayMs = Math.max(
      0,
      Number(state.noSpeechRestartDelayMs || limits.initialNoSpeechDelayMs || 150),
    );
    state.noSpeechBackoffMs = delayMs;
    return delayMs;
  }
  if (normalized === "network" || normalized === "audio_capture") {
    // Fixed delay — exponential growth left multi-second gaps while Google/mic recovered.
    // `network_reconnect_max_ms` is retained in config for compatibility but no longer applied.
    const delayMs = Math.max(
      0,
      Number(state.networkReconnectInitialMs || limits.initialNetworkBackoffMs || 500),
    );
    state.restartBackoffMs = delayMs;
    return delayMs;
  }
  return limits.restartDelayByReasonMs[normalized] ?? limits.restartDelayByReasonMs.normal_onend ?? 0;
}

export function resetNetworkErrorBurst(state: BrowserAsrState): void {
  state.networkErrorBurstCount = 0;
  state.networkErrorBurstStartedAtMs = 0;
}

export function registerNetworkErrorBurst(state: BrowserAsrState, nowMs: number, limits: TimingLimits): boolean {
  const startedAt = Number(state.networkErrorBurstStartedAtMs || 0);
  if (!startedAt || nowMs - startedAt > limits.networkPreflightBurstWindowMs) {
    state.networkErrorBurstStartedAtMs = nowMs;
    state.networkErrorBurstCount = 1;
  } else {
    state.networkErrorBurstCount = Number(state.networkErrorBurstCount || 0) + 1;
  }
  return shouldRunNetworkPreflight(state, nowMs, limits);
}

export function shouldRunNetworkPreflight(state: BrowserAsrState, nowMs: number, limits: TimingLimits): boolean {
  if (state.networkPreflightInFlight) {
    return false;
  }
  if (Number(state.networkErrorBurstCount || 0) < limits.networkPreflightBurstThreshold) {
    return false;
  }
  const burstStartedAt = Number(state.networkErrorBurstStartedAtMs || 0);
  if (!burstStartedAt || nowMs - burstStartedAt > limits.networkPreflightBurstWindowMs) {
    return false;
  }
  const lastPreflightAt = Number(state.lastNetworkPreflightAtMs || 0);
  if (lastPreflightAt && nowMs - lastPreflightAt < limits.networkPreflightCooldownMs) {
    return false;
  }
  return true;
}
