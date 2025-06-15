import type {
  InstanceStatus,
  InstanceType,
  NewGitHubIssue,
  NewInstance,
  NewMCPEvent,
  NewRelationship,
  NewUserConfig,
  RelationshipType,
} from "../../db/schema.js";

// Test instance data
export const VALID_INSTANCES: Record<string, NewInstance> = {
  CODING_BASIC: {
    id: "work-123-a1",
    type: "coding",
    status: "started",
    worktree_path: "/test/worktree/work-123",
    branch_name: "work-123-implementation",
    base_branch: "main",
    tmux_session: "swarm-work-123",
    claude_pid: 12345,
    issue_number: 123,
    pr_number: null,
    pr_url: null,
    parent_instance_id: null,
    created_at: new Date("2024-01-15T10:00:00Z"),
    terminated_at: null,
    last_activity: new Date("2024-01-15T10:00:00Z"),
    system_prompt: "You are implementing GitHub issue #123",
    agent_number: 1,
  },

  REVIEW_BASIC: {
    id: "review-123-a1",
    type: "review",
    status: "started",
    worktree_path: "/test/worktree/review-123",
    branch_name: "work-123-implementation",
    base_branch: "main",
    tmux_session: "swarm-review-123",
    claude_pid: 12346,
    issue_number: 123,
    pr_number: 45,
    pr_url: "https://github.com/test/repo/pull/45",
    parent_instance_id: "work-123-a1",
    created_at: new Date("2024-01-15T11:00:00Z"),
    terminated_at: null,
    last_activity: new Date("2024-01-15T11:00:00Z"),
    system_prompt: "You are reviewing the implementation for issue #123",
    agent_number: 1,
  },

  PLANNING_BASIC: {
    id: "plan-124-a1",
    type: "planning",
    status: "started",
    worktree_path: "/test/worktree/plan-124",
    branch_name: "main",
    base_branch: "main",
    tmux_session: "swarm-plan-124",
    claude_pid: 12347,
    issue_number: 124,
    pr_number: null,
    pr_url: null,
    parent_instance_id: null,
    created_at: new Date("2024-01-15T12:00:00Z"),
    terminated_at: null,
    last_activity: new Date("2024-01-15T12:00:00Z"),
    system_prompt: "You are planning the approach for issue #124",
    agent_number: 1,
  },

  TERMINATED: {
    id: "work-125-a1",
    type: "coding",
    status: "terminated",
    worktree_path: "/test/worktree/work-125",
    branch_name: "work-125-implementation",
    base_branch: "main",
    tmux_session: "swarm-work-125",
    claude_pid: null,
    issue_number: 125,
    pr_number: 46,
    pr_url: "https://github.com/test/repo/pull/46",
    parent_instance_id: null,
    created_at: new Date("2024-01-15T09:00:00Z"),
    terminated_at: new Date("2024-01-15T13:00:00Z"),
    last_activity: new Date("2024-01-15T13:00:00Z"),
    system_prompt: "You were implementing GitHub issue #125",
    agent_number: 1,
  },
};

