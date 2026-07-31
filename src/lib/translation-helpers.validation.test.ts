import { describe, expect, it } from "vitest";
import {
  formatTranslationConfigError,
  getDuplicateEnabledTargetLangs,
  getTranslationConfigErrors,
} from "./translation-helpers";
import type { ConfigPayload } from "./types";

function translateRu(key: string, vars?: Record<string, string | number>): string {
  const catalog: Record<string, string> = {
    "translation.api_key": "API-ключ",
    "translation.validation.missing_provider_fields":
      "Не заполнены обязательные настройки провайдера: {fields}. Откройте настройки провайдера и заполните поля.",
  };
  let text = catalog[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value ?? ""));
    }
  }
  return text;
}

const baseConfig: ConfigPayload = {
  translation: {
    enabled: true,
    provider: "google_translate_v2",
    lines: [
      {
        slot_id: "translation_1",
        enabled: true,
        target_lang: "en",
        provider: "google_translate_v2",
      },
      {
        slot_id: "translation_2",
        enabled: true,
        target_lang: "en",
        provider: "google_translate_v2",
      },
    ],
    provider_settings: {},
  },
};

describe("translation config validation", () => {
  it("detects duplicate enabled target languages", () => {
    expect(getDuplicateEnabledTargetLangs(baseConfig)).toEqual(["en"]);
  });

  it("reports missing api keys on save validation", () => {
    const errors = getTranslationConfigErrors(baseConfig);
    expect(errors.some((entry) => entry.startsWith("missing_provider_fields:"))).toBe(true);
  });

  it("formats missing provider fields with localized labels", () => {
    const message = formatTranslationConfigError(
      "missing_provider_fields:deepl.api_key",
      translateRu,
    );
    expect(message).toContain("DeepL");
    expect(message).toContain("API-ключ");
    expect(message).not.toContain("deepl.api_key");
    expect(message).toMatch(/Не заполнены обязательные настройки провайдера/);
  });

  it("skips validation when translation is disabled", () => {
    const disabled = {
      ...baseConfig,
      translation: { ...baseConfig.translation, enabled: false },
    };
    expect(getTranslationConfigErrors(disabled)).toEqual([]);
  });
});
