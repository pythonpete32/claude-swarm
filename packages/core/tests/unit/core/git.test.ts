/**
 * Unit tests for core Git module
 *
 * Tests all Git operations with mocked command execution
 * to ensure isolation and deterministic results.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type FileSystemInterface,
  type GitCommandExecutor,
  type GitContext,
  GitUtils,
  checkWorkingTreeClean,
  createBranch,
  getCurrentBranch,
  getDiff,
  getRemoteInfo,
  parseRemoteUrl,
  validateRepository,
} from "../../../src/core/git";
import { ERROR_CODES, ErrorFactory } from "../../../src/shared/errors";
import type { ProcessResult } from "../../../src/shared/types";

// Mock the fs module at the top level with auto mock
vi.mock("node:fs/promises");

// Mock filesystem for testing
class MockFileSystem implements FileSystemInterface {
  private shouldThrow: Error | null = null;

  setShouldThrow(error: Error | null): void {
    this.shouldThrow = error;
  }

  async access(_path: string): Promise<void> {
    if (this.shouldThrow) {
      throw this.shouldThrow;
    }
    // Success case - just return
    return Promise.resolve();
  }

  reset(): void {
    this.shouldThrow = null;
  }
}

// Mock executor for testing
class MockGitExecutor implements GitCommandExecutor {
  private responses = new Map<string, ProcessResult[]>();
  private callCounts = new Map<string, number>();
  public executedCommands: Array<{ command: string[]; context: GitContext }> = [];

  setResponse(command: string, result: ProcessResult): void {
    const responses = this.responses.get(command) || [];
    responses.push(result);
    this.responses.set(command, responses);
  }

  setSequenceResponses(command: string, results: ProcessResult[]): void {
    this.responses.set(command, [...results]);
  }

  async execute(command: string[], context: GitContext): Promise<ProcessResult> {
    this.executedCommands.push({ command: [...command], context });

    const commandKey = command.join(" ");
    const responses = this.responses.get(commandKey);

    if (!responses || responses.length === 0) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `Mock: Command not configured: ${commandKey}`,
        command: commandKey,
        duration: 0,
      };
    }

    const callCount = this.callCounts.get(commandKey) || 0;
    this.callCounts.set(commandKey, callCount + 1);

    // Return the response at the call index, or the last one if we've exceeded
    const responseIndex = Math.min(callCount, responses.length - 1);
    return { ...responses[responseIndex] };
  }

  reset(): void {
    this.responses.clear();
    this.callCounts.clear();
    this.executedCommands = [];
  }
}

describe("core-git", () => {
  let mockExecutor: MockGitExecutor;
  let mockFileSystem: MockFileSystem;
  const testRepoPath = "/test/repo";

  beforeEach(async () => {
    mockExecutor = new MockGitExecutor();
    mockFileSystem = new MockFileSystem();
    vi.clearAllMocks();
  });

  describe("validateRepository", () => {
    it("should validate existing git repository", async () => {
      // Setup mocks
      mockExecutor.setResponse("git rev-parse --git-dir", {
        exitCode: 0,
        stdout: ".git",
        stderr: "",
        command: "git rev-parse --git-dir",
        duration: 10,
      });

      mockExecutor.setResponse("git rev-parse --abbrev-ref HEAD", {
        exitCode: 0,
        stdout: "main",
        stderr: "",
        command: "git rev-parse --abbrev-ref HEAD",
        duration: 10,
      });

      mockExecutor.setResponse("git rev-parse HEAD", {
        exitCode: 0,
        stdout: "abc123def456",
        stderr: "",
        command: "git rev-parse HEAD",
        duration: 10,
      });

      mockExecutor.setResponse("git status --porcelain", {
        exitCode: 0,
        stdout: "",
        stderr: "",
        command: "git status --porcelain",
        duration: 10,
      });

      mockExecutor.setResponse("git remote -v", {
        exitCode: 0,
        stdout:
          "origin\tgit@github.com:owner/repo.git (fetch)\norigin\tgit@github.com:owner/repo.git (push)",
        stderr: "",
        command: "git remote -v",
        duration: 10,
      });

      mockExecutor.setResponse("git symbolic-ref refs/remotes/origin/HEAD", {
        exitCode: 0,
        stdout: "refs/remotes/origin/main",
        stderr: "",
        command: "git symbolic-ref refs/remotes/origin/HEAD",
        duration: 10,
      });

      const result = await validateRepository(testRepoPath, mockExecutor, mockFileSystem);

      expect(result.isValid).toBe(true);
      expect(result.isClean).toBe(true);
      expect(result.currentBranch).toBe("main");
      expect(result.headCommit).toBe("abc123def456");
      expect(result.owner).toBe("owner");
      expect(result.name).toBe("repo");
      expect(result.path).toBe(testRepoPath);
      expect(result.defaultBranch).toBe("main");
    });

    it("should throw GIT_REPOSITORY_INVALID for invalid git repository", async () => {
      mockExecutor.setResponse("git rev-parse --git-dir", {
        exitCode: 128,
        stdout: "",
        stderr: "fatal: not a git repository",
        command: "git rev-parse --git-dir",
        duration: 10,
      });

      await expect(validateRepository(testRepoPath, mockExecutor, mockFileSystem)).rejects.toThrow(
        "Directory is not a git repository",
      );
    });

    it("should handle permission errors gracefully", async () => {
      // Mock filesystem to throw EACCES error (not ENOENT)
      const accessError = new Error("EACCES: permission denied, access '/test/repo'");
      (accessError as NodeJS.ErrnoException).code = "EACCES";
      mockFileSystem.setShouldThrow(accessError);

      await expect(validateRepository(testRepoPath, mockExecutor, mockFileSystem)).rejects.toThrow(
        "Failed to validate repository",
      );
    });

    it("should throw GIT_REPOSITORY_NOT_FOUND for non-existent directory", async () => {
      // Mock filesystem to throw ENOENT error
      const enoentError = new Error("ENOENT: no such file or directory, access '/test/repo'");
      (enoentError as NodeJS.ErrnoException).code = "ENOENT";
      mockFileSystem.setShouldThrow(enoentError);

      await expect(validateRepository(testRepoPath, mockExecutor, mockFileSystem)).rejects.toThrow(
        "Repository directory not found",
      );
    });

    it("should validate input path", async () => {
      await expect(validateRepository("", mockExecutor, mockFileSystem)).rejects.toThrow(
        "Path cannot be empty",
      );

      await expect(
        validateRepository("../../../etc", mockExecutor, mockFileSystem),
      ).rejects.toThrow("validation failed");
    });
  });

  describe("getCurrentBranch", () => {
    it("should get current branch information", async () => {
      mockExecutor.setResponse("git rev-parse --abbrev-ref HEAD", {
        exitCode: 0,
        stdout: "feature/test",
        stderr: "",
        command: "git rev-parse --abbrev-ref HEAD",
        duration: 10,
      });

      mockExecutor.setResponse("git rev-parse HEAD", {
        exitCode: 0,
        stdout: "def456abc123",
        stderr: "",
        command: "git rev-parse HEAD",
        duration: 10,
      });

      mockExecutor.setResponse("git symbolic-ref refs/remotes/origin/HEAD", {
        exitCode: 0,
        stdout: "refs/remotes/origin/main",
        stderr: "",
        command: "git symbolic-ref refs/remotes/origin/HEAD",
        duration: 10,
      });

      mockExecutor.setResponse("git show-ref --verify refs/heads/feature/test", {
        exitCode: 0,
        stdout: "def456abc123 refs/heads/feature/test",
        stderr: "",
        command: "git show-ref --verify refs/heads/feature/test",
        duration: 10,
      });

      mockExecutor.setResponse("git show-ref --verify refs/remotes/origin/feature/test", {
        exitCode: 0,
        stdout: "def456abc123 refs/remotes/origin/feature/test",
        stderr: "",
        command: "git show-ref --verify refs/remotes/origin/feature/test",
        duration: 10,
      });

      mockExecutor.setResponse("git rev-parse --abbrev-ref feature/test@{upstream}", {
        exitCode: 0,
        stdout: "origin/feature/test",
        stderr: "",
        command: "git rev-parse --abbrev-ref feature/test@{upstream}",
        duration: 10,
      });

      mockExecutor.setResponse("git status --porcelain", {
        exitCode: 0,
        stdout: "",
        stderr: "",
        command: "git status --porcelain",
        duration: 10,
      });

      const result = await getCurrentBranch(testRepoPath, mockExecutor);

      expect(result.name).toBe("feature/test");
      expect(result.commit).toBe("def456abc123");
      expect(result.isDefault).toBe(false);
      expect(result.isLocal).toBe(true);
      expect(result.isRemote).toBe(true);
      expect(result.upstream).toBe("origin/feature/test");
      expect(result.isClean).toBe(true);
    });

    it("should handle branch without upstream", async () => {
      mockExecutor.setResponse("git rev-parse --abbrev-ref HEAD", {
        exitCode: 0,
        stdout: "local-branch",
        stderr: "",
        command: "git rev-parse --abbrev-ref HEAD",
        duration: 10,
      });

      mockExecutor.setResponse("git rev-parse HEAD", {
        exitCode: 0,
        stdout: "abc123def456",
        stderr: "",
        command: "git rev-parse HEAD",
        duration: 10,
      });

      mockExecutor.setResponse("git symbolic-ref refs/remotes/origin/HEAD", {
        exitCode: 128,
        stdout: "",
        stderr: "fatal: ref refs/remotes/origin/HEAD is not a symbolic ref",
        command: "git symbolic-ref refs/remotes/origin/HEAD",
        duration: 10,
      });

      mockExecutor.setResponse("git show-ref --verify refs/heads/local-branch", {
        exitCode: 0,
        stdout: "abc123def456 refs/heads/local-branch",
        stderr: "",
        command: "git show-ref --verify refs/heads/local-branch",
        duration: 10,
      });

      mockExecutor.setResponse("git show-ref --verify refs/remotes/origin/local-branch", {
        exitCode: 1,
        stdout: "",
        stderr: "",
        command: "git show-ref --verify refs/remotes/origin/local-branch",
        duration: 10,
      });

      mockExecutor.setResponse("git rev-parse --abbrev-ref local-branch@{upstream}", {
        exitCode: 128,
        stdout: "",
        stderr: "fatal: no upstream configured for branch 'local-branch'",
        command: "git rev-parse --abbrev-ref local-branch@{upstream}",
        duration: 10,
      });

      mockExecutor.setResponse("git status --porcelain", {
        exitCode: 0,
        stdout: " M file.txt",
        stderr: "",
        command: "git status --porcelain",
        duration: 10,
      });

      const result = await getCurrentBranch(testRepoPath, mockExecutor);

      expect(result.name).toBe("local-branch");
      expect(result.isLocal).toBe(true);
      expect(result.isRemote).toBe(false);
      expect(result.upstream).toBeUndefined();
      expect(result.isClean).toBe(false);
    });

    it("should throw error when git command fails", async () => {
      mockExecutor.setResponse("git rev-parse --abbrev-ref HEAD", {
        exitCode: 128,
        stdout: "",
        stderr: "fatal: not a git repository",
        command: "git rev-parse --abbrev-ref HEAD",
        duration: 10,
      });

      await expect(getCurrentBranch(testRepoPath, mockExecutor)).rejects.toThrow(
        "Failed to get current branch",
      );
    });
  });

  describe("parseRemoteUrl", () => {
    it("should parse HTTPS GitHub URLs correctly", () => {
      const result = parseRemoteUrl("https://github.com/owner/repo.git");
      expect(result).toEqual({ owner: "owner", name: "repo" });
    });

    it("should parse HTTPS URLs without .git suffix", () => {
      const result = parseRemoteUrl("https://github.com/owner/repo");
      expect(result).toEqual({ owner: "owner", name: "repo" });
    });

    it("should parse SSH GitHub URLs correctly", () => {
      const result = parseRemoteUrl("git@github.com:owner/repo.git");
      expect(result).toEqual({ owner: "owner", name: "repo" });
    });

    it("should parse SSH URLs without .git suffix", () => {
      const result = parseRemoteUrl("git@github.com:owner/repo");
      expect(result).toEqual({ owner: "owner", name: "repo" });
    });

    it("should parse git:// URLs correctly", () => {
      const result = parseRemoteUrl("git://github.com/owner/repo.git");
      expect(result).toEqual({ owner: "owner", name: "repo" });
    });

    it("should throw GIT_REMOTE_ERROR for invalid URLs", () => {
      expect(() => parseRemoteUrl("not-a-url")).toThrow("Invalid remote URL format");

      expect(() => parseRemoteUrl("")).toThrow("Invalid remote URL format");

      expect(() => parseRemoteUrl("invalid://url")).toThrow("Invalid remote URL format");
    });

    it("should return null for non-GitHub URLs", () => {
      const result = parseRemoteUrl("https://bitbucket.org/owner/repo.git");
      expect(result).toBeNull();
    });
  });

  describe("createBranch", () => {
    it("should create and checkout new branch", async () => {
      // Set sequence responses for git show-ref command (first fails, then succeeds)
      mockExecutor.setSequenceResponses("git show-ref --verify refs/heads/new-feature", [
        {
          exitCode: 1,
          stdout: "",
          stderr: "",
          command: "git show-ref --verify refs/heads/new-feature",
          duration: 10,
        },
        {
          exitCode: 0,
          stdout: "abc123def456 refs/heads/new-feature",
          stderr: "",
          command: "git show-ref --verify refs/heads/new-feature",
          duration: 10,
        },
      ]);

      // Create branch
      mockExecutor.setResponse("git checkout -b new-feature", {
        exitCode: 0,
        stdout: "Switched to a new branch 'new-feature'",
        stderr: "",
        command: "git checkout -b new-feature",
        duration: 10,
      });

      // Mock getCurrentBranch response
      mockExecutor.setResponse("git rev-parse --abbrev-ref HEAD", {
        exitCode: 0,
        stdout: "new-feature",
        stderr: "",
        command: "git rev-parse --abbrev-ref HEAD",
        duration: 10,
      });

      mockExecutor.setResponse("git rev-parse HEAD", {
        exitCode: 0,
        stdout: "abc123def456",
        stderr: "",
        command: "git rev-parse HEAD",
        duration: 10,
      });

      mockExecutor.setResponse("git symbolic-ref refs/remotes/origin/HEAD", {
        exitCode: 0,
        stdout: "refs/remotes/origin/main",
        stderr: "",
        command: "git symbolic-ref refs/remotes/origin/HEAD",
        duration: 10,
      });

      mockExecutor.setResponse("git show-ref --verify refs/remotes/origin/new-feature", {
        exitCode: 1,
        stdout: "",
        stderr: "",
        command: "git show-ref --verify refs/remotes/origin/new-feature",
        duration: 10,
      });

      mockExecutor.setResponse("git rev-parse --abbrev-ref new-feature@{upstream}", {
        exitCode: 128,
        stdout: "",
        stderr: "fatal: no upstream configured for branch 'new-feature'",
        command: "git rev-parse --abbrev-ref new-feature@{upstream}",
        duration: 10,
      });

      mockExecutor.setResponse("git status --porcelain", {
        exitCode: 0,
        stdout: "",
        stderr: "",
        command: "git status --porcelain",
        duration: 10,
      });

      const result = await createBranch("new-feature", testRepoPath, {}, mockExecutor);

      expect(result.name).toBe("new-feature");
      expect(result.isLocal).toBe(true);
      expect(result.isRemote).toBe(false);
    });

    it("should create branch without checkout", async () => {
      mockExecutor.setResponse("git show-ref --verify refs/heads/feature-branch", {
        exitCode: 1,
        stdout: "",
        stderr: "",
        command: "git show-ref --verify refs/heads/feature-branch",
        duration: 10,
      });

      mockExecutor.setResponse("git branch feature-branch", {
        exitCode: 0,
        stdout: "",
        stderr: "",
        command: "git branch feature-branch",
        duration: 10,
      });

      // Mock getCurrentBranch (should return original branch since we didn't checkout)
      mockExecutor.setResponse("git rev-parse --abbrev-ref HEAD", {
        exitCode: 0,
        stdout: "main",
        stderr: "",
        command: "git rev-parse --abbrev-ref HEAD",
        duration: 10,
      });

      mockExecutor.setResponse("git rev-parse HEAD", {
        exitCode: 0,
        stdout: "abc123def456",
        stderr: "",
        command: "git rev-parse HEAD",
        duration: 10,
      });

      mockExecutor.setResponse("git symbolic-ref refs/remotes/origin/HEAD", {
        exitCode: 0,
        stdout: "refs/remotes/origin/main",
        stderr: "",
        command: "git symbolic-ref refs/remotes/origin/HEAD",
        duration: 10,
      });

      mockExecutor.setResponse("git show-ref --verify refs/heads/main", {
        exitCode: 0,
        stdout: "abc123def456 refs/heads/main",
        stderr: "",
        command: "git show-ref --verify refs/heads/main",
        duration: 10,
      });

      mockExecutor.setResponse("git show-ref --verify refs/remotes/origin/main", {
        exitCode: 0,
        stdout: "abc123def456 refs/remotes/origin/main",
        stderr: "",
        command: "git show-ref --verify refs/remotes/origin/main",
        duration: 10,
      });

      mockExecutor.setResponse("git rev-parse --abbrev-ref main@{upstream}", {
        exitCode: 0,
        stdout: "origin/main",
        stderr: "",
        command: "git rev-parse --abbrev-ref main@{upstream}",
        duration: 10,
      });

      mockExecutor.setResponse("git status --porcelain", {
        exitCode: 0,
        stdout: "",
        stderr: "",
        command: "git status --porcelain",
        duration: 10,
      });

      await createBranch("feature-branch", testRepoPath, { checkout: false }, mockExecutor);

      const createCommand = mockExecutor.executedCommands.find(
        (cmd) => cmd.command.includes("branch") && cmd.command.includes("feature-branch"),
      );
      expect(createCommand?.command).toEqual(["git", "branch", "feature-branch"]);
    });

    it("should create branch from base branch", async () => {
      // Set sequence responses for git show-ref command (first fails, then succeeds)
      mockExecutor.setSequenceResponses("git show-ref --verify refs/heads/hotfix", [
        {
          exitCode: 1,
          stdout: "",
          stderr: "",
          command: "git show-ref --verify refs/heads/hotfix",
          duration: 10,
        },
        {
          exitCode: 0,
          stdout: "def456abc123 refs/heads/hotfix",
          stderr: "",
          command: "git show-ref --verify refs/heads/hotfix",
          duration: 10,
        },
      ]);

      mockExecutor.setResponse("git checkout -b hotfix develop", {
        exitCode: 0,
        stdout: "Switched to a new branch 'hotfix'",
        stderr: "",
        command: "git checkout -b hotfix develop",
        duration: 10,
      });

      // Mock getCurrentBranch response
      mockExecutor.setResponse("git rev-parse --abbrev-ref HEAD", {
        exitCode: 0,
        stdout: "hotfix",
        stderr: "",
        command: "git rev-parse --abbrev-ref HEAD",
        duration: 10,
      });

      mockExecutor.setResponse("git rev-parse HEAD", {
        exitCode: 0,
        stdout: "def456abc123",
        stderr: "",
        command: "git rev-parse HEAD",
        duration: 10,
      });

      mockExecutor.setResponse("git symbolic-ref refs/remotes/origin/HEAD", {
        exitCode: 0,
        stdout: "refs/remotes/origin/main",
        stderr: "",
        command: "git symbolic-ref refs/remotes/origin/HEAD",
        duration: 10,
      });

      mockExecutor.setResponse("git show-ref --verify refs/remotes/origin/hotfix", {
        exitCode: 1,
        stdout: "",
        stderr: "",
        command: "git show-ref --verify refs/remotes/origin/hotfix",
        duration: 10,
      });

      mockExecutor.setResponse("git rev-parse --abbrev-ref hotfix@{upstream}", {
        exitCode: 128,
        stdout: "",
        stderr: "fatal: no upstream configured for branch 'hotfix'",
        command: "git rev-parse --abbrev-ref hotfix@{upstream}",
        duration: 10,
      });

      mockExecutor.setResponse("git status --porcelain", {
        exitCode: 0,
        stdout: "",
        stderr: "",
        command: "git status --porcelain",
        duration: 10,
      });

      await createBranch("hotfix", testRepoPath, { baseBranch: "develop" }, mockExecutor);

      const createCommand = mockExecutor.executedCommands.find(
        (cmd) => cmd.command.includes("checkout") && cmd.command.includes("hotfix"),
      );
      expect(createCommand?.command).toEqual(["git", "checkout", "-b", "hotfix", "develop"]);
    });

    it("should throw error if branch already exists", async () => {
      mockExecutor.setResponse("git show-ref --verify refs/heads/existing-branch", {
        exitCode: 0,
        stdout: "abc123def456 refs/heads/existing-branch",
        stderr: "",
        command: "git show-ref --verify refs/heads/existing-branch",
        duration: 10,
      });

      await expect(createBranch("existing-branch", testRepoPath, {}, mockExecutor)).rejects.toThrow(
        "Branch already exists",
      );
    });

    it("should validate branch name", async () => {
      await expect(createBranch("", testRepoPath, {}, mockExecutor)).rejects.toThrow(
        "Branch name cannot be empty",
      );

      await expect(createBranch("invalid..branch", testRepoPath, {}, mockExecutor)).rejects.toThrow(
        "Branch name contains invalid characters",
      );
    });

    it("should throw error when git command fails", async () => {
      mockExecutor.setResponse("git show-ref --verify refs/heads/test-branch", {
        exitCode: 1,
        stdout: "",
        stderr: "",
        command: "git show-ref --verify refs/heads/test-branch",
        duration: 10,
      });

      mockExecutor.setResponse("git checkout -b test-branch", {
        exitCode: 128,
        stdout: "",
        stderr: "fatal: cannot create branch",
        command: "git checkout -b test-branch",
        duration: 10,
      });

      await expect(createBranch("test-branch", testRepoPath, {}, mockExecutor)).rejects.toThrow(
        "Failed to create branch",
      );
    });
  });

  describe("getDiff", () => {
    it("should get diff between branches", async () => {
      mockExecutor.setResponse("git diff --stat --no-color main...feature", {
        exitCode: 0,
        stdout:
          " file1.ts | 10 ++++++++++\n file2.ts |  5 +++--\n 2 files changed, 13 insertions(+), 2 deletions(-)",
        stderr: "",
        command: "git diff --stat --no-color main...feature",
        duration: 10,
      });

      mockExecutor.setResponse("git diff --numstat --no-color main...feature", {
        exitCode: 0,
        stdout: "8\t2\tfile1.ts\n5\t0\tfile2.ts",
        stderr: "",
        command: "git diff --numstat --no-color main...feature",
        duration: 10,
      });

      const result = await getDiff(testRepoPath, "main", "feature", mockExecutor);

      expect(result.commit).toBe("feature");
      expect(result.changedFiles).toHaveLength(2);
      expect(result.changedFiles[0]).toEqual({
        path: "file1.ts",
        status: "modified",
        insertions: 8,
        deletions: 2,
      });
      expect(result.changedFiles[1]).toEqual({
        path: "file2.ts",
        status: "added",
        insertions: 5,
        deletions: 0,
      });
      expect(result.insertions).toBe(13);
      expect(result.deletions).toBe(2);
    });

    it("should get diff for single commit", async () => {
      mockExecutor.setResponse("git diff --stat --no-color abc123", {
        exitCode: 0,
        stdout: " README.md | 1 +\n 1 file changed, 1 insertion(+)",
        stderr: "",
        command: "git diff --stat --no-color abc123",
        duration: 10,
      });

      mockExecutor.setResponse("git diff --numstat --no-color abc123", {
        exitCode: 0,
        stdout: "1\t0\tREADME.md",
        stderr: "",
        command: "git diff --numstat --no-color abc123",
        duration: 10,
      });

      const result = await getDiff(testRepoPath, "abc123", undefined, mockExecutor);

      expect(result.commit).toBeUndefined();
      expect(result.changedFiles).toHaveLength(1);
      expect(result.insertions).toBe(1);
      expect(result.deletions).toBe(0);
    });

    it("should handle no changes", async () => {
      mockExecutor.setResponse("git diff --stat --no-color main...feature", {
        exitCode: 0,
        stdout: "",
        stderr: "",
        command: "git diff --stat --no-color main...feature",
        duration: 10,
      });

      mockExecutor.setResponse("git diff --numstat --no-color main...feature", {
        exitCode: 0,
        stdout: "",
        stderr: "",
        command: "git diff --numstat --no-color main...feature",
        duration: 10,
      });

      const result = await getDiff(testRepoPath, "main", "feature", mockExecutor);

      expect(result.changedFiles).toHaveLength(0);
      expect(result.insertions).toBe(0);
      expect(result.deletions).toBe(0);
      expect(result.summary).toBe("0 files changed");
    });

    it("should handle deleted files", async () => {
      mockExecutor.setResponse("git diff --stat --no-color main...cleanup", {
        exitCode: 0,
        stdout:
          " old-file.js | 50 --------------------------------------------------\n 1 file changed, 50 deletions(-)",
        stderr: "",
        command: "git diff --stat --no-color main...cleanup",
        duration: 10,
      });

      mockExecutor.setResponse("git diff --numstat --no-color main...cleanup", {
        exitCode: 0,
        stdout: "0\t50\told-file.js",
        stderr: "",
        command: "git diff --numstat --no-color main...cleanup",
        duration: 10,
      });

      const result = await getDiff(testRepoPath, "main", "cleanup", mockExecutor);

      expect(result.changedFiles[0]).toEqual({
        path: "old-file.js",
        status: "deleted",
        insertions: 0,
        deletions: 50,
      });
    });

    it("should throw error when git command fails", async () => {
      mockExecutor.setResponse("git diff --stat --no-color invalid...branch", {
        exitCode: 128,
        stdout: "",
        stderr: "fatal: bad revision 'invalid...branch'",
        command: "git diff --stat --no-color invalid...branch",
        duration: 10,
      });

      await expect(getDiff(testRepoPath, "invalid", "branch", mockExecutor)).rejects.toThrow(
        "Failed to get diff statistics",
      );
    });
  });

  describe("getRemoteInfo", () => {
    it("should get remote information", async () => {
      mockExecutor.setResponse("git remote -v", {
        exitCode: 0,
        stdout:
          "origin\tgit@github.com:owner/repo.git (fetch)\norigin\tgit@github.com:owner/repo.git (push)\nupstream\thttps://github.com/upstream/repo.git (fetch)\nupstream\thttps://github.com/upstream/repo.git (push)",
        stderr: "",
        command: "git remote -v",
        duration: 10,
      });

      const result = await getRemoteInfo(testRepoPath, mockExecutor);

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({
        name: "origin",
        url: "git@github.com:owner/repo.git",
        type: "fetch",
      });
      expect(result[1]).toEqual({
        name: "origin",
        url: "git@github.com:owner/repo.git",
        type: "push",
      });
      expect(result[2]).toEqual({
        name: "upstream",
        url: "https://github.com/upstream/repo.git",
        type: "fetch",
      });
      expect(result[3]).toEqual({
        name: "upstream",
        url: "https://github.com/upstream/repo.git",
        type: "push",
      });
    });

    it("should handle no remotes", async () => {
      mockExecutor.setResponse("git remote -v", {
        exitCode: 0,
        stdout: "",
        stderr: "",
        command: "git remote -v",
        duration: 10,
      });

      const result = await getRemoteInfo(testRepoPath, mockExecutor);

      expect(result).toHaveLength(0);
    });

    it("should throw error when git command fails", async () => {
      mockExecutor.setResponse("git remote -v", {
        exitCode: 128,
        stdout: "",
        stderr: "fatal: not a git repository",
        command: "git remote -v",
        duration: 10,
      });

      await expect(getRemoteInfo(testRepoPath, mockExecutor)).rejects.toThrow(
        "Failed to get remote information",
      );
    });
  });

  describe("checkWorkingTreeClean", () => {
    it("should return true for clean working tree", async () => {
      mockExecutor.setResponse("git status --porcelain", {
        exitCode: 0,
        stdout: "",
        stderr: "",
        command: "git status --porcelain",
        duration: 10,
      });

      const result = await checkWorkingTreeClean(testRepoPath, mockExecutor);

      expect(result).toBe(true);
    });

    it("should return false for dirty working tree", async () => {
      mockExecutor.setResponse("git status --porcelain", {
        exitCode: 0,
        stdout: " M file.ts\n?? new-file.ts",
        stderr: "",
        command: "git status --porcelain",
        duration: 10,
      });

      const result = await checkWorkingTreeClean(testRepoPath, mockExecutor);

      expect(result).toBe(false);
    });

    it("should throw error when git command fails", async () => {
      mockExecutor.setResponse("git status --porcelain", {
        exitCode: 128,
        stdout: "",
        stderr: "fatal: not a git repository",
        command: "git status --porcelain",
        duration: 10,
      });

      await expect(checkWorkingTreeClean(testRepoPath, mockExecutor)).rejects.toThrow(
        "Failed to check working tree status",
      );
    });
  });

  describe("GitUtils", () => {
    it("should create context with validation", () => {
      const context = GitUtils.createContext(testRepoPath, { timeout: 5000 });

      expect(context.repositoryPath).toBe(testRepoPath);
      expect(context.timeout).toBe(5000);
      expect(context.silent).toBe(false);
    });

    it("should use default timeout and silent values", () => {
      const context = GitUtils.createContext(testRepoPath);

      expect(context.timeout).toBe(30000);
      expect(context.silent).toBe(false);
    });

    it("should validate repository path", () => {
      expect(() => GitUtils.createContext("")).toThrow("Path cannot be empty");
    });

    it("should sanitize git references", () => {
      expect(GitUtils.sanitizeRef("feature/test")).toBe("feature/test");
      expect(GitUtils.sanitizeRef("invalid..name")).toBe("invalid.name");
      expect(GitUtils.sanitizeRef("bad@{ref}")).toBe("bad-ref-");
    });

    it("should identify commit SHAs", () => {
      expect(GitUtils.isCommitSha("abc123def456")).toBe(true);
      expect(GitUtils.isCommitSha("1234567890abcdef1234567890abcdef12345678")).toBe(true);
      expect(GitUtils.isCommitSha("short")).toBe(false);
      expect(GitUtils.isCommitSha("not-a-sha")).toBe(false);
      expect(GitUtils.isCommitSha("")).toBe(false);
    });

    it("should build safe git commands", () => {
      const command = GitUtils.buildCommand("status", "--porcelain", "--no-color");
      expect(command).toEqual(["git", "status", "--porcelain", "--no-color"]);
    });

    it("should filter out empty arguments", () => {
      const command = GitUtils.buildCommand("log", "", "  ", "--oneline");
      expect(command).toEqual(["git", "log", "--oneline"]);
    });
  });

  describe("Error handling", () => {
    it("should use correct error codes", async () => {
      mockExecutor.setResponse("git rev-parse --git-dir", {
        exitCode: 128,
        stdout: "",
        stderr: "fatal: not a git repository",
        command: "git rev-parse --git-dir",
        duration: 10,
      });

      vi.doMock("node:fs/promises", () => ({
        access: vi.fn().mockResolvedValue(undefined),
      }));

      try {
        await validateRepository(testRepoPath, mockExecutor);
        expect(true).toBe(false); // Should not reach here
      } catch (error: unknown) {
        const swarmError = error as { code: string; module: string };
        expect(swarmError.code).toBe(ERROR_CODES.GIT_REPOSITORY_NOT_FOUND);
        expect(swarmError.module).toBe("git");
      }
    });

    it("should include context in error details", async () => {
      mockExecutor.setResponse("git rev-parse --abbrev-ref HEAD", {
        exitCode: 128,
        stdout: "",
        stderr: "fatal: not a git repository",
        command: "git rev-parse --abbrev-ref HEAD",
        duration: 10,
      });

      try {
        await getCurrentBranch(testRepoPath, mockExecutor);
        expect(true).toBe(false); // Should not reach here
      } catch (error: unknown) {
        const swarmError = error as { details: { command: string; output: string } };
        expect(swarmError.details.command).toBe("git rev-parse --abbrev-ref HEAD");
        expect(swarmError.details.output).toBe("fatal: not a git repository");
      }
    });

    it("should re-throw SwarmErrors without modification", async () => {
      const originalError = ErrorFactory.git(ERROR_CODES.GIT_COMMAND_FAILED, "Original error");

      mockExecutor.setResponse("git status --porcelain", {
        exitCode: 0,
        stdout: "",
        stderr: "",
        command: "git status --porcelain",
        duration: 10,
      });

      // Mock the executor to throw our original error
      mockExecutor.execute = vi.fn().mockRejectedValue(originalError);

      try {
        await checkWorkingTreeClean(testRepoPath, mockExecutor);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBe(originalError); // Should be the exact same error
      }
    });
  });
});
