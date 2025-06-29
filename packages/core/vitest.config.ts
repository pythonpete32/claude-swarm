import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["tests/**/*", "dist/**/*"],
    },
    include: ["tests/**/*.test.ts"],
  },
});
