/**
 * Core Files Module for Claude Swarm
 *
 * Provides file system operations supporting context management, feedback extraction,
 * and cleanup operations across all workflows. Manages CLAUDE.md and .claude/ directory
 * context across worktrees with robust error handling and cross-platform support.
 */

import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { ERROR_CODES, ErrorFactory } from "@/shared/errors";
import type { GitBranchInfo, RepositoryInfo } from "@/shared/types";
import { CommonValidators } from "@/shared/validation";

/**
 * File system operations interface for dependency injection.
 *
 * Abstracts file system access to allow for mocking in tests
 * and alternative implementations in different environments.
 *
 * @group Core Modules
 */
export interface FileSystemInterface {
  /** Check if a file or directory exists and is accessible */
  access(path: string): Promise<void>;
  /** Copy a file from source to target */
  copyFile(source: string, target: string): Promise<void>;
  /** Read file content as string */
  readFile(path: string, encoding: string): Promise<string>;
  /** Write content to file */
  writeFile(path: string, content: string, encoding: string): Promise<void>;
  /** Create directory with options */
  mkdir(path: string, options: { recursive: boolean }): Promise<void>;
  /** List directory contents */
  readdir(path: string): Promise<string[]>;
  /** Get file/directory stats */
  stat(
    path: string,
  ): Promise<{ isDirectory(): boolean; isFile(): boolean; mtime: Date; size: number }>;
  /** Delete file */
  unlink(path: string): Promise<void>;
}

/**
 * Path operations interface for dependency injection.
 *
 * Abstracts path operations to allow for mocking in tests
 * and cross-platform compatibility testing.
 *
 * @group Core Modules
 */
export interface PathInterface {
  /** Join path segments */
  join(...paths: string[]): string;
  /** Resolve absolute path */
  resolve(...paths: string[]): string;
  /** Get directory name */
  dirname(path: string): string;
  /** Get base name */
  basename(path: string): string;
  /** Get file extension */
  extname(path: string): string;
}

/**
 * Claude context setup status information.
 *
 * Reports the state of CLAUDE.md and .claude/ directory setup
 * after context operations.
 *
 * @group Core Modules
 */
export interface ClaudeContextStatus {
  /** Whether context is fully set up */
  isComplete: boolean;
  /** CLAUDE.md file present */
  claudeMdExists: boolean;
  /** .claude/ directory present */
  claudeDirExists: boolean;
  /** Files copied during operation */
  copiedFiles: string[];
}

/**
 * Options for Claude context copying operations.
 *
 * @group Core Modules
 */
export interface CopyContextOptions {
  /** Overwrite existing files */
  overwrite?: boolean;
  /** Don't copy .local.json files */
  preserveLocal?: boolean;
  /** Copy .claude/commands/ directory */
  includeCommands?: boolean;
}

/**
 * Options for creating work reports.
 *
 * @group Core Modules
 */
export interface CreateWorkReportOptions {
  /** Issue being worked on */
  issueNumber: number;
  /** Worktree where work was done */
  workTreePath: string;
  /** Repository context */
  repositoryInfo: RepositoryInfo;
  /** Branch information */
  branchInfo: GitBranchInfo;
  /** Work summary */
  summary?: string;
  /** Include git diff in report */
  includeGitDiff?: boolean;
  /** Include testing section */
  includeTesting?: boolean;
}

/**
 * Structured work report data.
 *
 * @group Core Modules
 */
export interface WorkReport {
  /** Associated issue number */
  issueNumber: number;
  /** Report file path */
  filePath: string;
  /** Full report content */
  content: string;
  /** Parsed metadata */
  metadata: WorkReportMetadata;
  /** Structured sections */
  sections: WorkReportSections;
}

/**
 * Work report metadata information.
 *
 * @group Core Modules
 */
export interface WorkReportMetadata {
  /** Report creation time */
  created: Date;
  /** Issue title */
  issueTitle?: string;
  /** Repository name */
  repository?: string;
  /** Work branch */
  branch?: string;
  /** Worktree path */
  worktree?: string;
}

/**
 * Work report structured sections.
 *
 * @group Core Modules
 */
export interface WorkReportSections {
  /** Work summary */
  summary?: string;
  /** Changes description */
  changes?: string;
  /** Testing information */
  testing?: string;
  /** Review notes */
  notes?: string;
}

/**
 * Options for creating review feedback documents.
 *
 * @group Core Modules
 */
export interface CreateFeedbackOptions {
  /** Original issue number */
  issueNumber: number;
  /** Review outcome */
  reviewResult: "approved" | "needs_work";
  /** Structured feedback */
  feedback: ReviewFeedback;
  /** Reviewer identification */
  reviewerInfo?: string;
  /** Path to original work report */
  workReportPath?: string;
}

/**
 * Structured review feedback data.
 *
 * @group Core Modules
 */
export interface ReviewFeedback {
  /** Overall feedback summary */
  summary: string;
  /** What was done well */
  approvedAspects?: string[];
  /** Required modifications */
  requiredChanges?: FeedbackItem[];
  /** Optional improvements */
  suggestions?: FeedbackItem[];
  /** Testing validation results */
  testingNotes?: string;
}

/**
 * Individual feedback item.
 *
 * @group Core Modules
 */
export interface FeedbackItem {
  /** Feedback category */
  category: "code" | "tests" | "documentation" | "other";
  /** What needs to be changed */
  description: string;
  /** File/line reference */
  location?: string;
  /** Change priority */
  priority: "high" | "medium" | "low";
  /** How to fix it */
  suggestion?: string;
}

/**
 * Review feedback document with metadata.
 *
 * @group Core Modules
 */
export interface ReviewFeedbackDocument {
  /** Associated issue */
  issueNumber: number;
  /** Document path */
  filePath: string;
  /** Review outcome */
  result: "approved" | "needs_work";
  /** Parsed feedback */
  feedback: ReviewFeedback;
  /** Creation timestamp */
  created: Date;
  /** Reviewer info */
  reviewer?: string;
}

/**
 * Options for cleanup operations.
 *
 * @group Core Modules
 */
export interface CleanupOptions {
  /** Remove files older than date */
  olderThan?: Date;
  /** File patterns to remove */
  patterns?: string[];
  /** Show what would be removed */
  dryRun?: boolean;
  /** Keep work reports */
  preserveReports?: boolean;
}

/**
 * Cleanup operation results.
 *
 * @group Core Modules
 */
