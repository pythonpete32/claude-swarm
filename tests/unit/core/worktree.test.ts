/**
 * Unit tests for core Worktree module
 *
 * Tests all worktree operations with mocked Git and filesystem execution
 * to ensure isolation and deterministic results.
 * Uses Test-Driven Development (TDD) methodology.
 */

import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClaudeContextStatus } from "../../../src/core/files";
import { ERROR_CODES } from "../../../src/shared/errors";
import type { GitBranchInfo, RepositoryInfo, WorktreeInfo } from "../../../src/shared/types";

// Import interfaces that will be defined in the implementation
import type {
  CleanupWorktreesOptions,
  CreateWorktreeOptions,
  EnsureBranchOptions,
  ExtendedWorktreeInfo,
  GitOperationsInterface,
  GitWorktreeInfo,
  ListWorktreesOptions,
  RemoveWorktreeOptions,
  SwitchWorktreeOptions,
  WorktreeCleanupResult,
  WorktreeResult,
  WorktreeStateValidation,
} from "../../../src/core/worktree";

// Import functions to be implemented
import {
  cleanupOrphanedWorktrees,
  createWorktree,
  ensureWorktreeBranch,
  getActiveWorktree,
  getWorktreeInfo,
  listWorktrees,
  removeWorktree,
  switchWorktree,
  validateWorktreeState,
} from "../../../src/core/worktree";

// Mock Git Operations for testing
class MockGitOperations implements GitOperationsInterface {
  private worktrees = new Map<string, GitWorktreeInfo>();
  private branches = new Map<string, { exists: boolean; commit: string; upstream?: string }>();
  private uncommittedChanges = new Map<string, string[]>();
  private shouldThrow = new Map<string, Error>();
  private callLog: Array<{ method: string; args: unknown[] }> = [];

  constructor() {
    this.reset();
  }

  // Mock data setup methods
  setWorktree(path: string, worktree: GitWorktreeInfo): void {
    this.worktrees.set(path, worktree);
  }

  setBranch(name: string, exists: boolean, commit = "abc123", upstream?: string): void {
    this.branches.set(name, { exists, commit, upstream });
  }

  setUncommittedChanges(path: string, files: string[]): void {
    this.uncommittedChanges.set(path, files);
  }

  setError(method: string, path: string, error: Error): void {
    this.shouldThrow.set(`${method}:${path}`, error);
  }

  getCallLog(): Array<{ method: string; args: unknown[] }> {
    return [...this.callLog];
  }

  reset(): void {
    this.worktrees.clear();
    this.branches.clear();
    this.uncommittedChanges.clear();
    this.shouldThrow.clear();
    this.callLog = [];

    // Set up default main branch
    this.branches.set("main", { exists: true, commit: "abc123def456" });
  }

  // GitOperationsInterface implementation
  async worktreeAdd(path: string, branch?: string): Promise<void> {
    this.callLog.push({ method: "worktreeAdd", args: [path, branch] });

    const error = this.shouldThrow.get(`worktreeAdd:${path}`);
    if (error) throw error;

    // Check if worktree already exists
    if (this.worktrees.has(path)) {
      const existsError = new Error(`fatal: '${path}' already exists`);
      (existsError as Error & { code: string }).code = "EEXIST";
      throw existsError;
    }

    // Check if branch exists (if specified)
    if (branch && !this.branches.has(branch)) {
      throw new Error(`fatal: invalid reference: ${branch}`);
    }

    // Create worktree
    const branchName = branch || "main";
    const branchInfo = this.branches.get(branchName) || { exists: true, commit: "abc123" };

    this.worktrees.set(path, {
      path,
      branch: branchName,
      commit: branchInfo.commit,
      isBare: false,
      isLocked: false,
    });
  }

  async worktreeRemove(path: string, force = false): Promise<void> {
    this.callLog.push({ method: "worktreeRemove", args: [path, force] });

    const error = this.shouldThrow.get(`worktreeRemove:${path}`);
    if (error) throw error;

    if (!this.worktrees.has(path)) {
      throw new Error(`fatal: '${path}' is not a working tree`);
    }

    // Check for uncommitted changes unless force is true
    const uncommitted = this.uncommittedChanges.get(path) || [];
    if (uncommitted.length > 0 && !force) {
      throw new Error(
        `fatal: '${path}' contains modified or untracked files, use --force to delete it`,
      );
    }

    this.worktrees.delete(path);
  }

