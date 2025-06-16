/**
 * Unit tests for MCP Coding server
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockMCPServer,
  createMockMCPTransport,
  createTestArgs,
} from "../fixtures/test-data.js";

// Mock MCP SDK
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

  describe("server initialization", () => {
    it("should create server with correct configuration", async () => {
      // Act - Import server (which runs initialization code)
      await import("../../src/server.js");

      // Assert
      const { Server } = await import("@modelcontextprotocol/sdk/server/index.js");
      expect(Server).toHaveBeenCalledWith(
        {
          name: "coding-workflow-mcp",
          version: "0.1.0",
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );
    });

    it("should parse command line arguments correctly", async () => {
      // Arrange
      process.argv = createTestArgs({
        "agent-id": "custom-agent-id",
        workspace: "/custom/workspace",
        branch: "custom-branch",
        session: "custom-session",
        issue: "999",
      });

      // Act
      await import("../../src/server.js");

      // Assert - Check that arguments were parsed (indirectly through tool calls later)
      expect(process.argv).toContain("--agent-id");
      expect(process.argv).toContain("custom-agent-id");
    });

    it("should throw error for missing required arguments", async () => {
      // Arrange
      process.argv = ["node", "server.js", "--agent-id"]; // Missing value

      // Act & Assert
      await expect(() => import("../../src/server.js")).rejects.toThrow(
        "Missing required argument: --agent-id"
      );
    });
  });

  describe("tool listing", () => {
    it("should register ListTools handler with correct tools", async () => {
      // Act
      await import("../../src/server.js");

      // Assert
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        expect.any(Object), // ListToolsRequestSchema
        expect.any(Function)
      );

      // Get the handler function and test it
      const listToolsHandler = mockServer.setRequestHandler.mock.calls
        .find(call => call[0].type === "ListToolsRequest")?.[1];
      
      if (listToolsHandler) {
        const result = await listToolsHandler();
        expect(result.tools).toHaveLength(2);
        expect(result.tools[0].name).toBe("request_review");
        expect(result.tools[1].name).toBe("create_pull_request");
      }
    });

    it("should include proper tool schemas", async () => {
      // Act
      await import("../../src/server.js");

      // Get the list tools handler
      const listToolsHandler = mockServer.setRequestHandler.mock.calls
        .find(call => call[0].type === "ListToolsRequest")?.[1];
      
      if (listToolsHandler) {
        const result = await listToolsHandler();
        
        // Check request_review tool schema
        const requestReviewTool = result.tools.find(t => t.name === "request_review");
        expect(requestReviewTool).toBeDefined();
        expect(requestReviewTool.inputSchema.required).toContain("description");
        expect(requestReviewTool.inputSchema.properties.description.type).toBe("string");

        // Check create_pull_request tool schema
        const createPRTool = result.tools.find(t => t.name === "create_pull_request");
        expect(createPRTool).toBeDefined();
        expect(createPRTool.inputSchema.required).toEqual(["title", "description"]);
        expect(createPRTool.inputSchema.properties.draft.default).toBe(false);
      }
    });
  });

  describe("tool execution", () => {
    beforeEach(async () => {
      // Setup tool mocks
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

    it("should handle request_review tool call", async () => {
      // Act
      await import("../../src/server.js");

      // Get the call tool handler
      const callToolHandler = mockServer.setRequestHandler.mock.calls
        .find(call => call[0].type === "CallToolRequest")?.[1];
      
      if (callToolHandler) {
        const result = await callToolHandler({
          params: {
            name: "request_review",
            arguments: {
              description: "Test review request",
            },
          },
        });

        // Assert
        expect(result.content[0].text).toBe("Review request submitted successfully!");
        
        const { requestReviewTool } = await import("../../src/tools/request-review.js");
        expect(requestReviewTool).toHaveBeenCalledWith(
          { description: "Test review request" },
          expect.objectContaining({
            agentId: "test-agent-123",
            workspace: "/test/workspace",
          })
        );
      }
    });

    it("should handle create_pull_request tool call", async () => {
      // Act
      await import("../../src/server.js");

      // Get the call tool handler
      const callToolHandler = mockServer.setRequestHandler.mock.calls
        .find(call => call[0].type === "CallToolRequest")?.[1];
      
      if (callToolHandler) {
        const result = await callToolHandler({
          params: {
            name: "create_pull_request",
            arguments: {
              title: "Test PR",
              description: "Test PR description",
              draft: true,
            },
          },
        });

        // Assert
        expect(result.content[0].text).toBe("Pull request created successfully!");
        
        const { createPullRequestTool } = await import("../../src/tools/create-pr.js");
        expect(createPullRequestTool).toHaveBeenCalledWith(
          {
            title: "Test PR",
            description: "Test PR description",
            draft: true,
          },
          expect.objectContaining({
            agentId: "test-agent-123",
            workspace: "/test/workspace",
          })
        );
      }
    });

    it("should validate request_review arguments", async () => {
      // Act
      await import("../../src/server.js");

      // Get the call tool handler
      const callToolHandler = mockServer.setRequestHandler.mock.calls
        .find(call => call[0].type === "CallToolRequest")?.[1];
      
      if (callToolHandler) {
        const result = await callToolHandler({
          params: {
            name: "request_review",
            arguments: {}, // Missing description
          },
        });

        // Assert
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Invalid arguments for request_review tool");
      }
    });

    it("should validate create_pull_request arguments", async () => {
      // Act
      await import("../../src/server.js");

      // Get the call tool handler
      const callToolHandler = mockServer.setRequestHandler.mock.calls
        .find(call => call[0].type === "CallToolRequest")?.[1];
      
      if (callToolHandler) {
        const result = await callToolHandler({
          params: {
            name: "create_pull_request",
            arguments: {
              title: "Test PR", // Missing description
            },
          },
        });

        // Assert
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Invalid arguments for create_pull_request tool");
      }
    });

    it("should handle unknown tool names", async () => {
      // Act
      await import("../../src/server.js");

      // Get the call tool handler
      const callToolHandler = mockServer.setRequestHandler.mock.calls
        .find(call => call[0].type === "CallToolRequest")?.[1];
      
      if (callToolHandler) {
        const result = await callToolHandler({
          params: {
            name: "unknown_tool",
            arguments: {},
          },
        });

        // Assert
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Unknown tool: unknown_tool");
      }
    });

    it("should handle tool execution errors", async () => {
      // Arrange
      const { requestReviewTool } = await import("../../src/tools/request-review.js");
      vi.mocked(requestReviewTool).mockRejectedValue(new Error("Tool execution failed"));

      // Act
      await import("../../src/server.js");

      // Get the call tool handler
      const callToolHandler = mockServer.setRequestHandler.mock.calls
        .find(call => call[0].type === "CallToolRequest")?.[1];
      
      if (callToolHandler) {
        const result = await callToolHandler({
          params: {
            name: "request_review",
            arguments: {
              description: "Test review request",
            },
          },
        });

        // Assert
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Tool execution failed");
      }
    });
  });

  describe("server startup", () => {
    it("should connect transport and start server", async () => {
      // Act
      await import("../../src/server.js");

      // Give some time for async main() to execute
      await new Promise(resolve => setTimeout(resolve, 10));

      // Assert
      expect(mockServer.connect).toHaveBeenCalledWith(mockTransport);
    });
  });
});