// Test MCP event data
export const VALID_MCP_EVENTS: Record<string, NewMCPEvent> = {
  SUCCESSFUL_EDIT: {
    instance_id: "work-123-a1",
    tool_name: "edit_file",
    success: true,
    error_message: null,
    metadata: JSON.stringify({
      file_path: "/test/file.ts",
      lines_changed: 5,
      change_type: "modification",
    }),
    git_commit_hash: "abc123def456",
    status_change: null,
    is_status_updating: false,
    timestamp: new Date("2024-01-15T10:30:00Z"),
  },

  FAILED_COMMAND: {
    instance_id: "work-123-a1",
    tool_name: "run_command",
    success: false,
    error_message: "Command failed with exit code 1",
    metadata: JSON.stringify({
      command: "npm test",
      exit_code: 1,
      stderr: "Test suite failed",
    }),
    git_commit_hash: null,
    status_change: null,
    is_status_updating: false,
    timestamp: new Date("2024-01-15T10:45:00Z"),
  },

  STATUS_UPDATE: {
    instance_id: "work-123-a1",
    tool_name: "update_instance_status",
    success: true,
    error_message: null,
    metadata: JSON.stringify({
      old_status: "started",
      new_status: "waiting_review",
    }),
    git_commit_hash: null,
    status_change: "waiting_review",
    is_status_updating: true,
    timestamp: new Date("2024-01-15T11:00:00Z"),
  },

  PR_CREATION: {
    instance_id: "work-123-a1",
    tool_name: "create_pr",
    success: true,
    error_message: null,
    metadata: JSON.stringify({
      pr_number: 45,
      pr_url: "https://github.com/test/repo/pull/45",
      title: "Implement feature for issue #123",
    }),
    git_commit_hash: "def456ghi789",
    status_change: "pr_created",
    is_status_updating: true,
    timestamp: new Date("2024-01-15T12:00:00Z"),
  },
};

// Test relationship data
export const VALID_RELATIONSHIPS: Record<string, NewRelationship> = {
  REVIEW_SPAWN: {
    parent_instance: "work-123-a1",
    child_instance: "review-123-a1",
    relationship_type: "spawned_review",
    review_iteration: 1,
    created_at: new Date("2024-01-15T11:00:00Z"),
    metadata: JSON.stringify({
      reason: "Code review requested",
      reviewer_preferences: ["focus_on_logic", "check_tests"],
    }),
  },

  FORK_CREATION: {
    parent_instance: "review-123-a1",
    child_instance: "work-123-a2",
    relationship_type: "created_fork",
    review_iteration: 1,
    created_at: new Date("2024-01-15T13:00:00Z"),
    metadata: JSON.stringify({
      reason: "Review suggested improvements",
      changes_needed: ["refactor_function_x", "add_error_handling"],
    }),
  },

  PLANNING_TO_ISSUE: {
    parent_instance: "plan-124-a1",
    child_instance: "work-124-a1",
    relationship_type: "planning_to_issue",
    review_iteration: 1,
    created_at: new Date("2024-01-15T14:00:00Z"),
    metadata: JSON.stringify({
      planning_outcome: "ready_for_implementation",
      estimated_complexity: "medium",
      dependencies: ["feature_a", "refactor_b"],
    }),
  },

  SECOND_REVIEW: {
    parent_instance: "work-123-a2",
    child_instance: "review-123-a2",
    relationship_type: "spawned_review",
    review_iteration: 2,
    created_at: new Date("2024-01-15T15:00:00Z"),
    metadata: JSON.stringify({
      reason: "Second review after improvements",
      changes_made: ["refactored_function_x", "added_error_handling"],
    }),
  },
};

// Test GitHub issue data
export const VALID_GITHUB_ISSUES: Record<string, NewGitHubIssue> = {
  OPEN_BUG: {
    number: 123,
    title: "Fix authentication bug in login flow",
    body: "Users are unable to login when using SSO authentication. The error occurs after the OAuth callback.",
    state: "open",
    assignee: "dev-team-lead",
    labels: JSON.stringify(["bug", "high-priority", "authentication"]),
    created_at: new Date("2024-01-10T09:00:00Z"),
    updated_at: new Date("2024-01-15T10:00:00Z"),
    synced_at: new Date("2024-01-15T16:00:00Z"),
    repo_owner: "acme-corp",
    repo_name: "main-app",
  },

  FEATURE_REQUEST: {
    number: 124,
    title: "Add dark mode support to dashboard",
    body: "Users have requested dark mode support for better UX during night time usage.",
    state: "open",
    assignee: "ui-team-lead",
    labels: JSON.stringify(["enhancement", "ui", "user-request"]),
    created_at: new Date("2024-01-12T14:00:00Z"),
    updated_at: new Date("2024-01-12T14:00:00Z"),
    synced_at: new Date("2024-01-15T16:00:00Z"),
    repo_owner: "acme-corp",
    repo_name: "main-app",
  },

  CLOSED_BUG: {
    number: 125,
    title: "Memory leak in background task processor",
    body: "Background tasks are consuming increasing amounts of memory over time.",
    state: "closed",
    assignee: "backend-team",
    labels: JSON.stringify(["bug", "performance", "resolved"]),
    created_at: new Date("2024-01-08T11:00:00Z"),
    updated_at: new Date("2024-01-15T13:00:00Z"),
    synced_at: new Date("2024-01-15T16:00:00Z"),
    repo_owner: "acme-corp",
    repo_name: "main-app",
  },
};

