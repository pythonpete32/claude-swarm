/**
 * Workflows Package - Agent Lifecycle Orchestration
 *
 * Main exports for the workflows package
 */

// Main workflow classes
export { CodingAgentWorkflow } from "./workflows/coding-agent-workflow.js";
export { ReviewAgentWorkflow } from "./workflows/review-agent-workflow.js";

// Core imports - use core's database and functions directly
export type {
  DatabaseInterface,
  Instance as WorkflowInstance,
  NewInstance as NewWorkflowInstance,
} from "./types/dependencies.js";

// Type exports
export type {
  BaseWorkflow,
  WorkflowType,
  ExecutionStatus,
  WorkflowResources,
  WorkflowExecution,
  CodingAgentState,
  ReviewAgentState,
  CodingAgentConfig,
  ReviewAgentConfig,
  RepositoryInfo,
  GitHubIssueInfo,
  PullRequestConfig,
} from "./types/index.js";

export type { WorkflowDependencies } from "./types/dependencies.js";

// Error handling
export {
  WorkflowError,
  WORKFLOW_ERROR_CODES,
  WorkflowErrorFactory,
} from "./errors/index.js";
