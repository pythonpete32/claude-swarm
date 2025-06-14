/**
 * Validation utilities for Claude Swarm
 *
 * Provides consistent validation patterns, sanitization utilities,
 * and validation result handling across all modules.
 */

import { ERROR_CODES, ErrorFactory } from "@/shared/errors";
import type { ValidationResult } from "@/shared/types";

/**
 * Validation rule interface
 */
export interface ValidationRule<T = unknown> {
  name: string;
  validator: (value: T) => boolean;
  message: string;
}

/**
 * Path validation utilities
 */
export const PathValidation = {
  /**
   * Check if path is a valid directory path
   */
  isValidDirectoryPath(path: string): boolean {
    if (!path || typeof path !== "string") return false;

    // Check for invalid characters
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Control chars are intentionally checked for security
    const invalidChars = /[<>:"|?*\x00-\x1f]/;
    if (invalidChars.test(path)) return false;

    // Check for reserved names on Windows
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    const parts = path.split(/[/\\]/);
    return !parts.some((part) => reservedNames.test(part));
  },

  /**
   * Check if path is safe for worktree operations
   */
  isValidWorktreePath(path: string): boolean {
    if (!this.isValidDirectoryPath(path)) return false;

    // Additional worktree-specific checks
    if (path.includes("..")) return false; // No parent directory traversal
    if (path.startsWith("/") && process.platform === "win32") return false; // No absolute paths on Windows without drive
    if (path.startsWith("./")) return true; // Relative paths are OK
    if (path.includes("/")) return true; // Paths with subdirectories are OK

    return true;
  },

  /**
   * Sanitize path for safe use
   */
  sanitizePath(path: string): string {
    return (
      path
        // biome-ignore lint/suspicious/noControlCharactersInRegex: Control chars are intentionally removed for security
        .replace(/[<>:"|?*\x00-\x1f]/g, "") // Remove invalid characters
        .replace(/\.\./g, "") // Remove parent directory traversal
        .replace(/\/+/g, "/") // Collapse multiple slashes
        .trim()
    );
  },
};

/**
 * Git validation utilities
 */
export const GitValidation = {
  /**
   * Check if branch name is valid
   */
  isValidBranchName(name: string): boolean {
    if (!name || typeof name !== "string") return false;
    if (name.length === 0 || name.length > 250) return false;

    // Git branch name rules
    const invalidPatterns = [
      /^\./, // Cannot start with dot
      /\.\.|\/\/|@\{/, // Cannot contain these sequences
      // biome-ignore lint/suspicious/noControlCharactersInRegex: Control chars are intentionally checked for Git compliance
      /[\x00-\x1f\x7f]/, // No control characters
      /[~^:?*\[]/, // No special characters
      /\.$/, // Cannot end with dot
      /\/$/, // Cannot end with slash
      /\.lock$/, // Cannot end with .lock
    ];

    return !invalidPatterns.some((pattern) => pattern.test(name));
  },

  /**
   * Check if commit SHA is valid
   */
  isValidCommitSha(sha: string): boolean {
    if (!sha || typeof sha !== "string") return false;
    return /^[a-f0-9]{7,40}$/i.test(sha);
  },

  /**
   * Check if remote URL is valid
   */
  isValidRemoteUrl(url: string): boolean {
    if (!url || typeof url !== "string") return false;

    try {
      const parsed = new URL(url);
      return ["http:", "https:", "git:", "ssh:"].includes(parsed.protocol);
    } catch {
      // Also check SSH format: user@host:path
      return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+:[a-zA-Z0-9._/-]+$/.test(url);
    }
  },

  /**
   * Sanitize branch name
   */
  sanitizeBranchName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9._/-]/g, "-") // Replace invalid chars with dash
      .replace(/^\.+/, "") // Remove leading dots
      .replace(/\.+$/, "") // Remove trailing dots
      .replace(/\/+$/, "") // Remove trailing slashes
      .replace(/\.\.+/g, ".") // Collapse multiple dots
      .replace(/\/\/+/g, "/") // Collapse multiple slashes
      .replace(/--+/g, "-") // Collapse multiple dashes
      .substring(0, 250); // Limit length
  },
};

/**
 * GitHub validation utilities
 */
export const GitHubValidation = {
  /**
   * Check if repository name is valid
   */
  isValidRepositoryName(name: string): boolean {
    if (!name || typeof name !== "string") return false;
    if (name.length === 0 || name.length > 100) return false;

    // GitHub repository name rules
    return /^[a-zA-Z0-9._-]+$/.test(name) && !name.startsWith(".") && !name.endsWith(".");
  },

  /**
   * Check if username/organization name is valid
   */
  isValidUsername(username: string): boolean {
    if (!username || typeof username !== "string") return false;
    if (username.length === 0 || username.length > 39) return false;

    // GitHub username rules
    return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(username);
  },

  /**
   * Check if GitHub token format is valid
   */
  isValidToken(token: string): boolean {
    if (!token || typeof token !== "string") return false;

    // GitHub token patterns - more flexible for testing
    return (
      /^gh[ps]_[a-zA-Z0-9]{36,40}$/.test(token) ||
      /^github_pat_[a-zA-Z0-9_]{82}$/.test(token) ||
      /^gho_[a-zA-Z0-9]{36,40}$/.test(token)
    ); // GitHub OAuth token
  },

  /**
   * Check if issue/PR number is valid
   */
  isValidIssueNumber(number: number | string): boolean {
    const num = typeof number === "string" ? Number.parseInt(number, 10) : number;
    return Number.isInteger(num) && num > 0 && num <= 999999999;
  },
};

/**
 * tmux validation utilities
 */
export const TmuxValidation = {
  /**
   * Check if session name is valid
   */
  isValidSessionName(name: string): boolean {
    if (!name || typeof name !== "string") return false;
    if (name.length === 0 || name.length > 255) return false;

    // tmux session name rules - no spaces, no special chars
    return /^[a-zA-Z0-9._-]+$/.test(name);
  },

  /**
   * Sanitize session name
   */
  sanitizeSessionName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9._-]/g, "-") // Replace invalid chars
      .replace(/--+/g, "-") // Collapse multiple dashes
      .substring(0, 255); // Limit length
  },
};

