import type {
  AsrManagerHost,
  BrowserAsrState,
  RecognitionSettings,
} from "./types";

import type { WorkerSpeechRecognition } from "./speech-types";

import { webSpeechRecognitionPolicy } from "./web-speech-policy";
import { preferStableOverlapPartial } from "./overlap-phrase-logic";

/**
 * Dual-slot overlap for `continuous=false`.
 *
 * Dual-buffer Web Speech loop:
 * - `preStartNextInstance` — on natural/forced final, start the idle buddy **immediately**
 *   while active still lives (captures the start of the next phrase);
 * - `switchToNextInstance` — on active `onend`, promote listening/warming buddy;
 * - `safeRestartRecognition` — if no buddy is ready, flip to the other slot and
 *   `start()` after ~50 ms (in-generation) instead of a full generation thrash.
 *
 * Idle slots are still **recreated** before `start()` (Chrome often rejects restarting
 * the same ended instance). Mid-speech buddy warm is **not** used — starting a second
 * `SpeechRecognition` while active is speaking makes Chrome abort/chop the active slot.
 * Buddy is armed on final / forced-final only; hypotheses stay shadowed until handoff.
 *
 * Hard errors (`network`, `audio_capture`) still force a full generation restart.
 */

export const DEFAULT_OVERLAP_BUDDY_GHOST_TIMEOUT_MS = 6000;

export const DEFAULT_OVERLAP_BUDDY_GHOST_ACTIVE_MIC_MS = 3000;

/** Delayed buddy retry only (buddy-ended). Finals use immediate preStart. */
export const DEFAULT_OVERLAP_PRESTART_AFTER_START_MS = 100;

/**
 * Warm the buddy ~1.5 s after the active slot starts listening so audio nabests
 * before Chrome ends the active session (final-only prestart is often too late).
 */
export const DEFAULT_OVERLAP_EARLY_WARM_MS = 1500;

/** When mic is still hot, silence-rearm sooner than the quiet budget. */
export const DEFAULT_OVERLAP_HOT_MIC_SILENCE_REARM_MS = 3000;

/** Short settle delay when the next instance was not pre-started (~50–100 ms). */
export const DEFAULT_OVERLAP_SAFE_RESTART_DELAY_MS = 50;

/** Cap empty in-generation safe-restarts before falling through to generation restart. */
export const MAX_OVERLAP_SAFE_RESTARTS_WITHOUT_RESULT = 3;

/**
 * If an overlap slot has been listening this long with no ASR results, cycle it.
 * Keep well above typical Chrome first-interim latency — 2.5s aborted live slots into crumbs.
 */
export const DEFAULT_OVERLAP_SILENCE_REARM_MS = 8000;

/** Floor for forced-final idle in overlap — Chrome already finals on pause; short timers double-chop. */
export const OVERLAP_FORCE_FINALIZE_MIN_MS = 8000;

/** Buddy arms allowed before the active slot must show new ASR activity again. */
export const OVERLAP_MAX_BUDDY_ARMS_WITHOUT_ACTIVITY = 2;

export function recognitionOverlapModeDesired(
  settings: RecognitionSettings | null | undefined,

  policy = webSpeechRecognitionPolicy,
): boolean {
  if (policy && typeof policy.shouldEnableRecognitionOverlap === "function") {
    return Boolean(policy.shouldEnableRecognitionOverlap(settings));
  }

  return Boolean(
    settings &&
    settings.continuous === false &&
    settings.overlap_recognition_sessions !== false,
  );
}

export function recognitionOverlapActive(state: BrowserAsrState): boolean {
  return (
    Array.isArray(state.recognitionOverlapSlots) &&
    state.recognitionOverlapSlots.length === 2
  );
}

export function overlapActiveSlotIndex(state: BrowserAsrState): number {
  return Number(state.recognitionOverlapActiveSlot || 0) % 2;
}

export function buildOverlapTelemetrySnapshot(
  state: BrowserAsrState,
): Record<string, unknown> {
  const active = recognitionOverlapActive(state);

  const activeSlot = active ? overlapActiveSlotIndex(state) : null;

  const buddySlot = active && activeSlot != null ? (activeSlot + 1) % 2 : null;

  const listening = state.recognitionOverlapSlotListening;

  return {
    overlap_mode_desired: state.effectiveContinuousMode === "segmented_restart",

    overlap_active: active,

    overlap_active_slot: activeSlot,

    overlap_buddy_slot: buddySlot,

    overlap_prestarted: Boolean(state.recognitionOverlapPrestarted),

    overlap_active_listening:
      active && activeSlot != null ? Boolean(listening?.[activeSlot]) : false,

    overlap_buddy_listening:
      active && buddySlot != null ? Boolean(listening?.[buddySlot]) : false,

    // Slot-scoped fields are role-independent: handoff swaps active/buddy before the
    // status snapshot is taken, so the role-relative flags above can never show a
    // listening buddy at the moment of a handoff.
    overlap_slot0_listening: Boolean(listening?.[0]),

    overlap_slot1_listening: Boolean(listening?.[1]),

    overlap_buddy_prestart_ok_count: Number(state.overlapBuddyPrestartOkCount || 0),

    overlap_buddy_prestart_fail_count: Number(
      state.overlapBuddyPrestartFailCount || 0,
    ),

    overlap_buddy_onstart_count: Number(state.overlapBuddyOnstartCount || 0),

    overlap_buddy_onend_count: Number(state.overlapBuddyOnendCount || 0),

    overlap_last_prestart_reason: state.overlapLastPrestartReason || null,

    overlap_last_prestart_error: state.overlapLastPrestartError || null,

    overlap_last_buddy_error: state.overlapLastBuddyError || null,

    overlap_prestart_timer_armed: Boolean(state.overlapPrestartTimerArmed),

    overlap_buddy_arm_attempts: Number(state.overlapBuddyArmAttempts || 0),
  };
}

