import React, { useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { ProgressStep } from './mocks/repo-data';

const PROGRESS_BAR_WIDTH = 30;

export interface RepoDownloadingScreenProps {
  repoName: string;
  progressPercentage: number; // 0-100
  progressSteps: ProgressStep[];
  onComplete: () => void; // Called when (mock) download/setup is finished
}

const getStepIndicator = (status: ProgressStep['status']) => {
  switch (status) {
    case 'pending':
      return <Text color="gray">○</Text>;
    case 'in_progress':
      return <Spinner type="dots" />;
    case 'done':
      return <Text color="green">✓</Text>;
    case 'error':
      return <Text color="red">✗</Text>;
    default:
      return <Text> </Text>;
  }
};

const RepoDownloadingScreen: React.FC<RepoDownloadingScreenProps> = ({
  repoName,
  progressPercentage,
  progressSteps,
  onComplete,
}) => {
  // Simulate completion when progress reaches 100%
  // In a real app, this would be triggered by actual download/setup events
  useEffect(() => {
    if (progressPercentage >= 100) {
      const timer = setTimeout(() => {
        onComplete();
      }, 500); // Short delay to allow user to see 100%
      return () => clearTimeout(timer);
    }
  }, [progressPercentage, onComplete]);

  const filledChars = Math.floor((progressPercentage / 100) * PROGRESS_BAR_WIDTH);
  const emptyChars = PROGRESS_BAR_WIDTH - filledChars;
  const progressBar = `[${'█'.repeat(filledChars)}${'-'.repeat(emptyChars)}]`;

  return (
    <Box flexDirection="column" padding={1} borderStyle="round">
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="blue">Setting up: {repoName}</Text>
      </Box>

      <Box flexDirection="column" alignItems="center" marginBottom={2}>
        <Text>Cloning repository...</Text>
        <Box flexDirection="row" alignItems="center">
          <Text>{progressBar} </Text>
          <Text>{progressPercentage.toFixed(0)}%</Text>
        </Box>
      </Box>

      <Box flexDirection="column" marginLeft={2} marginBottom={1}>
        {progressSteps.map((step) => (
          <Box key={step.id} flexDirection="row">
            {getStepIndicator(step.status)}{' '}
            <Text color={step.status === 'error' ? 'red' : 'white'}>{step.text}</Text>
          </Box>
        ))}
      </Box>

      <Box justifyContent="center" marginTop={1}>
        <Text dimColor>This may take a few moments...</Text>
      </Box>
    </Box>
  );
};

export default RepoDownloadingScreen;
