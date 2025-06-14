/**
 * Core Git Module for Claude Swarm
 *
 * Provides foundational git operations that all other core modules depend on.
 * Validates repository state, manages branches, parses remote URLs, and analyzes changes.
 */

import { exec } from "node:child_process";
import { promises as fs } from "node:fs";
import { promisify } from "node:util";

import { ERROR_CODES, ErrorFactory } from "@/shared/errors";
import type { GitBranchInfo, GitOptions, ProcessResult, RepositoryInfo } from "@/shared/types";
import { CommonValidators, GitValidation } from "@/shared/validation";

const execAsync = promisify(exec);

/**
 * Extended Git repository information with validation state
 */
export interface GitRepository extends RepositoryInfo {
  isValid: boolean;
  isClean: boolean;
  currentBranch: string;
  headCommit: string;
  remotes: GitRemote[];
}

/**
 * Git remote information
 */
export interface GitRemote {
  name: string;
  url: string;
  type: "fetch" | "push";
}

/**
 * Git diff information
 */
export interface GitDiff {
  commit?: string;
  changedFiles: GitFileChange[];
  insertions: number;
  deletions: number;
  summary: string;
}

/**
 * Git file change information
 */
export interface GitFileChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "copied";
  insertions: number;
  deletions: number;
  oldPath?: string; // For renamed files
}

/**
 * Git command execution context
 */
export interface GitContext {
  repositoryPath: string;
  timeout?: number;
  silent?: boolean;
}

/**
 * Interface for filesystem operations to enable dependency injection
 */
export interface FileSystemInterface {
  access(path: string): Promise<void>;
}

/**
 * Git command executor interface for dependency injection
 */
export interface GitCommandExecutor {
  execute(command: string[], context: GitContext): Promise<ProcessResult>;
}

/**
 * Default filesystem implementation
 */
class DefaultFileSystem implements FileSystemInterface {
  async access(path: string): Promise<void> {
    return fs.access(path);
  }
}

/**
 * Default Git command executor implementation
 */
class DefaultGitCommandExecutor implements GitCommandExecutor {
  async execute(command: string[], context: GitContext): Promise<ProcessResult> {
    const startTime = Date.now();
    const commandString = command.join(" ");

    try {
      const { stdout, stderr } = await execAsync(commandString, {
        cwd: context.repositoryPath,
        timeout: context.timeout || 30000,
        encoding: "utf8",
      });

      return {
        exitCode: 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        command: commandString,
        duration: Date.now() - startTime,
      };
    } catch (error: unknown) {
      const execError = error as {
        code?: number;
        stdout?: string;
        stderr?: string;
        message?: string;
      };

      return {
        exitCode: execError.code || 1,
        stdout: execError.stdout?.trim() || "",
        stderr: execError.stderr?.trim() || execError.message || "",
        command: commandString,
        duration: Date.now() - startTime,
      };
    }
  }
}

/**
 * Default Git command executor instance
 */
const defaultExecutor = new DefaultGitCommandExecutor();
const defaultFileSystem = new DefaultFileSystem();

/**
 * Validate that a directory is a valid Git repository
 */