export function clearOverlapPrestartTimer(state: BrowserAsrState): void {
  if (state.overlapPrestartTimer) {
    clearTimeout(state.overlapPrestartTimer);
  }
  state.overlapPrestartTimer = null;
  state.overlapPrestartTimerArmed = false;
}

/** Active slot produced a result — buddy arms / empty safe-restarts may reset. */
export function noteOverlapActiveActivity(state: BrowserAsrState): void {
  state.overlapBuddyArmAttempts = 0;
  state.overlapSoftRearmEmptyCount = 0;
}

/**
 * Delayed prestart helper (buddy-ended retry only).
 * Finals must call {@link preStartNextOverlapInstance} immediately.
 */
export function scheduleOverlapBuddyPrestart(
  manager: AsrManagerHost,
  reason = "buddy-ended-retry",
): void {
  if (!recognitionOverlapActive(manager.state) || !manager.state.desiredRunning) {
    return;
  }
  if (manager.state.recognitionOverlapPrestarted) {
    return;
  }
  const attempts = Number(manager.state.overlapBuddyArmAttempts || 0);
  if (attempts >= OVERLAP_MAX_BUDDY_ARMS_WITHOUT_ACTIVITY) {
    return;
  }

  clearOverlapPrestartTimer(manager.state);
  const delayMs = overlapLifecycleLimits(manager.state).prestartAfterStartMs;
  const activeAtSchedule = overlapActiveSlotIndex(manager.state);
  const generationId = Number(manager.state.recognitionGenerationId || 0);

  manager.state.overlapPrestartTimerArmed = true;
  manager.state.overlapPrestartTimer = setTimeout(() => {
    manager.state.overlapPrestartTimer = null;
    manager.state.overlapPrestartTimerArmed = false;
    if (
      !manager.state.desiredRunning ||
      !recognitionOverlapActive(manager.state) ||
      Number(manager.state.recognitionGenerationId || 0) !== generationId ||
      overlapActiveSlotIndex(manager.state) !== activeAtSchedule ||
      manager.state.recognitionOverlapPrestarted
    ) {
      return;
    }
    if (!manager.state.recognitionOverlapSlotListening?.[activeAtSchedule]) {
      return;
    }
    preStartNextOverlapInstance(manager, reason);
  }, delayMs);
}

export function overlapSlotInactive(
  state: BrowserAsrState,
  overlapSlotIndex: number | null | undefined,
): boolean {
  return (
    overlapSlotIndex != null &&
    overlapSlotIndex !== overlapActiveSlotIndex(state)
  );
}

export function overlapLifecycleLimits(state: BrowserAsrState): {
  buddyGhostTimeoutMs: number;
  buddyGhostActiveMicMs: number;
  prestartAfterStartMs: number;
  earlyWarmMs: number;
  safeRestartDelayMs: number;
  silenceRearmMs: number;
  hotMicSilenceRearmMs: number;
} {
  const cfg = state.browserLifecycleConfig;
  return {
    prestartAfterStartMs: Math.max(
      0,
      Number(
        cfg?.overlapPrestartAfterStartMs ||
          DEFAULT_OVERLAP_PRESTART_AFTER_START_MS,
      ),
    ),
    earlyWarmMs: Math.max(
      400,
      Number(cfg?.overlapEarlyWarmMs || DEFAULT_OVERLAP_EARLY_WARM_MS),
    ),
    safeRestartDelayMs: Math.max(
      0,
      Number(
        cfg?.overlapSafeRestartDelayMs || DEFAULT_OVERLAP_SAFE_RESTART_DELAY_MS,
      ),
    ),
    silenceRearmMs: Math.max(
      500,
      Number(
        cfg?.overlapSilenceRearmMs || DEFAULT_OVERLAP_SILENCE_REARM_MS,
      ),
    ),
    hotMicSilenceRearmMs: Math.max(
      800,
      Number(
        cfg?.overlapHotMicSilenceRearmMs ||
          DEFAULT_OVERLAP_HOT_MIC_SILENCE_REARM_MS,
      ),
    ),
    buddyGhostTimeoutMs: Math.max(
      2000,
      Number(
        cfg?.overlapBuddyGhostTimeoutMs ||
          DEFAULT_OVERLAP_BUDDY_GHOST_TIMEOUT_MS,
      ),
    ),
    buddyGhostActiveMicMs: Math.max(
      500,
      Number(
        cfg?.overlapBuddyGhostActiveMicMs ||
          DEFAULT_OVERLAP_BUDDY_GHOST_ACTIVE_MIC_MS,
      ),
    ),
  };
}

