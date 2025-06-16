/**
 * Workflow configuration interfaces
 */

// Import core types from @claude-codex/core
import type {
  ClaudeSessionConfig,
  CreatePullRequestOptions,
  CreateTmuxSessionOptions,
  CreateWorktreeOptions,
  GitHubIssueInfo,
  GitHubPullRequestInfo,
  RepositoryInfo,
} from "@claude-codex/core";

// Re-export core types for convenience
export type {
  RepositoryInfo,
  GitHubIssueInfo,
  GitHubPullRequestInfo,
  CreateWorktreeOptions,
  CreateTmuxSessionOptions,
  ClaudeSessionConfig,
  CreatePullRequestOptions,
};

// Workflow-specific configurations not in core

// Use core's CreatePullRequestOptions directly
export type PullRequestConfig = CreatePullRequestOptions;

export interface CodingAgentConfig {
  // Repository context
  repository: RepositoryInfo;
  baseBranch: string;
  targetBranch?: string; // Auto-generated if not provided

  // Task context
  issue?: GitHubIssueInfo;
  systemPrompt?: string;
  customInstructions?: string;

  // Review behavior
  requireReview: boolean; // Default: false
  maxReviews: number; // Default: 3

  // Resource configuration
  worktreeOptions?: Partial<CreateWorktreeOptions>;
  tmuxOptions?: Partial<CreateTmuxSessionOptions>;
  claudeOptions?: Partial<ClaudeSessionConfig>;

  // Execution settings
  executionTimeout?: number; // Default: 24 hours (ms)
}

export interface ReviewAgentConfig {
  parentInstanceId: string; // Coding agent being reviewed
  parentTmuxSession: string; // Parent's tmux session for feedback injection
  issueNumber?: number; // Optional GitHub issue number
  codingDescription: string; // What the coding agent accomplished
  reviewPrompt?: string; // Custom review criteria

  // Fork configuration
  reviewBranch?: string; // Auto-generated if not provided
  preserveChanges: boolean; // Default: false (ephemeral)

  // Execution settings
  timeoutMinutes: number; // Default: 30 minutes
}
