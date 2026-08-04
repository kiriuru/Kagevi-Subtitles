import { apiFetch } from "./loopback-api-client";
import {
  clearTwitchOAuthCallbackParams,
  clearTwitchOAuthFragment,
  normalizeOAuthToken,
  parseTwitchAccessTokenFromLocation,
  parseTwitchOAuthErrorFromLocation,
  parseTwitchOAuthStateFromLocation,
} from "./twitch-oauth";
import { isTauriWebview } from "./tauri-detect";

export type ExternalOAuthCallbackResult =
  | { kind: "success" }
  | { kind: "error"; error: string; message: string };

/**
 * Handle Twitch OAuth redirect in the system browser (not the Tauri TTS window).
 * Success → store token for the module to poll. Error/cancel → store error for the module.
 * Returns null when this page load is not an OAuth callback.
 */
export async function tryCompleteExternalOAuthCallback(): Promise<ExternalOAuthCallbackResult | null> {
  if (isTauriWebview()) return null;

  const state = parseTwitchOAuthStateFromLocation() || undefined;
  const denied = parseTwitchOAuthErrorFromLocation();
  if (denied) {
    await apiFetch("/api/tts/twitch/oauth-complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: denied.error,
        message: denied.message,
        state,
      }),
    }).catch(() => null);
    clearTwitchOAuthCallbackParams();
    return { kind: "error", error: denied.error, message: denied.message };
  }

  const raw = parseTwitchAccessTokenFromLocation();
  if (!raw) return null;

  const token = normalizeOAuthToken(raw);
  const response = await apiFetch("/api/tts/twitch/oauth-complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, state }),
  });
  clearTwitchOAuthFragment();
  clearTwitchOAuthCallbackParams();

  if (!response.ok) {
    return {
      kind: "error",
      error: "token_store_failed",
      message: "Could not store Twitch token.",
    };
  }
  return { kind: "success" };
}
