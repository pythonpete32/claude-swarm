import React from 'react';
import { render, fireEvent, act } from 'ink-testing-library';
import OnboardingApp, { OnboardingAppProps } from './onboarding-app';
import { mockPrerequisites, mockGitHubAuth, mockApiConfig } from './mocks/onboarding-data';
import { mockUsername, mockRecentProjects, mockAvailableRepos, mockProgressSteps, MOCK_SELECTED_REPO_NAME } from '../tui/repository/mocks/repo-data';
import { mockRepoInfo, mockActiveAgents, mockIssues, mockTaskDetails, mockTaskConfig, mockAvailableModels } from '../tui/tasks/mocks/task-data';
import { initialAIChatHistory, initialIssuePreview } from '../tui/issues/mocks/issue-creation-data';
import { defaultAppSettings, mockAvailableModels as settingsModels, mockAvailableEditors, mockAvailableApiProviders } from '../tui/settings/mocks/settings-data';
import { mockTaskInfoForLog, mockLogEntries } from '../tui/logs/mocks/log-data';


// Mock the useApp hook from Ink
const mockExitFn = jest.fn();
jest.mock('ink', () => ({
  ...jest.requireActual('ink'),
  useApp: () => ({ exit: mockExitFn }),
}));

// --- Mock screen components ---
jest.mock('./screens/splash-screen', () => ({
  __esModule: true,
  default: jest.fn(({ onContinue, onQuit }) => (
    <div data-testid="splash-screen">
      <button data-testid="splash-continue" onClick={onContinue}>Continue</button>
      <button data-testid="splash-quit" onClick={onQuit}>Quit</button>
    </div>
  )),
}));

jest.mock('./screens/github-auth-screen', () => ({
  __esModule: true,
  default: jest.fn(({ onSuccess, onBack }) => (
    <div data-testid="github-auth-screen">
      <button data-testid="gh-success" onClick={onSuccess}>Auth Success</button>
      <button data-testid="gh-back" onClick={onBack}>Auth Back</button>
    </div>
  )),
}));

jest.mock('./screens/api-config-screen', () => ({
  __esModule: true,
  default: jest.fn(({ onComplete, onBack }) => (
    <div data-testid="api-config-screen">
      <button data-testid="api-complete" onClick={onComplete}>Config Complete</button>
      <button data-testid="api-back" onClick={onBack}>Config Back</button>
    </div>
  )),
}));

jest.mock('../tui/repository/repo-selection-screen', () => ({
  __esModule: true,
  default: jest.fn(({ onSelectRepo }) => (
    <div data-testid="repo-selection-screen">
      <button data-testid="repo-select" onClick={() => onSelectRepo(MOCK_SELECTED_REPO_NAME)}>Select Repo</button>
    </div>
  )),
}));

jest.mock('../tui/repository/repo-downloading-screen', () => ({
  __esModule: true,
  default: jest.fn(({ onComplete }) => (
    <div data-testid="repo-downloading-screen">
      <button data-testid="download-complete" onClick={onComplete}>Download Complete</button>
    </div>
  )),
}));

jest.mock('../tui/tasks/task-dashboard-screen', () => ({
  __esModule: true,
  default: jest.fn(({ onSelectItem, onConfigureTask, onNewIssue, onGoToSettings }) => (
    <div data-testid="task-dashboard-screen">
      <span>TaskDashboardScreen</span>
      <button data-testid="dashboard-select-issue" onClick={() => onSelectItem(mockIssues[0].id, 'issue')}>Select Issue</button>
      <button data-testid="dashboard-configure-issue" onClick={() => onConfigureTask(mockIssues[1].id)}>Configure Issue</button>
      <button data-testid="dashboard-new-issue" onClick={onNewIssue}>New Issue</button>
      <button data-testid="dashboard-goto-settings" onClick={onGoToSettings}>Go to Settings</button>
    </div>
  )),
}));

jest.mock('../tui/tasks/task-detail-screen', () => ({
  __esModule: true,
  default: jest.fn(({ taskDetails, onGoToDashboard, onGoToFullLog }) => (
    <div data-testid="task-detail-screen">
      <span>TaskDetailScreen</span>
      <span data-testid="detail-issue-number">{taskDetails.issueNumber}</span>
      <button data-testid="detail-back-to-dashboard" onClick={onGoToDashboard}>Back to Dashboard</button>
      <button data-testid="detail-goto-full-log" onClick={onGoToFullLog}>Go to Full Log</button>
    </div>
  )),
}));

jest.mock('../tui/tasks/task-config-screen', () => ({
  __esModule: true,
  default: jest.fn(({ initialConfig, onStartTask, onCancel }) => (
    <div data-testid="task-config-screen">
      <span>TaskConfigScreen</span>
      <span data-testid="config-model-name">{initialConfig.model}</span>
      <button data-testid="config-start-task" onClick={() => onStartTask(initialConfig)}>Start Task</button>
      <button data-testid="config-cancel" onClick={onCancel}>Cancel Config</button>
    </div>
  )),
}));

