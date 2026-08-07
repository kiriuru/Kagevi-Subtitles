export const RESTART_DELAY_BY_REASON_MS: Record<string, number> = {
  normal_onend: 150,
  settings_change: 150,
  websocket_reconnect: 150,
  // Keep short — multi-second gaps after stall were dominated by this delay + recovery.
  watchdog_stall: 100,
  session_cycle: 150,
  long_segment_flush: 100,
};

export const INSTANCE_DEFAULTS = {
  restartDelayByReasonMs: { ...RESTART_DELAY_BY_REASON_MS },
  initialNoSpeechDelayMs: 150,
  maxNoSpeechDelayMs: 5000,
  initialNetworkBackoffMs: 500,
  maxNetworkBackoffMs: 30000,
  watchdogIntervalMs: 1000,
  maxStoppingMs: 2000,
  // Quiet mic / no speech: avoid thrashing between phrases.
  visibleIdleRestartMs: 30000,
  hiddenIdleRestartMs: 60000,
  // Chrome continuous often pauses interim for several seconds while still alive.
  // 3s abort/rearm chopped live speech into tiny finals — keep recovery, but wait longer.
  stallDegradedAfterMs: 9000,
  activeSpeechStallMs: 9000,
  // Faster only when this generation never produced any ASR result (dead start).
  coldStartStallMs: 4500,
  micSilentDegradedAfterMs: 5000,
  // Tolerate short mixer/gate dips on USB interfaces (e.g. Maonocaster).
  recentMicActivityWindowMs: 3000,
  minimumReconnectIntervalMs: 500,
  maxBrowserSessionAgeMs: 180000,
  prepareCycleBeforeMs: 30000,
  voiceBelowRecognitionRmsThreshold: 0.025,
  voiceBelowRecognitionGraceMs: 3500,
  voiceBelowRecognitionMicWindowMs: 3000,
  voiceBelowRecognitionMinNoSpeech: 1,
  networkPreflightBurstThreshold: 3,
  networkPreflightBurstWindowMs: 12000,
  networkPreflightTimeoutMs: 4000,
  networkPreflightCooldownMs: 30000,
  recognitionStartLogMinGapMs: 4200,
} as const;
