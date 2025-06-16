/**
 * Unit tests for CodingAgentWorkflow
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { WORKFLOW_ERROR_CODES } from "../../src/errors/workflow-errors.js";
import { CodingAgentWorkflow } from "../../src/workflows/coding-agent-workflow.js";
import {
  TEST_CODING_CONFIG,
  TEST_INSTANCES,
  createMockChildProcess,
  createMockCoreFunctions,
  createMockDatabase,
  createTestDatabase,
} from "../fixtures/test-data.js";

// child_process is mocked in setup.ts

describe("CodingAgentWorkflow", () => {
  let workflow: CodingAgentWorkflow;
  let mockDatabase: ReturnType<typeof createMockDatabase>;
  let mockCoreFunctions: ReturnType<typeof createMockCoreFunctions>;
  let mockChildProcess: ReturnType<typeof createMockChildProcess>;

  beforeEach(async () => {
    mockDatabase = createMockDatabase();
    mockCoreFunctions = createMockCoreFunctions();
    mockChildProcess = createMockChildProcess();

    // Mock spawn to return our mock child process
    const { spawn } = await import("node:child_process");
    vi.mocked(spawn).mockReturnValue(mockChildProcess);

    workflow = new CodingAgentWorkflow(
      mockDatabase,
      mockCoreFunctions.createWorktree,
      mockCoreFunctions.removeWorktree,
      mockCoreFunctions.createTmuxSession,
      mockCoreFunctions.killSession,
      mockCoreFunctions.launchClaudeSession,
      mockCoreFunctions.terminateClaudeSession,
      mockCoreFunctions.sendKeys
    );
  });

  describe("execute", () => {
    it("should successfully execute a coding workflow", async () => {
      // Arrange
      const config = TEST_CODING_CONFIG;

      // Act
      const result = await workflow.execute(config);

      // Assert
      expect(result).toMatchObject({
        type: "coding",
        status: "started",
        currentState: {
          phase: "working",
          reviewCount: 0,
          maxReviews: 3,
        },
        resources: {
          worktreePath: "/test/workspace/test-worktree",
          sessionName: "test-session",
          branch: "test-branch",
          claudeSessionId: "claude-session-123",
        },
        config,
      });

      // Verify database operations
      expect(mockDatabase.createInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "coding",
          status: "started",
          issue_number: 123,
          base_branch: "main",
        })
      );

      expect(mockDatabase.updateInstance).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: "started",
          worktree_path: "/test/workspace/test-worktree",
          tmux_session: "test-session",
          branch_name: "test-branch",
          claude_pid: 54321,
        })
      );

      // Verify core function calls
      expect(mockCoreFunctions.createWorktree).toHaveBeenCalledWith(
        expect.objectContaining({
          branch: "work/test-feature",
          baseBranch: "main",
        })
      );

      expect(mockCoreFunctions.createTmuxSession).toHaveBeenCalledWith(
        expect.objectContaining({
          workingDirectory: "/test/workspace/test-worktree",
        })
      );

      expect(mockCoreFunctions.launchClaudeSession).toHaveBeenCalledWith(
        expect.objectContaining({
          workspacePath: "/test/workspace/test-worktree",
          environmentVars: expect.objectContaining({
            INSTANCE_ID: expect.any(String),
            MCP_SERVER_TYPE: "coding",
            MCP_AGENT_ID: expect.any(String),
            // Config-specific environment variables are also spread in
            ISSUE_NUMBER: "123",
          }),
        })
      );

      // Check that prompt was injected via sendKeys
      expect(mockCoreFunctions.sendKeys).toHaveBeenCalledWith(
        expect.any(String), // tmux session name
        expect.stringContaining("You are a coding assistant") // prompt content
      );
    });

    it("should handle workflow errors and cleanup resources", async () => {
      // Arrange
      const config = TEST_CODING_CONFIG;
      mockCoreFunctions.createWorktree.mockRejectedValue(new Error("Worktree creation failed"));

      // Act & Assert
      await expect(workflow.execute(config)).rejects.toThrow("Worktree creation failed");

      // Verify error handling
      expect(mockDatabase.updateInstance).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: "terminated",
          terminated_at: expect.any(Date),
        })
      );
    });

    it("should generate unique instance IDs", async () => {
      // Arrange
      const config1 = { ...TEST_CODING_CONFIG };
      const config2 = {
        ...TEST_CODING_CONFIG,
        issue: { ...TEST_CODING_CONFIG.issue, number: 456 },
      };

      // Act
      const result1 = await workflow.execute(config1);
      const result2 = await workflow.execute(config2);

      // Assert
      expect(result1.id).not.toEqual(result2.id);
      expect(result1.id).toMatch(/^work-123-\d+-[a-z0-9]+$/);
      expect(result2.id).toMatch(/^work-456-\d+-[a-z0-9]+$/);
    });
  });

  describe("terminate", () => {
    it("should successfully terminate a coding workflow", async () => {
      // Arrange
      const instanceId = "test-instance-123";
      const mockInstance = { ...TEST_INSTANCES.coding, id: instanceId };
      mockDatabase.getInstance.mockResolvedValue(mockInstance);

      // Act
      await workflow.terminate(instanceId, "Test termination");

      // Assert
      expect(mockDatabase.updateInstance).toHaveBeenCalledWith(
        instanceId,
        expect.objectContaining({
          status: "terminated",
          last_activity: expect.any(Date),
        })
      );

      expect(mockCoreFunctions.terminateClaudeSession).toHaveBeenCalledWith("54321");
      expect(mockCoreFunctions.killSession).toHaveBeenCalledWith(mockInstance.tmux_session);
      expect(mockCoreFunctions.removeWorktree).toHaveBeenCalledWith(mockInstance.worktree_path);
    });

    it("should handle cleanup errors gracefully", async () => {
      // Arrange
      const instanceId = "test-instance-123";
      mockDatabase.getInstance.mockResolvedValue(TEST_INSTANCES.coding);
      mockCoreFunctions.terminateClaudeSession.mockRejectedValue(
        new Error("Claude termination failed")
      );

      // Act & Assert
      await expect(workflow.terminate(instanceId)).rejects.toThrow(/Failed to terminate workflow/);
      expect(mockDatabase.updateInstance).toHaveBeenCalledWith(
        instanceId,
        expect.objectContaining({ status: "terminated" })
      );
    });
  });

  describe("getState", () => {
    it("should return current state for existing instance", async () => {
      // Arrange
      const instanceId = TEST_INSTANCES.coding.id;
      const mockDb = createTestDatabase([TEST_INSTANCES.coding]);
      workflow = new CodingAgentWorkflow(mockDb, ...Object.values(mockCoreFunctions));

      // Act
      const state = await workflow.getState(instanceId);

      // Assert
      expect(state).toEqual({
        phase: "working",
        reviewCount: 1, // One relationship in test data
        maxReviews: 3,
        currentReviewInstanceId: "review-work-123-1234567890-abcdef123-1",
        lastActivity: TEST_INSTANCES.coding.last_activity,
      });
    });

    it("should return null for non-existent instance", async () => {
      // Arrange
      const instanceId = "non-existent-123";

      // Act
      const state = await workflow.getState(instanceId);

      // Assert
      expect(state).toBeNull();
    });
  });

  describe("requestReview", () => {
    it("should successfully request review for working instance", async () => {
      // Arrange
      const instanceId = TEST_INSTANCES.coding.id;
      const mockInstance = { ...TEST_INSTANCES.coding, status: "started" as const };
      const mockDb = createTestDatabase([mockInstance], []); // No existing reviews
      workflow = new CodingAgentWorkflow(mockDb, ...Object.values(mockCoreFunctions));

      // Act
      const reviewInstanceId = await workflow.requestReview(instanceId, 3);

      // Assert
      expect(reviewInstanceId).toMatch(new RegExp(`^review-${instanceId}-1$`));
      expect(mockDb.updateInstance).toHaveBeenCalledWith(
        instanceId,
        expect.objectContaining({
          status: "waiting_review",
          last_activity: expect.any(Date),
        })
      );
    });

    it("should throw error when instance not found", async () => {
      // Arrange
      const instanceId = "non-existent-123";

      // Act & Assert
      await expect(workflow.requestReview(instanceId)).rejects.toMatchObject({
        code: WORKFLOW_ERROR_CODES.WORKFLOW_INSTANCE_NOT_FOUND,
        message: expect.stringContaining("Instance non-existent-123 not found"),
      });
    });

    it("should throw error when instance not in working state", async () => {
      // Arrange
      const instanceId = "test-instance-123";
      const mockInstance = { ...TEST_INSTANCES.coding, status: "terminated" as const };
      mockDatabase.getInstance.mockResolvedValue(mockInstance);

      // Act & Assert
      await expect(workflow.requestReview(instanceId)).rejects.toMatchObject({
        code: WORKFLOW_ERROR_CODES.WORKFLOW_INVALID_STATE,
        message: expect.stringContaining("Cannot request review for instance in terminated state"),
      });
    });

    it("should throw error when max reviews exceeded", async () => {
      // Arrange
      const instanceId = TEST_INSTANCES.coding.id;
      const mockInstance = { ...TEST_INSTANCES.coding, id: instanceId, status: "started" as const };

      // Create mock relationships for 3 reviews (max is 3)
      const relationships = [
        {
          parent_instance: instanceId,
          child_instance: "review-1",
          relationship_type: "spawned_review" as const,
        },
        {
          parent_instance: instanceId,
          child_instance: "review-2",
          relationship_type: "spawned_review" as const,
        },
        {
          parent_instance: instanceId,
          child_instance: "review-3",
          relationship_type: "spawned_review" as const,
        },
      ];

      const mockDb = createTestDatabase([mockInstance], relationships);
      workflow = new CodingAgentWorkflow(mockDb, ...Object.values(mockCoreFunctions));

      // Act & Assert
      await expect(workflow.requestReview(instanceId, 3)).rejects.toMatchObject({
        code: WORKFLOW_ERROR_CODES.WORKFLOW_MAX_REVIEWS_EXCEEDED,
        message: expect.stringContaining("Maximum review cycles (3) exceeded"),
      });
    });

    it("should throw error when review already in progress", async () => {
      // Arrange
      const instanceId = TEST_INSTANCES.coding.id;
      const reviewInstanceId = "review-instance-456";
      const mockInstance = { ...TEST_INSTANCES.coding, id: instanceId, status: "started" as const };
      const mockReviewInstance = {
        ...TEST_INSTANCES.review,
        id: reviewInstanceId,
        status: "started" as const,
      };

      const relationships = [
        {
          parent_instance: instanceId,
          child_instance: reviewInstanceId,
          relationship_type: "spawned_review" as const,
        },
      ];

      const mockDb = createTestDatabase([mockInstance, mockReviewInstance], relationships);
      workflow = new CodingAgentWorkflow(mockDb, ...Object.values(mockCoreFunctions));

      // Act & Assert
      await expect(workflow.requestReview(instanceId)).rejects.toMatchObject({
        code: WORKFLOW_ERROR_CODES.WORKFLOW_REVIEW_IN_PROGRESS,
        message: expect.stringContaining("Review already in progress"),
      });
    });
  });

  describe("MCP server management", () => {
    it("should launch MCP server with correct arguments", async () => {
      // Arrange
      const config = TEST_CODING_CONFIG;
      const { spawn } = await import("node:child_process");

      // Act
      await workflow.execute(config);

      // Assert
      expect(spawn).toHaveBeenCalledWith(
        "node",
        expect.arrayContaining([
          "packages/mcp-coding/dist/server.js",
          "--agent-id",
          expect.any(String),
          "--workspace",
          "/test/workspace/test-worktree",
          "--branch",
          "test-branch",
          "--session",
          "test-session",
          "--issue",
          "123",
        ]),
        expect.objectContaining({
          stdio: ["pipe", "pipe", "pipe"],
          cwd: process.cwd(),
        })
      );
    });

    it("should handle MCP server spawn errors", async () => {
      // Arrange
      const config = TEST_CODING_CONFIG;
      mockChildProcess.on = vi.fn().mockImplementation((event, callback) => {
        if (event === "error") {
          // Simulate error during spawn
          setTimeout(() => callback(new Error("MCP server spawn failed")), 0);
        }
      });

      // Act & Assert
      await expect(workflow.execute(config)).rejects.toThrow("Failed to launch MCP server");
    });
  });
});
