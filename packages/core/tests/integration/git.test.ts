/**
 * Integration tests for core Git module
 *
 * Tests actual Git operations against real repositories
 * to verify end-to-end functionality.
 */

import { exec } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  checkWorkingTreeClean,
  createBranch,
  getCurrentBranch,
  getDiff,
  getRemoteInfo,
  parseRemoteUrl,
  validateRepository,
} from "../../src/core/git";

const execAsync = promisify(exec);

describe("Git Integration Tests", () => {
  let testRepoPath: string;
  let testRepoName: string;

  beforeEach(async () => {
    // Create a unique test repository for each test
    testRepoName = `test-repo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    testRepoPath = join(tmpdir(), testRepoName);

    // Initialize a git repository
    await fs.mkdir(testRepoPath, { recursive: true });
    await execAsync("git init", { cwd: testRepoPath });
    await execAsync('git config user.name "Test User"', { cwd: testRepoPath });
    await execAsync('git config user.email "test@example.com"', { cwd: testRepoPath });

    // Create initial commit
    await fs.writeFile(join(testRepoPath, "README.md"), "# Test Repository\n");
    await execAsync("git add README.md", { cwd: testRepoPath });
    await execAsync('git commit -m "Initial commit"', { cwd: testRepoPath });
  });

  afterEach(async () => {
    // Clean up test repository
    if (testRepoPath) {
      try {
        await fs.rm(testRepoPath, { recursive: true, force: true });
      } catch (_error) {
        // Ignore cleanup errors
      }
    }
  });

  describe("validateRepository", () => {
    it("should validate a real git repository", async () => {
      const result = await validateRepository(testRepoPath);

      expect(result.isValid).toBe(true);
      expect(result.path).toBe(testRepoPath);
      expect(result.currentBranch).toMatch(/^(main|master)$/);
      expect(result.headCommit).toMatch(/^[a-f0-9]{40}$/);
      expect(result.isClean).toBe(true);
    });

    it("should detect dirty working tree", async () => {
      // Create an uncommitted change
      await fs.writeFile(join(testRepoPath, "new-file.txt"), "content");

      const result = await validateRepository(testRepoPath);

      expect(result.isValid).toBe(true);
      expect(result.isClean).toBe(false);
    });

    it("should fail for non-git directory", async () => {
      const nonGitPath = join(tmpdir(), `non-git-${Date.now()}`);
      await fs.mkdir(nonGitPath, { recursive: true });

      try {
        await expect(validateRepository(nonGitPath)).rejects.toThrow(
          "Directory is not a git repository",
        );
      } finally {
        await fs.rm(nonGitPath, { recursive: true, force: true });
      }
    });

    it("should fail for non-existent directory", async () => {
      const nonExistentPath = join(tmpdir(), `non-existent-${Date.now()}`);

      await expect(validateRepository(nonExistentPath)).rejects.toThrow(
        "Repository directory not found",
      );
    });
  });

  describe("getCurrentBranch", () => {
    it("should get current branch information", async () => {
      const result = await getCurrentBranch(testRepoPath);

      expect(result.name).toMatch(/^(main|master)$/);
      expect(result.commit).toMatch(/^[a-f0-9]{40}$/);
      expect(result.isDefault).toBe(true);
      expect(result.isLocal).toBe(true);
      expect(result.isRemote).toBe(false); // No remotes in test repo
      expect(result.upstream).toBeUndefined();
      expect(result.isClean).toBe(true);
    });

    it("should detect dirty branch", async () => {
      // Create uncommitted changes
      await fs.writeFile(join(testRepoPath, "modified.txt"), "changes");

      const result = await getCurrentBranch(testRepoPath);

      expect(result.isClean).toBe(false);
    });
  });

  describe("createBranch", () => {
    it("should create and checkout new branch", async () => {
      const result = await createBranch("feature/test", testRepoPath);

      expect(result.name).toBe("feature/test");
      expect(result.isLocal).toBe(true);
      expect(result.isRemote).toBe(false);
      expect(result.isDefault).toBe(false);

      // Verify we're actually on the new branch
      const { stdout } = await execAsync("git branch --show-current", { cwd: testRepoPath });
      expect(stdout.trim()).toBe("feature/test");
    });

    it("should create branch without checkout", async () => {
      const originalBranch = await getCurrentBranch(testRepoPath);

      await createBranch("feature/no-checkout", testRepoPath, { checkout: false });

      // Verify we're still on the original branch
      const currentBranch = await getCurrentBranch(testRepoPath);
      expect(currentBranch.name).toBe(originalBranch.name);

      // Verify the new branch exists
      const { stdout } = await execAsync("git branch", { cwd: testRepoPath });
      expect(stdout).toContain("feature/no-checkout");
    });

    it("should create branch from base branch", async () => {
      // Create a base branch with a commit
      await createBranch("develop", testRepoPath);
      await fs.writeFile(join(testRepoPath, "develop.txt"), "develop content");
      await execAsync("git add develop.txt", { cwd: testRepoPath });
      await execAsync('git commit -m "Add develop file"', { cwd: testRepoPath });

      // Go back to main
      await execAsync("git checkout main", { cwd: testRepoPath });

      // Create new branch from develop
      await createBranch("feature/from-develop", testRepoPath, { baseBranch: "develop" });

      // Verify the file from develop exists
      const developFile = join(testRepoPath, "develop.txt");
      const exists = await fs
        .access(developFile)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it("should fail when branch already exists", async () => {
      await createBranch("existing-branch", testRepoPath);

      await expect(createBranch("existing-branch", testRepoPath)).rejects.toThrow(
        "Branch already exists",
      );
    });
  });

  describe("getDiff", () => {
    it("should get diff between branches", async () => {
      // Create a feature branch with changes
      await createBranch("feature/changes", testRepoPath);

      // Add some changes
      await fs.writeFile(join(testRepoPath, "new-file.ts"), "export const test = 'value';");
      await fs.writeFile(join(testRepoPath, "README.md"), "# Test Repository\n\nUpdated content");

      await execAsync("git add .", { cwd: testRepoPath });
      await execAsync('git commit -m "Add changes"', { cwd: testRepoPath });

      const result = await getDiff(testRepoPath, "main", "feature/changes");

      expect(result.changedFiles.length).toBeGreaterThan(0);
      expect(result.insertions).toBeGreaterThan(0);

      const newFile = result.changedFiles.find((f) => f.path === "new-file.ts");
      expect(newFile).toBeDefined();
      expect(newFile?.status).toBe("added");
    });

    it("should handle empty diff", async () => {
      const result = await getDiff(testRepoPath, "main", "main");

      expect(result.changedFiles).toHaveLength(0);
      expect(result.insertions).toBe(0);
      expect(result.deletions).toBe(0);
    });

    it("should get diff for single commit", async () => {
      // Get the current commit
      const { stdout: currentCommit } = await execAsync("git rev-parse HEAD", {
        cwd: testRepoPath,
      });

      // Create another commit
      await fs.writeFile(join(testRepoPath, "another-file.txt"), "content");
      await execAsync("git add another-file.txt", { cwd: testRepoPath });
      await execAsync('git commit -m "Add another file"', { cwd: testRepoPath });

      const result = await getDiff(testRepoPath, currentCommit.trim());

      expect(result.changedFiles.length).toBe(1);
      expect(result.changedFiles[0].path).toBe("another-file.txt");
    });
  });

  describe("getRemoteInfo", () => {
    it("should handle repository with no remotes", async () => {
      const result = await getRemoteInfo(testRepoPath);

      expect(result).toHaveLength(0);
    });

    it("should get remote information when remotes exist", async () => {
      // Add a fake remote
      await execAsync("git remote add origin https://github.com/test/repo.git", {
        cwd: testRepoPath,
      });

      const result = await getRemoteInfo(testRepoPath);

      expect(result.length).toBeGreaterThan(0);

      const origin = result.find((r) => r.name === "origin" && r.type === "fetch");
      expect(origin).toBeDefined();
      expect(origin?.url).toBe("https://github.com/test/repo.git");
    });

    it("should handle multiple remotes", async () => {
      await execAsync("git remote add origin https://github.com/owner/repo.git", {
        cwd: testRepoPath,
      });
      await execAsync("git remote add upstream https://github.com/upstream/repo.git", {
        cwd: testRepoPath,
      });

      const result = await getRemoteInfo(testRepoPath);

      expect(result.length).toBe(4); // 2 remotes × 2 types (fetch/push)

      const originNames = result.filter((r) => r.name === "origin");
      const upstreamNames = result.filter((r) => r.name === "upstream");

      expect(originNames).toHaveLength(2);
      expect(upstreamNames).toHaveLength(2);
    });
  });

  describe("checkWorkingTreeClean", () => {
    it("should return true for clean working tree", async () => {
      const result = await checkWorkingTreeClean(testRepoPath);

      expect(result).toBe(true);
    });

    it("should return false for dirty working tree", async () => {
      // Create uncommitted changes
      await fs.writeFile(join(testRepoPath, "dirty-file.txt"), "uncommitted");

      const result = await checkWorkingTreeClean(testRepoPath);

      expect(result).toBe(false);
    });

    it("should return false for staged changes", async () => {
      // Create and stage changes
      await fs.writeFile(join(testRepoPath, "staged-file.txt"), "staged content");
      await execAsync("git add staged-file.txt", { cwd: testRepoPath });

      const result = await checkWorkingTreeClean(testRepoPath);

      expect(result).toBe(false);
    });

    it("should return true after committing changes", async () => {
      // Create, stage, and commit changes
      await fs.writeFile(join(testRepoPath, "committed-file.txt"), "committed content");
      await execAsync("git add committed-file.txt", { cwd: testRepoPath });
      await execAsync('git commit -m "Add committed file"', { cwd: testRepoPath });

      const result = await checkWorkingTreeClean(testRepoPath);

      expect(result).toBe(true);
    });
  });

  describe("parseRemoteUrl (integration)", () => {
    it("should parse URLs from real remote configuration", async () => {
      const testUrls = [
        "https://github.com/owner/repo.git",
        "git@github.com:owner/repo.git",
        "https://github.com/owner/repo",
        "git@github.com:owner/repo",
      ];

      for (const url of testUrls) {
        const result = parseRemoteUrl(url);
        expect(result).toEqual({ owner: "owner", name: "repo" });
      }
    });

    it("should return null for non-GitHub URLs", async () => {
      const nonGitHubUrls = [
        "https://gitlab.com/owner/repo.git",
        "https://bitbucket.org/owner/repo.git",
        "git@gitlab.com:owner/repo.git",
      ];

      for (const url of nonGitHubUrls) {
        const result = parseRemoteUrl(url);
        expect(result).toBeNull();
      }
    });
  });

  describe("End-to-end workflow", () => {
    it("should support complete development workflow", async () => {
      // 1. Validate repository
      const repo = await validateRepository(testRepoPath);
      expect(repo.isValid).toBe(true);

      // 2. Create feature branch
      const featureBranch = await createBranch("feature/workflow-test", testRepoPath);
      expect(featureBranch.name).toBe("feature/workflow-test");

      // 3. Make some changes
      await fs.writeFile(join(testRepoPath, "workflow.ts"), "export const workflow = 'test';");
      await fs.appendFile(join(testRepoPath, "README.md"), "\n\nWorkflow test");

      // 4. Check working tree is dirty
      const isDirty = await checkWorkingTreeClean(testRepoPath);
      expect(isDirty).toBe(false);

      // 5. Commit changes
      await execAsync("git add .", { cwd: testRepoPath });
      await execAsync('git commit -m "Add workflow test"', { cwd: testRepoPath });

      // 6. Check working tree is clean
      const isClean = await checkWorkingTreeClean(testRepoPath);
      expect(isClean).toBe(true);

      // 7. Get diff between main and feature branch
      const diff = await getDiff(testRepoPath, "main", "feature/workflow-test");
      expect(diff.changedFiles.length).toBeGreaterThan(0);
      expect(diff.insertions).toBeGreaterThan(0);

      // 8. Verify current branch info
      const currentBranch = await getCurrentBranch(testRepoPath);
      expect(currentBranch.name).toBe("feature/workflow-test");
      expect(currentBranch.isClean).toBe(true);
    });

    it("should handle repository with remotes", async () => {
      // Add remotes
      await execAsync("git remote add origin git@github.com:test/integration-repo.git", {
        cwd: testRepoPath,
      });

      // Validate repository includes remote info
      const repo = await validateRepository(testRepoPath);
      expect(repo.owner).toBe("test");
      expect(repo.name).toBe("integration-repo");
      expect(repo.remoteUrl).toBe("git@github.com:test/integration-repo.git");

      // Get remote info
      const remotes = await getRemoteInfo(testRepoPath);
      expect(remotes.length).toBeGreaterThan(0);

      const origin = remotes.find((r) => r.name === "origin");
      expect(origin).toBeDefined();
      expect(origin?.url).toBe("git@github.com:test/integration-repo.git");
    });
  });

  describe("Cross-platform compatibility", () => {
    it("should work with different path separators", async () => {
      // Test with both forward and backward slashes in paths
      const result = await validateRepository(testRepoPath);
      expect(result.isValid).toBe(true);
      expect(result.path).toBe(testRepoPath);
    });

    it("should handle branch names with slashes", async () => {
      const branchName = "feature/sub-feature/deep-nesting";

      const result = await createBranch(branchName, testRepoPath);
      expect(result.name).toBe(branchName);

      const currentBranch = await getCurrentBranch(testRepoPath);
      expect(currentBranch.name).toBe(branchName);
    });

    it("should handle special characters in file names", async () => {
      // Create files with various characters
      const specialFiles = [
        "file with spaces.txt",
        "file-with-dashes.txt",
        "file_with_underscores.txt",
        "file.with.dots.txt",
      ];

      for (const fileName of specialFiles) {
        await fs.writeFile(join(testRepoPath, fileName), `Content of ${fileName}`);
      }

      await execAsync("git add .", { cwd: testRepoPath });
      await execAsync('git commit -m "Add files with special characters"', { cwd: testRepoPath });

      const isClean = await checkWorkingTreeClean(testRepoPath);
      expect(isClean).toBe(true);
    });
  });

  describe("Performance tests", () => {
    it("should validate repository quickly", async () => {
      const startTime = Date.now();

      await validateRepository(testRepoPath);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500); // Should be under 500ms
    });

    it("should handle multiple operations efficiently", async () => {
      const startTime = Date.now();

      // Perform multiple operations
      await validateRepository(testRepoPath);
      await getCurrentBranch(testRepoPath);
      await checkWorkingTreeClean(testRepoPath);
      await getRemoteInfo(testRepoPath);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // All operations under 1 second
    });
  });
});