jest.mock('../tui/issues/issue-creation-screen', () => ({
  __esModule: true,
  default: jest.fn(({ chatHistory, currentIssuePreview, onSendMessage, onSaveIssue, onNavigateBack }) => (
    <div data-testid="issue-creation-screen">
      <span>IssueCreationScreen</span>
      <span data-testid="issue-chat-history">{JSON.stringify(chatHistory)}</span>
      <span data-testid="issue-preview-title">{currentIssuePreview.title}</span>
      <button data-testid="issue-send-message" onClick={onSendMessage}>Send Message</button>
      <button data-testid="issue-save" onClick={() => onSaveIssue(currentIssuePreview)}>Save Issue</button>
      <button data-testid="issue-cancel" onClick={onNavigateBack}>Cancel Creation</button>
    </div>
  )),
}));

jest.mock('../tui/settings/settings-screen', () => ({
    __esModule: true,
    default: jest.fn(({ initialSettings, onSaveSettings, onCancel, onResetToDefaults }) => (
      <div data-testid="settings-screen">
        <span>SettingsScreen</span>
        <span data-testid="settings-default-model">{initialSettings.agent.defaultModel}</span>
        <button data-testid="settings-save" onClick={() => onSaveSettings(initialSettings)}>Save Settings</button>
        <button data-testid="settings-cancel" onClick={onCancel}>Cancel Settings</button>
        <button data-testid="settings-reset" onClick={onResetToDefaults}>Reset Settings</button>
      </div>
    )),
}));

jest.mock('../tui/logs/full-log-view-screen', () => ({
    __esModule: true,
    default: jest.fn(({ taskInfo, logEntries, onBack }) => (
      <div data-testid="full-log-view-screen">
        <span>FullLogViewScreen</span>
        <span data-testid="log-task-id">{taskInfo.id}</span>
        <span data-testid="log-entry-count">{logEntries.length}</span>
        <button data-testid="log-back" onClick={onBack}>Back from Log</button>
      </div>
    )),
}));


jest.useFakeTimers();