export async function validateRepository(
  repositoryPath: string,
  executor: GitCommandExecutor = defaultExecutor,
  fileSystem: FileSystemInterface = defaultFileSystem,
): Promise<GitRepository> {
  // Validate input path
  CommonValidators.worktreePath().validateOrThrow(repositoryPath, "Repository path validation");

  const context: GitContext = { repositoryPath };

  try {
    // Check if directory exists
    await fileSystem.access(repositoryPath);

    // Check if it's a git repository
    const revParseResult = await executor.execute(["git", "rev-parse", "--git-dir"], context);
    if (revParseResult.exitCode !== 0) {
      throw ErrorFactory.git(
        ERROR_CODES.GIT_REPOSITORY_INVALID,
        `Directory is not a git repository: ${repositoryPath}`,
        { path: repositoryPath, output: revParseResult.stderr },
      );
    }

    // Get current branch
    const branchResult = await executor.execute(
      ["git", "rev-parse", "--abbrev-ref", "HEAD"],
      context,
    );
    if (branchResult.exitCode !== 0) {
      throw ErrorFactory.git(ERROR_CODES.GIT_COMMAND_FAILED, "Failed to get current branch", {
        command: "git rev-parse --abbrev-ref HEAD",
        output: branchResult.stderr,
      });
    }

    // Get head commit
    const headResult = await executor.execute(["git", "rev-parse", "HEAD"], context);
    if (headResult.exitCode !== 0) {
      throw ErrorFactory.git(ERROR_CODES.GIT_COMMAND_FAILED, "Failed to get HEAD commit", {
        command: "git rev-parse HEAD",
        output: headResult.stderr,
      });
    }

    // Check working tree status
    const statusResult = await executor.execute(["git", "status", "--porcelain"], context);
    const isClean = statusResult.exitCode === 0 && statusResult.stdout === "";

    // Get remote information
    const remotes = await getRemoteInfo(repositoryPath, executor);
    const defaultRemote = remotes.find((r) => r.name === "origin") || remotes[0];

    // Parse remote URL if available
    let owner = "";
    let name = "";
    let remoteUrl = "";

    if (defaultRemote) {
      remoteUrl = defaultRemote.url;
      const remoteInfo = parseRemoteUrl(remoteUrl);
      if (remoteInfo) {
        owner = remoteInfo.owner;
        name = remoteInfo.name;
      }
    }

    // Get default branch (try origin/HEAD first, fallback to main/master)
    let defaultBranch = "main";
    const headRefResult = await executor.execute(
      ["git", "symbolic-ref", "refs/remotes/origin/HEAD"],
      context,
    );
    if (headRefResult.exitCode === 0) {
      defaultBranch = headRefResult.stdout.replace("refs/remotes/origin/", "");
    }

    return {
      owner,
      name,
      path: repositoryPath,
      defaultBranch,
      remoteUrl,
      isValid: true,
      isClean,
      currentBranch: branchResult.stdout,
      headCommit: headResult.stdout,
      remotes,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("ENOENT")) {
      throw ErrorFactory.git(
        ERROR_CODES.GIT_REPOSITORY_NOT_FOUND,
        `Repository directory not found: ${repositoryPath}`,
        { path: repositoryPath },
      );
    }

    if (error instanceof Error && error.message.includes("EACCES")) {
      throw ErrorFactory.git(
        ERROR_CODES.GIT_REPOSITORY_NOT_FOUND,
        `Failed to validate repository: ${error.message}`,
        { path: repositoryPath, originalError: error },
      );
    }

    // Re-throw SwarmErrors as-is
    if (error && typeof error === "object" && "code" in error) {
      throw error;
    }

    throw ErrorFactory.git(
      ERROR_CODES.GIT_REPOSITORY_NOT_FOUND,
      `Failed to validate repository: ${error instanceof Error ? error.message : String(error)}`,
      { path: repositoryPath, originalError: error },
    );
  }
}

/**
 * Get current branch information
 */
