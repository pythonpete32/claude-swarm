/**
 * Create PR Tool - Creates GitHub pull request for review agent
 */

import { ReviewAgentWorkflow } from "@claude-codex/workflows";
import { getDatabase } from "@claude-codex/core";
import type { MCPContext, CreatePRInput, CreatePROutput } from "../types.js";

export async function createPullRequestTool(
  args: CreatePRInput,
  context: MCPContext,
): Promise<CreatePROutput> {
  try {
    // Get database and review workflow
    const database = await getDatabase();
    const reviewWorkflow = new ReviewAgentWorkflow(database);
    
    // Get review instance to get branch information
    const reviewInstance = await database.getInstance(context.agentId);
    if (!reviewInstance) {
      throw new Error(`Review instance ${context.agentId} not found`);
    }
    
    // Create pull request configuration with proper head/base
    const prConfig = {
      title: args.title,
      body: args.description,
      head: reviewInstance.branch_name, // The review branch
      base: reviewInstance.base_branch || "main", // The target branch
      draft: args.draft || false,
    };
    
    // Use the existing pushToGithub method
    const prUrl = await reviewWorkflow.pushToGithub(context.agentId, prConfig);
    
    // Extract PR number from URL (assuming GitHub URL format)
    const prNumber = extractPRNumber(prUrl);

    return {
      prUrl,
      prNumber,
      message: `Pull request created successfully!

**PR Details:**
- Title: ${args.title}
- URL: ${prUrl}
- Number: #${prNumber}
- Draft: ${args.draft ? "Yes" : "No"}

The pull request has been created and the review process is complete. The coding agent's work has been successfully promoted to a GitHub PR for team review.`,
    };
  } catch (error) {
    throw new Error(`Failed to create pull request: ${(error as Error).message}`);
  }
}

function extractPRNumber(prUrl: string): number {
  // Extract PR number from GitHub URL like https://github.com/owner/repo/pull/123
  const match = prUrl.match(/\/pull\/(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : 0;
}