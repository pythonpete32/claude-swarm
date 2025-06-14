/**
 * Core Claude Integration Module for Claude Swarm
 *
 * Provides Claude Code integration operations supporting AI-assisted development workflows,
 * session management, and intelligent code generation across all Claude Swarm operations.
 */

import { exec, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";

import { ERROR_CODES, ErrorFactory } from "../shared/errors";
import { CommonValidators } from "../shared/validation";
import type { FileSystemInterface, PathInterface } from "./files";
import { defaultFileSystem, defaultPath } from "./files";

const execAsync = promisify(exec);

/**
 * Core Claude session management interfaces
 */
export interface ClaudeSession {
  id: string;
  pid: number;
  workspacePath: string;
  status: "launching" | "active" | "idle" | "error" | "terminated";
  startTime: Date;
  lastActivity?: Date;
  config: ClaudeSessionConfig;
  contextStatus: ClaudeContextStatus;
}

export interface ClaudeSessionConfig {
  workspacePath: string;
  modelPreferences?: ClaudeModelConfig;
  contextFiles?: string[];
  environmentVars?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface ClaudeModelConfig {
  primary?: string;
  fallback?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ClaudeContextStatus {
  claudeMdExists: boolean;
  claudeDirExists: boolean;
  contextFilesCount: number;
  lastSyncTime?: Date;
  isComplete: boolean;
}

/**
 * AI operation interfaces
 */
export interface ClaudeAnalysisRequest {
  code: string;
  filePath?: string;
  analysisType: "quality" | "security" | "performance" | "maintainability" | "comprehensive";
  includeContext?: boolean;
  contextFiles?: string[];
}

export interface ClaudeAnalysisResult {
  summary: string;
  issues: ClaudeCodeIssue[];
  suggestions: ClaudeCodeSuggestion[];
  score?: number;
  confidence: number;
  analysisTime: number;
}

export interface ClaudeCodeIssue {
  type: "error" | "warning" | "suggestion" | "info";
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  line?: number;
  column?: number;
  rule?: string;
  fix?: ClaudeCodeFix;
}

export interface ClaudeCodeFix {
  description: string;
  newCode: string;
  startLine: number;
  endLine: number;
  automatic: boolean;
}

export interface ClaudeCodeSuggestion {
  type: "optimization" | "refactor" | "style" | "architecture";
  description: string;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  code?: string;
  explanation?: string;
}

export interface ClaudeGenerationRequest {
  prompt: string;
  generationType: "function" | "class" | "module" | "test" | "documentation" | "fix";
  context?: {
    filePath?: string;
    existingCode?: string;
    requirements?: string[];
    style?: "typescript" | "javascript" | "functional" | "oop";
  };
  constraints?: {
    maxLines?: number;
    includeTests?: boolean;
    includeComments?: boolean;
    followExistingPatterns?: boolean;
  };
}

export interface ClaudeGenerationResult {
  success: boolean;
  generatedCode: string;
  explanation?: string;
  suggestions?: string[];
  confidence: number;
  warnings?: string[];
  generationTime: number;
}

/**
 * Command execution interfaces
 */
export interface ClaudeCommandOptions {
  timeout?: number;
  retries?: number;
  silent?: boolean;
  workingDirectory?: string;
  environmentVars?: Record<string, string>;
}

export interface ClaudeCommandResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  executionTime: number;
  command: string;
}

/**
 * Session management results
 */
export interface LaunchSessionResult {
  success: boolean;
  session: ClaudeSession;
  warnings?: string[];
}

export interface SessionDiscoveryResult {
  activeSessions: ClaudeSession[];
  totalFound: number;
  errors?: SessionDiscoveryError[];
}

export interface SessionDiscoveryError {
  pid: number;
  error: string;
  recoverable: boolean;
}

export interface SessionDiscoveryOptions {
  workspacePath?: string;
  includeStale?: boolean;
  maxAge?: number;
}

/**
 * Process operations interface for dependency injection
 */
export interface ProcessOperationsInterface {
  spawn(command: string, args: string[], options?: any): Promise<any>;
  exec(command: string, options?: any): Promise<{ stdout: string; stderr: string }>;
  kill(pid: number, signal?: string): Promise<boolean>;
  findProcesses(pattern: string): Promise<ProcessInfo[]>;
  isProcessRunning(pid: number): Promise<boolean>;
}

export interface ProcessInfo {
  pid: number;
  command: string;
  args: string[];
  workingDirectory?: string;
  startTime: Date;
}

/**
 * Claude Code interface for dependency injection
 */
export interface ClaudeInterface {
  launch(config: ClaudeSessionConfig): Promise<ClaudeSession>;
  execute(
    sessionId: string,
    command: string,
    options?: ClaudeCommandOptions,
  ): Promise<ClaudeCommandResult>;
  analyze(sessionId: string, request: ClaudeAnalysisRequest): Promise<ClaudeAnalysisResult>;
  generate(sessionId: string, request: ClaudeGenerationRequest): Promise<ClaudeGenerationResult>;
  getStatus(sessionId: string): Promise<ClaudeSession>;
  terminate(sessionId: string): Promise<boolean>;
  validateInstallation(): Promise<ClaudeInstallationInfo>;
}

export interface ClaudeInstallationInfo {
  isInstalled: boolean;
  version?: string;
  path?: string;
  compatible: boolean;
  issues?: string[];
}

/**
 * Workspace and context management
 */
export interface WorkspaceSetupOptions {
  setupContext?: boolean;
  syncFromRepository?: boolean;
  includeGitIgnore?: boolean;
  contextFiles?: string[];
}

export interface WorkspaceSetupResult {
  success: boolean;
  contextStatus: ClaudeContextStatus;
  setupFiles: string[];
  warnings?: string[];
}

export interface ClaudeSettingsConfig {
  modelPreferences?: ClaudeModelConfig;
  contextOptimization?: boolean;
  autoSave?: boolean;
  workflowIntegration?: boolean;
  customPrompts?: Record<string, string>;
}

export interface ContextHandleOptions {
  syncFromRepository?: boolean;
  updateContextFiles?: boolean;
  validateCompleteness?: boolean;
  preserveUserChanges?: boolean;
}

export interface ContextHandleResult {
  success: boolean;
  syncedFiles: string[];
  contextStatus: ClaudeContextStatus;
  conflicts?: string[];
}

/**
 * Default process operations implementation
 */
class DefaultProcessOperations implements ProcessOperationsInterface {
  async spawn(command: string, args: string[], options: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        ...options,
      });

      const timeout = options.timeout || 30000;
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`Process timeout after ${timeout}ms`));
      }, timeout);

      child.on("spawn", () => {
        clearTimeout(timer);
        resolve(child);
      });

      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  async exec(command: string, options: any = {}): Promise<{ stdout: string; stderr: string }> {
    try {
      const result = await execAsync(command, {
        timeout: options.timeout || 10000,
        ...options,
      });
      return {
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
      };
    } catch (error) {
      throw error;
    }
  }

  async kill(pid: number, signal = "SIGTERM"): Promise<boolean> {
    try {
      process.kill(pid, signal);
      return true;
    } catch (error) {
      return false;
    }
  }

  async findProcesses(pattern: string): Promise<ProcessInfo[]> {
    try {
      const { stdout } = await this.exec(`ps aux | grep "${pattern}" | grep -v grep`);
      const processes: ProcessInfo[] = [];

      for (const line of stdout.trim().split("\n")) {
        if (line.trim()) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 11) {
            processes.push({
              pid: Number.parseInt(parts[1]),
              command: parts[10],
              args: parts.slice(11),
              startTime: new Date(),
            });
          }
        }
      }

      return processes;
    } catch (error) {
      return [];
    }
  }

  async isProcessRunning(pid: number): Promise<boolean> {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Default Claude interface implementation
 */
class DefaultClaudeInterface implements ClaudeInterface {
  private sessions = new Map<string, ClaudeSession>();
  private processOps: ProcessOperationsInterface;
  private fileSystem: FileSystemInterface;
  private pathOps: PathInterface;

  constructor(
    processOps: ProcessOperationsInterface = defaultProcessOps,
    fileSystem: FileSystemInterface = defaultFileSystem,
    pathOps: PathInterface = defaultPath,
  ) {
    this.processOps = processOps;
    this.fileSystem = fileSystem;
    this.pathOps = pathOps;
  }

  async launch(config: ClaudeSessionConfig): Promise<ClaudeSession> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Spawn actual Claude Code process
      const claudeArgs = [
        "--workspace",
        config.workspacePath,
        "--format",
        "json",
        "--session-id",
        sessionId,
      ];

      if (config.modelPreferences?.primary) {
        claudeArgs.push("--model", config.modelPreferences.primary);
      }

      if (config.contextFiles && config.contextFiles.length > 0) {
        claudeArgs.push("--context-files", config.contextFiles.join(","));
      }

      const childProcess = await this.processOps.spawn("claude", claudeArgs, {
        cwd: config.workspacePath,
        timeout: config.timeoutMs || 30000,
        env: {
          ...process.env,
          ...config.environmentVars,
        },
      });

      // Check if workspace has Claude context
      const contextStatus = await this.checkClaudeContext(config.workspacePath);

      const session: ClaudeSession = {
        id: sessionId,
        pid: childProcess.pid,
        workspacePath: config.workspacePath,
        status: "launching",
        startTime: new Date(),
        config,
        contextStatus,
      };

      this.sessions.set(sessionId, session);

      // Wait for Claude to be ready
      await this.waitForClaudeReady(sessionId, childProcess);

      session.status = "active";
      session.lastActivity = new Date();

      return session;
    } catch (error) {
      throw new Error(`Failed to launch Claude session: ${(error as Error).message}`);
    }
  }

  async execute(
    sessionId: string,
    command: string,
    options?: ClaudeCommandOptions,
  ): Promise<ClaudeCommandResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const startTime = Date.now();

    try {
      // Execute command via Claude Code CLI
      const claudeArgs = ["--session-id", sessionId, "--command", command, "--format", "json"];

      if (options?.timeout) {
        claudeArgs.push("--timeout", options.timeout.toString());
      }

      const result = await this.processOps.exec(`claude ${claudeArgs.join(" ")}`, {
        cwd: options?.workingDirectory || session.workspacePath,
        timeout: options?.timeout || 30000,
        env: {
          ...process.env,
          ...options?.environmentVars,
        },
      });

      session.lastActivity = new Date();

      return {
        success: result.stderr.length === 0,
        output: result.stdout,
        error: result.stderr || undefined,
        exitCode: 0,
        executionTime: Date.now() - startTime,
        command,
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: (error as Error).message,
        exitCode: 1,
        executionTime: Date.now() - startTime,
        command,
      };
    }
  }

  async analyze(sessionId: string, request: ClaudeAnalysisRequest): Promise<ClaudeAnalysisResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const startTime = Date.now();

    try {
      const claudeArgs = [
        "--session-id",
        sessionId,
        "--analyze",
        "--type",
        request.analysisType,
        "--format",
        "json",
      ];

      if (request.filePath) {
        claudeArgs.push("--file", request.filePath);
      }

      if (request.includeContext) {
        claudeArgs.push("--include-context");
      }

      if (request.contextFiles && request.contextFiles.length > 0) {
        claudeArgs.push("--context-files", request.contextFiles.join(","));
      }

      // Write code to temporary file for analysis
      const tempFile = this.pathOps.join(session.workspacePath, ".claude-temp-analysis.txt");
      await this.fileSystem.writeFile(tempFile, request.code, "utf-8");

      try {
        claudeArgs.push("--input", tempFile);

        const result = await this.processOps.exec(`claude ${claudeArgs.join(" ")}`, {
          cwd: session.workspacePath,
          timeout: 60000, // Analysis can take longer
        });

        // Parse Claude's JSON response
        const analysisData = JSON.parse(result.stdout);

        return {
          summary: analysisData.summary || `Analysis complete for ${request.analysisType}`,
          issues: analysisData.issues || [],
          suggestions: analysisData.suggestions || [],
          score: analysisData.score,
          confidence: analysisData.confidence || 0.8,
          analysisTime: Date.now() - startTime,
        };
      } finally {
        // Clean up temp file
        try {
          await this.fileSystem.unlink(tempFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      throw new Error(`Analysis failed: ${(error as Error).message}`);
    }
  }

  async generate(
    sessionId: string,
    request: ClaudeGenerationRequest,
  ): Promise<ClaudeGenerationResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const startTime = Date.now();

    try {
      const claudeArgs = [
        "--session-id",
        sessionId,
        "--generate",
        "--type",
        request.generationType,
        "--prompt",
        `"${request.prompt}"`,
        "--format",
        "json",
      ];

      if (request.context?.filePath) {
        claudeArgs.push("--context-file", request.context.filePath);
      }

      if (request.context?.style) {
        claudeArgs.push("--style", request.context.style);
      }

      if (request.constraints?.maxLines) {
        claudeArgs.push("--max-lines", request.constraints.maxLines.toString());
      }

      if (request.constraints?.includeComments) {
        claudeArgs.push("--include-comments");
      }

      if (request.constraints?.includeTests) {
        claudeArgs.push("--include-tests");
      }

      const result = await this.processOps.exec(`claude ${claudeArgs.join(" ")}`, {
        cwd: session.workspacePath,
        timeout: 60000, // Generation can take longer
      });

      // Parse Claude's JSON response
      const generationData = JSON.parse(result.stdout);

      return {
        success: true,
        generatedCode: generationData.code || generationData.generatedCode || "",
        explanation: generationData.explanation,
        suggestions: generationData.suggestions || [],
        confidence: generationData.confidence || 0.8,
        warnings: generationData.warnings || [],
        generationTime: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(`Generation failed: ${(error as Error).message}`);
    }
  }

  async getStatus(sessionId: string): Promise<ClaudeSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Check if process is still running
    const isRunning = await this.processOps.isProcessRunning(session.pid);
    if (!isRunning && session.status === "active") {
      session.status = "terminated";
    }

    // Update context status
    session.contextStatus = await this.checkClaudeContext(session.workspacePath);

    return { ...session };
  }

  async terminate(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    try {
      // Try graceful shutdown first
      await this.processOps.exec(`claude --session-id ${sessionId} --shutdown`, {
        timeout: 5000,
      });
    } catch {
      // If graceful shutdown fails, force kill
      await this.processOps.kill(session.pid, "SIGTERM");
    }

    session.status = "terminated";
    this.sessions.delete(sessionId);
    return true;
  }

  async validateInstallation(): Promise<ClaudeInstallationInfo> {
    try {
      const result = await this.processOps.exec("claude --version");
      const versionMatch = result.stdout.match(/v?([\d.]+)/);
      const version = versionMatch ? versionMatch[1] : "unknown";

      const pathResult = await this.processOps.exec("which claude");
      const claudePath = pathResult.stdout.trim();

      const compatible = checkVersionCompatibility(version);
      const issues: string[] = [];

      if (!compatible) {
        issues.push(`Version ${version} may not be compatible. Recommended: 2.0.0+`);
      }

      return {
        isInstalled: true,
        version,
        path: claudePath,
        compatible,
        issues,
      };
    } catch (error) {
      return {
        isInstalled: false,
        compatible: false,
        issues: ["Claude Code is not installed or not accessible"],
      };
    }
  }

  private async waitForClaudeReady(sessionId: string, childProcess: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Claude session startup timeout"));
      }, 30000);

      // Monitor process output for ready signal
      childProcess.stdout?.on("data", (data: Buffer) => {
        const output = data.toString();
        if (output.includes("SESSION_READY") || output.includes(sessionId)) {
          clearTimeout(timeout);
          resolve();
        }
      });

      childProcess.on("error", (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });

      childProcess.on("exit", (code: number) => {
        if (code !== 0) {
          clearTimeout(timeout);
          reject(new Error(`Claude process exited with code ${code}`));
        }
      });
    });
  }

  private async checkClaudeContext(workspacePath: string): Promise<ClaudeContextStatus> {
    try {
      const claudeMdPath = this.pathOps.join(workspacePath, "CLAUDE.md");
      const claudeDirPath = this.pathOps.join(workspacePath, ".claude");

      const [claudeMdExists, claudeDirExists] = await Promise.all([
        this.fileSystem
          .access(claudeMdPath)
          .then(() => true)
          .catch(() => false),
        this.fileSystem
          .access(claudeDirPath)
          .then(() => true)
          .catch(() => false),
      ]);

      let contextFilesCount = 0;
      if (claudeDirExists) {
        try {
          const files = await this.fileSystem.readdir(claudeDirPath);
          contextFilesCount = files.length;
        } catch {
          contextFilesCount = 0;
        }
      }

      return {
        claudeMdExists,
        claudeDirExists,
        contextFilesCount,
        lastSyncTime: claudeDirExists ? new Date() : undefined,
        isComplete: claudeMdExists && claudeDirExists && contextFilesCount > 0,
      };
    } catch {
      return {
        claudeMdExists: false,
        claudeDirExists: false,
        contextFilesCount: 0,
        isComplete: false,
      };
    }
  }
}

