import React from 'react';
import { Box, Text, useInput } from 'ink';
import { type Prerequisite } from '../mocks/onboarding-data';

export interface SplashScreenProps {
  onContinue: () => void;
  onQuit: () => void;
  prerequisites: Prerequisite[];
}

function PrerequisiteStatus({ prerequisite }: { prerequisite: Prerequisite }) {
  const getStatusIcon = (status: Prerequisite['status']) => {
    switch (status) {
      case 'installed':
        return { icon: '✓', color: 'green' as const };
      case 'not_found':
        return { icon: '✗', color: 'red' as const };
      case 'required':
        return { icon: '○', color: 'yellow' as const };
    }
  };

  const getStatusText = (status: Prerequisite['status']) => {
    switch (status) {
      case 'installed':
        return 'Installed';
      case 'not_found':
        return 'Not found';
      case 'required':
        return 'Required';
    }
  };

  const { icon, color } = getStatusIcon(prerequisite.status);
  const statusText = getStatusText(prerequisite.status);

  return (
    <Box justifyContent="space-between" width={40}>
      <Text>
        <Text color={color}>{icon}</Text> {prerequisite.name}
      </Text>
      <Text color={color}>{statusText}</Text>
    </Box>
  );
}

export default function SplashScreen({ onContinue, onQuit, prerequisites }: SplashScreenProps): JSX.Element {
  useInput((input, key) => {
    if (key.return) {
      onContinue();
    } else if (input === 'q' || key.escape) {
      onQuit();
    }
  });

  return (
    <Box flexDirection="column" height="100%" borderStyle="single" borderColor="blue">
      {/* Header */}
      <Box justifyContent="center" paddingY={1}>
        <Text bold color="blue">Agent Task Manager</Text>
      </Box>
      
      <Box justifyContent="center" paddingBottom={1}>
        <Text dimColor>Autonomous GitHub Issue Resolution</Text>
      </Box>
      
      <Box justifyContent="center" paddingBottom={2}>
        <Text dimColor>Powered by Claude Code</Text>
      </Box>

      {/* Main content area */}
      <Box flexGrow={1} paddingX={2}>
        <Box flexDirection="row" width="100%">
          {/* Left column - Welcome text */}
          <Box flexDirection="column" flexGrow={1} paddingRight={2}>
            <Text bold>Welcome! Let's get you started.</Text>
            <Text></Text>
            <Text>This tool orchestrates multiple</Text>
            <Text>AI agents to work on your GitHub</Text>
            <Text>issues autonomously.</Text>
            <Text></Text>
            <Text>• Agents work asynchronously</Text>
            <Text>• Auto-creates PRs</Text>
            <Text>• Manages review cycles</Text>
            <Text>• Tracks progress in real-time</Text>
            <Text></Text>
            <Text>Press <Text bold>[Enter]</Text> to begin setup...</Text>
          </Box>

          {/* Right column - Prerequisites */}
          <Box flexDirection="column" width={42}>
            <Text bold>Prerequisites Check:</Text>
            <Text></Text>
            
            {prerequisites.map((prerequisite, index) => (
              <Box key={index} marginBottom={index < prerequisites.length - 1 ? 1 : 0}>
                <PrerequisiteStatus prerequisite={prerequisite} />
              </Box>
            ))}

            <Text></Text>
            <Text bold color="yellow">Required Actions:</Text>
            <Text>1. Authenticate GitHub</Text>
            <Text>2. Configure API key for summaries</Text>
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} paddingX={2} paddingY={1}>
        <Text dimColor>[Enter] Continue  [q] Quit</Text>
      </Box>
    </Box>
  );
}