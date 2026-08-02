import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** OBS overlay only needs the document title; keep the CEF payload tiny. */
const OVERLAY_LOCALE_KEYS = ["document.title.overlay"];

function filterMessages(messages, keys) {
  if (!keys) {
    return messages;
  }
  const out = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(messages, key)) {
      out[key] = messages[key];
    }
  }
  return out;
}

function buildBundle(localesDir, outPath, keyAllowlist) {
  const locales = fs
    .readdirSync(localesDir)
    .filter((f) => f.endsWith(".js"))
    .map((f) => f.replace(/\.js$/, ""));
  let out = "(function () {\n  window.__SST_I18N_LOCALES = window.__SST_I18N_LOCALES || {};\n";
  for (const locale of locales) {
    const code = fs.readFileSync(path.join(localesDir, `${locale}.js`), "utf8");
    const sandbox = { window: { __SST_I18N_LOCALES: {} } };
    vm.runInNewContext(code, sandbox);
    const messages = sandbox.window.__SST_I18N_LOCALES[locale];
    if (!messages) continue;
    const filtered = filterMessages(messages, keyAllowlist);
    out += `  window.__SST_I18N_LOCALES.${locale} = ${JSON.stringify(filtered, null, 2)};\n`;
  }
  out += "})();\n";
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, out);
  console.log(`wrote ${outPath}`);
}

const sourceLocalesDir = path.join(root, "scripts", "i18n-source", "locales");
const overlayBundle = path.join(
  root,
  "bin",
  "overlay",
  "shared",
  "js",
  "i18n",
  "locales-bundle.js",
);

buildBundle(sourceLocalesDir, overlayBundle, OVERLAY_LOCALE_KEYS);
