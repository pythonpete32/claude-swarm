import type { Config } from "./shared/types.js";
import { createDefaultConfig, isNonEmptyString } from "./shared/utils.js";

/**
 * Main application entry point
 */
export function main(): void {
  const config: Config = createDefaultConfig();

  console.log("🚀 Claude Codex Starting...");
  console.log(`Debug mode: ${config.debug}`);
  console.log(`Log level: ${config.logLevel}`);

  if (isNonEmptyString(config.workingDirectory)) {
    console.log(`Working directory: ${config.workingDirectory}`);
  }
}

// Run if this is the main module
if (import.meta.main) {
  main();
}
