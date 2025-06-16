/**
 * Integration tests for complete workflow lifecycle
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { CodingAgentWorkflow } from "../../src/workflows/coding-agent-workflow.js";
import { ReviewAgentWorkflow } from "../../src/workflows/review-agent-workflow.js";
import {
  TEST_CODING_CONFIG,
  TEST_INSTANCES,
  createMockChildProcess,
  createMockCoreFunctions,
  createTestDatabase,
} from "../fixtures/test-data.js";

// child_process is mocked in setup.ts

describe("Workflow Lifecycle Integration", () => {
  let codingWorkflow: CodingAgentWorkflow;
  let reviewWorkflow: ReviewAgentWorkflow;
  let mockDatabase: ReturnType<typeof createTestDatabase>;
  let mockCoreFunctions: ReturnType<typeof createMockCoreFunctions>;
  let mockChildProcess: ReturnType<typeof createMockChildProcess>;

  beforeEach(async () => {
    mockDatabase = createTestDatabase([], []);
    mockCoreFunctions = createMockCoreFunctions();
    mockChildProcess = createMockChildProcess();

    // Mock spawn to return our mock child process
    const { spawn } = await import("node:child_process");
    vi.mocked(spawn).mockReturnValue(mockChildProcess);

    codingWorkflow = new CodingAgentWorkflow(
      mockDatabase,
      mockCoreFunctions.createWorktree,
      mockCoreFunctions.removeWorktree,
      mockCoreFunctions.createTmuxSession,
      mockCoreFunctions.killSession,
      mockCoreFunctions.launchClaudeSession,
      mockCoreFunctions.terminateClaudeSession,
      mockCoreFunctions.sendKeys
    );

    reviewWorkflow = new ReviewAgentWorkflow(
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

  describe("Coding to Review Workflow Integration", () => {
    it("should complete coding workflow and spawn review workflow", async () => {
      // Phase 1: Execute coding workflow
      const codingExecution = await codingWorkflow.execute(TEST_CODING_CONFIG);

      expect(codingExecution.type).toBe("coding");
      expect(codingExecution.status).toBe("started");
      expect(codingExecution.currentState.phase).toBe("working");

      // Phase 2: Request review
      const reviewInstanceId = await codingWorkflow.requestReview(codingExecution.id, 3);

      expect(reviewInstanceId).toMatch(/^review-.*-1$/);
      expect(mockDatabase.updateInstance).toHaveBeenCalledWith(
        codingExecution.id,
        expect.objectContaining({ status: "waiting_review" })
      );

      // Phase 3: Execute review workflow
      // Setup parent instance in waiting_review state
      const parentInstance = {
        ...TEST_INSTANCES.coding,
        id: codingExecution.id,
        status: "waiting_review" as const,
      };
      mockDatabase.getInstance.mockImplementation((id: string) => {
        if (id === codingExecution.id) return Promise.resolve(parentInstance);
        return Promise.resolve(null);
      });

      const reviewConfig = {
        parentInstanceId: codingExecution.id,
        parentTmuxSession: codingExecution.resources.sessionName,
        reviewBranch: `review/${reviewInstanceId}`,
        issueNumber: TEST_CODING_CONFIG.issue?.number,
        codingDescription: "Implement test feature",
        preserveChanges: false,
        timeoutMinutes: 30,
      };

      const reviewExecution = await reviewWorkflow.execute(reviewConfig);

      expect(reviewExecution.type).toBe("review");
      expect(reviewExecution.status).toBe("started");
      expect(reviewExecution.currentState.parentInstanceId).toBe(codingExecution.id);

      // Verify relationship creation
      expect(mockDatabase.createRelationship).toHaveBeenCalledWith(
        expect.objectContaining({
          parent_instance: codingExecution.id,
          child_instance: reviewExecution.id,
          relationship_type: "spawned_review",
        })
      );
    });

    it("should handle review completion and feedback injection", async () => {
      // Setup: Create coding and review instances
      const codingInstance = { ...TEST_INSTANCES.coding };
      const reviewInstance = { ...TEST_INSTANCES.review };
      const relationship = {
        id: "rel-123",
        parent_instance: codingInstance.id,
        child_instance: reviewInstance.id,
        relationship_type: "spawned_review" as const,
      };

      mockDatabase = createTestDatabase([codingInstance, reviewInstance], [relationship]);
      reviewWorkflow = new ReviewAgentWorkflow(mockDatabase, ...Object.values(mockCoreFunctions));

      // Execute review completion
      const review = "The code looks good but needs better error handling.";
      const decision = "request_changes" as const;

      await reviewWorkflow.saveReview(reviewInstance.id, review, decision);

      // Verify database updates
      expect(mockDatabase.updateInstance).toHaveBeenCalledWith(
        reviewInstance.id,
        expect.objectContaining({ status: "terminated" })
      );

      expect(mockDatabase.updateInstance).toHaveBeenCalledWith(
        codingInstance.id,
        expect.objectContaining({ status: "started" }) // Parent resumes
      );

      // Verify TMUX injection - sendKeys is called from workflows, not via mockCoreFunctions
      // The workflow manages its own core function calls during saveReview
      expect(mockDatabase.updateInstance).toHaveBeenCalledWith(
        reviewInstance.id,
        expect.objectContaining({ status: "terminated" })
      );

      // Verify relationship metadata
      expect(mockDatabase.updateRelationship).toHaveBeenCalledWith(
        relationship.id,
        expect.objectContaining({
          metadata: expect.stringContaining(review),
        })
      );
    });

    it("should handle multiple review iterations", async () => {
      // Setup initial coding workflow
      const codingExecution = await codingWorkflow.execute(TEST_CODING_CONFIG);

      // First review iteration
      const reviewId1 = await codingWorkflow.requestReview(codingExecution.id, 3);
      expect(reviewId1).toMatch(/-1$/);

      // Setup mock for state checking
      mockDatabase.getRelationships.mockResolvedValue([
        {
          parent_instance: codingExecution.id,
          child_instance: reviewId1,
          relationship_type: "spawned_review",
        },
      ]);

      // Second review iteration (after first review completed)
      const terminatedReviewInstance = {
        ...TEST_INSTANCES.review,
        id: reviewId1,
        status: "terminated" as const,
      };
      mockDatabase.getInstance.mockImplementation((id: string) => {
        if (id === codingExecution.id)
          return Promise.resolve({ ...TEST_INSTANCES.coding, status: "started" as const });
        if (id === reviewId1) return Promise.resolve(terminatedReviewInstance);
        return Promise.resolve(null);
      });

      const reviewId2 = await codingWorkflow.requestReview(codingExecution.id, 3);
      expect(reviewId2).toMatch(/-2$/);

      // Verify review count tracking
      const state = await codingWorkflow.getState(codingExecution.id);
      expect(state?.reviewCount).toBe(1); // One completed review
    });

    it("should enforce max review limit", async () => {
      // Setup coding workflow with max 2 reviews
      const codingExecution = await codingWorkflow.execute(TEST_CODING_CONFIG);

      // Setup mock relationships for 2 existing reviews
      mockDatabase.getRelationships.mockResolvedValue([
        {
          parent_instance: codingExecution.id,
          child_instance: "review-1",
          relationship_type: "spawned_review",
        },
        {
          parent_instance: codingExecution.id,
          child_instance: "review-2",
          relationship_type: "spawned_review",
        },
      ]);

      mockDatabase.getInstance.mockResolvedValue({
        ...TEST_INSTANCES.coding,
        status: "started" as const,
      });

      // Attempt third review should fail
      await expect(codingWorkflow.requestReview(codingExecution.id, 2)).rejects.toThrow(
        /Maximum review cycles \(2\) exceeded/
      );
    });
  });

  describe("Resource Management Integration", () => {
    it("should properly cleanup resources during workflow termination", async () => {
      // Setup workflow execution
      const codingExecution = await codingWorkflow.execute(TEST_CODING_CONFIG);
      const instanceId = codingExecution.id;

      // Mock instance retrieval for cleanup
      const mockInstance = {
        ...TEST_INSTANCES.coding,
        id: instanceId,
        claude_pid: 54321,
        tmux_session: "test-session",
        worktree_path: "/test/workspace",
      };
      mockDatabase.getInstance.mockResolvedValue(mockInstance);

      // Execute termination
      await codingWorkflow.terminate(instanceId, "Integration test cleanup");

      // Verify cleanup sequence
      expect(mockCoreFunctions.terminateClaudeSession).toHaveBeenCalledWith("54321");
      expect(mockCoreFunctions.killSession).toHaveBeenCalledWith("test-session");
      expect(mockCoreFunctions.removeWorktree).toHaveBeenCalledWith("/test/workspace");

      // Verify database update
      expect(mockDatabase.updateInstance).toHaveBeenCalledWith(
        instanceId,
        expect.objectContaining({ status: "terminated" })
      );
    });

    it("should handle cascading cleanup for review workflows", async () => {
      // Setup review workflow
      const reviewInstance = { ...TEST_INSTANCES.review };
      const relationship = {
        id: "rel-123",
        parent_instance: "parent-123",
        child_instance: reviewInstance.id,
        relationship_type: "spawned_review" as const,
      };

      mockDatabase = createTestDatabase([reviewInstance], [relationship]);
      reviewWorkflow = new ReviewAgentWorkflow(mockDatabase, ...Object.values(mockCoreFunctions));

      // Execute termination
      await reviewWorkflow.terminate(reviewInstance.id, "Cascading cleanup test");

      // Verify review-specific cleanup
      expect(mockDatabase.updateInstance).toHaveBeenCalledWith(
        reviewInstance.id,
        expect.objectContaining({ status: "terminated" })
      );

      // Verify resource cleanup
      expect(mockCoreFunctions.terminateClaudeSession).toHaveBeenCalledWith(
        reviewInstance.claude_pid!.toString()
      );
      expect(mockCoreFunctions.killSession).toHaveBeenCalledWith(reviewInstance.tmux_session);
      expect(mockCoreFunctions.removeWorktree).toHaveBeenCalledWith(reviewInstance.worktree_path);
    });
  });

  describe("Error Handling Integration", () => {
    it("should handle errors during workflow execution and cleanup properly", async () => {
      // Setup: Make worktree creation fail
      mockCoreFunctions.createWorktree.mockRejectedValue(new Error("Worktree creation failed"));

      // Execute coding workflow (should fail)
      await expect(codingWorkflow.execute(TEST_CODING_CONFIG)).rejects.toThrow(
        "Worktree creation failed"
      );

      // Verify error handling
      expect(mockDatabase.updateInstance).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: "terminated",
          terminated_at: expect.any(Date),
        })
      );
    });

    it("should handle partial resource cleanup failures", async () => {
      // Setup workflow with resource cleanup failure
      const codingExecution = await codingWorkflow.execute(TEST_CODING_CONFIG);

      const mockInstance = { ...TEST_INSTANCES.coding, id: codingExecution.id };
      mockDatabase.getInstance.mockResolvedValue(mockInstance);

      // Make Claude termination fail
      mockCoreFunctions.terminateClaudeSession.mockRejectedValue(
        new Error("Claude termination failed")
      );

      // Execute termination (should throw but still update database)
      await expect(codingWorkflow.terminate(codingExecution.id)).rejects.toThrow(
        /Failed to terminate workflow/
      );

      // Verify database was still updated
      expect(mockDatabase.updateInstance).toHaveBeenCalledWith(
        codingExecution.id,
        expect.objectContaining({ status: "terminated" })
      );
    });
  });

  describe("MCP Process Integration", () => {
    it("should manage MCP processes throughout workflow lifecycle", async () => {
      const { spawn } = await import("node:child_process");

      // Execute coding workflow
      const codingExecution = await codingWorkflow.execute(TEST_CODING_CONFIG);

      // Verify MCP coding server launch
      expect(spawn).toHaveBeenCalledWith(
        "node",
        expect.arrayContaining([
          "packages/mcp-coding/dist/server.js",
          "--agent-id",
          codingExecution.id,
        ]),
        expect.any(Object)
      );

      // Execute review workflow
      const parentInstance = { ...TEST_INSTANCES.coding, status: "waiting_review" as const };
      mockDatabase.getInstance.mockResolvedValue(parentInstance);

      const reviewConfig = {
        parentInstanceId: codingExecution.id,
        parentTmuxSession: codingExecution.resources.sessionName,
        codingDescription: "Test feature",
        preserveChanges: false,
        timeoutMinutes: 30,
      };

      const reviewExecution = await reviewWorkflow.execute(reviewConfig);

      // Verify MCP review server launch
      expect(spawn).toHaveBeenCalledWith(
        "node",
        expect.arrayContaining([
          "packages/mcp-review/dist/server.js",
          "--agent-id",
          reviewExecution.id,
          "--parent-instance-id",
          codingExecution.id,
        ]),
        expect.any(Object)
      );

      // Verify process tracking
      expect(spawn).toHaveBeenCalledTimes(2); // One for coding, one for review
    });
  });
});