const OVERLAP_BUDDY_TERMINAL_ERRORS = new Set([
  "not-allowed",
  "service-not-allowed",
]);

/** Soft active-slot ends may still promote a warming buddy; hard errors force global restart. */
const OVERLAP_SOFT_RESTART_REASONS = new Set([
  "no_speech",
  "normal_onend",
  "aborted",
]);

export function isOverlapSoftRestartReason(
  reason: string | null | undefined,
): boolean {
  if (reason == null || reason === "") {
    return true;
  }
  const normalized = String(reason).trim().toLowerCase();
  return OVERLAP_SOFT_RESTART_REASONS.has(normalized);
}

function ensureOverlapSlotTrackingArrays(state: BrowserAsrState): void {
  if (!state.recognitionOverlapSlotListenSinceMs) {
    state.recognitionOverlapSlotListenSinceMs = [null, null];
  }

  if (!state.recognitionOverlapSlotActivityAtMs) {
    state.recognitionOverlapSlotActivityAtMs = [null, null];
  }
}

export function resetOverlapSlotTracking(state: BrowserAsrState): void {
  state.recognitionOverlapSlotListenSinceMs = null;
  state.recognitionOverlapSlotActivityAtMs = null;
}

export function markOverlapSlotListenStarted(
  state: BrowserAsrState,
  overlapSlotIndex: number,
  nowMs: number,
): void {
  ensureOverlapSlotTrackingArrays(state);

  state.recognitionOverlapSlotListenSinceMs![overlapSlotIndex] = nowMs;

  state.recognitionOverlapSlotActivityAtMs![overlapSlotIndex] = null;
}

export function markOverlapSlotActivity(
  state: BrowserAsrState,
  overlapSlotIndex: number,
  nowMs: number,
): void {
  ensureOverlapSlotTrackingArrays(state);

  state.recognitionOverlapSlotActivityAtMs![overlapSlotIndex] = nowMs;
}

export function onOverlapActiveSlotReady(
  manager: AsrManagerHost,
  overlapSlotIndex: number | null,
): void {
  if (overlapSlotIndex == null || !recognitionOverlapActive(manager.state)) {
    return;
  }

  markOverlapSlotListenStarted(manager.state, overlapSlotIndex, manager.now());

  // Do NOT early-warm the buddy here. Starting a second SpeechRecognition while the
  // active slot is mid-utterance makes Chrome abort/chop the active session (~1–2 s
  // thrash). Buddy is armed on final / forced-final only (true nabest is limited by Chrome).
}

/**

 * Pre-started buddy sessions often end with no-speech/aborted while the active slot

 * is still listening. Those events must not schedule a global restart.

 */

export function shouldIgnoreOverlapBuddyError(
  state: BrowserAsrState,

  overlapSlotIndex: number | null | undefined,

  errorKind: string,
): boolean {
  if (
    !recognitionOverlapActive(state) ||
    !overlapSlotInactive(state, overlapSlotIndex)
  ) {
    return false;
  }

  const normalized = String(errorKind || "")
    .trim()

    .toLowerCase();

  if (OVERLAP_BUDDY_TERMINAL_ERRORS.has(normalized)) {
    return false;
  }

  if (
    normalized === "language-not-supported" ||
    normalized === "phrases-not-supported"
  ) {
    return false;
  }

  return true;
}

/** @returns true when the inactive buddy end was consumed locally */

export function handleInactiveOverlapBuddyEnded(
  manager: AsrManagerHost,

  overlapSlotIndex: number,
): boolean {
  if (
    !recognitionOverlapActive(manager.state) ||
    !overlapSlotInactive(manager.state, overlapSlotIndex)
  ) {
    return false;
  }

  // 0.5.5: any pendingRestartReason falls through to generation restart.
  if (manager.state.pendingRestartReason) {
    return false;
  }

  if (!manager.state.recognitionOverlapSlotListening) {
    manager.state.recognitionOverlapSlotListening = [false, false];
  }

  manager.state.recognitionOverlapSlotListening[overlapSlotIndex] = false;

  manager.state.recognitionOverlapPrestarted = false;

  ensureOverlapSlotTrackingArrays(manager.state);

  manager.state.recognitionOverlapSlotListenSinceMs![overlapSlotIndex] = null;

  manager.state.recognitionOverlapSlotActivityAtMs![overlapSlotIndex] = null;

  // If buddy dies early, wait for the next final to preStart again.
  // Re-arming immediately while active is speaking restarts dual Web Speech and
  // Chrome often aborts the active slot (same thrash as early-warm).
  manager.state.recognitionOverlapPrestarted = false;

  manager.emitWorkerStatus("overlap-buddy-ended");

  return true;
}

