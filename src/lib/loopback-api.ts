import {
  LOOPBACK_TOKEN_HEADER,
  LOOPBACK_TOKEN_HEADER_LEGACY,
  LOOPBACK_TOKEN_HEADER_PREV,
  PRODUCT_NAME,
} from "./brand";

export {
  LOOPBACK_TOKEN_HEADER,
  LOOPBACK_TOKEN_HEADER_LEGACY,
  LOOPBACK_TOKEN_HEADER_PREV,
};

declare global {
  interface Window {
    __KAGEVI_SUBTITLES_API_TOKEN__?: string;
    __KAGEVI_VOICE_API_TOKEN__?: string;
    __VOICESUB_API_TOKEN__?: string;
  }
}

let cachedToken: string | null = null;

function readInjectedToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  for (const token of [
    window.__KAGEVI_SUBTITLES_API_TOKEN__,
    window.__KAGEVI_VOICE_API_TOKEN__,
    window.__VOICESUB_API_TOKEN__,
  ]) {
    if (typeof token === "string" && token.trim()) {
      return token.trim();
    }
  }
  return null;
}

export function loopbackApiToken(): string | null {
  return cachedToken || readInjectedToken();
}

export async function initLoopbackApiToken(): Promise<string | null> {
  const injected = readInjectedToken();
  if (injected) {
    cachedToken = injected;
    return injected;
  }
  if (cachedToken) {
    return cachedToken;
  }
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const token = await invoke<string>("get_loopback_api_token");
    if (typeof token === "string" && token.trim()) {
      cachedToken = token.trim();
      return cachedToken;
    }
  } catch {
    // Browser worker / system browser: rely on HttpOnly cookie from bootstrap, or unauthenticated.
  }
  return null;
}

function requireLoopbackApiToken(): string {
  const token = loopbackApiToken();
  if (!token) {
    throw new Error(
      `${PRODUCT_NAME} loopback API token is missing. Reload the app or reopen the dashboard page.`,
    );
  }
  return token;
}

export function loopbackApiHeaders(extra?: HeadersInit): HeadersInit {
  const headers = new Headers(extra);
  const token = requireLoopbackApiToken();
  headers.set(LOOPBACK_TOKEN_HEADER, token);
  // Dual-write during transition so mixed old/new clients still authenticate.
  headers.set(LOOPBACK_TOKEN_HEADER_PREV, token);
  headers.set(LOOPBACK_TOKEN_HEADER_LEGACY, token);
  return headers;
}

/**
 * Attach loopback auth when a JS/IPC token is available.
 * Without a token, same-origin fetch still sends the HttpOnly bootstrap cookie (Chrome worker).
 */
export function withLoopbackAuth(init?: RequestInit): RequestInit {
  const credentials = init?.credentials ?? "same-origin";
  const token = loopbackApiToken();
  if (!token) {
    return { ...init, credentials };
  }
  return {
    ...init,
    credentials,
    headers: loopbackApiHeaders(init?.headers),
  };
}

/** Clears cached token between Vitest cases (Tauri invoke / redirect races). */
export function __resetLoopbackApiTokenForTests(): void {
  cachedToken = null;
}