// Default instances
const defaultProcessOps = new DefaultProcessOperations();
const defaultClaude = new DefaultClaudeInterface();

/**
 * Validate Claude Code installation and compatibility.
 *
 * @param processOps Process operations instance (for dependency injection)
 * @returns Installation information
 */
export async function validateClaudeInstallation(
  processOps: ProcessOperationsInterface = defaultProcessOps,
): Promise<ClaudeInstallationInfo> {
  try {
    // Check if Claude Code is installed
    const { stdout: whichOutput } = await processOps.exec("which claude");
    const claudePath = whichOutput.trim();

    if (!claudePath) {
      throw ErrorFactory.claude(
        ERROR_CODES.CLAUDE_NOT_FOUND,
        "Claude Code is not installed or not in PATH",
        { suggestion: "Install Claude Code with 'npm install -g @anthropic-ai/claude-code'" },
      );
    }

    // Check version
    const { stdout: versionOutput } = await processOps.exec("claude --version");
    const versionMatch = versionOutput.match(/v?(\d+\.\d+\.\d+)/);
    const version = versionMatch ? versionMatch[1] : "unknown";

    // Check compatibility
    const compatible = checkVersionCompatibility(version);
    const issues: string[] = [];

    if (!compatible) {
      issues.push(`Version ${version} may not be compatible. Recommended: 2.0.0+`);
    }

    return {
      isInstalled: true,
      version,
      path: claudePath,
      compatible,
      issues,
    };
  } catch (error) {
    if (
      (error as any).code === "EACCES" ||
      (error as Error).message.includes("Permission denied")
    ) {
      throw ErrorFactory.claude(
        ERROR_CODES.CLAUDE_LAUNCH_FAILED,
        "CLAUDE_LAUNCH_FAILED: Permission denied accessing Claude Code",
        { suggestion: "Check file permissions and user access rights" },
      );
    }

    if (
      (error as Error).message.includes("command not found") ||
      (error as Error).message.includes("Command failed")
    ) {
      throw ErrorFactory.claude(
        ERROR_CODES.CLAUDE_NOT_FOUND,
        "CLAUDE_NOT_FOUND: Claude Code is not installed",
        { suggestion: "Install Claude Code with 'npm install -g @anthropic-ai/claude-code'" },
      );
    }

    // Re-throw any other errors that were intended to be thrown by the mock
    throw error;
  }
}

