/**
 * Unit tests for create-pr tool
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPullRequestTool } from "../../src/tools/create-pr.js";
import {
  createMockMCPContext,
  createMockDatabase,
  TEST_CREATE_PR_INPUT,
} from "../fixtures/test-data.js";

// Mock the core imports
vi.mock("@claude-codex/core", () => ({
  createPullRequest: vi.fn(),
  getDatabase: vi.fn(),
}));

describe("createPullRequestTool", () => {
  let mockDatabase: ReturnType<typeof createMockDatabase>;

  beforeEach(async () => {
    mockDatabase = createMockDatabase();

    // Setup mocks
    const { createPullRequest, getDatabase } = await import("@claude-codex/core");
    
    vi.mocked(getDatabase).mockResolvedValue(mockDatabase);
    vi.mocked(createPullRequest).mockResolvedValue({
      pullRequest: {
        url: "https://github.com/test/repo/pull/456",
        number: 456,
      },
    });
  });

  describe("successful PR creation", () => {
    it("should create pull request and update instance status", async () => {
      // Arrange
      const context = createMockMCPContext();
      const input = TEST_CREATE_PR_INPUT;
      
      const mockCodingInstance = {
        id: context.agentId,
        type: "coding" as const,
        status: "started" as const,
        branch_name: "feature/oauth2-auth",
        base_branch: "main",
        issue_number: 123,
      };
      
      mockDatabase.getInstance.mockResolvedValue(mockCodingInstance);

      // Act
      const result = await createPullRequestTool(input, context);

      // Assert
      expect(result).toEqual({
        prUrl: "https://github.com/test/repo/pull/456",
        prNumber: 456,
        message: expect.stringContaining("Pull request created successfully!"),
      });

      const { createPullRequest } = await import("@claude-codex/core");
      expect(createPullRequest).toHaveBeenCalledWith("repository", {
        title: input.title,
        body: input.body,
        head: mockCodingInstance.branch_name,
        base: mockCodingInstance.base_branch,
        draft: false,
      });

      expect(mockDatabase.updateInstance).toHaveBeenCalledWith(
        context.agentId,
        expect.objectContaining({
          status: "pr_created",
          pr_url: "https://github.com/test/repo/pull/456",
          pr_number: 456,
          last_activity: expect.any(Date),
        })
      );
    });

    it("should handle draft PR creation", async () => {
      // Arrange
      const context = createMockMCPContext();
      const input = { ...TEST_CREATE_PR_INPUT, draft: true };
      
      const mockCodingInstance = {
        id: context.agentId,
        type: "coding" as const,
        status: "started" as const,
        branch_name: "feature/draft-pr",
        base_branch: "develop",
      };
      
      mockDatabase.getInstance.mockResolvedValue(mockCodingInstance);

      // Act
      const result = await createPullRequestTool(input, context);

      // Assert
      expect(result.message).toContain("Status: Draft");

      const { createPullRequest } = await import("@claude-codex/core");
      expect(createPullRequest).toHaveBeenCalledWith("repository", 
        expect.objectContaining({
          draft: true,
        })
      );
    });

    it("should use context branch when instance branch not available", async () => {
      // Arrange
      const context = createMockMCPContext({ branch: "fallback-branch" });
      const input = TEST_CREATE_PR_INPUT;
      
      const mockCodingInstance = {
        id: context.agentId,
        type: "coding" as const,
        status: "started" as const,
        branch_name: null, // No branch name in instance
        base_branch: "main",
      };
      
      mockDatabase.getInstance.mockResolvedValue(mockCodingInstance);

      // Act
      await createPullRequestTool(input, context);

      // Assert
      const { createPullRequest } = await import("@claude-codex/core");
      expect(createPullRequest).toHaveBeenCalledWith("repository", 
        expect.objectContaining({
          head: "fallback-branch", // Should use context branch
        })
      );
    });

    it("should use default base branch when not specified in instance", async () => {
      // Arrange
      const context = createMockMCPContext();
      const input = TEST_CREATE_PR_INPUT;
      
      const mockCodingInstance = {
        id: context.agentId,
        type: "coding" as const,
        status: "started" as const,
        branch_name: "feature/test",
        base_branch: null, // No base branch in instance
      };
      
      mockDatabase.getInstance.mockResolvedValue(mockCodingInstance);

      // Act
      await createPullRequestTool(input, context);

      // Assert
      const { createPullRequest } = await import("@claude-codex/core");
      expect(createPullRequest).toHaveBeenCalledWith("repository", 
        expect.objectContaining({
          base: "main", // Should default to main
        })
      );
    });

    it("should include PR details in success message", async () => {
      // Arrange
      const context = createMockMCPContext();
      const input = {
        title: "Custom PR Title",
        body: "Custom PR body",
        draft: false,
      };
      
      mockDatabase.getInstance.mockResolvedValue({
        id: context.agentId,
        type: "coding" as const,
        status: "started" as const,
        branch_name: "feature/custom",
        base_branch: "main",
      });

      // Act
      const result = await createPullRequestTool(input, context);

      // Assert
      expect(result.message).toContain("Custom PR Title");
      expect(result.message).toContain("#456");
      expect(result.message).toContain("https://github.com/test/repo/pull/456");
      expect(result.message).toContain("Ready for review");
      expect(result.message).toContain("Work completed! 🎉");
    });
  });

  describe("error handling", () => {
    it("should throw error when coding instance not found", async () => {
      // Arrange
      const context = createMockMCPContext();
      const input = TEST_CREATE_PR_INPUT;
      
      mockDatabase.getInstance.mockResolvedValue(null);

      // Act & Assert
      await expect(createPullRequestTool(input, context)).rejects.toThrow(
        `Failed to create pull request: Coding agent instance ${context.agentId} not found`
      );
    });

    it("should handle database access failure", async () => {
      // Arrange
      const context = createMockMCPContext();
      const input = TEST_CREATE_PR_INPUT;
      
      const { getDatabase } = await import("@claude-codex/core");
      vi.mocked(getDatabase).mockRejectedValue(new Error("Database connection failed"));

      // Act & Assert
      await expect(createPullRequestTool(input, context)).rejects.toThrow(
        "Failed to create pull request: Database connection failed"
      );
    });

    it("should handle PR creation failure and update instance status", async () => {
      // Arrange
      const context = createMockMCPContext();
      const input = TEST_CREATE_PR_INPUT;
      
      mockDatabase.getInstance.mockResolvedValue({
        id: context.agentId,
        type: "coding" as const,
        status: "started" as const,
        branch_name: "feature/test",
        base_branch: "main",
      });

      const { createPullRequest } = await import("@claude-codex/core");
      vi.mocked(createPullRequest).mockRejectedValue(new Error("GitHub API rate limit exceeded"));

      // Act & Assert
      await expect(createPullRequestTool(input, context)).rejects.toThrow(
        "Failed to create pull request: GitHub API rate limit exceeded"
      );

      // Verify instance status updated to terminated on failure
      expect(mockDatabase.updateInstance).toHaveBeenCalledWith(
        context.agentId,
        expect.objectContaining({
          status: "terminated",
          last_activity: expect.any(Date),
        })
      );
    });

    it("should handle non-Error type exceptions", async () => {
      // Arrange
      const context = createMockMCPContext();
      const input = TEST_CREATE_PR_INPUT;
      
      mockDatabase.getInstance.mockResolvedValue({
        id: context.agentId,
        type: "coding" as const,
        status: "started" as const,
        branch_name: "feature/test",
        base_branch: "main",
      });

      const { createPullRequest } = await import("@claude-codex/core");
      vi.mocked(createPullRequest).mockRejectedValue("String error");

      // Act & Assert
      await expect(createPullRequestTool(input, context)).rejects.toThrow(
        "Failed to create pull request: String error"
      );
    });
  });

  describe("input validation", () => {
    it("should handle minimal required input", async () => {
      // Arrange
      const context = createMockMCPContext();
      const input = {
        title: "Minimal PR",
        body: "Minimal description",
      };
      
      mockDatabase.getInstance.mockResolvedValue({
        id: context.agentId,
        type: "coding" as const,
        status: "started" as const,
        branch_name: "feature/minimal",
        base_branch: "main",
      });

      // Act
      const result = await createPullRequestTool(input, context);

      // Assert
      expect(result).toBeDefined();
      expect(result.prUrl).toBe("https://github.com/test/repo/pull/456");
      
      const { createPullRequest } = await import("@claude-codex/core");
      expect(createPullRequest).toHaveBeenCalledWith("repository", 
        expect.objectContaining({
          title: "Minimal PR",
          body: "Minimal description",
          draft: false, // Should default to false
        })
      );
    });

    it("should handle empty strings gracefully", async () => {
      // Arrange
      const context = createMockMCPContext();
      const input = {
        title: "",
        body: "",
        draft: undefined,
      };
      
      mockDatabase.getInstance.mockResolvedValue({
        id: context.agentId,
        type: "coding" as const,
        status: "started" as const,
        branch_name: "feature/empty",
        base_branch: "main",
      });

      // Act
      const result = await createPullRequestTool(input, context);

      // Assert
      expect(result).toBeDefined();
      
      const { createPullRequest } = await import("@claude-codex/core");
      expect(createPullRequest).toHaveBeenCalledWith("repository", 
        expect.objectContaining({
          title: "",
          body: "",
          draft: false, // undefined should become false
        })
      );
    });
  });
});