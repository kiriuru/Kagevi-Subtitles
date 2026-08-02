import { LINE_SLOT_NAMES, DEFAULT_BASE_STYLE } from "./constants.js";

export function clone(value) {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch (_error) {
      // Fall through for values structuredClone rejects.
    }
  }
  return JSON.parse(JSON.stringify(value));
}

export function buildEmptyLineSlots() {
  return LINE_SLOT_NAMES.reduce((accumulator, slotName) => {
    accumulator[slotName] = { enabled: false };
    return accumulator;
  }, {});
}

export function fallbackPresets() {
  return {
    clean_default: {
      preset: "clean_default",
      label: "Clean Default",
      description: "",
      built_in: true,
      base: clone(DEFAULT_BASE_STYLE),
      line_slots: buildEmptyLineSlots(),
    },
  };
}

export function getPresetCatalog(presets) {
  return presets && typeof presets === "object" && Object.keys(presets).length ? presets : fallbackPresets();
}

export function buildStyleFromPreset(presets, presetName) {
  const catalog = getPresetCatalog(presets);
  const current = catalog[presetName] || catalog.clean_default || Object.values(catalog)[0];
  return {
    preset: current.preset || presetName || "clean_default",
    label: current.label || "Subtitle Style",
    description: current.description || "",
    built_in: current.built_in !== false,
    recommended_max_visible_lines: current.recommended_max_visible_lines || null,
    base: clone(current.base || {}),
    line_slots: normalizeLineSlots(current.line_slots || {}),
    custom_presets: clone(current.custom_presets || {}),
  };
}

export function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value), 10);
  const normalized = Number.isFinite(parsed) ? parsed : fallback;
  return Math.max(min, Math.min(max, normalized));
}

export function clampFloat(value, fallback, min, max) {
  const parsed = Number.parseFloat(String(value));
  const normalized = Number.isFinite(parsed) ? parsed : fallback;
  return Math.max(min, Math.min(max, normalized));
}