export async function getCurrentBranch(
  repositoryPath: string,
  executor: GitCommandExecutor = defaultExecutor,
): Promise<GitBranchInfo> {
  CommonValidators.worktreePath().validateOrThrow(repositoryPath, "Repository path validation");

  const context: GitContext = { repositoryPath };

  try {
    // Get current branch name
    const branchResult = await executor.execute(
      ["git", "rev-parse", "--abbrev-ref", "HEAD"],
      context,
    );
    if (branchResult.exitCode !== 0) {
      throw ErrorFactory.git(ERROR_CODES.GIT_COMMAND_FAILED, "Failed to get current branch", {
        command: "git rev-parse --abbrev-ref HEAD",
        output: branchResult.stderr,
      });
    }

    const branchName = branchResult.stdout;

    // Get current commit
    const commitResult = await executor.execute(["git", "rev-parse", "HEAD"], context);
    if (commitResult.exitCode !== 0) {
      throw ErrorFactory.git(ERROR_CODES.GIT_COMMAND_FAILED, "Failed to get current commit", {
        command: "git rev-parse HEAD",
        output: commitResult.stderr,
      });
    }

    // Check if this is the default branch
    const defaultBranchResult = await executor.execute(
      ["git", "symbolic-ref", "refs/remotes/origin/HEAD"],
      context,
    );
    const defaultBranch =
      defaultBranchResult.exitCode === 0
        ? defaultBranchResult.stdout.replace("refs/remotes/origin/", "")
        : "main";

    // Check if branch exists locally and remotely
    const localBranchResult = await executor.execute(
      ["git", "show-ref", "--verify", `refs/heads/${branchName}`],
      context,
    );
    const remoteBranchResult = await executor.execute(
      ["git", "show-ref", "--verify", `refs/remotes/origin/${branchName}`],
      context,
    );

    // Get upstream information
    const upstreamResult = await executor.execute(
      ["git", "rev-parse", "--abbrev-ref", `${branchName}@{upstream}`],
      context,
    );
    const upstream = upstreamResult.exitCode === 0 ? upstreamResult.stdout : undefined;

    // Check working tree status
    const statusResult = await executor.execute(["git", "status", "--porcelain"], context);
    const isClean = statusResult.exitCode === 0 && statusResult.stdout === "";

    return {
      name: branchName,
      commit: commitResult.stdout,
      isDefault: branchName === defaultBranch,
      isLocal: localBranchResult.exitCode === 0,
      isRemote: remoteBranchResult.exitCode === 0,
      upstream,
      isClean,
    };
  } catch (error) {
    // Re-throw SwarmErrors as-is
    if (error && typeof error === "object" && "code" in error) {
      throw error;
    }

    throw ErrorFactory.git(
      ERROR_CODES.GIT_COMMAND_FAILED,
      `Failed to get current branch: ${error instanceof Error ? error.message : String(error)}`,
      { path: repositoryPath, originalError: error },
    );
  }
}

/**
 * Parse Git remote URL to extract repository information
 */
export function parseRemoteUrl(url: string): { owner: string; name: string } | null {
  if (!GitValidation.isValidRemoteUrl(url)) {
    throw ErrorFactory.git(ERROR_CODES.GIT_INVALID_REMOTE, `Invalid remote URL format: ${url}`, {
      url,
    });
  }

  try {
    // Handle HTTPS URLs
    if (url.startsWith("https://")) {
      const match = url.match(/https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/)?$/);
      if (match) {
        return { owner: match[1], name: match[2] };
      }
    }

    // Handle SSH URLs
    if (url.includes("@")) {
      const match = url.match(/git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/);
      if (match) {
        return { owner: match[1], name: match[2] };
      }
    }

    // Handle git:// URLs
    if (url.startsWith("git://")) {
      const match = url.match(/git:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/)?$/);
      if (match) {
        return { owner: match[1], name: match[2] };
      }
    }

    return null;
  } catch (error) {
    throw ErrorFactory.git(
      ERROR_CODES.GIT_REMOTE_ERROR,
      `Failed to parse remote URL: ${error instanceof Error ? error.message : String(error)}`,
      { url, originalError: error },
    );
  }
}

/**
 * Create a new branch
 */
