import { apiFetch } from "./loopback-api-client";
import { invoke } from "@tauri-apps/api/core";
import {
  buildTwitchAuthorizeUrl,
  resolveTwitchClientId,
} from "./twitch-oauth";
import { isTauriWebview } from "./tauri-detect";

export async function openTwitchOAuthInSystemBrowser(clientId?: string | null): Promise<void> {
  const url = buildTwitchAuthorizeUrl(resolveTwitchClientId(clientId));

  try {
    const response = await apiFetch("/api/tts/twitch/oauth-open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const body = (await response.json()) as { ok?: boolean; error?: string };
    if (body.ok) return;
    if (body.error) throw new Error(body.error);
  } catch (err) {
    if (!(err instanceof TypeError)) {
      throw err;
    }
  }

  if (isTauriWebview()) {
    await invoke("tts_open_system_url", { url });
    return;
  }

  const popup = window.open(url, "_blank", "noopener,noreferrer");
  if (!popup) {
    throw new Error("tts.oauth.popup_blocked");
  }
}

export async function fetchPendingOAuthToken(): Promise<string | null> {
  const response = await apiFetch("/api/tts/twitch/oauth-pending");
  if (!response.ok) return null;
  const body = (await response.json()) as {
    ok?: boolean;
    token?: string;
    status?: string;
    error?: string;
    message?: string;
  };
  if (body.status === "error" || body.error) {
    const err = new Error(body.message || body.error || "oauth_denied");
    (err as Error & { oauthDenied?: boolean; oauthCode?: string }).oauthDenied = true;
    (err as Error & { oauthDenied?: boolean; oauthCode?: string }).oauthCode =
      body.error || "oauth_error";
    throw err;
  }
  if (!body.ok || !body.token) return null;
  return body.token;
}

export type PendingOAuthResult =
  | { status: "none" }
  | { status: "token"; token: string }
  | { status: "error"; error: string; message: string };

export async function fetchPendingOAuthResult(): Promise<PendingOAuthResult> {
  const response = await apiFetch("/api/tts/twitch/oauth-pending");
  if (!response.ok) return { status: "none" };
  const body = (await response.json()) as {
    ok?: boolean;
    token?: string;
    status?: string;
    error?: string;
    message?: string;
  };
  if (body.status === "token" && body.token) {
    return { status: "token", token: body.token };
  }
  if (body.status === "error" || body.error) {
    return {
      status: "error",
      error: body.error || "oauth_error",
      message: body.message || body.error || "oauth_error",
    };
  }
  return { status: "none" };
}
