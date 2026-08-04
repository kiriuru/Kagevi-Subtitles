import { describe, expect, it } from "vitest";

import {
  clampStrokeWidthPx,
  resolveStyleFieldValue,
  resolveStyleFields,
  STYLE_BASE_DEFAULTS,
  STROKE_WIDTH_MAX,
  toCssColorInput,
} from "./style-field-utils";

describe("style field utils", () => {
  it("clamps outline width to ASS-style 0–4 px with 0.1 precision", () => {
    expect(STROKE_WIDTH_MAX).toBe(4);
    expect(clampStrokeWidthPx(0.1)).toBe(0.1);
    expect(clampStrokeWidthPx(1.5)).toBe(1.5);
    expect(clampStrokeWidthPx(4)).toBe(4);
    expect(clampStrokeWidthPx(4.5)).toBe(4);
    expect(clampStrokeWidthPx(10)).toBe(4);
    expect(clampStrokeWidthPx(-1)).toBe(0);
    expect(clampStrokeWidthPx("1.25")).toBe(1.3);
  });

  it("normalizes colors for HTML color inputs", () => {
    expect(toCssColorInput("#ABC")).toBe("#aabbcc");
    expect(toCssColorInput("#ff00ffaa")).toBe("#ff00ff");
    expect(toCssColorInput("#00E8FF")).toBe("#00e8ff");
    expect(toCssColorInput("not-a-color", "#ffffff")).toBe("#ffffff");
  });

  it("exposes a complete default base used when applying presets", () => {
    const required = [
      "font_family",
      "font_size_px",
      "font_weight",
      "fill_color",
      "stroke_color",
      "stroke_width_px",
      "shadow_color",
      "shadow_blur_px",
      "shadow_offset_x_px",
      "shadow_offset_y_px",
      "background_color",
      "background_opacity",
      "background_padding_x_px",
      "background_padding_y_px",
      "background_radius_px",
      "line_spacing_em",
      "letter_spacing_em",
      "text_align",
      "line_gap_px",
      "effect",
    ];
    for (const key of required) {
      expect(STYLE_BASE_DEFAULTS[key], key).toBeDefined();
    }
  });

  it("resolves base fields from the active style record", () => {
    expect(
      resolveStyleFieldValue("font_size_px", { font_size_px: 42 }, { fallback: 30 }),
    ).toBe(42);
    expect(resolveStyleFieldValue("fill_color", {}, { fallback: "#ffffff" })).toBe("#ffffff");
  });

  it("inherits unset slot fields from base except font_family inherit mode", () => {
    const base = { font_size_px: 36, fill_color: "#ff0000", font_family: '"Base Regular", sans-serif' };
    const slot = { font_size_px: 48 };

    expect(
      resolveStyleFieldValue("font_size_px", slot, { inheritFrom: base, fallback: 30 }),
    ).toBe(48);
    expect(
      resolveStyleFieldValue("fill_color", slot, { inheritFrom: base, fallback: "#ffffff" }),
    ).toBe("#ff0000");
    expect(
      resolveStyleFieldValue("font_family", {}, {
        inheritFrom: base,
        allowInheritFont: true,
        fallback: '"Default", sans-serif',
      }),
    ).toBe("");
    expect(
      resolveStyleFields(slot, { inheritFrom: base, allowInheritFont: true }).font_size_px,
    ).toBe(48);
    expect(
      resolveStyleFields(slot, { inheritFrom: base, allowInheritFont: true }).fill_color,
    ).toBe("#ff0000");
  });
});
