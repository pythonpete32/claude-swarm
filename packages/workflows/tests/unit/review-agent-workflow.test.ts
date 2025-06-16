/**
 * Unit tests for ReviewAgentWorkflow
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { WORKFLOW_ERROR_CODES } from "../../src/errors/workflow-errors.js";
import { ReviewAgentWorkflow } from "../../src/workflows/review-agent-workflow.js";
import {
  TEST_INSTANCES,
  TEST_RELATIONSHIPS,
  TEST_REVIEW_CONFIG,
  createMockChildProcess,
  createMockCoreFunctions,
  createMockDatabase,
  createTestDatabase,
} from "../fixtures/test-data.js";

// child_process is mocked in setup.ts

describe("ReviewAgentWorkflow", () => {
  let workflow: ReviewAgentWorkflow;
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

    workflow = new ReviewAgentWorkflow(
      mockDatabase,
      mockCoreFunctions.createWorktree,
      mockCoreFunctions.removeWorktree,
      mockCoreFunctions.createTmuxSession,
      mockCoreFunctions.killSession,
      mockCoreFunctions.launchClaudeSession,
      mockCoreFunctions.terminateClaudeSession,
      mockCoreFunctions.createPullRequest,
      mockCoreFunctions.sendKeys
    );
  });

  describe("execute", () => {
    it("should successfully execute a review workflow", async () => {
      // Arrange
      const config = TEST_REVIEW_CONFIG;
      const parentInstance = { ...TEST_INSTANCES.coding, status: "waiting_review" as const };
      mockDatabase.getInstance.mockResolvedValue(parentInstance);

      // Act
      const result = await workflow.execute(config);

      // Assert
      expect(result).toMatchObject({
        type: "review",
        status: "started",
        currentState: {
          phase: "working",
          parentInstanceId: config.parentInstanceId,
          feedbackDelivered: false,
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
          type: "review",
          status: "started",
          base_branch: parentInstance.branch_name,
          parent_instance_id: config.parentInstanceId,
        })
      );

      expect(mockDatabase.createRelationship).toHaveBeenCalledWith(
        expect.objectContaining({
          parent_instance: config.parentInstanceId,
          relationship_type: "spawned_review",
          review_iteration: 1,
        })
      );

      // Verify core function calls
      expect(mockCoreFunctions.createWorktree).toHaveBeenCalledWith(
        expect.objectContaining({
          baseBranch: parentInstance.branch_name,
        })
      );

      expect(mockCoreFunctions.launchClaudeSession).toHaveBeenCalledWith(
        expect.objectContaining({
          environmentVars: expect.objectContaining({
            INSTANCE_ID: expect.any(String),
            PARENT_INSTANCE_ID: config.parentInstanceId,
            MCP_SERVER_TYPE: "review",
            MCP_AGENT_ID: expect.any(String),
          }),
        })
      );

      // Check that review prompt was injected via sendKeys
      expect(mockCoreFunctions.sendKeys).toHaveBeenCalledWith(
        expect.any(String), // tmux session name
        expect.stringContaining("code review agent") // prompt content
      );
    });

    it("should throw error when parent instance not found", async () => {
      // Arrange
      const config = TEST_REVIEW_CONFIG;
      mockDatabase.getInstance.mockResolvedValue(null);

      // Act & Assert
      await expect(workflow.execute(config)).rejects.toMatchObject({
        code: WORKFLOW_ERROR_CODES.WORKFLOW_PARENT_NOT_FOUND,
        message: expect.stringContaining(`Parent instance ${config.parentInstanceId} not found`),
      });
    });

    it("should throw error when parent not in waiting_review state", async () => {
      // Arrange
      const config = TEST_REVIEW_CONFIG;
      const parentInstance = { ...TEST_INSTANCES.coding, status: "started" as const };
      mockDatabase.getInstance.mockResolvedValue(parentInstance);

      // Act & Assert
      await expect(workflow.execute(config)).rejects.toMatchObject({
        code: WORKFLOW_ERROR_CODES.WORKFLOW_PARENT_INVALID_STATE,
        message: expect.stringContaining("is not in waiting_review state"),
      });
    });

    it("should handle workflow errors and cleanup resources", async () => {
      // Arrange
      const config = TEST_REVIEW_CONFIG;
      const parentInstance = { ...TEST_INSTANCES.coding, status: "waiting_review" as const };
      mockDatabase.getInstance.mockResolvedValue(parentInstance);
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
  });

  describe("saveReview", () => {
    it("should successfully save review with approval decision", async () => {
      // Arrange
      const instanceId = "review-instance-123";
      const review = "The code looks good. All tests pass.";
      const decision = "approve" as const;

      const reviewInstance = { ...TEST_INSTANCES.review, id: instanceId };
      const parentInstance = { ...TEST_INSTANCES.coding };
      const relationship = { ...TEST_RELATIONSHIPS[0], child_instance: instanceId };

      const mockDb = createTestDatabase([reviewInstance, parentInstance], [relationship]);
      workflow = new ReviewAgentWorkflow(mockDb, ...Object.values(mockCoreFunctions));

      // Act
      await workflow.saveReview(instanceId, review, decision);

      // Assert
      expect(mockDb.updateInstance).toHaveBeenCalledWith(
        instanceId,
        expect.objectContaining({
          status: "terminated",
          last_activity: expect.any(Date),
          terminated_at: expect.any(Date),
        })
      );

      expect(mockDb.updateRelationship).toHaveBeenCalledWith(
        relationship.id,
        expect.objectContaining({
          metadata: expect.stringContaining(review),
        })
      );

      expect(mockDb.updateInstance).toHaveBeenCalledWith(
        parentInstance.id,
        expect.objectContaining({
          status: "started", // Parent resumes working
          last_activity: expect.any(Date),
        })
      );

      expect(mockCoreFunctions.sendKeys).toHaveBeenCalledWith(
        parentInstance.tmux_session,
        expect.stringContaining("✅ APPROVED")
      );
    });

    it("should successfully save review with request_changes decision", async () => {
      // Arrange
      const instanceId = "review-instance-123";
      const review = "Please fix the error handling in line 42.";
      const decision = "request_changes" as const;

      const reviewInstance = { ...TEST_INSTANCES.review, id: instanceId };
      const parentInstance = { ...TEST_INSTANCES.coding };
      const relationship = { ...TEST_RELATIONSHIPS[0], child_instance: instanceId };

      const mockDb = createTestDatabase([reviewInstance, parentInstance], [relationship]);
      workflow = new ReviewAgentWorkflow(mockDb, ...Object.values(mockCoreFunctions));

      // Act
      await workflow.saveReview(instanceId, review, decision);

      // Assert
      expect(mockCoreFunctions.sendKeys).toHaveBeenCalledWith(
        parentInstance.tmux_session,
        expect.stringContaining("❌ CHANGES REQUESTED")
      );

      const updateRelationshipMock = mockDb.updateRelationship as unknown as {
        mock: { calls: [number, { metadata: string }][] };
      };
      const reviewMetadata = JSON.parse(updateRelationshipMock.mock.calls[0][1].metadata);
      expect(reviewMetadata).toEqual({
        review,
        decision,
        completedAt: expect.any(String),
      });
    });

    it("should throw error when review instance not found", async () => {
      // Arrange
      const instanceId = "non-existent-review";
      const review = "Test review";
      const decision = "approve" as const;

      // Act & Assert
      await expect(workflow.saveReview(instanceId, review, decision)).rejects.toMatchObject({
        code: WORKFLOW_ERROR_CODES.WORKFLOW_INSTANCE_NOT_FOUND,
        message: expect.stringContaining(`Review instance ${instanceId} not found`),
      });
    });

    it("should throw error when parent relationship not found", async () => {
      // Arrange
      const instanceId = "review-instance-123";
      const review = "Test review";
      const decision = "approve" as const;

      const reviewInstance = { ...TEST_INSTANCES.review, id: instanceId };
      const mockDb = createTestDatabase([reviewInstance], []); // No relationships
      workflow = new ReviewAgentWorkflow(mockDb, ...Object.values(mockCoreFunctions));

      // Act & Assert
      await expect(workflow.saveReview(instanceId, review, decision)).rejects.toMatchObject({
        code: WORKFLOW_ERROR_CODES.WORKFLOW_PARENT_NOT_FOUND,
        message: expect.stringContaining("Parent relationship not found"),
      });
    });

    it("should handle TMUX injection errors gracefully", async () => {
      // Arrange
      const instanceId = "review-instance-123";
      const review = "Test review";
      const decision = "approve" as const;

      const reviewInstance = { ...TEST_INSTANCES.review, id: instanceId };
      const parentInstance = { ...TEST_INSTANCES.coding };
      const relationship = { ...TEST_RELATIONSHIPS[0], child_instance: instanceId };

      const mockDb = createTestDatabase([reviewInstance, parentInstance], [relationship]);
      mockCoreFunctions.sendKeys.mockRejectedValue(new Error("TMUX session not found"));
      workflow = new ReviewAgentWorkflow(mockDb, ...Object.values(mockCoreFunctions));

      // Act - should not throw despite TMUX error
      await workflow.saveReview(instanceId, review, decision);

      // Assert - review should still be saved
      expect(mockDb.updateInstance).toHaveBeenCalledWith(
        instanceId,
        expect.objectContaining({ status: "terminated" })
      );
    });
  });

  describe("pushToGithub", () => {
    it("should successfully create pull request", async () => {
      // Arrange
      const instanceId = "review-instance-123";
      const prConfig = {
        title: "Test PR",
        body: "Test PR body",
        head: "test-branch",
        base: "main",
      };

      const reviewInstance = { ...TEST_INSTANCES.review, id: instanceId };
      const parentInstance = { ...TEST_INSTANCES.coding };
      const relationship = { ...TEST_RELATIONSHIPS[0], child_instance: instanceId };

      const mockDb = createTestDatabase([reviewInstance, parentInstance], [relationship]);
      workflow = new ReviewAgentWorkflow(mockDb, ...Object.values(mockCoreFunctions));

      // Act
      const prUrl = await workflow.pushToGithub(instanceId, prConfig);

      // Assert
      expect(prUrl).toBe("https://github.com/test/repo/pull/456");

      expect(mockCoreFunctions.createPullRequest).toHaveBeenCalledWith("repository", prConfig);

      expect(mockDb.updateInstance).toHaveBeenCalledWith(
        parentInstance.id,
        expect.objectContaining({
          status: "pr_created",
          last_activity: expect.any(Date),
        })
      );

      expect(mockDb.updateInstance).toHaveBeenCalledWith(
        instanceId,
        expect.objectContaining({
          status: "terminated",
          last_activity: expect.any(Date),
        })
      );
    });

    it("should throw error when review instance not found", async () => {
      // Arrange
      const instanceId = "non-existent-review";
      const prConfig = { title: "Test", body: "Test", head: "test", base: "main" };

      // Act & Assert
      await expect(workflow.pushToGithub(instanceId, prConfig)).rejects.toMatchObject({
        code: WORKFLOW_ERROR_CODES.WORKFLOW_INSTANCE_NOT_FOUND,
        message: expect.stringContaining(`Review instance ${instanceId} not found`),
      });
    });

    it("should handle PR creation failures", async () => {
      // Arrange
      const instanceId = "review-instance-123";
      const prConfig = { title: "Test", body: "Test", head: "test", base: "main" };

      const reviewInstance = { ...TEST_INSTANCES.review, id: instanceId };
      const parentInstance = { ...TEST_INSTANCES.coding };
      const relationship = { ...TEST_RELATIONSHIPS[0], child_instance: instanceId };

      const mockDb = createTestDatabase([reviewInstance, parentInstance], [relationship]);
      mockCoreFunctions.createPullRequest.mockRejectedValue(new Error("PR creation failed"));
      workflow = new ReviewAgentWorkflow(mockDb, ...Object.values(mockCoreFunctions));

      // Act & Assert
      await expect(workflow.pushToGithub(instanceId, prConfig)).rejects.toMatchObject({
        code: WORKFLOW_ERROR_CODES.WORKFLOW_PR_CREATION_FAILED,
        message: expect.stringContaining("Failed to create PR"),
      });
    });
  });

  describe("getState", () => {
    it("should return current state for existing review instance", async () => {
      // Arrange
      const instanceId = "review-instance-123";
      const reviewInstance = { ...TEST_INSTANCES.review, id: instanceId };
      const relationship = { ...TEST_RELATIONSHIPS[0], child_instance: instanceId };

      const mockDb = createTestDatabase([reviewInstance], [relationship]);
      workflow = new ReviewAgentWorkflow(mockDb, ...Object.values(mockCoreFunctions));

      // Act
      const state = await workflow.getState(instanceId);

      // Assert
      expect(state).toEqual({
        phase: "working",
        parentInstanceId: relationship.parent_instance,
        feedbackDelivered: false,
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

  describe("terminate", () => {
    it("should successfully terminate review workflow", async () => {
      // Arrange
      const instanceId = "review-instance-123";
      const reviewInstance = { ...TEST_INSTANCES.review, id: instanceId };
      mockDatabase.getInstance.mockResolvedValue(reviewInstance);

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

      expect(mockCoreFunctions.terminateClaudeSession).toHaveBeenCalledWith("54322");
      expect(mockCoreFunctions.killSession).toHaveBeenCalledWith(reviewInstance.tmux_session);
      expect(mockCoreFunctions.removeWorktree).toHaveBeenCalledWith(reviewInstance.worktree_path);
    });
  });

  describe("MCP server management", () => {
    it("should launch MCP Review server with correct arguments", async () => {
      // Arrange
      const config = TEST_REVIEW_CONFIG;
      const parentInstance = { ...TEST_INSTANCES.coding, status: "waiting_review" as const };
      mockDatabase.getInstance.mockResolvedValue(parentInstance);
      const { spawn } = await import("node:child_process");

      // Act
      await workflow.execute(config);

      // Assert
      expect(spawn).toHaveBeenCalledWith(
        "node",
        expect.arrayContaining([
          "packages/mcp-review/dist/server.js",
          "--agent-id",
          expect.any(String),
          "--workspace",
          "/test/workspace/test-worktree",
          "--parent-instance-id",
          config.parentInstanceId,
          "--parent-tmux-session",
          config.parentTmuxSession,
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

    it("should handle MCP server process lifecycle", async () => {
      // Arrange
      const config = TEST_REVIEW_CONFIG;
      const parentInstance = { ...TEST_INSTANCES.coding, status: "waiting_review" as const };
      mockDatabase.getInstance.mockResolvedValue(parentInstance);

      let errorCallback: (...args: unknown[]) => void;
      let exitCallback: (...args: unknown[]) => void;

      mockChildProcess.on = vi.fn().mockImplementation((event, callback) => {
        if (event === "error") errorCallback = callback;
        if (event === "exit") exitCallback = callback;
      });

      // Act
      const result = await workflow.execute(config);

      // Simulate process events
      errorCallback(new Error("MCP server error"));
      exitCallback(1);

      // Assert
      expect(result).toBeDefined();
      expect(mockChildProcess.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockChildProcess.on).toHaveBeenCalledWith("exit", expect.any(Function));
    });
  });
});