/**
 * Launch a new Claude Code session.
 *
 * @param config Session configuration
 * @param claudeInterface Claude interface instance (for dependency injection)
 * @param processOps Process operations instance (for dependency injection)
 * @returns Session launch result
 */
export async function launchClaudeSession(
  config: ClaudeSessionConfig,
  claudeInterface: ClaudeInterface = defaultClaude,
  processOps: ProcessOperationsInterface = defaultProcessOps,
): Promise<LaunchSessionResult> {
  // Validate configuration
  if (!config.workspacePath || config.workspacePath.trim().length === 0) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Workspace path is required",
      { suggestion: "Provide valid workspace path" },
    );
  }

  try {
    const session = await claudeInterface.launch(config);

    return {
      success: true,
      session,
      warnings: [],
    };
  } catch (error) {
    if ((error as Error).message.includes("Timeout")) {
      throw ErrorFactory.claude(
        ERROR_CODES.CLAUDE_TIMEOUT,
        "CLAUDE_TIMEOUT: Claude session launch timed out",
        { suggestion: "Check system resources and try again" },
      );
    }

    throw ErrorFactory.claude(
      ERROR_CODES.CLAUDE_LAUNCH_FAILED,
      `CLAUDE_LAUNCH_FAILED: Failed to launch Claude session: ${(error as Error).message}`,
      { workspacePath: config.workspacePath, originalError: error },
    );
  }
}

