/**
 * Unit tests for request-review tool
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { requestReviewTool } from "../../src/tools/request-review.js";
import {
  createMockMCPContext,
  createMockDatabase,
  createMockWorkflowFunctions,
  TEST_REQUEST_REVIEW_INPUT,
} from "../fixtures/test-data.js";

// Mock the database import
vi.mock("@claude-codex/core", () => ({
  getDatabase: vi.fn(),
}));

// Mock the workflow import
vi.mock("@claude-codex/workflows", () => ({
  ReviewAgentWorkflow: vi.fn(),
}));

describe("requestReviewTool", () => {
  let mockDatabase: ReturnType<typeof createMockDatabase>;
  let mockWorkflowInstance: {
    execute: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockDatabase = createMockDatabase();
    
    // Create a consistent mock workflow instance
    mockWorkflowInstance = {
      execute: vi.fn().mockResolvedValue({
        id: "review-instance-123",
        type: "review",
        status: "started",
        resources: {
          worktreePath: "/test/review-workspace",
          sessionName: "review-session-123",
        },
      }),
    };

    // Setup mocks
    const { getDatabase } = await import("@claude-codex/core");
    const { ReviewAgentWorkflow } = await import("@claude-codex/workflows");

    vi.mocked(getDatabase).mockResolvedValue(mockDatabase);
    vi.mocked(ReviewAgentWorkflow).mockImplementation(() => mockWorkflowInstance);
  });

  describe("successful review request", () => {
    it("should create review workflow and return success message", async () => {
      // Arrange
      const context = createMockMCPContext();
      const input = TEST_REQUEST_REVIEW_INPUT;
      
      const mockCodingInstance = {
        id: context.agentId,
        type: "coding" as const,
        status: "started" as const,
        issue_number: 123,
      };
      
      mockDatabase.getInstance.mockResolvedValue(mockCodingInstance);

      // Act
      const result = await requestReviewTool(input, context);

      // Assert
      expect(result).toEqual({
        reviewInstanceId: "review-instance-123",
        reviewWorkspace: expect.any(String),
        message: expect.stringContaining("Review request submitted successfully!"),
      });

      expect(mockDatabase.getInstance).toHaveBeenCalledWith(context.agentId);

      expect(mockWorkflowInstance.execute).toHaveBeenCalledWith({
        parentInstanceId: context.agentId,
        parentTmuxSession: context.session,
        issueNumber: 123,
        codingDescription: input.description,
        preserveChanges: false,
        timeoutMinutes: 30,
      });
    });

    it("should handle coding instance without issue number", async () => {
      // Arrange
      const context = createMockMCPContext();
      const input = TEST_REQUEST_REVIEW_INPUT;
      
      const mockCodingInstance = {
        id: context.agentId,
        type: "coding" as const,
        status: "started" as const,
        issue_number: null, // No issue number
      };
      
      mockDatabase.getInstance.mockResolvedValue(mockCodingInstance);

      // Act
      const result = await requestReviewTool(input, context);

      // Assert
      expect(result).toBeDefined();
      
      expect(mockWorkflowInstance.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          issueNumber: undefined, // Should be undefined when no issue number
        })
      );
    });

    it("should include description and context in success message", async () => {
      // Arrange
      const context = createMockMCPContext();
      const input = {
        description: "Test review description",
        context: "Test context details",
      };
      
      mockDatabase.getInstance.mockResolvedValue({
        id: context.agentId,
        type: "coding" as const,
        status: "started" as const,
        issue_number: 123,
      });

      // Act
      const result = await requestReviewTool(input, context);

      // Assert
      expect(result.message).toContain("Test review description");
      expect(result.message).toContain("review-instance-123");
      expect(result.message).toContain("Review Agent Created:");
    });
  });

  describe("error handling", () => {
    it("should throw error when coding instance not found", async () => {
      // Arrange
      const context = createMockMCPContext();
      const input = TEST_REQUEST_REVIEW_INPUT;
      
      mockDatabase.getInstance.mockResolvedValue(null);

      // Act & Assert
      await expect(requestReviewTool(input, context)).rejects.toThrow(
        `Failed to request review: Coding agent instance ${context.agentId} not found`
      );
    });

    it("should throw error when database access fails", async () => {
      // Arrange
      const context = createMockMCPContext();
      const input = TEST_REQUEST_REVIEW_INPUT;
      
      const { getDatabase } = await import("@claude-codex/core");
      vi.mocked(getDatabase).mockRejectedValue(new Error("Database connection failed"));

      // Act & Assert
      await expect(requestReviewTool(input, context)).rejects.toThrow(
        "Failed to request review: Database connection failed"
      );
    });

    it("should throw error when workflow execution fails", async () => {
      // Arrange
      const context = createMockMCPContext();
      const input = TEST_REQUEST_REVIEW_INPUT;
      
      mockDatabase.getInstance.mockResolvedValue({
        id: context.agentId,
        type: "coding" as const,
        status: "started" as const,
        issue_number: 123,
      });

      mockWorkflowInstance.execute.mockRejectedValue(new Error("Workflow execution failed"));

      // Act & Assert
      await expect(requestReviewTool(input, context)).rejects.toThrow(
        "Failed to request review: Workflow execution failed"
      );
    });

    it("should handle unexpected error types", async () => {
      // Arrange
      const context = createMockMCPContext();
      const input = TEST_REQUEST_REVIEW_INPUT;
      
      mockDatabase.getInstance.mockResolvedValue({
        id: context.agentId,
        type: "coding" as const,
        status: "started" as const,
        issue_number: 123,
      });

      mockWorkflowInstance.execute.mockRejectedValue("String error");

      // Act & Assert
      await expect(requestReviewTool(input, context)).rejects.toThrow(
        "Failed to request review: String error"
      );
    });
  });

  describe("input validation", () => {
    it("should handle empty description", async () => {
      // Arrange
      const context = createMockMCPContext();
      const input = { description: "", context: "test" };
      
      mockDatabase.getInstance.mockResolvedValue({
        id: context.agentId,
        type: "coding" as const,
        status: "started" as const,
        issue_number: 123,
      });

      // Act
      const result = await requestReviewTool(input, context);

      // Assert
      expect(result).toBeDefined();
      
      expect(mockWorkflowInstance.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          codingDescription: "", // Empty description should be passed through
        })
      );
    });

    it("should handle missing optional fields", async () => {
      // Arrange
      const context = createMockMCPContext();
      const input = { description: "Basic description" }; // Only required field
      
      mockDatabase.getInstance.mockResolvedValue({
        id: context.agentId,
        type: "coding" as const,
        status: "started" as const,
        issue_number: 123,
      });

      // Act
      const result = await requestReviewTool(input, context);

      // Assert
      expect(result).toBeDefined();
      expect(result.message).toContain("Basic description");
    });
  });
});