export type LogLevel = 'ALL' | 'INFO' | 'DEBUG' | 'ERROR' | 'WARN' | 'USER' | 'AGENT' | 'TEST' | 'GIT' | 'PR' | 'REVIEW';

export interface LogEntry {
  id: string;
  timestamp: string; // e.g., "2023-10-26 10:35:12.123"
  level: LogLevel;
  message: string;
}

export interface TaskInfoForLog {
  id: string; // Usually the issue number as a string
  title: string;
}

export const mockTaskInfoForLog: TaskInfoForLog = {
  id: '101',
  title: 'Fix login button alignment',
};

export const mockLogEntries: LogEntry[] = [
  { id: 'log001', timestamp: '2023-10-26 10:30:01.000', level: 'INFO', message: 'Agent process started for task #101.' },
  { id: 'log002', timestamp: '2023-10-26 10:30:05.120', level: 'DEBUG', message: 'Fetching issue details from GitHub API: /repos/acme/webapp/issues/101' },
  { id: 'log003', timestamp: '2023-10-26 10:30:15.345', level: 'USER', message: 'User input: Remember to check mobile view for this alignment issue.' },
  { id: 'log004', timestamp: '2023-10-26 10:31:00.050', level: 'AGENT', message: 'Understood. Will prioritize mobile compatibility during CSS adjustments.' },
  { id: 'log005', timestamp: '2023-10-26 10:31:30.700', level: 'DEBUG', message: 'Scanning project files for relevant stylesheets...' },
  { id: 'log006', timestamp: '2023-10-26 10:31:35.800', level: 'INFO', message: 'Found 3 potentially relevant CSS files: styles.css, login.css, common.css' },
  { id: 'log007', timestamp: '2023-10-26 10:32:00.150', level: 'GIT', message: 'Current branch: feat/login-fixes. No uncommitted changes.' },
  { id: 'log008', timestamp: '2023-10-26 10:32:15.900', level: 'DEBUG', message: 'Analyzing styles.css for button selectors.' },
  { id: 'log009', timestamp: '2023-10-26 10:33:00.000', level: 'AGENT', message: 'Identified potential conflicting rule in common.css at line 45.' },
  { id: 'log010', timestamp: '2023-10-26 10:33:45.500', level: 'WARN', message: 'High specificity on rule in common.css, may need !important or refactor.' },
  { id: 'log011', timestamp: '2023-10-26 10:34:00.200', level: 'AGENT', message: 'Attempting override in login.css with more specific selector.' },
  { id: 'log012', timestamp: '2023-10-26 10:34:30.300', level: 'TEST', message: 'Running layout test for mobile viewport (360x640).' },
  { id: 'log013', timestamp: '2023-10-26 10:34:35.400', level: 'TEST', message: 'Layout test passed: Button centered within tolerance.' },
  { id: 'log014', timestamp: '2023-10-26 10:35:00.500', level: 'GIT', message: 'Staging changes to login.css.' },
  { id: 'log015', timestamp: '2023-10-26 10:35:10.600', level: 'GIT', message: 'Committing changes with message: "fix: Correct login button alignment on mobile"' },
  { id: 'log016', timestamp: '2023-10-26 10:35:50.700', level: 'PR', message: 'Draft PR #15 created: "Fix login button alignment on mobile"' },
  { id: 'log017', timestamp: '2023-10-26 10:36:00.800', level: 'REVIEW', message: 'Review Agent started: Analyzing proposed changes.' },
  { id: 'log018', timestamp: '2023-10-26 10:36:30.900', level: 'REVIEW', message: 'Review Agent: Code looks good. Suggest adding a comment for the new selector.' },
  { id: 'log019', timestamp: '2023-10-26 10:37:00.000', level: 'AGENT', message: 'Adding suggested comment to login.css.' },
  { id: 'log020', timestamp: '2023-10-26 10:37:15.100', level: 'GIT', message: 'Amending previous commit with comment.' },
  { id: 'log021', timestamp: '2023-10-26 10:37:30.200', level: 'PR', message: 'Pushing changes to update PR #15.' },
  { id: 'log022', timestamp: '2023-10-26 10:38:00.300', level: 'INFO', message: 'Task #101 completed successfully.' },
  { id: 'log023', timestamp: '2023-10-26 10:39:00.000', level: 'ERROR', message: 'Failed to fetch user preferences: Network timeout.' },
  // Add more entries to test scrolling
  ...Array.from({ length: 30 }, (_, i) => ({
    id: `log_scroll_${i + 1}`,
    timestamp: `2023-10-26 10:40:${i.toString().padStart(2, '0')}.000`,
    level: (['INFO', 'DEBUG', 'WARN'] as LogLevel[])[i % 3],
    message: `Scrollable log entry number ${i + 1}. This is just to add more content for scrolling tests. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`
  }))
];

export const logLevels: LogLevel[] = ['ALL', 'INFO', 'DEBUG', 'ERROR', 'WARN', 'USER', 'AGENT', 'TEST', 'GIT', 'PR', 'REVIEW'];
