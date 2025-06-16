/**
 * Review Agent Workflow - Orchestrates ephemeral review agents
 */

import { type ChildProcess, spawn } from "node:child_process";
import { ErrorFactory, WORKFLOW_ERROR_CODES, WorkflowError } from "../errors/workflow-errors.js";
import { type PromptData, buildReviewPrompt } from "../prompts/prompt-builder.js";
import type { ReviewAgentState } from "../types/agent-states.js";
import type { DatabaseInterface } from "../types/dependencies.js";
import {
  createPullRequest,
  createTmuxSession,
  createWorktree,
  killSession,
  launchClaudeSession,
  removeWorktree,
  sendKeys,
  terminateClaudeSession,
} from "../types/dependencies.js";
import type { PullRequestConfig, ReviewAgentConfig } from "../types/workflow-config.js";
import type { WorkflowExecution } from "../types/workflow-execution.js";
import type { BaseWorkflow } from "./base-workflow.js";

export class ReviewAgentWorkflow implements BaseWorkflow<ReviewAgentConfig, ReviewAgentState> {
  readonly type = "review" as const;
  private mcpProcesses = new Map<string, ChildProcess>();

  constructor(
    private database: DatabaseInterface,
    private createWorktreeFunc = createWorktree,
    private removeWorktreeFunc = removeWorktree,
    private createTmuxFunc = createTmuxSession,
    private killSessionFunc = killSession,
    private launchClaudeFunc = launchClaudeSession,
    private terminateClaudeFunc = terminateClaudeSession,
    private createPullRequestFunc = createPullRequest,
    private sendKeysFunc = sendKeys
  ) {}

  async execute(config: ReviewAgentConfig): Promise<WorkflowExecution<ReviewAgentState>> {
    // 1. Validate parent instance
    const parentInstance = await this.database.getInstance(config.parentInstanceId);
    if (!parentInstance) {
      throw ErrorFactory.workflow(
        WORKFLOW_ERROR_CODES.WORKFLOW_PARENT_NOT_FOUND,
        `Parent instance ${config.parentInstanceId} not found`
      );
    }

    if (parentInstance.status !== "waiting_review") {
      // Use core's status
      throw ErrorFactory.workflow(
        WORKFLOW_ERROR_CODES.WORKFLOW_PARENT_INVALID_STATE,
        `Parent instance ${config.parentInstanceId} is not in waiting_review state`
      );
    }

    const reviewInstanceId = this.generateInstanceId(config);

    try {
      // 2. Create database record
      await this.database.createInstance({
        id: reviewInstanceId,
        type: "review",
        status: "started",
        worktree_path: "", // Will be updated after worktree creation
        branch_name: config.reviewBranch || `review/${reviewInstanceId}`,
        tmux_session: reviewInstanceId,
        base_branch: parentInstance.branch_name,
        parent_instance_id: config.parentInstanceId,
        agent_number: 1,
      });

      // 3. Create forked worktree from parent
      const reviewWorktree = await this.createWorktreeFunc({
        name: reviewInstanceId,
        branch: config.reviewBranch || `review/${reviewInstanceId}`,
        baseBranch: parentInstance.branch_name,
      });

      // 4. Create tmux session for review
      const tmuxSession = await this.createTmuxFunc({
        name: reviewInstanceId,
        workingDirectory: reviewWorktree.path,
      });

      // 5. Launch MCP server for review agent
      const mcpProcess = await this.launchMCPServer({
        agentId: reviewInstanceId,
        workspace: reviewWorktree.path,
        parentInstanceId: config.parentInstanceId,
        parentTmuxSession: config.parentTmuxSession,
        issue: config.issueNumber?.toString(),
        branch: reviewWorktree.branch,
        session: tmuxSession.name,
      });

      // 6. Get original prompt context from parent instance (already retrieved above)

      const originalPromptData = (parentInstance as any).prompt_context
        ? (JSON.parse((parentInstance as any).prompt_context) as PromptData)
        : { baseInstructions: "No original task context available", customInstructions: "" };

      // 7. Build review prompt with original context
      const reviewPrompt = buildReviewPrompt({
        baseInstructions: this.getDefaultReviewPrompt(),
        originalTask: originalPromptData,
        reviewCriteria: config.reviewPrompt,
      });

      // 8. Launch review-focused Claude session
      const claudeSession = await this.launchClaudeFunc({
        workspacePath: reviewWorktree.path,
        environmentVars: {
          INSTANCE_ID: reviewInstanceId,
          PARENT_INSTANCE_ID: config.parentInstanceId,
          MCP_SERVER_TYPE: "review",
          MCP_AGENT_ID: reviewInstanceId,
          // Only technical config in env vars, no prompt data
        },
      });

      // 9. Inject review prompt via TMUX
      await this.sendKeysFunc(tmuxSession.name, reviewPrompt);

      // 10. Update database with resources and prompt data
      await this.database.updateInstance(reviewInstanceId, {
        status: "started", // Use core's status - agent is started and working
        worktree_path: reviewWorktree.path,
        tmux_session: tmuxSession.name,
        branch_name: reviewWorktree.branch,
        claude_pid: claudeSession.session.pid, // Use core's claude_pid field
        last_activity: new Date(),
        // Type assertion needed until schema types are regenerated
        ...({
          prompt_used: reviewPrompt,
          prompt_context: JSON.stringify({
            originalTask: originalPromptData,
            reviewCriteria: config.reviewPrompt,
          }),
        } as any),
      });

      // 11. Create relationship tracking
      await this.database.createRelationship({
        parent_instance: config.parentInstanceId,
        child_instance: reviewInstanceId,
        relationship_type: "spawned_review",
        review_iteration: 1,
        metadata: null,
      });

      // 12. Create initial state
      const initialState: ReviewAgentState = {
        phase: "working",
        parentInstanceId: config.parentInstanceId,
        feedbackDelivered: false,
      };

      return {
        id: reviewInstanceId,
        type: "review",
        status: "started", // Use core's status
        currentState: initialState,
        resources: {
          worktreePath: reviewWorktree.path,
          sessionName: tmuxSession.name,
          branch: reviewWorktree.branch,
          claudeSessionId: claudeSession.session.id,
        },
        config,
        startedAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      await this.handleWorkflowError(reviewInstanceId, error as Error);
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
        `Failed to terminate review workflow ${instanceId}: ${errorMessage}`,
        { instanceId, reason, error }
      );
    }
  }

