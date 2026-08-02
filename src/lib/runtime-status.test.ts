import { describe, expect, it } from "vitest";
import {
  buildRuntimeConnectionChips,
  resolveObsChipStatus,
  resolveRuntimePhase,
} from "./runtime-status";
import type { RuntimeStatus } from "./types";

describe("runtime-status", () => {
  it("resolves runtime phase from status fallback", () => {
    expect(resolveRuntimePhase({ status: "listening" })).toBe("listening");
    expect(resolveRuntimePhase({ phase: "translating" })).toBe("translating");
  });

  it("maps OBS diagnostics to chip status", () => {
    expect(
      resolveObsChipStatus({ enabled: true, connection_state: "connected", output_mode: "source_live" }, {})
        .status,
    ).toBe("ready");
    expect(
      resolveObsChipStatus(
        { enabled: true, last_error: "auth_failed", connection_state: "auth_failed" },
        {},
      ).status,
    ).toBe("error");
    expect(resolveObsChipStatus({}, {}).status).toBe("disabled");
  });

  it("treats stream_not_running as warn while connected", () => {
    const chip = resolveObsChipStatus(
      {
        enabled: true,
        connected: true,
        connection_state: "connected",
        stream_output_active: false,
        native_caption_status: "stream_not_running",
        last_error: "stream_not_running",
        output_mode: "source_live",
      },
      {},
    );
    expect(chip.status).toBe("warn");
    expect(chip.labelKind).toBe("no_stream");
  });

  it("shows waiting when enabled but not yet connected", () => {
    const chip = resolveObsChipStatus(
      {
        enabled: true,
        connection_state: "connecting",
        output_mode: "source_live",
      },
      {},
    );
    expect(chip.status).toBe("waiting");
  });

  it("builds connection chips for live strip", () => {
    const runtime: RuntimeStatus = {
      running: true,
      phase: "listening",
      asr: {
        active_mode: "browser_google",
        diagnostics: { browser_worker: { worker_connected: true } },
      },
    };
    const chips = buildRuntimeConnectionChips(runtime, true, {
      enabled: true,
      connection_state: "connected",
      connected: true,
      stream_output_active: true,
      output_mode: "source_live",
    });
    expect(chips.workerConnected).toBe(true);
    expect(chips.showBrowserWorkerChip).toBe(true);
    expect(chips.showLocalAsrChip).toBe(false);
    expect(chips.obsStatus).toBe("ready");
    expect(chips.obsLabel).toBe("source_live");
  });

  it("uses local ASR chips and status message when active mode is local_parakeet", () => {
    const runtime: RuntimeStatus = {
      running: true,
      phase: "listening",
      status_message: "Loading Parakeet TDT int8 (CUDA)…",
      asr: {
        active_mode: "local_parakeet",
        diagnostics: { browser_worker: { worker_connected: false } },
      },
    };
    const chips = buildRuntimeConnectionChips(runtime, true, {});
    expect(chips.showLocalAsrChip).toBe(true);
    expect(chips.showBrowserWorkerChip).toBe(false);
    expect(chips.asrSourceConnected).toBe(true);
    expect(chips.statusMessage).toContain("Loading Parakeet");
  });
});