describe('OnboardingApp', () => {
  let props: OnboardingAppProps;
  const navigateToDashboard = (getByTestId: Function) => {
    fireEvent.click(getByTestId('splash-continue'));
    fireEvent.click(getByTestId('gh-success'));
    fireEvent.click(getByTestId('api-complete'));
    fireEvent.click(getByTestId('repo-select'));
    act(() => { jest.advanceTimersByTime(mockProgressSteps.length * 1000 + 2000); });
    fireEvent.click(getByTestId('download-complete'));
  };

  const navigateToTaskDetail = (getByTestId: Function) => {
    navigateToDashboard(getByTestId);
    fireEvent.click(getByTestId('dashboard-select-issue'));
  };

  const navigateToTaskConfig = (getByTestId: Function) => {
    navigateToDashboard(getByTestId);
    fireEvent.click(getByTestId('dashboard-configure-issue'));
  };

  const navigateToIssueCreation = (getByTestId: Function) => {
    navigateToDashboard(getByTestId);
    fireEvent.click(getByTestId('dashboard-new-issue'));
  };

  const navigateToSettings = (getByTestId: Function) => {
    navigateToDashboard(getByTestId);
    fireEvent.click(getByTestId('dashboard-goto-settings'));
  };

  const navigateToFullLogView = (getByTestId: Function) => {
    navigateToTaskDetail(getByTestId);
    fireEvent.click(getByTestId('detail-goto-full-log'));
  };


  beforeEach(() => {
    props = {
      onOnboardingComplete: jest.fn(),
    };
    mockExitFn.mockClear();
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  it('navigates through full onboarding flow to TaskDashboard', () => {
    const { getByTestId } = render(<OnboardingApp {...props} />);
    navigateToDashboard(getByTestId);
    expect(getByTestId('task-dashboard-screen')).toBeDefined();
    expect(props.onOnboardingComplete).toHaveBeenCalled();
  });

  it('navigates TaskDashboard -> TaskDetail', () => {
    const { getByTestId } = render(<OnboardingApp {...props} />);
    navigateToTaskDetail(getByTestId);
    expect(getByTestId('task-detail-screen')).toBeDefined();
    expect(getByTestId('detail-issue-number').textContent).toBe(mockIssues[0].number.toString());
  });

  it('navigates TaskDashboard -> TaskConfiguration', () => {
    const { getByTestId } = render(<OnboardingApp {...props} />);
    navigateToTaskConfig(getByTestId);
    expect(getByTestId('task-config-screen')).toBeDefined();
    expect(getByTestId('config-model-name').textContent).toBe(mockTaskConfig.model);
  });

  it('navigates TaskDetail -> TaskDashboard', () => {
    const { getByTestId } = render(<OnboardingApp {...props} />);
    navigateToTaskDetail(getByTestId);
    fireEvent.click(getByTestId('detail-back-to-dashboard'));
    expect(getByTestId('task-dashboard-screen')).toBeDefined();
  });

  it('navigates TaskConfiguration -> TaskDashboard (on Cancel)', () => {
    const { getByTestId } = render(<OnboardingApp {...props} />);
    navigateToTaskConfig(getByTestId);
    fireEvent.click(getByTestId('config-cancel'));
    expect(getByTestId('task-dashboard-screen')).toBeDefined();
  });

  it('navigates TaskConfiguration -> TaskDashboard (on Start Task)', () => {
    const { getByTestId } = render(<OnboardingApp {...props} />);
    navigateToTaskConfig(getByTestId);
    fireEvent.click(getByTestId('config-start-task'));
    expect(getByTestId('task-dashboard-screen')).toBeDefined();
  });

  it('navigates TaskDashboard -> IssueCreation', () => {
    const { getByTestId } = render(<OnboardingApp {...props} />);
    navigateToIssueCreation(getByTestId);
    expect(getByTestId('issue-creation-screen')).toBeDefined();
    const issueCreationMock = require('../tui/issues/issue-creation-screen').default;
    expect(issueCreationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chatHistory: initialAIChatHistory,
        currentIssuePreview: initialIssuePreview,
      }), {}
    );
  });

  it('navigates IssueCreation -> TaskDashboard (on Save)', () => {
    const { getByTestId } = render(<OnboardingApp {...props} />);
    navigateToIssueCreation(getByTestId);
    fireEvent.click(getByTestId('issue-save'));
    expect(getByTestId('task-dashboard-screen')).toBeDefined();
  });

  it('navigates IssueCreation -> TaskDashboard (on Cancel)', () => {
    const { getByTestId } = render(<OnboardingApp {...props} />);
    navigateToIssueCreation(getByTestId);
    fireEvent.click(getByTestId('issue-cancel'));
    expect(getByTestId('task-dashboard-screen')).toBeDefined();
  });

  it('navigates TaskDashboard -> Settings', () => {
    const { getByTestId } = render(<OnboardingApp {...props} />);
    navigateToSettings(getByTestId);
    expect(getByTestId('settings-screen')).toBeDefined();
    const settingsScreenMock = require('../tui/settings/settings-screen').default;
    expect(settingsScreenMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialSettings: defaultAppSettings,
        availableModels: settingsModels,
      }), {}
    );
  });

  it('navigates Settings -> TaskDashboard (on Save)', () => {
    const { getByTestId } = render(<OnboardingApp {...props} />);
    navigateToSettings(getByTestId);
    fireEvent.click(getByTestId('settings-save'));
    expect(getByTestId('task-dashboard-screen')).toBeDefined();
  });

  it('navigates Settings -> TaskDashboard (on Cancel)', () => {
    const { getByTestId } = render(<OnboardingApp {...props} />);
    navigateToSettings(getByTestId);
    fireEvent.click(getByTestId('settings-cancel'));
    expect(getByTestId('task-dashboard-screen')).toBeDefined();
  });

  // --- Full Log View Navigation Tests ---
  it('navigates TaskDetail -> FullLogView', () => {
    const { getByTestId } = render(<OnboardingApp {...props} />);
    navigateToFullLogView(getByTestId);
    expect(getByTestId('full-log-view-screen')).toBeDefined();

    const fullLogViewMock = require('../tui/logs/full-log-view-screen').default;
    const expectedTaskId = mockIssues[0].id; // From navigateToTaskDetail -> dashboard-select-issue

    expect(fullLogViewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taskInfo: expect.objectContaining({ id: expectedTaskId }),
        logEntries: mockTaskDetails.logEntries, // As passed from app
      }), {}
    );
    expect(getByTestId('log-task-id').textContent).toBe(expectedTaskId);
    expect(getByTestId('log-entry-count').textContent).toBe(mockTaskDetails.logEntries.length.toString());
  });

  it('navigates FullLogView -> TaskDetail', () => {
    const { getByTestId } = render(<OnboardingApp {...props} />);
    navigateToFullLogView(getByTestId);
    expect(getByTestId('full-log-view-screen')).toBeDefined();

    fireEvent.click(getByTestId('log-back'));
    expect(getByTestId('task-detail-screen')).toBeDefined();
    // Ensure it's the correct task detail screen (e.g., by checking issue number again)
    expect(getByTestId('detail-issue-number').textContent).toBe(mockIssues[0].number.toString());
  });


  it('calls app.exit when SplashScreen quits', () => {
    const { getByTestId } = render(<OnboardingApp {...props} />);
    fireEvent.click(getByTestId('splash-quit'));
    expect(mockExitFn).toHaveBeenCalledTimes(1);
  });
});
