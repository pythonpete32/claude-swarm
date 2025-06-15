import { describe, expect, it } from "vitest";
import { createDefaultConfig, isNonEmptyString, safeJsonParse } from "../../../src/shared/utils";

describe("Utils", () => {
  describe("createDefaultConfig", () => {
    it("should create a valid config object", () => {
      const config = createDefaultConfig();

      expect(config).toHaveProperty("debug");
      expect(config).toHaveProperty("logLevel");
      expect(config).toHaveProperty("workingDirectory");
      expect(typeof config.debug).toBe("boolean");
      expect(["error", "warn", "info", "debug"]).toContain(config.logLevel);
    });
  });

  describe("isNonEmptyString", () => {
    it("should return true for non-empty strings", () => {
      expect(isNonEmptyString("hello")).toBe(true);
      expect(isNonEmptyString("   world   ")).toBe(true);
    });

    it("should return false for empty or invalid inputs", () => {
      expect(isNonEmptyString("")).toBe(false);
      expect(isNonEmptyString("   ")).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
    });
  });

  describe("safeJsonParse", () => {
    it("should parse valid JSON", () => {
      const result = safeJsonParse<{ name: string }>('{"name": "test"}');
      expect(result).toEqual({ name: "test" });
    });

    it("should return null for invalid JSON", () => {
      expect(safeJsonParse("invalid json")).toBe(null);
      expect(safeJsonParse("")).toBe(null);
    });
  });
});
