/**
 * Unit tests for core tmux module
 *
 * Tests all tmux session management operations with mocked process execution
 * to ensure isolation and deterministic results.
 * Uses Test-Driven Development (TDD) methodology.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Import types and functions to test
import type {
  ClaudeLaunchOptions,
  CreateTmuxSessionOptions,
  LaunchProcessOptions,
} from "../../../src/core/tmux";

import {
  attachToSession,
  createTmuxSession,
  getSessionInfo,
  killSession,
  launchClaudeInSession,
  launchProcessInSession,
  listSessions,
  validateTmuxAvailable,
} from "../../../src/core/tmux";

// Create a mock for the execa function using vi.hoisted to ensure proper hoisting
const mockExeca = vi.hoisted(() => vi.fn());

// Mock execa
vi.mock("execa", () => ({
  execa: mockExeca,
}));

// Mock process.stdout.isTTY
Object.defineProperty(process.stdout, "isTTY", {
  value: true,
  writable: true,
});

describe("core-tmux", () => {
  const testSessionName = "test-session";
  const testWorkingDir = "/test/working/dir";

  beforeEach(() => {
    vi.clearAllMocks();
    mockExeca.mockClear();
    // Reset process.stdout.isTTY to true by default
    (process.stdout as { isTTY: boolean }).isTTY = true;
  });

  describe("validateTmuxAvailable (TDD Phase 1)", () => {
    it("should validate successful tmux installation", async () => {
      // Arrange
      mockExeca.mockResolvedValueOnce({
        stdout: "tmux 3.3a\n",
        stderr: "",
      });

      // Act
      const result = await validateTmuxAvailable();

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.version).toBe("3.3a");
      expect(result.issues).toHaveLength(0);
      expect(mockExeca).toHaveBeenCalledWith("tmux", ["-V"], { env: undefined, timeout: 30000 });
    });

    it("should handle tmux not installed", async () => {
      // Arrange
      mockExeca.mockRejectedValueOnce(new Error("command not found"));

      // Act
      const result = await validateTmuxAvailable();

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.version).toBeUndefined();
      expect(result.issues).toContain("tmux is not installed or not in PATH");
      expect(result.issues).toContain(
        "Install tmux: brew install tmux (macOS) or apt-get install tmux (Ubuntu)",
      );
    });

    it("should extract version correctly from different tmux versions", async () => {
      // Test tmux 2.x format
      mockExeca.mockResolvedValueOnce({
        stdout: "tmux 2.8\n",
        stderr: "",
      });

      const result = await validateTmuxAvailable();

      expect(result.isValid).toBe(true);
      expect(result.version).toBe("2.8");
    });
  });

  describe("createTmuxSession (TDD Phase 2)", () => {
    const defaultOptions: CreateTmuxSessionOptions = {
      name: testSessionName,
      workingDirectory: testWorkingDir,
    };

    // Note: Each test will set up its own specific mocks

    it("should create tmux session with default options", async () => {
      // Arrange
      // Mock tmux version check
      mockExeca.mockResolvedValueOnce({
        stdout: "tmux 3.3a\n",
        stderr: "",
      });

      // Mock session existence check with has-session (should fail - session doesn't exist)
      mockExeca.mockRejectedValueOnce(new Error("session not found"));

      // Mock directory existence check
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
      });

      // Mock session creation
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
      });

      // Mock getSessionInfo for return value
      mockExeca.mockResolvedValueOnce({
        stdout: `${testSessionName}:1640000000:1:/test/working/dir:$1234\n`,
        stderr: "",
      });

      // Act
      const result = await createTmuxSession(defaultOptions);

      // Assert
      expect(result.name).toBe(testSessionName);
      expect(result.workingDirectory).toBe(testWorkingDir);
      expect(result.isActive).toBe(true);
      expect(result.windowCount).toBe(1);

      // Verify tmux commands called in correct order
      expect(mockExeca).toHaveBeenCalledWith("tmux", ["-V"], { env: undefined, timeout: 30000 });
      expect(mockExeca).toHaveBeenCalledWith("tmux", ["has-session", "-t", testSessionName], {
        env: undefined,
        timeout: 30000,
      });
      expect(mockExeca).toHaveBeenCalledWith("test", ["-d", testWorkingDir], {
        env: undefined,
        timeout: 30000,
      });
      expect(mockExeca).toHaveBeenCalledWith(
        "tmux",
        ["new-session", "-d", "-s", testSessionName, "-c", testWorkingDir],
        { env: undefined, timeout: 30000 },
      );
    });

    it("should create tmux session with custom options", async () => {
      // Arrange
      const customOptions: CreateTmuxSessionOptions = {
        name: testSessionName,
        workingDirectory: testWorkingDir,
        detached: false,
        shellCommand: "bash",
        environment: { NODE_ENV: "test", DEBUG: "true" },
      };

      // Mock tmux version check
      mockExeca.mockResolvedValueOnce({
        stdout: "tmux 3.3a\n",
        stderr: "",
      });

      // Mock session existence check with has-session (should fail - session doesn't exist)
      mockExeca.mockRejectedValueOnce(new Error("session not found"));

      // Mock directory existence check
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
      });

      // Mock session creation
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
      });

      // Mock getSessionInfo for return value
      mockExeca.mockResolvedValueOnce({
        stdout: `${testSessionName}:1640000000:1:/test/working/dir:$1234\n`,
        stderr: "",
      });

      // Act
      await createTmuxSession(customOptions);

      // Assert
      // Check that the tmux new-session call was made with the correct arguments and environment
      expect(mockExeca).toHaveBeenNthCalledWith(
        4,
        "tmux",
        ["new-session", "-s", testSessionName, "-c", testWorkingDir, "bash"],
        {
          env: expect.objectContaining({ DEBUG: "true", NODE_ENV: "test" }),
          timeout: 30000,
        },
      );
    });

    it("should handle tmux not available", async () => {
      // Arrange - mock tmux not available
      mockExeca.mockReset();
      mockExeca.mockRejectedValueOnce(new Error("command not found"));

      // Act & Assert
      await expect(createTmuxSession(defaultOptions)).rejects.toThrow("tmux is not available");
    });

    it("should handle session already exists", async () => {
      // Arrange - mock session already exists
      mockExeca.mockReset();
      // Mock tmux available
      mockExeca.mockResolvedValueOnce({ stdout: "tmux 3.3a\n", stderr: "" });
      // Mock session exists (has-session succeeds - this should trigger the error)
      mockExeca.mockResolvedValueOnce({ stdout: "", stderr: "" });

      // Act & Assert
      await expect(createTmuxSession(defaultOptions)).rejects.toThrow("already exists");
    });

    it("should handle invalid working directory", async () => {
      // Arrange
      mockExeca.mockReset();
      // Mock tmux available
      mockExeca.mockResolvedValueOnce({ stdout: "tmux 3.3a\n", stderr: "" });
      // Mock session doesn't exist (has-session fails)
      mockExeca.mockRejectedValueOnce(new Error("session not found"));
      // Mock directory doesn't exist
      mockExeca.mockRejectedValueOnce(new Error("No such file or directory"));

      // Act & Assert
      await expect(createTmuxSession(defaultOptions)).rejects.toThrow("does not exist");
    });

    it("should handle session creation failure", async () => {
      // Arrange
      mockExeca.mockReset();
      // Mock successful validations
      mockExeca.mockResolvedValueOnce({ stdout: "tmux 3.3a\n", stderr: "" });
      // Mock session doesn't exist (has-session fails)
      mockExeca.mockRejectedValueOnce(new Error("session not found"));
      // Mock directory exists
      mockExeca.mockResolvedValueOnce({ stdout: "", stderr: "" });
      // Mock session creation failure
      mockExeca.mockRejectedValueOnce(new Error("tmux: failed to create session"));

      // Act & Assert
      await expect(createTmuxSession(defaultOptions)).rejects.toThrow(
        "Failed to create tmux session",
      );
    });
  });

  describe("launchProcessInSession (TDD Phase 2)", () => {
    const launchOptions: LaunchProcessOptions = {
      command: "npm",
      args: ["run", "dev"],
    };

    // Note: Each test will set up its own specific mocks

    it("should launch process in existing session", async () => {
      // Arrange
      // Mock getSessionInfo - session exists and is active
      mockExeca.mockResolvedValueOnce({
        stdout: `${testSessionName}:1640000000:1:/test/working/dir:$1234\n`,
        stderr: "",
      });

      // Mock send-keys command
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
      });

      // Act
      await launchProcessInSession(testSessionName, launchOptions);

      // Assert
      expect(mockExeca).toHaveBeenCalledWith(
        "tmux",
        ["send-keys", "-t", testSessionName, "npm run dev", "Enter"],
        { env: undefined, timeout: 30000 },
      );
    });

    it("should launch process in new window", async () => {
      // Arrange
      const optionsWithNewWindow: LaunchProcessOptions = {
        ...launchOptions,
        newWindow: true,
        windowName: "dev-server",
      };

      // Mock getSessionInfo - session exists and is active
      mockExeca.mockResolvedValueOnce({
        stdout: `${testSessionName}:1640000000:1:/test/working/dir:$1234\n`,
        stderr: "",
      });

      // Mock new window creation
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
      });

      // Mock send-keys command
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
      });

      // Act
      await launchProcessInSession(testSessionName, optionsWithNewWindow);

      // Assert
      expect(mockExeca).toHaveBeenCalledWith(
        "tmux",
        ["new-window", "-t", testSessionName, "-n", "dev-server"],
        { env: undefined, timeout: 30000 },
      );
      expect(mockExeca).toHaveBeenCalledWith(
        "tmux",
        ["send-keys", "-t", `${testSessionName}:dev-server`, "npm run dev", "Enter"],
        { env: undefined, timeout: 30000 },
      );
    });

    it("should handle session not found", async () => {
      // Arrange
      mockExeca.mockReset();
      mockExeca.mockRejectedValueOnce(new Error("session not found"));

      // Act & Assert
      await expect(launchProcessInSession(testSessionName, launchOptions)).rejects.toThrow(
        "not found",
      );
    });

    it("should handle inactive session", async () => {
      // Arrange - create inactive session info
      mockExeca.mockReset();
      mockExeca.mockResolvedValueOnce({
        stdout: `${testSessionName}:1640000000:1:/test/working/dir:$1234\n`,
        stderr: "",
      });

      // Mock the session as inactive by simulating an error in send-keys
      mockExeca.mockRejectedValueOnce(new Error("session not active"));

      // Act & Assert
      await expect(launchProcessInSession(testSessionName, launchOptions)).rejects.toThrow(
        "Failed to launch process",
      );
    });
  });

  describe("attachToSession (TDD Phase 2)", () => {
    beforeEach(() => {
      // Mock getSessionInfo - session exists and is active
      mockExeca.mockResolvedValueOnce({
        stdout: `${testSessionName}:1640000000:1:/test/working/dir:$1234\n`,
        stderr: "",
      });

      // Mock attach command
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
      });
    });

    it("should attach to session with default options", async () => {
      // Act
      await attachToSession(testSessionName);

      // Assert
      expect(mockExeca).toHaveBeenCalledWith("tmux", ["attach-session", "-t", testSessionName], {
        env: undefined,
        timeout: 30000,
      });
    });

    it("should attach to session in read-only mode", async () => {
      // Act
      await attachToSession(testSessionName, { readOnly: true });

      // Assert
      expect(mockExeca).toHaveBeenCalledWith(
        "tmux",
        ["attach-session", "-t", testSessionName, "-r"],
        { env: undefined, timeout: 30000 },
      );
    });

    it("should attach to specific window", async () => {
      // Act
      await attachToSession(testSessionName, { targetWindow: "dev" });

      // Assert
      expect(mockExeca).toHaveBeenCalledWith(
        "tmux",
        ["attach-session", "-t", testSessionName, "-c", "dev"],
        { env: undefined, timeout: 30000 },
      );
    });

    it("should handle no TTY environment", async () => {
      // Arrange
      (process.stdout as { isTTY: boolean }).isTTY = false;

      // Act & Assert
      await expect(attachToSession(testSessionName)).rejects.toThrow("not running in a terminal");
    });

    it("should handle attach failure", async () => {
      // Arrange
      mockExeca.mockReset();
      // Mock session exists
      mockExeca.mockResolvedValueOnce({
        stdout: `${testSessionName}:1640000000:1:/test/working/dir:$1234\n`,
        stderr: "",
      });
      // Mock attach failure
      mockExeca.mockRejectedValueOnce(new Error("attach failed"));

      // Act & Assert
      await expect(attachToSession(testSessionName)).rejects.toThrow("Failed to attach");
    });
  });

  describe("killSession (TDD Phase 2)", () => {
    beforeEach(() => {
      // Mock getSessionInfo - session exists
      mockExeca.mockResolvedValueOnce({
        stdout: `${testSessionName}:1640000000:1:/test/working/dir:$1234\n`,
        stderr: "",
      });
    });

    it("should kill session with force option", async () => {
      // Arrange
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
      });

      // Act
      await killSession(testSessionName, { force: true });

      // Assert
      expect(mockExeca).toHaveBeenCalledWith("tmux", ["kill-session", "-t", testSessionName], {
        env: undefined,
        timeout: 30000,
      });
    });

    it("should attempt graceful shutdown first", async () => {
      // Arrange
      // Mock graceful exit command
      mockExeca.mockResolvedValueOnce({ stdout: "", stderr: "" });
      // Mock session check fails (session is gone)
      mockExeca.mockRejectedValueOnce(new Error("session not found"));

      // Act
      await killSession(testSessionName);

      // Assert
      expect(mockExeca).toHaveBeenCalledWith(
        "tmux",
        ["send-keys", "-t", testSessionName, "exit", "Enter"],
        { env: undefined, timeout: 30000 },
      );
    });

    it("should force kill after graceful timeout", async () => {
      // Arrange
      const gracefulTimeout = 1; // 1 second for faster test

      // Mock graceful exit command
      mockExeca.mockResolvedValueOnce({ stdout: "", stderr: "" });

      // Mock session still exists during grace period
      mockExeca.mockResolvedValueOnce({
        stdout: `${testSessionName}:1640000000:1:/test/working/dir:$1234\n`,
        stderr: "",
      });

      // Mock force kill
      mockExeca.mockResolvedValueOnce({ stdout: "", stderr: "" });

      // Act
      await killSession(testSessionName, { gracefulTimeout });

      // Assert
      expect(mockExeca).toHaveBeenCalledWith("tmux", ["kill-session", "-t", testSessionName], {
        env: undefined,
        timeout: 30000,
      });
    });

    it("should handle session not found (no-op)", async () => {
      // Arrange
      mockExeca.mockReset();
      mockExeca.mockRejectedValueOnce(new Error("Session 'test-session' not found"));

      // Act
      await killSession(testSessionName);

      // Assert - should not throw and not call kill command
      expect(mockExeca).toHaveBeenCalledTimes(1); // Only the getSessionInfo call
    });
  });

  describe("listSessions (TDD Phase 3)", () => {
    it("should list all sessions", async () => {
      // Arrange
      mockExeca.mockResolvedValueOnce({
        stdout: "session1:1640000000:2:$1234\nsession2:1640000001:1:$1235\n",
        stderr: "",
      });

      // Mock getSessionInfo for each session
      mockExeca
        .mockResolvedValueOnce({
          stdout: "session1:1640000000:2:/path1:$1234\n",
          stderr: "",
        })
        .mockResolvedValueOnce({
          stdout: "session2:1640000001:1:/path2:$1235\n",
          stderr: "",
        });

      // Act
      const sessions = await listSessions();

      // Assert
      expect(sessions).toHaveLength(2);
      expect(sessions[0].name).toBe("session1");
      expect(sessions[1].name).toBe("session2");
    });

    it("should filter sessions by pattern", async () => {
      // Arrange
      mockExeca.mockResolvedValueOnce({
        stdout:
          "swarm-task-1:1640000000:1:$1234\nother-session:1640000001:1:$1235\nswarm-task-2:1640000002:1:$1236\n",
        stderr: "",
      });

      // Mock getSessionInfo for swarm sessions only
      mockExeca
        .mockResolvedValueOnce({
          stdout: "swarm-task-1:1640000000:1:/path1:$1234\n",
          stderr: "",
        })
        .mockResolvedValueOnce({
          stdout: "swarm-task-2:1640000002:1:/path2:$1236\n",
          stderr: "",
        });

      // Act
      const sessions = await listSessions("swarm-*");

      // Assert
      expect(sessions).toHaveLength(2);
      expect(sessions[0].name).toBe("swarm-task-1");
      expect(sessions[1].name).toBe("swarm-task-2");
    });

    it("should handle no tmux server running", async () => {
      // Arrange
      mockExeca.mockRejectedValueOnce(new Error("no server running"));

      // Act
      const sessions = await listSessions();

      // Assert
      expect(sessions).toHaveLength(0);
    });

    it("should handle list command failure", async () => {
      // Arrange
      mockExeca.mockRejectedValueOnce(new Error("command failed"));

      // Act & Assert
      await expect(listSessions()).rejects.toThrow("Failed to list tmux sessions");
    });
  });

  describe("getSessionInfo (TDD Phase 3)", () => {
    it("should get session information", async () => {
      // Arrange
      mockExeca.mockResolvedValueOnce({
        stdout: `${testSessionName}:1640000000:3:/test/path:$1234\n`,
        stderr: "",
      });

      // Act
      const sessionInfo = await getSessionInfo(testSessionName);

      // Assert
      expect(sessionInfo.name).toBe(testSessionName);
      expect(sessionInfo.workingDirectory).toBe("/test/path");
      expect(sessionInfo.pid).toBe(1234);
      expect(sessionInfo.windowCount).toBe(3);
      expect(sessionInfo.isActive).toBe(true);
      expect(sessionInfo.created).toBeInstanceOf(Date);
    });

    it("should handle session not found", async () => {
      // Arrange
      mockExeca.mockRejectedValueOnce(new Error("session not found"));

      // Act & Assert
      await expect(getSessionInfo("nonexistent")).rejects.toThrow("not found");
    });
  });

  describe("launchClaudeInSession (TDD Phase 4)", () => {
    const claudeOptions: ClaudeLaunchOptions = {
      prompt: "Help me with this task",
      claudeArgs: ["--dangerously-skip-permissions"],
    };

    it("should launch Claude with prompt", async () => {
      // Arrange
      // Mock getSessionInfo - session exists and is active (called by launchClaudeInSession)
      mockExeca.mockResolvedValueOnce({
        stdout: `${testSessionName}:1640000000:1:/test/working/dir:$1234\n`,
        stderr: "",
      });

      // Mock which claude command
      mockExeca.mockResolvedValueOnce({
        stdout: "/usr/local/bin/claude\n",
        stderr: "",
      });

      // Mock getSessionInfo again (called by launchProcessInSession)
      mockExeca.mockResolvedValueOnce({
        stdout: `${testSessionName}:1640000000:1:/test/working/dir:$1234\n`,
        stderr: "",
      });

      // Mock new window creation
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
      });

      // Mock send claude command
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
      });

      // Mock send prompt (after 2 second delay)
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
      });

      // Act
      await launchClaudeInSession(testSessionName, claudeOptions);

      // Assert
      expect(mockExeca).toHaveBeenCalledWith("which", ["claude"], {
        env: undefined,
        timeout: 30000,
      });
      expect(mockExeca).toHaveBeenCalledWith(
        "tmux",
        ["new-window", "-t", testSessionName, "-n", "claude"],
        { env: undefined, timeout: 30000 },
      );
      expect(mockExeca).toHaveBeenCalledWith(
        "tmux",
        [
          "send-keys",
          "-t",
          `${testSessionName}:claude`,
          "claude --dangerously-skip-permissions",
          "Enter",
        ],
        { env: undefined, timeout: 30000 },
      );
    });

    it("should handle Claude not available", async () => {
      // Arrange
      mockExeca.mockReset();
      // Mock session exists
      mockExeca.mockResolvedValueOnce({
        stdout: `${testSessionName}:1640000000:1:/test/working/dir:$1234\n`,
        stderr: "",
      });
      // Mock which claude fails
      mockExeca.mockRejectedValueOnce(new Error("command not found"));

      // Act & Assert
      await expect(launchClaudeInSession(testSessionName, claudeOptions)).rejects.toThrow(
        "Claude CLI is not available",
      );
    });

    it("should launch Claude without auto-starting prompt", async () => {
      // Arrange
      // Mock getSessionInfo - session exists and is active (called by launchClaudeInSession)
      mockExeca.mockResolvedValueOnce({
        stdout: `${testSessionName}:1640000000:1:/test/working/dir:$1234\n`,
        stderr: "",
      });

      // Mock which claude command
      mockExeca.mockResolvedValueOnce({
        stdout: "/usr/local/bin/claude\n",
        stderr: "",
      });

      // Mock getSessionInfo again (called by launchProcessInSession)
      mockExeca.mockResolvedValueOnce({
        stdout: `${testSessionName}:1640000000:1:/test/working/dir:$1234\n`,
        stderr: "",
      });

      // Mock new window creation
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
      });

      // Mock send claude command
      mockExeca.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
      });

      // Act
      await launchClaudeInSession(testSessionName, {
        ...claudeOptions,
        autoStart: false,
      });

      // Assert
      // Should not send the prompt
      expect(mockExeca).not.toHaveBeenCalledWith(
        "tmux",
        ["send-keys", "-t", `${testSessionName}:claude`, "Help me with this task", "Enter"],
        { env: undefined, timeout: 30000 },
      );
    });

    it("should handle launch failure", async () => {
      // Arrange
      mockExeca.mockReset();
      // Mock session exists
      mockExeca.mockResolvedValueOnce({
        stdout: `${testSessionName}:1640000000:1:/test/working/dir:$1234\n`,
        stderr: "",
      });
      // Mock claude available
      mockExeca.mockResolvedValueOnce({
        stdout: "/usr/local/bin/claude\n",
        stderr: "",
      });
      // Mock window creation fails
      mockExeca.mockRejectedValueOnce(new Error("window creation failed"));

      // Act & Assert
      await expect(launchClaudeInSession(testSessionName, claudeOptions)).rejects.toThrow(
        "Failed to launch Claude",
      );
    });
  });

  describe("Pattern matching helper", () => {
    it("should match patterns correctly", async () => {
      // This tests the internal matchesPattern function through listSessions

      // Arrange
      mockExeca.mockResolvedValueOnce({
        stdout:
          "swarm-task-1:1640000000:1:$1234\nother-session:1640000001:1:$1235\nswarm-review-2:1640000002:1:$1236\n",
        stderr: "",
      });

      // Mock getSessionInfo calls
      mockExeca
        .mockResolvedValueOnce({
          stdout: "swarm-task-1:1640000000:1:/path1:$1234\n",
          stderr: "",
        })
        .mockResolvedValueOnce({
          stdout: "swarm-review-2:1640000002:1:/path2:$1236\n",
          stderr: "",
        });

      // Act
      const sessions = await listSessions("swarm-*");

      // Assert
      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.name)).toEqual(["swarm-task-1", "swarm-review-2"]);
    });
  });

  describe("Security Tests (Command Injection Prevention)", () => {
    it("should prevent command injection in session names", async () => {
      // Arrange - malicious session name
      const maliciousName = 'test"; rm -rf /; echo "';

      // Act & Assert
      await expect(
        createTmuxSession({
          name: maliciousName,
          workingDirectory: "/tmp",
        }),
      ).rejects.toThrow("Session name contains invalid characters");
    });

    it("should prevent command injection in working directories", async () => {
      // Arrange - malicious working directory
      const maliciousPath = '/tmp; rm -rf /; echo "pwned';

      // Act & Assert
      await expect(
        createTmuxSession({
          name: "test-session",
          workingDirectory: maliciousPath,
        }),
      ).rejects.toThrow("Working directory contains dangerous pattern");
    });

    it("should prevent command injection in environment variables", async () => {
      // Arrange - malicious environment variable
      const maliciousValue = 'value"; rm -rf /; echo "';

      // Act & Assert - should fail validation before reaching tmux
      await expect(
        createTmuxSession({
          name: "test-session",
          workingDirectory: "/tmp",
          environment: {
            TEST_VAR: maliciousValue,
          },
        }),
      ).rejects.toThrow("Environment variable value contains dangerous pattern");
    });

    it("should prevent command injection in process commands", async () => {
      // Arrange - the validation happens before getSessionInfo is called
      const maliciousCommand = 'echo "test"; rm -rf /; echo "';

      // Act & Assert - should fail argument validation immediately
      await expect(
        launchProcessInSession("test-session", {
          command: "echo",
          args: [maliciousCommand],
        }),
      ).rejects.toThrow("Command argument contains dangerous pattern");
    });

    it("should sanitize session names to safe characters", async () => {
      // Arrange - session name with spaces and special chars
      const unsafeName = "my session with spaces & symbols!";

      // Act & Assert
      await expect(
        createTmuxSession({
          name: unsafeName,
          workingDirectory: "/tmp",
        }),
      ).rejects.toThrow("Session name contains invalid characters");
    });

    it("should reject relative paths in working directories", async () => {
      // Arrange - relative path
      const relativePath = "../../../etc";

      // Act & Assert
      await expect(
        createTmuxSession({
          name: "test-session",
          workingDirectory: relativePath,
        }),
      ).rejects.toThrow("Working directory must be an absolute path");
    });

    it("should validate environment variable keys", async () => {
      // Arrange - invalid environment variable key
      const invalidKey = "123_INVALID_KEY";

      // Act & Assert
      await expect(
        createTmuxSession({
          name: "test-session",
          workingDirectory: "/tmp",
          environment: {
            [invalidKey]: "value",
          },
        }),
      ).rejects.toThrow("Invalid environment variable key");
    });
  });
});