export async function createBranch(
  branchName: string,
  repositoryPath: string,
  options: { baseBranch?: string; checkout?: boolean } = {},
  executor: GitCommandExecutor = defaultExecutor,
): Promise<GitBranchInfo> {
  // Validate inputs
  CommonValidators.branchName().validateOrThrow(branchName, "Branch name validation");
  CommonValidators.worktreePath().validateOrThrow(repositoryPath, "Repository path validation");

  if (options.baseBranch) {
    CommonValidators.branchName().validateOrThrow(
      options.baseBranch,
      "Base branch name validation",
    );
  }

  const context: GitContext = { repositoryPath };
  const checkout = options.checkout !== false; // Default to true

  try {
    // Check if branch already exists
    const existsResult = await executor.execute(
      ["git", "show-ref", "--verify", `refs/heads/${branchName}`],
      context,
    );
    if (existsResult.exitCode === 0) {
      throw ErrorFactory.git(
        ERROR_CODES.GIT_BRANCH_EXISTS,
        `Branch already exists: ${branchName}`,
        { branchName, repositoryPath },
      );
    }

    // Build git command
    const command = ["git"];
    if (checkout) {
      command.push("checkout", "-b", branchName);
    } else {
      command.push("branch", branchName);
    }

    if (options.baseBranch) {
      command.push(options.baseBranch);
    }

    // Execute git command
    const result = await executor.execute(command, context);
    if (result.exitCode !== 0) {
      throw ErrorFactory.git(
        ERROR_CODES.GIT_COMMAND_FAILED,
        `Failed to create branch: ${result.stderr}`,
        { command: command.join(" "), output: result.stderr, branchName },
      );
    }

    // Return branch information
    return await getCurrentBranch(repositoryPath, executor);
  } catch (error) {
    // Re-throw SwarmErrors as-is
    if (error && typeof error === "object" && "code" in error) {
      throw error;
    }

    throw ErrorFactory.git(
      ERROR_CODES.GIT_COMMAND_FAILED,
      `Failed to create branch: ${error instanceof Error ? error.message : String(error)}`,
      { branchName, repositoryPath, originalError: error },
    );
  }
}

/**
 * Get diff information between branches or commits
 */
export async function getDiff(
  repositoryPath: string,
  base: string,
  target?: string,
  executor: GitCommandExecutor = defaultExecutor,
): Promise<GitDiff> {
  CommonValidators.worktreePath().validateOrThrow(repositoryPath, "Repository path validation");

  const context: GitContext = { repositoryPath };
  const diffRange = target ? `${base}...${target}` : base;

  try {
    // Get diff stat
    const statResult = await executor.execute(
      ["git", "diff", "--stat", "--no-color", diffRange],
      context,
    );

    if (statResult.exitCode !== 0) {
      throw ErrorFactory.git(
        ERROR_CODES.GIT_COMMAND_FAILED,
        `Failed to get diff statistics: ${statResult.stderr}`,
        { command: `git diff --stat ${diffRange}`, output: statResult.stderr },
      );
    }

    // Get detailed diff with numstat
    const numstatResult = await executor.execute(
      ["git", "diff", "--numstat", "--no-color", diffRange],
      context,
    );

    if (numstatResult.exitCode !== 0) {
      throw ErrorFactory.git(
        ERROR_CODES.GIT_COMMAND_FAILED,
        `Failed to get diff details: ${numstatResult.stderr}`,
        { command: `git diff --numstat ${diffRange}`, output: numstatResult.stderr },
      );
    }

    // Parse file changes
    const changedFiles: GitFileChange[] = [];
    let totalInsertions = 0;
    let totalDeletions = 0;

    if (numstatResult.stdout) {
      for (const line of numstatResult.stdout.split("\n")) {
        if (!line.trim()) continue;

        const parts = line.split("\t");
        if (parts.length >= 3) {
          const insertions = parts[0] === "-" ? 0 : Number.parseInt(parts[0], 10) || 0;
          const deletions = parts[1] === "-" ? 0 : Number.parseInt(parts[1], 10) || 0;
          const filePath = parts[2];

          totalInsertions += insertions;
          totalDeletions += deletions;

          // Determine file status (simplified - could be enhanced with --name-status)
          let status: GitFileChange["status"] = "modified";
          if (insertions > 0 && deletions === 0) status = "added";
          if (insertions === 0 && deletions > 0) status = "deleted";

          changedFiles.push({
            path: filePath,
            status,
            insertions,
            deletions,
          });
        }
      }
    }

    return {
      commit: target,
      changedFiles,
      insertions: totalInsertions,
      deletions: totalDeletions,
      summary: statResult.stdout || `${changedFiles.length} files changed`,
    };
  } catch (error) {
    // Re-throw SwarmErrors as-is
    if (error && typeof error === "object" && "code" in error) {
      throw error;
    }

    throw ErrorFactory.git(
      ERROR_CODES.GIT_COMMAND_FAILED,
      `Failed to get diff: ${error instanceof Error ? error.message : String(error)}`,
      { repositoryPath, base, target, originalError: error },
    );
  }
}

