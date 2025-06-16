/**
 * Coding Agent Workflow - Orchestrates coding agents working on GitHub issues
 */

import { type ChildProcess, spawn } from "node:child_process";
import { ErrorFactory, WORKFLOW_ERROR_CODES } from "../errors/workflow-errors.js";
import { buildCodingPrompt, createPromptDataFromConfig } from "../prompts/prompt-builder.js";
import type { CodingAgentState } from "../types/agent-states.js";
import type { DatabaseInterface } from "../types/dependencies.js";
import {
  createTmuxSession,
  createWorktree,
  killSession,
  launchClaudeSession,
  removeWorktree,
  sendKeys,
  terminateClaudeSession,
} from "../types/dependencies.js";
import type { CodingAgentConfig } from "../types/workflow-config.js";
import type { WorkflowExecution } from "../types/workflow-execution.js";
import type { BaseWorkflow } from "./base-workflow.js";

export class CodingAgentWorkflow implements BaseWorkflow<CodingAgentConfig, CodingAgentState> {
  readonly type = "coding" as const;
  private mcpProcesses = new Map<string, ChildProcess>();

  constructor(
    private database: DatabaseInterface,
    private createWorktreeFunc = createWorktree,
    private removeWorktreeFunc = removeWorktree,
    private createTmuxFunc = createTmuxSession,
    private killSessionFunc = killSession,
    private launchClaudeFunc = launchClaudeSession,
    private terminateClaudeFunc = terminateClaudeSession,
    private sendKeysFunc = sendKeys
  ) {}

