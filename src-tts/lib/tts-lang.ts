import { readMigratedLocalStorage, writeBrandLocalStorage } from "../../src/lib/brand";

export const TTS_TEST_LANG_CODES = [
  "ru",
  "en",
  "ja",
  "ko",
  "zh",
  "de",
  "fr",
  "es",
  "uk",
] as const;

export type TtsTestLangCode = (typeof TTS_TEST_LANG_CODES)[number];

export const SAMPLE_LANG_STORAGE_KEY = "kagevi-subtitles.tts.sample_lang";
export const SAMPLE_LANG_STORAGE_KEY_PREV = "kagevi-voice.tts.sample_lang";
export const SAMPLE_LANG_STORAGE_KEY_LEGACY = "voicesub.tts.sample_lang";

export function normalizeTtsTestLang(lang: string | undefined | null): string {
  const trimmed = String(lang || "")
    .trim()
    .toLowerCase();
  if (!trimmed) return "en";
  const code = trimmed.split("-")[0]?.split("_")[0] || "en";
  if (TTS_TEST_LANG_CODES.includes(code as TtsTestLangCode)) {
    return code;
  }
  return "en";
}

export function loadSampleLang(fallback = "en"): string {
  if (typeof localStorage === "undefined") {
    return normalizeTtsTestLang(fallback);
  }
  return normalizeTtsTestLang(
    readMigratedLocalStorage(
      SAMPLE_LANG_STORAGE_KEY,
      SAMPLE_LANG_STORAGE_KEY_PREV,
      SAMPLE_LANG_STORAGE_KEY_LEGACY,
    ) || fallback,
  );
}

export function saveSampleLang(lang: string): void {
  if (typeof localStorage === "undefined") return;
  writeBrandLocalStorage(
    SAMPLE_LANG_STORAGE_KEY,
    normalizeTtsTestLang(lang),
    SAMPLE_LANG_STORAGE_KEY_PREV,
    SAMPLE_LANG_STORAGE_KEY_LEGACY,
  );
}
