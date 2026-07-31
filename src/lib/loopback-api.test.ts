/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  LOOPBACK_TOKEN_HEADER,
  LOOPBACK_TOKEN_HEADER_LEGACY,
  LOOPBACK_TOKEN_HEADER_PREV,
  loopbackApiHeaders,
  loopbackApiToken,
  withLoopbackAuth,
} from "./loopback-api";

describe("loopback-api", () => {
  afterEach(() => {
    delete window.__KAGEVI_SUBTITLES_API_TOKEN__;
    delete window.__KAGEVI_VOICE_API_TOKEN__;
    delete window.__VOICESUB_API_TOKEN__;
  });

  it("reads injected token from trusted HTML (primary key)", () => {
    window.__KAGEVI_SUBTITLES_API_TOKEN__ = "session-token-123";
    expect(loopbackApiToken()).toBe("session-token-123");
    const headers = new Headers(loopbackApiHeaders());
    expect(headers.get(LOOPBACK_TOKEN_HEADER)).toBe("session-token-123");
    expect(headers.get(LOOPBACK_TOKEN_HEADER_PREV)).toBe("session-token-123");
    expect(headers.get(LOOPBACK_TOKEN_HEADER_LEGACY)).toBe("session-token-123");
  });

  it("falls back to previous and legacy injected token keys", () => {
    window.__KAGEVI_VOICE_API_TOKEN__ = "prev-token";
    expect(loopbackApiToken()).toBe("prev-token");
    delete window.__KAGEVI_VOICE_API_TOKEN__;
    window.__VOICESUB_API_TOKEN__ = "legacy-token";
    expect(loopbackApiToken()).toBe("legacy-token");
  });

  it("throws when token is missing for protected API calls", () => {
    expect(() => loopbackApiHeaders()).toThrow(/loopback API token is missing/i);
    expect(() => withLoopbackAuth({ method: "POST" })).toThrow(/loopback API token is missing/i);
  });
});
