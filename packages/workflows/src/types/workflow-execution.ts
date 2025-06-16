/**
 * Workflow execution result types - using core's vocabulary
 */

import type { InstanceStatus, InstanceType } from "@claude-codex/core";

export type WorkflowType = InstanceType; // "coding" | "review" | "planning"
export type ExecutionStatus = InstanceStatus; // Use core's status enum directly

export interface WorkflowResources {
  worktreePath: string;
  sessionName: string;
  branch: string;
  claudeSessionId?: string;
}

export interface WorkflowExecution<TState = unknown> {
  id: string; // Instance ID (e.g., "work-123-a1")
  type: WorkflowType;
  status: ExecutionStatus;
  currentState: TState;

  // Resource information
  resources: WorkflowResources;

  // Metadata
  config: unknown; // Original configuration
  startedAt: Date;
  updatedAt: Date;
  terminatedAt?: Date;
}
