/**
 * Types for MCP Review Server
 */

export interface MCPContext {
  agentId: string;
  agentType: "review";
  workspace: string;
  parentInstanceId: string;
  parentTmuxSession: string;
  issue?: string;
  branch: string;
  session: string;
}

export interface SaveReviewInput {
  review: string;
  decision: "request_changes" | "approve";
}

export interface SaveReviewOutput {
  message: string;
  decision: "request_changes" | "approve";
  parentInstanceId: string;
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
