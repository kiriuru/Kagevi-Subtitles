export function normalizeDiagnosticsPayload(
  payload: Record<string, unknown> | null | undefined,
  previous?: Record<string, unknown> | null,
) {
  const current = payload && typeof payload === "object" ? payload : {};
  const prev = previous && typeof previous === "object" ? previous : {};
  const localModule =
    current.local_module && typeof current.local_module === "object"
      ? { ...(current.local_module as Record<string, unknown>) }
      : prev.local_module && typeof prev.local_module === "object"
        ? { ...(prev.local_module as Record<string, unknown>) }
        : undefined;
  const browserWorker =
    current.browser_worker && typeof current.browser_worker === "object"
      ? { ...(current.browser_worker as Record<string, unknown>) }
      : prev.browser_worker && typeof prev.browser_worker === "object"
        ? { ...(prev.browser_worker as Record<string, unknown>) }
        : null;
  const activeMode = current.active_mode || current.mode || prev.active_mode;
  const numberOrNull = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

  return {
    ...prev,
    ...current,
    provider: String(current.provider || activeMode || prev.provider || ""),
    active_mode: activeMode ? String(activeMode) : undefined,
    selected_device: String(
      current.selected_device ?? prev.selected_device ?? "",
    ),
    selected_execution_provider: String(
      current.selected_execution_provider ?? prev.selected_execution_provider ?? "",
    ),
    partials_supported:
      current.partials_supported === true || prev.partials_supported === true,
    browser_worker: browserWorker,
    local_module: localModule,
    message: String(
      current.message || current.provider_message || prev.message || "",
    ),
    degraded_mode: current.degraded_mode === true || prev.degraded_mode === true,
    partial_emit_mode: String(
      current.partial_emit_mode || prev.partial_emit_mode || "",
    ),
    partial_min_new_words:
      numberOrNull(current.partial_min_new_words) ??
      numberOrNull(prev.partial_min_new_words),
    true_streaming: current.true_streaming === true || prev.true_streaming === true,
    decode_count:
      numberOrNull(current.decode_count) ?? numberOrNull(prev.decode_count),
    partial_emits:
      numberOrNull(current.partial_emits) ?? numberOrNull(prev.partial_emits),
    final_emits:
      numberOrNull(current.final_emits) ?? numberOrNull(prev.final_emits),
    last_decode_wall_ms:
      numberOrNull(current.last_decode_wall_ms) ??
      numberOrNull(prev.last_decode_wall_ms),
    last_first_partial_ms:
      numberOrNull(current.last_first_partial_ms) ??
      numberOrNull(prev.last_first_partial_ms),
    last_final_ms:
      numberOrNull(current.last_final_ms) ?? numberOrNull(prev.last_final_ms),
    provider_phase: String(
      current.provider_phase || prev.provider_phase || "",
    ),
    runtime_initialized:
      current.runtime_initialized === true || prev.runtime_initialized === true,
    raw: current,
  };
}