/**
 * Find and connect to active Claude sessions.
 *
 * @param claudeInterface Claude interface instance (for dependency injection)
 * @param processOps Process operations instance (for dependency injection)
 * @param options Discovery options
 * @returns Session discovery result
 */
export async function findActiveClaudeSessions(
  claudeInterface: ClaudeInterface = defaultClaude,
  processOps: ProcessOperationsInterface = defaultProcessOps,
  options: SessionDiscoveryOptions = {},
): Promise<SessionDiscoveryResult> {
  try {
    const processes = await processOps.findProcesses("claude");
    const activeSessions: ClaudeSession[] = [];
    const errors: SessionDiscoveryError[] = [];

    for (const process of processes) {
      try {
        // This is a simplified implementation
        // In reality, we'd need to connect to each process and get session info
        if (options.workspacePath && !process.workingDirectory?.includes(options.workspacePath)) {
          continue;
        }

        // Mock session creation from process info
        const session: ClaudeSession = {
          id: `session-${process.pid}`,
          pid: process.pid,
          workspacePath: process.workingDirectory || "/unknown",
          status: "active",
          startTime: process.startTime,
          lastActivity: new Date(),
          config: { workspacePath: process.workingDirectory || "/unknown" },
          contextStatus: {
            claudeMdExists: true,
            claudeDirExists: true,
            contextFilesCount: 0,
            isComplete: true,
          },
        };

        // Filter stale sessions if requested
        if (!options.includeStale && session.status === "error") {
          continue;
        }

        activeSessions.push(session);
      } catch (error) {
        errors.push({
          pid: process.pid,
          error: (error as Error).message,
          recoverable: true,
        });
      }
    }

    return {
      activeSessions,
      totalFound: processes.length,
      errors: errors.length > 0 ? errors : [],
    };
  } catch (error) {
    throw ErrorFactory.claude(
      ERROR_CODES.CLAUDE_COMMAND_FAILED,
      `Failed to discover Claude sessions: ${(error as Error).message}`,
      { originalError: error },
    );
  }
}

