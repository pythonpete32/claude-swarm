import React from 'react';
import { Box, Text, useApp } from 'ink';
import { useOnboardingFlow } from './hooks/use-onboarding-flow';

// Onboarding screens
import SplashScreen from './screens/splash-screen';
import GitHubAuthScreen from './screens/github-auth-screen';
import ApiConfigScreen from './screens/api-config-screen';

// Repository management screens
import RepoSelectionScreen from '../tui/repository/repo-selection-screen';
import RepoDownloadingScreen from '../tui/repository/repo-downloading-screen';

// Task management screens
import TaskDashboardScreen from '../tui/tasks/task-dashboard-screen';
import TaskDetailScreen from '../tui/tasks/task-detail-screen';
import TaskConfigScreen from '../tui/tasks/task-config-screen';

// Mock data
import {
  mockRecentProjects,
  mockAvailableRepos,
  mockUsername,
  mockProgressSteps,
  MOCK_SELECTED_REPO_NAME
} from '../tui/repository/mocks/repo-data';

import {
  mockRepoInfo,
  mockActiveAgents,
  mockIssues,
  mockTaskDetails, // For TaskDetailScreen, will need to be dynamic based on currentTaskId
  mockTaskConfig,  // For TaskConfigScreen, will be from currentTaskConfiguration from hook
  mockAvailableModels,
  // mockAdHocTaskInput is managed internally by TaskDashboardScreen or passed via hook if needed
} from '../tui/tasks/mocks/task-data';
import {
  initialAIChatHistory, // Used by useOnboardingFlow now
  initialIssuePreview,  // Used by useOnboardingFlow now
  // AIChatMessage, IssuePreview are types used by the screen and hook
} from '../tui/issues/mocks/issue-creation-data';
import IssueCreationScreen from '../tui/issues/issue-creation-screen';
import SettingsScreen from '../tui/settings/settings-screen';
import {
    defaultAppSettings, // Used by hook, but good to have available for props if needed
    mockAvailableModels as settingsModels,
    mockAvailableEditors,
    mockAvailableApiProviders
} from '../tui/settings/mocks/settings-data';
import FullLogViewScreen from '../tui/logs/full-log-view-screen';
import { mockLogEntries, mockTaskInfoForLog } from '../tui/logs/mocks/log-data'; // For FullLogView


export interface OnboardingAppProps {
  onOnboardingComplete?: () => void; // Renamed to be more specific if this app only handles onboarding
}

