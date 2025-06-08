import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { RepoInfo, ActiveAgent, Issue } from './mocks/task-data';

export interface TaskDashboardScreenProps {
  repoInfo: RepoInfo;
  adHocTaskInput: string;
  activeAgents: ActiveAgent[];
  issues: Issue[];
  onAdHocInputChange: (value: string) => void;
  onAdHocSubmit: () => void;
  onSelectItem: (itemId: string, itemType: 'agent' | 'issue') => void; // For Enter key
  onSwitchTab: (tabId: 'issues' | 'running' | 'history') => void;
  onNewIssue: () => void; // Typically opens browser or another flow
  onConfigureTask: (issueId: string) => void;
  onRunTask: (issueId: string) => void;
  onGoToSettings: () => void;
  onGoToEditor: () => void;
  // For list navigation, we might need to manage focus internally or get active index from props
  // For simplicity, this example will use internal state for list focus.
}

type FocusableList = 'agents' | 'issues';
type FocusableElement = 'adhocInput' | FocusableList;

const TaskDashboardScreen: React.FC<TaskDashboardScreenProps> = ({
  repoInfo,
  adHocTaskInput,
  activeAgents,
  issues,
  onAdHocInputChange,
  onAdHocSubmit,
  onSelectItem,
  onSwitchTab,
  onNewIssue,
  onConfigureTask,
  onRunTask,
  onGoToSettings,
  onGoToEditor,
}) => {
  const [focusedElement, setFocusedElement] = useState<FocusableElement>('adhocInput');
  const [focusedIndex, setFocusedIndex] = useState<number>(0); // Index within the focused list

  const openIssuesCount = issues.filter(iss => iss.status === 'open' || iss.status === 'in_progress').length;
  const closedIssuesCount = issues.filter(iss => iss.status === 'closed').length;

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      // Default Ink exit behavior, or call a prop if specific handling needed
      return;
    }
    if (input === 'e') { onGoToEditor(); return; }
    if (input === 's') { onGoToSettings(); return; }
    if (input === 'n') { onNewIssue(); return; }
    if (input === 'i') { onSwitchTab('issues'); setFocusedElement('issues'); setFocusedIndex(0); return; }
    if (input === 'r') { onSwitchTab('running'); setFocusedElement('agents'); setFocusedIndex(0); return; }
    // Add 'h' for history if implemented

    if (focusedElement === 'adhocInput') {
      if (key.return) {
        onAdHocSubmit();
      } else if (key.downArrow) {
        setFocusedElement(repoInfo.currentTab === 'running' ? 'agents' : 'issues');
        setFocusedIndex(0);
      }
    } else { // Focus is on a list
      const currentList = focusedElement === 'agents' ? activeAgents : issues;
      if (key.upArrow) {
        const newIndex = focusedIndex > 0 ? focusedIndex - 1 : 0;
        if (newIndex === 0 && focusedIndex === 0) { // Navigate from top of list to adhocInput
            setFocusedElement('adhocInput');
        } else {
            setFocusedIndex(newIndex);
        }
      } else if (key.downArrow) {
        setFocusedIndex((prev) => (prev < currentList.length - 1 ? prev + 1 : prev));
      } else if (key.return && currentList[focusedIndex]) {
        const item = currentList[focusedIndex];
        onSelectItem(item.id, focusedElement === 'agents' ? 'agent' : 'issue');
      } else if (input === 'c' && focusedElement === 'issues' && currentList[focusedIndex]) {
        onConfigureTask(currentList[focusedIndex].id);
      } else if (input === 'x' && focusedElement === 'issues' && currentList[focusedIndex]) { // 'x' for eXecute
        onRunTask(currentList[focusedIndex].id);
      }
    }
  });

  const renderTabs = () => (
    <Box>
      <Text color={repoInfo.currentTab === 'issues' ? 'cyan' : 'white'} bold={repoInfo.currentTab === 'issues'}>
        [i] Issues{' '}
      </Text>
      <Text color={repoInfo.currentTab === 'running' ? 'cyan' : 'white'} bold={repoInfo.currentTab === 'running'}>
        [r] Running Agents{' '}
      </Text>
      {/* <Text color={repoInfo.currentTab === 'history' ? 'cyan' : 'white'}>[h] History</Text> */}
    </Box>
  );

  return (
    <Box flexDirection="column" padding={1} borderStyle="single" width="100%">
      {/* Header */}
      <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <Box>
          <Text bold color="blue">{repoInfo.name}</Text>
          <Text> ({repoInfo.currentBranch})</Text>
        </Box>
        {renderTabs()}
        <Box>
          <Text>[e] Editor / </Text>
          <Text>[s] Settings</Text>
        </Box>
      </Box>

      {/* Ad-hoc Task */}
      <Box flexDirection="row" alignItems="center" marginBottom={1}>
        <Text bold color={focusedElement === 'adhocInput' ? 'cyan' : 'white'}>
          {focusedElement === 'adhocInput' ? '›' : ' '} Ad-hoc Task:{' '}
        </Text>
        <TextInput
          value={adHocTaskInput}
          onChange={onAdHocInputChange}
          onSubmit={onAdHocSubmit}
          placeholder="Type a command and press Enter..."
          focus={focusedElement === 'adhocInput'}
        />
        {/* <Button onPress={onAdHocSubmit}>Run</Button> */}
      </Box>

      {/* Main Content Area - Switches based on tab */}
      {repoInfo.currentTab === 'running' && (
        <Box flexDirection="column" borderStyle="round" paddingX={1} flexGrow={1}>
          <Text bold>Active Agents ({activeAgents.length})</Text>
          {activeAgents.map((agent, index) => (
            <Box key={agent.id} flexDirection="row" justifyContent="space-between">
              <Text color={focusedElement === 'agents' && focusedIndex === index ? 'cyan' : 'white'}>
                {focusedElement === 'agents' && focusedIndex === index ? '›' : ' '} #{agent.issueNumber}: {agent.issueTitle.substring(0, 40)}...
              </Text>
              <Text>({agent.runtime}) {agent.statusSummary.substring(0,50)}...</Text>
            </Box>
          ))}
          {activeAgents.length === 0 && <Text dimColor>No agents currently running.</Text>}
        </Box>
      )}

      {repoInfo.currentTab === 'issues' && (
        <Box flexDirection="column" borderStyle="round" paddingX={1} flexGrow={1}>
          <Box flexDirection="row" justifyContent="space-between">
            <Text bold>Issues ({openIssuesCount} Open / {closedIssuesCount} Closed)</Text>
            <Text>[n] New Issue</Text>
          </Box>
          {issues.filter(iss => iss.status !== 'closed').map((issue, index) => ( // Show open/in_progress issues
            <Box key={issue.id} flexDirection="row" justifyContent="space-between">
              <Text color={focusedElement === 'issues' && focusedIndex === index ? 'cyan' : 'white'}>
                {focusedElement === 'issues' && focusedIndex === index ? '›' : ' '} #{issue.number} {issue.title.substring(0,50)}
                {issue.labels.map(l => ` [${l.name}]`)}
              </Text>
              <Text dimColor>by {issue.author}, {issue.date}</Text>
            </Box>
          ))}
           {issues.filter(iss => iss.status !== 'closed').length === 0 && <Text dimColor>No open issues.</Text>}
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={1} justifyContent="space-between">
        <Text dimColor>[↑↓] Navigate Lists [Tab] Switch Section (Not Implemented)</Text>
        <Text dimColor>
          {focusedElement === 'issues' ? "[Enter] View [c] Configure [x] Run Task" : "[Enter] View Details"}
        </Text>
      </Box>
    </Box>
  );
};

export default TaskDashboardScreen;