/**
 * Get Claude session status.
 *
 * @param sessionId Session identifier
 * @param claudeInterface Claude interface instance (for dependency injection)
 * @returns Session status
 */
export async function getClaudeSessionStatus(
  sessionId: string,
  claudeInterface: ClaudeInterface = defaultClaude,
): Promise<ClaudeSession> {
  if (!sessionId || sessionId.trim().length === 0) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Session ID is required",
      { suggestion: "Provide valid session identifier" },
    );
  }

  try {
    return await claudeInterface.getStatus(sessionId);
  } catch (error) {
    if ((error as Error).message.includes("not found")) {
      throw ErrorFactory.claude(
        ERROR_CODES.CLAUDE_SESSION_NOT_FOUND,
        `CLAUDE_SESSION_NOT_FOUND: Claude session not found: ${sessionId}`,
        { sessionId, suggestion: "Check session ID or create new session" },
      );
    }

    throw ErrorFactory.claude(
      ERROR_CODES.CLAUDE_COMMAND_FAILED,
      `CLAUDE_COMMAND_FAILED: Failed to get session status: ${(error as Error).message}`,
      { sessionId, originalError: error },
    );
  }
}

/**
 * Terminate a Claude session.
 *
 * @param sessionId Session identifier
 * @param claudeInterface Claude interface instance (for dependency injection)
 * @returns True if session was terminated successfully
 */
export async function terminateClaudeSession(
  sessionId: string,
  claudeInterface: ClaudeInterface = defaultClaude,
): Promise<boolean> {
  if (!sessionId || sessionId.trim().length === 0) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Session ID is required",
      { suggestion: "Provide valid session identifier" },
    );
  }

  try {
    return await claudeInterface.terminate(sessionId);
  } catch (error) {
    throw ErrorFactory.claude(
      ERROR_CODES.CLAUDE_COMMAND_FAILED,
      `CLAUDE_COMMAND_FAILED: Failed to terminate session: ${(error as Error).message}`,
      { sessionId, originalError: error },
    );
  }
}

/**
 * Execute command in Claude session.
 *
 * @param sessionId Session identifier
 * @param command Command to execute
 * @param options Command options
 * @param claudeInterface Claude interface instance (for dependency injection)
 * @returns Command execution result
 */
export async function executeClaudeCommand(
  sessionId: string,
  command: string,
  options: ClaudeCommandOptions = {},
  claudeInterface: ClaudeInterface = defaultClaude,
): Promise<ClaudeCommandResult> {
  // Validation
  if (!sessionId || sessionId.trim().length === 0) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Session ID is required",
    );
  }

  if (!command || command.trim().length === 0) {
    throw ErrorFactory.core(ERROR_CODES.CORE_INVALID_PARAMETERS, "validation: Command is required");
  }

  try {
    return await claudeInterface.execute(sessionId, command, options);
  } catch (error) {
    throw ErrorFactory.claude(
      ERROR_CODES.CLAUDE_COMMAND_FAILED,
      `CLAUDE_COMMAND_FAILED: Command execution failed: ${(error as Error).message}`,
      { sessionId, command, originalError: error },
    );
  }
}

/**
 * Setup Claude workspace configuration.
 *
 * @param workspacePath Workspace directory path
 * @param options Setup options
 * @param fileSystem File system interface (injectable for testing)
 * @param pathOps Path operations interface (injectable for testing)
 * @returns Workspace setup result
 */
