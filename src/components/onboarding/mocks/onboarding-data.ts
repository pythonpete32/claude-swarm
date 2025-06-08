export interface Prerequisite {
  name: string;
  status: 'installed' | 'not_found' | 'required';
}

export interface GitHubAuthData {
  deviceCode: string;
  expiresIn: number;
  status: 'waiting' | 'checking' | 'success';
}

export interface ApiProvider {
  name: string;
  models: string[];
}

export interface ApiConfigData {
  provider: string;
  apiKey: string;
  model: string;
}

export const mockPrerequisites: Prerequisite[] = [
  { name: 'Claude Code CLI', status: 'installed' },
  { name: 'GitHub CLI (gh)', status: 'installed' },
  { name: 'GitHub Auth', status: 'not_found' },
  { name: 'API Key', status: 'required' }
];

export const mockGitHubAuth: GitHubAuthData = {
  deviceCode: 'ABCD-1234',
  expiresIn: 900, // 15 minutes in seconds
  status: 'waiting'
};

export const mockApiProviders: ApiProvider[] = [
  {
    name: 'OpenAI',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo']
  },
  {
    name: 'Anthropic', 
    models: ['claude-3-5-sonnet', 'claude-3-haiku']
  },
  {
    name: 'Azure OpenAI',
    models: ['gpt-4o-mini', 'gpt-4o']
  }
];

export const mockApiConfig: ApiConfigData = {
  provider: 'OpenAI',
  apiKey: '',
  model: 'gpt-4o-mini'
};