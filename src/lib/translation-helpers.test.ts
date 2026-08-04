import { describe, expect, it } from "vitest";
import {
  buildProviderOptionGroups,
  formatOutputSlotLabel,
  getActiveStyleLineSlots,
  getProviderFieldLabel,
  getProviderHintKey,
  getProviderSetupUrl,
  isCustomPromptOverrideEnabled,
  isLlmProvider,
  languageDisplayLabel,
} from "./translation-helpers";
import { t } from "./i18n";
import type { ConfigPayload } from "./types";

describe("translation-helpers", () => {
  it("builds grouped provider options for all supported providers", () => {
    const groups = buildProviderOptionGroups();
    const ids = groups.flatMap((group) => group.providers.map((item) => item.id));
    expect(ids).toContain("google_translate_v2");
    expect(ids).toContain("openai");
    expect(ids).toContain("free_web_translate");
    expect(ids).toContain("bing_translator");
    expect(ids.length).toBe(18);
    expect(ids).toContain("baidu_translate");
    expect(ids).toContain("tencent_tmt");
    for (const group of groups) {
      expect(group.labelKey).toMatch(/^translation\.provider_group\./);
      expect(t(group.labelKey, undefined, "ru")).not.toBe(group.labelKey);
    }
  });

  it("maps google v3 UI fields to dedicated labels", () => {
    const label = getProviderFieldLabel("google_cloud_translation_v3", "api_key", (key) => key);
    expect(label).toBe("translation.field.google_v3.api_key");
    expect(t("translation.field.google_v3.api_key", undefined, "en")).toBe("OAuth access token");
    expect(t("translation.field.google_v3.endpoint", undefined, "en")).toBe("GCP project ID");
  });

  it("exposes china provider hints and cloud setup urls", () => {
    expect(getProviderHintKey("youdao_translate")).toBe("provider.youdao_translate.hint");
    expect(t("provider.youdao_translate.hint", undefined, "en")).not.toBe(
      "provider.youdao_translate.hint",
    );
    expect(getProviderSetupUrl("openai")).toContain("platform.openai.com");
    expect(getProviderSetupUrl("lm_studio")).toBeNull();
    expect(isLlmProvider("ollama")).toBe(true);
    expect(isCustomPromptOverrideEnabled({ custom_prompt: "x" })).toBe(true);
    expect(isCustomPromptOverrideEnabled({ override_prompt: "false", custom_prompt: "x" })).toBe(
      false,
    );
  });

  it("lists style override slots for source and enabled translation lines only", () => {
    const config: ConfigPayload = {
      translation: {
        enabled: true,
        lines: [
          { slot_id: "translation_1", enabled: true, target_lang: "ru", provider: "google_translate_v2" },
          { slot_id: "translation_2", enabled: false, target_lang: "ja", provider: "google_translate_v2" },
          { slot_id: "translation_3", enabled: true, target_lang: "ko", provider: "google_translate_v2" },
          { slot_id: "translation_4", enabled: false, target_lang: "zh-cn", provider: "google_translate_v2" },
        ],
      },
    };
    expect(getActiveStyleLineSlots(config)).toEqual(["source", "translation_1", "translation_3"]);
  });

  it("formats output slot labels for style tabs and OBS modes with locale", () => {
    const config: ConfigPayload = {
      translation: {
        enabled: true,
        lines: [
          { slot_id: "translation_1", enabled: true, target_lang: "ru", provider: "google_translate_v2" },
        ],
      },
    };
    expect(formatOutputSlotLabel("source", config, "en")).toBe(t("common.source", undefined, "en"));
    expect(formatOutputSlotLabel("source", config, "ru")).toBe(t("common.source", undefined, "ru"));
    expect(formatOutputSlotLabel("translation_1", config, "en")).toBe(
      t(
        "obs.output.translation_active",
        { number: "1", lang: languageDisplayLabel("ru", "en") },
        "en",
      ),
    );
    expect(formatOutputSlotLabel("translation_1", config, "ru")).toBe(
      t(
        "obs.output.translation_active",
        { number: "1", lang: languageDisplayLabel("ru", "ru") },
        "ru",
      ),
    );
    expect(formatOutputSlotLabel("source_live", config, "en")).not.toBe(
      formatOutputSlotLabel("source_live", config, "ru"),
    );
    expect(formatOutputSlotLabel("disabled", config, "ja")).toBe(t("obs.output.disabled", undefined, "ja"));
  });
});
