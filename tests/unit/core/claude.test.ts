/**
 * Unit tests for core Claude module
 *
 * Tests all Claude Code integration operations with mocked process execution
 * to ensure isolation and deterministic results.
 * Uses Test-Driven Development (TDD) methodology.
 */

import type { ChildProcess } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FileSystemInterface, PathInterface } from "../../../src/core/files";
import { ERROR_CODES } from "../../../src/shared/errors";

// Import interfaces that will be defined in the implementation
import type {
  ClaudeAnalysisRequest,
  ClaudeAnalysisResult,
  ClaudeCodeIssue,
  ClaudeCodeSuggestion,
  ClaudeCommandOptions,
  ClaudeCommandResult,
  ClaudeContextStatus,
  ClaudeGenerationRequest,
  ClaudeGenerationResult,
  ClaudeInstallationInfo,
  ClaudeInterface,
  ClaudeSession,
  ClaudeSessionConfig,
  ClaudeSettingsConfig,
  ContextHandleOptions,
  LaunchSessionResult,
  ProcessInfo,
  ProcessOperationsInterface,
  SessionDiscoveryResult,
  WorkspaceSetupOptions,
} from "../../../src/core/claude";

// Import functions to be implemented
import {
  analyzeCodeWithClaude,
  configureClaudeSettings,
  executeClaudeCommand,
  explainCodeWithClaude,
  findActiveClaudeSessions,
  generateCodeWithClaude,
  getClaudeSessionStatus,
  handleClaudeContext,
  launchClaudeSession,
  optimizeCodeWithClaude,
  reviewCodeWithClaude,
  setupClaudeWorkspace,
  terminateClaudeSession,
  validateClaudeInstallation,
} from "../../../src/core/claude";

// Mock Process Operations for testing
class MockProcessOperations {
  // Note: This doesn't fully implement ProcessOperationsInterface due to ChildProcess complexity
  // We use type assertion when passing to functions that expect the interface
  private runningProcesses = new Map<number, ProcessInfo>();
  private processOutputs = new Map<string, { stdout: string; stderr: string; exitCode: number }>();
  private shouldThrow = new Map<string, Error>();
  private callLog: Array<{ method: string; args: unknown[] }> = [];
  private nextPid = 1000;

  constructor() {
    this.reset();
  }

  // Mock data setup methods
  setProcessOutput(command: string, stdout: string, stderr = "", exitCode = 0): void {
    this.processOutputs.set(command, { stdout, stderr, exitCode });
  }

  addRunningProcess(command: string, args: string[], workingDirectory?: string): ProcessInfo {
    const pid = this.nextPid++;
    const process: ProcessInfo = {
      pid,
      command,
      args,
      workingDirectory,
      startTime: new Date(),
    };
    this.runningProcesses.set(pid, process);
    return process;
  }

  setError(method: string, identifier: string, error: Error): void {
    this.shouldThrow.set(`${method}:${identifier}`, error);
  }

  getCallLog(): Array<{ method: string; args: unknown[] }> {
    return [...this.callLog];
  }

  reset(): void {
    this.runningProcesses.clear();
    this.processOutputs.clear();
    this.shouldThrow.clear();
    this.callLog = [];
    this.nextPid = 1000;

    // Set up default Claude Code installation
    this.setProcessOutput("claude --version", "Claude Code v2.1.0", "", 0);
    this.setProcessOutput("which claude", "/usr/local/bin/claude", "", 0);

    // Set up default session discovery (no active sessions)
    this.setProcessOutput("ps aux | grep claude", "", "", 0);
  }

  // ProcessOperationsInterface implementation
  async spawn(
    command: string,
    args: string[],
    options: Record<string, unknown> = {},
  ): Promise<ChildProcess> {
    this.callLog.push({ method: "spawn", args: [command, args, options] });

    const fullCommand = `${command} ${args.join(" ")}`;
    const error = this.shouldThrow.get(`spawn:${fullCommand}`);
    if (error) throw error;

    // Simulate spawning Claude Code process
    if (command === "claude" && args.includes("--workspace")) {
      const workspacePath = args[args.indexOf("--workspace") + 1];
      const process = this.addRunningProcess(command, args, workspacePath);

      return {
        pid: process.pid,
        on: vi.fn(),
        kill: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        stdin: null,
        stdio: [null, null, null, null, null],
        killed: false,
        connected: false,
        exitCode: null,
        signalCode: null,
        spawnargs: [command, ...args],
        spawnfile: command,
      } as unknown as ChildProcess;
    }

    throw new Error(`Unexpected spawn command: ${fullCommand}`);
  }

  async exec(
    command: string,
    options: Record<string, unknown> = {},
  ): Promise<{ stdout: string; stderr: string }> {
    this.callLog.push({ method: "exec", args: [command, options] });

    const error = this.shouldThrow.get(`exec:${command}`);
    if (error) throw error;

    const output = this.processOutputs.get(command);
    if (output) {
      if (output.exitCode !== 0) {
        const execError = new Error(output.stderr || "Command failed") as Error & {
          code: number;
          stdout: string;
          stderr: string;
        };
        execError.code = output.exitCode;
        execError.stdout = output.stdout;
        execError.stderr = output.stderr;
        throw execError;
      }
      return { stdout: output.stdout, stderr: output.stderr };
    }

    // Default fallback
    return { stdout: "", stderr: "" };
  }

