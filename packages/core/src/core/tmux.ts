/**
 * Core Tmux Integration Module for Claude Swarm
 *
 * Provides tmux session management for isolated AI agent environments.
 * Handles session creation, process launching, and cleanup for both
 * development and review workflows.
 */

import { execa } from "execa";

import { getConfig } from "../shared/config";
import { ERROR_CODES, ErrorFactory } from "../shared/errors";
import { CommonValidators, TmuxValidation } from "../shared/validation";

/**
 * Secure command execution utility for tmux operations.
 * Uses execa for safe command execution without shell injection vulnerabilities.
 */
async function execSecure(
  command: string,
  args: string[] = [],
  options?: { env?: Record<string, string> },
): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execa(command, args, {
      env: options?.env ? { ...process.env, ...options.env } : undefined,
      timeout: 30000, // 30 second timeout
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    if (error instanceof Error && "stdout" in error && "stderr" in error) {
      const execaError = error as Error & { stdout?: string; stderr?: string };
      return {
        stdout: execaError.stdout || "",
        stderr: execaError.stderr || error.message,
      };
    }
    throw error;
  }
}

/**
 * Sanitizes session names to prevent command injection.
 * Only allows alphanumeric characters, hyphens, and underscores.
 */
function sanitizeSessionName(name: string): string {
  if (!name || typeof name !== "string") {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_INVALID_SESSION_NAME,
      "Session name must be a non-empty string",
      { name },
    );
  }

  // Allow only safe characters: letters, numbers, hyphens, underscores
  const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, "_");

  if (sanitized !== name) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_INVALID_SESSION_NAME,
      `Session name contains invalid characters. Use only letters, numbers, hyphens, and underscores. Got: '${name}'`,
      { name, sanitized },
    );
  }

  if (sanitized.length === 0 || sanitized.length > 100) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_INVALID_SESSION_NAME,
      "Session name must be between 1 and 100 characters",
      { name, length: sanitized.length },
    );
  }

  return sanitized;
}

/**
 * Validates and sanitizes working directory paths.
 */
function sanitizeWorkingDirectory(path: string): string {
  if (!path || typeof path !== "string") {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_INVALID_DIRECTORY,
      "Working directory must be a non-empty string",
      { path },
    );
  }

  // Basic path validation - should be absolute path
  if (!path.startsWith("/")) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_INVALID_DIRECTORY,
      "Working directory must be an absolute path",
      { path },
    );
  }

  // Check for dangerous patterns
  const dangerousPatterns = ["..", ";", "|", "&", "$", "`", "$(", "${"];
  for (const pattern of dangerousPatterns) {
    if (path.includes(pattern)) {
      throw ErrorFactory.tmux(
        ERROR_CODES.TMUX_INVALID_DIRECTORY,
        `Working directory contains dangerous pattern: ${pattern}`,
        { path, pattern },
      );
    }
  }

  return path;
}

/**
 * Sanitizes environment variable keys and values.
 */
function sanitizeEnvironmentVariable(key: string, value: string): { key: string; value: string } {
  // Validate key
  if (!key || typeof key !== "string" || !/^[A-Z_][A-Z0-9_]*$/i.test(key)) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_INVALID_SESSION_NAME,
      `Invalid environment variable key: ${key}`,
      { key },
    );
  }

  // Validate value - no command substitution or other dangerous patterns
  if (!value || typeof value !== "string") {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_INVALID_SESSION_NAME,
      "Environment variable value must be a non-empty string",
      { key, value },
    );
  }

  const dangerousPatterns = ["$(", "${", "`", ";", "|", "&", "\n", "\r"];
  for (const pattern of dangerousPatterns) {
    if (value.includes(pattern)) {
      throw ErrorFactory.tmux(
        ERROR_CODES.TMUX_INVALID_SESSION_NAME,
        `Environment variable value contains dangerous pattern: ${pattern}`,
        { key, value, pattern },
      );
    }
  }

  return { key, value };
}

/**
 * Tmux session information.
 *
 * @group Core Modules
 */
export interface TmuxSession {
  /** Session name */
  name: string;
  /** Working directory */
  workingDirectory: string;
  /** tmux session process ID */
  pid: number;
  /** Creation timestamp */
  created: Date;
  /** Whether session is running */
  isActive: boolean;
  /** Number of windows in session */
  windowCount: number;
}

