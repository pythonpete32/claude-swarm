import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { RecentProject, AvailableRepo } from './mocks/repo-data';

export interface RepoSelectionScreenProps {
  username: string;
  recentProjects: RecentProject[];
  availableRepos: AvailableRepo[];
  onSelectRepo: (repoIdentifier: string) => void;
  onBrowseAll: () => void;
  onSettings: () => void;
  onExit: () => void; // For Ctrl+C, though Ink handles Ctrl+C by default
}

const RepoSelectionScreen: React.FC<RepoSelectionScreenProps> = ({
  username,
  recentProjects,
  availableRepos,
  onSelectRepo,
  onBrowseAll,
  onSettings,
  onExit,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [activeIndex, setActiveIndex] = useState(0); // 0 for input, 1+ for recent, then available

  const allSelectableItems = [
    ...recentProjects.map(p => ({ type: 'recent' as const, ...p })),
    ...availableRepos.map(r => ({ type: 'available' as const, ...r })),
  ];

  const totalItems = allSelectableItems.length;

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      onExit();
      return;
    }
    if (input === 's' && !key.ctrl && !key.meta && !key.shift) { // Simple 's' for settings
      onSettings();
      return;
    }

    if (key.downArrow) {
      setActiveIndex((prev) => (prev < totalItems ? prev + 1 : 0)); // Cycle to input or next item
    } else if (key.upArrow) {
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : totalItems)); // Cycle to last item or input
    } else if (key.return) {
      if (activeIndex === 0 && inputValue.trim() !== '') { // Input field selected
        onSelectRepo(inputValue.trim());
      } else if (activeIndex > 0 && activeIndex <= totalItems) {
        const selectedItem = allSelectableItems[activeIndex - 1];
        if (selectedItem) {
          onSelectRepo(selectedItem.name);
        }
      }
    }
  });

  const renderProjectItem = (project: RecentProject, index: number, globalIndex: number) => (
    <Box key={project.id} flexDirection="row">
      <Text color={activeIndex === globalIndex + 1 ? "cyan" : "white"}>
        {activeIndex === globalIndex + 1 ? '›' : ' '} {globalIndex + 1}. {project.name.padEnd(30)}
      </Text>
      <Text dimColor>
        {project.activeTasks} active | {project.doneTasks} done | {project.lastActivity}
      </Text>
    </Box>
  );

  const renderRepoItem = (repo: AvailableRepo, index: number, globalIndex: number) => (
    <Box key={repo.id} flexDirection="row">
      <Text color={activeIndex === globalIndex + 1 ? "cyan" : "white"}>
       {activeIndex === globalIndex + 1 ? '›' : ' '} {globalIndex + 1}. {repo.name.padEnd(30)}
      </Text>
      <Text dimColor> {repo.openIssues} open issues</Text>
    </Box>
  );


  return (
    <Box flexDirection="column" padding={1} borderStyle="round">
      <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <Text bold color="blue">Select Repository</Text>
        <Text>user: {username}</Text>
        <Text>[s] Settings</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Recent Projects:</Text>
        {recentProjects.map((p, i) => renderProjectItem(p, i, i))}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Available on GitHub:</Text>
        {availableRepos.map((r, i) => renderRepoItem(r, i, recentProjects.length + i))}
      </Box>

      <Box marginBottom={1}>
        <Text
            color={activeIndex === recentProjects.length + availableRepos.length + 1 ? "cyan" : "white"}
            onPress={onBrowseAll} // Ink doesn't have onPress for Text, this is conceptual
        >
            {activeIndex === recentProjects.length + availableRepos.length + 1 ? '›' : ' '}
            {recentProjects.length + availableRepos.length + 1}. Browse all repositories...
        </Text>
      </Box>

      <Box flexDirection="row" alignItems="center">
        <Text color={activeIndex === 0 ? "cyan" : "white"}>{activeIndex === 0 ? '›' : '  '}</Text>
        <TextInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={() => { if (inputValue.trim()) onSelectRepo(inputValue.trim());}}
          placeholder="Type number or repository name..."
          focus={activeIndex === 0}
        />
      </Box>

      <Box marginTop={1} justifyContent="center">
        <Text dimColor>Type number or repository name. [Enter] to select. [Ctrl+C] to exit.</Text>
      </Box>
    </Box>
  );
};

export default RepoSelectionScreen;
