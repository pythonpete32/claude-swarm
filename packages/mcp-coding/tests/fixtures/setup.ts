/**
 * Test setup and global configuration for MCP-Coding package tests
 */

import { vi } from "vitest";

// Mock @modelcontextprotocol/sdk
vi.mock("@modelcontextprotocol/sdk", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Server: vi.fn(),
    StdioServerTransport: vi.fn(),
  };
});

// Mock process for command line arguments
vi.mock("process", () => ({
  env: {
    NODE_ENV: "test",
    ...process.env,
  },
  cwd: vi.fn(() => "/test/workspace"),
  pid: 12345,
  argv: ["node", "server.js", "--agent-id", "test-agent", "--workspace", "/test/workspace"],
  exit: vi.fn(),
  stdout: {
    write: vi.fn(),
  },
  stderr: {
    write: vi.fn(),
  },
}));

// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Additional cleanup after each test
  vi.restoreAllMocks();
});