/**
 * Options for creating a tmux session.
 *
 * @group Core Modules
 */
export interface CreateTmuxSessionOptions {
  /** Session name (e.g., 'swarm-task-123') */
  name: string;
  /** Initial working directory */
  workingDirectory: string;
  /** Start detached (default: true) */
  detached?: boolean;
  /** Initial shell command to run */
  shellCommand?: string;
  /** Environment variables */
  environment?: Record<string, string>;
}

/**
 * Options for launching processes in tmux sessions.
 *
 * @group Core Modules
 */
export interface LaunchProcessOptions {
  /** Command to execute */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Optional window name */
  windowName?: string;
  /** Create new window (default: false) */
  newWindow?: boolean;
  /** Run detached (default: true) */
  detached?: boolean;
}

/**
 * Options for attaching to tmux sessions.
 *
 * @group Core Modules
 */
export interface AttachOptions {
  /** Attach in read-only mode */
  readOnly?: boolean;
  /** Specific window to attach to */
  targetWindow?: string;
}

/**
 * Options for killing tmux sessions.
 *
 * @group Core Modules
 */
export interface KillSessionOptions {
  /** Force kill even with active processes */
  force?: boolean;
  /** Seconds to wait before force kill (default: 10) */
  gracefulTimeout?: number;
}

/**
 * Options for launching Claude in tmux sessions.
 *
 * @group Core Modules
 */
export interface ClaudeLaunchOptions {
  /** Initial prompt to send to Claude */
  prompt?: string;
  /** Override working directory */
  workingDirectory?: string;
  /** Additional Claude CLI arguments */
  claudeArgs?: string[];
  /** Automatically start Claude (default: true) */
  autoStart?: boolean;
}

/**
 * Tmux validation result.
 *
 * @group Core Modules
 */
export interface TmuxValidationResult {
  /** Whether tmux is available and working */
  isValid: boolean;
  /** tmux version if available */
  version?: string;
  /** Any configuration problems */
  issues: string[];
}

/**
 * Validates that tmux is installed and available.
 *
 * @returns Promise<TmuxValidationResult> Validation result with version and issues
 * @throws Never throws - returns validation result with issues
 *
 * @example
 * ```typescript
 * const validation = await validateTmuxAvailable();
 * if (!validation.isValid) {
 *   console.error('tmux issues:', validation.issues);
 * }
 * ```
 */
export async function validateTmuxAvailable(): Promise<TmuxValidationResult> {
  try {
    const { stdout } = await execSecure("tmux", ["-V"]);
    const version = stdout.trim().replace("tmux ", "");

    return {
      isValid: true,
      version,
      issues: [],
    };
  } catch (_error) {
    return {
      isValid: false,
      issues: [
        "tmux is not installed or not in PATH",
        "Install tmux: brew install tmux (macOS) or apt-get install tmux (Ubuntu)",
      ],
    };
  }
}

/**
 * Creates a new tmux session with specified options.
 *
 * @param options Session creation options
 * @returns Promise<TmuxSession> Created session information
 * @throws TmuxError with specific error codes for various failure conditions
 *
 * @example
 * ```typescript
 * const session = await createTmuxSession({
 *   name: 'swarm-task-123',
 *   workingDirectory: '/path/to/worktree',
 *   detached: true
 * });
 * ```
 */