/** Ignore buddy shadow older than this at handoff (stale from a prior cycle). */
export const OVERLAP_BUDDY_SHADOW_MAX_AGE_MS = 5000;

export function clearOverlapBuddyShadow(state: BrowserAsrState): void {
  state.overlapBuddyShadowPartial = "";
  state.overlapBuddyShadowSlot = null;
  state.overlapBuddyShadowAtMs = 0;
}

/** Cache warming-buddy hypotheses; active slot still owns live publish. */
export function noteOverlapBuddyShadow(
  state: BrowserAsrState,
  slotIndex: number,
  text: string,
  nowMs: number,
): void {
  const normalized = String(text || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!normalized) {
    return;
  }
  // Keep the longer buddy hypothesis; Chrome also rewrites buddy interims shorter.
  state.overlapBuddyShadowPartial = preferStableOverlapPartial(
    state.overlapBuddyShadowPartial || "",
    normalized,
  );
  state.overlapBuddyShadowSlot = slotIndex;
  state.overlapBuddyShadowAtMs = nowMs;
}

/**
 * After promoting the buddy to active, publish its last cached hypothesis immediately.
 * Chrome often will not re-fire onresult for an unchanged hypothesis after handoff.
 */
export function flushOverlapBuddyShadowOnHandoff(manager: AsrManagerHost): boolean {
  if (!recognitionOverlapActive(manager.state)) {
    clearOverlapBuddyShadow(manager.state);
    return false;
  }
  const text = String(manager.state.overlapBuddyShadowPartial || "")
    .trim()
    .replace(/\s+/g, " ");
  const shadowSlot = manager.state.overlapBuddyShadowSlot;
  const shadowAt = Number(manager.state.overlapBuddyShadowAtMs || 0);
  const active = overlapActiveSlotIndex(manager.state);
  const nowMs = manager.now();
  clearOverlapBuddyShadow(manager.state);

  if (!text || shadowSlot == null || shadowSlot !== active) {
    return false;
  }
  if (!shadowAt || nowMs - shadowAt > OVERLAP_BUDDY_SHADOW_MAX_AGE_MS) {
    return false;
  }

  const ok = manager.softCommitOverlapPhraseInternal(text, "overlap-buddy-shadow-flush");
  if (ok) {
    manager.appendLogInternal(
      `overlap: flushed buddy shadow on handoff (chars=${text.length})`,
    );
    manager.emitWorkerStatus("overlap-buddy-shadow-flush");
  }
  return ok;
}

export function overlapResultAllowed(
  state: BrowserAsrState,
  overlapSlotIndex: number | null | undefined,
): boolean {
  if (overlapSlotIndex == null) {
    return true;
  }

  if (!recognitionOverlapActive(state)) {
    return true;
  }

  const active = Number(state.recognitionOverlapActiveSlot || 0) % 2;
  return overlapSlotIndex === active;
}

export function createOverlapRecognitionPair(
  manager: AsrManagerHost,
  generationId: number,
): WorkerSpeechRecognition[] {
  resetOverlapSlotTracking(manager.state);

  const slots = [
    new manager.SpeechRecognitionCtor!(),
    new manager.SpeechRecognitionCtor!(),
  ] as [WorkerSpeechRecognition, WorkerSpeechRecognition];

  slots[0].maxAlternatives = 1;

  slots[1].maxAlternatives = 1;

  manager.state.recognitionOverlapSlots = slots;

  manager.state.recognitionOverlapActiveSlot = 0;

  manager.state.recognitionOverlapPrestarted = false;

  manager.state.recognitionOverlapSlotListening = [false, false];

  manager.state.overlapBuddyArmAttempts = 0;
  manager.state.overlapSoftRearmEmptyCount = 0;
  manager.state.lastOverlapSoftRearmAtMs = 0;
  manager.state.overlapSafeRestartInProgress = false;
  clearOverlapBuddyShadow(manager.state);

  clearOverlapPrestartTimer(manager.state);

  manager.state.recognitionGenerationId = generationId;

  manager.state.recognition = slots[0];

  manager.applyRecognitionSettings();

  manager.wireRecognitionHandlers(slots[0], generationId, 0);

  manager.wireRecognitionHandlers(slots[1], generationId, 1);

  return slots;
}

/**
 * Start the buddy slot while the active slot is still alive.
 * Always recreates the idle slot first — after Chrome `onend` the previous instance
 * is unreliable to `start()` again (JP/CN/US restart guidance: spawn fresh).
 */
