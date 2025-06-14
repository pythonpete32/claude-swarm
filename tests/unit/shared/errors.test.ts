import { describe, expect, it } from "vitest";
import {
  ERROR_CODES,
  ErrorFactory,
  ErrorUtils,
  GitError,
  GitHubAPIError,
  GitHubError,
  GitHubRateLimitError,
  SwarmError,
  WorktreeError,
} from "../../../src/shared/errors";

describe("SwarmError", () => {
  it("should create error with all properties", () => {
    const error = new SwarmError("Test message", "TEST_CODE", "test", { key: "value" });

    expect(error.message).toBe("Test message");
    expect(error.code).toBe("TEST_CODE");
    expect(error.module).toBe("test");
    expect(error.details).toEqual({ key: "value" });
    expect(error.timestamp).toBeInstanceOf(Date);
  });

  it("should serialize to JSON correctly", () => {
    const error = new SwarmError("Test", "CODE", "module");
    const json = error.toJSON();

    expect(json).toHaveProperty("name", "SwarmError");
    expect(json).toHaveProperty("message", "Test");
    expect(json).toHaveProperty("code", "CODE");
    expect(json).toHaveProperty("module", "module");
    expect(json).toHaveProperty("timestamp");
    expect(json).toHaveProperty("stack");
  });

  it("should provide user message", () => {
    const error = new SwarmError("Test error", "CODE", "module");
    expect(error.getUserMessage()).toBe("Test error");
  });
});

describe("Module-specific errors", () => {
  it("should create WorktreeError with correct module", () => {
    const error = new WorktreeError("Test", ERROR_CODES.WORKTREE_EXISTS);
    expect(error.module).toBe("worktree");
    expect(error.name).toBe("WorktreeError");
  });

  it("should create GitError with correct module", () => {
    const error = new GitError("Test", ERROR_CODES.GIT_COMMAND_FAILED);
    expect(error.module).toBe("git");
    expect(error.name).toBe("GitError");
  });

  it("should create GitHubError with correct module", () => {
    const error = new GitHubError("Test", ERROR_CODES.GITHUB_API_ERROR);
    expect(error.module).toBe("github");
    expect(error.name).toBe("GitHubError");
  });
});

describe("GitHubAPIError", () => {
  it("should include status and response", () => {
    const response = { error: "Not found" };
    const error = new GitHubAPIError("API Error", 404, response);

    expect(error.status).toBe(404);
    expect(error.response).toEqual(response);
    expect(error.details.status).toBe(404);
    expect(error.details.response).toEqual(response);
  });
});

describe("GitHubRateLimitError", () => {
  it("should include rate limit details", () => {
    const resetTime = new Date(Date.now() + 60000); // 1 minute from now
    const error = new GitHubRateLimitError(resetTime, 5000, 0);

    expect(error.resetTime).toEqual(resetTime);
    expect(error.limit).toBe(5000);
    expect(error.remaining).toBe(0);
    expect(error.message).toContain("Resets in 1 minutes");
  });
});

describe("ErrorFactory", () => {
  it("should create worktree errors", () => {
    const error = ErrorFactory.worktree("CODE", "Test message", { key: "value" });
    expect(error).toBeInstanceOf(WorktreeError);
    expect(error.code).toBe("CODE");
    expect(error.message).toBe("Test message");
    expect(error.details).toEqual({ key: "value" });
  });

  it("should create git errors", () => {
    const error = ErrorFactory.git("CODE", "Test message");
    expect(error).toBeInstanceOf(GitError);
    expect(error.code).toBe("CODE");
  });

  it("should create github errors", () => {
    const error = ErrorFactory.github("CODE", "Test message");
    expect(error).toBeInstanceOf(GitHubError);
    expect(error.code).toBe("CODE");
  });
});

describe("ErrorUtils", () => {
  it("should identify SwarmError instances", () => {
    const swarmError = new SwarmError("Test", "CODE", "module");
    const regularError = new Error("Regular error");

    expect(ErrorUtils.isSwarmError(swarmError)).toBe(true);
    expect(ErrorUtils.isSwarmError(regularError)).toBe(false);
    expect(ErrorUtils.isSwarmError("string")).toBe(false);
  });

  it("should identify module errors", () => {
    const worktreeError = new WorktreeError("Test", "CODE");
    const gitError = new GitError("Test", "CODE");

    expect(ErrorUtils.isModuleError(worktreeError, "worktree")).toBe(true);
    expect(ErrorUtils.isModuleError(worktreeError, "git")).toBe(false);
    expect(ErrorUtils.isModuleError(gitError, "git")).toBe(true);
  });

  it("should extract error details", () => {
    const swarmError = new SwarmError("Test", "CODE", "module", { key: "value" });
    const regularError = new Error("Regular error");
    const stringError = "String error";

    const swarmDetails = ErrorUtils.getErrorDetails(swarmError);
    expect(swarmDetails).toHaveProperty("code", "CODE");
    expect(swarmDetails).toHaveProperty("module", "module");

    const regularDetails = ErrorUtils.getErrorDetails(regularError);
    expect(regularDetails).toHaveProperty("name", "Error");
    expect(regularDetails).toHaveProperty("message", "Regular error");

    const stringDetails = ErrorUtils.getErrorDetails(stringError);
    expect(stringDetails).toEqual({ error: "String error" });
  });

  it("should format user errors", () => {
    const swarmError = new SwarmError("Swarm error", "CODE", "module");
    const regularError = new Error("Regular error");
    const stringError = "String error";

    expect(ErrorUtils.formatUserError(swarmError)).toBe("Swarm error");
    expect(ErrorUtils.formatUserError(regularError)).toBe("Regular error");
    expect(ErrorUtils.formatUserError(stringError)).toBe("String error");
  });
});

describe("Error suggestions", () => {
  it("should provide worktree error suggestions", () => {
    const existsError = new WorktreeError("Test", ERROR_CODES.WORKTREE_EXISTS);
    expect(existsError.getUserMessage()).toContain("Use --force to overwrite");

    const notFoundError = new WorktreeError("Test", ERROR_CODES.WORKTREE_NOT_FOUND);
    expect(notFoundError.getUserMessage()).toContain("Check the worktree path");
  });

  it("should provide git error suggestions", () => {
    const repoError = new GitError("Test", ERROR_CODES.GIT_REPOSITORY_NOT_FOUND);
    expect(repoError.getUserMessage()).toContain("git init");

    const branchError = new GitError("Test", ERROR_CODES.GIT_BRANCH_NOT_FOUND);
    expect(branchError.getUserMessage()).toContain("git checkout -b");
  });

  it("should provide github error suggestions", () => {
    const authError = new GitHubError("Test", ERROR_CODES.GITHUB_AUTH_FAILED);
    expect(authError.getUserMessage()).toContain("gh auth status");

    const rateLimitError = new GitHubError("Test", ERROR_CODES.GITHUB_RATE_LIMIT_EXCEEDED);
    expect(rateLimitError.getUserMessage()).toContain("Wait for rate limit reset");
  });
});
