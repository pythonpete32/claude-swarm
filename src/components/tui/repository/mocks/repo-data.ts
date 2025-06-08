export interface RecentProject {
  id: string;
  name: string;
  activeTasks: number;
  doneTasks: number;
  lastActivity: string; // e.g., "2 hours ago"
}

export interface AvailableRepo {
  id: string;
  name: string;
  openIssues: number;
}

export interface ProgressStep {
  id: string;
  text: string;
  status: 'pending' | 'in_progress' | 'done' | 'error';
}

export const mockRecentProjects: RecentProject[] = [
  { id: '1', name: 'acme/webapp', activeTasks: 3, doneTasks: 12, lastActivity: '2 hours ago' },
  { id: '2', name: 'corp/internal-tool', activeTasks: 1, doneTasks: 5, lastActivity: '1 day ago' },
  { id: '3', name: 'opensource/community-project', activeTasks: 0, doneTasks: 25, lastActivity: '3 days ago' },
];

export const mockAvailableRepos: AvailableRepo[] = [
  { id: 'gh_1', name: 'janedoe/personal-blog', openIssues: 5 },
  { id: 'gh_2', name: 'janedoe/dotfiles', openIssues: 2 },
  { id: 'gh_3', name: 'acme/api-gateway', openIssues: 42 },
  { id: 'gh_4', name: 'acme/mobile-app', openIssues: 15 },
  { id: 'gh_5', name: 'corp/legacy-system', openIssues: 101 },
];

export const mockProgressSteps: ProgressStep[] = [
  { id: 'clone', text: 'Cloning repository...', status: 'pending' },
  { id: 'workspace', text: 'Setting up agent workspace...', status: 'pending' },
  { id: 'dependencies', text: 'Installing dependencies...', status: 'pending' },
  { id: 'indexing', text: 'Indexing repository (0%)...', status: 'pending' },
];

export const mockUsername = 'janedoe';

export const MOCK_SELECTED_REPO_NAME = 'acme/webapp';