export interface CleanupResult {
  /** Removed file paths */
  filesRemoved: string[];
  /** Bytes freed */
  spaceSaved: number;
  /** Any cleanup failures */
  errors: CleanupError[];
}

/**
 * Cleanup operation error.
 *
 * @group Core Modules
 */
export interface CleanupError {
  /** Failed file path */
  path: string;
  /** Error description */
  error: string;
}

/**
 * Project structure validation results.
 *
 * @group Core Modules
 */
export interface StructureValidation {
  /** Structure is correct */
  isValid: boolean;
  /** CLAUDE.md and .claude/ present */
  hasClaudeContext: boolean;
  /** Valid git repository */
  hasGitRepo: boolean;
  /** package.json or similar */
  hasPackageConfig: boolean;
  /** Validation problems */
  issues: string[];
}

/**
 * Default filesystem implementation
 */
class DefaultFileSystem implements FileSystemInterface {
  async access(path: string): Promise<void> {
    return fs.access(path);
  }

  async copyFile(source: string, target: string): Promise<void> {
    return fs.copyFile(source, target);
  }

  async readFile(path: string, encoding: string): Promise<string> {
    return fs.readFile(path, encoding as BufferEncoding);
  }

  async writeFile(path: string, content: string, encoding: string): Promise<void> {
    return fs.writeFile(path, content, encoding as BufferEncoding);
  }

  async mkdir(path: string, options: { recursive: boolean }): Promise<void> {
    await fs.mkdir(path, options);
  }

  async readdir(path: string): Promise<string[]> {
    return fs.readdir(path);
  }

  async stat(
    path: string,
  ): Promise<{ isDirectory(): boolean; isFile(): boolean; mtime: Date; size: number }> {
    const stats = await fs.stat(path);
    return {
      isDirectory: () => stats.isDirectory(),
      isFile: () => stats.isFile(),
      mtime: stats.mtime,
      size: stats.size,
    };
  }

  async unlink(path: string): Promise<void> {
    return fs.unlink(path);
  }
}

/**
 * Default path implementation
 */
class DefaultPath implements PathInterface {
  join(...paths: string[]): string {
    return path.join(...paths);
  }

  resolve(...paths: string[]): string {
    return path.resolve(...paths);
  }

  dirname(p: string): string {
    return path.dirname(p);
  }

  basename(p: string): string {
    return path.basename(p);
  }

  extname(p: string): string {
    return path.extname(p);
  }
}

/**
 * Default implementations
 */
const defaultFileSystem = new DefaultFileSystem();
const defaultPath = new DefaultPath();

/**
 * Validate project file structure for development workflows.
 *
 * Checks for essential files and directories needed for Claude Swarm
 * workflows including git repository, Claude context, and package configuration.
 *
 * @param projectPath - Absolute path to project directory
 * @param fileSystem - File system interface (injectable for testing)
 * @param pathOps - Path operations interface (injectable for testing)
 * @returns Promise resolving to structure validation results
 *
 * @throws {FileError} When project path is invalid
 * @throws {FileError} When validation encounters file system errors
 *
 * @example
 * ```typescript
 * const validation = await validateFileStructure('/path/to/project');
 * if (!validation.isValid) {
 *   console.log('Issues found:', validation.issues);
 * }
 * ```
 *
 * @group Core Modules
 */
export async function validateFileStructure(
  projectPath: string,
  fileSystem: FileSystemInterface = defaultFileSystem,
  pathOps: PathInterface = defaultPath,
): Promise<StructureValidation> {
  // Validate input path
  CommonValidators.worktreePath().validateOrThrow(projectPath, "Project path validation");

  const validation: StructureValidation = {
    isValid: true,
    hasClaudeContext: false,
    hasGitRepo: false,
    hasPackageConfig: false,
    issues: [],
  };

  try {
    // Check if project directory exists
    await fileSystem.access(projectPath);

    // Check for git repository
    try {
      const gitPath = pathOps.join(projectPath, ".git");
      await fileSystem.access(gitPath);
      validation.hasGitRepo = true;
    } catch {
      validation.issues.push("No git repository found (.git directory missing)");
    }

    // Check for CLAUDE.md
    const claudeMdExists = await checkFileExists(
      pathOps.join(projectPath, "CLAUDE.md"),
      fileSystem,
    );

    // Check for .claude directory
    const claudeDirExists = await checkFileExists(pathOps.join(projectPath, ".claude"), fileSystem);

    if (claudeMdExists && claudeDirExists) {
      validation.hasClaudeContext = true;
    } else {
      if (!claudeMdExists) validation.issues.push("CLAUDE.md file missing");
      if (!claudeDirExists) validation.issues.push(".claude directory missing");
    }

    // Check for package configuration
    const packageJsonPath = pathOps.join(projectPath, "package.json");
    const tsConfigPath = pathOps.join(projectPath, "tsconfig.json");
    const cargoTomlPath = pathOps.join(projectPath, "Cargo.toml");

    const hasPackageJson = await checkFileExists(packageJsonPath, fileSystem);
    const hasTsConfig = await checkFileExists(tsConfigPath, fileSystem);
    const hasCargoToml = await checkFileExists(cargoTomlPath, fileSystem);

    if (hasPackageJson || hasTsConfig || hasCargoToml) {
      validation.hasPackageConfig = true;
    } else {
      validation.issues.push(
        "No package configuration found (package.json, tsconfig.json, or Cargo.toml)",
      );
    }

    validation.isValid = validation.issues.length === 0;

    return validation;
  } catch (error) {
    if (error instanceof Error && error.message.includes("ENOENT")) {
      throw ErrorFactory.file(
        ERROR_CODES.FILE_NOT_FOUND,
        `Project directory not found: ${projectPath}`,
        { path: projectPath },
      );
    }

    throw ErrorFactory.file(
      ERROR_CODES.FILE_OPERATION_FAILED,
      `Failed to validate project structure: ${error instanceof Error ? error.message : String(error)}`,
      { path: projectPath, originalError: error },
    );
  }
}

/**
 * Helper function to check if file or directory exists
 */