export function preStartNextOverlapInstance(
  manager: AsrManagerHost,
  reason = "segment-final",
): void {
  if (
    !recognitionOverlapActive(manager.state) ||
    !manager.state.desiredRunning ||
    manager.state.recognitionOverlapPrestarted
  ) {
    return;
  }

  manager.clearForceFinalizeTimerInternal();

  const active = overlapActiveSlotIndex(manager.state);
  if (!manager.state.recognitionOverlapSlots) {
    return;
  }

  const buddy = (active + 1) % 2;

  if (manager.state.recognitionOverlapSlotListening?.[buddy]) {
    manager.state.recognitionOverlapPrestarted = true;
    return;
  }

  const attempts = Number(manager.state.overlapBuddyArmAttempts || 0);
  if (attempts >= OVERLAP_MAX_BUDDY_ARMS_WITHOUT_ACTIVITY) {
    manager.appendLogInternal(
      `overlap: buddy arm cap reached (${attempts}); skip prestart (${reason})`,
    );
    return;
  }

  const buddyRec = recreateOverlapSlot(manager, buddy);
  if (!buddyRec) {
    return;
  }

  manager.state.overlapLastPrestartReason = reason;
  manager.state.overlapBuddyArmAttempts = attempts + 1;

  try {
    buddyRec.start();
    manager.state.recognitionOverlapPrestarted = true;
    manager.state.overlapLastPrestartError = null;
    manager.state.overlapBuddyPrestartOkCount =
      Number(manager.state.overlapBuddyPrestartOkCount || 0) + 1;
    manager.appendLogInternal(`overlap: pre-started buddy slot (${reason})`);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error || "buddy start failed");
    manager.state.overlapLastPrestartError = message;
    manager.state.overlapBuddyPrestartFailCount =
      Number(manager.state.overlapBuddyPrestartFailCount || 0) + 1;
    manager.appendLogInternal(
      `overlap: buddy pre-start failed (${reason}): ${message}`,
    );
    scheduleOverlapBuddyPrestartRetry(manager, active, reason);
  }
}

/** One delayed retry with another fresh buddy instance (~100 ms). */
function scheduleOverlapBuddyPrestartRetry(
  manager: AsrManagerHost,
  activeAtFail: number,
  reason: string,
): void {
  globalThis.setTimeout(() => {
    if (
      !recognitionOverlapActive(manager.state) ||
      !manager.state.desiredRunning ||
      overlapActiveSlotIndex(manager.state) !== activeAtFail ||
      manager.state.recognitionOverlapPrestarted
    ) {
      return;
    }
    const buddy = (activeAtFail + 1) % 2;
    if (manager.state.recognitionOverlapSlotListening?.[buddy]) {
      return;
    }
    const buddyRec = recreateOverlapSlot(manager, buddy);
    if (!buddyRec) {
      return;
    }
    try {
      buddyRec.start();
      manager.state.recognitionOverlapPrestarted = true;
      manager.state.overlapLastPrestartError = null;
      manager.state.overlapBuddyPrestartOkCount =
        Number(manager.state.overlapBuddyPrestartOkCount || 0) + 1;
      manager.appendLogInternal(
        `overlap: pre-started buddy slot (${reason}, retry)`,
      );
    } catch (retryError) {
      const retryMessage =
        retryError instanceof Error
          ? retryError.message
          : String(retryError || "buddy start failed");
      manager.state.overlapLastPrestartError = retryMessage;
      manager.state.overlapBuddyPrestartFailCount =
        Number(manager.state.overlapBuddyPrestartFailCount || 0) + 1;
      manager.appendLogInternal(
        `overlap: buddy pre-start retry failed (${reason}): ${retryMessage}`,
      );
    }
  }, 100);
}

function detachOverlapSlotHandlers(
  rec: WorkerSpeechRecognition | null | undefined,
): void {
  if (!rec) {
    return;
  }
  // Detach first so abort()/stop() cannot re-enter live handlers.
  rec.onstart = null;
  rec.onend = null;
  rec.onerror = null;
  rec.onresult = null;
  rec.onsoundstart = null;
  rec.onsoundend = null;
  rec.onspeechstart = null;
  rec.onspeechend = null;
  rec.onaudiostart = null;
  rec.onaudioend = null;
  try {
    rec.abort();
  } catch {
    // best effort
  }
}