export function normalizeColor(value, fallback) {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

export function canonicalizeFontFamilyStack(stack) {
  return String(stack || "")
    .replace(/"JetBrains Mono Regular"/g, '"Jet Brains Mono Regular"')
    .replace(/"JetBrains Mono Bold"/g, '"Jet Brains Mono Bold"');
}

export function normalizeBaseStyle(rawBase) {
  const defaults = DEFAULT_BASE_STYLE;
  const current = rawBase && typeof rawBase === "object" ? rawBase : {};
  const textAlign = ["left", "center", "right"].includes(String(current.text_align || "").toLowerCase())
    ? String(current.text_align).toLowerCase()
    : defaults.text_align;
  const effect = [
    "none",
    "fade",
    "subtle_pop",
    "slide_up",
    "zoom_in",
    "blur_in",
    "glow",
    "pulse",
    "reveal",
  ].includes(String(current.effect || "").toLowerCase())
    ? String(current.effect).toLowerCase()
    : defaults.effect;

  return {
    font_family: canonicalizeFontFamilyStack(String(current.font_family || defaults.font_family)),
    font_size_px: clampInt(current.font_size_px, defaults.font_size_px, 12, 96),
    font_weight: clampInt(current.font_weight, defaults.font_weight, 300, 900),
    fill_color: normalizeColor(current.fill_color, defaults.fill_color),
    stroke_color: normalizeColor(current.stroke_color, defaults.stroke_color),
    // ASS/Aegisub outline: 0–4 CSS px (UI step 0.1). Classic SSA listed 0–4;
    // `\bord` accepts floats (0.1, 1.5, …). Legacy 5–20 values clamp down.
    stroke_width_px: Number(clampFloat(current.stroke_width_px, defaults.stroke_width_px, 0, 4).toFixed(1)),
    shadow_color: normalizeColor(current.shadow_color, defaults.shadow_color),
    // Clamp ranges must stay aligned with StyleFieldGroup.svelte (dashboard UI).
    shadow_blur_px: Number(clampFloat(current.shadow_blur_px, defaults.shadow_blur_px, 0, 40).toFixed(2)),
    shadow_offset_x_px: Number(clampFloat(current.shadow_offset_x_px, defaults.shadow_offset_x_px, -24, 24).toFixed(2)),
    shadow_offset_y_px: Number(clampFloat(current.shadow_offset_y_px, defaults.shadow_offset_y_px, -24, 24).toFixed(2)),
    background_color: normalizeColor(current.background_color, defaults.background_color),
    background_opacity: clampInt(current.background_opacity, defaults.background_opacity, 0, 100),
    background_padding_x_px: clampInt(current.background_padding_x_px, defaults.background_padding_x_px, 0, 40),
    background_padding_y_px: clampInt(current.background_padding_y_px, defaults.background_padding_y_px, 0, 24),
    background_radius_px: clampInt(current.background_radius_px, defaults.background_radius_px, 0, 40),
    line_spacing_em: Number(clampFloat(current.line_spacing_em, defaults.line_spacing_em, 0.8, 2.5).toFixed(2)),
    letter_spacing_em: Number(clampFloat(current.letter_spacing_em, defaults.letter_spacing_em, -0.2, 0.5).toFixed(3)),
    text_align: textAlign,
    line_gap_px: clampInt(current.line_gap_px, defaults.line_gap_px, 0, 40),
    effect,
  };
}

export function normalizeOverrideStyle(rawOverride) {
  const current = rawOverride && typeof rawOverride === "object" ? rawOverride : {};
  const normalizedBase = normalizeBaseStyle(current);
  const normalized = { enabled: Boolean(current.enabled) };
  Object.keys(normalizedBase).forEach((key) => {
    normalized[key] = current[key] === "" || current[key] == null ? null : normalizedBase[key];
  });
  return normalized;
}

export function normalizeLineSlots(rawLineSlots, presetLineSlots, legacySourceOverride, legacyTranslationOverride) {
  const current = rawLineSlots && typeof rawLineSlots === "object" ? rawLineSlots : {};
  const presetSlots = presetLineSlots && typeof presetLineSlots === "object" ? presetLineSlots : {};
  const normalized = buildEmptyLineSlots();
  LINE_SLOT_NAMES.forEach((slotName) => {
    let source = current[slotName];
    if (source == null) {
      source = presetSlots[slotName];
    }
    if (source == null && slotName === "source" && legacySourceOverride && typeof legacySourceOverride === "object") {
      source = legacySourceOverride;
    }
    if (
      source == null &&
      slotName.startsWith("translation_") &&
      legacyTranslationOverride &&
      typeof legacyTranslationOverride === "object"
    ) {
      source = legacyTranslationOverride;
    }
    normalized[slotName] = normalizeOverrideStyle(source || {});
  });
  return normalized;
}

export function normalizeCustomPresets(rawCustomPresets) {
  const current = rawCustomPresets && typeof rawCustomPresets === "object" ? rawCustomPresets : {};
  const normalized = {};
  Object.entries(current).forEach(([presetName, presetPayload]) => {
    normalized[presetName] = normalizeStyleConfig(
      {
        ...(presetPayload || {}),
        preset: presetName,
      },
      { ...fallbackPresets(), ...normalized }
    );
    normalized[presetName].built_in = false;
    normalized[presetName].label = presetPayload?.label || presetName;
    normalized[presetName].description = presetPayload?.description || "User-created local subtitle style.";
  });
  return normalized;
}

export function normalizeStyleConfig(rawStyle, presets) {
  const current = rawStyle && typeof rawStyle === "object" ? rawStyle : {};
  const customPresets = normalizeCustomPresets(current.custom_presets || {});
  const catalog = {
    ...getPresetCatalog(presets),
    ...customPresets,
  };
  const presetName = String(current.preset || "clean_default");
  const presetStyle = buildStyleFromPreset(catalog, presetName);
  return {
    preset: presetStyle.preset,
    label: current.label || presetStyle.label,
    description: current.description || presetStyle.description,
    built_in: presetStyle.built_in !== false,
    recommended_max_visible_lines: current.recommended_max_visible_lines || presetStyle.recommended_max_visible_lines || null,
    base: normalizeBaseStyle(current.base || presetStyle.base),
    line_slots: normalizeLineSlots(
      current.line_slots,
      presetStyle.line_slots,
      current.source_override,
      current.translation_override
    ),
    custom_presets: customPresets,
  };
}

export function mergeLineStyle(baseStyle, overrideStyle) {
  if (!overrideStyle?.enabled) {
    return clone(baseStyle);
  }
  const merged = clone(baseStyle);
  Object.keys(baseStyle).forEach((key) => {
    if (overrideStyle[key] !== null && overrideStyle[key] !== undefined && overrideStyle[key] !== "") {
      merged[key] = overrideStyle[key];
    }
  });
  return merged;
}

export function resolveEffectiveStyle(rawStyle, presets) {
  const normalized = normalizeStyleConfig(rawStyle, presets);
  const base = clone(normalized.base);
  const lineSlots = {};
  LINE_SLOT_NAMES.forEach((slotName) => {
    lineSlots[slotName] = mergeLineStyle(base, normalized.line_slots?.[slotName] || { enabled: false });
  });
  return {
    preset: normalized.preset,
    label: normalized.label,
    description: normalized.description,
    built_in: normalized.built_in !== false,
    effect: base.effect,
    container: {
      text_align: base.text_align,
      line_gap_px: base.line_gap_px,
    },
    base,
    line_slots: lineSlots,
  };
}
