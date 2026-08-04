import { describe, expect, it } from "vitest";

import {
  extractPrimaryFontFamily,
  fontFamilyCssStack,
  fontScriptNativeLabels,
  formatFontOptionLabel,
  primaryFontFamiliesMatch,
  replacePrimaryFontFamily,
} from "./font-catalog";

describe("extractPrimaryFontFamily", () => {
  it("returns the first quoted family from a CSS chain", () => {
    expect(
      extractPrimaryFontFamily(
        '"VT323 Regular", "PT Mono Regular", "Consolas", monospace',
      ),
    ).toBe('"VT323 Regular"');
  });

  it("falls back to the first bare token when no quotes are present", () => {
    expect(extractPrimaryFontFamily("Segoe UI, Tahoma, sans-serif")).toBe("Segoe UI");
  });

  it("returns empty string for blank input", () => {
    expect(extractPrimaryFontFamily("")).toBe("");
    expect(extractPrimaryFontFamily("   ")).toBe("");
  });
});

describe("replacePrimaryFontFamily", () => {
  it("preserves Cyrillic-capable fallbacks when swapping the primary face", () => {
    const chain =
      '"Mochiy Pop One Regular", "Comfortaa Bold", "Underdog Regular", "Comic Relief Bold", "Segoe UI", sans-serif';
    expect(replacePrimaryFontFamily(chain, '"Bangers Regular"')).toBe(
      '"Bangers Regular", "Comfortaa Bold", "Underdog Regular", "Comic Relief Bold", "Segoe UI", sans-serif',
    );
  });

  it("dedupes when the new primary already appears later in the stack", () => {
    const chain = '"Oswald Bold", "Montserrat Bold", "Impact", sans-serif';
    expect(replacePrimaryFontFamily(chain, '"Montserrat Bold"')).toBe(
      '"Montserrat Bold", "Impact", sans-serif',
    );
  });
});

describe("fontScriptNativeLabels", () => {
  it("returns native-script alphabet tags", () => {
    expect(fontScriptNativeLabels(["latin", "cyrillic"])).toEqual(["Latin", "Кириллица"]);
    expect(fontScriptNativeLabels(["japanese", "chinese", "korean"])).toEqual([
      "日本語",
      "中文",
      "한국어",
    ]);
  });
});

describe("formatFontOptionLabel", () => {
  it("appends native-script alphabet tags with OBS-style middle-dot separators", () => {
    expect(formatFontOptionLabel({ label: "Oswald Bold", scripts: ["latin"] })).toBe(
      "Oswald Bold · Latin",
    );
    expect(
      formatFontOptionLabel({
        label: "Noto Sans Regular",
        scripts: ["latin", "cyrillic"],
      }),
    ).toBe("Noto Sans Regular · Latin · Кириллица");
    expect(
      formatFontOptionLabel({ label: "Zen Maru Gothic Bold", scripts: ["japanese"] }),
    ).toBe("Zen Maru Gothic Bold · 日本語");
  });

  it("returns the bare label when scripts are missing", () => {
    expect(formatFontOptionLabel({ label: "Segoe UI" })).toBe("Segoe UI");
  });
});

describe("fontFamilyCssStack", () => {
  it("wraps a quoted primary token with generic fallbacks", () => {
    expect(fontFamilyCssStack('"Oswald Bold", sans-serif')).toBe(
      '"Oswald Bold", ui-sans-serif, sans-serif',
    );
  });
});

describe("primaryFontFamiliesMatch", () => {
  it("compares primary faces case-insensitively", () => {
    expect(primaryFontFamiliesMatch('"Oswald Bold", sans-serif', '"oswald bold"')).toBe(true);
    expect(primaryFontFamiliesMatch('"Oswald Bold"', '"Montserrat Bold"')).toBe(false);
  });
});
