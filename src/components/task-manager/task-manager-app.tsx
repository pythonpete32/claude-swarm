import React from "react";
import { Box } from "ink";
import { useTaskManagerFlow } from "./hooks/use-task-manager-flow";
import {
  recentRepositories,
  githubRepositories,
  issues,
  logs,
} from "./mocks/mock-data";
import RepoSelectScreen from "./screens/repo-select-screen";
import DownloadScreen from "./screens/download-screen";
import DashboardScreen from "./screens/dashboard-screen";
import TaskDetailScreen from "./screens/task-detail-screen";
import TaskConfigScreen from "./screens/task-config-screen";
import SettingsScreen from "./screens/settings-screen";
import FullLogScreen from "./screens/full-log-screen";

export interface TaskManagerAppProps {
  onExit?: () => void;
}

export default function TaskManagerApp({
  onExit,
}: TaskManagerAppProps): JSX.Element {
  const flow = useTaskManagerFlow();

  const renderScreen = () => {
    switch (flow.screen) {
      case "repo-select":
        return (
          <RepoSelectScreen
            recent={recentRepositories}
            github={githubRepositories}
            onSelect={flow.toDownload}
            onExit={onExit}
          />
        );
      case "download":
        return flow.selectedRepo ? (
          <DownloadScreen
            repo={flow.selectedRepo}
            onComplete={flow.toDashboard}
          />
        ) : null;
      case "dashboard":
        return (
          <DashboardScreen
            issues={issues}
            onSelectIssue={flow.toTaskDetail}
            onSettings={flow.toSettings}
          />
        );
      case "task-detail":
        return flow.currentIssue ? (
          <TaskDetailScreen
            issue={flow.currentIssue}
            onBack={flow.toDashboard}
            onLogs={flow.toLogs}
          />
        ) : null;
      case "task-config":
        return <TaskConfigScreen onBack={flow.toDashboard} />;
      case "settings":
        return <SettingsScreen onBack={flow.toDashboard} />;
      case "logs":
        return flow.currentIssue ? (
          <FullLogScreen
            logs={logs}
            onBack={() => flow.toTaskDetail(flow.currentIssue!)}
          />
        ) : null;
      default:
        return null;
    }
  };

  return <Box height="100%">{renderScreen()}</Box>;
}
