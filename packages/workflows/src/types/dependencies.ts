/**
 * Core function imports for workflows - no custom interfaces needed
 */

// Import everything we need directly from core
import type {
  ClaudeSession,
  ClaudeSessionConfig,
  CreatePullRequestOptions,
  CreatePullRequestResult,
  CreateTmuxSessionOptions,
  CreateWorktreeOptions,
  DatabaseInterface,
  Instance,
  InstanceStatus,
  InstanceType,
  LaunchSessionResult,
  NewInstance,
  NewRelationship,
  Relationship,
  RemoveWorktreeOptions,
  TmuxSession,
  WorktreeResult,
} from "@claude-codex/core";

// Import core functions directly
import {
  createPullRequest,
  createTmuxSession,
  createWorktree,
  killSession,
  launchClaudeSession,
  removeWorktree,
  sendKeys,
  terminateClaudeSession,
} from "@claude-codex/core";

// Re-export core types for convenience
export type {
  DatabaseInterface,
  Instance,
  NewInstance,
  Relationship,
  NewRelationship,
  InstanceStatus,
  InstanceType,
  WorktreeResult,
  CreateWorktreeOptions,
  RemoveWorktreeOptions,
  ClaudeSession,
  ClaudeSessionConfig,
  LaunchSessionResult,
  TmuxSession,
  CreateTmuxSessionOptions,
  CreatePullRequestOptions,
  CreatePullRequestResult,
};

// Re-export core functions for convenience
export {
  createWorktree,
  removeWorktree,
  createTmuxSession,
  killSession,
  launchClaudeSession,
  terminateClaudeSession,
  createPullRequest,
  sendKeys,
};

// Simple workflow constructor dependencies - just pass the real functions
export interface WorkflowDependencies {
  database: DatabaseInterface;
  // Core functions with dependency injection for testing
  createWorktree?: typeof createWorktree;
  removeWorktree?: typeof removeWorktree;
  createTmuxSession?: typeof createTmuxSession;
  killSession?: typeof killSession;
  launchClaudeSession?: typeof launchClaudeSession;
  terminateClaudeSession?: typeof terminateClaudeSession;
  createPullRequest?: typeof createPullRequest;
}
