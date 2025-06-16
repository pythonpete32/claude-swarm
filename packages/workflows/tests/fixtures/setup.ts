/**
 * Test setup and global configuration for workflows package tests
 */

import { vi } from "vitest";

// Mock node:child_process completely
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    spawn: vi.fn(),
    exec: vi.fn(),
    execSync: vi.fn(),
    execFile: vi.fn(),
    fork: vi.fn(),
  };
});

// Mock process.env for testing
vi.mock("process", () => ({
  env: {
    NODE_ENV: "test",
    ...process.env,
  },
  cwd: vi.fn(() => "/test/workspace"),
  pid: 12345,
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
