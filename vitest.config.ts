import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["node_modules", "dist", "build"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "coverage/**",
        "dist/**",
        "build/**",
        "**/*.d.ts",
        "**/*.config.*",
        "**/node_modules/**",
      ],
    },
  },
});
