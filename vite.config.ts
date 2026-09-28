import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [preact(), tailwindcss()],
  build: {
    // Cloudflare Pages serves whatever this directory contains.
    outDir: "dist",
    // Shiki output is large and per-card; the default warning is noise here.
    chunkSizeWarningLimit: 900,
  },
});
