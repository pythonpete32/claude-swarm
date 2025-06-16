/**
 * Prompt Building System for Claude Swarm Workflows
 */

import type { GitHubIssueInfo } from "@claude-codex/core";

export interface PromptData {
  baseInstructions: string;
  issue?: GitHubIssueInfo;
  customInstructions?: string;
}

export interface ReviewPromptData {
  baseInstructions: string;
  originalTask: PromptData;
  reviewCriteria?: string;
}

/**
 * Default base instructions for coding agents
 */
export const DEFAULT_CODING_BASE_INSTRUCTIONS = `You are a coding agent. Here's how you work:

1. Analyze the task and understand the requirements
2. Read existing code to understand patterns and architecture
3. Implement the solution following existing conventions  
4. Write tests if the project has a testing setup
5. Test your changes to ensure they work
6. When finished, request a review using your MCP review tool

Always follow existing code patterns and conventions in the codebase.
Read CLAUDE.md and any project documentation for specific guidelines.`;

/**
 * Default base instructions for review agents
 */
export const DEFAULT_REVIEW_BASE_INSTRUCTIONS = `You are a code review agent. Here's how you work:

1. Understand what the coding agent was asked to accomplish
2. Review all changes made to the codebase
3. Check for code quality, security, and adherence to requirements
4. Test the implementation if possible
5. Provide constructive feedback using your save_review MCP tool
6. If approved, you can create a pull request using your MCP tool

Focus on: correctness, security, maintainability, and requirement fulfillment.
Be constructive and specific in your feedback.`;

/**
 * Build a prompt for coding agents
 */
export function buildCodingPrompt(data: PromptData): string {
  let prompt = data.baseInstructions;

  if (data.issue) {
    prompt += `\n\n## Task: Issue #${data.issue.number}
**${data.issue.title}**

${data.issue.body}

Issue URL: ${data.issue.url}`;
  }

  if (data.customInstructions) {
    prompt += `\n\n## Additional Instructions
${data.customInstructions}`;
  }

  return prompt;
}

/**
 * Build a prompt for review agents
 */
export function buildReviewPrompt(data: ReviewPromptData): string {
  let prompt = data.baseInstructions;

  prompt += `\n\n## Original Task
The coding agent was working on the following:`;

  if (data.originalTask.issue) {
    prompt += `\n\n**Issue #${data.originalTask.issue.number}: ${data.originalTask.issue.title}**
${data.originalTask.issue.body}`;
  }

  if (data.originalTask.customInstructions) {
    prompt += `\n\n**Specific Instructions Given:**
${data.originalTask.customInstructions}`;
  }

  if (data.reviewCriteria) {
    prompt += `\n\n## Review Criteria
${data.reviewCriteria}`;
  }

  prompt += `\n\n## Your Task
Review the code changes made by the coding agent against the requirements above.
Use your save_review tool to provide feedback.`;

  return prompt;
}

/**
 * Create prompt data from workflow configuration
 */
export function createPromptDataFromConfig(config: {
  issue?: GitHubIssueInfo;
  systemPrompt?: string;
  customInstructions?: string;
}): PromptData {
  return {
    baseInstructions: config.systemPrompt || DEFAULT_CODING_BASE_INSTRUCTIONS,
    issue: config.issue,
    customInstructions: config.customInstructions,
  };
}
