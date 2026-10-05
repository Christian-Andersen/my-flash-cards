import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The Tailwind plugin is included so `@theme` tokens and `@layer` blocks
  // resolve the same way they do in the app, not just in production.
  plugins: [preact(), tailwindcss()],
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Node is the default. Component tests opt into a DOM with a
    // `@vitest-environment jsdom` docblock, which keeps the split per file
    // rather than duplicating config for each environment.
    environment: "node",
    // Process and inject stylesheets instead of stubbing CSS imports, so
    // layout assertions read the real cascade rather than user-agent defaults.
    css: true,
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
    testTimeout: 60_000,
  },
});
