import { describe, expect, it } from "vitest";

import {
  extractPrimaryFontFamily,
  formatFontOptionLabel,
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

describe("formatFontOptionLabel", () => {
  const tr = (key: string) =>
    ({
      "style.font.script.latin": "Latin",
      "style.font.script.cyrillic": "Cyrillic",
      "style.font.script.japanese": "Japanese",
      "style.font.script.chinese": "Chinese",
      "style.font.script.korean": "Korean",
    })[key] || key;

  it("appends supported alphabets with OBS-style middle-dot separators", () => {
    expect(
      formatFontOptionLabel({ label: "Oswald Bold", scripts: ["latin"] }, tr),
    ).toBe("Oswald Bold · Latin");
    expect(
      formatFontOptionLabel(
        { label: "Noto Sans Regular", scripts: ["latin", "cyrillic"] },
        tr,
      ),
    ).toBe("Noto Sans Regular · Latin · Cyrillic");
    expect(
      formatFontOptionLabel({ label: "Zen Maru Gothic Bold", scripts: ["japanese"] }, tr),
    ).toBe("Zen Maru Gothic Bold · Japanese");
  });

  it("returns the bare label when scripts are missing", () => {
    expect(formatFontOptionLabel({ label: "Segoe UI" }, tr)).toBe("Segoe UI");
  });
});
