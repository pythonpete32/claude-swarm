/**
 * Test fixtures and mock data for workflows package tests
 */

import type { ChildProcess } from "node:child_process";
import { vi } from "vitest";
import type { DatabaseInterface } from "../../src/types/dependencies.js";
import type { CodingAgentConfig, ReviewAgentConfig } from "../../src/types/workflow-config.js";

// Mock Database Interface
export const createMockDatabase = (): DatabaseInterface => ({
  createInstance: vi.fn().mockResolvedValue(undefined),
  getInstance: vi.fn().mockResolvedValue(null),
  updateInstance: vi.fn().mockResolvedValue(undefined),
  deleteInstance: vi.fn().mockResolvedValue(undefined),
  listInstances: vi.fn().mockResolvedValue([]),
  createRelationship: vi.fn().mockResolvedValue(undefined),
  getRelationships: vi.fn().mockResolvedValue([]),
  updateRelationship: vi.fn().mockResolvedValue(undefined),
  deleteRelationship: vi.fn().mockResolvedValue(undefined),
});

// Mock Child Process
export const createMockChildProcess = (): ChildProcess => {
  const mockOn = vi.fn().mockImplementation((event: string, callback: Function) => {
    // Immediately trigger spawn event for tests that expect it
    if (event === "spawn") {
      setImmediate(callback);
    }
    return mockProcess;
  });

  const mockProcess = {
    pid: 12345,
    killed: false,
    kill: vi.fn().mockReturnValue(true),
    on: mockOn,
    emit: vi.fn(),
    stdout: null,
    stderr: null,
    stdin: null,
    stdio: [null, null, null],
    channel: undefined,
    connected: false,
    disconnect: vi.fn(),
    send: vi.fn(),
    ref: vi.fn(),
    unref: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
    setMaxListeners: vi.fn(),
    getMaxListeners: vi.fn().mockReturnValue(10),
    listeners: vi.fn().mockReturnValue([]),
    rawListeners: vi.fn().mockReturnValue([]),
    listenerCount: vi.fn().mockReturnValue(0),
    prependListener: vi.fn(),
    prependOnceListener: vi.fn(),
    once: vi.fn(),
    eventNames: vi.fn().mockReturnValue([]),
    exitCode: null,
    signalCode: null,
    spawnargs: [],
    spawnfile: "node",
  } as ChildProcess;

  return mockProcess;
};

// Test Instance Data
export const TEST_INSTANCES = {
  coding: {
    id: "work-123-1234567890-abcdef123",
    type: "coding" as const,
    status: "started" as const,
    worktree_path: "/test/workspace/work-123-1234567890-abcdef123",
    branch_name: "work/test-feature",
    tmux_session: "work-123-1234567890-abcdef123",
    issue_number: 123,
    base_branch: "main",
    claude_pid: 54321,
    agent_number: 1,
    created_at: new Date("2024-01-01T10:00:00Z"),
    last_activity: new Date("2024-01-01T10:30:00Z"),
    terminated_at: null,
    parent_instance_id: null,
  },
  review: {
    id: "review-work-123-1234567890-abcdef123-1",
    type: "review" as const,
    status: "started" as const,
    worktree_path: "/test/workspace/review-work-123-1234567890-abcdef123-1",
    branch_name: "review/test-feature",
    tmux_session: "review-work-123-1234567890-abcdef123-1",
    issue_number: 123,
    base_branch: "work/test-feature",
    claude_pid: 54322,
    agent_number: 1,
    created_at: new Date("2024-01-01T11:00:00Z"),
    last_activity: new Date("2024-01-01T11:30:00Z"),
    terminated_at: null,
    parent_instance_id: "work-123-1234567890-abcdef123",
  },
};

// Test Relationships
export const TEST_RELATIONSHIPS = [
  {
    id: "rel-123",
    parent_instance: "work-123-1234567890-abcdef123",
    child_instance: "review-work-123-1234567890-abcdef123-1",
    relationship_type: "spawned_review" as const,
    review_iteration: 1,
    metadata: null,
    created_at: new Date("2024-01-01T11:00:00Z"),
  },
];

// Test Workflow Configs
export const TEST_CODING_CONFIG: CodingAgentConfig = {
  issue: {
    number: 123,
    title: "Test Issue",
    body: "Test issue body",
    url: "https://github.com/test/repo/issues/123",
  },
  baseBranch: "main",
  targetBranch: "work/test-feature",
  maxReviews: 3,
  systemPrompt: "You are a coding assistant.",
  worktreeOptions: {},
  tmuxOptions: {},
  claudeOptions: {
    environmentVars: {
      ISSUE_NUMBER: "123",
    },
  },
};

export const TEST_REVIEW_CONFIG: ReviewAgentConfig = {
  parentInstanceId: "work-123-1234567890-abcdef123",
  parentTmuxSession: "work-123-1234567890-abcdef123",
  reviewBranch: "review/test-feature",
  issueNumber: 123,
  codingDescription: "Implement test feature",
  preserveChanges: false,
  timeoutMinutes: 30,
  reviewPrompt: "Review the code changes for quality and correctness.",
};

// Mock Core Functions
export const createMockCoreFunctions = () => ({
  createWorktree: vi.fn().mockResolvedValue({
    path: "/test/workspace/test-worktree",
    branch: "test-branch",
    name: "test-worktree",
  }),
  removeWorktree: vi.fn().mockResolvedValue(undefined),
  createTmuxSession: vi.fn().mockResolvedValue({
    name: "test-session",
    pid: 12345,
  }),
  killSession: vi.fn().mockResolvedValue(undefined),
  launchClaudeSession: vi.fn().mockResolvedValue({
    session: {
      id: "claude-session-123",
      pid: 54321,
    },
  }),
  terminateClaudeSession: vi.fn().mockResolvedValue(undefined),
  createPullRequest: vi.fn().mockResolvedValue({
    pullRequest: {
      url: "https://github.com/test/repo/pull/456",
      number: 456,
    },
  }),
  sendKeys: vi.fn().mockResolvedValue(undefined),
});

// Helper to create test database with pre-populated data
export const createTestDatabase = (
  instances = [TEST_INSTANCES.coding],
  relationships = TEST_RELATIONSHIPS
) => {
  const mockDb = createMockDatabase();

  // Setup getInstance responses
  mockDb.getInstance = vi.fn().mockImplementation((id: string) => {
    const instance = instances.find((i) => i.id === id);
    return Promise.resolve(instance || null);
  });

  // Setup getRelationships responses
  mockDb.getRelationships = vi.fn().mockImplementation((instanceId: string) => {
    const rels = relationships.filter(
      (r) => r.parent_instance === instanceId || r.child_instance === instanceId
    );
    return Promise.resolve(rels);
  });

  return mockDb;
};