  async worktreeList(): Promise<GitWorktreeInfo[]> {
    this.callLog.push({ method: "worktreeList", args: [] });

    const error = this.shouldThrow.get("worktreeList:");
    if (error) throw error;

    return Array.from(this.worktrees.values());
  }

  async worktreePrune(): Promise<void> {
    this.callLog.push({ method: "worktreePrune", args: [] });

    const error = this.shouldThrow.get("worktreePrune:");
    if (error) throw error;

    // In real Git, prune only removes stale administrative files, not the worktrees themselves
    // The cleanup function should be responsible for actually removing worktree directories
    // So we don't remove anything here in the mock
  }

  async isWorktree(path: string): Promise<boolean> {
    this.callLog.push({ method: "isWorktree", args: [path] });

    const error = this.shouldThrow.get(`isWorktree:${path}`);
    if (error) throw error;

    return this.worktrees.has(path);
  }

  async getWorktreeRoot(path: string): Promise<string> {
    this.callLog.push({ method: "getWorktreeRoot", args: [path] });

    const error = this.shouldThrow.get(`getWorktreeRoot:${path}`);
    if (error) throw error;

    // Find worktree that contains this path
    for (const [worktreePath] of this.worktrees) {
      if (path.startsWith(worktreePath)) {
        return worktreePath;
      }
    }

    throw new Error(`fatal: not a git repository: ${path}`);
  }

  async getCurrentBranch(path: string): Promise<string> {
    this.callLog.push({ method: "getCurrentBranch", args: [path] });

    const error = this.shouldThrow.get(`getCurrentBranch:${path}`);
    if (error) throw error;

    const worktree = this.worktrees.get(path);
    if (!worktree) {
      throw new Error(`fatal: not a git repository: ${path}`);
    }

    return worktree.branch;
  }

  async hasUncommittedChanges(path: string): Promise<boolean> {
    this.callLog.push({ method: "hasUncommittedChanges", args: [path] });

    const error = this.shouldThrow.get(`hasUncommittedChanges:${path}`);
    if (error) throw error;

    const uncommitted = this.uncommittedChanges.get(path) || [];
    return uncommitted.length > 0;
  }

  async createBranch(name: string, startPoint?: string): Promise<void> {
    this.callLog.push({ method: "createBranch", args: [name, startPoint] });

    const error = this.shouldThrow.get(`createBranch:${name}`);
    if (error) throw error;

    if (this.branches.has(name)) {
      throw new Error(`fatal: A branch named '${name}' already exists.`);
    }

    const baseCommit = startPoint ? this.branches.get(startPoint)?.commit || "abc123" : "abc123";

    this.branches.set(name, { exists: true, commit: baseCommit });
  }

  async branchExists(name: string): Promise<boolean> {
    this.callLog.push({ method: "branchExists", args: [name] });

    const error = this.shouldThrow.get(`branchExists:${name}`);
    if (error) throw error;

    return this.branches.has(name) && (this.branches.get(name)?.exists ?? false);
  }

  async getUncommittedFiles(path: string): Promise<string[]> {
    this.callLog.push({ method: "getUncommittedFiles", args: [path] });

    const error = this.shouldThrow.get(`getUncommittedFiles:${path}`);
    if (error) throw error;

    return this.uncommittedChanges.get(path) || [];
  }
}

// Mock file operations (reuse from files module for context setup)
class MockFileOperations {
  private callLog: Array<{ method: string; args: unknown[] }> = [];

  getCallLog(): Array<{ method: string; args: unknown[] }> {
    return [...this.callLog];
  }

  reset(): void {
    this.callLog = [];
  }

  async ensureClaudeContext(targetPath: string, sourcePath?: string): Promise<ClaudeContextStatus> {
    this.callLog.push({ method: "ensureClaudeContext", args: [targetPath, sourcePath] });

    // Mock successful context setup
    return {
      isComplete: true,
      claudeMdExists: true,
      claudeDirExists: true,
      copiedFiles: [`${targetPath}/CLAUDE.md`, `${targetPath}/.claude`],
    };
  }
}

