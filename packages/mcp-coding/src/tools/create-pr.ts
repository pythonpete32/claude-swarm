/**
 * Create Pull Request Tool - Creates GitHub PR from current branch
 */

import { createPullRequest } from "@claude-codex/core";
import { getDatabase } from "@claude-codex/core";
import type { CreatePRInput, CreatePROutput, MCPContext } from "../types.js";

export async function createPullRequestTool(
  args: CreatePRInput,
  context: MCPContext,
): Promise<CreatePROutput> {
  try {
    // Get database and coding agent instance info
    const database = await getDatabase();
    const codingInstance = await database.getInstance(context.agentId);

    if (!codingInstance) {
      throw new Error(`Coding agent instance ${context.agentId} not found`);
    }

    // Create the pull request using core GitHub functions
    const prResult = await createPullRequest("repository", {
      title: args.title,
      body: args.description,
      head: codingInstance.branch_name || context.branch,
      base: codingInstance.base_branch || "main",
      draft: args.draft || false,
    });

    // Update instance status to completed
    await database.updateInstance(context.agentId, {
      status: "pr_created",
      pr_url: prResult.pullRequest.url,
      pr_number: prResult.pullRequest.number,
      last_activity: new Date(),
    });

    return {
      prUrl: prResult.pullRequest.url,
      prNumber: prResult.pullRequest.number,
      message: `Pull request created successfully!

**PR Details:**
- Title: ${args.title}
- Number: #${prResult.pullRequest.number}
- URL: ${prResult.pullRequest.url}
- Status: ${args.draft ? "Draft" : "Ready for review"}

Work completed! 🎉`,
    };
  } catch (error) {
    // Update instance status to failed
    const database = await getDatabase();
    await database.updateInstance(context.agentId, {
      status: "terminated",
      last_activity: new Date(),
    });

    throw new Error(`Failed to create pull request: ${(error as Error).message}`);
  }
}
