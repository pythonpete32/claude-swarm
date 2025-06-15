/**
 * Core error handling system for Claude Swarm
 *
 * Implements hierarchical error structure with standardized error codes,
 * rich context, and user-friendly messages.
 */

/**
 * Standardized error codes following MODULE_ERROR_TYPE pattern
 */
export const ERROR_CODES = {
  // Core system errors
  CORE_INVALID_CONFIGURATION: "CORE_INVALID_CONFIGURATION",
  CORE_INVALID_PARAMETERS: "CORE_INVALID_PARAMETERS",
  CORE_OPERATION_FAILED: "CORE_OPERATION_FAILED",

  // Worktree errors
  WORKTREE_EXISTS: "WORKTREE_EXISTS",
  WORKTREE_NOT_FOUND: "WORKTREE_NOT_FOUND",
  WORKTREE_UNCOMMITTED_CHANGES: "WORKTREE_UNCOMMITTED_CHANGES",
  WORKTREE_CREATION_FAILED: "WORKTREE_CREATION_FAILED",
  WORKTREE_REMOVAL_FAILED: "WORKTREE_REMOVAL_FAILED",
  WORKTREE_INVALID_PATH: "WORKTREE_INVALID_PATH",
  WORKTREE_OPERATION_FAILED: "WORKTREE_OPERATION_FAILED",

  // Git errors
  GIT_REPOSITORY_NOT_FOUND: "GIT_REPOSITORY_NOT_FOUND",
  GIT_REPOSITORY_INVALID: "GIT_REPOSITORY_INVALID",
  GIT_BRANCH_NOT_FOUND: "GIT_BRANCH_NOT_FOUND",
  GIT_BRANCH_EXISTS: "GIT_BRANCH_EXISTS",
  GIT_COMMAND_FAILED: "GIT_COMMAND_FAILED",
  GIT_UNCOMMITTED_CHANGES: "GIT_UNCOMMITTED_CHANGES",
  GIT_MERGE_CONFLICT: "GIT_MERGE_CONFLICT",
  GIT_REMOTE_ERROR: "GIT_REMOTE_ERROR",
  GIT_INVALID_REMOTE: "GIT_INVALID_REMOTE",
  GIT_WORKING_TREE_DIRTY: "GIT_WORKING_TREE_DIRTY",

  // GitHub errors
  GITHUB_AUTH_FAILED: "GITHUB_AUTH_FAILED",
  GITHUB_API_ERROR: "GITHUB_API_ERROR",
  GITHUB_RATE_LIMIT_EXCEEDED: "GITHUB_RATE_LIMIT_EXCEEDED",
  GITHUB_REPOSITORY_NOT_FOUND: "GITHUB_REPOSITORY_NOT_FOUND",
  GITHUB_PERMISSION_DENIED: "GITHUB_PERMISSION_DENIED",
  GITHUB_NETWORK_ERROR: "GITHUB_NETWORK_ERROR",

  // Claude errors
  CLAUDE_NOT_FOUND: "CLAUDE_NOT_FOUND",
  CLAUDE_LAUNCH_FAILED: "CLAUDE_LAUNCH_FAILED",
  CLAUDE_SESSION_NOT_FOUND: "CLAUDE_SESSION_NOT_FOUND",
  CLAUDE_COMMAND_FAILED: "CLAUDE_COMMAND_FAILED",
  CLAUDE_TIMEOUT: "CLAUDE_TIMEOUT",

  // tmux errors
  TMUX_NOT_AVAILABLE: "TMUX_NOT_AVAILABLE",
  TMUX_SESSION_EXISTS: "TMUX_SESSION_EXISTS",
  TMUX_SESSION_NOT_FOUND: "TMUX_SESSION_NOT_FOUND",
  TMUX_COMMAND_FAILED: "TMUX_COMMAND_FAILED",
  TMUX_PERMISSION_DENIED: "TMUX_PERMISSION_DENIED",

  // File system errors
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  FILE_PERMISSION_DENIED: "FILE_PERMISSION_DENIED",
  FILE_INVALID_FORMAT: "FILE_INVALID_FORMAT",
  FILE_OPERATION_FAILED: "FILE_OPERATION_FAILED",
  FILE_ALREADY_EXISTS: "FILE_ALREADY_EXISTS",
  FILE_COPY_FAILED: "FILE_COPY_FAILED",
  FILE_INVALID_STRUCTURE: "FILE_INVALID_STRUCTURE",
  FILE_CLEANUP_FAILED: "FILE_CLEANUP_FAILED",
  FILE_PARSE_FAILED: "FILE_PARSE_FAILED",
  FILE_CONTEXT_INCOMPLETE: "FILE_CONTEXT_INCOMPLETE",
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

/**
 * Base error class for all Claude Swarm errors
 */
export class SwarmError extends Error {
  public readonly code: string;
  public readonly module: string;
  public readonly details: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    module: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "SwarmError";
    this.code = code;
    this.module = module;
    this.details = details;
    this.timestamp = new Date();

    // Ensure proper stack trace capture
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SwarmError);
    }
  }

  /**
   * Serialize error for logging or transmission
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      module: this.module,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }

  /**
   * Get user-friendly error message with context
   */
  getUserMessage(): string {
    return `${this.message}${this.getSuggestion() ? `\n\nSuggestion: ${this.getSuggestion()}` : ""}`;
  }

  /**
   * Get contextual suggestion for error resolution
   */
  protected getSuggestion(): string | null {
    return null;
  }
}

