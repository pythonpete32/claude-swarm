import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        functions: 100,
        branches: 100,
        lines: 100,
        statements: 100,
      },
    },
    setupFiles: ["./tests/fixtures/setup.ts"],
  },
});
