/**
 * Shared infrastructure exports
 *
 * Central export point for all shared utilities, types, and infrastructure
 * used across Claude Swarm modules.
 */

// Type definitions
export type {
  Config,
  GitResult,
  WorktreeInfo,
  RepositoryInfo,
  GitBranchInfo,
  TaskInfo,
  WorktreeOptions,
  GitOptions,
  GitHubOptions,
  ClaudeOptions,
  ValidationResult,
  OperationResult,
  FileInfo,
  ProcessResult,
} from "./types";

// Error handling
export {
  ERROR_CODES,
  SwarmError,
  WorktreeError,
  GitError,
  GitHubError,
  GitHubAPIError,
  GitHubRateLimitError,
  ClaudeError,
  TmuxError,
  FileError,
  ErrorFactory,
  ErrorUtils,
} from "./errors";

export type { ErrorCode } from "./errors";

// Configuration management
export {
  ConfigManager,
  ConfigUtils,
  config,
  getConfig,
  updateConfig,
  isDebugMode,
  getLogLevel,
} from "./config";

export type { SwarmConfig } from "./config";

// Validation utilities
export {
  PathValidation,
  GitValidation,
  GitHubValidation,
  TmuxValidation,
  InputValidation,
  ValidationResultBuilder,
  Validator,
  CommonValidators,
} from "./validation";

export type { ValidationRule } from "./validation";

// Utility functions (keeping existing ones)
export {
  createDefaultConfig,
  isNonEmptyString,
  safeJsonParse,
} from "./utils";