/**
 * Worktree-specific errors
 */
export class WorktreeError extends SwarmError {
  constructor(message: string, code: string, details: Record<string, unknown> = {}) {
    super(message, code, "worktree", details);
    this.name = "WorktreeError";
  }

  protected getSuggestion(): string | null {
    switch (this.code) {
      case ERROR_CODES.WORKTREE_EXISTS:
        return "Use --force to overwrite or choose a different path";
      case ERROR_CODES.WORKTREE_NOT_FOUND:
        return "Check the worktree path and ensure it was created correctly";
      case ERROR_CODES.WORKTREE_UNCOMMITTED_CHANGES:
        return "Commit or stash changes before removing the worktree";
      default:
        return null;
    }
  }
}

/**
 * Git operation errors
 */
export class GitError extends SwarmError {
  constructor(message: string, code: string, details: Record<string, unknown> = {}) {
    super(message, code, "git", details);
    this.name = "GitError";
  }

  protected getSuggestion(): string | null {
    switch (this.code) {
      case ERROR_CODES.GIT_REPOSITORY_NOT_FOUND:
        return "Ensure you're in a git repository or initialize one with 'git init'";
      case ERROR_CODES.GIT_REPOSITORY_INVALID:
        return "Check that the directory contains a valid git repository";
      case ERROR_CODES.GIT_BRANCH_NOT_FOUND:
        return "Check the branch name or create it with 'git checkout -b <branch>'";
      case ERROR_CODES.GIT_BRANCH_EXISTS:
        return "Use a different branch name or switch to the existing branch";
      case ERROR_CODES.GIT_UNCOMMITTED_CHANGES:
      case ERROR_CODES.GIT_WORKING_TREE_DIRTY:
        return "Commit changes with 'git commit' or stash them with 'git stash'";
      case ERROR_CODES.GIT_INVALID_REMOTE:
        return "Check the remote URL format and ensure it's a valid Git remote";
      default:
        return null;
    }
  }
}

/**
 * GitHub API errors
 */
export class GitHubError extends SwarmError {
  constructor(message: string, code: string, details: Record<string, unknown> = {}) {
    super(message, code, "github", details);
    this.name = "GitHubError";
  }

  protected getSuggestion(): string | null {
    switch (this.code) {
      case ERROR_CODES.GITHUB_AUTH_FAILED:
        return "Check your GitHub token and permissions with 'gh auth status'";
      case ERROR_CODES.GITHUB_RATE_LIMIT_EXCEEDED:
        return "Wait for rate limit reset or use a different authentication method";
      case ERROR_CODES.GITHUB_PERMISSION_DENIED:
        return "Ensure your token has the required scopes for this operation";
      default:
        return null;
    }
  }
}

/**
 * GitHub API-specific error with HTTP details
 */
export class GitHubAPIError extends GitHubError {
  public readonly status: number;
  public readonly response?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    response?: Record<string, unknown>,
    details: Record<string, unknown> = {},
  ) {
    super(message, ERROR_CODES.GITHUB_API_ERROR, {
      ...details,
      status,
      response,
    });
    this.name = "GitHubAPIError";
    this.status = status;
    this.response = response;
  }
}

/**
 * GitHub rate limit error with timing details
 */
export class GitHubRateLimitError extends GitHubError {
  public readonly resetTime: Date;
  public readonly limit: number;
  public readonly remaining: number;

  constructor(
    resetTime: Date,
    limit: number,
    remaining: number,
    details: Record<string, unknown> = {},
  ) {
    const resetIn = Math.ceil((resetTime.getTime() - Date.now()) / 1000 / 60);
    super(
      `GitHub API rate limit exceeded. Resets in ${resetIn} minutes.`,
      ERROR_CODES.GITHUB_RATE_LIMIT_EXCEEDED,
      {
        ...details,
        resetTime: resetTime.toISOString(),
        limit,
        remaining,
      },
    );
    this.name = "GitHubRateLimitError";
    this.resetTime = resetTime;
    this.limit = limit;
    this.remaining = remaining;
  }
}