/** Fresh SpeechRecognition for a slot (required after Chrome onend). */
export function recreateOverlapSlot(
  manager: AsrManagerHost,
  slotIndex: number,
): WorkerSpeechRecognition | null {
  if (!recognitionOverlapActive(manager.state) || !manager.SpeechRecognitionCtor) {
    return null;
  }
  const slots = manager.state.recognitionOverlapSlots;
  if (!slots) {
    return null;
  }

  detachOverlapSlotHandlers(slots[slotIndex]);

  const rec = new manager.SpeechRecognitionCtor() as WorkerSpeechRecognition;
  rec.maxAlternatives = 1;
  slots[slotIndex] = rec;

  if (!manager.state.recognitionOverlapSlotListening) {
    manager.state.recognitionOverlapSlotListening = [false, false];
  }
  manager.state.recognitionOverlapSlotListening[slotIndex] = false;

  ensureOverlapSlotTrackingArrays(manager.state);
  manager.state.recognitionOverlapSlotListenSinceMs![slotIndex] = null;
  manager.state.recognitionOverlapSlotActivityAtMs![slotIndex] = null;

  if (manager.state.overlapBuddyShadowSlot === slotIndex) {
    clearOverlapBuddyShadow(manager.state);
  }

  manager.wireRecognitionHandlers(
    rec,
    Number(manager.state.recognitionGenerationId || 0),
    slotIndex,
  );
  manager.applyRecognitionSettings();
  return rec;
}

/**
 * Promote the other slot as active and refresh the ended idle (`switchToNextInstance`).
 */
export function switchToNextOverlapInstance(
  manager: AsrManagerHost,
  endedSlotIndex: number,
): void {
  const next = (endedSlotIndex + 1) % 2;
  manager.clearForceFinalizeTimerInternal();
  clearOverlapPrestartTimer(manager.state);
  manager.state.recognitionOverlapActiveSlot = next;
  manager.state.recognition =
    manager.state.recognitionOverlapSlots?.[next] ?? null;
  manager.state.recognitionOverlapPrestarted = false;
  manager.state.pendingRestartReason = null;
  recreateOverlapSlot(manager, endedSlotIndex);
  manager.appendLogInternal(
    `overlap: switchToNextInstance ${endedSlotIndex} → ${next}`,
  );
  flushOverlapBuddyShadowOnHandoff(manager);
}

/** @returns true when active end was handed off to a listening/warming buddy. */
export function handleOverlapRecognitionEnded(
  manager: AsrManagerHost,
  overlapSlotIndex: number,
): boolean {
  if (!recognitionOverlapActive(manager.state)) {
    return false;
  }

  if (!manager.state.recognitionOverlapSlotListening) {
    manager.state.recognitionOverlapSlotListening = [false, false];
  }

  manager.state.recognitionOverlapSlotListening[overlapSlotIndex] = false;

  ensureOverlapSlotTrackingArrays(manager.state);

  manager.state.recognitionOverlapSlotListenSinceMs![overlapSlotIndex] = null;

  manager.state.recognitionOverlapSlotActivityAtMs![overlapSlotIndex] = null;

  if (!manager.state.desiredRunning) {
    return false;
  }

  const active = Number(manager.state.recognitionOverlapActiveSlot || 0) % 2;
  const buddy = (active + 1) % 2;

  if (overlapSlotIndex !== active) {
    return false;
  }

  const buddyReady = Boolean(
    manager.state.recognitionOverlapSlotListening[buddy],
  );
  const buddyWarming =
    !buddyReady &&
    Boolean(manager.state.recognitionOverlapPrestarted) &&
    !manager.state.pendingRestartReason;

  if (!buddyReady && !buddyWarming) {
    return false;
  }

  switchToNextOverlapInstance(manager, overlapSlotIndex);

  manager.setSupervisorStateInternal("running");
  manager.setRecognitionStateInternal("running");

  if (buddyWarming) {
    manager.appendLogInternal(
      "overlap: promoted warming buddy slot on active onend (race-safe handoff)",
    );
  }

  // Next buddy is armed on the *next* final, not immediately post-handoff.
  manager.emitWorkerStatus("recognition-ended");
  return true;
}

/**
 * No buddy ready — flip slots and start after a short delay (`safeRestartRecognition`).
 * Stays in-generation for soft ends; hard errors return false → full generation restart.
 */