export async function setupClaudeWorkspace(
  workspacePath: string,
  options: WorkspaceSetupOptions = {},
  fileSystem: FileSystemInterface = defaultFileSystem,
  pathOps: PathInterface = defaultPath,
): Promise<WorkspaceSetupResult> {
  // Validation
  if (!workspacePath || workspacePath.trim().length === 0) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Workspace path is required",
    );
  }

  try {
    const setupFiles: string[] = [];
    const warnings: string[] = [];

    // Ensure workspace directory exists first
    try {
      await fileSystem.access(workspacePath);
    } catch {
      await fileSystem.mkdir(workspacePath, { recursive: true });
    }

    // Create .claude directory if it doesn't exist
    const claudeDirPath = pathOps.join(workspacePath, ".claude");
    try {
      await fileSystem.access(claudeDirPath);
    } catch {
      await fileSystem.mkdir(claudeDirPath, { recursive: true });
      setupFiles.push(".claude/");
    }

    // Create or validate CLAUDE.md
    const claudeMdPath = pathOps.join(workspacePath, "CLAUDE.md");
    try {
      await fileSystem.access(claudeMdPath);
    } catch {
      if (options.setupContext) {
        const defaultClaudeMd = `# CLAUDE.md

This file provides guidance to Claude Code when working with this project.

## Project Context

Add project-specific information here.

## Guidelines

- Follow existing code patterns
- Include comprehensive tests
- Use TypeScript strict mode
- Follow conventional commits
`;
        await fileSystem.writeFile(claudeMdPath, defaultClaudeMd, "utf-8");
        setupFiles.push("CLAUDE.md");
      }
    }

    // Setup context files if specified
    if (options.contextFiles && options.contextFiles.length > 0) {
      for (const file of options.contextFiles) {
        const sourcePath = pathOps.join(workspacePath, file);
        const contextPath = pathOps.join(claudeDirPath, pathOps.basename(file));

        try {
          await fileSystem.access(sourcePath);
          await fileSystem.copyFile(sourcePath, contextPath);
          setupFiles.push(`.claude/${pathOps.basename(file)}`);
        } catch (error) {
          warnings.push(`Could not copy context file: ${file}`);
        }
      }
    }

    // Sync from repository if requested
    if (options.syncFromRepository) {
      try {
        // Copy key files to context
        const keyFiles = ["package.json", "tsconfig.json", "README.md"];
        for (const file of keyFiles) {
          const sourcePath = pathOps.join(workspacePath, file);
          const contextPath = pathOps.join(claudeDirPath, file);

          try {
            await fileSystem.access(sourcePath);
            await fileSystem.copyFile(sourcePath, contextPath);
            setupFiles.push(`.claude/${file}`);
          } catch {
            // File doesn't exist, skip
          }
        }
      } catch (error) {
        warnings.push("Could not sync from repository");
      }
    }

    // Include .gitignore handling
    if (options.includeGitIgnore) {
      const gitignorePath = pathOps.join(workspacePath, ".gitignore");
      try {
        const gitignoreContent = await fileSystem.readFile(gitignorePath, "utf-8");
        if (!gitignoreContent.includes(".claude/")) {
          // Append to existing .gitignore
          const updatedContent = gitignoreContent + "\n# Claude Code context\n.claude/\n";
          await fileSystem.writeFile(gitignorePath, updatedContent, "utf-8");
          setupFiles.push(".gitignore (updated)");
        }
      } catch {
        warnings.push("Could not update .gitignore");
      }
    }

    // Check final context status
    const contextStatus = await checkClaudeContextStatus(workspacePath, fileSystem, pathOps);

    return {
      success: true,
      contextStatus,
      setupFiles,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    throw ErrorFactory.claude(
      ERROR_CODES.CLAUDE_COMMAND_FAILED,
      `Failed to setup Claude workspace: ${(error as Error).message}`,
      { workspacePath, originalError: error },
    );
  }
}

/**
 * Configure Claude settings.
 *
 * @param workspacePath Workspace directory path
 * @param config Claude settings configuration
 * @returns True if configuration was successful
 */
export async function configureClaudeSettings(
  workspacePath: string,
  config: ClaudeSettingsConfig,
  fileSystem: FileSystemInterface = defaultFileSystem,
  pathOps: PathInterface = defaultPath,
): Promise<boolean> {
  // Validation
  if (!workspacePath || workspacePath.trim().length === 0) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Workspace path is required",
    );
  }

  try {
    // Ensure workspace directory exists first
    try {
      await fileSystem.access(workspacePath);
    } catch {
      await fileSystem.mkdir(workspacePath, { recursive: true });
    }

    const claudeDirPath = pathOps.join(workspacePath, ".claude");

    // Ensure .claude directory exists
    try {
      await fileSystem.access(claudeDirPath);
    } catch {
      await fileSystem.mkdir(claudeDirPath, { recursive: true });
    }

    const configPath = pathOps.join(claudeDirPath, "config.json");

    // Load existing config or create new one
    let existingConfig: any = {};
    try {
      const configContent = await fileSystem.readFile(configPath, "utf-8");
      existingConfig = JSON.parse(configContent);
    } catch {
      // Config doesn't exist yet
    }

    // Merge configurations
    const mergedConfig = {
      ...existingConfig,
      ...config,
      modelPreferences: {
        ...existingConfig.modelPreferences,
        ...config.modelPreferences,
      },
      customPrompts: {
        ...existingConfig.customPrompts,
        ...config.customPrompts,
      },
      lastUpdated: new Date().toISOString(),
    };

    // Write updated configuration
    await fileSystem.writeFile(configPath, JSON.stringify(mergedConfig, null, 2), "utf-8");

    return true;
  } catch (error) {
    throw ErrorFactory.claude(
      ERROR_CODES.CLAUDE_COMMAND_FAILED,
      `Failed to configure Claude settings: ${(error as Error).message}`,
      { workspacePath, originalError: error },
    );
  }
}

