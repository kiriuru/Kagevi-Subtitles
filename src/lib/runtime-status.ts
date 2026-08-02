import {
  ASR_MODE_BROWSER,
  ASR_MODE_LOCAL_PARAKEET,
  isLocalAsrMode,
  normalizeAsrMode,
} from "./asr-mode";
import type { RuntimeStatus } from "./types";

export type RuntimePhaseChip =
  | "idle"
  | "starting"
  | "listening"
  | "transcribing"
  | "translating"
  | "error";

export const RUNTIME_STATE_PHASES: RuntimePhaseChip[] = [
  "idle",
  "starting",
  "listening",
  "transcribing",
  "translating",
  "error",
];

export type ObsChipStatus = "ready" | "disabled" | "error" | "warn" | "waiting";

export type ObsChipLabelKind = "disabled" | "mode" | "connection" | "error" | "no_stream";

export interface RuntimeConnectionChips {
  phase: string;
  running: boolean;
  wsConnected: boolean;
  workerConnected: boolean;
  asrMode: string;
  asrModeLabelKey: string;
  asrSourceConnected: boolean;
  showBrowserWorkerChip: boolean;
  showLocalAsrChip: boolean;
  obsStatus: ObsChipStatus;
  /** Formatting hint for `formatObsChipLabel` in obs-status-i18n. */
  obsLabelKind: ObsChipLabelKind;
  obsLabelCode: string;
  /** @deprecated Prefer formatObsChipLabel(obsLabelKind, obsLabelCode). Kept as raw code for tests. */
  obsLabel: string;
  lastError: string | null;
  statusMessage: string | null;
}

export function resolveRuntimePhase(runtime: RuntimeStatus): string {
  return String(runtime.phase || runtime.status || "idle");
}

const CONNECTION_ERRORS = new Set([
  "password_required",
  "auth_failed",
  "connection_refused",
  "connection_timeout",
  "connection_failed",
  "connection_lost",
  "protocol_error",
  "not_connected",
  "send_failed",
  "request_failed",
]);

/** Stream-not-running is readiness, not a transport failure. */
function isStreamReadinessCode(code: string): boolean {
  return code === "stream_not_running";
}

export function resolveObsChipStatus(
  obsDiagnostics: Record<string, unknown> | undefined,
  _runtime: RuntimeStatus,
): {
  status: ObsChipStatus;
  labelKind: ObsChipLabelKind;
  labelCode: string;
  label: string;
} {
  const obsDiag =
    obsDiagnostics || {};
  const enabled = obsDiag.enabled === true;
  const connectionState = String(obsDiag.connection_state || "disabled").trim().toLowerCase();
  const connected = obsDiag.connected === true || connectionState === "connected";
  const lastError = String(obsDiag.last_error || "").trim();
  const nativeStatus = String(obsDiag.native_caption_status || "").trim();
  const streamActive = obsDiag.stream_output_active;
  const outputMode = String(obsDiag.output_mode || "disabled");

  if (!enabled || connectionState === "disabled") {
    return {
      status: "disabled",
      labelKind: "disabled",
      labelCode: "disabled",
      label: "disabled",
    };
  }

  if (connectionState === "auth_failed" || (lastError && CONNECTION_ERRORS.has(lastError) && !connected)) {
    const code = lastError || connectionState || "connection_failed";
    return {
      status: "error",
      labelKind: "error",
      labelCode: code,
      label: code,
    };
  }

  if (connectionState === "error" && lastError && !isStreamReadinessCode(lastError)) {
    return {
      status: "error",
      labelKind: "error",
      labelCode: lastError,
      label: lastError,
    };
  }

  if (
    connected &&
    (streamActive === false ||
      nativeStatus === "stream_not_running" ||
      nativeStatus === "stream_inactive" ||
      isStreamReadinessCode(lastError))
  ) {
    return {
      status: "warn",
      labelKind: "no_stream",
      labelCode: "no_stream",
      label: "no_stream",
    };
  }

  if (connected || connectionState === "connected") {
    return {
      status: "ready",
      labelKind: "mode",
      labelCode: outputMode,
      label: outputMode,
    };
  }

  if (
    connectionState === "connecting" ||
    connectionState === "disconnected" ||
    !lastError
  ) {
    return {
      status: "waiting",
      labelKind: "connection",
      labelCode: connectionState === "disconnected" ? "disconnected" : "connecting",
      label: connectionState === "disconnected" ? "disconnected" : "connecting",
    };
  }

  return {
    status: "error",
    labelKind: "error",
    labelCode: lastError || "connection_failed",
    label: lastError || "connection_failed",
  };
}

export function buildRuntimeConnectionChips(
  runtime: RuntimeStatus,
  wsConnected: boolean,
  obsDiagnostics?: Record<string, unknown>,
): RuntimeConnectionChips {
  const browserWorker = runtime.asr?.diagnostics?.browser_worker as Record<string, unknown> | undefined;
  const obsDiag =
    obsDiagnostics || (runtime.obs_caption_diagnostics as Record<string, unknown> | undefined) || {};
  const obs = resolveObsChipStatus(obsDiag, runtime);
  const asrMode = normalizeAsrMode(runtime.asr?.active_mode || ASR_MODE_BROWSER);
  const useLocalAsr = isLocalAsrMode(asrMode);
  const phase = resolveRuntimePhase(runtime);
  const running = Boolean(runtime.running || runtime.is_running);

  const asrSourceConnected = useLocalAsr
    ? running && (phase === "listening" || phase === "transcribing")
    : Boolean(browserWorker?.worker_connected);

  return {
    phase,
    running,
    wsConnected,
    workerConnected: Boolean(browserWorker?.worker_connected),
    asrMode,
    asrModeLabelKey:
      asrMode === ASR_MODE_LOCAL_PARAKEET
        ? "overview.recognition.mode.local_asr"
        : "overview.recognition.mode.browser_google",
    asrSourceConnected,
    showBrowserWorkerChip: !useLocalAsr,
    showLocalAsrChip: useLocalAsr,
    obsStatus: obs.status,
    obsLabelKind: obs.labelKind,
    obsLabelCode: obs.labelCode,
    obsLabel: obs.label,
    lastError: runtime.last_error ? String(runtime.last_error) : null,
    statusMessage: runtime.status_message ? String(runtime.status_message) : null,
  };
}