export function safeRestartOverlapRecognition(
  manager: AsrManagerHost,
  endedSlotIndex: number,
): boolean {
  if (!recognitionOverlapActive(manager.state) || !manager.state.desiredRunning) {
    return false;
  }

  if (!isOverlapSoftRestartReason(manager.state.pendingRestartReason)) {
    return false;
  }

  if (manager.state.overlapSafeRestartInProgress) {
    manager.appendLogInternal(
      "overlap: safeRestart skipped (already in progress)",
    );
    return false;
  }

  const emptyCount = Number(manager.state.overlapSoftRearmEmptyCount || 0);
  if (emptyCount >= MAX_OVERLAP_SAFE_RESTARTS_WITHOUT_RESULT) {
    manager.appendLogInternal(
      `overlap: safeRestart cap reached (${emptyCount}); generation restart`,
    );
    return false;
  }

  const active = Number(manager.state.recognitionOverlapActiveSlot || 0) % 2;
  if (endedSlotIndex !== active) {
    return false;
  }

  manager.clearForceFinalizeTimerInternal();
  clearOverlapPrestartTimer(manager.state);
  manager.state.pendingRestartReason = null;
  manager.state.recognitionOverlapPrestarted = false;
  manager.state.overlapSoftRearmEmptyCount = emptyCount + 1;
  manager.state.lastOverlapSoftRearmAtMs = manager.now();
  manager.state.onSound = false;
  manager.state.overlapSafeRestartInProgress = true;

  const next = (endedSlotIndex + 1) % 2;
  switchToNextOverlapInstance(manager, endedSlotIndex);

  const fresh = recreateOverlapSlot(manager, next);
  if (!fresh) {
    manager.state.overlapSafeRestartInProgress = false;
    return false;
  }
  manager.state.recognition = fresh;
  manager.setSupervisorStateInternal("starting");
  manager.setRecognitionStateInternal("starting");
  manager.setStatusInternal("restarting");

  const delayMs = overlapLifecycleLimits(manager.state).safeRestartDelayMs;
  const generationId = Number(manager.state.recognitionGenerationId || 0);
  const slotAtArm = next;

  manager.appendLogInternal(
    `overlap: safeRestartRecognition in ${delayMs}ms (empty=${manager.state.overlapSoftRearmEmptyCount})`,
  );
  manager.emitWorkerStatus("overlap-safe-restart");

  globalThis.setTimeout(() => {
    manager.state.overlapSafeRestartInProgress = false;
    if (
      !manager.state.desiredRunning ||
      !recognitionOverlapActive(manager.state) ||
      Number(manager.state.recognitionGenerationId || 0) !== generationId ||
      overlapActiveSlotIndex(manager.state) !== slotAtArm
    ) {
      return;
    }
    const rec = manager.state.recognitionOverlapSlots?.[slotAtArm];
    if (!rec) {
      return;
    }
    try {
      rec.start();
      manager.appendLogInternal("overlap: safeRestart start ok");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error || "start failed");
      if (String(message).toLowerCase().includes("already started")) {
        manager.setSupervisorStateInternal("running");
        manager.setRecognitionStateInternal("running");
        manager.setStatusInternal("listening");
        return;
      }
      manager.appendLogInternal(`overlap: safeRestart start failed: ${message}`);
      manager.scheduleRestartInternal("normal_onend");
    }
  }, delayMs);

  return true;
}

/** @deprecated Use {@link safeRestartOverlapRecognition}. */
export function tryOverlapSoftRearmOnActiveEnd(
  manager: AsrManagerHost,
  endedSlotIndex: number,
): boolean {
  return safeRestartOverlapRecognition(manager, endedSlotIndex);
}

/** Dual-buffer aliases used by the overlap handoff loop. */
export const preStartNextInstance = preStartNextOverlapInstance;
export const switchToNextInstance = switchToNextOverlapInstance;
export const safeRestartRecognition = safeRestartOverlapRecognition;

/**
 * Overlap slot has been listening with no ASR results past the silence budget.
 * Used instead of waiting for Chrome's ~8s no-speech end (and instead of marking
 * web_speech_stalled without recovery).
 *
 * Soft-join may leave a stale `currentPartial` from the previous slot — that must
 * not block rearm when this slot never produced a result.
 */
export function evaluateOverlapSilenceRearm(
  state: BrowserAsrState,
  nowMs: number,
  options: { micHot?: boolean } = {},
): boolean {
  if (
    !recognitionOverlapActive(state) ||
    state.browserSupervisorState !== "running" ||
    !state.desiredRunning
  ) {
    return false;
  }

  if (state.overlapPrestartTimerArmed) {
    return false;
  }

  if (state.overlapSafeRestartInProgress) {
    return false;
  }

  const active = overlapActiveSlotIndex(state);
  if (!state.recognitionOverlapSlotListening?.[active]) {
    return false;
  }

  const startedAt = Number(state.lastStartAtMs || 0);
  if (!startedAt) {
    return false;
  }

  const lastResultAt = Number(state.lastResultAtMs || 0);
  if (lastResultAt >= startedAt) {
    return false;
  }

  // Live partial from *this* slot start — wait for force-final / Chrome end.
  const partialStable = Number(state.currentPartialStableSinceMs || 0);
  if (String(state.currentPartial || "").trim() && partialStable >= startedAt) {
    return false;
  }

  const limits = overlapLifecycleLimits(state);
  const silenceMs = options.micHot
    ? Math.min(limits.silenceRearmMs, limits.hotMicSilenceRearmMs)
    : limits.silenceRearmMs;
  if (nowMs - startedAt < silenceMs) {
    return false;
  }

  return true;
}