/**
 * General input validation utilities
 */
export const InputValidation = {
  /**
   * Check if string is non-empty
   */
  isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
  },

  /**
   * Check if value is a positive integer
   */
  isPositiveInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value > 0;
  },

  /**
   * Check if value is a valid timeout (positive number in milliseconds)
   */
  isValidTimeout(value: unknown): value is number {
    return typeof value === "number" && value >= 0 && value <= 300000; // Max 5 minutes
  },

  /**
   * Check if email format is valid
   */
  isValidEmail(email: string): boolean {
    if (!email || typeof email !== "string") return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  /**
   * Check if URL format is valid
   */
  isValidUrl(url: string): boolean {
    if (!url || typeof url !== "string") return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },
};

/**
 * Validation result builder
 */
export class ValidationResultBuilder {
  private errors: string[] = [];
  private warnings: string[] = [];

  /**
   * Add an error
   */
  addError(message: string): this {
    this.errors.push(message);
    return this;
  }

  /**
   * Add a warning
   */
  addWarning(message: string): this {
    this.warnings.push(message);
    return this;
  }

  /**
   * Add conditional error
   */
  addErrorIf(condition: boolean, message: string): this {
    if (condition) {
      this.errors.push(message);
    }
    return this;
  }

  /**
   * Add conditional warning
   */
  addWarningIf(condition: boolean, message: string): this {
    if (condition) {
      this.warnings.push(message);
    }
    return this;
  }

  /**
   * Build final validation result
   */
  build(): ValidationResult {
    return {
      isValid: this.errors.length === 0,
      errors: [...this.errors],
      warnings: [...this.warnings],
    };
  }

  /**
   * Reset builder for reuse
   */
  reset(): this {
    this.errors = [];
    this.warnings = [];
    return this;
  }
}

/**
 * Generic validator class
 */
export class Validator<T> {
  private rules: ValidationRule<T>[] = [];

  /**
   * Add a validation rule
   */
  addRule(rule: ValidationRule<T>): this {
    this.rules.push(rule);
    return this;
  }

  /**
   * Add a custom validation function
   */
  addCustomRule(name: string, validator: (value: T) => boolean, message: string): this {
    return this.addRule({ name, validator, message });
  }

  /**
   * Validate a value against all rules
   */
  validate(value: T): ValidationResult {
    const builder = new ValidationResultBuilder();

    for (const rule of this.rules) {
      try {
        if (!rule.validator(value)) {
          builder.addError(rule.message);
        }
      } catch (error) {
        builder.addError(
          `Validation rule "${rule.name}" failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return builder.build();
  }

  /**
   * Validate and throw on error
   */
  validateOrThrow(value: T, context = "validation"): void {
    const result = this.validate(value);
    if (!result.isValid) {
      throw ErrorFactory.worktree(
        ERROR_CODES.CORE_INVALID_PARAMETERS,
        `${context} failed: ${result.errors.join(", ")}`,
        { errors: result.errors, warnings: result.warnings },
      );
    }
  }
}

/**
 * Common validators
 */
export const CommonValidators = {
  /**
   * Create a validator for worktree paths
   */
  worktreePath(): Validator<string> {
    return new Validator<string>()
      .addCustomRule("non-empty", InputValidation.isNonEmptyString, "Path cannot be empty")
      .addCustomRule(
        "valid-path",
        (path: string) => PathValidation.isValidWorktreePath(path),
        "Path contains invalid characters or patterns",
      );
  },

  /**
   * Create a validator for branch names
   */
  branchName(): Validator<string> {
    return new Validator<string>()
      .addCustomRule("non-empty", InputValidation.isNonEmptyString, "Branch name cannot be empty")
      .addCustomRule(
        "valid-format",
        (name: string) => GitValidation.isValidBranchName(name),
        "Branch name contains invalid characters or format",
      );
  },

  /**
   * Create a validator for GitHub repositories
   */
  githubRepository(): Validator<{ owner: string; name: string }> {
    return new Validator<{ owner: string; name: string }>()
      .addCustomRule(
        "valid-owner",
        (repo) => GitHubValidation.isValidUsername(repo.owner),
        "Repository owner name is invalid",
      )
      .addCustomRule(
        "valid-name",
        (repo) => GitHubValidation.isValidRepositoryName(repo.name),
        "Repository name is invalid",
      );
  },

  /**
   * Create a validator for tmux session names
   */
  tmuxSession(): Validator<string> {
    return new Validator<string>()
      .addCustomRule("non-empty", InputValidation.isNonEmptyString, "Session name cannot be empty")
      .addCustomRule(
        "valid-format",
        (name: string) => TmuxValidation.isValidSessionName(name),
        "Session name contains invalid characters",
      );
  },
};
