export interface Repository {
  name: string;
  active: number;
  done: number;
  lastUsed: string;
  openIssues?: number;
}

export interface Issue {
  id: number;
  title: string;
  status: string;
}

export interface LogLine {
  time: string;
  message: string;
}

export const recentRepositories: Repository[] = [
  { name: 'acme/webapp', active: 3, done: 12, lastUsed: '2h ago' },
  { name: 'acme/mobile-app', active: 1, done: 8, lastUsed: 'yesterday' },
  { name: 'personal/blog-engine', active: 0, done: 5, lastUsed: '3d ago' },
];

export const githubRepositories: Repository[] = [
  { name: 'acme/api-gateway', active: 0, done: 0, lastUsed: '', openIssues: 42 },
  { name: 'acme/documentation', active: 0, done: 0, lastUsed: '', openIssues: 8 },
  { name: 'tools/deployment-scripts', active: 0, done: 0, lastUsed: '', openIssues: 3 },
];

export const issues: Issue[] = [
  { id: 45, title: '[FEATURE] Implement webhook handlers', status: 'open' },
  { id: 44, title: '[BUG] Fix memory leak in worker threads', status: 'open' },
  { id: 43, title: '[TASK] Update dependencies', status: 'open' },
];

export const logs: LogLine[] = [
  { time: '15:18:45', message: 'INFO  Starting task execution' },
  { time: '15:18:47', message: 'AGENT Reading issue description...' },
  { time: '15:19:56', message: 'PR    Pull request created: #89' },
];