  async getState(instanceId: string): Promise<ReviewAgentState | null> {
    const instance = await this.database.getInstance(instanceId);
    if (!instance) return null;

    const relationships = await this.database.getRelationships(instanceId);
    const parentRelation = relationships.find((r) => r.child_instance === instanceId);

    return {
      phase: this.mapStatusToPhase(instance.status),
      parentInstanceId: parentRelation?.parent_instance || "",
      feedbackDelivered: false, // TODO: Track this properly
    };
  }

  async saveReview(
    instanceId: string,
    review: string,
    decision: "request_changes" | "approve"
  ): Promise<void> {
    const instance = await this.database.getInstance(instanceId);
    if (!instance) {
      throw ErrorFactory.workflow(
        WORKFLOW_ERROR_CODES.WORKFLOW_INSTANCE_NOT_FOUND,
        `Review instance ${instanceId} not found`
      );
    }

    const relationships = await this.database.getRelationships(instanceId);
    const parentRelation = relationships.find((r) => r.child_instance === instanceId);

    if (!parentRelation) {
      throw ErrorFactory.workflow(
        WORKFLOW_ERROR_CODES.WORKFLOW_PARENT_NOT_FOUND,
        `Parent relationship not found for review instance ${instanceId}`
      );
    }

    try {
      // 1. Save review to database
      await this.database.updateInstance(instanceId, {
        status: "terminated",
        last_activity: new Date(),
        terminated_at: new Date(),
      });

      // Update relationship with review data
      await this.database.updateRelationship(parentRelation.id, {
        metadata: JSON.stringify({
          review,
          decision,
          completedAt: new Date().toISOString(),
        }),
      });

      // 2. Inject review into parent's TMUX session
      const parentInstance = await this.database.getInstance(parentRelation.parent_instance);
      if (parentInstance?.tmux_session) {
        await this.injectReviewIntoTmux(parentInstance.tmux_session, review, decision);
      }

      // 3. Update parent instance
      await this.database.updateInstance(parentRelation.parent_instance, {
        status: "started", // Parent resumes working with feedback
        last_activity: new Date(),
      });

      // 4. Self cleanup
      await this.terminate(instanceId, `Review completed: ${decision}`);
    } catch (error) {
      throw ErrorFactory.workflow(
        WORKFLOW_ERROR_CODES.WORKFLOW_PARENT_UPDATE_FAILED,
        `Failed to save review ${instanceId}: ${(error as Error).message}`,
        { instanceId, review, decision, error }
      );
    }
  }

