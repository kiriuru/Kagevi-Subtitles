import { describe, expect, it } from "vitest";

import { TRANSLATION_LANGUAGE_CODES } from "./constants";
import {
  buildPreviewPayload,
  hasRenderableOverlayContent,
  previewSampleTextForLang,
  resolvePreviewSourceLang,
  shouldUseLiveOverlayPreview,
} from "./preview-payload";
import type { ConfigPayload } from "./types";

const config: ConfigPayload = {
  overlay: { preset: "single", compact: false },
  subtitle_output: {
    show_source: true,
    show_translations: true,
    max_translation_languages: 1,
    display_order: ["source", "translation_1"],
  },
  source_lang: "en",
  asr: { mode: "browser_google", browser: { recognition_language: "en-US" } },
  translation: {
    enabled: true,
    lines: [
      {
        slot_id: "translation_1",
        target_lang: "en",
        label: "EN",
        enabled: true,
        provider: "google_translate_v2",
      },
    ],
  },
  subtitle_style: {},
};

describe("previewSampleTextForLang", () => {
  it("returns a native-script sample for every supported translation language", () => {
    for (const code of TRANSLATION_LANGUAGE_CODES) {
      const sample = previewSampleTextForLang(code);
      expect(sample.trim().length).toBeGreaterThan(2);
      expect(sample.toLowerCase()).not.toBe(code);
      expect(sample.toUpperCase()).not.toBe(code.toUpperCase());
    }
  });

  it("returns native-script samples for RU/JA (not language tags)", () => {
    expect(previewSampleTextForLang("ru")).toBe("Предпросмотр стиля субтитров");
    expect(previewSampleTextForLang("ja")).toBe("字幕スタイルのプレビューです");
    expect(previewSampleTextForLang("RU")).toBe("Предпросмотр стиля субтитров");
  });

  it("maps BCP-47 recognition tags like ja-JP to the base-language sample", () => {
    expect(previewSampleTextForLang("ja-JP")).toBe("字幕スタイルのプレビューです");
    expect(previewSampleTextForLang("ru-RU")).toBe("Предпросмотр стиля субтитров");
  });
});

describe("resolvePreviewSourceLang", () => {
  it("prefers concrete source_lang over recognition language", () => {
    expect(
      resolvePreviewSourceLang({
        source_lang: "ja",
        asr: { mode: "browser_google", browser: { recognition_language: "ru-RU" } },
      }),
    ).toBe("ja");
  });

  it("falls back to browser recognition_language when source_lang is auto", () => {
    expect(
      resolvePreviewSourceLang({
        source_lang: "auto",
        asr: { mode: "browser_google", browser: { recognition_language: "ja-JP" } },
      }),
    ).toBe("ja-jp");
  });

  it("keeps auto for local_parakeet so leftover browser lang is not used", () => {
    expect(
      resolvePreviewSourceLang({
        source_lang: "auto",
        asr: { mode: "local_parakeet", browser: { recognition_language: "ru-RU" } },
      }),
    ).toBe("auto");
  });
});

const idleEmptyPayload = {
  visible_items: [],
  completed_block_visible: true,
  active_partial_text: "",
};

