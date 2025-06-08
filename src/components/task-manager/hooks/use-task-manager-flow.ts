import { useState, useCallback } from 'react';
import type { Repository, Issue } from '../mocks/mock-data';

export type ManagerScreen =
  | 'repo-select'
  | 'download'
  | 'dashboard'
  | 'task-detail'
  | 'task-config'
  | 'settings'
  | 'logs';

export function useTaskManagerFlow() {
  const [screen, setScreen] = useState<ManagerScreen>('repo-select');
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [currentIssue, setCurrentIssue] = useState<Issue | null>(null);

  const toRepoSelect = useCallback(() => setScreen('repo-select'), []);
  const toDownload = useCallback((repo: Repository) => {
    setSelectedRepo(repo);
    setScreen('download');
  }, []);
  const toDashboard = useCallback(() => setScreen('dashboard'), []);
  const toSettings = useCallback(() => setScreen('settings'), []);
  const toTaskDetail = useCallback((issue: Issue) => {
    setCurrentIssue(issue);
    setScreen('task-detail');
  }, []);
  const toTaskConfig = useCallback(() => setScreen('task-config'), []);
  const toLogs = useCallback(() => setScreen('logs'), []);

  return {
    screen,
    selectedRepo,
    currentIssue,
    toRepoSelect,
    toDownload,
    toDashboard,
    toSettings,
    toTaskDetail,
    toTaskConfig,
    toLogs,
  };
}
