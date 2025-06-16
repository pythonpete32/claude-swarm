/**
 * Types for MCP Coding Server
 */

export interface MCPContext {
  agentId: string;
  agentType?: "coding";
  workspace: string;
  branch: string;
  session: string;
  issue?: string;
}

export interface RequestReviewInput {
  description: string;
}

export interface RequestReviewOutput {
  reviewInstanceId: string;
  reviewWorkspace: string;
  message: string;
}

export interface CreatePRInput {
  title: string;
  description: string;
  draft?: boolean;
}

export interface CreatePROutput {
  prUrl: string;
  prNumber: number;
  message: string;
}

// Alias for consistency
export type CreatePullRequestInput = CreatePRInput;
export type CreatePullRequestOutput = CreatePROutput;
