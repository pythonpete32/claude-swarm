#!/usr/bin/env node

import { main } from "@claude-codex/core";

// Simple CLI wrapper around core functionality
try {
  main();
} catch (error: any) {
  console.error("Error:", error.message);
  process.exit(1);
}
