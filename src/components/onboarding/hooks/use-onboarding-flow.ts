import { useState, useCallback } from 'react';
import {
  mockGitHubAuth,
  mockApiConfig,
  mockPrerequisites,
  type GitHubAuthData,
  type ApiConfigData,
  type Prerequisite
} from '../mocks/onboarding-data';
// No mock data for repo selection/downloading needed in this hook directly yet

export type OnboardingScreen =
  | 'splash'
  | 'github-auth'
  | 'api-config'
  | 'repoSelection'
  | 'repoDownloading'
  | 'taskDashboard'
  | 'taskDetail'
  | 'taskConfiguration'
  | 'issueCreation'
  | 'settings'
  | 'fullLogView'; // Added

import {
  mockTaskConfig, // For initializing task config
  type TaskConfig,
} from '../../tui/tasks/mocks/task-data';
import {
  initialAIChatHistory,
  initialIssuePreview,
  sampleUpdatedIssuePreview, // For mock AI response
  sampleAIResponse, // For mock AI response text
  type AIChatMessage,
  type IssuePreview,
} from '../../tui/issues/mocks/issue-creation-data';
import {
  defaultAppSettings, // For initializing settings state
  type AppSettings,
} from '../../tui/settings/mocks/settings-data';
import {
  type LogEntry,
  type TaskInfoForLog,
} from '../../tui/logs/mocks/log-data';


export interface OnboardingFlowState {
  currentScreen: OnboardingScreen;
  canGoBack: boolean;
  prerequisites: Prerequisite[];
  githubAuth: GitHubAuthData;
  apiConfig: ApiConfigData;
  selectedRepoName: string | null;
  currentTaskId: string | null;
  currentTaskConfiguration: TaskConfig | null;
  issueCreationChatHistory: AIChatMessage[];
  issueCreationPreview: IssuePreview;
  appSettings: AppSettings;
  // Full Log View State
  currentFullLogSource: { taskId: string, taskTitle: string, logs: LogEntry[] } | null;
}

export interface OnboardingFlowActions {
  navigateForward: () => void;
  navigateBackward: () => void;
  completeApiConfig: () => void;
  selectRepository: (repoName: string) => void;
  completeRepoDownload: () => void;
  updateGitHubAuth: (data: Partial<GitHubAuthData>) => void;
  updateApiConfig: (data: Partial<ApiConfigData>) => void;
  resetToSplash: () => void;

  viewTaskDetail: (taskId: string) => void;
  configureTask: (taskId: string) => void;
  saveTaskConfiguration: (config: TaskConfig) => void;
  cancelTaskConfiguration: () => void;
  closeTaskDetail: () => void;

  requestNewIssue: () => void;
  sendIssueChatMessage: (messageText: string) => void;
  saveIssue: (preview: IssuePreview) => void;
  cancelIssueCreation: () => void;

  requestSettings: () => void;
  saveAppSettings: (settings: AppSettings) => void;
  cancelSettings: () => void;
  resetSettingsToDefaults: () => void;

  // Full Log View Actions
  requestFullLog: (taskInfo: TaskInfoForLog, logs: LogEntry[]) => void;
  closeFullLog: () => void;
}

