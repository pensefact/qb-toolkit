import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests run against package sources directly (same approach as ui/vite.config.ts),
// so `npm test` works on a fresh clone without building @qb-toolkit/core first.
const coreSrc = fileURLToPath(
  new URL("./packages/core/src/index.ts", import.meta.url)
);

export default defineConfig({
  resolve: {
    alias: {
      "@qb-toolkit/core": coreSrc,
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts"],
  },
});