/** Soft-stop the active overlap slot so onend can hand off / restart a zombie idle session. */
export function requestOverlapSilenceRearm(
  manager: AsrManagerHost,
  reason = "overlap-silence-rearm",
  options: { micHot?: boolean } = {},
): boolean {
  if (!evaluateOverlapSilenceRearm(manager.state, manager.now(), options)) {
    return false;
  }

  const active = overlapActiveSlotIndex(manager.state);
  const rec = manager.state.recognitionOverlapSlots?.[active];
  if (!rec) {
    return false;
  }

  manager.appendLogInternal(`overlap: silence rearm (${reason})`);
  manager.state.pendingRestartReason = "normal_onend";
  try {
    rec.stop();
  } catch {
    try {
      rec.abort();
    } catch {
      // best effort — soft-rearm path needs onend
    }
  }
  manager.emitWorkerStatus("overlap-silence-rearm");
  return true;
}

export function evaluateOverlapBuddyGhost(
  state: BrowserAsrState,
  nowMs: number,
): boolean {
  if (
    !recognitionOverlapActive(state) ||
    state.browserSupervisorState !== "running"
  ) {
    return false;
  }

  if (
    !state.recognitionOverlapPrestarted ||
    !state.recognitionOverlapSlotListening
  ) {
    return false;
  }

  const active = overlapActiveSlotIndex(state);

  const buddy = (active + 1) % 2;

  if (
    !state.recognitionOverlapSlotListening[active] ||
    !state.recognitionOverlapSlotListening[buddy]
  ) {
    return false;
  }

  ensureOverlapSlotTrackingArrays(state);

  const buddyListenSince = state.recognitionOverlapSlotListenSinceMs![buddy];

  if (buddyListenSince == null) {
    return false;
  }

  const limits = overlapLifecycleLimits(state);

  if (nowMs - buddyListenSince < limits.buddyGhostTimeoutMs) {
    return false;
  }

  const buddyActivity = state.recognitionOverlapSlotActivityAtMs![buddy];

  if (buddyActivity != null && buddyActivity >= buddyListenSince) {
    return false;
  }

  const lastResultAt = Number(state.lastResultAtMs || 0);

  const lastMicAt = Number(state.lastMicActivityAt || 0);

  const activeSlotActivity = state.recognitionOverlapSlotActivityAtMs![active];

  const activeMicRecent =
    lastMicAt > 0 && nowMs - lastMicAt <= limits.buddyGhostActiveMicMs;

  const activeResultsRecent =
    lastResultAt > 0 && nowMs - lastResultAt <= limits.buddyGhostActiveMicMs;

  const activeSlotRecentlyActive =
    activeSlotActivity != null &&
    nowMs - activeSlotActivity <= limits.buddyGhostActiveMicMs;

  // Buddy silence while active transcribes is normal overlap handoff prep — never abort then.

  if (activeMicRecent || activeResultsRecent || activeSlotRecentlyActive) {
    return false;
  }

  const micQuietFor =
    lastMicAt > 0 ? nowMs - lastMicAt : limits.buddyGhostTimeoutMs;

  const resultsQuietFor =
    lastResultAt > 0 ? nowMs - lastResultAt : limits.buddyGhostTimeoutMs;

  const slotQuietFor =
    activeSlotActivity != null
      ? nowMs - activeSlotActivity
      : limits.buddyGhostTimeoutMs;

  const activeQuietForMs = Math.min(micQuietFor, resultsQuietFor, slotQuietFor);

  // Require sustained idle on active before treating buddy as a zombie (avoids inter-phrase false positives).

  if (activeQuietForMs < limits.buddyGhostTimeoutMs) {
    return false;
  }

  return true;
}

/** @returns true when a ghost buddy slot was aborted and prestart was retried */

export function recoverGhostOverlapBuddy(
  manager: AsrManagerHost,
  nowMs: number,
): boolean {
  if (!evaluateOverlapBuddyGhost(manager.state, nowMs)) {
    return false;
  }

  const active = overlapActiveSlotIndex(manager.state);

  const buddy = (active + 1) % 2;

  const slots = manager.state.recognitionOverlapSlots;

  const buddyRec = slots?.[buddy];

  if (!buddyRec) {
    return false;
  }

  manager.appendLogInternal(
    "overlap: aborting ghost buddy slot (silent buddy while both slots appear idle; retrying prestart)",
  );

  try {
    buddyRec.abort();
  } catch {
    // best effort
  }

  if (!manager.state.recognitionOverlapSlotListening) {
    manager.state.recognitionOverlapSlotListening = [false, false];
  }

  manager.state.recognitionOverlapSlotListening[buddy] = false;

  manager.state.recognitionOverlapPrestarted = false;

  ensureOverlapSlotTrackingArrays(manager.state);

  manager.state.recognitionOverlapSlotListenSinceMs![buddy] = null;

  manager.state.recognitionOverlapSlotActivityAtMs![buddy] = null;

  preStartNextOverlapInstance(manager, "ghost-recovery");

  manager.emitWorkerStatus("overlap-buddy-ghost-recovered");

  return true;
}