  async execute(config: CodingAgentConfig): Promise<WorkflowExecution<CodingAgentState>> {
    const instanceId = this.generateInstanceId(config);

    try {
      // 1. Create database record (will be updated with resource info after allocation)
      await this.database.createInstance({
        id: instanceId,
        type: "coding",
        status: "started", // Use core's status
        worktree_path: "", // Will be updated after worktree creation
        branch_name: config.targetBranch || `work/${instanceId}`,
        tmux_session: instanceId,
        issue_number: config.issue?.number,
        base_branch: config.baseBranch,
        agent_number: 1,
      });

      // 2. Allocate resources using core functions directly
      const worktree = await this.createWorktreeFunc({
        name: instanceId,
        branch: config.targetBranch || `work/${instanceId}`,
        baseBranch: config.baseBranch,
        ...config.worktreeOptions,
      });

      const tmuxSession = await this.createTmuxFunc({
        name: instanceId,
        workingDirectory: worktree.path,
        ...config.tmuxOptions,
      });

      // 3. Build prompt from configuration
      const promptData = createPromptDataFromConfig(config);
      const builtPrompt = buildCodingPrompt(promptData);

      // 4. Launch MCP server for this coding agent
      await this.launchMCPServer({
        agentId: instanceId,
        workspace: worktree.path,
        issue: config.issue?.number?.toString(),
        branch: worktree.branch,
        session: tmuxSession.name,
      });

      // 5. Launch Claude session (no prompt data in env vars)
      const claudeSession = await this.launchClaudeFunc({
        workspacePath: worktree.path,
        environmentVars: {
          INSTANCE_ID: instanceId,
          MCP_SERVER_TYPE: "coding",
          MCP_AGENT_ID: instanceId,
          // Merge in any additional env vars from config
          ...config.claudeOptions?.environmentVars,
        },
        // Spread other claudeOptions but not environmentVars
        ...(config.claudeOptions
          ? Object.fromEntries(
              Object.entries(config.claudeOptions).filter(([key]) => key !== "environmentVars")
            )
          : {}),
      });

      // 6. Inject prompt via TMUX
      await this.sendKeysFunc(tmuxSession.name, builtPrompt);

      // 7. Update database with resources and prompt data
      await this.database.updateInstance(instanceId, {
        status: "started", // Core status - agent is started and working
        worktree_path: worktree.path,
        tmux_session: tmuxSession.name,
        branch_name: worktree.branch,
        claude_pid: claudeSession.session.pid, // Use core's claude_pid field
        last_activity: new Date(),
        prompt_used: builtPrompt,
        prompt_context: JSON.stringify(promptData),
      });

      // 8. Create initial state
      const initialState: CodingAgentState = {
        phase: "working",
        reviewCount: 0,
        maxReviews: config.maxReviews,
        lastActivity: new Date(),
      };

      return {
        id: instanceId,
        type: "coding",
        status: "started", // Use core's status
        currentState: initialState,
        resources: {
          worktreePath: worktree.path,
          sessionName: tmuxSession.name,
          branch: worktree.branch,
          claudeSessionId: claudeSession.session.id,
        },
        config,
        startedAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      await this.handleWorkflowError(instanceId, error as Error);
      throw error;
    }
  }

  async terminate(instanceId: string, reason?: string): Promise<void> {
    try {
      // 1. Update database with termination
      await this.database.updateInstance(instanceId, {
        status: "terminated",
        last_activity: new Date(),
      });

      // 2. Cleanup resources
      await this.cleanupResources(instanceId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw ErrorFactory.workflow(
        WORKFLOW_ERROR_CODES.WORKFLOW_CLEANUP_FAILED,
        `Failed to terminate workflow ${instanceId}: ${errorMessage}`,
        { instanceId, reason, error }
      );
    }
  }

  async getState(instanceId: string): Promise<CodingAgentState | null> {
    const instance = await this.database.getInstance(instanceId);
    if (!instance) return null;

    const relationships = await this.database.getRelationships(instanceId);
    const reviewCount = relationships.filter(
      (r) => r.relationship_type === "spawned_review"
    ).length;
    const activeReview = relationships.find(
      (r) => r.relationship_type === "spawned_review" && r.parent_instance === instanceId
    );

    return {
      phase: this.mapStatusToPhase(instance.status),
      reviewCount,
      maxReviews: 3, // TODO: Get from config
      currentReviewInstanceId: activeReview?.child_instance,
      lastActivity: instance.last_activity || new Date(),
    };
  }

  async requestReview(instanceId: string, maxReviews = 3): Promise<string> {
    const instance = await this.database.getInstance(instanceId);
    if (!instance) {
      throw ErrorFactory.workflow(
        WORKFLOW_ERROR_CODES.WORKFLOW_INSTANCE_NOT_FOUND,
        `Instance ${instanceId} not found`
      );
    }

    if (instance.status !== "started") {
      // Use core's status
      throw ErrorFactory.workflow(
        WORKFLOW_ERROR_CODES.WORKFLOW_INVALID_STATE,
        `Cannot request review for instance in ${instance.status} state`
      );
    }

    // Check review count limit
    const relationships = await this.database.getRelationships(instanceId);
    const reviewCount = relationships.filter(
      (r) => r.relationship_type === "spawned_review"
    ).length;
    // maxReviews is now passed as parameter

    if (reviewCount >= maxReviews) {
      throw ErrorFactory.workflow(
        WORKFLOW_ERROR_CODES.WORKFLOW_MAX_REVIEWS_EXCEEDED,
        `Maximum review cycles (${maxReviews}) exceeded for instance ${instanceId}`
      );
    }

    // Check for active review (review instance must still exist and be active)
    const reviewRelationships = relationships.filter(
      (r) => r.relationship_type === "spawned_review" && r.parent_instance === instanceId
    );

    for (const reviewRel of reviewRelationships) {
      const reviewInstance = await this.database.getInstance(reviewRel.child_instance);
      if (reviewInstance && reviewInstance.status !== "terminated") {
        throw ErrorFactory.workflow(
          WORKFLOW_ERROR_CODES.WORKFLOW_REVIEW_IN_PROGRESS,
          `Review already in progress for instance ${instanceId}`
        );
      }
    }

    // Update instance status to waiting_review (core's enum)
    await this.database.updateInstance(instanceId, {
      status: "waiting_review",
      last_activity: new Date(),
    });

    // Generate review instance ID
    const reviewInstanceId = `review-${instanceId}-${reviewCount + 1}`;
    return reviewInstanceId;
  }

  private generateInstanceId(config: CodingAgentConfig): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    const issueNumber = config.issue?.number || "custom";
    return `work-${issueNumber}-${timestamp}-${random}`;
  }

  private mapStatusToPhase(status: string): CodingAgentState["phase"] {
    switch (status) {
      case "started":
        return "working"; // Map core's "started" to workflow's "working"
      case "waiting_review":
        return "review_requested";
      case "pr_created":
        return "pr_created";
      case "terminated":
        return "terminated";
      default:
        return "working";
    }
  }

  private async cleanupResources(instanceId: string): Promise<void> {
    try {
      const instance = await this.database.getInstance(instanceId);
      if (!instance) return;

      // Cleanup in reverse order of creation
      if (instance.claude_pid) {
        // Note: core uses claude_pid, not claude_session_id
        await this.terminateClaudeFunc(instance.claude_pid.toString());
      }

      // Kill MCP server process
      const mcpProcess = this.mcpProcesses.get(instanceId);
      if (mcpProcess && !mcpProcess.killed) {
        mcpProcess.kill("SIGTERM");
        this.mcpProcesses.delete(instanceId);
      }

      if (instance.tmux_session) {
        await this.killSessionFunc(instance.tmux_session);
      }

      if (instance.worktree_path) {
        await this.removeWorktreeFunc(instance.worktree_path);
      }
    } catch (cleanupError) {
      console.error(`Cleanup failed for ${instanceId}:`, cleanupError);
      throw ErrorFactory.workflow(
        WORKFLOW_ERROR_CODES.WORKFLOW_CLEANUP_FAILED,
        `Failed to cleanup resources for ${instanceId}`,
        { cleanupError }
      );
    }
  }

  private async launchMCPServer(config: {
    agentId: string;
    workspace: string;
    issue?: string;
    branch: string;
    session: string;
  }): Promise<ChildProcess> {
    return new Promise((resolve, reject) => {
      const args = [
        "packages/mcp-coding/dist/server.js",
        "--agent-id",
        config.agentId,
        "--workspace",
        config.workspace,
        "--branch",
        config.branch,
        "--session",
        config.session,
      ];

      if (config.issue) {
        args.push("--issue", config.issue);
      }

      const mcpProcess = spawn("node", args, {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: process.cwd(),
      });

      // Store process for cleanup
      this.mcpProcesses.set(config.agentId, mcpProcess);

      mcpProcess.on("spawn", () => {
        resolve(mcpProcess);
      });

      mcpProcess.on("error", (error) => {
        this.mcpProcesses.delete(config.agentId);
        reject(new Error(`Failed to launch MCP server: ${error.message}`));
      });

      mcpProcess.on("exit", (code) => {
        this.mcpProcesses.delete(config.agentId);
        if (code !== 0) {
          console.error(`MCP server exited with code ${code}`);
        }
      });
    });
  }

  private async handleWorkflowError(instanceId: string, _error: Error): Promise<void> {
    // Update database with error state (use core's "terminated" since no "failed")
    await this.database.updateInstance(instanceId, {
      status: "terminated",
      last_activity: new Date(),
      terminated_at: new Date(),
    });

    // Attempt resource cleanup
    try {
      await this.cleanupResources(instanceId);
    } catch (cleanupError) {
      // Log cleanup failure but don't throw
      console.error(`Cleanup failed for ${instanceId}:`, cleanupError);
    }
  }
}