// Test user config data
export const VALID_USER_CONFIGS: Record<string, NewUserConfig> = {
  GITHUB_TOKEN: {
    key: "github.token",
    value: "ghp_test1234567890abcdef",
    encrypted: true,
    updated_at: new Date("2024-01-15T10:00:00Z"),
  },

  DEFAULT_BRANCH: {
    key: "git.default_branch",
    value: "main",
    encrypted: false,
    updated_at: new Date("2024-01-15T10:00:00Z"),
  },

  MAX_REVIEW_CYCLES: {
    key: "workflow.max_review_cycles",
    value: "3",
    encrypted: false,
    updated_at: new Date("2024-01-15T10:00:00Z"),
  },

  TMUX_PREFIX: {
    key: "tmux.session_prefix",
    value: "swarm-",
    encrypted: false,
    updated_at: new Date("2024-01-15T10:00:00Z"),
  },
};

// Test constants
export const TEST_CONSTANTS = {
  VALID_STATUSES: [
    "started",
    "waiting_review",
    "pr_created",
    "pr_merged",
    "pr_closed",
    "terminated",
  ] as InstanceStatus[],
  VALID_TYPES: ["coding", "review", "planning"] as InstanceType[],
  VALID_RELATIONSHIP_TYPES: [
    "spawned_review",
    "created_fork",
    "planning_to_issue",
  ] as RelationshipType[],

  INVALID_DATA: {
    EMPTY_STRING: "",
    UNDEFINED: undefined,
    NULL: null,
    INVALID_STATUS: "invalid_status",
    INVALID_TYPE: "invalid_type",
    INVALID_RELATIONSHIP_TYPE: "invalid_relationship",
    INVALID_DATE: "not-a-date",
    INVALID_JSON: "not valid json {",
  },

  EDGE_CASES: {
    VERY_LONG_STRING: "a".repeat(10000),
    SPECIAL_CHARACTERS: "!@#$%^&*()[]{}|;':\",./<>?`~",
    UNICODE_STRING: "🚀 Unicode test with émojis and spëcial chars",
    EMPTY_OBJECT: {},
    LARGE_NUMBER: Number.MAX_SAFE_INTEGER,
    NEGATIVE_NUMBER: -1,
  },
};

// Helper functions for test data
export function getInstancesByStatus(status: InstanceStatus): NewInstance[] {
  return Object.values(VALID_INSTANCES).filter((instance) => instance.status === status);
}

export function getInstancesByType(type: InstanceType): NewInstance[] {
  return Object.values(VALID_INSTANCES).filter((instance) => instance.type === type);
}

export function getEventsByInstance(instanceId: string): NewMCPEvent[] {
  return Object.values(VALID_MCP_EVENTS).filter((event) => event.instance_id === instanceId);
}

export function getRelationshipsByParent(parentId: string): NewRelationship[] {
  return Object.values(VALID_RELATIONSHIPS).filter((rel) => rel.parent_instance === parentId);
}

export function getRelationshipsByChild(childId: string): NewRelationship[] {
  return Object.values(VALID_RELATIONSHIPS).filter((rel) => rel.child_instance === childId);
}

export function getIssuesByState(state: string): NewGitHubIssue[] {
  return Object.values(VALID_GITHUB_ISSUES).filter((issue) => issue.state === state);
}
