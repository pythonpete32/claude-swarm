/**
 * Request Review Tool - Spawns a review agent to analyze coding agent's work
 */

import { getDatabase } from "@claude-codex/core";
import { ReviewAgentWorkflow } from "@claude-codex/workflows";
import type { MCPContext, RequestReviewInput, RequestReviewOutput } from "../types.js";

export async function requestReviewTool(
  args: RequestReviewInput,
  context: MCPContext,
): Promise<RequestReviewOutput> {
  try {
    // Get database and coding agent instance info
    const database = await getDatabase();
    const codingInstance = await database.getInstance(context.agentId);

    if (!codingInstance) {
      throw new Error(`Coding agent instance ${context.agentId} not found`);
    }

    // Create review workflow with minimal config
    const reviewWorkflow = new ReviewAgentWorkflow(database);

    const reviewExecution = await reviewWorkflow.execute({
      parentInstanceId: context.agentId,
      parentTmuxSession: context.session,
      issueNumber: codingInstance.issue_number || undefined,
      codingDescription: args.description,
      preserveChanges: false,
      timeoutMinutes: 30,
    });

    return {
      reviewInstanceId: reviewExecution.id,
      reviewWorkspace: reviewExecution.resources.worktreePath,
      message: `Review request submitted successfully!

**What was accomplished:**
${args.description}

**Review Agent Created:**
- Review Agent ID: ${reviewExecution.id}
- Review Workspace: ${reviewExecution.resources.worktreePath}
- Review Session: ${reviewExecution.resources.sessionName}

The review agent will analyze your changes and either:
1. Approve and create a PR
2. Request changes and provide feedback

You'll receive feedback directly in this session when the review is complete.`,
    };
  } catch (error) {
    throw new Error(
      `Failed to request review: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
