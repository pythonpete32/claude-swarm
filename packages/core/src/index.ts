// Main exports
export { main } from "./main.js";

// Core modules - use wildcard exports but be aware of potential conflicts
export * from "./core/git.js";
export * from "./core/worktree.js";
export * from "./core/github.js";
export * from "./core/tmux.js";
export * from "./core/claude.js";
export * from "./core/files.js";
export * from "./core/database.js";

// Database schema exports
export * from "./db/schema.js";

// Shared modules
export * from "./shared/index.js";
