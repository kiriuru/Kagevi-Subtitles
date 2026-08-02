import { describe, expect, it } from "vitest";

import { normalizeDiagnosticsPayload } from "./diagnostics-normalizer";

describe("normalizeDiagnosticsPayload", () => {
  it("preserves local_module from previous snapshot when update omits it", () => {
    const previous = {
      provider: "browser_google",
      local_module: { ready: true, phase: "ready" },
      active_mode: "local_parakeet",
    };
    const next = normalizeDiagnosticsPayload(
      { provider: "browser_google", browser_worker: { worker_connected: true } },
      previous,
    );
    expect(next.local_module).toEqual({ ready: true, phase: "ready" });
    expect(next.active_mode).toBe("local_parakeet");
    expect(next.browser_worker).toEqual({ worker_connected: true });
  });

  it("prefers local_module from the incoming payload", () => {
    const next = normalizeDiagnosticsPayload(
      { local_module: { ready: false, phase: "loading" } },
      { local_module: { ready: true, phase: "ready" } },
    );
    expect(next.local_module).toEqual({ ready: false, phase: "loading" });
  });

  it("preserves browser_worker and Local ASR counters across partial updates", () => {
    const previous = {
      provider: "local_parakeet",
      active_mode: "local_parakeet",
      browser_worker: { worker_connected: false },
      decode_count: 4,
      partial_emits: 4,
      final_emits: 1,
      selected_execution_provider: "cuda",
    };
    const next = normalizeDiagnosticsPayload(
      {
        provider: "local_parakeet",
        decode_count: 9,
        partial_emits: 8,
        final_emits: 2,
        last_decode_wall_ms: 42,
        runtime_initialized: true,
      },
      previous,
    );
    expect(next.browser_worker).toEqual({ worker_connected: false });
    expect(next.decode_count).toBe(9);
    expect(next.partial_emits).toBe(8);
    expect(next.final_emits).toBe(2);
    expect(next.last_decode_wall_ms).toBe(42);
    expect(next.selected_execution_provider).toBe("cuda");
    expect(next.runtime_initialized).toBe(true);
  });
});
