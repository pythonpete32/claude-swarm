/**
 * Save Review Tool - Saves review to database and injects into coding agent
 */

import { ReviewAgentWorkflow } from "@claude-codex/workflows";
import { getDatabase } from "@claude-codex/core";
import type { MCPContext, SaveReviewInput, SaveReviewOutput } from "../types.js";

export async function saveReviewTool(
  args: SaveReviewInput,
  context: MCPContext,
): Promise<SaveReviewOutput> {
  try {
    // Get database and review workflow
    const database = await getDatabase();
    const reviewWorkflow = new ReviewAgentWorkflow(database);
    
    // Call the saveReview method which handles:
    // 1. Saving review to database
    // 2. Injecting review into parent's TMUX session
    // 3. Updating parent instance status
    // 4. Terminating review instance
    await reviewWorkflow.saveReview(context.agentId, args.review, args.decision);

    return {
      message: `Review saved successfully!

**Decision:** ${args.decision === "approve" ? "✅ APPROVED" : "❌ CHANGES REQUESTED"}

**Review Summary:**
${args.review.substring(0, 200)}${args.review.length > 200 ? "..." : ""}

The review has been:
- Saved to the database
- Injected into the coding agent's session
- Parent agent has been notified

${args.decision === "approve" 
  ? "The coding agent can now proceed to create a pull request." 
  : "The coding agent should address the feedback and can request another review when ready."
}`,
      decision: args.decision,
      parentInstanceId: context.parentInstanceId,
    };
  } catch (error) {
    throw new Error(`Failed to save review: ${(error as Error).message}`);
  }
}