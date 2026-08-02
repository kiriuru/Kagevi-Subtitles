import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("overlay layout CSS contract", () => {
  const css = readFileSync(join(root, "bin/overlay/shared/css/subtitle-style.css"), "utf8");

  it("lays out single and dual-line shared rows horizontally", () => {
    expect(css).toMatch(
      /\.subtitle-line__content--single,\s*\n\.subtitle-line__content--dual-line\s*\{[^}]*flex-direction:\s*row/s,
    );
    expect(css).toContain("justify-content: var(--subtitle-justify, center)");
  });

  it("keeps default content stack as column for stacked rows", () => {
    expect(css).toMatch(/\.subtitle-line__content\s*\{[^}]*flex-direction:\s*column/s);
  });

  it("shrink-wraps stacked surfaces to text width (not full stage)", () => {
    expect(css).toMatch(
      /\.subtitle-line__content\s*\{[^}]*align-items:\s*var\(--subtitle-justify,\s*center\)/s,
    );
    expect(css).toMatch(/\.subtitle-line__surface\s*\{[^}]*width:\s*fit-content/s);
  });
});