async function checkFileExists(
  filePath: string,
  fileSystem: FileSystemInterface,
): Promise<boolean> {
  try {
    await fileSystem.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure Claude context is available in target directory.
 *
 * Copies CLAUDE.md and .claude/ directory from source to target if missing.
 * Creates a complete development environment setup for Claude Swarm workflows.
 *
 * @param targetPath - Target directory path
 * @param sourcePath - Source directory path (defaults to current working directory)
 * @param fileSystem - File system interface (injectable for testing)
 * @param pathOps - Path operations interface (injectable for testing)
 * @returns Promise resolving to context setup status
 *
 * @throws {FileError} When paths are invalid
 * @throws {FileError} When copy operations fail
 *
 * @example
 * ```typescript
 * const status = await ensureClaudeContext('/path/to/worktree', '/path/to/main');
 * if (!status.isComplete) {
 *   console.log('Missing files copied:', status.copiedFiles);
 * }
 * ```
 *
 * @group Core Modules
 */
export async function ensureClaudeContext(
  targetPath: string,
  sourcePath: string = process.cwd(),
  fileSystem: FileSystemInterface = defaultFileSystem,
  pathOps: PathInterface = defaultPath,
): Promise<ClaudeContextStatus> {
  // Validate inputs
  CommonValidators.worktreePath().validateOrThrow(targetPath, "Target path validation");
  CommonValidators.worktreePath().validateOrThrow(sourcePath, "Source path validation");

  const status: ClaudeContextStatus = {
    isComplete: false,
    claudeMdExists: false,
    claudeDirExists: false,
    copiedFiles: [],
  };

  try {
    // Check target directory exists
    await fileSystem.access(targetPath);

    const targetClaudeMd = pathOps.join(targetPath, "CLAUDE.md");
    const targetClaudeDir = pathOps.join(targetPath, ".claude");

    // Check what exists in target
    status.claudeMdExists = await checkFileExists(targetClaudeMd, fileSystem);
    status.claudeDirExists = await checkFileExists(targetClaudeDir, fileSystem);

    // Copy missing files from source
    if (!status.claudeMdExists) {
      const sourceClaudeMd = pathOps.join(sourcePath, "CLAUDE.md");
      if (await checkFileExists(sourceClaudeMd, fileSystem)) {
        await fileSystem.copyFile(sourceClaudeMd, targetClaudeMd);
        status.copiedFiles.push(targetClaudeMd);
        status.claudeMdExists = true;
      }
    }

    if (!status.claudeDirExists) {
      const sourceClaudeDir = pathOps.join(sourcePath, ".claude");
      if (await checkFileExists(sourceClaudeDir, fileSystem)) {
        await copyDirectory(sourceClaudeDir, targetClaudeDir, fileSystem, pathOps);
        status.copiedFiles.push(targetClaudeDir);
        status.claudeDirExists = true;
      }
    }

    status.isComplete = status.claudeMdExists && status.claudeDirExists;

    return status;
  } catch (error) {
    if (error instanceof Error && error.message.includes("ENOENT")) {
      throw ErrorFactory.file(
        ERROR_CODES.FILE_NOT_FOUND,
        `Directory not found: ${error.message.includes(targetPath) ? targetPath : sourcePath}`,
        { targetPath, sourcePath },
      );
    }

    if (error instanceof Error && error.message.includes("EACCES")) {
      throw ErrorFactory.file(
        ERROR_CODES.FILE_PERMISSION_DENIED,
        `Permission denied accessing directories: ${error.message}`,
        { targetPath, sourcePath, originalError: error },
      );
    }

    // Re-throw SwarmErrors as-is
    if (error && typeof error === "object" && "code" in error) {
      throw error;
    }

    throw ErrorFactory.file(
      ERROR_CODES.FILE_OPERATION_FAILED,
      `Failed to ensure Claude context: ${error instanceof Error ? error.message : String(error)}`,
      { targetPath, sourcePath, originalError: error },
    );
  }
}

/**
 * Helper function to copy directory recursively
 */
async function copyDirectory(
  source: string,
  target: string,
  fileSystem: FileSystemInterface,
  pathOps: PathInterface,
): Promise<void> {
  try {
    // Create target directory
    await fileSystem.mkdir(target, { recursive: true });

    // Read source directory contents
    const entries = await fileSystem.readdir(source);

    // Copy each entry
    for (const entry of entries) {
      const sourcePath = pathOps.join(source, entry);
      const targetPath = pathOps.join(target, entry);

      const stats = await fileSystem.stat(sourcePath);

      if (stats.isDirectory()) {
        await copyDirectory(sourcePath, targetPath, fileSystem, pathOps);
      } else {
        await fileSystem.copyFile(sourcePath, targetPath);
      }
    }
  } catch (error) {
    throw ErrorFactory.file(
      ERROR_CODES.FILE_COPY_FAILED,
      `Failed to copy directory from ${source} to ${target}: ${error instanceof Error ? error.message : String(error)}`,
      { source, target, originalError: error },
    );
  }
}

/**
 * Create unique temporary directory for file operations.
 *
 * Generates a temporary directory with a unique name for use in
 * file operations, work reports, and cleanup tasks.
 *
 * @param prefix - Directory name prefix
 * @param fileSystem - File system interface (injectable for testing)
 * @param pathOps - Path operations interface (injectable for testing)
 * @returns Promise resolving to temporary directory path
 *
 * @throws {FileError} When directory creation fails
 *
 * @example
 * ```typescript
 * const tempDir = await createTempDirectory('swarm-work');
 * // Use tempDir for temporary operations
 * ```
 *
 * @group Core Modules
 */
export async function createTempDirectory(
  prefix = "claude-swarm",
  fileSystem: FileSystemInterface = defaultFileSystem,
  pathOps: PathInterface = defaultPath,
): Promise<string> {
  try {
    // Generate unique directory name
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const dirName = `${prefix}-${timestamp}-${random}`;
    const tempPath = pathOps.join(tmpdir(), dirName);

    // Create directory
    await fileSystem.mkdir(tempPath, { recursive: true });

    return tempPath;
  } catch (error) {
    throw ErrorFactory.file(
      ERROR_CODES.FILE_OPERATION_FAILED,
      `Failed to create temporary directory: ${error instanceof Error ? error.message : String(error)}`,
      { prefix, originalError: error },
    );
  }
}

// Stub implementations for remaining functions (will be implemented in TDD phases)

/**
 * Copy Claude context with detailed options.
 *
 * Provides granular control over Claude context copying with options for
 * overwriting files, preserving local configurations, and including commands.
 *
 * @param sourcePath - Source directory containing Claude context
 * @param targetPath - Target directory for copied context
 * @param options - Copy behavior options
 * @param fileSystem - File system interface (injectable for testing)
 * @param pathOps - Path operations interface (injectable for testing)
 * @returns Promise resolving to array of copied file paths
 *
 * @throws {FileError} When paths are invalid
 * @throws {FileError} When source or target directories don't exist
 * @throws {FileError} When copy operations fail
 *
 * @example
 * ```typescript
 * const copiedFiles = await copyClaudeContext('/source', '/target', {
 *   overwrite: true,
 *   preserveLocal: true,
 *   includeCommands: false
 * });
 * console.log('Copied files:', copiedFiles);
 * ```
 *
 * @group Core Modules
 */
export async function copyClaudeContext(
  sourcePath: string,
  targetPath: string,
  options: CopyContextOptions = {},
  fileSystem: FileSystemInterface = defaultFileSystem,
  pathOps: PathInterface = defaultPath,
): Promise<string[]> {
  // Validate inputs
  CommonValidators.worktreePath().validateOrThrow(sourcePath, "Source path validation");
  CommonValidators.worktreePath().validateOrThrow(targetPath, "Target path validation");

  const { overwrite = true, preserveLocal = false, includeCommands = true } = options;
  const copiedFiles: string[] = [];

  try {
    // Check that source and target directories exist
    await fileSystem.access(sourcePath);
    await fileSystem.access(targetPath);

    // Copy CLAUDE.md if it exists in source
    const sourceClaudeMd = pathOps.join(sourcePath, "CLAUDE.md");
    const targetClaudeMd = pathOps.join(targetPath, "CLAUDE.md");

    if (await checkFileExists(sourceClaudeMd, fileSystem)) {
      const shouldCopy = overwrite || !(await checkFileExists(targetClaudeMd, fileSystem));

      if (shouldCopy) {
        await fileSystem.copyFile(sourceClaudeMd, targetClaudeMd);
        copiedFiles.push(targetClaudeMd);
      }
    }

    // Copy .claude directory if it exists in source
    const sourceClaudeDir = pathOps.join(sourcePath, ".claude");
    const targetClaudeDir = pathOps.join(targetPath, ".claude");

    if (await checkFileExists(sourceClaudeDir, fileSystem)) {
      await copyClaudeDirectory(
        sourceClaudeDir,
        targetClaudeDir,
        { overwrite, preserveLocal, includeCommands },
        fileSystem,
        pathOps,
      );
      copiedFiles.push(targetClaudeDir);
    }

    return copiedFiles;
  } catch (error) {
    if (error instanceof Error && error.message.includes("ENOENT")) {
      throw ErrorFactory.file(
        ERROR_CODES.FILE_NOT_FOUND,
        `Directory not found: ${error.message.includes(sourcePath) ? sourcePath : targetPath}`,
        { sourcePath, targetPath },
      );
    }

    if (error instanceof Error && error.message.includes("EACCES")) {
      throw ErrorFactory.file(
        ERROR_CODES.FILE_PERMISSION_DENIED,
        `Permission denied accessing directories: ${error.message}`,
        { sourcePath, targetPath, originalError: error },
      );
    }

    // Re-throw SwarmErrors as-is
    if (error && typeof error === "object" && "code" in error) {
      throw error;
    }

    throw ErrorFactory.file(
      ERROR_CODES.FILE_COPY_FAILED,
      `Failed to copy Claude context: ${error instanceof Error ? error.message : String(error)}`,
      { sourcePath, targetPath, originalError: error },
    );
  }
}

/**
 * Helper function to copy .claude directory with filtering options
 */
async function copyClaudeDirectory(
  sourceDir: string,
  targetDir: string,
  options: { overwrite: boolean; preserveLocal: boolean; includeCommands: boolean },
  fileSystem: FileSystemInterface,
  pathOps: PathInterface,
): Promise<void> {
  try {
    // Create target directory if it doesn't exist
    if (!(await checkFileExists(targetDir, fileSystem))) {
      await fileSystem.mkdir(targetDir, { recursive: true });
    }

    // Read source directory contents
    const entries = await fileSystem.readdir(sourceDir);

    // Copy each entry with filtering
    for (const entry of entries) {
      const sourcePath = pathOps.join(sourceDir, entry);
      const targetPath = pathOps.join(targetDir, entry);

      // Skip .local.json files if preserveLocal is true
      if (options.preserveLocal && entry.includes(".local.json")) {
        continue;
      }

      // Skip commands directory if includeCommands is false
      if (!options.includeCommands && entry === "commands") {
        continue;
      }

      const stats = await fileSystem.stat(sourcePath);

      if (stats.isDirectory()) {
        // Recursively copy subdirectories
        await copyClaudeDirectory(sourcePath, targetPath, options, fileSystem, pathOps);
      } else {
        // Copy file if it should be copied
        const shouldCopy = options.overwrite || !(await checkFileExists(targetPath, fileSystem));

        if (shouldCopy) {
          await fileSystem.copyFile(sourcePath, targetPath);
        }
      }
    }
  } catch (error) {
    throw ErrorFactory.file(
      ERROR_CODES.FILE_COPY_FAILED,
      `Failed to copy .claude directory from ${sourceDir} to ${targetDir}: ${error instanceof Error ? error.message : String(error)}`,
      { sourceDir, targetDir, originalError: error },
    );
  }
}

/**
 * Create structured work report for completed tasks.
 *
 * Generates a comprehensive work report in Markdown format with metadata,
 * work summary, changes, testing information, and optional git diff analysis.
 *
 * @param options - Work report creation options
 * @param fileSystem - File system interface (injectable for testing)
 * @param pathOps - Path operations interface (injectable for testing)
 * @returns Promise resolving to work report file path
 *
 * @throws {FileError} When options validation fails
 * @throws {FileError} When report creation fails
 *
 * @example
 * ```typescript
 * const reportPath = await createWorkReport({
 *   issueNumber: 123,
 *   workTreePath: '/path/to/worktree',
 *   repositoryInfo: repoInfo,
 *   branchInfo: branchInfo,
 *   summary: 'Implemented feature X',
 *   includeGitDiff: true
 * });
 * ```
 *
 * @group Core Modules
 */
export async function createWorkReport(
  options: CreateWorkReportOptions,
  fileSystem: FileSystemInterface = defaultFileSystem,
  pathOps: PathInterface = defaultPath,
): Promise<string> {
  // Validate inputs
  if (options.issueNumber <= 0) {
    throw ErrorFactory.file(
      ERROR_CODES.FILE_OPERATION_FAILED,
      "Issue number validation failed: must be positive",
      { issueNumber: options.issueNumber },
    );
  }

  CommonValidators.worktreePath().validateOrThrow(
    options.workTreePath,
    "Work tree path validation",
  );

  try {
    // Create temp directory for work reports
    const tempDir = await createTempDirectory("work-reports", fileSystem, pathOps);

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `work-report-${options.issueNumber}-${timestamp}.md`;
    const filePath = pathOps.join(tempDir, fileName);

    // Generate report content
    const content = await generateWorkReportContent(options);

    // Write report to file
    await fileSystem.writeFile(filePath, content, "utf8");

    return filePath;
  } catch (error) {
    throw ErrorFactory.file(
      ERROR_CODES.FILE_OPERATION_FAILED,
      `Failed to create work report: ${error instanceof Error ? error.message : String(error)}`,
      { issueNumber: options.issueNumber, originalError: error },
    );
  }
}

/**
 * Read and parse existing work report.
 *
 * Finds and parses work report files for a given issue number,
 * extracting metadata and structured sections for analysis.
 *
 * @param issueNumber - Issue number to find work report for
 * @param fileSystem - File system interface (injectable for testing)
 * @param pathOps - Path operations interface (injectable for testing)
 * @returns Promise resolving to parsed work report data
 *
 * @throws {FileError} When issue number is invalid
 * @throws {FileError} When work report is not found
 * @throws {FileError} When report parsing fails
 *
 * @example
 * ```typescript
 * const report = await readWorkReport(123);
 * console.log('Summary:', report.sections.summary);
 * console.log('Created:', report.metadata.created);
 * ```
 *
 * @group Core Modules
 */
export async function readWorkReport(
  issueNumber: number,
  fileSystem: FileSystemInterface = defaultFileSystem,
  pathOps: PathInterface = defaultPath,
): Promise<WorkReport> {
  // Validate inputs
  if (issueNumber <= 0) {
    throw ErrorFactory.file(
      ERROR_CODES.FILE_OPERATION_FAILED,
      "Issue number validation failed: must be positive",
      { issueNumber },
    );
  }

  try {
    // Find work report files in temp directory
    const tempDir = pathOps.resolve(tmpdir());
    const files = await fileSystem.readdir(tempDir);

    // Filter files matching the pattern
    const reportFiles = files
      .filter((file) => file.startsWith(`work-report-${issueNumber}-`) && file.endsWith(".md"))
      .map((file) => pathOps.join(tempDir, file))
      .sort() // Sort to get most recent (highest timestamp)
      .reverse(); // Reverse to get newest first

    if (reportFiles.length === 0) {
      throw ErrorFactory.file(
        ERROR_CODES.FILE_NOT_FOUND,
        `Work report not found for issue #${issueNumber}`,
        { issueNumber },
      );
    }

    // Read the most recent report
    const filePath = reportFiles[0];
    const content = await fileSystem.readFile(filePath, "utf8");

    // Validate and parse the report
    validateWorkReportFormat(content);
    const metadata = parseWorkReportMetadata(content);
    const sections = parseWorkReportSections(content);

    return {
      issueNumber,
      filePath,
      content,
      metadata,
      sections,
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      throw error;
    }

    throw ErrorFactory.file(
      ERROR_CODES.FILE_PARSE_FAILED,
      `Failed to parse work report: ${error instanceof Error ? error.message : String(error)}`,
      { issueNumber, originalError: error },
    );
  }
}

/**
 * Validate work report format
 */
function validateWorkReportFormat(content: string): void {
  // Check for required header pattern
  if (!content.match(/^# Work Report - Issue #\d+/m)) {
    throw new Error("Invalid work report format: missing or malformed header");
  }

  // Check for required metadata fields
  const requiredFields = ["**Created:**", "**Repository:**", "**Branch:**"];
  for (const field of requiredFields) {
    if (!content.includes(field)) {
      throw new Error(`Invalid work report format: missing required field ${field}`);
    }
  }
}

/**
 * Generate work report content in Markdown format
 */
async function generateWorkReportContent(options: CreateWorkReportOptions): Promise<string> {
  const { issueNumber, repositoryInfo, branchInfo, summary, includeGitDiff, includeTesting } =
    options;

  const timestamp = new Date().toISOString();
  const repoName = repositoryInfo.owner
    ? `${repositoryInfo.owner}/${repositoryInfo.name}`
    : repositoryInfo.name;

  let content = `# Work Report - Issue #${issueNumber}

**Created:** ${timestamp}
**Repository:** ${repoName}
**Branch:** ${branchInfo.name}
**Commit:** ${branchInfo.commit}
**Worktree:** ${options.workTreePath}

`;

  if (summary) {
    content += `## Summary

${summary}

`;
  }

  content += `## Changes

<!-- Describe the changes made in this work session -->

`;

  if (includeGitDiff) {
    content += `## Git Diff

<!-- Git diff would be included here -->
\`\`\`diff
# Diff content would be generated from git operations
\`\`\`

`;
  }

  if (includeTesting) {
    content += `## Testing

<!-- Describe testing performed and results -->

`;
  }

  content += `## Notes

<!-- Additional notes and review comments -->

`;

  return content;
}

/**
 * Parse work report metadata from content
 */
function parseWorkReportMetadata(content: string): WorkReportMetadata {
  const metadata: WorkReportMetadata = {
    created: new Date(),
  };

  // Extract metadata from bold fields
  const createdMatch = content.match(/\*\*Created:\*\*\s*(.+)/);
  if (createdMatch) {
    metadata.created = new Date(createdMatch[1]);
  }

  const repositoryMatch = content.match(/\*\*Repository:\*\*\s*(.+)/);
  if (repositoryMatch) {
    metadata.repository = repositoryMatch[1];
  }

  const branchMatch = content.match(/\*\*Branch:\*\*\s*(.+)/);
  if (branchMatch) {
    metadata.branch = branchMatch[1];
  }

  const worktreeMatch = content.match(/\*\*Worktree:\*\*\s*(.+)/);
  if (worktreeMatch) {
    metadata.worktree = worktreeMatch[1];
  }

  return metadata;
}

/**
 * Parse work report sections from content
 */
function parseWorkReportSections(content: string): WorkReportSections {
  const sections: WorkReportSections = {};

  // Extract sections by looking for markdown headers
  const summaryMatch = content.match(/## Summary\s*\n\n(.*?)(?=\n## |$)/s);
  if (summaryMatch) {
    sections.summary = summaryMatch[1].trim();
  }

  const changesMatch = content.match(/## Changes\s*\n\n(.*?)(?=\n## |$)/s);
  if (changesMatch) {
    sections.changes = changesMatch[1].trim();
  }

  const testingMatch = content.match(/## Testing\s*\n\n(.*?)(?=\n## |$)/s);
  if (testingMatch) {
    sections.testing = testingMatch[1].trim();
  }

  const notesMatch = content.match(/## Notes\s*\n\n(.*?)(?=\n## |$)/s);
  if (notesMatch) {
    sections.notes = notesMatch[1].trim();
  }

  return sections;
}

/**
 * Generate feedback document content in Markdown format
 */
async function generateFeedbackContent(options: CreateFeedbackOptions): Promise<string> {
  const { issueNumber, reviewResult, feedback, reviewerInfo, workReportPath } = options;

  const timestamp = new Date().toISOString();
  const resultText = reviewResult === "approved" ? "Approved" : "Needs Work";

  let content = `# Review Feedback - Issue #${issueNumber}

**Created:** ${timestamp}
**Result:** ${resultText}`;

  if (reviewerInfo) {
    content += `
**Reviewer:** ${reviewerInfo}`;
  }

  if (workReportPath) {
    content += `
**Work Report:** ${workReportPath}`;
  }

  content += `

## Summary

${feedback.summary}

`;

  // Add approved aspects if present
  if (feedback.approvedAspects && feedback.approvedAspects.length > 0) {
    content += `## Approved Aspects

`;
    for (const aspect of feedback.approvedAspects) {
      content += `- ${aspect}
`;
    }
    content += `
`;
  }

  // Add required changes if present
  if (feedback.requiredChanges && feedback.requiredChanges.length > 0) {
    content += `## Required Changes

`;
    const groupedChanges = groupFeedbackByPriority(feedback.requiredChanges);
    content += formatFeedbackSection(groupedChanges);
  }

  // Add suggestions if present
  if (feedback.suggestions && feedback.suggestions.length > 0) {
    content += `## Suggestions

`;
    const groupedSuggestions = groupFeedbackByPriority(feedback.suggestions);
    content += formatFeedbackSection(groupedSuggestions);
  }

  // Add testing notes if present
  if (feedback.testingNotes) {
    content += `## Testing Notes

${feedback.testingNotes}

`;
  }

  return content;
}

/**
 * Group feedback items by priority
 */
function groupFeedbackByPriority(items: FeedbackItem[]): Record<string, FeedbackItem[]> {
  const grouped: Record<string, FeedbackItem[]> = {
    high: [],
    medium: [],
    low: [],
  };

  for (const item of items) {
    grouped[item.priority].push(item);
  }

  return grouped;
}

/**
 * Format feedback section with priority grouping
 */
function formatFeedbackSection(groupedFeedback: Record<string, FeedbackItem[]>): string {
  let content = "";

  const priorityOrder: Array<"high" | "medium" | "low"> = ["high", "medium", "low"];
  const priorityLabels: Record<"high" | "medium" | "low", string> = {
    high: "High Priority",
    medium: "Medium Priority",
    low: "Low Priority",
  };

  for (const priority of priorityOrder) {
    const items = groupedFeedback[priority];
    if (items.length > 0) {
      content += `### ${priorityLabels[priority]}

`;
      for (const item of items) {
        const categoryLabel = item.category.charAt(0).toUpperCase() + item.category.slice(1);
        content += `**${categoryLabel}:** ${item.description}
`;
        if (item.location) {
          content += `*Location:* ${item.location}
`;
        }
        if (item.suggestion) {
          content += `*Suggestion:* ${item.suggestion}
`;
        }
        content += `
`;
      }
    }
  }

  return content;
}

/**
 * Create review feedback document for completed reviews.
 *
 * Generates structured feedback documents in Markdown format containing
 * review results, feedback items, and metadata for code review processes.
 *
 * @param options - Feedback document creation options
 * @param fileSystem - File system interface (injectable for testing)
 * @param pathOps - Path operations interface (injectable for testing)
 * @returns Promise resolving to feedback document file path
 *
 * @throws {FileError} When options validation fails
 * @throws {FileError} When document creation fails
 *
 * @example
 * ```typescript
 * const feedbackPath = await createFeedbackDocument({
 *   issueNumber: 123,
 *   reviewResult: 'needs_work',
 *   feedback: {
 *     summary: 'Good start but needs improvements',
 *     requiredChanges: [{
 *       category: 'code',
 *       description: 'Add error handling',
 *       priority: 'high'
 *     }]
 *   },
 *   reviewerInfo: 'Senior Developer'
 * });
 * ```
 *
 * @group Core Modules
 */
export async function createFeedbackDocument(
  options: CreateFeedbackOptions,
  fileSystem: FileSystemInterface = defaultFileSystem,
  pathOps: PathInterface = defaultPath,
): Promise<string> {
  // Validate inputs
  if (options.issueNumber <= 0) {
    throw ErrorFactory.file(
      ERROR_CODES.FILE_OPERATION_FAILED,
      "Issue number validation failed: must be positive",
      { issueNumber: options.issueNumber },
    );
  }

  try {
    // Generate unique directory name and filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const dirName = `feedback-reports-${timestamp}-${random}`;
    const tempDir = pathOps.join(tmpdir(), dirName);
    const fileName = `feedback-${options.issueNumber}-${timestamp}.md`;
    const filePath = pathOps.join(tempDir, fileName);

    // Create temp directory
    await fileSystem.mkdir(tempDir, { recursive: true });

    // Generate feedback content
    const content = await generateFeedbackContent(options);

    // Write feedback to file
    await fileSystem.writeFile(filePath, content, "utf8");

    return filePath;
  } catch (error) {
    throw ErrorFactory.file(
      ERROR_CODES.FILE_OPERATION_FAILED,
      `Failed to create feedback document: ${error instanceof Error ? error.message : String(error)}`,
      { issueNumber: options.issueNumber, originalError: error },
    );
  }
}

/**
 * Validate feedback document format
 */
function validateFeedbackFormat(content: string): void {
  // Check for required header pattern
  if (!content.match(/^# Review Feedback - Issue #\d+/m)) {
    throw new Error("Invalid feedback document format: missing or malformed header");
  }

  // Check for required metadata fields
  const requiredFields = ["**Created:**", "**Result:**"];
  for (const field of requiredFields) {
    if (!content.includes(field)) {
      throw new Error(`Invalid feedback document format: missing required field ${field}`);
    }
  }
}

/**
 * Parse feedback document metadata
 */
function parseFeedbackMetadata(content: string): {
  created: Date;
  result: "approved" | "needs_work";
  reviewer?: string;
} {
  const metadata = {
    created: new Date(),
    result: "approved" as "approved" | "needs_work",
    reviewer: undefined as string | undefined,
  };

  // Extract metadata from bold fields
  const createdMatch = content.match(/\*\*Created:\*\*\s*(.+)/);
  if (createdMatch) {
    metadata.created = new Date(createdMatch[1]);
  }

  const resultMatch = content.match(/\*\*Result:\*\*\s*(.+)/);
  if (resultMatch) {
    const resultText = resultMatch[1].trim();
    metadata.result = resultText.toLowerCase().includes("needs work") ? "needs_work" : "approved";
  }

  const reviewerMatch = content.match(/\*\*Reviewer:\*\*\s*(.+)/);
  if (reviewerMatch) {
    metadata.reviewer = reviewerMatch[1].trim();
  }

  return metadata;
}

/**
 * Parse feedback document content into structured feedback
 */
function parseFeedbackContent(content: string): ReviewFeedback {
  const feedback: ReviewFeedback = {
    summary: "",
  };

  // Extract summary
  const summaryMatch = content.match(/## Summary\s*\n\n(.*?)(?=\n## |$)/s);
  if (summaryMatch) {
    feedback.summary = summaryMatch[1].trim();
  }

  // Extract approved aspects
  const approvedMatch = content.match(/## Approved Aspects\s*\n\n(.*?)(?=\n## |$)/s);
  if (approvedMatch) {
    const aspectsText = approvedMatch[1].trim();
    feedback.approvedAspects = aspectsText
      .split("\n")
      .filter((line) => line.startsWith("- "))
      .map((line) => line.substring(2).trim());
  }

  // Extract testing notes
  const testingMatch = content.match(/## Testing Notes\s*\n\n(.*?)(?=\n## |$)/s);
  if (testingMatch) {
    feedback.testingNotes = testingMatch[1].trim();
  }

  // Extract required changes
  const changesMatch = content.match(/## Required Changes\s*\n\n(.*?)(?=\n## |$)/s);
  if (changesMatch) {
    feedback.requiredChanges = parseFeedbackItems(changesMatch[1]);
  }

  // Extract suggestions
  const suggestionsMatch = content.match(/## Suggestions\s*\n\n(.*?)(?=\n## |$)/s);
  if (suggestionsMatch) {
    feedback.suggestions = parseFeedbackItems(suggestionsMatch[1]);
  }

  return feedback;
}

/**
 * Parse feedback items from section content
 */
function parseFeedbackItems(sectionContent: string): FeedbackItem[] {
  const items: FeedbackItem[] = [];
  const lines = sectionContent.split("\n");

  let currentPriority: "high" | "medium" | "low" = "medium";
  let currentItem: Partial<FeedbackItem> | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check for priority headers
    if (trimmedLine === "### High Priority") {
      currentPriority = "high";
      continue;
    }
    if (trimmedLine === "### Medium Priority") {
      currentPriority = "medium";
      continue;
    }
    if (trimmedLine === "### Low Priority") {
      currentPriority = "low";
      continue;
    }

    // Check for feedback item start (e.g., "**Code:** Description")
    const itemMatch = trimmedLine.match(/^\*\*(\w+):\*\*\s*(.+)$/);
    if (itemMatch) {
      // Finish previous item if exists
      if (currentItem?.category && currentItem.description) {
        items.push(currentItem as FeedbackItem);
      }

      // Start new item
      currentItem = {
        category: itemMatch[1].toLowerCase() as FeedbackItem["category"],
        description: itemMatch[2],
        priority: currentPriority,
      };
      continue;
    }

    // Check for location
    const locationMatch = trimmedLine.match(/^\*Location:\*\s*(.+)$/);
    if (locationMatch && currentItem) {
      currentItem.location = locationMatch[1];
      continue;
    }

    // Check for suggestion
    const suggestionMatch = trimmedLine.match(/^\*Suggestion:\*\s*(.+)$/);
    if (suggestionMatch && currentItem) {
      currentItem.suggestion = suggestionMatch[1];
    }
  }

  // Add the last item if exists
  if (currentItem?.category && currentItem.description) {
    items.push(currentItem as FeedbackItem);
  }

  return items;
}

/**
 * Read and parse existing feedback document.
 *
 * Finds and parses feedback documents for a given issue number,
 * extracting metadata and structured feedback sections for analysis.
 *
 * @param issueNumber - Issue number to find feedback document for
 * @param fileSystem - File system interface (injectable for testing)
 * @param pathOps - Path operations interface (injectable for testing)
 * @returns Promise resolving to parsed feedback document data
 *
 * @throws {FileError} When issue number is invalid
 * @throws {FileError} When feedback document is not found
 * @throws {FileError} When document parsing fails
 *
 * @example
 * ```typescript
 * const feedback = await readFeedbackDocument(123);
 * console.log('Result:', feedback.result);
 * console.log('Summary:', feedback.feedback.summary);
 * console.log('Required changes:', feedback.feedback.requiredChanges);
 * ```
 *
 * @group Core Modules
 */
export async function readFeedbackDocument(
  issueNumber: number,
  fileSystem: FileSystemInterface = defaultFileSystem,
  pathOps: PathInterface = defaultPath,
): Promise<ReviewFeedbackDocument> {
  // Validate inputs
  if (issueNumber <= 0) {
    throw ErrorFactory.file(
      ERROR_CODES.FILE_OPERATION_FAILED,
      "Issue number validation failed: must be positive",
      { issueNumber },
    );
  }

  try {
    // Find feedback document files in temp directory
    const tempDir = pathOps.resolve(tmpdir());
    const files = await fileSystem.readdir(tempDir);

    // Filter files matching the pattern
    const feedbackFiles = files
      .filter((file) => file.startsWith(`feedback-${issueNumber}-`) && file.endsWith(".md"))
      .map((file) => pathOps.join(tempDir, file))
      .sort() // Sort to get most recent (highest timestamp)
      .reverse(); // Reverse to get newest first

    if (feedbackFiles.length === 0) {
      throw ErrorFactory.file(
        ERROR_CODES.FILE_NOT_FOUND,
        `Feedback document not found for issue #${issueNumber}`,
        { issueNumber },
      );
    }

    // Read the most recent feedback document
    const filePath = feedbackFiles[0];
    const content = await fileSystem.readFile(filePath, "utf8");

    // Validate and parse the feedback document
    validateFeedbackFormat(content);
    const metadata = parseFeedbackMetadata(content);
    const feedback = parseFeedbackContent(content);

    return {
      issueNumber,
      filePath,
      result: metadata.result,
      feedback,
      created: metadata.created,
      reviewer: metadata.reviewer,
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      throw error;
    }

    throw ErrorFactory.file(
      ERROR_CODES.FILE_PARSE_FAILED,
      `Failed to read feedback document: ${error instanceof Error ? error.message : String(error)}`,
      { issueNumber, originalError: error },
    );
  }
}

/**
 * Clean up temporary files from the system temp directory.
 *
 * Removes temporary files based on age, patterns, and configuration options.
 * Supports dry run mode for previewing cleanup operations and preserving
 * work reports when needed.
 *
 * @param options - Cleanup configuration options
 * @param fileSystem - File system interface (injectable for testing)
 * @param pathOps - Path operations interface (injectable for testing)
 * @returns Promise resolving to cleanup results
 *
 * @throws {FileError} When cleanup operation fails
 * @throws {ValidationError} When options are invalid
 *
 * @example
 * ```typescript
 * // Basic cleanup (remove files older than 7 days)
 * const result = await cleanupTempFiles();
 * console.log(`Removed ${result.filesRemoved.length} files, saved ${result.spaceSaved} bytes`);
 *
 * // Dry run to preview cleanup
 * const preview = await cleanupTempFiles({ dryRun: true });
 * console.log(`Would remove: ${preview.filesRemoved.join(', ')}`);
 *
 * // Pattern-based cleanup
 * const patternResult = await cleanupTempFiles({
 *   patterns: ['work-report-*', 'feedback-*'],
 *   preserveReports: false
 * });
 * ```
 *
 * @group Core Modules
 */
export async function cleanupTempFiles(
  options: CleanupOptions = {},
  fileSystem: FileSystemInterface = defaultFileSystem,
  pathOps: PathInterface = defaultPath,
): Promise<CleanupResult> {
  // Validate options
  validateCleanupOptions(options);

  const {
    olderThan = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days default
    patterns,
    dryRun = false,
    preserveReports = false,
  } = options;

  const result: CleanupResult = {
    filesRemoved: [],
    spaceSaved: 0,
    errors: [],
  };

  try {
    // Get temp directory path
    const tempDir = tmpdir();
    const tempPath = pathOps.resolve(tempDir);

    // Check if temp directory exists and is accessible
    try {
      await fileSystem.access(tempPath);
    } catch (error) {
      // If temp directory doesn't exist, return empty result
      if (error instanceof Error && error.message.includes("ENOENT")) {
        return result;
      }
      // For other access errors, let them bubble up to be caught by outer try-catch
      throw error;
    }

    // Get list of files in temp directory
    const files = await fileSystem.readdir(tempPath);

    // Process each file
    for (const fileName of files) {
      const filePath = pathOps.join(tempPath, fileName);

      try {
        // Get file stats
        const stats = await fileSystem.stat(filePath);

        // Skip directories
        if (stats.isDirectory()) {
          continue;
        }

        // Check if file should be cleaned up
        if (shouldCleanupFile(fileName, stats, olderThan, patterns, preserveReports)) {
          if (dryRun) {
            // In dry run mode, just add to results without removing
            result.filesRemoved.push(filePath);
            result.spaceSaved += stats.size;
          } else {
            // Actually remove the file
            try {
              await fileSystem.unlink(filePath);
              result.filesRemoved.push(filePath);
              result.spaceSaved += stats.size;
            } catch (unlinkError) {
              // Record error but continue cleanup
              result.errors.push({
                path: filePath,
                error: unlinkError instanceof Error ? unlinkError.message : String(unlinkError),
              });
            }
          }
        }
      } catch (statError) {
        // Record error for individual file and continue
        result.errors.push({
          path: filePath,
          error: `Failed to get file stats: ${
            statError instanceof Error ? statError.message : String(statError)
          }`,
        });
      }
    }

    return result;
  } catch (error) {
    throw ErrorFactory.file(
      ERROR_CODES.FILE_CLEANUP_FAILED,
      `Failed to clean up temp files: ${error instanceof Error ? error.message : String(error)}`,
      { options, originalError: error },
    );
  }
}

/**
 * Validate cleanup options
 */
function validateCleanupOptions(options: CleanupOptions): void {
  if (options.olderThan && Number.isNaN(options.olderThan.getTime())) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "olderThan date validation failed: invalid date",
      { olderThan: options.olderThan },
    );
  }

  if (options.patterns) {
    if (!Array.isArray(options.patterns)) {
      throw ErrorFactory.core(
        ERROR_CODES.CORE_INVALID_PARAMETERS,
        "patterns validation failed: must be an array",
        { patterns: options.patterns },
      );
    }

    // Check for empty or whitespace-only patterns
    const invalidPatterns = options.patterns.filter(
      (pattern) => typeof pattern !== "string" || pattern.trim() === "",
    );
    if (invalidPatterns.length > 0) {
      throw ErrorFactory.core(
        ERROR_CODES.CORE_INVALID_PARAMETERS,
        "patterns validation failed: contains empty or invalid patterns",
        { invalidPatterns },
      );
    }
  }
}

/**
 * Determine if a file should be cleaned up based on filters
 */
function shouldCleanupFile(
  fileName: string,
  stats: { mtime: Date },
  olderThan: Date,
  patterns: string[] | undefined,
  preserveReports: boolean,
): boolean {
  // Check age filter
  if (stats.mtime >= olderThan) {
    return false;
  }

  // Check preserve reports filter
  if (
    preserveReports &&
    (fileName.startsWith("work-report-") || fileName.startsWith("feedback-"))
  ) {
    return false;
  }

  // Check pattern filter
  if (patterns !== undefined) {
    if (patterns.length === 0) {
      // Empty patterns array means match nothing
      return false;
    }

    const matchesPattern = patterns.some((pattern) => matchGlob(fileName, pattern));
    if (!matchesPattern) {
      return false;
    }
  }
  // If patterns is undefined, no pattern filter is applied

  return true;
}

/**
 * Simple glob pattern matching for file names
 * Supports * wildcard and basic patterns
 */
function matchGlob(fileName: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape regex special chars
    .replace(/\*/g, ".*"); // Convert * to .*

  const regex = new RegExp(`^${regexPattern}$`, "i");
  return regex.test(fileName);
}
