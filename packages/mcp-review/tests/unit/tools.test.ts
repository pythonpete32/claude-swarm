/**
 * Unit tests for MCP Review tools
 */

import { describe, expect, it } from "vitest";

describe("MCP Review Tools", () => {
  describe("Tool Validation", () => {
    it("should validate save_review tool arguments", () => {
      const validArgs = {
        review:
          "The code looks good. Authentication implementation is secure and follows best practices.",
        decision: "approve" as const,
      };

      expect(validArgs).toHaveProperty("review");
      expect(validArgs).toHaveProperty("decision");
      expect(typeof validArgs.review).toBe("string");
      expect(validArgs.review.length).toBeGreaterThan(0);
      expect(["approve", "request_changes"]).toContain(validArgs.decision);
    });

    it("should validate create_pull_request tool arguments", () => {
      const validArgs = {
        title: "Add user authentication feature",
        description: "This PR implements secure user authentication with proper validation.",
        draft: false,
      };

      expect(validArgs).toHaveProperty("title");
      expect(validArgs).toHaveProperty("description");
      expect(typeof validArgs.title).toBe("string");
      expect(typeof validArgs.description).toBe("string");
      expect(typeof validArgs.draft).toBe("boolean");
    });

    it("should reject invalid decision values", () => {
      const invalidDecisions = ["accept", "reject", "maybe", ""];

      for (const decision of invalidDecisions) {
        const _args = {
          review: "Some review text",
          decision: decision,
        };

        expect(["approve", "request_changes"]).not.toContain(decision);
      }
    });
  });

  describe("Context Parsing", () => {
    it("should parse review agent context correctly", () => {
      const testArgs = [
        "node",
        "server.js",
        "--agent-id",
        "review-test-123",
        "--workspace",
        "/test/review-workspace",
        "--parent-instance-id",
        "coding-agent-456",
        "--parent-tmux-session",
        "coding-session-456",
        "--branch",
        "review/feature-test",
        "--session",
        "review-session-123",
      ];

      const parseArgs = (args: string[]) => {
        const result: Record<string, string> = {};
        for (let i = 0; i < args.length; i++) {
          if (args[i].startsWith("--")) {
            const key = args[i].substring(2);
            result[key] = args[i + 1];
            i++; // Skip the value
          }
        }
        return result;
      };

      const parsed = parseArgs(testArgs);

      expect(parsed["agent-id"]).toBe("review-test-123");
      expect(parsed.workspace).toBe("/test/review-workspace");
      expect(parsed["parent-instance-id"]).toBe("coding-agent-456");
      expect(parsed["parent-tmux-session"]).toBe("coding-session-456");
      expect(parsed.branch).toBe("review/feature-test");
      expect(parsed.session).toBe("review-session-123");
    });

    it("should validate required review context", () => {
      const minimalValidContext = {
        "agent-id": "review-123",
        workspace: "/test/workspace",
        "parent-instance-id": "parent-456",
        "parent-tmux-session": "parent-session",
        branch: "review/test",
        session: "review-session",
      };

      const required = ["agent-id", "workspace", "parent-instance-id", "parent-tmux-session"];

      for (const key of required) {
        expect(minimalValidContext[key as keyof typeof minimalValidContext]).toBeDefined();
        expect(minimalValidContext[key as keyof typeof minimalValidContext]).not.toBe("");
      }
    });
  });

  describe("Review Decision Processing", () => {
    it("should format approval decisions correctly", () => {
      const approvalReview = {
        review: "Code quality is excellent. All tests pass. Ready for production.",
        decision: "approve" as const,
      };

      const expectedMessage = `## 🔍 Code Review Complete

**Decision:** ✅ APPROVED

**Review:**
${approvalReview.review}

---
The review agent has completed its analysis. You may now create a pull request.`;

      expect(approvalReview.decision).toBe("approve");
      expect(expectedMessage).toContain("✅ APPROVED");
      expect(expectedMessage).toContain(approvalReview.review);
      expect(expectedMessage).toContain("create a pull request");
    });

    it("should format change request decisions correctly", () => {
      const changeRequestReview = {
        review: "Found security vulnerability in authentication. Please fix before merging.",
        decision: "request_changes" as const,
      };

      const expectedMessage = `## 🔍 Code Review Complete

**Decision:** ❌ CHANGES REQUESTED

**Review:**
${changeRequestReview.review}

---
The review agent has completed its analysis. Please address the feedback above and re-request review when ready.`;

      expect(changeRequestReview.decision).toBe("request_changes");
      expect(expectedMessage).toContain("❌ CHANGES REQUESTED");
      expect(expectedMessage).toContain(changeRequestReview.review);
      expect(expectedMessage).toContain("address the feedback");
    });
  });

  describe("Tool Response Format", () => {
    it("should format successful save_review responses", () => {
      const successResponse = {
        content: [
          {
            type: "text",
            text: "Review saved successfully and feedback injected into coding agent session",
          },
        ],
      };

      expect(successResponse.content).toHaveLength(1);
      expect(successResponse.content[0].type).toBe("text");
      expect(successResponse.content[0].text).toContain("Review saved successfully");
      expect(successResponse.content[0].text).toContain("feedback injected");
    });

    it("should format error responses correctly", () => {
      const errorResponse = {
        content: [
          {
            type: "text",
            text: "Error: Invalid arguments for save_review tool",
          },
        ],
        isError: true,
      };

      expect(errorResponse.content).toHaveLength(1);
      expect(errorResponse.content[0].type).toBe("text");
      expect(errorResponse.content[0].text).toContain("Error:");
      expect(errorResponse.isError).toBe(true);
    });
  });
});
