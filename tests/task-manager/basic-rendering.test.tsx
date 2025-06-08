import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import stripAnsi from 'strip-ansi';

import RepoSelectScreen from '../../src/components/task-manager/screens/repo-select-screen.js';
import DownloadScreen from '../../src/components/task-manager/screens/download-screen.js';
import DashboardScreen from '../../src/components/task-manager/screens/dashboard-screen.js';
import TaskDetailScreen from '../../src/components/task-manager/screens/task-detail-screen.js';
import SettingsScreen from '../../src/components/task-manager/screens/settings-screen.js';
import TaskConfigScreen from '../../src/components/task-manager/screens/task-config-screen.js';
import FullLogScreen from '../../src/components/task-manager/screens/full-log-screen.js';
import { recentRepositories, githubRepositories, issues, logs } from '../../src/components/task-manager/mocks/mock-data.js';

describe('Task Manager Screens render', () => {
  it('RepoSelectScreen shows repositories', () => {
    const { lastFrame } = render(
      <RepoSelectScreen recent={recentRepositories} github={githubRepositories} onSelect={() => {}} />
    );
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Select Repository');
    expect(frame).toContain(recentRepositories[0].name);
  });

  it('DownloadScreen shows progress text', () => {
    const { lastFrame } = render(
      <DownloadScreen repo={recentRepositories[0]} onComplete={() => {}} />
    );
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Setting up');
  });

  it('DashboardScreen lists issues', () => {
    const { lastFrame } = render(
      <DashboardScreen issues={issues} onSelectIssue={() => {}} onSettings={() => {}} />
    );
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Task Dashboard');
    expect(frame).toContain(issues[0].title);
  });

  it('TaskDetailScreen displays issue info', () => {
    const { lastFrame } = render(
      <TaskDetailScreen issue={issues[0]} onBack={() => {}} onLogs={() => {}} />
    );
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Task Detail');
    expect(frame).toContain(issues[0].title);
  });

  it('SettingsScreen renders', () => {
    const { lastFrame } = render(<SettingsScreen onBack={() => {}} />);
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Settings');
  });

  it('TaskConfigScreen renders', () => {
    const { lastFrame } = render(<TaskConfigScreen onBack={() => {}} />);
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Configure Task');
  });

  it('FullLogScreen shows log lines', () => {
    const { lastFrame } = render(<FullLogScreen logs={logs} onBack={() => {}} />);
    const frame = stripAnsi(lastFrame() || '');
    expect(frame).toContain('Full Log');
    expect(frame).toContain(logs[0].message);
  });
});
