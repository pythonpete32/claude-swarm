/**
 * Workflow error system extending core error patterns
 */

// Import core error patterns from @claude-codex/core
import { ErrorFactory as CoreErrorFactory, SwarmError } from "@claude-codex/core";

// Re-export SwarmError for convenience
export { SwarmError };

/**
 * Workflow-specific error codes following MODULE_ERROR_TYPE pattern
 */
export const WORKFLOW_ERROR_CODES = {
  WORKFLOW_INVALID_CONFIGURATION: "WORKFLOW_INVALID_CONFIGURATION",
  WORKFLOW_RESOURCE_ALLOCATION_FAILED: "WORKFLOW_RESOURCE_ALLOCATION_FAILED",
  WORKFLOW_MAX_REVIEWS_EXCEEDED: "WORKFLOW_MAX_REVIEWS_EXCEEDED",
  WORKFLOW_EXECUTION_TIMEOUT: "WORKFLOW_EXECUTION_TIMEOUT",
  WORKFLOW_CLEANUP_FAILED: "WORKFLOW_CLEANUP_FAILED",
  WORKFLOW_INSTANCE_NOT_FOUND: "WORKFLOW_INSTANCE_NOT_FOUND",
  WORKFLOW_INVALID_STATE: "WORKFLOW_INVALID_STATE",
  WORKFLOW_REVIEW_IN_PROGRESS: "WORKFLOW_REVIEW_IN_PROGRESS",
  WORKFLOW_PARENT_NOT_FOUND: "WORKFLOW_PARENT_NOT_FOUND",
  WORKFLOW_PARENT_INVALID_STATE: "WORKFLOW_PARENT_INVALID_STATE",
  WORKFLOW_FORK_FAILED: "WORKFLOW_FORK_FAILED",
  WORKFLOW_REVIEW_TIMEOUT: "WORKFLOW_REVIEW_TIMEOUT",
  WORKFLOW_MERGE_CONFLICT: "WORKFLOW_MERGE_CONFLICT",
  WORKFLOW_PARENT_UPDATE_FAILED: "WORKFLOW_PARENT_UPDATE_FAILED",
  WORKFLOW_PR_CREATION_FAILED: "WORKFLOW_PR_CREATION_FAILED",
} as const;

/**
 * Workflow error class extending core SwarmError patterns
 */
export class WorkflowError extends SwarmError {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message, code, "workflow", details);
    this.name = "WorkflowError";
  }

  protected getSuggestion(): string | null {
    switch (this.code) {
      case WORKFLOW_ERROR_CODES.WORKFLOW_INVALID_CONFIGURATION:
        return "Check workflow configuration parameters and required fields";
      case WORKFLOW_ERROR_CODES.WORKFLOW_RESOURCE_ALLOCATION_FAILED:
        return "Ensure git repository exists and required tools are available";
      case WORKFLOW_ERROR_CODES.WORKFLOW_MAX_REVIEWS_EXCEEDED:
        return "Consider increasing maxReviews limit or create PR directly";
      case WORKFLOW_ERROR_CODES.WORKFLOW_EXECUTION_TIMEOUT:
        return "Increase execution timeout or optimize workflow steps";
      case WORKFLOW_ERROR_CODES.WORKFLOW_INSTANCE_NOT_FOUND:
        return "Verify the workflow instance ID exists and is not terminated";
      case WORKFLOW_ERROR_CODES.WORKFLOW_INVALID_STATE:
        return "Check current workflow state and ensure valid state transitions";
      case WORKFLOW_ERROR_CODES.WORKFLOW_REVIEW_IN_PROGRESS:
        return "Wait for current review to complete or terminate it first";
      case WORKFLOW_ERROR_CODES.WORKFLOW_PARENT_NOT_FOUND:
        return "Ensure parent coding agent instance exists and is active";
      case WORKFLOW_ERROR_CODES.WORKFLOW_PARENT_INVALID_STATE:
        return "Parent instance must be in 'working' state to request review";
      default:
        return null;
    }
  }
}

/**
 * Workflow error factory following core patterns
 */
export const ErrorFactory = {
  workflow: (code: string, message: string, details?: Record<string, unknown>): WorkflowError =>
    new WorkflowError(code, message, details),
};

// Alias for consistency with export
export const WorkflowErrorFactory = ErrorFactory;
