// Mock data types for presentation components
export interface Instance {
  id: string;
  type: "work" | "review" | "adhoc";
  status: "running" | "terminated";

  // Git/Worktree Info
  worktree_path: string;
  branch_name: string;
  base_branch?: string;

  // Session Info
  tmux_session: string;
  claude_pid?: number;

  // GitHub Integration
  issue_number?: number;
  issue_title?: string;
  pr_number?: number;

  // Timestamps
  created_at: string;
  terminated_at?: string;

  // Metadata
  prompt?: string;
  agent_number: number;
}

export type InstanceAction = "view" | "review" | "kill" | "editor" | "copy" | "fork" | "merge";

export interface GitHubIssue {
  number: number;
  title: string;
  body?: string;
  state: "open" | "closed";
  assignee?: string;
  labels: string[];
  created_at: string;
  updated_at: string;
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
}

// Mock data factories
export const createMockInstance = (overrides: Partial<Instance> = {}): Instance => ({
  id: "work-123-a1",
  type: "work",
  status: "running",
  worktree_path: "/Users/user/worktrees/work-123-a1",
  branch_name: "feat/auth-fix",
  base_branch: "main",
  tmux_session: "work-123-a1",
  claude_pid: 12345,
  issue_number: 123,
  issue_title: "Fix authentication system",
  created_at: "2024-01-15T10:30:00Z",
  prompt: "Implement authentication for the login page...",
  agent_number: 1,
  ...overrides,
});

export const createMockIssue = (overrides: Partial<GitHubIssue> = {}): GitHubIssue => ({
  number: 123,
  title: "Fix authentication system",
  body: "Need to implement proper authentication for the login page",
  state: "open",
  labels: ["bug", "priority-high"],
  created_at: "2024-01-15T09:00:00Z",
  updated_at: "2024-01-15T09:00:00Z",
  ...overrides,
});

export const createMockBranch = (overrides: Partial<GitBranch> = {}): GitBranch => ({
  name: "main",
  current: true,
  ...overrides,
});

// Mock data sets
export const MOCK_INSTANCES: Instance[] = [
  createMockInstance({
    id: "work-123-a1",
    issue_number: 123,
    issue_title: "Fix authentication system",
    status: "running",
    created_at: "2024-01-15T08:30:00Z",
  }),
  createMockInstance({
    id: "review-123-a1",
    type: "review",
    issue_number: 123,
    issue_title: "Fix authentication system",
    status: "running",
    branch_name: "feat/auth-fix-review",
    created_at: "2024-01-15T10:15:00Z",
  }),
  createMockInstance({
    id: "work-456-a1",
    issue_number: 456,
    issue_title: "Add dark mode toggle",
    status: "running",
    branch_name: "feat/dark-mode",
    created_at: "2024-01-15T09:45:00Z",
  }),
  createMockInstance({
    id: "adhoc-a1",
    type: "adhoc",
    status: "terminated",
    branch_name: "adhoc/quick-fix",
    prompt: "Quick CSS fix for mobile layout",
    terminated_at: "2024-01-15T11:00:00Z",
    created_at: "2024-01-15T10:30:00Z",
  }),
];

export const MOCK_ISSUES: GitHubIssue[] = [
  createMockIssue({
    number: 123,
    title: "Fix authentication system",
    labels: ["bug", "priority-high"],
  }),
  createMockIssue({
    number: 456,
    title: "Add dark mode toggle",
    labels: ["feature", "priority-medium"],
  }),
  createMockIssue({
    number: 789,
    title: "Improve mobile responsiveness",
    labels: ["enhancement", "priority-low"],
  }),
];

export const MOCK_BRANCHES: GitBranch[] = [
  createMockBranch({ name: "main", current: true }),
  createMockBranch({ name: "develop", current: false }),
  createMockBranch({ name: "feat/auth-fix", current: false }),
  createMockBranch({ name: "feat/dark-mode", current: false }),
];
