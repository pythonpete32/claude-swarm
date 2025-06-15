/**
 * Core Tmux Integration Module for Claude Swarm
 *
 * Provides tmux session management for isolated AI agent environments.
 * Handles session creation, process launching, and cleanup for both
 * development and review workflows.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

import { getConfig } from "@/shared/config";
import { ERROR_CODES, ErrorFactory } from "@/shared/errors";
import { CommonValidators, TmuxValidation } from "@/shared/validation";

const execAsync = promisify(exec);

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
    const { stdout } = await execAsync("tmux -V");
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
  // Validate inputs
  const validation = CommonValidators.tmuxSession();
  if (!validation.validate(options.name)) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_INVALID_SESSION_NAME,
      `Invalid session name: ${options.name}`,
      { name: options.name },
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
    await execAsync(`tmux has-session -t "${options.name}"`);
    // If has-session succeeds, session exists
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_SESSION_EXISTS,
      `Session '${options.name}' already exists`,
      { name: options.name },
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
    await execAsync(`test -d "${options.workingDirectory}"`);
  } catch {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_INVALID_DIRECTORY,
      `Working directory does not exist: ${options.workingDirectory}`,
      { workingDirectory: options.workingDirectory },
    );
  }

  try {
    const _config = getConfig();
    const detached = options.detached !== false;

    // Build tmux command
    let command = "tmux new-session";
    if (detached) command += " -d";
    command += ` -s "${options.name}"`;
    command += ` -c "${options.workingDirectory}"`;

    // Add environment variables
    if (options.environment) {
      for (const [key, value] of Object.entries(options.environment)) {
        command = `${key}="${value}" ${command}`;
      }
    }

    // Add initial shell command if provided
    if (options.shellCommand) {
      command += ` "${options.shellCommand}"`;
    }

    await execAsync(command);

    // Get session info to return
    return await getSessionInfo(options.name);
  } catch (error) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_CREATION_FAILED,
      `Failed to create tmux session '${options.name}'`,
      {
        name: options.name,
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
  // Validate session exists and is active
  const session = await getSessionInfo(sessionName);
  if (!session.isActive) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_SESSION_INACTIVE,
      `Session '${sessionName}' exists but is not active`,
      { name: sessionName },
    );
  }

  try {
    let target = sessionName;

    // Create new window if requested
    if (options.newWindow) {
      const windowName = options.windowName || "new-window";
      await execAsync(`tmux new-window -t "${sessionName}" -n "${windowName}"`);
      target = `${sessionName}:${windowName}`;
    } else if (options.windowName) {
      target = `${sessionName}:${options.windowName}`;
    }

    // Build command string
    const args = options.args || [];
    const fullCommand = [options.command, ...args].join(" ");

    // Send command to session
    await execAsync(`tmux send-keys -t "${target}" "${fullCommand}" Enter`);
  } catch (error) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_COMMAND_FAILED,
      `Failed to launch process in session '${sessionName}'`,
      {
        sessionName,
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
  // Validate session exists
  const session = await getSessionInfo(sessionName);
  if (!session.isActive) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_SESSION_INACTIVE,
      `Session '${sessionName}' exists but is not active`,
      { name: sessionName },
    );
  }

  // Check for TTY (required for attachment)
  if (!process.stdout.isTTY) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_NO_TTY,
      "Cannot attach to tmux session: not running in a terminal",
      { sessionName },
    );
  }

  try {
    let command = `tmux attach-session -t "${sessionName}"`;

    if (options.readOnly) {
      command += " -r";
    }

    if (options.targetWindow) {
      command += ` -c "${options.targetWindow}"`;
    }

    // Note: This will take over the current terminal
    await execAsync(command);
  } catch (error) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_ATTACH_FAILED,
      `Failed to attach to session '${sessionName}'`,
      {
        sessionName,
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
  // Validate session exists
  try {
    await getSessionInfo(sessionName);
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
        await execAsync(`tmux send-keys -t "${sessionName}" "exit" Enter`);

        // Wait for graceful shutdown
        let attempts = 0;
        const maxAttempts = gracefulTimeout;

        while (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          try {
            await getSessionInfo(sessionName);
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
    await execAsync(`tmux kill-session -t "${sessionName}"`);
  } catch (error) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_KILL_FAILED,
      `Failed to kill session '${sessionName}'`,
      {
        sessionName,
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
  try {
    const { stdout } = await execAsync(
      "tmux list-sessions -F '#{session_name}:#{session_created}:#{session_windows}:#{session_id}'",
    );

    const sessions: TmuxSession[] = [];
    const lines = stdout
      .trim()
      .split("\n")
      .filter((line) => line.length > 0);

    for (const line of lines) {
      const [name, _created, _windowCount, _sessionId] = line.split(":");

      // Apply pattern filter if provided
      if (pattern && !matchesPattern(name, pattern)) {
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
  try {
    const { stdout } = await execAsync(
      `tmux display-message -t "${sessionName}" -p "#{session_name}:#{session_created}:#{session_windows}:#{session_path}:#{session_id}"`,
    );

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
      `Session '${sessionName}' not found`,
      {
        sessionName,
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
  // Validate session exists
  const session = await getSessionInfo(sessionName);
  if (!session.isActive) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_SESSION_INACTIVE,
      `Session '${sessionName}' exists but is not active`,
      { name: sessionName },
    );
  }

  // Check if Claude CLI is available
  try {
    await execAsync("which claude");
  } catch {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_CLAUDE_NOT_AVAILABLE,
      "Claude CLI is not available in PATH",
      { sessionName },
    );
  }

  try {
    // Build Claude command
    const claudeArgs = options.claudeArgs || [];
    const command = ["claude", ...claudeArgs];

    // Add working directory if specified
    if (options.workingDirectory) {
      command.push("--workspace", options.workingDirectory);
    }

    const _fullCommand = command.join(" ");

    // Launch Claude in the session
    await launchProcessInSession(sessionName, {
      command: "claude",
      args: claudeArgs,
      windowName: "claude",
      newWindow: true,
    });

    // Send initial prompt if provided
    if (options.prompt && options.autoStart !== false) {
      // Wait a moment for Claude to start
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Send the prompt
      await execAsync(`tmux send-keys -t "${sessionName}:claude" "${options.prompt}" Enter`);
    }
  } catch (error) {
    throw ErrorFactory.tmux(
      ERROR_CODES.TMUX_LAUNCH_FAILED,
      `Failed to launch Claude in session '${sessionName}'`,
      {
        sessionName,
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
};