  async kill(pid: number, signal = "SIGTERM"): Promise<boolean> {
    this.callLog.push({ method: "kill", args: [pid, signal] });

    const error = this.shouldThrow.get(`kill:${pid}`);
    if (error) throw error;

    const process = this.runningProcesses.get(pid);
    if (process) {
      this.runningProcesses.delete(pid);
      return true;
    }
    return false;
  }

  async findProcesses(pattern: string): Promise<ProcessInfo[]> {
    this.callLog.push({ method: "findProcesses", args: [pattern] });

    const error = this.shouldThrow.get(`findProcesses:${pattern}`);
    if (error) throw error;

    if (pattern.includes("claude")) {
      return Array.from(this.runningProcesses.values()).filter(
        (p) => p.command.includes("claude") || p.args.some((arg) => arg.includes("claude")),
      );
    }

    return [];
  }

  async isProcessRunning(pid: number): Promise<boolean> {
    this.callLog.push({ method: "isProcessRunning", args: [pid] });

    const error = this.shouldThrow.get(`isProcessRunning:${pid}`);
    if (error) throw error;

    return this.runningProcesses.has(pid);
  }
}

// Mock Claude Interface for testing
class MockClaudeInterface implements ClaudeInterface {
  private sessions = new Map<string, ClaudeSession>();
  private shouldThrow = new Map<string, Error>();
  private callLog: Array<{ method: string; args: unknown[] }> = [];
  private analysisResults = new Map<string, ClaudeAnalysisResult>();
  private generationResults = new Map<string, ClaudeGenerationResult>();

  constructor() {
    this.reset();
  }

  // Mock data setup methods
  setSession(sessionId: string, session: ClaudeSession): void {
    this.sessions.set(sessionId, session);
  }

  setAnalysisResult(requestId: string, result: ClaudeAnalysisResult): void {
    this.analysisResults.set(requestId, result);
  }

  setGenerationResult(requestId: string, result: ClaudeGenerationResult): void {
    this.generationResults.set(requestId, result);
  }

  setError(method: string, identifier: string, error: Error): void {
    this.shouldThrow.set(`${method}:${identifier}`, error);
  }

  getCallLog(): Array<{ method: string; args: unknown[] }> {
    return [...this.callLog];
  }

  reset(): void {
    this.sessions.clear();
    this.shouldThrow.clear();
    this.callLog = [];
    this.analysisResults.clear();
    this.generationResults.clear();
  }

  // ClaudeInterface implementation
  async launch(config: ClaudeSessionConfig): Promise<ClaudeSession> {
    this.callLog.push({ method: "launch", args: [config] });

    const error = this.shouldThrow.get(`launch:${config.workspacePath}`);
    if (error) throw error;

    if (!config.workspacePath) {
      throw new Error("Workspace path is required");
    }

    const sessionId = `session-${Date.now()}`;
    const session: ClaudeSession = {
      id: sessionId,
      pid: 1234,
      workspacePath: config.workspacePath,
      status: "active",
      startTime: new Date(),
      lastActivity: new Date(),
      config,
      contextStatus: {
        claudeMdExists: true,
        claudeDirExists: true,
        contextFilesCount: 5,
        lastSyncTime: new Date(),
        isComplete: true,
      },
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  async execute(
    sessionId: string,
    command: string,
    options?: ClaudeCommandOptions,
  ): Promise<ClaudeCommandResult> {
    this.callLog.push({ method: "execute", args: [sessionId, command, options] });

    const error = this.shouldThrow.get(`execute:${sessionId}`);
    if (error) throw error;

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status !== "active") {
      throw new Error(`Session is not active: ${session.status}`);
    }

    // Update last activity
    session.lastActivity = new Date();

    return {
      success: true,
      output: `Command executed: ${command}`,
      exitCode: 0,
      executionTime: 100,
      command,
    };
  }

  async analyze(sessionId: string, request: ClaudeAnalysisRequest): Promise<ClaudeAnalysisResult> {
    this.callLog.push({ method: "analyze", args: [sessionId, request] });

    const error = this.shouldThrow.get(`analyze:${sessionId}`);
    if (error) throw error;

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Check for pre-configured analysis result
    const requestKey = `${sessionId}:${request.analysisType}`;
    const existingResult = this.analysisResults.get(requestKey);
    if (existingResult) {
      return existingResult;
    }

    // Default mock analysis result
    const issues: ClaudeCodeIssue[] = request.code.includes("TODO")
      ? [
          {
            type: "warning",
            severity: "medium",
            message: "TODO comment found - consider implementing",
            line: 1,
            rule: "no-todos",
          },
        ]
      : [];

    const suggestions: ClaudeCodeSuggestion[] = request.code.includes("function")
      ? [
          {
            type: "optimization",
            description: "Consider using arrow function for better performance",
            impact: "low",
            effort: "low",
            code: "const myFunction = () => { ... }",
          },
        ]
      : [];

    return {
      summary: `Analysis complete for ${request.analysisType}`,
      issues,
      suggestions,
      score: 85,
      confidence: 0.9,
      analysisTime: 250,
    };
  }

  async generate(
    sessionId: string,
    request: ClaudeGenerationRequest,
  ): Promise<ClaudeGenerationResult> {
    this.callLog.push({ method: "generate", args: [sessionId, request] });

    const error = this.shouldThrow.get(`generate:${sessionId}`);
    if (error) throw error;

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Check for pre-configured generation result
    const requestKey = `${sessionId}:${request.generationType}`;
    const existingResult = this.generationResults.get(requestKey);
    if (existingResult) {
      return existingResult;
    }

    // Default mock generation result based on type
    let generatedCode = "";
    switch (request.generationType) {
      case "function":
        generatedCode = `function ${request.prompt.includes("test") ? "test" : "generated"}Function() {\n  // Generated implementation\n  return true;\n}`;
        break;
      case "class":
        generatedCode =
          "class GeneratedClass {\n  constructor() {\n    // Generated constructor\n  }\n}";
        break;
      case "test":
        generatedCode = `describe('Generated test', () => {\n  it('should work correctly', () => {\n    expect(true).toBe(true);\n  });\n});`;
        break;
      default:
        generatedCode = `// Generated code for: ${request.prompt}`;
    }

    return {
      success: true,
      generatedCode,
      explanation: `Generated ${request.generationType} based on: ${request.prompt}`,
      suggestions: ["Consider adding error handling", "Add comprehensive tests"],
      confidence: 0.85,
      warnings: [],
      generationTime: 500,
    };
  }

  async getStatus(sessionId: string): Promise<ClaudeSession> {
    this.callLog.push({ method: "getStatus", args: [sessionId] });

    const error = this.shouldThrow.get(`getStatus:${sessionId}`);
    if (error) throw error;

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return { ...session };
  }

  async terminate(sessionId: string): Promise<boolean> {
    this.callLog.push({ method: "terminate", args: [sessionId] });

    const error = this.shouldThrow.get(`terminate:${sessionId}`);
    if (error) throw error;

    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.status = "terminated";
    this.sessions.delete(sessionId);
    return true;
  }

  async validateInstallation(): Promise<ClaudeInstallationInfo> {
    this.callLog.push({ method: "validateInstallation", args: [] });

    const error = this.shouldThrow.get("validateInstallation:");
    if (error) throw error;

    return {
      isInstalled: true,
      version: "2.1.0",
      path: "/usr/local/bin/claude",
      compatible: true,
      issues: [],
    };
  }
}

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

