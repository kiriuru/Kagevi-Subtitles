import { TRANSLATION_LANGUAGE_CODES } from "./constants";
import type { ConfigPayload, RuntimeStatus, StylePresetCatalog } from "./types";

type TranslationLangCode = (typeof TRANSLATION_LANGUAGE_CODES)[number];

/** Sample phrases for every translation target so idle preview shows real script/glyphs for fonts. */
const PREVIEW_SAMPLE_BY_LANG: Record<TranslationLangCode, string> = {
  en: "Subtitle style preview",
  "zh-cn": "字幕样式预览",
  "zh-tw": "字幕樣式預覽",
  ru: "Предпросмотр стиля субтитров",
  es: "Vista previa del estilo de subtítulos",
  pt: "Prévia do estilo de legendas",
  de: "Vorschau des Untertitelstils",
  ko: "자막 스타일 미리보기입니다",
  fr: "Aperçu du style des sous-titres",
  ja: "字幕スタイルのプレビューです",
  tr: "Altyazı stili önizlemesi",
  hi: "उपशीर्षक शैली पूर्वावलोकन",
  it: "Anteprima dello stile dei sottotitoli",
  ar: "معاينة نمط الترجمة",
  pl: "Podgląd stylu napisów",
  id: "Pratinjau gaya subtitle",
  sv: "Förhandsvisning av undertextstil",
  nl: "Voorbeeld van ondertitelstijl",
  vi: "Xem trước kiểu phụ đề",
  th: "ตัวอย่างรูปแบบคำบรรยาย",
};

