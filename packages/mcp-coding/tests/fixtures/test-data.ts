/**
 * Test fixtures and mock data for MCP-Coding package tests
 */

import { vi } from "vitest";
import type { MCPContext } from "../../../workflows/src/types/mcp-context.js";

// Mock MCP Context
export const createMockMCPContext = (overrides: Partial<MCPContext> = {}): MCPContext => ({
  agentId: "test-agent-123",
  workspace: "/test/workspace",
  branch: "test-branch",
  session: "test-session",
  issue: "123",
  ...overrides,
});

// Mock MCP Server
export const createMockMCPServer = () => ({
  setRequestHandler: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  onclose: vi.fn(),
  onerror: vi.fn(),
});

// Mock MCP Transport
export const createMockMCPTransport = () => ({
  start: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  onclose: vi.fn(),
  onerror: vi.fn(),
});

// Test Request Review Input
export const TEST_REQUEST_REVIEW_INPUT = {
  description: "Please review the authentication module implementation",
  context: "Added OAuth2 authentication with proper error handling",
  files: ["src/auth/oauth.ts", "src/auth/middleware.ts"],
};

// Test Create PR Input
export const TEST_CREATE_PR_INPUT = {
  title: "Add OAuth2 authentication module",
  body: "Implements OAuth2 authentication with proper error handling and session management",
  head: "feature/oauth2-auth",
  base: "main",
  draft: false,
};

// Mock Workflow Functions
export const createMockWorkflowFunctions = () => ({
  ReviewAgentWorkflow: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      id: "review-instance-123",
      type: "review",
      status: "started",
    }),
  })),
  createPullRequest: vi.fn().mockResolvedValue({
    pullRequest: {
      url: "https://github.com/test/repo/pull/456",
      number: 456,
    },
  }),
});

// Mock Database Functions
export const createMockDatabase = () => ({
  getInstance: vi.fn().mockResolvedValue({
    id: "test-agent-123",
    type: "coding",
    status: "started",
    issue_number: 123,
  }),
  updateInstance: vi.fn().mockResolvedValue(undefined),
});

// Helper to create command line arguments
export const createTestArgs = (overrides: Record<string, string> = {}) => {
  const defaultArgs = {
    "agent-id": "test-agent-123",
    workspace: "/test/workspace",
    branch: "test-branch", 
    session: "test-session",
    issue: "123",
  };
  
  const args = { ...defaultArgs, ...overrides };
  const argv: string[] = ["node", "server.js"];
  
  for (const [key, value] of Object.entries(args)) {
    argv.push(`--${key}`, value);
  }
  
  return argv;
};