    const error = this.shouldThrow.get(`writeFile:${path}`);
    if (error) throw error;

    this.files.set(path, {
      content,
      isDirectory: false,
      mtime: new Date(),
      size: content.length,
    });
  }

  async mkdir(path: string, options: { recursive: boolean }): Promise<void> {
    this.callLog.push({ method: "mkdir", args: [path, options] });

    const error = this.shouldThrow.get(`mkdir:${path}`);
    if (error) throw error;

    this.files.set(path, { isDirectory: true, mtime: new Date(), size: 0 });
  }

  async readdir(path: string): Promise<string[]> {
    this.callLog.push({ method: "readdir", args: [path] });

    const error = this.shouldThrow.get(`readdir:${path}`);
    if (error) throw error;

    const dir = this.files.get(path);
    if (!dir || !dir.isDirectory) {
      const enoentError = new Error(`ENOENT: no such file or directory, scandir '${path}'`);
      (enoentError as Error & { code: string }).code = "ENOENT";
      throw enoentError;
    }

    // Return files that are "inside" this directory
    const files: string[] = [];
    for (const [filePath] of this.files) {
      if (filePath.startsWith(`${path}/`) && !filePath.substring(path.length + 1).includes("/")) {
        files.push(filePath.substring(path.length + 1));
      }
    }
    return files;
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
  private callLog: Array<{ method: string; args: unknown[] }> = [];

  getCallLog(): Array<{ method: string; args: unknown[] }> {
    return [...this.callLog];
  }

  reset(): void {
    this.callLog = [];
  }

  join(...paths: string[]): string {
    this.callLog.push({ method: "join", args: paths });
    // Simple mock implementation
    return paths
      .filter((p) => p)
      .join("/")
      .replace(/\/+/g, "/");
  }

  resolve(...paths: string[]): string {
    this.callLog.push({ method: "resolve", args: paths });
    // Simple mock implementation
    const joined = this.join(...paths);
    return joined.startsWith("/") ? joined : `/${joined}`;
  }

  dirname(p: string): string {
    this.callLog.push({ method: "dirname", args: [p] });
    const lastSlash = p.lastIndexOf("/");
    return lastSlash > 0 ? p.substring(0, lastSlash) : "/";
  }

  basename(p: string): string {
    this.callLog.push({ method: "basename", args: [p] });
    const lastSlash = p.lastIndexOf("/");
    return lastSlash >= 0 ? p.substring(lastSlash + 1) : p;
  }

  extname(p: string): string {
    this.callLog.push({ method: "extname", args: [p] });
    const lastDot = p.lastIndexOf(".");
    const lastSlash = p.lastIndexOf("/");
    return lastDot > lastSlash ? p.substring(lastDot) : "";
  }
}

