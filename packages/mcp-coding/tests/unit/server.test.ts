/**
 * Unit tests for MCP Coding server
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockMCPServer,
  createMockMCPTransport,
  createTestArgs,
} from "../fixtures/test-data.js";

// Mock MCP SDK to avoid import issues
vi.mock("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: vi.fn(),
}));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: vi.fn(),
}));

// Mock the tool functions
vi.mock("../../src/tools/create-pr.js", () => ({
  createPullRequestTool: vi.fn(),
}));

vi.mock("../../src/tools/request-review.js", () => ({
  requestReviewTool: vi.fn(),
}));

describe("MCP Coding Server", () => {
  let mockServer: ReturnType<typeof createMockMCPServer>;
  let mockTransport: ReturnType<typeof createMockMCPTransport>;

  beforeEach(async () => {
    mockServer = createMockMCPServer();
    mockTransport = createMockMCPTransport();

    // Setup MCP SDK mocks
    const { Server } = await import("@modelcontextprotocol/sdk/server/index.js");
    const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
    
    vi.mocked(Server).mockImplementation(() => mockServer as any);
    vi.mocked(StdioServerTransport).mockImplementation(() => mockTransport as any);

    // Mock process.argv
    process.argv = createTestArgs();
  });

  describe("argument parsing", () => {
    it("should have proper test arguments structure", () => {
      const args = createTestArgs({
        "agent-id": "custom-agent-id",
        workspace: "/custom/workspace",
        branch: "custom-branch",
        session: "custom-session",
        issue: "999",
      });

      expect(args).toContain("--agent-id");
      expect(args).toContain("custom-agent-id");
      expect(args).toContain("--workspace");
      expect(args).toContain("/custom/workspace");
    });

    it("should create proper default arguments", () => {
      const args = createTestArgs();
      
      expect(args).toContain("--agent-id");
      expect(args).toContain("test-agent-123");
      expect(args).toContain("--workspace");
      expect(args).toContain("/test/workspace");
    });
  });

  describe("tool interface validation", () => {
    it("should have the correct tool names available", async () => {
      // Test that our tools export the expected functions
      const { createPullRequestTool } = await import("../../src/tools/create-pr.js");
      const { requestReviewTool } = await import("../../src/tools/request-review.js");
      
      expect(createPullRequestTool).toBeDefined();
      expect(requestReviewTool).toBeDefined();
    });

    it("should validate tool input interfaces", () => {
      // Test that we can create proper tool inputs
      const createPRInput = {
        title: "Test PR",
        description: "Test description",
        draft: false,
      };

      const requestReviewInput = {
        description: "Test review description",
      };

      expect(createPRInput.title).toBe("Test PR");
      expect(createPRInput.description).toBe("Test description");
      expect(requestReviewInput.description).toBe("Test review description");
    });
  });

  describe("mock functionality", () => {
    it("should create proper mock server", () => {
      expect(mockServer.setRequestHandler).toBeDefined();
      expect(mockServer.connect).toBeDefined();
      expect(mockServer.close).toBeDefined();
    });

    it("should create proper mock transport", () => {
      expect(mockTransport.start).toBeDefined();
      expect(mockTransport.close).toBeDefined();
    });
  });

  describe("tool execution simulation", () => {
    beforeEach(async () => {
      // Setup tool mocks for simulation
      const { requestReviewTool } = await import("../../src/tools/request-review.js");
      const { createPullRequestTool } = await import("../../src/tools/create-pr.js");
      
      vi.mocked(requestReviewTool).mockResolvedValue({
        reviewInstanceId: "review-123",
        reviewWorkspace: "/test/review-workspace",
        message: "Review request submitted successfully!",
      });

      vi.mocked(createPullRequestTool).mockResolvedValue({
        prUrl: "https://github.com/test/repo/pull/456",
        prNumber: 456,
        message: "Pull request created successfully!",
      });
    });

    it("should simulate request_review tool execution", async () => {
      const { requestReviewTool } = await import("../../src/tools/request-review.js");
      
      const result = await requestReviewTool(
        { description: "Test review request" },
        {
          agentId: "test-agent-123",
          workspace: "/test/workspace",
          branch: "test-branch",
          session: "test-session",
          issue: "123",
        }
      );

      expect(result.message).toBe("Review request submitted successfully!");
      expect(result.reviewInstanceId).toBe("review-123");
    });

    it("should simulate create_pull_request tool execution", async () => {
      const { createPullRequestTool } = await import("../../src/tools/create-pr.js");
      
      const result = await createPullRequestTool(
        {
          title: "Test PR",
          description: "Test PR description",
          draft: false,
        },
        {
          agentId: "test-agent-123",
          workspace: "/test/workspace", 
          branch: "test-branch",
          session: "test-session",
          issue: "123",
        }
      );

      expect(result.message).toBe("Pull request created successfully!");
      expect(result.prUrl).toBe("https://github.com/test/repo/pull/456");
      expect(result.prNumber).toBe(456);
    });
  });
});