import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const entryUrl = pathToFileURL(
  join(root, "bin/overlay/shared/js/subtitle-style/index.js"),
).href;

// ESM entry attaches window.SubtitleStyleRenderer (same public API as the old IIFE).
await import(entryUrl);
