export interface AdHocTask {
  id: string;
  command: string;
  status: 'running' | 'completed' | 'failed';
}

export interface ActiveAgent {
  id: string;
  issueNumber: number;
  issueTitle: string;
  statusSummary: string; // e.g., "Generating code for component X..."
  runtime: string; // e.g., "02:35"
}

export interface IssueLabel {
  name: string;
  color: string; // Hex or color name
}

export interface Issue {
  id: string;
  number: number;
  title: string;
  labels: IssueLabel[];
  author: string;
  date: string; // e.g., "2 days ago"
  status: 'open' | 'closed' | 'in_progress'; // Added status
}

export interface SubTask {
  id: string;
  text: string;
  status: 'pending' | 'in_progress' | 'done' | 'error';
}

export interface LogEntry {
  id: string;
  timestamp: string; // e.g., "10:35:12"
  message: string;
  type: 'info' | 'warning' | 'error' | 'agent_message' | 'user_message';
}

export interface TaskDetails {
  issueNumber: number;
  issueTitle: string;
  agentStatus: string; // e.g., "Running", "Paused", "Completed"
  currentStep: string; // e.g. "Coding: Implementing function X"
  runtime: string;
  subTasks: SubTask[];
  logEntries: LogEntry[];
}

export interface TaskConfig {
  model: string; // e.g., "gpt-4o-mini"
  customInstructions: string;
  enableReviewAgent: boolean;
  autoCreatePR: boolean;
  requireTests: boolean;
  maxReviewCycles: number;
}

export interface RepoInfo {
  name: string; // e.g., "acme/webapp"
  currentBranch: string; // e.g. "main"
  editorIntegration: 'vscode' | 'neovim' | 'none';
  currentTab: 'issues' | 'running' | 'history'; // For dashboard tabs
}


// Mock Data Instances

export const mockRepoInfo: RepoInfo = {
  name: 'acme/webapp',
  currentBranch: 'feat/new-onboarding',
  editorIntegration: 'vscode',
  currentTab: 'issues',
};

export const mockAdHocTaskInput: string = '';

export const mockActiveAgents: ActiveAgent[] = [
  { id: 'agent1', issueNumber: 101, issueTitle: "Fix login button alignment", statusSummary: "Analyzing DOM structure...", runtime: "00:15" },
  { id: 'agent2', issueNumber: 102, issueTitle: "Implement password reset API", statusSummary: "Drafting API schema (claude-3-5-sonnet)...", runtime: "01:30:05" },
];

export const mockIssues: Issue[] = [
  { id: 'issue1', number: 101, title: "Fix login button alignment", labels: [{name: 'bug', color: 'red'}, {name: 'UI', color: 'blue'}], author: 'alice', date: '1 day ago', status: 'in_progress' },
  { id: 'issue2', number: 102, title: "Implement password reset API", labels: [{name: 'feature', color: 'green'}], author: 'bob', date: '2 days ago', status: 'open' },
  { id: 'issue3', number: 98, title: "Refactor user authentication module", labels: [{name: 'chore', color: 'grey'}], author: 'alice', date: '5 days ago', status: 'open' },
  { id: 'issue4', number: 95, title: "Update documentation for API v2", labels: [{name: 'documentation', color: 'purple'}], author: 'charlie', date: '1 week ago', status: 'closed' },
];

export const mockTaskDetails: TaskDetails = {
  issueNumber: 101,
  issueTitle: "Fix login button alignment",
  agentStatus: "Running",
  currentStep: "Analyzing DOM structure for button placement",
  runtime: "00:18:30",
  subTasks: [
    { id: 'st1', text: "Identify relevant CSS files", status: 'done' },
    { id: 'st2', text: "Analyze button component structure", status: 'in_progress' },
    { id: 'st3', text: "Propose CSS changes", status: 'pending' },
    { id: 'st4', text: "Implement changes", status: 'pending' },
    { id: 'st5', text: "Test on major browsers", status: 'pending' },
  ],
  logEntries: [
    { id: 'log1', timestamp: "10:30:01", message: "Agent started task #101", type: 'info' },
    { id: 'log2', timestamp: "10:30:05", message: "Fetching issue details from GitHub...", type: 'info' },
    { id: 'log3', timestamp: "10:30:15", message: "User: Remember to check mobile view.", type: 'user_message' },
    { id: 'log4', timestamp: "10:31:00", message: "Agent: Understood. Will prioritize mobile compatibility.", type: 'agent_message' },
    { id: 'log5', timestamp: "10:31:30", message: "Found 3 potentially relevant CSS files: styles.css, login.css, common.css", type: 'info' },
  ],
};

export const mockTaskConfig: TaskConfig = {
  model: 'gpt-4o-mini',
  customInstructions: "Ensure all changes are responsive and follow the existing style guide. Add comments for complex logic.",
  enableReviewAgent: true,
  autoCreatePR: true,
  requireTests: false,
  maxReviewCycles: 3,
};

export const mockAvailableModels: string[] = [
  'gpt-4o-mini', 'gpt-4o', 'claude-3-5-sonnet', 'claude-3-haiku', 'gemini-1.5-flash'
];
