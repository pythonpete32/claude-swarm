/**
 * Unit tests for core Files module
 *
 * Tests all file operations with mocked filesystem execution
 * to ensure isolation and deterministic results.
 * Uses Test-Driven Development (TDD) methodology.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ClaudeContextStatus,
  type CleanupOptions,
  type CleanupResult,
  type CopyContextOptions,
  type CreateFeedbackOptions,
  type CreateWorkReportOptions,
  type FileSystemInterface,
  type PathInterface,
  type ReviewFeedbackDocument,
  type StructureValidation,
  type WorkReport,
  cleanupTempFiles,
  copyClaudeContext,
  createFeedbackDocument,
  createTempDirectory,
  createWorkReport,
  ensureClaudeContext,
  readFeedbackDocument,
  readWorkReport,
  validateFileStructure,
} from "../../../src/core/files";
import { ERROR_CODES } from "../../../src/shared/errors";

// Mock filesystem for testing
class MockFileSystem implements FileSystemInterface {
  private files = new Map<
    string,
    { content?: string; isDirectory: boolean; mtime: Date; size: number }
  >();
  private shouldThrow = new Map<string, Error>();
  private callLog: Array<{ method: string; args: unknown[] }> = [];

  constructor() {
    this.reset();
  }

  // Mock data setup methods
  setFile(path: string, content: string, mtime = new Date(), size = content.length): void {
    this.files.set(path, { content, isDirectory: false, mtime, size });
  }

  setDirectory(path: string, mtime = new Date()): void {
    this.files.set(path, { isDirectory: true, mtime, size: 0 });
  }

  setError(method: string, path: string, error: Error): void {
    this.shouldThrow.set(`${method}:${path}`, error);
  }

  getCallLog(): Array<{ method: string; args: unknown[] }> {
    return [...this.callLog];
  }

  reset(): void {
    this.files.clear();
    this.shouldThrow.clear();
    this.callLog = [];
  }

  // FileSystemInterface implementation
  async access(path: string): Promise<void> {
    this.callLog.push({ method: "access", args: [path] });

    const error = this.shouldThrow.get(`access:${path}`);
    if (error) throw error;

    if (!this.files.has(path)) {
      const enoentError = new Error(`ENOENT: no such file or directory, access '${path}'`);
      (enoentError as Error & { code: string }).code = "ENOENT";
      throw enoentError;
    }
  }

  async copyFile(source: string, target: string): Promise<void> {
    this.callLog.push({ method: "copyFile", args: [source, target] });

    const error =
      this.shouldThrow.get(`copyFile:${source}`) || this.shouldThrow.get(`copyFile:${target}`);
    if (error) throw error;

    const sourceFile = this.files.get(source);
    if (!sourceFile || sourceFile.isDirectory) {
      const enoentError = new Error(`ENOENT: no such file or directory, open '${source}'`);
      (enoentError as Error & { code: string }).code = "ENOENT";
      throw enoentError;
    }

    this.files.set(target, { ...sourceFile });
  }

  async readFile(path: string, encoding: string): Promise<string> {
    this.callLog.push({ method: "readFile", args: [path, encoding] });

    const error = this.shouldThrow.get(`readFile:${path}`);
    if (error) throw error;

    const file = this.files.get(path);
    if (!file || file.isDirectory) {
      const enoentError = new Error(`ENOENT: no such file or directory, open '${path}'`);
      (enoentError as Error & { code: string }).code = "ENOENT";
      throw enoentError;
    }

    return file.content || "";
  }

  async writeFile(path: string, content: string, encoding: string): Promise<void> {
    this.callLog.push({ method: "writeFile", args: [path, content, encoding] });

    const error = this.shouldThrow.get(`writeFile:${path}`) || this.shouldThrow.get("writeFile:");
    if (error) throw error;

    this.files.set(path, { content, isDirectory: false, mtime: new Date(), size: content.length });
  }

  async mkdir(path: string, options: { recursive: boolean }): Promise<void> {
    this.callLog.push({ method: "mkdir", args: [path, options] });

    const error = this.shouldThrow.get(`mkdir:${path}`) || this.shouldThrow.get("mkdir:");
    if (error) throw error;

    this.files.set(path, { isDirectory: true, mtime: new Date(), size: 0 });
  }

  async readdir(path: string): Promise<string[]> {
    this.callLog.push({ method: "readdir", args: [path] });

    const error = this.shouldThrow.get(`readdir:${path}`);
    if (error) throw error;

    if (!this.files.has(path)) {
      const enoentError = new Error(`ENOENT: no such file or directory, scandir '${path}'`);
      (enoentError as Error & { code: string }).code = "ENOENT";
      throw enoentError;
    }

    const file = this.files.get(path);
    if (!file) {
      const enoentError = new Error(`ENOENT: no such file or directory, scandir '${path}'`);
      (enoentError as Error & { code: string }).code = "ENOENT";
      throw enoentError;
    }
    if (!file.isDirectory) {
      const enotdirError = new Error(`ENOTDIR: not a directory, scandir '${path}'`);
      (enotdirError as Error & { code: string }).code = "ENOTDIR";
      throw enotdirError;
    }

    // Return child files based on path prefix - enhanced for better nested support
    const children: string[] = [];
    const pathPrefix = path === "/" ? "/" : `${path}/`;
    const normalizedPath = path.replace(/\/+$/, ""); // Remove trailing slashes

    for (const [filePath] of this.files) {
      if (
        filePath !== path &&
        (filePath.startsWith(pathPrefix) || (normalizedPath === "" && !filePath.startsWith("/")))
      ) {
        const relativePath = filePath.substring(pathPrefix.length);
        // Only include direct children (no subdirectory paths)
        if (relativePath && !relativePath.includes("/")) {
          children.push(relativePath);
        }
      }
    }

    return children.sort();
  }

  // Helper method to set up nested directory structures more easily
  setNestedStructure(basePath: string, structure: Record<string, string | null>): void {
    // Ensure base directory exists
    this.setDirectory(basePath);

    for (const [relativePath, content] of Object.entries(structure)) {
      const fullPath = this.join(basePath, relativePath);
      if (content === null) {
        // Directory
        this.setDirectory(fullPath);
      } else {
        // File with content
        this.setFile(fullPath, content);
      }
    }
  }

  // Helper method for path joining (mirrors MockPath behavior)
  private join(...paths: string[]): string {
    return paths.filter((p) => p).join("/");
  }

  async stat(
    path: string,
  ): Promise<{ isDirectory(): boolean; isFile(): boolean; mtime: Date; size: number }> {
    this.callLog.push({ method: "stat", args: [path] });

    const error = this.shouldThrow.get(`stat:${path}`);
    if (error) throw error;

    const file = this.files.get(path);
    if (!file) {
      const enoentError = new Error(`ENOENT: no such file or directory, stat '${path}'`);
      (enoentError as Error & { code: string }).code = "ENOENT";
      throw enoentError;
    }

    return {
      isDirectory: () => file.isDirectory,
      isFile: () => !file.isDirectory,
      mtime: file.mtime,
      size: file.size,
    };
  }

  async unlink(path: string): Promise<void> {
    this.callLog.push({ method: "unlink", args: [path] });

    const error = this.shouldThrow.get(`unlink:${path}`);
    if (error) throw error;

    if (!this.files.has(path)) {
      const enoentError = new Error(`ENOENT: no such file or directory, unlink '${path}'`);
      (enoentError as Error & { code: string }).code = "ENOENT";
      throw enoentError;
    }

    this.files.delete(path);
  }
}

// Mock path operations for testing
class MockPath implements PathInterface {
  private separator = "/";
  private callLog: Array<{ method: string; args: unknown[] }> = [];

  getCallLog(): Array<{ method: string; args: unknown[] }> {
    return [...this.callLog];
  }

  reset(): void {
    this.callLog = [];
  }

  join(...paths: string[]): string {
    this.callLog.push({ method: "join", args: paths });

    // Filter out empty strings and handle path normalization
    const validPaths = paths.filter((p) => p && p !== ".");
    if (validPaths.length === 0) return ".";

    // Join paths and normalize
    let result = validPaths.join(this.separator);

    // Handle multiple consecutive separators
    result = result.replace(/\/+/g, "/");

    // Handle trailing separators (keep for root, remove for others)
    if (result !== "/" && result.endsWith("/")) {
      result = result.slice(0, -1);
    }

    return result;
  }

  resolve(...paths: string[]): string {
    this.callLog.push({ method: "resolve", args: paths });

    // If no paths provided, return mock temp directory
    if (paths.length === 0) {
      return "/tmp";
    }

    // Handle system temp directory patterns
    if (
      paths.length === 1 &&
      (paths[0] === "/tmp" || paths[0].startsWith("/var/folders") || paths[0].startsWith("/tmp/"))
    ) {
      return "/tmp";
    }

    // Start with empty base for absolute path resolution
    let resolved = "";

    for (const p of paths) {
      if (!p) continue;

      if (p.startsWith("/")) {
        // Absolute path - replace everything
        resolved = p;
      } else {
        // Relative path - join with current resolved path
        resolved = resolved ? this.join(resolved, p) : p;
      }
    }

    // Normalize ".." and "." segments
    const segments = resolved.split("/").filter((seg) => seg !== "");
    const normalizedSegments: string[] = [];

    for (const segment of segments) {
      if (segment === "..") {
        if (
          normalizedSegments.length > 0 &&
          normalizedSegments[normalizedSegments.length - 1] !== ".."
        ) {
          normalizedSegments.pop();
        } else if (!resolved.startsWith("/")) {
          normalizedSegments.push("..");
        }
      } else if (segment !== ".") {
        normalizedSegments.push(segment);
      }
    }

    const result = resolved.startsWith("/")
      ? `/${normalizedSegments.join("/")}`
      : normalizedSegments.join("/") || ".";

    return result === "//" ? "/" : result;
  }

  dirname(path: string): string {
    this.callLog.push({ method: "dirname", args: [path] });
    const lastSlash = path.lastIndexOf(this.separator);
    return lastSlash === -1 ? "." : path.substring(0, lastSlash) || this.separator;
  }

  basename(path: string): string {
    this.callLog.push({ method: "basename", args: [path] });
    const lastSlash = path.lastIndexOf(this.separator);
    return lastSlash === -1 ? path : path.substring(lastSlash + 1);
  }

  extname(path: string): string {
    this.callLog.push({ method: "extname", args: [path] });
    const lastDot = path.lastIndexOf(".");
    const lastSlash = path.lastIndexOf(this.separator);
    return lastDot > lastSlash ? path.substring(lastDot) : "";
  }
}

describe("core-files", () => {
  let mockFileSystem: MockFileSystem;
  let mockPath: MockPath;
  const testProjectPath = "/test/project";
  const testSourcePath = "/test/source";

  beforeEach(() => {
    mockFileSystem = new MockFileSystem();
    mockPath = new MockPath();
  });

  describe("validateFileStructure", () => {
    it("should return valid structure when all components present", async () => {
      // Arrange: Set up complete project structure
      mockFileSystem.setDirectory(testProjectPath);
      mockFileSystem.setDirectory("/test/project/.git");
      mockFileSystem.setFile("/test/project/CLAUDE.md", "# Test project");
      mockFileSystem.setDirectory("/test/project/.claude");
      mockFileSystem.setFile("/test/project/package.json", "{}");

      // Act
      const result = await validateFileStructure(testProjectPath, mockFileSystem, mockPath);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.hasGitRepo).toBe(true);
      expect(result.hasClaudeContext).toBe(true);
      expect(result.hasPackageConfig).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it("should identify missing git repository", async () => {
      // Arrange: Project without git
      mockFileSystem.setDirectory(testProjectPath);
      mockFileSystem.setFile("/test/project/CLAUDE.md", "# Test project");
      mockFileSystem.setDirectory("/test/project/.claude");
      mockFileSystem.setFile("/test/project/package.json", "{}");

      // Act
      const result = await validateFileStructure(testProjectPath, mockFileSystem, mockPath);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.hasGitRepo).toBe(false);
      expect(result.issues).toContain("No git repository found (.git directory missing)");
    });

    it("should identify missing CLAUDE.md", async () => {
      // Arrange: Project without CLAUDE.md
      mockFileSystem.setDirectory(testProjectPath);
      mockFileSystem.setDirectory("/test/project/.git");
      mockFileSystem.setDirectory("/test/project/.claude");
      mockFileSystem.setFile("/test/project/package.json", "{}");

      // Act
      const result = await validateFileStructure(testProjectPath, mockFileSystem, mockPath);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.hasClaudeContext).toBe(false);
      expect(result.issues).toContain("CLAUDE.md file missing");
    });

    it("should identify missing .claude directory", async () => {
      // Arrange: Project without .claude directory
      mockFileSystem.setDirectory(testProjectPath);
      mockFileSystem.setDirectory("/test/project/.git");
      mockFileSystem.setFile("/test/project/CLAUDE.md", "# Test project");
      mockFileSystem.setFile("/test/project/package.json", "{}");

      // Act
      const result = await validateFileStructure(testProjectPath, mockFileSystem, mockPath);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.hasClaudeContext).toBe(false);
      expect(result.issues).toContain(".claude directory missing");
    });

    it("should identify missing package configuration", async () => {
      // Arrange: Project without package files
      mockFileSystem.setDirectory(testProjectPath);
      mockFileSystem.setDirectory("/test/project/.git");
      mockFileSystem.setFile("/test/project/CLAUDE.md", "# Test project");
      mockFileSystem.setDirectory("/test/project/.claude");

      // Act
      const result = await validateFileStructure(testProjectPath, mockFileSystem, mockPath);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.hasPackageConfig).toBe(false);
      expect(result.issues).toContain(
        "No package configuration found (package.json, tsconfig.json, or Cargo.toml)",
      );
    });

    it("should accept tsconfig.json as package configuration", async () => {
      // Arrange: Project with tsconfig.json instead of package.json
      mockFileSystem.setDirectory(testProjectPath);
      mockFileSystem.setDirectory("/test/project/.git");
      mockFileSystem.setFile("/test/project/CLAUDE.md", "# Test project");
      mockFileSystem.setDirectory("/test/project/.claude");
      mockFileSystem.setFile("/test/project/tsconfig.json", "{}");

      // Act
      const result = await validateFileStructure(testProjectPath, mockFileSystem, mockPath);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.hasPackageConfig).toBe(true);
    });

    it("should accept Cargo.toml as package configuration", async () => {
      // Arrange: Rust project with Cargo.toml
      mockFileSystem.setDirectory(testProjectPath);
      mockFileSystem.setDirectory("/test/project/.git");
      mockFileSystem.setFile("/test/project/CLAUDE.md", "# Test project");
      mockFileSystem.setDirectory("/test/project/.claude");
      mockFileSystem.setFile("/test/project/Cargo.toml", "[package]");

      // Act
      const result = await validateFileStructure(testProjectPath, mockFileSystem, mockPath);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.hasPackageConfig).toBe(true);
    });

    it("should throw error for non-existent project directory", async () => {
      // Arrange: No project directory

      // Act & Assert
      await expect(
        validateFileStructure(testProjectPath, mockFileSystem, mockPath),
      ).rejects.toThrow("Project directory not found");
    });

    it("should throw error for invalid project path", async () => {
      // Act & Assert
      await expect(validateFileStructure("", mockFileSystem, mockPath)).rejects.toThrow(
        "Project path validation failed",
      );
    });
  });

  describe("ensureClaudeContext", () => {
    it("should return complete status when context already exists", async () => {
      // Arrange: Target has complete context
      mockFileSystem.setDirectory(testProjectPath);
      mockFileSystem.setFile("/test/project/CLAUDE.md", "# Existing");
      mockFileSystem.setDirectory("/test/project/.claude");

      // Act
      const result = await ensureClaudeContext(
        testProjectPath,
        testSourcePath,
        mockFileSystem,
        mockPath,
      );

      // Assert
      expect(result.isComplete).toBe(true);
      expect(result.claudeMdExists).toBe(true);
      expect(result.claudeDirExists).toBe(true);
      expect(result.copiedFiles).toHaveLength(0);
    });

    it("should copy missing CLAUDE.md from source", async () => {
      // Arrange: Target missing CLAUDE.md, source has it
      mockFileSystem.setDirectory(testProjectPath);
      mockFileSystem.setDirectory("/test/project/.claude");
      mockFileSystem.setDirectory(testSourcePath);
      mockFileSystem.setFile("/test/source/CLAUDE.md", "# Source CLAUDE.md");

      // Act
      const result = await ensureClaudeContext(
        testProjectPath,
        testSourcePath,
        mockFileSystem,
        mockPath,
      );

      // Assert
      expect(result.claudeMdExists).toBe(true);
      expect(result.copiedFiles).toContain("/test/project/CLAUDE.md");

      // Verify copy operation was called
      const callLog = mockFileSystem.getCallLog();
      const copyCall = callLog.find((call) => call.method === "copyFile");
      expect(copyCall).toBeDefined();
      expect(copyCall?.args).toEqual(["/test/source/CLAUDE.md", "/test/project/CLAUDE.md"]);
    });

    it("should copy missing .claude directory from source", async () => {
      // Arrange: Target missing .claude directory, source has it
      mockFileSystem.setDirectory(testProjectPath);
      mockFileSystem.setFile("/test/project/CLAUDE.md", "# Existing");
      mockFileSystem.setDirectory(testSourcePath);
      mockFileSystem.setDirectory("/test/source/.claude");
      mockFileSystem.setFile("/test/source/.claude/config.json", "{}");

      // Act
      const result = await ensureClaudeContext(
        testProjectPath,
        testSourcePath,
        mockFileSystem,
        mockPath,
      );

      // Assert
      expect(result.claudeDirExists).toBe(true);
      expect(result.copiedFiles).toContain("/test/project/.claude");
    });

    it("should handle missing source CLAUDE.md gracefully", async () => {
      // Arrange: Source doesn't have CLAUDE.md
      mockFileSystem.setDirectory(testProjectPath);
      mockFileSystem.setDirectory("/test/project/.claude");
      mockFileSystem.setDirectory(testSourcePath);

      // Act
      const result = await ensureClaudeContext(
        testProjectPath,
        testSourcePath,
        mockFileSystem,
        mockPath,
      );

      // Assert
      expect(result.claudeMdExists).toBe(false);
      expect(result.copiedFiles).not.toContain("/test/project/CLAUDE.md");
    });

    it("should handle missing source .claude directory gracefully", async () => {
      // Arrange: Source doesn't have .claude directory
      mockFileSystem.setDirectory(testProjectPath);
      mockFileSystem.setFile("/test/project/CLAUDE.md", "# Existing");
      mockFileSystem.setDirectory(testSourcePath);

      // Act
      const result = await ensureClaudeContext(
        testProjectPath,
        testSourcePath,
        mockFileSystem,
        mockPath,
      );

      // Assert
      expect(result.claudeDirExists).toBe(false);
      expect(result.copiedFiles).not.toContain("/test/project/.claude");
    });

    it("should throw error for non-existent target directory", async () => {
      // Arrange: No target directory

      // Act & Assert
      await expect(
        ensureClaudeContext(testProjectPath, testSourcePath, mockFileSystem, mockPath),
      ).rejects.toThrow("Directory not found");
    });

    it("should throw error for permission denied", async () => {
      // Arrange: Permission error
      mockFileSystem.setDirectory(testProjectPath);
      const permissionError = new Error("EACCES: permission denied");
      (permissionError as Error & { code: string }).code = "EACCES";
      mockFileSystem.setError("access", testProjectPath, permissionError);

      // Act & Assert
      await expect(
        ensureClaudeContext(testProjectPath, testSourcePath, mockFileSystem, mockPath),
      ).rejects.toThrow("Permission denied");
    });

    it("should throw error for invalid paths", async () => {
      // Act & Assert
      await expect(
        ensureClaudeContext("", testSourcePath, mockFileSystem, mockPath),
      ).rejects.toThrow("Target path validation");

      await expect(
        ensureClaudeContext(testProjectPath, "", mockFileSystem, mockPath),
      ).rejects.toThrow("Source path validation");
    });
  });

  describe("createTempDirectory", () => {
    it("should create unique temporary directory with prefix", async () => {
      // Act
      const result = await createTempDirectory("test-prefix", mockFileSystem, mockPath);

      // Assert - Check that the result contains the expected pattern components
      expect(result).toContain("test-prefix-");
      expect(result).toMatch(/-\d+-[a-z0-9]+$/);

      // Verify mkdir was called
      const callLog = mockFileSystem.getCallLog();
      const mkdirCall = callLog.find((call) => call.method === "mkdir");
      expect(mkdirCall).toBeDefined();
      expect(mkdirCall?.args[1]).toEqual({ recursive: true });
    });

    it("should use default prefix when none provided", async () => {
      // Act
      const result = await createTempDirectory(undefined, mockFileSystem, mockPath);

      // Assert - Check that the result contains the default prefix
      expect(result).toContain("claude-swarm-");
      expect(result).toMatch(/-\d+-[a-z0-9]+$/);
    });

    it("should throw error when mkdir fails", async () => {
      // Create a custom mock that will fail on mkdir
      const failingMockFileSystem = new MockFileSystem();
      failingMockFileSystem.setError("mkdir", "", new Error("Permission denied"));

      // Act & Assert
      await expect(
        createTempDirectory("test-prefix", failingMockFileSystem, mockPath),
      ).rejects.toThrow("Failed to create temporary directory");
    });
  });

  describe("copyClaudeContext", () => {
    it("should copy all Claude context files with default options", async () => {
      // Arrange: Source has complete context
      mockFileSystem.setDirectory(testSourcePath);
      mockFileSystem.setFile("/test/source/CLAUDE.md", "# Source CLAUDE.md content");
      mockFileSystem.setDirectory("/test/source/.claude");
      mockFileSystem.setFile("/test/source/.claude/config.json", '{"test": true}');
      mockFileSystem.setDirectory("/test/source/.claude/commands");
      mockFileSystem.setFile("/test/source/.claude/commands/test.json", '{"name": "test"}');
      mockFileSystem.setFile("/test/source/.claude/.local.json", '{"local": true}');

      mockFileSystem.setDirectory(testProjectPath);

      // Act
      const result = await copyClaudeContext(
        testSourcePath,
        testProjectPath,
        {},
        mockFileSystem,
        mockPath,
      );

      // Assert
      expect(result).toContain("/test/project/CLAUDE.md");
      expect(result).toContain("/test/project/.claude");

      // Verify file copy operations
      const callLog = mockFileSystem.getCallLog();
      const copyCall = callLog.find(
        (call) => call.method === "copyFile" && call.args[0] === "/test/source/CLAUDE.md",
      );
      expect(copyCall).toBeDefined();
    });

    it("should skip existing files when overwrite is false", async () => {
      // Arrange: Source and target both have CLAUDE.md
      mockFileSystem.setDirectory(testSourcePath);
      mockFileSystem.setFile("/test/source/CLAUDE.md", "# Source content");
      mockFileSystem.setDirectory(testProjectPath);
      mockFileSystem.setFile("/test/project/CLAUDE.md", "# Existing content");

      // Act
      const result = await copyClaudeContext(
        testSourcePath,
        testProjectPath,
        { overwrite: false },
        mockFileSystem,
        mockPath,
      );

      // Assert - Should not include CLAUDE.md in copied files
      expect(result).not.toContain("/test/project/CLAUDE.md");
    });

    it("should overwrite existing files when overwrite is true", async () => {
      // Arrange: Source and target both have CLAUDE.md
      mockFileSystem.setDirectory(testSourcePath);
      mockFileSystem.setFile("/test/source/CLAUDE.md", "# Source content");
      mockFileSystem.setDirectory(testProjectPath);
      mockFileSystem.setFile("/test/project/CLAUDE.md", "# Existing content");

      // Act
      const result = await copyClaudeContext(
        testSourcePath,
        testProjectPath,
        { overwrite: true },
        mockFileSystem,
        mockPath,
      );

      // Assert - Should include CLAUDE.md in copied files
      expect(result).toContain("/test/project/CLAUDE.md");
    });

    it("should preserve local files when preserveLocal is true", async () => {
      // Arrange: Source has .local.json file
      mockFileSystem.setDirectory(testSourcePath);
      mockFileSystem.setDirectory("/test/source/.claude");
      mockFileSystem.setFile("/test/source/.claude/.local.json", '{"local": true}');
      mockFileSystem.setFile("/test/source/.claude/config.json", '{"config": true}');

      mockFileSystem.setDirectory(testProjectPath);

      // Act
      const result = await copyClaudeContext(
        testSourcePath,
        testProjectPath,
        { preserveLocal: true },
        mockFileSystem,
        mockPath,
      );

      // Assert - Should copy config.json but not .local.json
      expect(result).toContain("/test/project/.claude");

      const callLog = mockFileSystem.getCallLog();
      const localCopyCall = callLog.find(
        (call) => call.method === "copyFile" && call.args[0]?.toString().includes(".local.json"),
      );
      expect(localCopyCall).toBeUndefined();
    });

    it("should include commands directory when includeCommands is true", async () => {
      // Arrange: Source has commands directory
      mockFileSystem.setDirectory(testSourcePath);
      mockFileSystem.setDirectory("/test/source/.claude");
      mockFileSystem.setDirectory("/test/source/.claude/commands");
      mockFileSystem.setFile("/test/source/.claude/commands/test.json", '{"name": "test"}');

      mockFileSystem.setDirectory(testProjectPath);

      // Act
      const result = await copyClaudeContext(
        testSourcePath,
        testProjectPath,
        { includeCommands: true },
        mockFileSystem,
        mockPath,
      );

      // Assert
      expect(result).toContain("/test/project/.claude");
    });

    it("should skip commands directory when includeCommands is false", async () => {
      // Arrange: Source has commands directory
      mockFileSystem.setDirectory(testSourcePath);
      mockFileSystem.setDirectory("/test/source/.claude");
      mockFileSystem.setDirectory("/test/source/.claude/commands");
      mockFileSystem.setFile("/test/source/.claude/commands/test.json", '{"name": "test"}');
      mockFileSystem.setFile("/test/source/.claude/config.json", '{"config": true}');

      mockFileSystem.setDirectory(testProjectPath);

      // Act
      const result = await copyClaudeContext(
        testSourcePath,
        testProjectPath,
        { includeCommands: false },
        mockFileSystem,
        mockPath,
      );

      // Assert - Should copy .claude but not commands subdirectory
      expect(result).toContain("/test/project/.claude");

      const callLog = mockFileSystem.getCallLog();
      const commandsCopyCall = callLog.find(
        (call) => call.method === "copyFile" && call.args[0]?.toString().includes("commands/"),
      );
      expect(commandsCopyCall).toBeUndefined();
    });

    it("should handle missing source CLAUDE.md gracefully", async () => {
      // Arrange: Source without CLAUDE.md
      mockFileSystem.setDirectory(testSourcePath);
      mockFileSystem.setDirectory("/test/source/.claude");
      mockFileSystem.setFile("/test/source/.claude/config.json", '{"config": true}');

      mockFileSystem.setDirectory(testProjectPath);

      // Act
      const result = await copyClaudeContext(
        testSourcePath,
        testProjectPath,
        {},
        mockFileSystem,
        mockPath,
      );

      // Assert - Should still copy .claude directory
      expect(result).toContain("/test/project/.claude");
      expect(result).not.toContain("/test/project/CLAUDE.md");
    });

    it("should handle missing source .claude directory gracefully", async () => {
      // Arrange: Source without .claude directory
      mockFileSystem.setDirectory(testSourcePath);
      mockFileSystem.setFile("/test/source/CLAUDE.md", "# Content");

      mockFileSystem.setDirectory(testProjectPath);

      // Act
      const result = await copyClaudeContext(
        testSourcePath,
        testProjectPath,
        {},
        mockFileSystem,
        mockPath,
      );

      // Assert - Should only copy CLAUDE.md
      expect(result).toContain("/test/project/CLAUDE.md");
      expect(result).not.toContain("/test/project/.claude");
    });

    it("should throw error for non-existent source directory", async () => {
      // Arrange: No source directory
      mockFileSystem.setDirectory(testProjectPath);

      // Act & Assert
      await expect(
        copyClaudeContext(testSourcePath, testProjectPath, {}, mockFileSystem, mockPath),
      ).rejects.toThrow("not found");
    });

    it("should throw error for non-existent target directory", async () => {
      // Arrange: No target directory
      mockFileSystem.setDirectory(testSourcePath);

      // Act & Assert
      await expect(
        copyClaudeContext(testSourcePath, testProjectPath, {}, mockFileSystem, mockPath),
      ).rejects.toThrow("not found");
    });

    it("should throw error for invalid paths", async () => {
      // Act & Assert
      await expect(
        copyClaudeContext("", testProjectPath, {}, mockFileSystem, mockPath),
      ).rejects.toThrow("validation");

      await expect(
        copyClaudeContext(testSourcePath, "", {}, mockFileSystem, mockPath),
      ).rejects.toThrow("validation");
    });
  });

  describe("createWorkReport", () => {
    const baseOptions: CreateWorkReportOptions = {
      issueNumber: 123,
      workTreePath: testProjectPath,
      repositoryInfo: {
        owner: "test",
        name: "repo",
        path: testProjectPath,
        defaultBranch: "main",
        remoteUrl: "https://github.com/test/repo.git",
      },
      branchInfo: {
        name: "feature/test-123",
        commit: "abc123def456",
        isDefault: false,
        isLocal: true,
        isRemote: false,
        isClean: true,
      },
    };

    beforeEach(() => {
      // Set up basic directory structure
      mockFileSystem.setDirectory(testProjectPath);
    });

    it("should create work report with minimal options", async () => {
      // Act
      const result = await createWorkReport(baseOptions, mockFileSystem, mockPath);

      // Assert
      expect(result).toMatch(/work-report-123-\d+\.md$/);

      // Verify file was written
      const callLog = mockFileSystem.getCallLog();
      const writeCall = callLog.find((call) => call.method === "writeFile");
      expect(writeCall).toBeDefined();
      expect(writeCall?.args[0]).toEqual(result);
    });

    it("should include summary in work report when provided", async () => {
      // Arrange
      const optionsWithSummary = {
        ...baseOptions,
        summary: "Implemented new feature functionality",
      };

      // Act
      const _result = await createWorkReport(optionsWithSummary, mockFileSystem, mockPath);

      // Assert
      const callLog = mockFileSystem.getCallLog();
      const writeCall = callLog.find((call) => call.method === "writeFile");
      expect(writeCall?.args[1]).toContain("Implemented new feature functionality");
    });

    it("should include git diff when includeGitDiff is true", async () => {
      // Arrange
      const optionsWithDiff = {
        ...baseOptions,
        includeGitDiff: true,
      };

      // Act
      const _result = await createWorkReport(optionsWithDiff, mockFileSystem, mockPath);

      // Assert
      const callLog = mockFileSystem.getCallLog();
      const writeCall = callLog.find((call) => call.method === "writeFile");
      expect(writeCall?.args[1]).toContain("## Git Diff");
    });

    it("should include testing section when includeTesting is true", async () => {
      // Arrange
      const optionsWithTesting = {
        ...baseOptions,
        includeTesting: true,
      };

      // Act
      const _result = await createWorkReport(optionsWithTesting, mockFileSystem, mockPath);

      // Assert
      const callLog = mockFileSystem.getCallLog();
      const writeCall = callLog.find((call) => call.method === "writeFile");
      expect(writeCall?.args[1]).toContain("## Testing");
    });

    it("should format report content with metadata", async () => {
      // Act
      const _result = await createWorkReport(baseOptions, mockFileSystem, mockPath);

      // Assert
      const callLog = mockFileSystem.getCallLog();
      const writeCall = callLog.find((call) => call.method === "writeFile");
      const content = writeCall?.args[1] as string;

      expect(content).toContain("# Work Report - Issue #123");
      expect(content).toContain("**Repository:** test/repo");
      expect(content).toContain("**Branch:** feature/test-123");
      expect(content).toContain("**Commit:** abc123def456");
    });

    it("should handle temporary directory creation failure", async () => {
      // Arrange: Mock temp directory creation to fail by making mkdir fail for any path
      const failingMockFileSystem = new MockFileSystem();
      failingMockFileSystem.setError("mkdir", "", new Error("Permission denied"));

      // Act & Assert
      await expect(createWorkReport(baseOptions, failingMockFileSystem, mockPath)).rejects.toThrow(
        "Failed to create work report",
      );
    });

    it("should validate issue number", async () => {
      // Arrange
      const invalidOptions = { ...baseOptions, issueNumber: -1 };

      // Act & Assert
      await expect(createWorkReport(invalidOptions, mockFileSystem, mockPath)).rejects.toThrow(
        "validation",
      );
    });

    it("should validate work tree path", async () => {
      // Arrange
      const invalidOptions = { ...baseOptions, workTreePath: "" };

      // Act & Assert
      await expect(createWorkReport(invalidOptions, mockFileSystem, mockPath)).rejects.toThrow(
        "validation",
      );
    });
  });

  describe("readWorkReport", () => {
    const sampleReportContent = `# Work Report - Issue #123

**Created:** 2024-01-15T10:30:00.000Z
**Repository:** test/repo
**Branch:** feature/test-123
**Worktree:** /test/project

## Summary

Implemented new feature functionality with comprehensive tests.

## Changes

- Added new API endpoint
- Updated documentation
- Fixed related bugs

## Testing

All tests pass with 95% coverage.

## Notes

Ready for review.`;

    beforeEach(() => {
      // Set up work report directory and file
      mockFileSystem.setDirectory("/tmp");
      mockFileSystem.setFile("/tmp/work-report-123-1234567890.md", sampleReportContent);
    });

    it("should read and parse existing work report", async () => {
      // Act
      const result = await readWorkReport(123, mockFileSystem, mockPath);

      // Assert
      expect(result.issueNumber).toBe(123);
      expect(result.content).toBe(sampleReportContent);
      expect(result.metadata.repository).toBe("test/repo");
      expect(result.metadata.branch).toBe("feature/test-123");
      expect(result.sections.summary).toContain("Implemented new feature functionality");
    });

    it("should parse work report metadata correctly", async () => {
      // Act
      const result = await readWorkReport(123, mockFileSystem, mockPath);

      // Assert
      expect(result.metadata.created).toBeInstanceOf(Date);
      expect(result.metadata.repository).toBe("test/repo");
      expect(result.metadata.branch).toBe("feature/test-123");
      expect(result.metadata.worktree).toBe("/test/project");
    });

    it("should parse work report sections correctly", async () => {
      // Act
      const result = await readWorkReport(123, mockFileSystem, mockPath);

      // Assert
      expect(result.sections.summary).toContain("Implemented new feature functionality");
      expect(result.sections.changes).toContain("Added new API endpoint");
      expect(result.sections.testing).toContain("All tests pass");
      expect(result.sections.notes).toContain("Ready for review");
    });

    it("should throw error when work report not found", async () => {
      // Arrange: Empty temp directory (no work report files)
      mockFileSystem.reset();
      mockFileSystem.setDirectory("/tmp");

      // Act & Assert
      await expect(readWorkReport(999, mockFileSystem, mockPath)).rejects.toThrow(
        "Work report not found",
      );
    });

    it("should throw error when work report is malformed", async () => {
      // Arrange: Malformed report content that should fail parsing
      mockFileSystem.setDirectory("/tmp");
      mockFileSystem.setFile(
        "/tmp/work-report-123-1234567890.md",
        "Invalid content without proper header",
      );

      // Act & Assert
      await expect(readWorkReport(123, mockFileSystem, mockPath)).rejects.toThrow(
        "Failed to parse work report",
      );
    });

    it("should validate issue number", async () => {
      // Act & Assert
      await expect(readWorkReport(-1, mockFileSystem, mockPath)).rejects.toThrow("validation");
    });

    it("should find the most recent work report when multiple exist", async () => {
      // Arrange: Multiple work reports for same issue
      const newerReportContent = `# Work Report - Issue #123

**Created:** 2024-01-15T12:00:00.000Z
**Repository:** test/repo
**Branch:** feature/test-123
**Worktree:** /test/project

## Summary

This is the newer report.`;

      mockFileSystem.setFile("/tmp/work-report-123-1234567890.md", sampleReportContent);
      mockFileSystem.setFile("/tmp/work-report-123-1234567999.md", newerReportContent);

      // Act
      const result = await readWorkReport(123, mockFileSystem, mockPath);

      // Assert - Should find the newer one
      expect(result.filePath).toBe("/tmp/work-report-123-1234567999.md");
    });
  });

  describe("createFeedbackDocument (TDD Phase 5)", () => {
    beforeEach(() => {
      mockFileSystem.reset();
      mockPath.reset();
    });

    it("should create feedback document with approved result", async () => {
      // Arrange
      const options: CreateFeedbackOptions = {
        issueNumber: 123,
        reviewResult: "approved",
        feedback: {
          summary: "Excellent implementation",
          approvedAspects: ["Clean code", "Good tests"],
          testingNotes: "All tests pass",
        },
        reviewerInfo: "Senior Developer",
      };

      // Act
      const filePath = await createFeedbackDocument(options, mockFileSystem, mockPath);

      // Assert
      expect(filePath).toMatch(/feedback-123-\d+\.md$/);
      expect(mockFileSystem.getCallLog()).toContainEqual(
        expect.objectContaining({ method: "writeFile" }),
      );

      const writtenFile = mockFileSystem.getCallLog().find((call) => call.method === "writeFile");
      expect(writtenFile?.args[1]).toContain("# Review Feedback - Issue #123");
      expect(writtenFile?.args[1]).toContain("**Result:** Approved");
      expect(writtenFile?.args[1]).toContain("**Reviewer:** Senior Developer");
      expect(writtenFile?.args[1]).toContain("Excellent implementation");
    });

    it("should create feedback document with needs_work result", async () => {
      // Arrange
      const options: CreateFeedbackOptions = {
        issueNumber: 456,
        reviewResult: "needs_work",
        feedback: {
          summary: "Good start but needs improvements",
          requiredChanges: [
            {
              category: "code",
              description: "Add error handling",
              location: "src/utils.ts:45",
              priority: "high",
              suggestion: "Use try-catch blocks",
            },
          ],
          suggestions: [
            {
              category: "tests",
              description: "Add more unit tests",
              priority: "medium",
            },
          ],
        },
      };

      // Act
      const filePath = await createFeedbackDocument(options, mockFileSystem, mockPath);

      // Assert
      expect(filePath).toMatch(/feedback-456-\d+\.md$/);
      const writtenFile = mockFileSystem.getCallLog().find((call) => call.method === "writeFile");
      expect(writtenFile?.args[1]).toContain("**Result:** Needs Work");
      expect(writtenFile?.args[1]).toContain("Add error handling");
      expect(writtenFile?.args[1]).toContain("src/utils.ts:45");
      expect(writtenFile?.args[1]).toContain("Use try-catch blocks");
    });

    it("should handle minimal feedback options", async () => {
      // Arrange
      const options: CreateFeedbackOptions = {
        issueNumber: 789,
        reviewResult: "approved",
        feedback: {
          summary: "LGTM",
        },
      };

      // Act
      const filePath = await createFeedbackDocument(options, mockFileSystem, mockPath);

      // Assert
      expect(filePath).toMatch(/feedback-789-\d+\.md$/);
      const writtenFile = mockFileSystem.getCallLog().find((call) => call.method === "writeFile");
      expect(writtenFile?.args[1]).toContain("LGTM");
    });

    it("should include work report reference when provided", async () => {
      // Arrange
      const options: CreateFeedbackOptions = {
        issueNumber: 100,
        reviewResult: "approved",
        feedback: { summary: "Good work" },
        workReportPath: "/tmp/work-report-100-123456.md",
      };

      // Act
      await createFeedbackDocument(options, mockFileSystem, mockPath);

      // Assert
      const writtenFile = mockFileSystem.getCallLog().find((call) => call.method === "writeFile");
      expect(writtenFile?.args[1]).toContain("**Work Report:** /tmp/work-report-100-123456.md");
    });

    it("should validate issue number", async () => {
      // Arrange
      const options: CreateFeedbackOptions = {
        issueNumber: 0,
        reviewResult: "approved",
        feedback: { summary: "Test" },
      };

      // Act & Assert
      await expect(createFeedbackDocument(options, mockFileSystem, mockPath)).rejects.toThrow(
        "Issue number validation failed: must be positive",
      );
    });

    it("should handle temporary directory creation failure", async () => {
      // Arrange: Mock temp directory creation to fail by making mkdir fail for any path
      const failingMockFileSystem = new MockFileSystem();
      failingMockFileSystem.setError("mkdir", "", new Error("Permission denied"));

      const options: CreateFeedbackOptions = {
        issueNumber: 123,
        reviewResult: "approved",
        feedback: { summary: "Test" },
      };

      // Act & Assert
      await expect(
        createFeedbackDocument(options, failingMockFileSystem, mockPath),
      ).rejects.toThrow("Failed to create feedback document");
    });

    it("should handle file write failure", async () => {
      // Arrange: Mock file writing to fail by making writeFile fail for any path
      const failingMockFileSystem = new MockFileSystem();
      failingMockFileSystem.setError("writeFile", "", new Error("Permission denied"));

      const options: CreateFeedbackOptions = {
        issueNumber: 123,
        reviewResult: "approved",
        feedback: { summary: "Test" },
      };

      // Act & Assert
      await expect(
        createFeedbackDocument(options, failingMockFileSystem, mockPath),
      ).rejects.toThrow("Failed to create feedback document");
    });

    it("should format feedback items correctly in markdown", async () => {
      // Arrange
      const options: CreateFeedbackOptions = {
        issueNumber: 200,
        reviewResult: "needs_work",
        feedback: {
          summary: "Review feedback",
          requiredChanges: [
            {
              category: "code",
              description: "Fix memory leak",
              location: "src/memory.ts:30",
              priority: "high",
              suggestion: "Add cleanup in useEffect",
            },
            {
              category: "documentation",
              description: "Update README",
              priority: "medium",
            },
          ],
          suggestions: [
            {
              category: "tests",
              description: "Add integration tests",
              priority: "low",
            },
          ],
        },
      };

      // Act
      await createFeedbackDocument(options, mockFileSystem, mockPath);

      // Assert
      const writtenFile = mockFileSystem.getCallLog().find((call) => call.method === "writeFile");
      const content = writtenFile?.args[1] as string;

      expect(content).toContain("## Required Changes");
      expect(content).toContain("### High Priority");
      expect(content).toContain("**Code:** Fix memory leak");
      expect(content).toContain("*Location:* src/memory.ts:30");
      expect(content).toContain("*Suggestion:* Add cleanup in useEffect");
      expect(content).toContain("### Medium Priority");
      expect(content).toContain("**Documentation:** Update README");
      expect(content).toContain("## Suggestions");
      expect(content).toContain("### Low Priority");
      expect(content).toContain("**Tests:** Add integration tests");
    });
  });

  describe("readFeedbackDocument (TDD Phase 5)", () => {
    beforeEach(() => {
      mockFileSystem.reset();
      mockPath.reset();
    });

    it("should read and parse feedback document correctly", async () => {
      // Arrange
      const feedbackContent = `# Review Feedback - Issue #123

**Created:** 2024-01-15T10:00:00.000Z
**Result:** Approved
**Reviewer:** Senior Developer
**Work Report:** /tmp/work-report-123-123456.md

## Summary

Excellent implementation with clean code and comprehensive tests.

## Approved Aspects

- Clean and readable code
- Comprehensive test coverage
- Good error handling

## Testing Notes

All unit tests pass. Integration tests look good.
`;

      mockFileSystem.setDirectory("/tmp");
      mockFileSystem.setFile("/tmp/feedback-123-123456.md", feedbackContent);

      // Act
      const result = await readFeedbackDocument(123, mockFileSystem, mockPath);

      // Assert
      expect(result.issueNumber).toBe(123);
      expect(result.filePath).toBe("/tmp/feedback-123-123456.md");
      expect(result.result).toBe("approved");
      expect(result.reviewer).toBe("Senior Developer");
      expect(result.feedback.summary).toBe(
        "Excellent implementation with clean code and comprehensive tests.",
      );
      expect(result.feedback.approvedAspects).toContain("Clean and readable code");
      expect(result.feedback.testingNotes).toBe(
        "All unit tests pass. Integration tests look good.",
      );
    });

    it("should parse needs_work feedback with required changes", async () => {
      // Arrange
      const feedbackContent = `# Review Feedback - Issue #456

**Created:** 2024-01-15T11:00:00.000Z
**Result:** Needs Work
**Reviewer:** Code Reviewer

## Summary

Good start but needs some improvements.

## Required Changes

### High Priority

**Code:** Add error handling in main function
*Location:* src/main.ts:45
*Suggestion:* Use try-catch blocks for async operations

### Medium Priority

**Tests:** Add unit tests for edge cases

## Suggestions

### Low Priority

**Documentation:** Update JSDoc comments
`;

      mockFileSystem.setDirectory("/tmp");
      mockFileSystem.setFile("/tmp/feedback-456-789012.md", feedbackContent);

      // Act
      const result = await readFeedbackDocument(456, mockFileSystem, mockPath);

      // Assert
      expect(result.result).toBe("needs_work");
      expect(result.feedback.summary).toBe("Good start but needs some improvements.");
      expect(result.feedback.requiredChanges).toHaveLength(2);
      expect(result.feedback.requiredChanges?.[0]).toEqual({
        category: "code",
        description: "Add error handling in main function",
        location: "src/main.ts:45",
        priority: "high",
        suggestion: "Use try-catch blocks for async operations",
      });
      expect(result.feedback.suggestions).toHaveLength(1);
      expect(result.feedback.suggestions?.[0]).toEqual({
        category: "documentation",
        description: "Update JSDoc comments",
        priority: "low",
      });
    });

    it("should find most recent feedback document when multiple exist", async () => {
      // Arrange
      mockFileSystem.setDirectory("/tmp");
      mockFileSystem.setFile("/tmp/feedback-123-111111.md", "old feedback");
      mockFileSystem.setFile(
        "/tmp/feedback-123-999999.md",
        `# Review Feedback - Issue #123

**Created:** 2024-01-15T12:00:00.000Z
**Result:** Approved

## Summary

Latest feedback
`,
      );

      // Act
      const result = await readFeedbackDocument(123, mockFileSystem, mockPath);

      // Assert
      expect(result.filePath).toBe("/tmp/feedback-123-999999.md");
      expect(result.feedback.summary).toBe("Latest feedback");
    });

    it("should throw error when feedback document not found", async () => {
      // Arrange
      mockFileSystem.setDirectory("/tmp");

      // Act & Assert
      await expect(readFeedbackDocument(999, mockFileSystem, mockPath)).rejects.toThrow(
        "Feedback document not found for issue #999",
      );
    });

    it("should validate issue number", async () => {
      // Act & Assert
      await expect(readFeedbackDocument(0, mockFileSystem, mockPath)).rejects.toThrow(
        "Issue number validation failed: must be positive",
      );
    });

    it("should throw error for malformed feedback document", async () => {
      // Arrange
      const malformedContent = "This is not a proper feedback document";
      mockFileSystem.setDirectory("/tmp");
      mockFileSystem.setFile("/tmp/feedback-123-123456.md", malformedContent);

      // Act & Assert
      await expect(readFeedbackDocument(123, mockFileSystem, mockPath)).rejects.toThrow(
        "Invalid feedback document format",
      );
    });

    it("should handle file system errors when reading directory", async () => {
      // Arrange
      mockFileSystem.setError("readdir", "/tmp", new Error("EACCES: permission denied"));

      // Act & Assert
      await expect(readFeedbackDocument(123, mockFileSystem, mockPath)).rejects.toThrow(
        "Failed to read feedback document",
      );
    });

    it("should handle file read errors", async () => {
      // Arrange
      mockFileSystem.setDirectory("/tmp");
      mockFileSystem.setFile("/tmp/feedback-123-123456.md", "content");
      mockFileSystem.setError("readFile", "/tmp/feedback-123-123456.md", new Error("EACCES"));

      // Act & Assert
      await expect(readFeedbackDocument(123, mockFileSystem, mockPath)).rejects.toThrow(
        "Failed to read feedback document",
      );
    });

    it("should parse metadata correctly from various formats", async () => {
      // Arrange
      const feedbackContent = `# Review Feedback - Issue #789

**Created:** 2024-01-15T13:30:00.000Z
**Result:** Needs Work
**Reviewer:** Tech Lead
**Work Report:** /path/to/work-report.md

## Summary

Mixed results.
`;

      mockFileSystem.setDirectory("/tmp");
      mockFileSystem.setFile("/tmp/feedback-789-456789.md", feedbackContent);

      // Act
      const result = await readFeedbackDocument(789, mockFileSystem, mockPath);

      // Assert
      expect(result.created).toEqual(new Date("2024-01-15T13:30:00.000Z"));
      expect(result.result).toBe("needs_work");
      expect(result.reviewer).toBe("Tech Lead");
    });
  });

  describe("Edge Cases & Advanced Scenarios", () => {
    describe("nested directory structures", () => {
      it("should handle deep nested .claude directory structures", async () => {
        // Arrange: Create complex nested structure using enhanced mock
        mockFileSystem.setDirectory("/test/source");
        mockFileSystem.setNestedStructure("/test/source/.claude", {
          "config.json": '{"version": "1.0"}',
          commands: null, // directory
          "commands/general.json": '{"name": "general"}',
          "commands/git.json": '{"name": "git"}',
          "commands/subdir": null, // directory
          "commands/subdir/nested.json": '{"name": "nested"}',
          templates: null, // directory
          "templates/issue.md": "# Issue Template",
          local: null, // directory
          "local/cache.json": '{"cache": true}',
        });

        mockFileSystem.setDirectory("/test/target");

        // Act
        const result = await copyClaudeContext(
          "/test/source",
          "/test/target",
          { includeCommands: true },
          mockFileSystem,
          mockPath,
        );

        // Assert
        expect(result).toContain("/test/target/.claude");

        // Verify deep nested files were copied
        const callLog = mockFileSystem.getCallLog();
        const copyOperations = callLog.filter((call) => call.method === "copyFile");
        expect(
          copyOperations.some((op) =>
            op.args[0]?.toString().includes("commands/subdir/nested.json"),
          ),
        ).toBe(true);
      });

      it("should correctly read nested directory listings", async () => {
        // Arrange: Set up nested structure
        mockFileSystem.setNestedStructure("/test/project/.claude", {
          "config.json": "{}",
          commands: null,
          "commands/cmd1.json": "{}",
          "commands/cmd2.json": "{}",
          templates: null,
          "templates/template1.md": "# Template",
        });

        // Act & Assert: Test readdir at different levels
        const rootContents = await mockFileSystem.readdir("/test/project/.claude");
        expect(rootContents).toContain("config.json");
        expect(rootContents).toContain("commands");
        expect(rootContents).toContain("templates");
        expect(rootContents).not.toContain("cmd1.json"); // Should not include nested files

        const commandsContents = await mockFileSystem.readdir("/test/project/.claude/commands");
        expect(commandsContents).toContain("cmd1.json");
        expect(commandsContents).toContain("cmd2.json");
        expect(commandsContents).not.toContain("template1.md"); // Should not include files from other dirs
      });
    });

    describe("path normalization edge cases", () => {
      it("should handle paths with .. and . segments correctly", async () => {
        // Test MockPath resolve with various edge cases
        expect(mockPath.resolve("/test", "..", "other")).toBe("/other");
        expect(mockPath.resolve("/test/deep", "..", "..", "root")).toBe("/root");
        expect(mockPath.resolve("relative", "..", "sibling")).toBe("sibling");
        expect(mockPath.resolve(".", "current")).toBe("current");
      });

      it("should handle multiple consecutive slashes", async () => {
        expect(mockPath.join("/test", "//middle//", "end")).toBe("/test/middle/end");
        expect(mockPath.resolve("//double//slash//path")).toBe("/double/slash/path");
      });

      it("should handle empty path segments", async () => {
        expect(mockPath.join("/test", "", "end")).toBe("/test/end");
        expect(mockPath.join("", "start")).toBe("start");
        expect(mockPath.join()).toBe(".");
      });

      it("should handle root path edge cases", async () => {
        expect(mockPath.resolve("/")).toBe("/");
        expect(mockPath.join("/")).toBe("/");
        expect(mockPath.dirname("/")).toBe("/");
      });
    });

    describe("Unicode and special character file names", () => {
      it("should handle Unicode file names correctly", async () => {
        // Arrange: Set up files with Unicode names
        const unicodeFileName = "测试文件.md";
        const emojiFileName = "📝notes.txt";
        const accentFileName = "résumé.pdf";

        mockFileSystem.setDirectory("/test/unicode");
        mockFileSystem.setFile(`/test/unicode/${unicodeFileName}`, "Unicode content");
        mockFileSystem.setFile(`/test/unicode/${emojiFileName}`, "Emoji content");
        mockFileSystem.setFile(`/test/unicode/${accentFileName}`, "Accent content");

        // Act
        const files = await mockFileSystem.readdir("/test/unicode");

        // Assert
        expect(files).toContain(unicodeFileName);
        expect(files).toContain(emojiFileName);
        expect(files).toContain(accentFileName);

        // Test file operations work with Unicode names
        const content = await mockFileSystem.readFile(`/test/unicode/${unicodeFileName}`, "utf8");
        expect(content).toBe("Unicode content");
      });

      it("should handle special characters in paths", async () => {
        // Test files with spaces, special chars (that are valid in file systems)
        const specialFiles = [
          "file with spaces.txt",
          "file-with-dashes.txt",
          "file_with_underscores.txt",
          "file.with.dots.txt",
          "(parentheses).txt",
          "[brackets].txt",
        ];

        mockFileSystem.setDirectory("/test/special");

        for (const fileName of specialFiles) {
          mockFileSystem.setFile(`/test/special/${fileName}`, `Content of ${fileName}`);
        }

        // Act
        const files = await mockFileSystem.readdir("/test/special");

        // Assert
        expect(files).toHaveLength(specialFiles.length);
        for (const fileName of specialFiles) {
          expect(files).toContain(fileName);
        }
      });
    });

    describe("large-scale directory operations", () => {
      it("should handle bulk file operations efficiently", async () => {
        // Arrange: Create large directory structure (100+ files)
        const fileCount = 150;
        const structure: Record<string, string | null> = {};

        // Generate structure with multiple directories and files
        for (let i = 0; i < fileCount; i++) {
          const dirIndex = Math.floor(i / 10);
          if (i % 10 === 0) {
            structure[`dir${dirIndex}`] = null; // Ensure directory exists first
          }
          structure[`dir${dirIndex}/file${i}.txt`] = `Content ${i}`;
        }

        // Add CLAUDE.md and .claude structure for copyClaudeContext to work
        structure["CLAUDE.md"] = "# Bulk test project";
        structure[".claude"] = null;
        structure[".claude/config.json"] = '{"bulk": true}';

        mockFileSystem.setDirectory("/test/bulk");
        mockFileSystem.setNestedStructure("/test/bulk", structure);
        mockFileSystem.setDirectory("/test/target");

        // Act: Perform bulk copy operation
        const result = await copyClaudeContext(
          "/test/bulk",
          "/test/target",
          {},
          mockFileSystem,
          mockPath,
        );

        // Assert: Operation completes successfully
        expect(result).toContain("/test/target/.claude");

        // Verify some files were processed
        const callLog = mockFileSystem.getCallLog();
        const copyOperations = callLog.filter((call) => call.method === "copyFile");
        expect(copyOperations.length).toBeGreaterThan(0);
      });

      it("should handle directory trees with many nested levels", async () => {
        // Create deeply nested structure (10 levels deep)
        let currentPath = "/test/deep";
        mockFileSystem.setDirectory(currentPath);

        for (let level = 0; level < 10; level++) {
          currentPath = `${currentPath}/level${level}`;
          mockFileSystem.setDirectory(currentPath);
          mockFileSystem.setFile(`${currentPath}/file${level}.txt`, `Level ${level} content`);
        }

        // Test that we can validate deeply nested structures
        const validation = await validateFileStructure("/test/deep", mockFileSystem, mockPath);

        // Even though it won't find git/claude context, it should handle the path validation
        expect(validation.isValid).toBe(false); // Expected - no git repo
        expect(validation.issues).not.toContain("Failed to access directory"); // Should not have path access issues
      });
    });

    describe("concurrent operation simulation", () => {
      it("should handle mock filesystem state during rapid operations", async () => {
        // Simulate rapid file operations that might occur during concurrent access
        mockFileSystem.setDirectory("/test/concurrent");

        const operations = [];
        for (let i = 0; i < 20; i++) {
          operations.push(
            mockFileSystem.writeFile(`/test/concurrent/file${i}.txt`, `Content ${i}`, "utf8"),
          );
        }

        // Execute all operations
        await Promise.all(operations);

        // Verify all files exist
        const files = await mockFileSystem.readdir("/test/concurrent");
        expect(files).toHaveLength(20);
      });
    });

    describe("error handling edge cases", () => {
      it("should handle permission errors during deep copy operations", async () => {
        // Arrange: Set up structure where permission error occurs mid-copy
        mockFileSystem.setDirectory("/test/source");
        mockFileSystem.setNestedStructure("/test/source", {
          "CLAUDE.md": "# Test content",
          ".claude": null,
          ".claude/config.json": "Config content",
          ".claude/subdir": null,
          ".claude/subdir/protected.txt": "Protected content",
        });

        mockFileSystem.setDirectory("/test/target");

        // Set error for specific nested file during .claude directory copy
        mockFileSystem.setError(
          "copyFile",
          "/test/source/.claude/subdir/protected.txt",
          new Error("EACCES: Permission denied"),
        );

        // Act & Assert: Should fail gracefully with descriptive error
        await expect(
          copyClaudeContext("/test/source", "/test/target", {}, mockFileSystem, mockPath),
        ).rejects.toThrow("Failed to copy .claude directory");
      });

      it("should handle malformed paths gracefully", async () => {
        // Test various malformed path inputs
        await expect(validateFileStructure("", mockFileSystem, mockPath)).rejects.toThrow(
          "validation",
        );

        await expect(
          ensureClaudeContext("\0invalid", "/test/source", mockFileSystem, mockPath),
        ).rejects.toThrow("validation");
      });
    });
  });

  describe("cleanupTempFiles (TDD Phase 6)", () => {
    beforeEach(() => {
      mockFileSystem.reset();
      mockPath.reset();
    });

    describe("Basic cleanup functionality", () => {
      it("should clean up temp files with default options", async () => {
        // Arrange
        const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days old (older than 7-day default)
        const recentDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours old

        mockFileSystem.setDirectory("/tmp");
        mockFileSystem.setFile("/tmp/work-report-123-456789.md", "content", oldDate, 100);
        mockFileSystem.setFile("/tmp/feedback-456-789012.md", "content", oldDate, 150);
        mockFileSystem.setFile("/tmp/temp-context-abc123.json", "content", oldDate, 50);
        mockFileSystem.setFile("/tmp/recent-file.txt", "content", recentDate, 75);

        // Act
        const result = await cleanupTempFiles({}, mockFileSystem, mockPath);

        // Assert
        expect(result.filesRemoved).toHaveLength(3);
        expect(result.filesRemoved).toContain("/tmp/work-report-123-456789.md");
        expect(result.filesRemoved).toContain("/tmp/feedback-456-789012.md");
        expect(result.filesRemoved).toContain("/tmp/temp-context-abc123.json");
        expect(result.filesRemoved).not.toContain("/tmp/recent-file.txt");
        expect(result.spaceSaved).toBe(300); // 100 + 150 + 50
        expect(result.errors).toHaveLength(0);
      });

      it("should return empty result when no files to clean", async () => {
        // Arrange
        mockFileSystem.setDirectory("/tmp");

        // Act
        const result = await cleanupTempFiles({}, mockFileSystem, mockPath);

        // Assert
        expect(result.filesRemoved).toHaveLength(0);
        expect(result.spaceSaved).toBe(0);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe("Date-based filtering", () => {
      it("should only remove files older than specified date", async () => {
        // Arrange
        const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
        const oldDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days old
        const newDate = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours old

        mockFileSystem.setDirectory("/tmp");
        mockFileSystem.setFile("/tmp/old-file.md", "content", oldDate, 100);
        mockFileSystem.setFile("/tmp/new-file.md", "content", newDate, 100);

        // Act
        const result = await cleanupTempFiles({ olderThan: cutoffDate }, mockFileSystem, mockPath);

        // Assert
        expect(result.filesRemoved).toHaveLength(1);
        expect(result.filesRemoved).toContain("/tmp/old-file.md");
        expect(result.filesRemoved).not.toContain("/tmp/new-file.md");
        expect(result.spaceSaved).toBe(100);
      });

      it("should use default cleanup age when olderThan not specified", async () => {
        // Arrange
        const veryOldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days old
        const recentDate = new Date(Date.now() - 6 * 60 * 60 * 1000); // 6 hours old

        mockFileSystem.setDirectory("/tmp");
        mockFileSystem.setFile("/tmp/very-old.md", "content", veryOldDate, 100);
        mockFileSystem.setFile("/tmp/recent.md", "content", recentDate, 100);

        // Act
        const result = await cleanupTempFiles({}, mockFileSystem, mockPath);

        // Assert - Should remove files older than default threshold (e.g., 7 days)
        expect(result.filesRemoved).toContain("/tmp/very-old.md");
        expect(result.filesRemoved).not.toContain("/tmp/recent.md");
      });
    });

    describe("Pattern-based filtering", () => {
      it("should only remove files matching specified patterns", async () => {
        // Arrange
        const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

        mockFileSystem.setDirectory("/tmp");
        mockFileSystem.setFile("/tmp/work-report-123.md", "content", oldDate, 100);
        mockFileSystem.setFile("/tmp/feedback-456.md", "content", oldDate, 100);
        mockFileSystem.setFile("/tmp/other-file.txt", "content", oldDate, 100);
        mockFileSystem.setFile("/tmp/temp-context.json", "content", oldDate, 100);

        // Act
        const result = await cleanupTempFiles(
          { patterns: ["work-report-*", "feedback-*"] },
          mockFileSystem,
          mockPath,
        );

        // Assert
        expect(result.filesRemoved).toHaveLength(2);
        expect(result.filesRemoved).toContain("/tmp/work-report-123.md");
        expect(result.filesRemoved).toContain("/tmp/feedback-456.md");
        expect(result.filesRemoved).not.toContain("/tmp/other-file.txt");
        expect(result.filesRemoved).not.toContain("/tmp/temp-context.json");
        expect(result.spaceSaved).toBe(200);
      });

      it("should support multiple pattern formats", async () => {
        // Arrange
        const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

        mockFileSystem.setDirectory("/tmp");
        mockFileSystem.setFile("/tmp/work-report-123.md", "content", oldDate, 100);
        mockFileSystem.setFile("/tmp/temp-abc.json", "content", oldDate, 100);
        mockFileSystem.setFile("/tmp/cache.tmp", "content", oldDate, 100);
        mockFileSystem.setFile("/tmp/keep-this.txt", "content", oldDate, 100);

        // Act
        const result = await cleanupTempFiles(
          { patterns: ["*.md", "temp-*", "*.tmp"] },
          mockFileSystem,
          mockPath,
        );

        // Assert
        expect(result.filesRemoved).toHaveLength(3);
        expect(result.filesRemoved).not.toContain("/tmp/keep-this.txt");
        expect(result.spaceSaved).toBe(300);
      });
    });

    describe("Dry run mode", () => {
      it("should not remove files in dry run mode", async () => {
        // Arrange
        const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

        mockFileSystem.setDirectory("/tmp");
        mockFileSystem.setFile("/tmp/work-report-123.md", "content", oldDate, 100);
        mockFileSystem.setFile("/tmp/feedback-456.md", "content", oldDate, 150);

        // Act
        const result = await cleanupTempFiles({ dryRun: true }, mockFileSystem, mockPath);

        // Assert
        expect(result.filesRemoved).toHaveLength(2); // Should show what would be removed
        expect(result.spaceSaved).toBe(250); // Should show space that would be saved

        // Verify no unlink calls were made
        const callLog = mockFileSystem.getCallLog();
        const unlinkCalls = callLog.filter((call) => call.method === "unlink");
        expect(unlinkCalls).toHaveLength(0);
      });

      it("should still validate patterns and dates in dry run mode", async () => {
        // Arrange
        const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
        const newDate = new Date(Date.now() - 2 * 60 * 60 * 1000);

        mockFileSystem.setDirectory("/tmp");
        mockFileSystem.setFile("/tmp/old-report.md", "content", oldDate, 100);
        mockFileSystem.setFile("/tmp/new-report.md", "content", newDate, 100);

        // Act
        const result = await cleanupTempFiles(
          { dryRun: true, patterns: ["*.md"] },
          mockFileSystem,
          mockPath,
        );

        // Assert - Should respect filtering even in dry run
        expect(result.filesRemoved).toContain("/tmp/old-report.md");
        expect(result.filesRemoved).not.toContain("/tmp/new-report.md");
      });
    });

    describe("Preserve reports option", () => {
      it("should preserve work reports when preserveReports is true", async () => {
        // Arrange
        const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

        mockFileSystem.setDirectory("/tmp");
        mockFileSystem.setFile("/tmp/work-report-123-456.md", "content", oldDate, 100);
        mockFileSystem.setFile("/tmp/feedback-456-789.md", "content", oldDate, 100);
        mockFileSystem.setFile("/tmp/temp-context.json", "content", oldDate, 100);

        // Act
        const result = await cleanupTempFiles({ preserveReports: true }, mockFileSystem, mockPath);

        // Assert
        expect(result.filesRemoved).toHaveLength(1);
        expect(result.filesRemoved).not.toContain("/tmp/work-report-123-456.md");
        expect(result.filesRemoved).toContain("/tmp/temp-context.json");
        expect(result.spaceSaved).toBe(100);
      });

      it("should preserve both work reports and feedback when preserveReports is true", async () => {
        // Arrange
        const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

        mockFileSystem.setDirectory("/tmp");
        mockFileSystem.setFile("/tmp/work-report-123.md", "content", oldDate, 100);
        mockFileSystem.setFile("/tmp/feedback-456.md", "content", oldDate, 100);
        mockFileSystem.setFile("/tmp/other-temp.json", "content", oldDate, 100);

        // Act
        const result = await cleanupTempFiles({ preserveReports: true }, mockFileSystem, mockPath);

        // Assert
        expect(result.filesRemoved).toHaveLength(1);
        expect(result.filesRemoved).toContain("/tmp/other-temp.json");
        expect(result.filesRemoved).not.toContain("/tmp/work-report-123.md");
        expect(result.filesRemoved).not.toContain("/tmp/feedback-456.md");
      });
    });

    describe("Error handling", () => {
      it("should handle permission errors during file removal", async () => {
        // Arrange
        const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

        mockFileSystem.setDirectory("/tmp");
        mockFileSystem.setFile("/tmp/accessible.md", "content", oldDate, 100);
        mockFileSystem.setFile("/tmp/protected.md", "content", oldDate, 100);
        mockFileSystem.setError(
          "unlink",
          "/tmp/protected.md",
          new Error("EACCES: permission denied"),
        );

        // Act
        const result = await cleanupTempFiles({}, mockFileSystem, mockPath);

        // Assert
        expect(result.filesRemoved).toContain("/tmp/accessible.md");
        expect(result.filesRemoved).not.toContain("/tmp/protected.md");
        expect(result.spaceSaved).toBe(100); // Only space from successfully removed file
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].path).toBe("/tmp/protected.md");
        expect(result.errors[0].error).toContain("permission denied");
      });

      it("should continue cleanup despite individual file errors", async () => {
        // Arrange
        const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

        mockFileSystem.setDirectory("/tmp");
        mockFileSystem.setFile("/tmp/file1.md", "content", oldDate, 100);
        mockFileSystem.setFile("/tmp/file2.md", "content", oldDate, 100);
        mockFileSystem.setFile("/tmp/file3.md", "content", oldDate, 100);
        mockFileSystem.setError("unlink", "/tmp/file2.md", new Error("File locked"));

        // Act
        const result = await cleanupTempFiles({}, mockFileSystem, mockPath);

        // Assert
        expect(result.filesRemoved).toHaveLength(2);
        expect(result.filesRemoved).toContain("/tmp/file1.md");
        expect(result.filesRemoved).toContain("/tmp/file3.md");
        expect(result.spaceSaved).toBe(200);
        expect(result.errors).toHaveLength(1);
      });

      it("should handle filesystem access errors gracefully", async () => {
        // Arrange
        mockFileSystem.setDirectory("/tmp"); // Directory exists but readdir fails
        mockFileSystem.setError("readdir", "/tmp", new Error("EACCES: permission denied"));

        // Act & Assert
        await expect(cleanupTempFiles({}, mockFileSystem, mockPath)).rejects.toThrow(
          "Failed to clean up temp files",
        );
      });

      it("should handle missing temp directory gracefully", async () => {
        // Arrange - No temp directory set up

        // Act
        const result = await cleanupTempFiles({}, mockFileSystem, mockPath);

        // Assert
        expect(result.filesRemoved).toHaveLength(0);
        expect(result.spaceSaved).toBe(0);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe("Options validation", () => {
      it("should validate olderThan date parameter", async () => {
        // Arrange
        const invalidDate = new Date("invalid");

        // Act & Assert
        await expect(
          cleanupTempFiles({ olderThan: invalidDate }, mockFileSystem, mockPath),
        ).rejects.toThrow("validation");
      });

      it("should validate pattern array parameter", async () => {
        // Arrange
        const invalidPatterns = ["", "  ", "valid-pattern"];

        // Act & Assert
        await expect(
          cleanupTempFiles({ patterns: invalidPatterns }, mockFileSystem, mockPath),
        ).rejects.toThrow("validation");
      });

      it("should handle empty patterns array", async () => {
        // Arrange
        const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
        mockFileSystem.setDirectory("/tmp");
        mockFileSystem.setFile("/tmp/test.md", "content", oldDate, 100);

        // Act
        const result = await cleanupTempFiles({ patterns: [] }, mockFileSystem, mockPath);

        // Assert - Empty patterns should not match any files
        expect(result.filesRemoved).toHaveLength(0);
        expect(result.spaceSaved).toBe(0);
      });
    });

    describe("Combined options", () => {
      it("should apply multiple filters correctly", async () => {
        // Arrange
        const cutoffDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
        const veryOldDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days old
        const oldDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000); // 4 days old
        const newDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days old

        mockFileSystem.setDirectory("/tmp");
        mockFileSystem.setFile("/tmp/old-work-report.md", "content", veryOldDate, 100);
        mockFileSystem.setFile("/tmp/old-feedback.md", "content", oldDate, 100);
        mockFileSystem.setFile("/tmp/new-work-report.md", "content", newDate, 100);
        mockFileSystem.setFile("/tmp/old-other.txt", "content", veryOldDate, 100);

        // Act
        const result = await cleanupTempFiles(
          {
            olderThan: cutoffDate,
            patterns: ["*.md"],
            preserveReports: false,
          },
          mockFileSystem,
          mockPath,
        );

        // Assert
        expect(result.filesRemoved).toHaveLength(2);
        expect(result.filesRemoved).toContain("/tmp/old-work-report.md");
        expect(result.filesRemoved).toContain("/tmp/old-feedback.md");
        expect(result.filesRemoved).not.toContain("/tmp/new-work-report.md"); // Too new
        expect(result.filesRemoved).not.toContain("/tmp/old-other.txt"); // Wrong pattern
        expect(result.spaceSaved).toBe(200);
      });

      it("should respect preserveReports even with patterns", async () => {
        // Arrange
        const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

        mockFileSystem.setDirectory("/tmp");
        mockFileSystem.setFile("/tmp/work-report-123.md", "content", oldDate, 100);
        mockFileSystem.setFile("/tmp/other-document.md", "content", oldDate, 100);

        // Act
        const result = await cleanupTempFiles(
          {
            patterns: ["*.md"],
            preserveReports: true,
          },
          mockFileSystem,
          mockPath,
        );

        // Assert
        expect(result.filesRemoved).toHaveLength(1);
        expect(result.filesRemoved).toContain("/tmp/other-document.md");
        expect(result.filesRemoved).not.toContain("/tmp/work-report-123.md");
      });
    });

    describe("Space calculation", () => {
      it("should accurately calculate space saved", async () => {
        // Arrange
        const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

        mockFileSystem.setDirectory("/tmp");
        mockFileSystem.setFile("/tmp/small.md", "content", oldDate, 100);
        mockFileSystem.setFile("/tmp/medium.md", "content", oldDate, 1024);
        mockFileSystem.setFile("/tmp/large.md", "content", oldDate, 5 * 1024 * 1024);

        // Act
        const result = await cleanupTempFiles({}, mockFileSystem, mockPath);

        // Assert
        expect(result.spaceSaved).toBe(100 + 1024 + 5 * 1024 * 1024);
        expect(result.filesRemoved).toHaveLength(3);
      });

      it("should not count space for failed removals", async () => {
        // Arrange
        const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

        mockFileSystem.setDirectory("/tmp");
        mockFileSystem.setFile("/tmp/success.md", "content", oldDate, 100);
        mockFileSystem.setFile("/tmp/failure.md", "content", oldDate, 200);
        mockFileSystem.setError("unlink", "/tmp/failure.md", new Error("Cannot remove"));

        // Act
        const result = await cleanupTempFiles({}, mockFileSystem, mockPath);

        // Assert
        expect(result.spaceSaved).toBe(100); // Only space from successful removal
        expect(result.filesRemoved).toHaveLength(1);
        expect(result.errors).toHaveLength(1);
      });
    });
  });
});
