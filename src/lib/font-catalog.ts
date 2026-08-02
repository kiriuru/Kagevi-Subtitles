import { readMigratedLocalStorage, writeBrandLocalStorage } from "./brand";

export type FontScriptTag = "latin" | "cyrillic" | "japanese" | "chinese" | "korean";

export interface FontCatalogEntry {
  id: string;
  label: string;
  family: string;
  source: string;
  url?: string;
  filename?: string;
  format?: string;
  /** Alphabet tags for the picker label (`style.font.script.*`). */
  scripts?: FontScriptTag[];
}

export interface FontCatalog {
  project_fonts_dir: string;
  project_local: FontCatalogEntry[];
  fallback: FontCatalogEntry[];
  system?: FontCatalogEntry[];
}

const SYSTEM_FONTS_CACHE_KEY = "kagevi-subtitles.system_fonts.v1";
const SYSTEM_FONTS_CACHE_KEY_PREV = "kagevi-voice.system_fonts.v1";
const SYSTEM_FONTS_CACHE_KEY_LEGACY = "voicesub.system_fonts.v1";

export function mergeFontCatalogPreservingSystem(
  incoming: FontCatalog,
  previous?: FontCatalog | null,
): FontCatalog {
  const system = previous?.system?.length ? previous.system : incoming.system || [];
  return { ...incoming, system };
}

export function loadCachedSystemFonts(): FontCatalogEntry[] {
  try {
    const raw = readMigratedLocalStorage(
      SYSTEM_FONTS_CACHE_KEY,
      SYSTEM_FONTS_CACHE_KEY_PREV,
      SYSTEM_FONTS_CACHE_KEY_LEGACY,
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FontCatalogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCachedSystemFonts(entries: FontCatalogEntry[]): void {
  writeBrandLocalStorage(
    SYSTEM_FONTS_CACHE_KEY,
    JSON.stringify(entries),
    SYSTEM_FONTS_CACHE_KEY_PREV,
    SYSTEM_FONTS_CACHE_KEY_LEGACY,
  );
}

export async function refreshSystemFonts(): Promise<FontCatalogEntry[]> {
  if (!("queryLocalFonts" in window)) {
    return loadCachedSystemFonts();
  }
  try {
    const fonts = await (window as Window & {
      queryLocalFonts?: () => Promise<Array<{ family: string; fullName?: string }>>;
    }).queryLocalFonts!();
    const seen = new Set<string>();
    const entries: FontCatalogEntry[] = [];
    for (const font of fonts) {
      const family = String(font.family || "").trim();
      if (!family || seen.has(family.toLowerCase())) continue;
      seen.add(family.toLowerCase());
      entries.push({
        id: `system-${family.toLowerCase().replace(/\s+/g, "-")}`,
        label: family,
        family: `"${family.replace(/"/g, "")}"`,
        source: "system",
      });
    }
    entries.sort((a, b) => a.label.localeCompare(b.label));
    saveCachedSystemFonts(entries);
    return entries;
  } catch {
    return loadCachedSystemFonts();
  }
}

export function fontOptions(catalog: FontCatalog | null): FontCatalogEntry[] {
  if (!catalog) return [];
  return [
    ...(catalog.project_local || []),
    ...(catalog.system || []),
    ...(catalog.fallback || []),
  ];
}

const FONT_SCRIPT_KEY: Record<FontScriptTag, string> = {
  latin: "style.font.script.latin",
  cyrillic: "style.font.script.cyrillic",
  japanese: "style.font.script.japanese",
  chinese: "style.font.script.chinese",
  korean: "style.font.script.korean",
};

/** e.g. `Oswald Bold · Latin` / `Noto Sans Regular · Latin · Cyrillic` (same ` · ` as OBS translation modes). */
export function formatFontOptionLabel(
  font: Pick<FontCatalogEntry, "label" | "scripts">,
  tr: (key: string) => string,
): string {
  const label = String(font.label || "").trim();
  if (!label) return "";
  const scripts = Array.isArray(font.scripts)
    ? font.scripts
        .map((tag) => FONT_SCRIPT_KEY[tag as FontScriptTag])
        .filter(Boolean)
        .map((key) => tr(key))
        .filter(Boolean)
    : [];
  if (!scripts.length) return label;
  return `${label} · ${scripts.join(" · ")}`;
}

export function extractPrimaryFontFamily(chain: string): string {
  const str = String(chain || "").trim();
  if (!str) return "";
  const quoted = str.match(/"([^"]+)"/);
  if (quoted?.[1]) return `"${quoted[1].trim()}"`;
  const bare = str.split(",")[0]?.trim();
  return bare || "";
}

function fontFamilyKey(token: string): string {
  return extractPrimaryFontFamily(token).replace(/"/g, "").trim().toLowerCase();
}

/**
 * Replace only the primary face in a CSS font-family stack, keeping the rest
 * of the fallback chain (critical for Latin/JP + Cyrillic dual-script presets).
 */
export function replacePrimaryFontFamily(chain: string, newPrimaryFamily: string): string {
  const incoming = String(newPrimaryFamily || "").trim();
  if (!incoming) return String(chain || "");

  const rest = String(chain || "")
    .split(",")
    .slice(1)
    .map((part) => part.trim())
    .filter(Boolean);

  const primaryToken = incoming.includes(",")
    ? extractPrimaryFontFamily(incoming)
    : incoming;
  const normalizedPrimary = primaryToken.startsWith('"')
    ? primaryToken
    : `"${primaryToken.replace(/"/g, "")}"`;
  const primaryKey = fontFamilyKey(normalizedPrimary);

  const filteredRest = rest.filter((part) => {
    const key = fontFamilyKey(part);
    return Boolean(key) && key !== primaryKey;
  });

  return [normalizedPrimary, ...filteredRest].join(", ");
}
