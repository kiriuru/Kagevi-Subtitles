/** Kagevi main brand; Subtitles is the sub-brand for this program. */
export const BRAND_MAIN = "Kagevi";
export const BRAND_SUB = "Subtitles";

/** User-facing product name (two words). */
export const PRODUCT_NAME = `${BRAND_MAIN} ${BRAND_SUB}`;

/** Formal product slug (hyphenated) — npm, cargo bin, export filenames. */
export const PRODUCT_SLUG = "kagevi-subtitles";

/** @deprecated Prefer PRODUCT_SLUG. */
export const PRODUCT_NAME_HYPHEN = PRODUCT_SLUG;

/** Tauri / Windows application identifier. */
export const BUNDLE_IDENTIFIER = "com.kagevi.subtitles";

/**
 * GitHub repo (`owner/name`) for update checks and Credits link.
 * Synced from `voicesub-types::DEFAULT_GITHUB_REPO` via `npm run version:sync`.
 */
export const GITHUB_REPO = "kiriuru/Kagevi-Subtitles";

export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;

/** GitHub Pages site derived from {@link GITHUB_REPO}. */
export const SITE_URL = (() => {
  const [owner, name] = GITHUB_REPO.split("/");
  return `https://${owner}.github.io/${name}/`;
})();

/** DonationAlerts tip page (Credits dialog «Support»). */
export const DONATE_URL = "https://www.donationalerts.com/r/kiriuru";

/** Primary HTTP header for loopback `/api/*` auth. */
export const LOOPBACK_TOKEN_HEADER = "x-kagevi-subtitles-token";

/** Previous Kagevi Voice header — still accepted during upgrades. */
export const LOOPBACK_TOKEN_HEADER_PREV = "x-kagevi-voice-token";

/** Legacy VoiceSub header — still accepted by the runtime. */
export const LOOPBACK_TOKEN_HEADER_LEGACY = "x-voicesub-token";

/** Injected on trusted HTML pages (primary). */
export const API_TOKEN_WINDOW_KEY = "__KAGEVI_SUBTITLES_API_TOKEN__";

/** Previous Kagevi Voice injected key. */
export const API_TOKEN_WINDOW_KEY_PREV = "__KAGEVI_VOICE_API_TOKEN__";

/** Legacy VoiceSub injected key still read as fallback. */
export const API_TOKEN_WINDOW_KEY_LEGACY = "__VOICESUB_API_TOKEN__";

/** Read localStorage with one-shot migration from legacy keys. */
export function readMigratedLocalStorage(
  key: string,
  ...legacyKeys: string[]
): string | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  const current = localStorage.getItem(key);
  if (current != null) {
    return current;
  }
  for (const legacyKey of legacyKeys) {
    const legacy = localStorage.getItem(legacyKey);
    if (legacy != null) {
      localStorage.setItem(key, legacy);
      localStorage.removeItem(legacyKey);
      return legacy;
    }
  }
  return null;
}

export function writeBrandLocalStorage(key: string, value: string, ...legacyKeys: string[]): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(key, value);
  for (const legacyKey of legacyKeys) {
    localStorage.removeItem(legacyKey);
  }
}
