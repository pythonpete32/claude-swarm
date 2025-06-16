import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 10000, // 10 seconds for tests
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        functions: 80,
        branches: 80,
        lines: 80,
        statements: 80,
      },
    },
    setupFiles: ["./tests/fixtures/setup.ts"],
  },
});