export function useOnboardingFlow(): OnboardingFlowState & OnboardingFlowActions {
  const [currentScreen, setCurrentScreen] = useState<OnboardingScreen>('splash');
  const [prerequisites] = useState<Prerequisite[]>(mockPrerequisites);
  const [githubAuth, setGitHubAuth] = useState<GitHubAuthData>(mockGitHubAuth);
  const [apiConfig, setApiConfig] = useState<ApiConfigData>(mockApiConfig);
  const [selectedRepoName, setSelectedRepoName] = useState<string | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [currentTaskConfiguration, setCurrentTaskConfiguration] = useState<TaskConfig | null>(null);
  const [issueCreationChatHistory, setIssueCreationChatHistory] = useState<AIChatMessage[]>(initialAIChatHistory);
  const [issueCreationPreview, setIssueCreationPreview] = useState<IssuePreview>(initialIssuePreview);
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings);
  // Full Log View State
  const [currentFullLogSource, setCurrentFullLogSource] = useState<{ taskId: string, taskTitle: string, logs: LogEntry[] } | null>(null);


  const canGoBack = currentScreen !== 'splash' && currentScreen !== 'taskDashboard';

  // Generic forward navigation, context is determined by currentScreen
  const navigateForward = useCallback(() => {
    switch (currentScreen) {
      case 'splash':
        setCurrentScreen('github-auth');
        break;
      case 'github-auth':
        setCurrentScreen('api-config');
        break;
      // Add other cases if navigateForward is used from other screens directly
      // For repo flow, specific handlers are used (selectRepository, completeRepoDownload)
      // which then set the screen.
    }
  }, [currentScreen]);

  const resetToSplash = useCallback(() => {
    setCurrentScreen('splash');
    // Reset other relevant states if necessary
    setGitHubAuth(mockGitHubAuth);
    setApiConfig(mockApiConfig);
    setSelectedRepoName(null);
  }, []);

  const navigateBackward = useCallback(() => {
    if (!canGoBack) return;
    
    switch (currentScreen) {
      case 'github-auth': setCurrentScreen('splash'); break;
      case 'api-config': setCurrentScreen('github-auth'); break;
      case 'repoSelection': setCurrentScreen('api-config'); break;
      case 'repoDownloading': setCurrentScreen('repoSelection'); break;
      case 'taskDetail': setCurrentScreen('taskDashboard'); break;
      case 'taskConfiguration': setCurrentScreen('taskDashboard'); break;
      case 'issueCreation': setCurrentScreen('taskDashboard'); break;
      case 'settings': setCurrentScreen('taskDashboard'); break;
      case 'fullLogView': setCurrentScreen('taskDetail'); break; // Added
    }
  }, [currentScreen, canGoBack]);

  const completeApiConfig = useCallback(() => {
    // Called when API config is done (saved or skipped)
    setCurrentScreen('repoSelection');
  }, []);

  const selectRepository = useCallback((repoName: string) => {
    setSelectedRepoName(repoName);
    setCurrentScreen('repoDownloading');
  }, []);

  const completeRepoDownload = useCallback(() => {
    setCurrentScreen('taskDashboard'); // Renamed
  }, []);

  // Task Management Action Implementations
  const viewTaskDetail = useCallback((taskId: string) => {
    setCurrentTaskId(taskId);
    // In a real app, you might fetch task details here if not already available
    setCurrentScreen('taskDetail');
  }, []);

  const configureTask = useCallback((taskId: string) => {
    setCurrentTaskId(taskId);
    // Load existing config or use default. For now, using mockTaskConfig.
    // In a real app, this might involve fetching config for the specific task.
    setCurrentTaskConfiguration(mockTaskConfig);
    setCurrentScreen('taskConfiguration');
  }, []);

  const saveTaskConfiguration = useCallback((config: TaskConfig) => {
    // Save the config (e.g., API call or update local store)
    console.log('Saving task configuration:', config, 'for task ID:', currentTaskId);
    setCurrentTaskConfiguration(config); // Keep the latest config
    // Decide where to navigate: back to dashboard or to detail view if starting task immediately
    setCurrentScreen('taskDashboard');
  }, [currentTaskId]);

  const cancelTaskConfiguration = useCallback(() => {
    // Potentially reset temp config changes if any
    setCurrentScreen('taskDashboard');
  }, []);

  const closeTaskDetail = useCallback(() => {
    setCurrentScreen('taskDashboard');
  }, []);

  // Issue Creation Action Implementations
  const requestNewIssue = useCallback(() => {
    setIssueCreationChatHistory(initialAIChatHistory); // Reset chat
    setIssueCreationPreview(initialIssuePreview);     // Reset preview
    setCurrentScreen('issueCreation');
  }, []);

  const sendIssueChatMessage = useCallback((messageText: string) => {
    const userMessage: AIChatMessage = { id: `user_${Date.now()}`, sender: 'user', text: messageText };
    // Simulate AI response and preview update
    const aiResponse: AIChatMessage = { id: `ai_${Date.now()}`, sender: 'ai', text: sampleAIResponse };

    setIssueCreationChatHistory(prev => [...prev, userMessage, aiResponse]);
    // In a real app, AI would generate this based on chat. Here, we just use a sample.
    setIssueCreationPreview(sampleUpdatedIssuePreview);
  }, []);

  const saveIssue = useCallback((preview: IssuePreview) => {
    // Simulate saving the issue (e.g., API call)
    console.log('Saving new issue:', preview);
    // Potentially add the new issue to a list if dashboard shows it immediately
    setCurrentScreen('taskDashboard');
  }, []);

  const cancelIssueCreation = useCallback(() => {
    setCurrentScreen('taskDashboard');
  }, []);

  // Settings Action Implementations
  const requestSettings = useCallback(() => {
    // Potentially load current settings from a persistent store here if not already in state
    setCurrentScreen('settings');
  }, []);

  const saveAppSettings = useCallback((newSettings: AppSettings) => {
    setAppSettings(newSettings);
    // Persist newSettings (e.g., to local storage or backend)
    console.log('Settings saved:', newSettings);
    setCurrentScreen('taskDashboard');
  }, []);

  const cancelSettings = useCallback(() => {
    // Optionally, revert any temporary changes if settings screen had its own dirty state
    // For now, just navigate back. The screen itself re-initializes from appSettings prop.
    setCurrentScreen('taskDashboard');
  }, []);

  const resetSettingsToDefaults = useCallback(() => {
    setAppSettings(defaultAppSettings);
    console.log('Settings reset to defaults.');
  }, []);

  // Full Log View Action Implementations
  const requestFullLog = useCallback((taskInfo: TaskInfoForLog, logs: LogEntry[]) => {
    setCurrentFullLogSource({ taskId: taskInfo.id, taskTitle: taskInfo.title, logs });
    setCurrentScreen('fullLogView');
  }, []);

  const closeFullLog = useCallback(() => {
    // currentFullLogSource is reset implicitly when navigating away or not used by other screens
    // No need to explicitly set it to null unless a screen depends on its null state.
    // Navigating back to taskDetail, which will use currentTaskId
    setCurrentScreen('taskDetail');
  }, []);

  const updateGitHubAuth = useCallback((data: Partial<GitHubAuthData>) => {
    setGitHubAuth(prev => ({ ...prev, ...data }));
  }, []);

  const updateApiConfig = useCallback((data: Partial<ApiConfigData>) => {
    setApiConfig(prev => ({ ...prev, ...data }));
  }, []);

  return {
    currentScreen,
    canGoBack,
    prerequisites,
    githubAuth,
    apiConfig,
    selectedRepoName,
    currentTaskId,
    currentTaskConfiguration,
    issueCreationChatHistory,
    issueCreationPreview,
    appSettings,
    currentFullLogSource, // Added
    navigateForward,
    navigateBackward,
    completeApiConfig,
    selectRepository,
    completeRepoDownload,
    updateGitHubAuth,
    updateApiConfig,
    resetToSplash,
    viewTaskDetail,
    configureTask,
    saveTaskConfiguration,
    cancelTaskConfiguration,
    closeTaskDetail,
    requestNewIssue,
    sendIssueChatMessage,
    saveIssue,
    cancelIssueCreation,
    requestSettings,
    saveAppSettings,
    cancelSettings,
    resetSettingsToDefaults,
    // Full Log View
    requestFullLog,
    closeFullLog,
  };
}