/**
 * Handle Claude context synchronization.
 *
 * @param workspacePath Workspace directory path
 * @param options Context handling options
 * @returns Context handling result
 */
export async function handleClaudeContext(
  workspacePath: string,
  options: ContextHandleOptions = {},
  fileSystem: FileSystemInterface = defaultFileSystem,
  pathOps: PathInterface = defaultPath,
): Promise<ContextHandleResult> {
  // Validation
  if (!workspacePath || workspacePath.trim().length === 0) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Workspace path is required",
    );
  }

  try {
    const syncedFiles: string[] = [];
    const conflicts: string[] = [];

    // Ensure workspace directory exists first
    try {
      await fileSystem.access(workspacePath);
    } catch {
      await fileSystem.mkdir(workspacePath, { recursive: true });
    }

    const claudeDirPath = pathOps.join(workspacePath, ".claude");

    // Ensure .claude directory exists
    try {
      await fileSystem.access(claudeDirPath);
    } catch {
      await fileSystem.mkdir(claudeDirPath, { recursive: true });
      syncedFiles.push(".claude/ (created)");
    }

    // Sync from repository if requested
    if (options.syncFromRepository) {
      const filesToSync = [
        "package.json",
        "tsconfig.json",
        "README.md",
        ".gitignore",
        "biome.json",
        "vitest.config.ts",
      ];

      for (const file of filesToSync) {
        const sourcePath = pathOps.join(workspacePath, file);
        const contextPath = pathOps.join(claudeDirPath, file);

        try {
          await fileSystem.access(sourcePath);

          // Check if context file already exists
          let hasConflict = false;
          if (options.preserveUserChanges) {
            try {
              await fileSystem.access(contextPath);
              const sourceContent = await fileSystem.readFile(sourcePath, "utf-8");
              const contextContent = await fileSystem.readFile(contextPath, "utf-8");

              if (sourceContent !== contextContent) {
                conflicts.push(file);
                hasConflict = true;
              }
            } catch {
              // Context file doesn't exist, no conflict
            }
          }

          if (!hasConflict || !options.preserveUserChanges) {
            await fileSystem.copyFile(sourcePath, contextPath);
            syncedFiles.push(file);
          }
        } catch {
          // Source file doesn't exist, skip
        }
      }
    }

    // Update context files if requested
    if (options.updateContextFiles) {
      try {
        const files = await fileSystem.readdir(claudeDirPath);
        for (const file of files) {
          if (file.endsWith(".json") || file.endsWith(".md") || file.endsWith(".ts")) {
            const contextFilePath = pathOps.join(claudeDirPath, file);
            const stat = await fileSystem.stat(contextFilePath);

            // Update timestamp for tracking
            const now = new Date();
            // Note: utimes is not in FileSystemInterface, we'll skip this operation
            // This is a non-critical operation for timestamp updates
          }
        }
      } catch {
        // Could not update context files
      }
    }

    // Validate completeness if requested
    if (options.validateCompleteness) {
      const claudeMdPath = pathOps.join(workspacePath, "CLAUDE.md");
      try {
        await fileSystem.access(claudeMdPath);
      } catch {
        conflicts.push("CLAUDE.md (missing)");
      }
    }

    // Check final context status
    const contextStatus = await checkClaudeContextStatus(workspacePath, fileSystem, pathOps);

    return {
      success: true,
      syncedFiles,
      contextStatus,
      conflicts,
    };
  } catch (error) {
    throw ErrorFactory.claude(
      ERROR_CODES.CLAUDE_COMMAND_FAILED,
      `Failed to handle Claude context: ${(error as Error).message}`,
      { workspacePath, originalError: error },
    );
  }
}

/**
 * Analyze code with Claude AI.
 *
 * @param sessionId Session identifier
 * @param request Analysis request
 * @param claudeInterface Claude interface instance (for dependency injection)
 * @returns Analysis result
 */
export async function analyzeCodeWithClaude(
  sessionId: string,
  request: ClaudeAnalysisRequest,
  claudeInterface: ClaudeInterface = defaultClaude,
): Promise<ClaudeAnalysisResult> {
  // Validation
  if (!sessionId || sessionId.trim().length === 0) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Session ID is required",
    );
  }

  if (!request.code || request.code.trim().length === 0) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Code to analyze is required",
    );
  }

  try {
    return await claudeInterface.analyze(sessionId, request);
  } catch (error) {
    throw ErrorFactory.claude(
      ERROR_CODES.CLAUDE_COMMAND_FAILED,
      `CLAUDE_COMMAND_FAILED: Code analysis failed: ${(error as Error).message}`,
      { sessionId, analysisType: request.analysisType, originalError: error },
    );
  }
}