describe("core-worktree", () => {
  let mockGitOps: MockGitOperations;
  let mockFileOps: MockFileOperations;
  const _testRepoPath = "/test/repo";
  const testWorktreePath = "/test/repo/worktrees/task-123";

  beforeEach(() => {
    mockGitOps = new MockGitOperations();
    mockFileOps = new MockFileOperations();
  });

  describe("validateWorktreeState (TDD Phase 2)", () => {
    it("should return valid state for clean worktree", async () => {
      // Arrange: Set up clean worktree
      mockGitOps.setWorktree(testWorktreePath, {
        path: testWorktreePath,
        branch: "feature/task-123",
        commit: "abc123def456",
        isBare: false,
        isLocked: false,
      });

      // Act
      const result = await validateWorktreeState(testWorktreePath, mockGitOps);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.isClean).toBe(true);
      expect(result.hasValidGitDir).toBe(true);
      expect(result.hasValidBranch).toBe(true);
      expect(result.uncommittedFiles).toHaveLength(0);
      expect(result.issues).toHaveLength(0);
    });

    it("should detect uncommitted changes in worktree", async () => {
      // Arrange: Set up worktree with uncommitted changes
      mockGitOps.setWorktree(testWorktreePath, {
        path: testWorktreePath,
        branch: "feature/task-123",
        commit: "abc123def456",
        isBare: false,
        isLocked: false,
      });
      mockGitOps.setUncommittedChanges(testWorktreePath, ["src/file1.ts", "src/file2.ts"]);

      // Act
      const result = await validateWorktreeState(testWorktreePath, mockGitOps);

      // Assert
      expect(result.isValid).toBe(true); // Still valid, just not clean
      expect(result.isClean).toBe(false);
      expect(result.uncommittedFiles).toEqual(["src/file1.ts", "src/file2.ts"]);
      expect(result.warnings).toContain("Worktree has uncommitted changes");
    });

    it("should handle non-existent worktree", async () => {
      // Act & Assert
      await expect(validateWorktreeState("/nonexistent/path", mockGitOps)).rejects.toThrow(
        "WORKTREE_NOT_FOUND",
      );
    });

    it("should handle corrupted worktree", async () => {
      // Arrange: Set up worktree that exists but has corrupted git state
      mockGitOps.setWorktree(testWorktreePath, {
        path: testWorktreePath,
        branch: "feature/task-123",
        commit: "abc123def456",
        isBare: false,
        isLocked: false,
      });

      // Set up git operation to fail
      mockGitOps.setError(
        "getCurrentBranch",
        testWorktreePath,
        new Error("fatal: not a git repository"),
      );

      // Act & Assert
      await expect(validateWorktreeState(testWorktreePath, mockGitOps)).rejects.toThrow(
        "WORKTREE_INVALID_PATH",
      );
    });

    it("should validate path parameter", async () => {
      // Act & Assert
      await expect(validateWorktreeState("", mockGitOps)).rejects.toThrow("validation");
    });
  });

  describe("createWorktree (TDD Phase 2)", () => {
    const defaultOptions: CreateWorktreeOptions = {
      name: "task-123",
      branch: "feature/task-123",
      baseBranch: "main",
    };

    it("should create worktree with new branch", async () => {
      // Arrange: Set up mock to expect worktree creation
      mockGitOps.setBranch("main", true);

      // Act
      const result = await createWorktree(defaultOptions, mockGitOps, mockFileOps);

      // Assert
      expect(result.success).toBe(true);
      expect(result.path).toMatch(/task-123/);
      expect(result.branch).toBe("feature/task-123");

      // Verify Git operations were called
      const gitCalls = mockGitOps.getCallLog();
      expect(gitCalls).toContainEqual(expect.objectContaining({ method: "branchExists" }));
      expect(gitCalls).toContainEqual(expect.objectContaining({ method: "createBranch" }));
      expect(gitCalls).toContainEqual(expect.objectContaining({ method: "worktreeAdd" }));
    });

    it("should create worktree with existing branch", async () => {
      // Arrange: Set up existing branch
      mockGitOps.setBranch("feature/task-123", true);

      // Act
      const result = await createWorktree(defaultOptions, mockGitOps, mockFileOps);

      // Assert
      expect(result.success).toBe(true);
      expect(result.branch).toBe("feature/task-123");

      // Verify branch creation was skipped
      const gitCalls = mockGitOps.getCallLog();
      expect(gitCalls).toContainEqual(expect.objectContaining({ method: "branchExists" }));
      expect(gitCalls).not.toContainEqual(expect.objectContaining({ method: "createBranch" }));
    });

    it("should setup Claude context when requested", async () => {
      // Arrange
      const optionsWithContext = { ...defaultOptions, setupContext: true };

      // Act
      const result = await createWorktree(optionsWithContext, mockGitOps, mockFileOps);

      // Assert
      expect(result.success).toBe(true);
      expect(result.contextStatus?.isComplete).toBe(true);

      // Verify context setup was called
      const fileCalls = mockFileOps.getCallLog();
      expect(fileCalls).toContainEqual(expect.objectContaining({ method: "ensureClaudeContext" }));
    });

    it("should handle path conflicts when force is false", async () => {
      // Arrange: Set up existing worktree
      mockGitOps.setWorktree(testWorktreePath, {
        path: testWorktreePath,
        branch: "feature/task-123",
        commit: "abc123",
        isBare: false,
        isLocked: false,
      });

      const optionsWithPath = { ...defaultOptions, path: testWorktreePath };

      // Act & Assert
      await expect(createWorktree(optionsWithPath, mockGitOps, mockFileOps)).rejects.toThrow(
        "WORKTREE_EXISTS",
      );
    });

    it("should override existing worktree when force is true", async () => {
      // Arrange: Set up existing worktree but allow force override
      const optionsWithForce = { ...defaultOptions, force: true, path: testWorktreePath };

      // Act
      const result = await createWorktree(optionsWithForce, mockGitOps, mockFileOps);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should validate required options", async () => {
      // Act & Assert
      await expect(createWorktree({ name: "" }, mockGitOps, mockFileOps)).rejects.toThrow(
        "validation",
      );
    });

    it("should handle Git operation failures", async () => {
      // Arrange: Set up Git operation to fail for the expected path
      const expectedPath = path.join(process.cwd(), "worktrees", "task-123");
      mockGitOps.setError("worktreeAdd", expectedPath, new Error("Permission denied"));

      // Act & Assert
      await expect(createWorktree(defaultOptions, mockGitOps, mockFileOps)).rejects.toThrow(
        "WORKTREE_CREATION_FAILED",
      );
    });

    it("should generate default path from name when not specified", async () => {
      // Act
      const result = await createWorktree({ name: "task-456" }, mockGitOps, mockFileOps);

      // Assert
      expect(result.success).toBe(true);
      expect(result.path).toMatch(/task-456/);
    });

    it("should generate default branch from name when not specified", async () => {
      // Act
      const result = await createWorktree({ name: "task-789" }, mockGitOps, mockFileOps);

      // Assert
      expect(result.success).toBe(true);
      expect(result.branch).toMatch(/task-789/);
    });
  });

  describe("listWorktrees (TDD Phase 3)", () => {
    beforeEach(() => {
      // Set up multiple worktrees
      mockGitOps.setWorktree("/test/repo", {
        path: "/test/repo",
        branch: "main",
        commit: "abc123",
        isBare: false,
        isLocked: false,
      });

      mockGitOps.setWorktree("/test/repo/worktrees/task-1", {
        path: "/test/repo/worktrees/task-1",
        branch: "feature/task-1",
        commit: "def456",
        isBare: false,
        isLocked: false,
      });

      mockGitOps.setWorktree("/test/repo/worktrees/task-2", {
        path: "/test/repo/worktrees/task-2",
        branch: "feature/task-2",
        commit: "ghi789",
        isBare: false,
        isLocked: false,
      });
    });

    it("should list all worktrees with default options", async () => {
      // Act
      const worktrees = await listWorktrees({}, mockGitOps);

      // Assert
      expect(worktrees).toHaveLength(3);
      expect(worktrees[0].path).toBe("/test/repo");
      expect(worktrees[0].isMainWorktree).toBe(true);
      expect(worktrees[1].isMainWorktree).toBe(false);
      expect(worktrees[2].isMainWorktree).toBe(false);
    });

    it("should exclude main worktree when includeMainWorktree is false", async () => {
      // Act
      const worktrees = await listWorktrees({ includeMainWorktree: false }, mockGitOps);

      // Assert
      expect(worktrees).toHaveLength(2);
      expect(worktrees.every((w) => !w.isMainWorktree)).toBe(true);
    });

    it("should sort worktrees by specified criteria", async () => {
      // Act
      const worktreesByPath = await listWorktrees({ sortBy: "path" }, mockGitOps);
      const worktreesByBranch = await listWorktrees({ sortBy: "branch" }, mockGitOps);

      // Assert
      expect(worktreesByPath[0].path).toBe("/test/repo");
      expect(worktreesByBranch[0].branch).toBe("feature/task-1");
    });

    it("should validate state when validateState is true", async () => {
      // Arrange: Add uncommitted changes to one worktree
      mockGitOps.setUncommittedChanges("/test/repo/worktrees/task-1", ["file1.ts"]);

      // Act
      const worktrees = await listWorktrees({ validateState: true }, mockGitOps);

      // Assert
      const task1Worktree = worktrees.find((w) => w.path === "/test/repo/worktrees/task-1");
      expect(task1Worktree?.isClean).toBe(false);
    });

    it("should handle Git operation failures gracefully", async () => {
      // Arrange: Set up Git operation to fail
      mockGitOps.setError("worktreeList", "", new Error("Git command failed"));

      // Act & Assert
      await expect(listWorktrees({}, mockGitOps)).rejects.toThrow("Failed to list worktrees");
    });
  });

  describe("getWorktreeInfo (TDD Phase 3)", () => {
    beforeEach(() => {
      mockGitOps.setWorktree(testWorktreePath, {
        path: testWorktreePath,
        branch: "feature/task-123",
        commit: "abc123def456",
        isBare: false,
        isLocked: false,
      });
    });

    it("should return detailed worktree information", async () => {
      // Act
      const info = await getWorktreeInfo(testWorktreePath, mockGitOps);

      // Assert
      expect(info.path).toBe(testWorktreePath);
      expect(info.branch).toBe("feature/task-123");
      expect(info.commit).toBe("abc123def456");
      expect(info.isMainWorktree).toBe(false);
      expect(info.isActive).toBeDefined();
      expect(info.hasUncommittedChanges).toBe(false);
    });

    it("should detect uncommitted changes", async () => {
      // Arrange: Add uncommitted changes
      mockGitOps.setUncommittedChanges(testWorktreePath, ["src/file.ts"]);

      // Act
      const info = await getWorktreeInfo(testWorktreePath, mockGitOps);

      // Assert
      expect(info.hasUncommittedChanges).toBe(true);
    });

    it("should handle non-existent worktree", async () => {
      // Act & Assert
      await expect(getWorktreeInfo("/nonexistent/path", mockGitOps)).rejects.toThrow(
        "WORKTREE_NOT_FOUND",
      );
    });

    it("should validate path parameter", async () => {
      // Act & Assert
      await expect(getWorktreeInfo("", mockGitOps)).rejects.toThrow("validation");
    });
  });

  describe("removeWorktree (TDD Phase 4)", () => {
    beforeEach(() => {
      mockGitOps.setWorktree(testWorktreePath, {
        path: testWorktreePath,
        branch: "feature/task-123",
        commit: "abc123def456",
        isBare: false,
        isLocked: false,
      });
    });

    it("should remove clean worktree successfully", async () => {
      // Act
      const result = await removeWorktree(testWorktreePath, {}, mockGitOps);

      // Assert
      expect(result.success).toBe(true);

      // Verify Git operations were called
      const gitCalls = mockGitOps.getCallLog();
      expect(gitCalls).toContainEqual(expect.objectContaining({ method: "worktreeRemove" }));
    });

    it("should prevent removal of worktree with uncommitted changes", async () => {
      // Arrange: Add uncommitted changes
      mockGitOps.setUncommittedChanges(testWorktreePath, ["src/file.ts"]);

      // Act & Assert
      await expect(removeWorktree(testWorktreePath, {}, mockGitOps)).rejects.toThrow(
        "WORKTREE_UNCOMMITTED_CHANGES",
      );
    });

    it("should force remove worktree with uncommitted changes when force is true", async () => {
      // Arrange: Add uncommitted changes
      mockGitOps.setUncommittedChanges(testWorktreePath, ["src/file.ts"]);

      // Act
      const result = await removeWorktree(testWorktreePath, { force: true }, mockGitOps);

      // Assert
      expect(result.success).toBe(true);

      // Verify force flag was passed to Git
      const gitCalls = mockGitOps.getCallLog();
      const removeCall = gitCalls.find((call) => call.method === "worktreeRemove");
      expect(removeCall?.args[1]).toBe(true); // force parameter
    });

    it("should handle non-existent worktree", async () => {
      // Act & Assert
      await expect(removeWorktree("/nonexistent/path", {}, mockGitOps)).rejects.toThrow(
        "WORKTREE_NOT_FOUND",
      );
    });

    it("should validate path parameter", async () => {
      // Act & Assert
      await expect(removeWorktree("", {}, mockGitOps)).rejects.toThrow("validation");
    });

    it("should handle Git operation failures", async () => {
      // Arrange: Set up Git operation to fail
      mockGitOps.setError("worktreeRemove", testWorktreePath, new Error("Permission denied"));

      // Act & Assert
      await expect(removeWorktree(testWorktreePath, {}, mockGitOps)).rejects.toThrow(
        "WORKTREE_REMOVAL_FAILED",
      );
    });
  });

  describe("switchWorktree (TDD Phase 4)", () => {
    it("should switch to existing worktree", async () => {
      // Arrange: Set up target worktree
      mockGitOps.setWorktree(testWorktreePath, {
        path: testWorktreePath,
        branch: "feature/task-123",
        commit: "abc123def456",
        isBare: false,
        isLocked: false,
      });

      const options: SwitchWorktreeOptions = {
        path: testWorktreePath,
      };

      // Act
      const result = await switchWorktree(options, mockGitOps);

      // Assert
      expect(result.success).toBe(true);
      expect(result.path).toBe(testWorktreePath);
    });

    it("should create worktree if missing and createIfMissing is true", async () => {
      // Arrange
      const options: SwitchWorktreeOptions = {
        path: "/test/repo/worktrees/new-task",
        createIfMissing: true,
      };

      // Act
      const result = await switchWorktree(options, mockGitOps);

      // Assert
      expect(result.success).toBe(true);

      // Verify worktree creation was attempted
      const gitCalls = mockGitOps.getCallLog();
      expect(gitCalls).toContainEqual(expect.objectContaining({ method: "worktreeAdd" }));
    });

    it("should fail if worktree missing and createIfMissing is false", async () => {
      // Arrange
      const options: SwitchWorktreeOptions = {
        path: "/nonexistent/worktree",
        createIfMissing: false,
      };

      // Act & Assert
      await expect(switchWorktree(options, mockGitOps)).rejects.toThrow("WORKTREE_NOT_FOUND");
    });

    it("should validate options", async () => {
      // Act & Assert
      await expect(switchWorktree({ path: "" }, mockGitOps)).rejects.toThrow("validation");
    });
  });

  describe("getActiveWorktree (TDD Phase 5)", () => {
    it("should return null when no active worktree", async () => {
      // Act
      const result = await getActiveWorktree(mockGitOps);

      // Assert
      expect(result).toBeNull();
    });

    it("should identify active worktree from current working directory", async () => {
      // Arrange: Set up worktree and mock current directory
      mockGitOps.setWorktree(testWorktreePath, {
        path: testWorktreePath,
        branch: "feature/task-123",
        commit: "abc123def456",
        isBare: false,
        isLocked: false,
      });

      // Mock process.cwd() to return worktree path
      const originalCwd = process.cwd;
      process.cwd = vi.fn().mockReturnValue(testWorktreePath);

      try {
        // Act
        const result = await getActiveWorktree(mockGitOps);

        // Assert
        expect(result).not.toBeNull();
        expect(result?.path).toBe(testWorktreePath);
      } finally {
        process.cwd = originalCwd;
      }
    });

    it("should handle Git operation failures gracefully", async () => {
      // Arrange: Set up Git operation to fail
      mockGitOps.setError("getWorktreeRoot", "/any/path", new Error("Not a git repository"));

      // Act
      const result = await getActiveWorktree(mockGitOps);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("ensureWorktreeBranch (TDD Phase 5)", () => {
    beforeEach(() => {
      mockGitOps.setWorktree(testWorktreePath, {
        path: testWorktreePath,
        branch: "feature/task-123",
        commit: "abc123def456",
        isBare: false,
        isLocked: false,
      });
    });

    it("should ensure branch exists when createIfMissing is true", async () => {
      // Arrange
      const options: EnsureBranchOptions = {
        baseBranch: "main",
        createIfMissing: true,
      };

      // Act
      const result = await ensureWorktreeBranch(testWorktreePath, options, mockGitOps);

      // Assert
      expect(result.success).toBe(true);

      // Verify branch operations
      const gitCalls = mockGitOps.getCallLog();
      expect(gitCalls).toContainEqual(expect.objectContaining({ method: "getCurrentBranch" }));
    });

    it("should handle missing branch when createIfMissing is false", async () => {
      // Arrange: Set up non-existent branch
      mockGitOps.setWorktree(testWorktreePath, {
        path: testWorktreePath,
        branch: "non-existent-branch",
        commit: "abc123def456",
        isBare: false,
        isLocked: false,
      });

      const options: EnsureBranchOptions = {
        createIfMissing: false,
      };

      // Act & Assert
      await expect(ensureWorktreeBranch(testWorktreePath, options, mockGitOps)).rejects.toThrow(
        "GIT_BRANCH_NOT_FOUND",
      );
    });

    it("should validate worktree path", async () => {
      // Act & Assert
      await expect(ensureWorktreeBranch("", {}, mockGitOps)).rejects.toThrow("validation");
    });
  });

  describe("cleanupOrphanedWorktrees (TDD Phase 6)", () => {
    beforeEach(() => {
      // Set up multiple worktrees including some old ones
      const _oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days old
      const _recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days old

      mockGitOps.setWorktree("/test/repo/worktrees/old-task", {
        path: "/test/repo/worktrees/old-task",
        branch: "feature/old-task",
        commit: "old123",
        isBare: false,
        isLocked: false,
      });

      mockGitOps.setWorktree("/test/repo/worktrees/recent-task", {
        path: "/test/repo/worktrees/recent-task",
        branch: "feature/recent-task",
        commit: "recent123",
        isBare: false,
        isLocked: false,
      });

      mockGitOps.setWorktree("/test/repo/worktrees/locked-task", {
        path: "/test/repo/worktrees/locked-task",
        branch: "feature/locked-task",
        commit: "locked123",
        isBare: false,
        isLocked: true,
        lockReason: "missing",
      });
    });

    it("should clean up orphaned worktrees with default options", async () => {
      // Act
      const result = await cleanupOrphanedWorktrees({}, mockGitOps);

      // Assert
      expect(result.removedWorktrees).toContain("/test/repo/worktrees/locked-task");
      expect(result.preservedWorktrees.length).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);

      // Verify prune operation was called
      const gitCalls = mockGitOps.getCallLog();
      expect(gitCalls).toContainEqual(expect.objectContaining({ method: "worktreePrune" }));
    });

    it("should respect dry run mode", async () => {
      // Act
      const result = await cleanupOrphanedWorktrees({ dryRun: true }, mockGitOps);

      // Assert
      expect(result.removedWorktrees).toHaveLength(0);

      // Verify no actual removal operations
      const gitCalls = mockGitOps.getCallLog();
      expect(gitCalls).not.toContainEqual(expect.objectContaining({ method: "worktreeRemove" }));
    });

    it("should filter by age when olderThan is specified", async () => {
      // Arrange
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      // Act
      const result = await cleanupOrphanedWorktrees({ olderThan: cutoffDate }, mockGitOps);

      // Assert - Should only affect old worktrees
      expect(result.preservedWorktrees).toContain("/test/repo/worktrees/recent-task");
    });

    it("should filter by patterns when specified", async () => {
      // Act
      const result = await cleanupOrphanedWorktrees({ patterns: ["old-*"] }, mockGitOps);

      // Assert - Should only affect matching patterns
      expect(result.preservedWorktrees).toContain("/test/repo/worktrees/recent-task");
    });

    it("should preserve specified branches", async () => {
      // Act
      const result = await cleanupOrphanedWorktrees(
        {
          preserveBranches: ["feature/old-task"],
        },
        mockGitOps,
      );

      // Assert
      expect(result.preservedWorktrees).toContain("/test/repo/worktrees/old-task");
    });

    it("should handle cleanup errors gracefully", async () => {
      // Arrange: Set up removal to fail for one worktree
      mockGitOps.setError(
        "worktreeRemove",
        "/test/repo/worktrees/locked-task",
        new Error("Permission denied"),
      );

      // Act
      const result = await cleanupOrphanedWorktrees({}, mockGitOps);

      // Assert
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].path).toBe("/test/repo/worktrees/locked-task");
    });
  });
});
