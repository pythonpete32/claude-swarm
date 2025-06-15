import type { Config } from "@/shared/types";

/**
 * Creates a default configuration object
 */
export function createDefaultConfig(): Config {
  return {
    debug: process.env.NODE_ENV === "development",
    logLevel: "info",
    workingDirectory: process.cwd(),
  };
}

/**
 * Validates if a string is not empty
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Safely parses JSON with error handling
 */
export function safeJsonParse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