/**
 * Generate code with Claude AI.
 *
 * @param sessionId Session identifier
 * @param request Generation request
 * @param claudeInterface Claude interface instance (for dependency injection)
 * @returns Generation result
 */
export async function generateCodeWithClaude(
  sessionId: string,
  request: ClaudeGenerationRequest,
  claudeInterface: ClaudeInterface = defaultClaude,
): Promise<ClaudeGenerationResult> {
  // Validation
  if (!sessionId || sessionId.trim().length === 0) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Session ID is required",
    );
  }

  if (!request.prompt || request.prompt.trim().length === 0) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Generation prompt is required",
    );
  }

  try {
    return await claudeInterface.generate(sessionId, request);
  } catch (error) {
    throw ErrorFactory.claude(
      ERROR_CODES.CLAUDE_COMMAND_FAILED,
      `CLAUDE_COMMAND_FAILED: Code generation failed: ${(error as Error).message}`,
      { sessionId, generationType: request.generationType, originalError: error },
    );
  }
}

/**
 * Review code with Claude AI.
 *
 * @param sessionId Session identifier
 * @param request Review request (using analysis interface)
 * @param claudeInterface Claude interface instance (for dependency injection)
 * @returns Review result (using analysis result)
 */
export async function reviewCodeWithClaude(
  sessionId: string,
  request: ClaudeAnalysisRequest,
  claudeInterface: ClaudeInterface = defaultClaude,
): Promise<ClaudeAnalysisResult> {
  // Use analysis functionality for code review
  const reviewRequest = {
    ...request,
    analysisType: "comprehensive" as const,
  };

  return analyzeCodeWithClaude(sessionId, reviewRequest, claudeInterface);
}

/**
 * Optimize code with Claude AI.
 *
 * @param sessionId Session identifier
 * @param request Optimization request (using analysis interface)
 * @param claudeInterface Claude interface instance (for dependency injection)
 * @returns Optimization result (using analysis result)
 */
export async function optimizeCodeWithClaude(
  sessionId: string,
  request: ClaudeAnalysisRequest,
  claudeInterface: ClaudeInterface = defaultClaude,
): Promise<ClaudeAnalysisResult> {
  // Use analysis functionality for code optimization
  const optimizationRequest = {
    ...request,
    analysisType: "performance" as const,
  };

  return analyzeCodeWithClaude(sessionId, optimizationRequest, claudeInterface);
}

/**
 * Explain code with Claude AI.
 *
 * @param sessionId Session identifier
 * @param request Explanation request (using generation interface)
 * @param claudeInterface Claude interface instance (for dependency injection)
 * @returns Explanation result (using generation result)
 */
export async function explainCodeWithClaude(
  sessionId: string,
  request: ClaudeGenerationRequest,
  claudeInterface: ClaudeInterface = defaultClaude,
): Promise<ClaudeGenerationResult> {
  // Use generation functionality for code explanation
  const explanationRequest = {
    ...request,
    generationType: "documentation" as const,
    prompt: `Explain this code: ${request.context?.existingCode || request.prompt}`,
  };

  return generateCodeWithClaude(sessionId, explanationRequest, claudeInterface);
}

// Helper functions

/**
 * Check Claude context status for a workspace.
 */
async function checkClaudeContextStatus(
  workspacePath: string,
  fileSystem: FileSystemInterface = defaultFileSystem,
  pathOps: PathInterface = defaultPath,
): Promise<ClaudeContextStatus> {
  try {
    const claudeMdPath = pathOps.join(workspacePath, "CLAUDE.md");
    const claudeDirPath = pathOps.join(workspacePath, ".claude");

    const [claudeMdExists, claudeDirExists] = await Promise.all([
      fileSystem
        .access(claudeMdPath)
        .then(() => true)
        .catch(() => false),
      fileSystem
        .access(claudeDirPath)
        .then(() => true)
        .catch(() => false),
    ]);

    let contextFilesCount = 0;
    let lastSyncTime: Date | undefined;

    if (claudeDirExists) {
      try {
        const files = await fileSystem.readdir(claudeDirPath);
        contextFilesCount = files.filter((f) => !f.startsWith(".")).length;

        // Get the most recent modification time from context files
        if (files.length > 0) {
          const stats = await Promise.all(
            files.map((f) => fileSystem.stat(pathOps.join(claudeDirPath, f)).catch(() => null)),
          );
          const validStats = stats.filter(Boolean);
          if (validStats.length > 0) {
            lastSyncTime = new Date(Math.max(...validStats.map((s) => s!.mtime.getTime())));
          }
        }
      } catch {
        contextFilesCount = 0;
      }
    }

    return {
      claudeMdExists,
      claudeDirExists,
      contextFilesCount,
      lastSyncTime,
      isComplete: claudeMdExists && claudeDirExists && contextFilesCount > 0,
    };
  } catch {
    return {
      claudeMdExists: false,
      claudeDirExists: false,
      contextFilesCount: 0,
      isComplete: false,
    };
  }
}

/**
 * Check if Claude Code version is compatible.
 */
function checkVersionCompatibility(version: string): boolean {
  if (version === "unknown") return false;

  const [major, minor] = version.split(".").map(Number);
  return major >= 2 || (major === 1 && minor >= 9);
}