export async function createTmuxSession(options: CreateTmuxSessionOptions): Promise<TmuxSession> {
  // Sanitize and validate all inputs first (security-critical)
  const sessionName = sanitizeSessionName(options.name);
  const workingDirectory = sanitizeWorkingDirectory(options.workingDirectory);

  // Validate environment variables early
  if (options.environment) {
    for (const [key, value] of Object.entries(options.environment)) {
      sanitizeEnvironmentVariable(key, value);
    }
  }

  const validation = CommonValidators.tmuxSession();
  if (!validation.validate(sessionName)) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_INVALID_SESSION_NAME,
      `Invalid session name: ${sessionName}`,
      { name: sessionName },
    );
  }

  // Check if tmux is available
  const tmuxValidation = await validateTmuxAvailable();
  if (!tmuxValidation.isValid) {
    throw ErrorFactory.tmux(ERROR_CODES.TMUX_NOT_AVAILABLE, "tmux is not available", {
      issues: tmuxValidation.issues,
    });
  }

  // Check if session already exists by trying to list it directly
  try {
    await execSecure("tmux", ["has-session", "-t", sessionName]);
    // If has-session succeeds, session exists
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_SESSION_EXISTS,
      `Session '${sessionName}' already exists`,
      { name: sessionName },
    );
  } catch (error) {
    // If it's our own error, re-throw it
    if (error instanceof Error && error.message.includes("already exists")) {
      throw error;
    }
    // Otherwise, session doesn't exist - this is what we want (has-session failed)
  }

  // Validate working directory exists
  try {
    await execSecure("test", ["-d", workingDirectory]);
  } catch {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_INVALID_DIRECTORY,
      `Working directory does not exist: ${workingDirectory}`,
      { workingDirectory },
    );
  }

  try {
    const _config = getConfig();
    const detached = options.detached !== false;

    // Build tmux command arguments securely
    const args: string[] = ["new-session"];
    if (detached) args.push("-d");
    args.push("-s", sessionName);
    args.push("-c", workingDirectory);

    // Add initial shell command if provided
    if (options.shellCommand) {
      args.push(options.shellCommand);
    }

    // Sanitize environment variables
    let env: Record<string, string> | undefined;
    if (options.environment) {
      env = {};
      for (const [key, value] of Object.entries(options.environment)) {
        const sanitized = sanitizeEnvironmentVariable(key, value);
        env[sanitized.key] = sanitized.value;
      }
    }

    await execSecure("tmux", args, { env });

    // Get session info to return
    return await getSessionInfo(sessionName);
  } catch (error) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_CREATION_FAILED,
      `Failed to create tmux session '${sessionName}'`,
      {
        name: sessionName,
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

/**
 * Launches a process in an existing tmux session.
 *
 * @param sessionName Name of the target session
 * @param options Process launch options
 * @throws TmuxError if session doesn't exist or command fails
 *
 * @example
 * ```typescript
 * await launchProcessInSession('swarm-task-123', {
 *   command: 'npm',
 *   args: ['run', 'dev'],
 *   windowName: 'dev-server'
 * });
 * ```
 */
export async function launchProcessInSession(
  sessionName: string,
  options: LaunchProcessOptions,
): Promise<void> {
  // Sanitize session name
  const sanitizedSessionName = sanitizeSessionName(sessionName);

  // Validate command and arguments early (security-critical)
  if (!options.command || typeof options.command !== "string") {
    throw ErrorFactory.tmux(ERROR_CODES.TMUX_COMMAND_FAILED, "Command must be a non-empty string", {
      command: options.command,
    });
  }

  // Sanitize command and arguments
  const args = options.args || [];
  for (const arg of args) {
    if (typeof arg !== "string") {
      throw ErrorFactory.tmux(
        ERROR_CODES.TMUX_COMMAND_FAILED,
        "All command arguments must be strings",
        { arg, type: typeof arg },
      );
    }
    // Check for dangerous patterns in arguments
    const dangerousPatterns = [";", "|", "&", "$", "`", "$(", "${", "\n", "\r"];
    for (const pattern of dangerousPatterns) {
      if (arg.includes(pattern)) {
        throw ErrorFactory.tmux(
          ERROR_CODES.TMUX_COMMAND_FAILED,
          `Command argument contains dangerous pattern: ${pattern}`,
          { arg, pattern },
        );
      }
    }
  }

  // Validate session exists and is active
  const session = await getSessionInfo(sanitizedSessionName);
  if (!session.isActive) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_SESSION_INACTIVE,
      `Session '${sanitizedSessionName}' exists but is not active`,
      { name: sanitizedSessionName },
    );
  }

  try {
    let target = sanitizedSessionName;

    // Create new window if requested
    if (options.newWindow) {
      const windowName = sanitizeSessionName(options.windowName || "new-window");
      await execSecure("tmux", ["new-window", "-t", sanitizedSessionName, "-n", windowName]);
      target = `${sanitizedSessionName}:${windowName}`;
    } else if (options.windowName) {
      const sanitizedWindowName = sanitizeSessionName(options.windowName);
      target = `${sanitizedSessionName}:${sanitizedWindowName}`;
    }

    // Build full command safely - validation already done above
    const fullCommand = [options.command, ...args].join(" ");

    // Send command to session using secure execution
    await execSecure("tmux", ["send-keys", "-t", target, fullCommand, "Enter"]);
  } catch (error) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_COMMAND_FAILED,
      `Failed to launch process in session '${sanitizedSessionName}'`,
      {
        sessionName: sanitizedSessionName,
        command: options.command,
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

/**
 * Attaches to an existing tmux session.
 *
 * @param sessionName Name of the session to attach to
 * @param options Attachment options
 * @throws TmuxError if session doesn't exist or attachment fails
 *
 * @example
 * ```typescript
 * if (process.stdout.isTTY) {
 *   await attachToSession('swarm-task-123', { readOnly: true });
 * }
 * ```
 */
export async function attachToSession(
  sessionName: string,
  options: AttachOptions = {},
): Promise<void> {
  // Sanitize session name
  const sanitizedSessionName = sanitizeSessionName(sessionName);

  // Validate session exists
  const session = await getSessionInfo(sanitizedSessionName);
  if (!session.isActive) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_SESSION_INACTIVE,
      `Session '${sanitizedSessionName}' exists but is not active`,
      { name: sanitizedSessionName },
    );
  }

  // Check for TTY (required for attachment)
  if (!process.stdout.isTTY) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_NO_TTY,
      "Cannot attach to tmux session: not running in a terminal",
      { sessionName: sanitizedSessionName },
    );
  }

  try {
    // Build tmux command arguments securely
    const args: string[] = ["attach-session", "-t", sanitizedSessionName];

    if (options.readOnly) {
      args.push("-r");
    }

    if (options.targetWindow) {
      const sanitizedTargetWindow = sanitizeSessionName(options.targetWindow);
      args.push("-c", sanitizedTargetWindow);
    }

    // Note: This will take over the current terminal
    await execSecure("tmux", args);
  } catch (error) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_ATTACH_FAILED,
      `Failed to attach to session '${sanitizedSessionName}'`,
      {
        sessionName: sanitizedSessionName,
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

/**
 * Kills a tmux session.
 *
 * @param sessionName Name of the session to kill
 * @param options Kill options including graceful timeout
 * @throws TmuxError if session doesn't exist or kill fails
 *
 * @example
 * ```typescript
 * await killSession('swarm-task-123', {
 *   gracefulTimeout: 5,
 *   force: false
 * });
 * ```
 */
export async function killSession(
  sessionName: string,
  options: KillSessionOptions = {},
): Promise<void> {
  // Sanitize session name
  const sanitizedSessionName = sanitizeSessionName(sessionName);

  // Validate session exists
  try {
    await getSessionInfo(sanitizedSessionName);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      // Session doesn't exist - nothing to kill
      return;
    }
    throw error;
  }

  const config = getConfig();
  const gracefulTimeout = options.gracefulTimeout || config.tmux.killTimeout / 1000;

  try {
    if (!options.force) {
      // Try graceful shutdown first
      try {
        await execSecure("tmux", ["send-keys", "-t", sanitizedSessionName, "exit", "Enter"]);

        // Wait for graceful shutdown
        let attempts = 0;
        const maxAttempts = gracefulTimeout;

        while (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          try {
            await getSessionInfo(sanitizedSessionName);
            attempts++;
          } catch {
            // Session is gone - graceful shutdown succeeded
            return;
          }
        }
      } catch {
        // Graceful shutdown failed, continue to force kill
      }
    }

    // Force kill the session
    await execSecure("tmux", ["kill-session", "-t", sanitizedSessionName]);
  } catch (error) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_KILL_FAILED,
      `Failed to kill session '${sanitizedSessionName}'`,
      {
        sessionName: sanitizedSessionName,
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

/**
 * Lists all active tmux sessions, optionally filtered by pattern.
 *
 * @param pattern Optional pattern to filter sessions (e.g., 'swarm-*')
 * @returns Promise<TmuxSession[]> Array of session information
 *
 * @example
 * ```typescript
 * const swarmSessions = await listSessions('swarm-*');
 * const allSessions = await listSessions();
 * ```
 */
export async function listSessions(pattern?: string): Promise<TmuxSession[]> {
  // Sanitize pattern if provided
  let sanitizedPattern: string | undefined;
  if (pattern) {
    if (typeof pattern !== "string") {
      throw ErrorFactory.tmux(ERROR_CODES.TMUX_COMMAND_FAILED, "Pattern must be a string", {
        pattern,
        type: typeof pattern,
      });
    }
    // Basic validation - no dangerous characters in pattern
    const dangerousPatterns = [";", "|", "&", "$", "`", "$(", "${", "\n", "\r"];
    for (const dangerous of dangerousPatterns) {
      if (pattern.includes(dangerous)) {
        throw ErrorFactory.tmux(
          ERROR_CODES.TMUX_COMMAND_FAILED,
          `Pattern contains dangerous character: ${dangerous}`,
          { pattern, dangerous },
        );
      }
    }
    sanitizedPattern = pattern;
  }

  try {
    const { stdout } = await execSecure("tmux", [
      "list-sessions",
      "-F",
      "#{session_name}:#{session_created}:#{session_windows}:#{session_id}",
    ]);

    const sessions: TmuxSession[] = [];
    const lines = stdout
      .trim()
      .split("\n")
      .filter((line) => line.length > 0);

    for (const line of lines) {
      const [name, _created, _windowCount, _sessionId] = line.split(":");

      // Apply pattern filter if provided
      if (sanitizedPattern && !matchesPattern(name, sanitizedPattern)) {
        continue;
      }

      // Get additional session info
      try {
        const sessionInfo = await getSessionInfo(name);
        sessions.push(sessionInfo);
      } catch {}
    }

    return sessions;
  } catch (error) {
    if (error instanceof Error && error.message.includes("no server running")) {
      // No tmux server running - return empty array
      return [];
    }
    throw ErrorFactory.tmux(ERROR_CODES.TMUX_COMMAND_FAILED, "Failed to list tmux sessions", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Gets detailed information about a specific tmux session.
 *
 * @param sessionName Name of the session to inspect
 * @returns Promise<TmuxSession> Session information
 * @throws TmuxError if session doesn't exist
 *
 * @example
 * ```typescript
 * const sessionInfo = await getSessionInfo('swarm-task-123');
 * console.log(`Active: ${sessionInfo.isActive}, Windows: ${sessionInfo.windowCount}`);
 * ```
 */
export async function getSessionInfo(sessionName: string): Promise<TmuxSession> {
  // Sanitize session name
  const sanitizedSessionName = sanitizeSessionName(sessionName);

  try {
    const { stdout } = await execSecure("tmux", [
      "display-message",
      "-t",
      sanitizedSessionName,
      "-p",
      "#{session_name}:#{session_created}:#{session_windows}:#{session_path}:#{session_id}",
    ]);

    const [name, createdTimestamp, windowCount, path, sessionId] = stdout.trim().split(":");

    // Extract PID from session ID (format: $PID)
    const pid = Number.parseInt(sessionId.replace("$", ""), 10);

    return {
      name,
      workingDirectory: path,
      pid,
      created: new Date(Number.parseInt(createdTimestamp, 10) * 1000),
      isActive: true, // If we can get info, it's active
      windowCount: Number.parseInt(windowCount, 10),
    };
  } catch (error) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_SESSION_NOT_FOUND,
      `Session '${sanitizedSessionName}' not found`,
      {
        sessionName: sanitizedSessionName,
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

/**
 * Launches Claude Code in an existing tmux session.
 *
 * @param sessionName Name of the target session
 * @param options Claude launch options
 * @throws TmuxError if session doesn't exist or Claude launch fails
 *
 * @example
 * ```typescript
 * await launchClaudeInSession('swarm-task-123', {
 *   prompt: 'Implement GitHub issue #123...',
 *   claudeArgs: ['--dangerously-skip-permissions']
 * });
 * ```
 */
export async function launchClaudeInSession(
  sessionName: string,
  options: ClaudeLaunchOptions,
): Promise<void> {
  // Sanitize session name
  const sanitizedSessionName = sanitizeSessionName(sessionName);

  // Validate session exists
  const session = await getSessionInfo(sanitizedSessionName);
  if (!session.isActive) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_SESSION_INACTIVE,
      `Session '${sanitizedSessionName}' exists but is not active`,
      { name: sanitizedSessionName },
    );
  }

  // Check if Claude CLI is available
  try {
    await execSecure("which", ["claude"]);
  } catch {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_CLAUDE_NOT_AVAILABLE,
      "Claude CLI is not available in PATH",
      { sessionName: sanitizedSessionName },
    );
  }

  try {
    // Sanitize Claude arguments
    const claudeArgs = options.claudeArgs || [];
    const sanitizedArgs = claudeArgs.map((arg) => {
      if (typeof arg !== "string") {
        throw ErrorFactory.tmux(
          ERROR_CODES.TMUX_COMMAND_FAILED,
          "All Claude arguments must be strings",
          { arg, type: typeof arg },
        );
      }
      // Check for dangerous patterns in arguments
      const dangerousPatterns = [";", "|", "&", "$", "`", "$(", "${", "\n", "\r"];
      for (const pattern of dangerousPatterns) {
        if (arg.includes(pattern)) {
          throw ErrorFactory.tmux(
            ERROR_CODES.TMUX_COMMAND_FAILED,
            `Claude argument contains dangerous pattern: ${pattern}`,
            { arg, pattern },
          );
        }
      }
      return arg;
    });

    // Add working directory if specified
    if (options.workingDirectory) {
      const sanitizedWorkingDir = sanitizeWorkingDirectory(options.workingDirectory);
      sanitizedArgs.push("--workspace", sanitizedWorkingDir);
    }

    // Launch Claude in the session
    await launchProcessInSession(sanitizedSessionName, {
      command: "claude",
      args: sanitizedArgs,
      windowName: "claude",
      newWindow: true,
    });

    // Send initial prompt if provided
    if (options.prompt && options.autoStart !== false) {
      // Validate and sanitize prompt
      if (typeof options.prompt !== "string") {
        throw ErrorFactory.tmux(ERROR_CODES.TMUX_COMMAND_FAILED, "Prompt must be a string", {
          prompt: options.prompt,
          type: typeof options.prompt,
        });
      }

      // Check for dangerous patterns in prompt
      const dangerousPatterns = [";", "|", "&", "$", "`", "$(", "${"];
      for (const pattern of dangerousPatterns) {
        if (options.prompt.includes(pattern)) {
          throw ErrorFactory.tmux(
            ERROR_CODES.TMUX_COMMAND_FAILED,
            `Prompt contains dangerous pattern: ${pattern}`,
            { prompt: options.prompt, pattern },
          );
        }
      }

      // Wait a moment for Claude to start
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Send the prompt using secure execution
      await execSecure("tmux", [
        "send-keys",
        "-t",
        `${sanitizedSessionName}:claude`,
        options.prompt,
        "Enter",
      ]);
    }
  } catch (error) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_LAUNCH_FAILED,
      `Failed to launch Claude in session '${sanitizedSessionName}'`,
      {
        sessionName: sanitizedSessionName,
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

/**
 * Sends keys/text to a tmux session
 *
 * @param sessionName Name of the target session
 * @param text Text to send to the session
 * @param pressEnter Whether to press Enter after sending text (default: true)
 * @throws TmuxError if session doesn't exist or send fails
 */
export async function sendKeys(
  sessionName: string,
  text: string,
  pressEnter = true,
): Promise<void> {
  const sanitizedSessionName = sanitizeSessionName(sessionName);

  // Validate session exists
  const session = await getSessionInfo(sanitizedSessionName);
  if (!session.isActive) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_SESSION_INACTIVE,
      `Session '${sanitizedSessionName}' exists but is not active`,
      { name: sanitizedSessionName },
    );
  }

  try {
    // Split text into lines and send each line separately to handle multiline text
    const lines = text.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Send the line
      await execSecure("tmux", ["send-keys", "-t", sanitizedSessionName, line]);

      // Press Enter after each line except the last one (unless pressEnter is true)
      if (i < lines.length - 1 || pressEnter) {
        await execSecure("tmux", ["send-keys", "-t", sanitizedSessionName, "Enter"]);
      }
    }
  } catch (error) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_COMMAND_FAILED,
      `Failed to send keys to session '${sanitizedSessionName}'`,
      {
        sessionName: sanitizedSessionName,
        text,
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

/**
 * Helper function to match session names against patterns.
 * Supports basic glob-style patterns with * wildcards.
 */
function matchesPattern(name: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern.replace(/\*/g, ".*").replace(/\?/g, ".");

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(name);
}

/**
 * Default tmux operations implementation for dependency injection.
 */
export const defaultTmuxOperations = {
  createTmuxSession,
  launchProcessInSession,
  attachToSession,
  killSession,
  listSessions,
  getSessionInfo,
  validateTmuxAvailable,
  launchClaudeInSession,
  sendKeys,
};