/**
 * Claude Code integration errors
 */
export class ClaudeError extends SwarmError {
  constructor(message: string, code: string, details: Record<string, unknown> = {}) {
    super(message, code, "claude", details);
    this.name = "ClaudeError";
  }

  protected getSuggestion(): string | null {
    switch (this.code) {
      case ERROR_CODES.CLAUDE_NOT_FOUND:
        return "Install Claude Code with 'npm install -g @anthropic-ai/claude-code'";
      case ERROR_CODES.CLAUDE_SESSION_NOT_FOUND:
        return "Check if the Claude session is still active";
      default:
        return null;
    }
  }
}

/**
 * tmux session management errors
 */
export class TmuxError extends SwarmError {
  constructor(message: string, code: string, details: Record<string, unknown> = {}) {
    super(message, code, "tmux", details);
    this.name = "TmuxError";
  }

  protected getSuggestion(): string | null {
    switch (this.code) {
      case ERROR_CODES.TMUX_NOT_AVAILABLE:
        return "Install tmux with your package manager (brew install tmux, apt-get install tmux, etc.)";
      case ERROR_CODES.TMUX_SESSION_EXISTS:
        return "Use a different session name or attach to the existing session";
      default:
        return null;
    }
  }
}

/**
 * File system operation errors
 */
export class FileError extends SwarmError {
  constructor(message: string, code: string, details: Record<string, unknown> = {}) {
    super(message, code, "files", details);
    this.name = "FileError";
  }

  protected getSuggestion(): string | null {
    switch (this.code) {
      case ERROR_CODES.FILE_NOT_FOUND:
        return "Check the file path and ensure the file exists";
      case ERROR_CODES.FILE_PERMISSION_DENIED:
        return "Check file permissions and ensure you have access";
      case ERROR_CODES.FILE_COPY_FAILED:
        return "Ensure source file exists and target directory is writable";
      case ERROR_CODES.FILE_INVALID_STRUCTURE:
        return "Verify project structure meets workflow requirements";
      case ERROR_CODES.FILE_CONTEXT_INCOMPLETE:
        return "Ensure CLAUDE.md and .claude/ directory are present in source";
      case ERROR_CODES.FILE_PARSE_FAILED:
        return "Check file format and content structure";
      default:
        return null;
    }
  }
}

/**
 * Error creation utilities
 */
export const ErrorFactory = {
  /**
   * Create a core SwarmError with standardized formatting
   */
  core(code: string, message: string, details?: Record<string, unknown>): SwarmError {
    return new SwarmError(message, code, "core", details);
  },

  /**
   * Create a WorktreeError with standardized formatting
   */
  worktree(code: string, message: string, details?: Record<string, unknown>): WorktreeError {
    return new WorktreeError(message, code, details);
  },

  /**
   * Create a GitError with standardized formatting
   */
  git(code: string, message: string, details?: Record<string, unknown>): GitError {
    return new GitError(message, code, details);
  },

  /**
   * Create a GitHubError with standardized formatting
   */
  github(code: string, message: string, details?: Record<string, unknown>): GitHubError {
    return new GitHubError(message, code, details);
  },

  /**
   * Create a ClaudeError with standardized formatting
   */
  claude(code: string, message: string, details?: Record<string, unknown>): ClaudeError {
    return new ClaudeError(message, code, details);
  },

  /**
   * Create a TmuxError with standardized formatting
   */
  tmux(code: string, message: string, details?: Record<string, unknown>): TmuxError {
    return new TmuxError(message, code, details);
  },

  /**
   * Create a FileError with standardized formatting
   */
  file(code: string, message: string, details?: Record<string, unknown>): FileError {
    return new FileError(message, code, details);
  },
};

/**
 * Error handling utilities
 */
export const ErrorUtils = {
  /**
   * Check if error is a specific SwarmError type
   */
  isSwarmError(error: unknown): error is SwarmError {
    return error instanceof SwarmError;
  },

  /**
   * Check if error is a specific module error
   */
  isModuleError(error: unknown, module: string): error is SwarmError {
    return ErrorUtils.isSwarmError(error) && error.module === module;
  },

  /**
   * Extract error details for logging
   */
  getErrorDetails(error: unknown): Record<string, unknown> {
    if (ErrorUtils.isSwarmError(error)) {
      return error.toJSON();
    }

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return {
      error: String(error),
    };
  },

  /**
   * Format error for user display
   */
  formatUserError(error: unknown): string {
    if (ErrorUtils.isSwarmError(error)) {
      return error.getUserMessage();
    }

    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  },
};
