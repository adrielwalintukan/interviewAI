import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Prompt eval against real providers (docs/ai-design.md §5); kept out of `npm test` and CI. Aliases mirror vitest.config.mts.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/empty.ts", import.meta.url)),
    },
  },
  test: { include: ["tests/eval/**/*.eval.ts"], environment: "node" },
});
