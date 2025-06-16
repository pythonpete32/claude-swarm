import type { WorkflowExecution, WorkflowType } from "../types/workflow-execution.js";

/**
 * Base workflow interface for all agent lifecycle orchestration
 */
export interface BaseWorkflow<TConfig, TState> {
  readonly type: WorkflowType;

  // Lifecycle management
  execute(config: TConfig): Promise<WorkflowExecution<TState>>;
  terminate(instanceId: string, reason?: string): Promise<void>;

  // State management (read-only - updates via MCP/webhooks)
  getState(instanceId: string): Promise<TState | null>;
}