export default function OnboardingApp({ onOnboardingComplete }: OnboardingAppProps): JSX.Element {
  const app = useApp();
  const {
    currentScreen,
    prerequisites,
    githubAuth,
    apiConfig,
    selectedRepoName,
    currentTaskId,
    currentTaskConfiguration,
    // Issue Creation state from hook
    issueCreationChatHistory,
    issueCreationPreview,
    // Settings state from hook
    appSettings,
    // Full Log View state from hook
    currentFullLogSource,
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
    // Full Log View actions from hook
    requestFullLog,
    closeFullLog,
  } = useOnboardingFlow();

  // This handler is for when the entire multi-stage flow (including repo & reaching dashboard) is done.
  const handleEntireFlowComplete = () => {
    console.log("Setup complete. Reached Task Dashboard.");
    onOnboardingComplete?.();
  };

  const handleExitApp = () => {
    app.exit();
  };

  // Placeholder for settings action
  const handleSettings = () => {
    console.log("Settings action triggered.");
    // Potentially navigate to a settings screen or show an overlay
    // For now, could use resetToSplash as a temporary measure if needed.
    // resetToSplash();
  };

  // Mock progress for downloading screen
  // In a real app, this would be dynamic based on actual download progress
  // State for AdHoc Task input on Dashboard
  const [adHocTaskInput, setAdHocTaskInput] = React.useState('');
  // State for message input on TaskDetailScreen
  const [detailMessageInput, setDetailMessageInput] = React.useState('');
  // State for user input in IssueCreationScreen
  const [issueCreateUserInput, setIssueCreateUserInput] = React.useState('');

  // Mock progress for downloading screen
  const [downloadProgress, setDownloadProgress] = React.useState(0);
  const [currentProgressSteps, setCurrentProgressSteps] = React.useState(mockProgressSteps);

  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (currentScreen === 'repoDownloading') {
      setDownloadProgress(0);
      setCurrentProgressSteps(mockProgressSteps.map(s => ({...s, status: 'pending'})));
      const stepDuration = 1000;
      timer = setInterval(() => {
        setDownloadProgress(prev => {
          const newProgress = prev + (100 / (mockProgressSteps.length +1) );
          if (newProgress >= 100) {
            clearInterval(timer);
            return 100;
          }
          return newProgress;
        });
        setCurrentProgressSteps(prevSteps => {
            const currentInProgressIndex = prevSteps.findIndex(s => s.status === 'in_progress');
            const nextPendingIndex = prevSteps.findIndex(s => s.status === 'pending');
            return prevSteps.map((step, index) => {
                if (step.status === 'in_progress') return {...step, status: 'done'};
                if (index === nextPendingIndex && (currentInProgressIndex === -1 || index > currentInProgressIndex)) {
                    return {...step, status: 'in_progress', text: step.text.replace(/\(.*\)/, `(${Math.min(99, Math.floor(downloadProgress))}%)`)};
                }
                return step;
            });
        });
      }, stepDuration);
    }
    return () => clearInterval(timer);
  }, [currentScreen, downloadProgress]); // Added downloadProgress to dependencies to ensure text update on steps

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'splash':
        return (
          <SplashScreen 
            prerequisites={prerequisites}
            onContinue={navigateForward} 
            onQuit={handleExitApp}
          />
        );
      case 'github-auth':
        return (
          <GitHubAuthScreen 
            authData={githubAuth}
            onSuccess={navigateForward} 
            onBack={navigateBackward}
            onUpdateAuth={updateGitHubAuth}
          />
        );
      case 'api-config':
        return (
          <ApiConfigScreen 
            apiConfig={apiConfig}
            onComplete={completeApiConfig} // Now specifically for API config step
            onBack={navigateBackward}
            onUpdateConfig={updateApiConfig}
          />
        );
      case 'repoSelection':
        return (
          <RepoSelectionScreen
            username={mockUsername}
            recentProjects={mockRecentProjects}
            availableRepos={mockAvailableRepos}
            onSelectRepo={selectRepository}
            onBrowseAll={() => console.log("Browse All triggered")} // Placeholder
            onSettings={handleSettings}
            onExit={handleExitApp}
          />
        );
      case 'repoDownloading':
        return (
          <RepoDownloadingScreen
            repoName={selectedRepoName || MOCK_SELECTED_REPO_NAME } // Fallback, though selectedRepoName should be set
            progressPercentage={downloadProgress}
            progressSteps={currentProgressSteps}
            onComplete={completeRepoDownload}
          />
        );
      case 'taskDashboard':
        handleEntireFlowComplete(); // Marks the end of this extended setup flow
        return (
          <TaskDashboardScreen
            repoInfo={mockRepoInfo} // Assuming mockRepoInfo is appropriate
            adHocTaskInput={adHocTaskInput}
            activeAgents={mockActiveAgents}
            issues={mockIssues}
            onAdHocInputChange={setAdHocTaskInput}
            onAdHocSubmit={() => console.log('Ad-hoc submit:', adHocTaskInput)}
            onSelectItem={(itemId, itemType) => {
              if (itemType === 'issue') viewTaskDetail(itemId);
              else if (itemType === 'agent') viewTaskDetail(itemId);
            }}
            onSwitchTab={(tabId) => mockRepoInfo.currentTab = tabId}
            onNewIssue={requestNewIssue}
            onConfigureTask={(issueId) => configureTask(issueId)}
            onRunTask={(issueId) => console.log('Run task:', issueId)}
            onGoToSettings={requestSettings}
            onGoToEditor={() => console.log('Go to Editor action')}
          />
        );
      case 'taskDetail':
        const taskToView = mockIssues.find(iss => iss.id === currentTaskId);
        const currentTaskTitle = taskToView?.title || "Unknown Task";
        // For logs, using mockTaskDetails.logEntries for now. A real app might fetch specific logs.
        const detailsForScreen = {
            ...mockTaskDetails,
            issueNumber: taskToView?.number || (currentTaskId ? parseInt(currentTaskId, 10) : 0),
            issueTitle: currentTaskTitle
        };
        return (
          <TaskDetailScreen
            taskDetails={detailsForScreen}
            messageInput={detailMessageInput}
            onMessageInputChange={setDetailMessageInput}
            onSendMessage={() => { console.log('Send message:', detailMessageInput); setDetailMessageInput(''); }}
            onGoToDashboard={closeTaskDetail}
            onStopTask={() => console.log('Stop task:', currentTaskId)}
            onGoToFullLog={() => {
              if (currentTaskId) {
                // Pass the actual logs for the task, for now using the generic mockTaskDetails logs
                // In a real app, these logs would be specific to currentTaskId
                const taskInfo: TaskInfoForLog = {id: currentTaskId, title: currentTaskTitle };
                requestFullLog(taskInfo, mockTaskDetails.logEntries);
              }
            }}
          />
        );
      case 'taskConfiguration':
        const taskToConfigure = mockIssues.find(iss => iss.id === currentTaskId);
        return (
          <TaskConfigScreen
            initialConfig={currentTaskConfiguration || mockTaskConfig} // Use from hook state or fallback
            issueTitle={taskToConfigure?.title || "Unknown Task"}
            issueNumber={taskToConfigure?.number || 0}
            availableModels={mockAvailableModels}
            onStartTask={(config) => {
              saveTaskConfiguration(config);
              // Optionally, navigate to task detail or directly run
            }}
            onCancel={cancelTaskConfiguration}
            onSaveAsDefault={(config) => console.log('Save as default:', config)}
          />
        );
      case 'issueCreation':
        return (
          <IssueCreationScreen
            chatHistory={issueCreationChatHistory}
            currentIssuePreview={issueCreationPreview}
            currentUserInput={issueCreateUserInput}
            onUserInputChange={setIssueCreateUserInput}
            onSendMessage={() => {
              sendIssueChatMessage(issueCreateUserInput);
              setIssueCreateUserInput(''); // Clear input after sending
            }}
            onSaveIssue={() => saveIssue(issueCreationPreview)}
            onNavigateBack={cancelIssueCreation}
          />
        );
      case 'settings':
        return (
          <SettingsScreen
            initialSettings={appSettings}
            availableModels={settingsModels}
            availableEditors={mockAvailableEditors}
            availableApiProviders={mockAvailableApiProviders}
            onSaveSettings={saveAppSettings}
            onCancel={cancelSettings}
            onResetToDefaults={resetSettingsToDefaults}
          />
        );
      case 'fullLogView':
        if (!currentFullLogSource) {
            // This case should ideally not be reached if navigation is correct.
            // Navigate back to dashboard or detail if source is missing.
            // For now, just render an error or a loading state.
            setTimeout(closeFullLog, 0); // Attempt to navigate back
            return <Box><Text color="red">Error: Log source missing. Navigating back...</Text></Box>;
        }
        return (
          <FullLogViewScreen
            taskInfo={{id: currentFullLogSource.taskId, title: currentFullLogSource.taskTitle}}
            logEntries={currentFullLogSource.logs}
            onBack={closeFullLog}
            // Other props like initial filters can be added if managed by hook
          />
        );
      default:
        return <Box><Text color="red">Invalid screen state: {currentScreen}</Text></Box>;
    }
  };

  return (
    <Box flexDirection="column" height="100%">
      {renderCurrentScreen()}
    </Box>
  );
}