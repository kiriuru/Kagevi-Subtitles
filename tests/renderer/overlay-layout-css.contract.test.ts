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

  it("scrolls each overflowing OBS overlay line without shrinking fonts", () => {
    expect(css).toMatch(
      /\.is-overlay-shell \.subtitle-line\.is-overlay-line-clip \.subtitle-line__content\s*\{[^}]*top:\s*0/s,
    );
    expect(css).toMatch(
      /\.is-overlay-shell \.subtitle-line\.is-overlay-line-clip \.subtitle-line__content\s*\{[^}]*transform:\s*translateY\(var\(--overlay-scroll-y/s,
    );
    expect(css).toMatch(
      /\.is-overlay-shell \.subtitle-line\.is-overlay-line-clip\s*\{[^}]*overflow:\s*hidden/s,
    );
  });
});

describe("OBS overlay viewport CSS contract", () => {
  const overlayCss = readFileSync(join(root, "bin/overlay/overlay.css"), "utf8");

  it("fills the Browser Source box and clips to it", () => {
    expect(overlayCss).toMatch(/html,\s*\nbody\s*\{[^}]*height:\s*100%/s);
    expect(overlayCss).toMatch(/html,\s*\nbody\s*\{[^}]*overflow:\s*hidden/s);
    expect(overlayCss).toMatch(/\.overlay\s*\{[^}]*height:\s*100%/s);
    expect(overlayCss).toMatch(/\.overlay\s*\{[^}]*overflow:\s*hidden/s);
    expect(overlayCss).toMatch(/\.overlay-lines\s*\{[^}]*flex:\s*1 1 auto/s);
    expect(overlayCss).toMatch(/\.overlay-lines\s*\{[^}]*height:\s*0/s);
    expect(overlayCss).toMatch(/\.overlay-lines\s*\{[^}]*min-height:\s*0/s);
    expect(overlayCss).toMatch(/\.overlay\s*\{[^}]*justify-content:\s*flex-start/s);
    expect(overlayCss).toMatch(/\.overlay-lines\s*\{[^}]*justify-content:\s*flex-start/s);
    expect(overlayCss).toMatch(/\.overlay\.is-fit\s*\{[^}]*justify-content:\s*flex-start/s);
  });
});
