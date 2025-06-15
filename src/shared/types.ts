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

/**
 * Unified repository information used across all modules
 *
 * RESOLVES: RepositoryInfo vs GitRepositoryInfo inconsistency
 * - core-github.md defined RepositoryInfo with GitHub-specific fields
 * - core-git.md defined GitRepositoryInfo with different fields
 * - UNIFIED: Single interface with optional GitHub-specific extensions
 */
export interface RepositoryInfo {
  owner: string; // Repository owner/organization
  name: string; // Repository name
  path: string; // Local repository path
  defaultBranch: string; // Main/master branch name
  remoteUrl: string; // Git remote URL

  // GitHub-specific extensions (optional)
  github?: {
    id: string; // GitHub repository ID
    nodeId: string; // GraphQL node ID
    isPrivate: boolean; // Repository visibility
    isFork: boolean; // Whether it's a fork
    parentRepo?: RepositoryInfo; // Parent repo if fork
  };
}

/**
 * Git branch information
 *
 * RESOLVES: BranchInfo vs GitBranchInfo inconsistency
 * - Multiple modules used different names for same concept
 * - UNIFIED: Using GitBranchInfo as more descriptive
 */
export interface GitBranchInfo {
  name: string; // Branch name
  commit: string; // Current commit SHA
  isDefault: boolean; // Whether this is the default branch
  isLocal: boolean; // Whether branch exists locally
  isRemote: boolean; // Whether branch exists on remote
  upstream?: string; // Upstream branch reference
  isClean: boolean; // Whether branch has uncommitted changes
}

/**
 * Task and workflow types
 */
export interface TaskInfo {
  id: string;
  title: string;
  description: string;
  branch: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  assignee?: string;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Worktree creation and management options
 */
export interface WorktreeOptions {
  baseBranch?: string; // Branch to create worktree from
  force?: boolean; // Force creation if path exists
  checkout?: boolean; // Whether to checkout files
}

/**
 * Git operation options
 */
export interface GitOptions {
  cwd?: string; // Working directory for git commands
  silent?: boolean; // Suppress command output
  timeout?: number; // Command timeout in milliseconds
}

/**
 * GitHub integration options
 */
export interface GitHubOptions {
  token?: string; // GitHub API token
  baseUrl?: string; // GitHub API base URL
  timeout?: number; // Request timeout
}

/**
 * Claude Code integration options
 */
export interface ClaudeOptions {
  sessionId?: string; // Claude session identifier
  model?: string; // Claude model to use
  timeout?: number; // Request timeout
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Operation result with success/error handling
 */
export interface OperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}

/**
 * File system operation types
 */
export interface FileInfo {
  path: string;
  exists: boolean;
  isDirectory: boolean;
  isFile: boolean;
  size?: number;
  modifiedAt?: Date;
}

/**
 * Process execution result
 */
export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  command: string;
  duration: number;
}