describe("core-claude", () => {
  let mockProcessOps: MockProcessOperations;
  let mockClaude: MockClaudeInterface;
  let mockFileSystem: MockFileSystem;
  let mockPath: MockPath;
  const testWorkspacePath = "/test/workspace";
  const testSessionId = "test-session-123";

  beforeEach(() => {
    mockProcessOps = new MockProcessOperations();
    mockClaude = new MockClaudeInterface();
    mockFileSystem = new MockFileSystem();
    mockPath = new MockPath();
  });

  describe("validateClaudeInstallation (TDD Phase 2)", () => {
    it("should validate successful Claude Code installation", async () => {
      // Act
      const result = await validateClaudeInstallation(
        mockProcessOps as unknown as ProcessOperationsInterface,
      );

      // Assert
      expect(result.isInstalled).toBe(true);
      expect(result.version).toBe("2.1.0");
      expect(result.path).toBe("/usr/local/bin/claude");
      expect(result.compatible).toBe(true);
      expect(result.issues).toHaveLength(0);

      // Verify process operations were called
      const processCalls = mockProcessOps.getCallLog();
      expect(processCalls).toContainEqual(expect.objectContaining({ method: "exec" }));
    });

    it("should handle Claude Code not installed", async () => {
      // Arrange
      mockProcessOps.setProcessOutput("which claude", "", "command not found", 1);

      // Act & Assert
      await expect(
        validateClaudeInstallation(mockProcessOps as unknown as ProcessOperationsInterface),
      ).rejects.toThrow("CLAUDE_NOT_FOUND");
    });

    it("should handle incompatible Claude Code version", async () => {
      // Arrange
      mockProcessOps.setProcessOutput("claude --version", "Claude Code v1.0.0", "", 0);

      // Act
      const result = await validateClaudeInstallation(
        mockProcessOps as unknown as ProcessOperationsInterface,
      );

      // Assert
      expect(result.isInstalled).toBe(true);
      expect(result.compatible).toBe(false);
      expect(result.issues).toContain("Version 1.0.0 may not be compatible. Recommended: 2.0.0+");
    });

    it("should handle permission errors", async () => {
      // Arrange
      mockProcessOps.setProcessOutput("claude --version", "", "Permission denied", 126);

      // Act & Assert
      await expect(
        validateClaudeInstallation(mockProcessOps as unknown as ProcessOperationsInterface),
      ).rejects.toThrow("CLAUDE_LAUNCH_FAILED");
    });
  });

  describe("launchClaudeSession (TDD Phase 2)", () => {
    const defaultConfig: ClaudeSessionConfig = {
      workspacePath: testWorkspacePath,
      timeoutMs: 30000,
      maxRetries: 3,
    };

    it("should launch Claude session with default configuration", async () => {
      // Act
      const result = await launchClaudeSession(
        defaultConfig,
        mockClaude,
        mockProcessOps as unknown as ProcessOperationsInterface,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.session.workspacePath).toBe(testWorkspacePath);
      expect(result.session.status).toBe("active");
      expect(result.session.contextStatus.isComplete).toBe(true);

      // Verify Claude interface was called
      const claudeCalls = mockClaude.getCallLog();
      expect(claudeCalls).toContainEqual(expect.objectContaining({ method: "launch" }));
    });

    it("should handle workspace path validation", async () => {
      // Arrange
      const invalidConfig = { ...defaultConfig, workspacePath: "" };

      // Act & Assert
      await expect(
        launchClaudeSession(
          invalidConfig,
          mockClaude,
          mockProcessOps as unknown as ProcessOperationsInterface,
        ),
      ).rejects.toThrow("validation");
    });

    it("should handle Claude launch failures", async () => {
      // Arrange
      const failingMockClaude = new MockClaudeInterface();
      failingMockClaude.setError("launch", testWorkspacePath, new Error("Failed to start Claude"));

      // Act & Assert
      await expect(
        launchClaudeSession(
          defaultConfig,
          failingMockClaude,
          mockProcessOps as unknown as ProcessOperationsInterface,
        ),
      ).rejects.toThrow("CLAUDE_LAUNCH_FAILED");
    });

    it("should setup workspace context when requested", async () => {
      // Arrange
      const configWithContext = {
        ...defaultConfig,
        contextFiles: ["README.md", "package.json"],
      };

      // Act
      const result = await launchClaudeSession(
        configWithContext,
        mockClaude,
        mockProcessOps as unknown as ProcessOperationsInterface,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.session.config.contextFiles).toEqual(["README.md", "package.json"]);
    });

    it("should handle session timeout during launch", async () => {
      // Arrange
      const timeoutConfig = { ...defaultConfig, timeoutMs: 100 };
      const timeoutMockClaude = new MockClaudeInterface();
      timeoutMockClaude.setError("launch", testWorkspacePath, new Error("Timeout"));

      // Act & Assert
      await expect(
        launchClaudeSession(
          timeoutConfig,
          timeoutMockClaude,
          mockProcessOps as unknown as ProcessOperationsInterface,
        ),
      ).rejects.toThrow("CLAUDE_TIMEOUT");
    });
  });

  describe("findActiveClaudeSessions (TDD Phase 2)", () => {
    beforeEach(() => {
      // Set up mock active sessions
      const activeProcess = mockProcessOps.addRunningProcess(
        "claude",
        ["--workspace", "/test/workspace1"],
        "/test/workspace1",
      );
      const session: ClaudeSession = {
        id: "session-1",
        pid: activeProcess.pid,
        workspacePath: "/test/workspace1",
        status: "active",
        startTime: new Date(),
        config: { workspacePath: "/test/workspace1" },
        contextStatus: {
          claudeMdExists: true,
          claudeDirExists: true,
          contextFilesCount: 3,
          isComplete: true,
        },
      };
      mockClaude.setSession("session-1", session);
    });

    it("should discover active Claude sessions", async () => {
      // Act
      const result = await findActiveClaudeSessions(
        mockClaude,
        mockProcessOps as unknown as ProcessOperationsInterface,
      );

      // Assert
      expect(result.totalFound).toBeGreaterThan(0);
      expect(result.activeSessions).toHaveLength(1);
      expect(result.activeSessions[0].workspacePath).toBe("/test/workspace1");
      expect(result.activeSessions[0].status).toBe("active");
    });

    it("should return empty result when no sessions found", async () => {
      // Arrange
      mockProcessOps.reset(); // Clear all processes

      // Act
      const result = await findActiveClaudeSessions(
        mockClaude,
        mockProcessOps as unknown as ProcessOperationsInterface,
      );

      // Assert
      expect(result.totalFound).toBe(0);
      expect(result.activeSessions).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle process discovery errors gracefully", async () => {
      // Arrange
      const failingProcessOps = new MockProcessOperations();
      failingProcessOps.setError(
        "findProcesses",
        "claude",
        new Error("Process enumeration failed"),
      );

      // Act & Assert
      await expect(
        findActiveClaudeSessions(
          mockClaude,
          failingProcessOps as unknown as ProcessOperationsInterface,
        ),
      ).rejects.toThrow("Failed to discover Claude sessions");
    });

    it("should filter sessions by workspace path when specified", async () => {
      // Arrange
      const options = { workspacePath: "/test/workspace1" };

      // Act
      const result = await findActiveClaudeSessions(mockClaude, mockProcessOps, options);

      // Assert
      expect(result.activeSessions).toHaveLength(1);
      expect(result.activeSessions[0].workspacePath).toBe("/test/workspace1");
    });

    it("should handle stale session cleanup", async () => {
      // Arrange
      const staleSession: ClaudeSession = {
        id: "stale-session",
        pid: 9999,
        workspacePath: "/test/stale",
        status: "error",
        startTime: new Date(Date.now() - 86400000), // 24 hours ago
        config: { workspacePath: "/test/stale" },
        contextStatus: {
          claudeMdExists: false,
          claudeDirExists: false,
          contextFilesCount: 0,
          isComplete: false,
        },
      };
      mockClaude.setSession("stale-session", staleSession);

      // Act
      const result = await findActiveClaudeSessions(mockClaude, mockProcessOps, {
        includeStale: false,
      });

      // Assert
      expect(result.activeSessions.every((s) => s.status === "active")).toBe(true);
    });
  });

  describe("getClaudeSessionStatus (TDD Phase 2)", () => {
    beforeEach(() => {
      const testSession: ClaudeSession = {
        id: testSessionId,
        pid: 5678,
        workspacePath: testWorkspacePath,
        status: "active",
        startTime: new Date(),
        lastActivity: new Date(),
        config: { workspacePath: testWorkspacePath },
        contextStatus: {
          claudeMdExists: true,
          claudeDirExists: true,
          contextFilesCount: 3,
          isComplete: true,
        },
      };
      mockClaude.setSession(testSessionId, testSession);
    });

    it("should return session status for valid session ID", async () => {
      // Act
      const result = await getClaudeSessionStatus(testSessionId, mockClaude);

      // Assert
      expect(result.id).toBe(testSessionId);
      expect(result.status).toBe("active");
      expect(result.workspacePath).toBe(testWorkspacePath);
      expect(result.contextStatus.isComplete).toBe(true);

      // Verify Claude interface was called
      const claudeCalls = mockClaude.getCallLog();
      expect(claudeCalls).toContainEqual(expect.objectContaining({ method: "getStatus" }));
    });

    it("should handle non-existent session", async () => {
      // Act & Assert
      await expect(getClaudeSessionStatus("non-existent", mockClaude)).rejects.toThrow(
        "CLAUDE_SESSION_NOT_FOUND",
      );
    });

    it("should validate session ID parameter", async () => {
      // Act & Assert
      await expect(getClaudeSessionStatus("", mockClaude)).rejects.toThrow("validation");
    });

    it("should handle Claude interface errors gracefully", async () => {
      // Arrange
      const errorMockClaude = new MockClaudeInterface();
      errorMockClaude.setError("getStatus", testSessionId, new Error("Connection lost"));

      // Act & Assert
      await expect(getClaudeSessionStatus(testSessionId, errorMockClaude)).rejects.toThrow(
        "CLAUDE_COMMAND_FAILED",
      );
    });
  });

  describe("terminateClaudeSession (TDD Phase 2)", () => {
    beforeEach(() => {
      const testSession: ClaudeSession = {
        id: testSessionId,
        pid: 5678,
        workspacePath: testWorkspacePath,
        status: "active",
        startTime: new Date(),
        config: { workspacePath: testWorkspacePath },
        contextStatus: {
          claudeMdExists: true,
          claudeDirExists: true,
          contextFilesCount: 3,
          isComplete: true,
        },
      };
      mockClaude.setSession(testSessionId, testSession);
    });

    it("should terminate active session successfully", async () => {
      // Act
      const result = await terminateClaudeSession(testSessionId, mockClaude);

      // Assert
      expect(result).toBe(true);

      // Verify Claude interface was called
      const claudeCalls = mockClaude.getCallLog();
      expect(claudeCalls).toContainEqual(expect.objectContaining({ method: "terminate" }));
    });

    it("should handle non-existent session termination", async () => {
      // Act
      const result = await terminateClaudeSession("non-existent", mockClaude);

      // Assert
      expect(result).toBe(false);
    });

    it("should validate session ID parameter", async () => {
      // Act & Assert
      await expect(terminateClaudeSession("", mockClaude)).rejects.toThrow("validation");
    });

    it("should handle termination errors gracefully", async () => {
      // Arrange
      const errorMockClaude = new MockClaudeInterface();
      errorMockClaude.setError("terminate", testSessionId, new Error("Failed to terminate"));

      // Act & Assert
      await expect(terminateClaudeSession(testSessionId, errorMockClaude)).rejects.toThrow(
        "CLAUDE_COMMAND_FAILED",
      );
    });
  });

  describe("executeClaudeCommand (TDD Phase 3)", () => {
    beforeEach(() => {
      const testSession: ClaudeSession = {
        id: testSessionId,
        pid: 5678,
        workspacePath: testWorkspacePath,
        status: "active",
        startTime: new Date(),
        config: { workspacePath: testWorkspacePath },
        contextStatus: {
          claudeMdExists: true,
          claudeDirExists: true,
          contextFilesCount: 3,
          isComplete: true,
        },
      };
      mockClaude.setSession(testSessionId, testSession);
    });

    it("should execute command successfully", async () => {
      // Arrange
      const command = "generate function calculateTotal";
      const options: ClaudeCommandOptions = { timeout: 5000 };

      // Act
      const result = await executeClaudeCommand(testSessionId, command, options, mockClaude);

      // Assert
      expect(result.success).toBe(true);
      expect(result.command).toBe(command);
      expect(result.exitCode).toBe(0);
      expect(result.executionTime).toBeGreaterThan(0);

      // Verify Claude interface was called
      const claudeCalls = mockClaude.getCallLog();
      expect(claudeCalls).toContainEqual(expect.objectContaining({ method: "execute" }));
    });

    it("should handle command execution with default options", async () => {
      // Arrange
      const command = "analyze code quality";

      // Act
      const result = await executeClaudeCommand(testSessionId, command, {}, mockClaude);

      // Assert
      expect(result.success).toBe(true);
      expect(result.command).toBe(command);
    });

    it("should validate session ID parameter", async () => {
      // Act & Assert
      await expect(executeClaudeCommand("", "test command", {}, mockClaude)).rejects.toThrow(
        "validation",
      );
    });

    it("should validate command parameter", async () => {
      // Act & Assert
      await expect(executeClaudeCommand(testSessionId, "", {}, mockClaude)).rejects.toThrow(
        "validation",
      );
    });

    it("should handle command execution failures", async () => {
      // Arrange
      const errorMockClaude = new MockClaudeInterface();
      errorMockClaude.setError("execute", testSessionId, new Error("Command failed"));

      // Act & Assert
      await expect(
        executeClaudeCommand(testSessionId, "test command", {}, errorMockClaude),
      ).rejects.toThrow("CLAUDE_COMMAND_FAILED");
    });
  });

  describe("setupClaudeWorkspace (TDD Phase 3)", () => {
    it("should setup workspace with default options", async () => {
      // Act
      const result = await setupClaudeWorkspace(testWorkspacePath, {}, mockFileSystem, mockPath);

      // Assert
      expect(result.success).toBe(true);
      expect(result.contextStatus).toBeDefined();
      expect(result.setupFiles).toBeDefined();
    });

    it("should setup workspace with context files", async () => {
      // Arrange
      const options: WorkspaceSetupOptions = {
        setupContext: true,
        contextFiles: ["README.md", "package.json", "tsconfig.json"],
      };

      // Act
      const result = await setupClaudeWorkspace(
        testWorkspacePath,
        options,
        mockFileSystem,
        mockPath,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.contextStatus.isComplete).toBeDefined();
    });

    it("should handle repository synchronization", async () => {
      // Arrange
      const options: WorkspaceSetupOptions = {
        syncFromRepository: true,
        includeGitIgnore: true,
      };

      // Act
      const result = await setupClaudeWorkspace(
        testWorkspacePath,
        options,
        mockFileSystem,
        mockPath,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.setupFiles).toBeDefined();
    });

    it("should validate workspace path parameter", async () => {
      // Act & Assert
      await expect(setupClaudeWorkspace("")).rejects.toThrow("validation");
    });

    it("should handle workspace setup failures gracefully", async () => {
      // Arrange
      const invalidPath = "/invalid/nonexistent/path";

      // Act
      const result = await setupClaudeWorkspace(invalidPath, {}, mockFileSystem, mockPath);

      // Assert - Should still return a result but with warnings
      expect(result.success).toBe(true);
    });
  });

  describe("configureClaudeSettings (TDD Phase 3)", () => {
    it("should configure Claude settings successfully", async () => {
      // Arrange
      const config: ClaudeSettingsConfig = {
        modelPreferences: {
          primary: "claude-3-5-sonnet-20241022",
          fallback: "claude-3-haiku-20240307",
          maxTokens: 4000,
          temperature: 0.7,
        },
        contextOptimization: true,
        autoSave: true,
        workflowIntegration: true,
      };

      // Act
      const result = await configureClaudeSettings(
        testWorkspacePath,
        config,
        mockFileSystem,
        mockPath,
      );

      // Assert
      expect(result).toBe(true);
    });

    it("should handle minimal configuration", async () => {
      // Arrange
      const config: ClaudeSettingsConfig = {
        autoSave: false,
      };

      // Act
      const result = await configureClaudeSettings(
        testWorkspacePath,
        config,
        mockFileSystem,
        mockPath,
      );

      // Assert
      expect(result).toBe(true);
    });

    it("should configure custom prompts", async () => {
      // Arrange
      const config: ClaudeSettingsConfig = {
        customPrompts: {
          codeReview: "Please review this code for security and performance issues",
          documentation: "Generate comprehensive documentation for this code",
          testing: "Create unit tests for this function",
        },
      };

      // Act
      const result = await configureClaudeSettings(
        testWorkspacePath,
        config,
        mockFileSystem,
        mockPath,
      );

      // Assert
      expect(result).toBe(true);
    });

    it("should validate workspace path parameter", async () => {
      // Act & Assert
      await expect(configureClaudeSettings("", {}, mockFileSystem, mockPath)).rejects.toThrow(
        "validation",
      );
    });
  });

  describe("handleClaudeContext (TDD Phase 3)", () => {
    it("should handle context synchronization with default options", async () => {
      // Act
      const result = await handleClaudeContext(testWorkspacePath, {}, mockFileSystem, mockPath);

      // Assert
      expect(result.success).toBe(true);
      expect(result.contextStatus).toBeDefined();
      expect(result.syncedFiles).toBeDefined();
    });

    it("should sync context from repository", async () => {
      // Arrange
      const options: ContextHandleOptions = {
        syncFromRepository: true,
        updateContextFiles: true,
        validateCompleteness: true,
      };

      // Act
      const result = await handleClaudeContext(
        testWorkspacePath,
        options,
        mockFileSystem,
        mockPath,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.contextStatus.isComplete).toBeDefined();
    });

    it("should preserve user changes when requested", async () => {
      // Arrange
      const options: ContextHandleOptions = {
        preserveUserChanges: true,
        updateContextFiles: true,
      };

      // Act
      const result = await handleClaudeContext(
        testWorkspacePath,
        options,
        mockFileSystem,
        mockPath,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.conflicts).toBeDefined();
    });

    it("should validate workspace path parameter", async () => {
      // Act & Assert
      await expect(handleClaudeContext("", {}, mockFileSystem, mockPath)).rejects.toThrow(
        "validation",
      );
    });

    it("should detect and report context conflicts", async () => {
      // Arrange
      const options: ContextHandleOptions = {
        syncFromRepository: true,
        preserveUserChanges: true,
      };

      // Act
      const result = await handleClaudeContext(
        testWorkspacePath,
        options,
        mockFileSystem,
        mockPath,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.conflicts).toBeDefined();
    });
  });

  describe("analyzeCodeWithClaude (TDD Phase 4)", () => {
    beforeEach(() => {
      const testSession: ClaudeSession = {
        id: testSessionId,
        pid: 5678,
        workspacePath: testWorkspacePath,
        status: "active",
        startTime: new Date(),
        config: { workspacePath: testWorkspacePath },
        contextStatus: {
          claudeMdExists: true,
          claudeDirExists: true,
          contextFilesCount: 3,
          isComplete: true,
        },
      };
      mockClaude.setSession(testSessionId, testSession);
    });

    it("should analyze code for quality issues", async () => {
      // Arrange
      const request: ClaudeAnalysisRequest = {
        code: "function calculateTotal(items) { return items.reduce((sum, item) => sum + item.price, 0); }",
        analysisType: "quality",
        includeContext: true,
      };

      // Act
      const result = await analyzeCodeWithClaude(testSessionId, request, mockClaude);

      // Assert
      expect(result.summary).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(result.suggestions).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.analysisTime).toBeGreaterThan(0);

      // Verify Claude interface was called
      const claudeCalls = mockClaude.getCallLog();
      expect(claudeCalls).toContainEqual(expect.objectContaining({ method: "analyze" }));
    });

    it("should perform comprehensive code analysis", async () => {
      // Arrange
      const request: ClaudeAnalysisRequest = {
        code: "// TODO: implement error handling\nfunction riskyFunction() { throw new Error('Not implemented'); }",
        analysisType: "comprehensive",
        filePath: "src/utils.ts",
        contextFiles: ["src/types.ts"],
      };

      // Act
      const result = await analyzeCodeWithClaude(testSessionId, request, mockClaude);

      // Assert
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: "warning",
          message: expect.stringContaining("TODO"),
        }),
      );
      expect(result.suggestions).toBeDefined();
    });

    it("should analyze code for security vulnerabilities", async () => {
      // Arrange
      const request: ClaudeAnalysisRequest = {
        code: "function executeUserInput(input) { eval(input); }",
        analysisType: "security",
      };

      // Act
      const result = await analyzeCodeWithClaude(testSessionId, request, mockClaude);

      // Assert
      expect(result.summary).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should validate session ID parameter", async () => {
      // Arrange
      const request: ClaudeAnalysisRequest = {
        code: "const x = 1;",
        analysisType: "quality",
      };

      // Act & Assert
      await expect(analyzeCodeWithClaude("", request, mockClaude)).rejects.toThrow("validation");
    });

    it("should validate code parameter", async () => {
      // Arrange
      const request: ClaudeAnalysisRequest = {
        code: "",
        analysisType: "quality",
      };

      // Act & Assert
      await expect(analyzeCodeWithClaude(testSessionId, request, mockClaude)).rejects.toThrow(
        "validation",
      );
    });

    it("should handle analysis failures gracefully", async () => {
      // Arrange
      const errorMockClaude = new MockClaudeInterface();
      errorMockClaude.setError("analyze", testSessionId, new Error("Analysis failed"));
      const request: ClaudeAnalysisRequest = {
        code: "const x = 1;",
        analysisType: "quality",
      };

      // Act & Assert
      await expect(analyzeCodeWithClaude(testSessionId, request, errorMockClaude)).rejects.toThrow(
        "CLAUDE_COMMAND_FAILED",
      );
    });
  });

  describe("generateCodeWithClaude (TDD Phase 4)", () => {
    beforeEach(() => {
      const testSession: ClaudeSession = {
        id: testSessionId,
        pid: 5678,
        workspacePath: testWorkspacePath,
        status: "active",
        startTime: new Date(),
        config: { workspacePath: testWorkspacePath },
        contextStatus: {
          claudeMdExists: true,
          claudeDirExists: true,
          contextFilesCount: 3,
          isComplete: true,
        },
      };
      mockClaude.setSession(testSessionId, testSession);
    });

    it("should generate function code", async () => {
      // Arrange
      const request: ClaudeGenerationRequest = {
        prompt: "Create a function to calculate the factorial of a number",
        generationType: "function",
        context: {
          style: "typescript",
          requirements: ["handle edge cases", "include type annotations"],
        },
        constraints: {
          includeComments: true,
          includeTests: false,
        },
      };

      // Act
      const result = await generateCodeWithClaude(testSessionId, request, mockClaude);

      // Assert
      expect(result.success).toBe(true);
      expect(result.generatedCode).toContain("function");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.generationTime).toBeGreaterThan(0);

      // Verify Claude interface was called
      const claudeCalls = mockClaude.getCallLog();
      expect(claudeCalls).toContainEqual(expect.objectContaining({ method: "generate" }));
    });

    it("should generate test code", async () => {
      // Arrange
      const request: ClaudeGenerationRequest = {
        prompt: "Generate tests for a utility function",
        generationType: "test",
        context: {
          existingCode: "function add(a, b) { return a + b; }",
          style: "typescript",
        },
        constraints: {
          followExistingPatterns: true,
        },
      };

      // Act
      const result = await generateCodeWithClaude(testSessionId, request, mockClaude);

      // Assert
      expect(result.success).toBe(true);
      expect(result.generatedCode).toContain("describe");
      expect(result.explanation).toBeDefined();
    });

    it("should generate class code", async () => {
      // Arrange
      const request: ClaudeGenerationRequest = {
        prompt: "Create a UserManager class",
        generationType: "class",
        context: {
          style: "oop",
        },
      };

      // Act
      const result = await generateCodeWithClaude(testSessionId, request, mockClaude);

      // Assert
      expect(result.success).toBe(true);
      expect(result.generatedCode).toContain("class");
    });

    it("should validate session ID parameter", async () => {
      // Arrange
      const request: ClaudeGenerationRequest = {
        prompt: "Generate code",
        generationType: "function",
      };

      // Act & Assert
      await expect(generateCodeWithClaude("", request, mockClaude)).rejects.toThrow("validation");
    });

    it("should validate prompt parameter", async () => {
      // Arrange
      const request: ClaudeGenerationRequest = {
        prompt: "",
        generationType: "function",
      };

      // Act & Assert
      await expect(generateCodeWithClaude(testSessionId, request, mockClaude)).rejects.toThrow(
        "validation",
      );
    });

    it("should handle generation failures gracefully", async () => {
      // Arrange
      const errorMockClaude = new MockClaudeInterface();
      errorMockClaude.setError("generate", testSessionId, new Error("Generation failed"));
      const request: ClaudeGenerationRequest = {
        prompt: "Generate code",
        generationType: "function",
      };

      // Act & Assert
      await expect(generateCodeWithClaude(testSessionId, request, errorMockClaude)).rejects.toThrow(
        "CLAUDE_COMMAND_FAILED",
      );
    });
  });
});
