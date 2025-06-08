// Interfaces for Settings
export interface AgentSettings {
  defaultModel: string;
  maxConcurrentAgents: number;
  enableReviewAgentByDefault: boolean;
  autoCreatePRByDefault: boolean;
  runTestsByDefault: boolean;
}

export interface EditorSettings {
  preferredEditor: 'vscode' | 'neovim' | 'other' | 'none';
}

export interface ApiKeyEntry {
  provider: string; // e.g., 'OpenAI', 'Anthropic'
  apiKey: string;
  model?: string; // Optional, if provider has a default or user selects later
}

export interface ApiSettings {
  summaryProvider: string; // Name of the provider used for summaries
  summaryApiKey: string;   // API Key for the summary provider
  summaryModel: string;    // Model for the summary provider
  // Potentially a list of other API keys if the app supports multiple
  // customApiKeys?: ApiKeyEntry[];
}

export interface GitHubSettings {
  username: string; // Read-only, from auth
  autoSyncIssues: boolean;
  createDraftPRs: boolean;
}

export interface AppSettings {
  agent: AgentSettings;
  editor: EditorSettings;
  api: ApiSettings;
  github: GitHubSettings;
}

// Mock Data Instances

export const mockAvailableModels: string[] = [
  'gpt-4o-mini', 'gpt-4o', 'claude-3-5-sonnet', 'claude-3-haiku', 'gemini-1.5-flash', 'azure-gpt-4o'
];

export const mockAvailableEditors: Array<{label: string, value: EditorSettings['preferredEditor']}> = [
  { label: 'Visual Studio Code', value: 'vscode' },
  { label: 'NeoVim', value: 'neovim' },
  { label: 'Other (manual setup)', value: 'other' },
  { label: 'None', value: 'none' },
];

export const mockAvailableApiProviders: string[] = [
  'OpenAI', 'Anthropic', 'Azure OpenAI', 'Google Gemini'
];


export const defaultAppSettings: AppSettings = {
  agent: {
    defaultModel: 'gpt-4o-mini',
    maxConcurrentAgents: 3,
    enableReviewAgentByDefault: true,
    autoCreatePRByDefault: true,
    runTestsByDefault: false,
  },
  editor: {
    preferredEditor: 'vscode',
  },
  api: {
    summaryProvider: 'OpenAI',
    summaryApiKey: '', // Typically empty by default, user needs to input
    summaryModel: 'gpt-4o-mini',
  },
  github: {
    username: 'janedoe', // This would usually be fetched after auth
    autoSyncIssues: true,
    createDraftPRs: false,
  },
};

// Example of a user's current settings, could be different from default
export const currentUserAppSettings: AppSettings = {
  ...defaultAppSettings, // Start with defaults
  agent: {
    ...defaultAppSettings.agent,
    maxConcurrentAgents: 5,
  },
  api: {
    ...defaultAppSettings.api,
    summaryApiKey: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx', // User has entered their key
  },
  github: {
      ...defaultAppSettings.github,
      username: 'testuser-123' // From actual auth
  }
};
