/**
 * Core configuration interface for the application
 */
export interface Config {
  readonly debug: boolean;
  readonly logLevel: "error" | "warn" | "info" | "debug";
  readonly workingDirectory: string;
}

/**
 * Git operation result interface
 */
export interface GitResult {
  readonly success: boolean;
  readonly output: string;
  readonly error?: string;
}

/**
 * Worktree information interface
 */
export interface WorktreeInfo {
  readonly path: string;
  readonly branch: string;
  readonly isMainWorktree: boolean;
  readonly commit: string;
}
