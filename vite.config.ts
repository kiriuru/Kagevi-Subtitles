import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

const root = path.dirname(fileURLToPath(import.meta.url));
const overlayRoot = path.resolve(root, "bin/overlay");

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    // Dashboard index.html references Axum's `/overlay-assets` URLs; map them to
    // bin/overlay so Vite can resolve the shared ESM subtitle renderer at build time.
    alias: [
      {
        find: /^\/overlay-assets\/(.+)$/,
        replacement: `${overlayRoot.replace(/\\/g, "/")}/$1`,
      },
    ],
  },
  build: {
    target: "es2022",
    outDir: "bin/dashboard",
    emptyOutDir: true,
  },
  server: {
    strictPort: true,
    port: 5173,
  },
});