describe("preview payload idle/live gating", () => {
  it("treats empty replay payload as non-renderable", () => {
    expect(hasRenderableOverlayContent(idleEmptyPayload)).toBe(false);
  });

  it("does not use live overlay preview while runtime is idle", () => {
    expect(
      shouldUseLiveOverlayPreview({ is_running: false }, idleEmptyPayload),
    ).toBe(false);
    expect(
      shouldUseLiveOverlayPreview(
        { is_running: false },
        {
          lifecycle_state: "completed_only",
          visible_items: [{ kind: "translation", text: "stale subtitle" }],
          active_partial_text: "",
        },
      ),
    ).toBe(false);
  });

  it("builds style placeholder before start", () => {
    const placeholder = buildPreviewPayload({
      config,
      runtime: { is_running: false },
      overlayPayload: idleEmptyPayload,
      subtitleStylePresets: {},
      locale: "en",
    });
    expect(placeholder?.visible_items?.length).toBeGreaterThan(0);
    expect(placeholder?.visible_items?.[0]?.kind).toBe("source");
  });

  it("uses recognition language sample for source line, not UI locale copy", () => {
    const placeholder = buildPreviewPayload({
      config: {
        ...config,
        source_lang: "auto",
        asr: { mode: "browser_google", browser: { recognition_language: "ja-JP" } },
        translation: {
          enabled: true,
          lines: [
            {
              slot_id: "translation_1",
              target_lang: "ru",
              label: "RU",
              enabled: true,
              provider: "google_translate_v2",
            },
          ],
        },
      },
      runtime: { is_running: false },
      overlayPayload: idleEmptyPayload,
      subtitleStylePresets: {},
      locale: "ru",
    });
    const items = (placeholder?.visible_items || []) as Array<{
      kind?: string;
      text?: string;
      lang?: string;
    }>;
    const source = items.find((item) => item.kind === "source");
    expect(source?.text).toBe("字幕スタイルのプレビューです");
    expect(source?.lang).toBe("ja-jp");
    expect(source?.text).not.toBe("Предпросмотр исходной строки");
  });

  it("uses native-script samples for translation lines instead of RU/JA labels", () => {
    const placeholder = buildPreviewPayload({
      config: {
        ...config,
        subtitle_output: {
          ...config.subtitle_output!,
          max_translation_languages: 2,
          display_order: ["source", "translation_1", "translation_2"],
        },
        translation: {
          enabled: true,
          lines: [
            {
              slot_id: "translation_1",
              target_lang: "ru",
              label: "RU",
              enabled: true,
              provider: "google_translate_v2",
            },
            {
              slot_id: "translation_2",
              target_lang: "ja",
              label: "JA",
              enabled: true,
              provider: "google_translate_v2",
            },
          ],
        },
      },
      runtime: { is_running: false },
      overlayPayload: idleEmptyPayload,
      subtitleStylePresets: {},
      locale: "en",
    });
    const items = (placeholder?.visible_items || []) as Array<{ kind?: string; text?: string }>;
    expect(items.find((item) => item.kind === "translation" && item.text?.includes("Предпросмотр"))).toBeTruthy();
    expect(items.find((item) => item.kind === "translation" && item.text?.includes("プレビュー"))).toBeTruthy();
    expect(items.some((item) => item.text === "RU" || item.text === "JA")).toBe(false);
  });

  it("uses live overlay payload once runtime is running", () => {
    const livePayload = {
      ...idleEmptyPayload,
      sequence: 7,
      lifecycle_state: "partial_only",
      active_partial_text: "live",
    };
    expect(
      shouldUseLiveOverlayPreview({ is_running: true, running: true }, livePayload),
    ).toBe(true);

    const preview = buildPreviewPayload({
      config,
      runtime: { is_running: true, running: true },
      overlayPayload: livePayload,
      subtitleStylePresets: {},
      locale: "en",
    });
    expect(preview?.active_partial_text).toBe("live");
    expect(preview?.sequence).toBe(7);
  });

  it("overlays in-memory layout preset onto live preview payload", () => {
    const livePayload = {
      ...idleEmptyPayload,
      sequence: 3,
      preset: "stacked",
      compact: false,
      lifecycle_state: "partial_only",
      active_partial_text: "live",
      visible_items: [{ kind: "source", text: "live" }],
    };
    const preview = buildPreviewPayload({
      config: {
        ...config,
        overlay: { preset: "dual-line", compact: true },
      },
      runtime: { is_running: true, running: true },
      overlayPayload: livePayload,
      subtitleStylePresets: {},
      locale: "en",
    });
    expect(preview?.preset).toBe("dual-line");
    expect(preview?.compact).toBe(true);
    expect(preview?.active_partial_text).toBe("live");
  });
});