/**
 * Get remote repository information
 */
export async function getRemoteInfo(
  repositoryPath: string,
  executor: GitCommandExecutor = defaultExecutor,
): Promise<GitRemote[]> {
  CommonValidators.worktreePath().validateOrThrow(repositoryPath, "Repository path validation");

  const context: GitContext = { repositoryPath };

  try {
    const result = await executor.execute(["git", "remote", "-v"], context);

    if (result.exitCode !== 0) {
      throw ErrorFactory.git(
        ERROR_CODES.GIT_COMMAND_FAILED,
        `Failed to get remote information: ${result.stderr}`,
        { command: "git remote -v", output: result.stderr },
      );
    }

    const remotes: GitRemote[] = [];

    if (result.stdout) {
      for (const line of result.stdout.split("\n")) {
        if (!line.trim()) continue;

        const match = line.match(/^(\S+)\s+(\S+)\s+\((\w+)\)$/);
        if (match) {
          remotes.push({
            name: match[1],
            url: match[2],
            type: match[3] as "fetch" | "push",
          });
        }
      }
    }

    return remotes;
  } catch (error) {
    // Re-throw SwarmErrors as-is
    if (error && typeof error === "object" && "code" in error) {
      throw error;
    }

    throw ErrorFactory.git(
      ERROR_CODES.GIT_COMMAND_FAILED,
      `Failed to get remote info: ${error instanceof Error ? error.message : String(error)}`,
      { repositoryPath, originalError: error },
    );
  }
}

/**
 * Check if working tree is clean (no uncommitted changes)
 */
export async function checkWorkingTreeClean(
  repositoryPath: string,
  executor: GitCommandExecutor = defaultExecutor,
): Promise<boolean> {
  CommonValidators.worktreePath().validateOrThrow(repositoryPath, "Repository path validation");

  const context: GitContext = { repositoryPath };

  try {
    const result = await executor.execute(["git", "status", "--porcelain"], context);

    if (result.exitCode !== 0) {
      throw ErrorFactory.git(
        ERROR_CODES.GIT_COMMAND_FAILED,
        `Failed to check working tree status: ${result.stderr}`,
        { command: "git status --porcelain", output: result.stderr },
      );
    }

    return result.stdout.trim() === "";
  } catch (error) {
    // Re-throw SwarmErrors as-is
    if (error && typeof error === "object" && "code" in error) {
      throw error;
    }

    throw ErrorFactory.git(
      ERROR_CODES.GIT_COMMAND_FAILED,
      `Failed to check working tree: ${error instanceof Error ? error.message : String(error)}`,
      { repositoryPath, originalError: error },
    );
  }
}

/**
 * Git utilities for common operations
 */
export const GitUtils = {
  /**
   * Create a safe Git context with validation
   */
  createContext(repositoryPath: string, options: GitOptions = {}): GitContext {
    CommonValidators.worktreePath().validateOrThrow(repositoryPath, "Repository path validation");

    return {
      repositoryPath,
      timeout: options.timeout || 30000,
      silent: options.silent || false,
    };
  },

  /**
   * Sanitize Git reference name (branch, tag, etc.)
   */
  sanitizeRef(ref: string): string {
    return GitValidation.sanitizeBranchName(ref);
  },

  /**
   * Check if a string looks like a commit SHA
   */
  isCommitSha(str: string): boolean {
    return GitValidation.isValidCommitSha(str);
  },

  /**
   * Build safe Git command array
   */
  buildCommand(operation: string, ...args: string[]): string[] {
    const command = ["git", operation];

    // Sanitize arguments to prevent injection
    for (const arg of args) {
      if (typeof arg === "string" && arg.trim()) {
        command.push(arg.trim());
      }
    }

    return command;
  },
};