/** Resolve a short native-script sample for idle subtitle preview (not UI-locale copy). */
export function previewSampleTextForLang(lang: string | undefined | null): string {
  const normalized = String(lang || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-");
  if (!normalized || normalized === "auto") {
    return PREVIEW_SAMPLE_BY_LANG.en;
  }
  if (PREVIEW_SAMPLE_BY_LANG[normalized as TranslationLangCode]) {
    return PREVIEW_SAMPLE_BY_LANG[normalized as TranslationLangCode];
  }
  const base = normalized.split("-")[0] || "en";
  if (base === "zh") {
    if (normalized.includes("tw") || normalized.includes("hk") || normalized.includes("hant")) {
      return PREVIEW_SAMPLE_BY_LANG["zh-tw"];
    }
    return PREVIEW_SAMPLE_BY_LANG["zh-cn"];
  }
  return PREVIEW_SAMPLE_BY_LANG[base as TranslationLangCode] || PREVIEW_SAMPLE_BY_LANG.en;
}

/**
 * Effective language for the idle source-line placeholder.
 * Mirrors backend `resolve_ingest_source_lang`: concrete `source_lang` wins;
 * browser Web Speech falls back to `asr.browser.recognition_language`;
 * Local ASR keeps `auto` (English sample) so we do not mislabel from leftover browser lang.
 */
export function resolvePreviewSourceLang(config: ConfigPayload): string {
  const source = String(config.source_lang || "")
    .trim()
    .toLowerCase();
  if (source && source !== "auto") {
    return source;
  }
  const mode = String(config.asr?.mode || "")
    .trim()
    .toLowerCase();
  if (mode === "local_parakeet") {
    return "auto";
  }
  const recognition = String(config.asr?.browser?.recognition_language || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-");
  if (recognition) {
    return recognition;
  }
  return "en";
}

export function hasRenderableOverlayContent(payload: Record<string, unknown> | null | undefined): boolean {
  if (!payload || typeof payload !== "object") return false;
  const visibleItems = Array.isArray(payload.visible_items)
    ? payload.visible_items.filter((item) => String((item as { text?: string })?.text || "").trim())
    : [];
  if (visibleItems.length > 0) return true;
  return Boolean(String(payload.active_partial_text || "").trim());
}

export function shouldUseLiveOverlayPreview(
  runtime: RuntimeStatus | null | undefined,
  overlayPayload: Record<string, unknown> | null | undefined,
): boolean {
  if (!(runtime?.running || runtime?.is_running)) {
    return false;
  }
  return Boolean(overlayPayload);
}

export function getResolvedSubtitleStyle(
  config: ConfigPayload,
  presets: StylePresetCatalog,
): Record<string, unknown> {
  const renderer =
    typeof window !== "undefined"
      ? (
          window as Window & {
            SubtitleStyleRenderer?: {
              resolveEffectiveStyle: (style: unknown, catalog: unknown) => Record<string, unknown>;
            };
          }
        ).SubtitleStyleRenderer
      : undefined;
  if (!renderer) {
    return (config.subtitle_style || {}) as Record<string, unknown>;
  }
  return renderer.resolveEffectiveStyle(config.subtitle_style || {}, presets || {});
}

export function buildPreviewPayload(input: {
  config: ConfigPayload;
  runtime?: RuntimeStatus | null;
  overlayPayload?: Record<string, unknown> | null;
  subtitleStylePresets?: StylePresetCatalog;
  /** @deprecated Idle preview uses recognition/source language samples, not UI locale. */
  locale?: string;
}): Record<string, unknown> | null {
  const { config, runtime, overlayPayload, subtitleStylePresets = {} } = input;

  if (shouldUseLiveOverlayPreview(runtime, overlayPayload)) {
    // Prefer in-memory overlay layout from config so Subtitles panel changes
    // preview immediately (same as style), even before Save applies them live.
    return {
      ...(overlayPayload || {}),
      preset: config.overlay?.preset || (overlayPayload as { preset?: string } | null)?.preset || "single",
      compact: Boolean(config.overlay?.compact),
      style: getResolvedSubtitleStyle(config, subtitleStylePresets),
    };
  }

  const visibleItems: Array<Record<string, unknown>> = [];
  const displayOrder = Array.isArray(config.subtitle_output?.display_order)
    ? config.subtitle_output.display_order
    : [];
  const maxTranslations = Math.max(
    0,
    Math.min(4, Number(config.subtitle_output?.max_translation_languages || 0)),
  );
  const lineMap = new Map(
    (Array.isArray(config.translation?.lines) ? config.translation.lines : [])
      .filter((line) => line?.enabled !== false)
      .map((line) => [String(line.slot_id || "").toLowerCase(), line]),
  );
  let translationsUsed = 0;

  const sourceLang = resolvePreviewSourceLang(config);

  for (const code of displayOrder) {
    if (code === "source") {
      if (config.subtitle_output?.show_source !== false) {
        visibleItems.push({
          kind: "source",
          lang: sourceLang,
          style_slot: "source",
          // Native-script sample for recognition/source language — not UI-locale copy.
          text: previewSampleTextForLang(sourceLang),
        });
      }
      continue;
    }
    if (config.subtitle_output?.show_translations === false || translationsUsed >= maxTranslations) {
      continue;
    }
    const line = lineMap.get(String(code || "").toLowerCase());
    if (!line) continue;
    const targetLang = String(line.target_lang || code);
    visibleItems.push({
      kind: "translation",
      lang: targetLang,
      slot_id: String(line.slot_id || code),
      target_lang: targetLang,
      label: String(line.label || targetLang.toUpperCase()),
      style_slot: String(line.slot_id || code),
      text: previewSampleTextForLang(targetLang),
    });
    translationsUsed += 1;
  }

  return {
    preset: config.overlay?.preset || "single",
    compact: Boolean(config.overlay?.compact),
    completed_block_visible: visibleItems.length > 0,
    visible_items: visibleItems,
    active_partial_text:
      visibleItems.length === 0 && config.subtitle_output?.show_source !== false
        ? previewSampleTextForLang(sourceLang)
        : "",
    style: getResolvedSubtitleStyle(config, subtitleStylePresets),
    sequence: 0,
  };
}