  async pushToGithub(instanceId: string, prConfig: PullRequestConfig): Promise<string> {
    const instance = await this.database.getInstance(instanceId);
    if (!instance) {
      throw ErrorFactory.workflow(
        WORKFLOW_ERROR_CODES.WORKFLOW_INSTANCE_NOT_FOUND,
        `Review instance ${instanceId} not found`
      );
    }

    const relationships = await this.database.getRelationships(instanceId);
    const parentRelation = relationships.find((r) => r.child_instance === instanceId);

    if (!parentRelation) {
      throw ErrorFactory.workflow(
        WORKFLOW_ERROR_CODES.WORKFLOW_PARENT_NOT_FOUND,
        `Parent relationship not found for review instance ${instanceId}`
      );
    }

    try {
      // 1. Update review agent status
      await this.database.updateInstance(instanceId, {
        status: "terminated", // Use core's status - push_to_github is an internal operation
        last_activity: new Date(),
        // TODO: Add internal status tracking if needed
      });

      // 2. Create pull request
      const prResult = await this.createPullRequestFunc("repository", prConfig);
      const prUrl = prResult.pullRequest.url;

      // 3. Update parent instance
      await this.database.updateInstance(parentRelation.parent_instance, {
        status: "pr_created",
        last_activity: new Date(),
      });

      // 4. Self cleanup
      await this.terminate(instanceId, "Created PR and cleaned up");

      return prUrl;
    } catch (error) {
      throw ErrorFactory.workflow(
        WORKFLOW_ERROR_CODES.WORKFLOW_PR_CREATION_FAILED,
        `Failed to create PR for review ${instanceId}: ${(error as Error).message}`,
        { instanceId, prConfig, error }
      );
    }
  }

  private generateInstanceId(config: ReviewAgentConfig): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `review-${config.parentInstanceId}-${timestamp}-${random}`;
  }

  private mapStatusToPhase(status: string): ReviewAgentState["phase"] {
    switch (status) {
      case "started":
        return "working"; // Core's "started" means agent is working
      case "merge_back":
        return "request_review"; // Map to valid phase
      case "push_to_github":
        return "pull_request"; // Map to valid phase
      case "terminated":
        return "cleanup";
      default:
        return "working";
    }
  }

  private getDefaultReviewPrompt(): string {
    return `You are a code review agent. Your task is to review the code changes and provide feedback.
    
After your review, you must choose one of the following actions:
1. Merge back to the parent agent with feedback for improvements
2. Create a pull request if the code is ready for production

Use the appropriate MCP tools to implement your decision.`;
  }

  private async cleanupResources(instanceId: string): Promise<void> {
    try {
      const instance = await this.database.getInstance(instanceId);
      if (!instance) return;

      // Cleanup in reverse order of creation

      // Terminate MCP process first
      const mcpProcess = this.mcpProcesses.get(instanceId);
      if (mcpProcess) {
        mcpProcess.kill();
        this.mcpProcesses.delete(instanceId);
      }

      if (instance.claude_pid) {
        // Note: core uses claude_pid, not claude_session_id
        await this.terminateClaudeFunc(instance.claude_pid.toString());
      }

      if (instance.tmux_session) {
        await this.killSessionFunc(instance.tmux_session);
      }

      if (instance.worktree_path) {
        await this.removeWorktreeFunc(instance.worktree_path);
      }
    } catch (cleanupError) {
      console.error(`Cleanup failed for review ${instanceId}:`, cleanupError);
      throw ErrorFactory.workflow(
        WORKFLOW_ERROR_CODES.WORKFLOW_CLEANUP_FAILED,
        `Failed to cleanup resources for review ${instanceId}`,
        { cleanupError }
      );
    }
  }

  private async handleWorkflowError(instanceId: string, error: Error): Promise<void> {
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
      console.error(`Cleanup failed for review ${instanceId}:`, cleanupError);
    }
  }

  private async launchMCPServer(config: {
    agentId: string;
    workspace: string;
    parentInstanceId: string;
    parentTmuxSession: string;
    issue?: string;
    branch: string;
    session: string;
  }): Promise<ChildProcess> {
    const args = [
      "packages/mcp-review/dist/server.js",
      "--agent-id",
      config.agentId,
      "--workspace",
      config.workspace,
      "--parent-instance-id",
      config.parentInstanceId,
      "--parent-tmux-session",
      config.parentTmuxSession,
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

    // Handle process events
    mcpProcess.on("error", (error) => {
      console.error(`MCP Review server error for ${config.agentId}:`, error);
    });

    mcpProcess.on("exit", (code) => {
      console.log(`MCP Review server exited for ${config.agentId} with code ${code}`);
      this.mcpProcesses.delete(config.agentId);
    });

    // Store process reference
    this.mcpProcesses.set(config.agentId, mcpProcess);

    console.log(`MCP Review server launched for agent ${config.agentId} (PID: ${mcpProcess.pid})`);
    return mcpProcess;
  }

  private async injectReviewIntoTmux(
    sessionName: string,
    review: string,
    decision: "request_changes" | "approve"
  ): Promise<void> {
    try {
      const reviewMessage = `
## 🔍 Code Review Complete

**Decision:** ${decision === "approve" ? "✅ APPROVED" : "❌ CHANGES REQUESTED"}

**Review:**
${review}

---
The review agent has completed its analysis. ${decision === "approve" ? "You may now create a pull request." : "Please address the feedback above and re-request review when ready."}
`;

      // Inject the review message into the TMUX session
      await this.sendKeysFunc(sessionName, reviewMessage);
    } catch (error) {
      console.error(`Failed to inject review into TMUX session ${sessionName}:`, error);
      // Don't throw - this is a best-effort operation
    }
  }
}
