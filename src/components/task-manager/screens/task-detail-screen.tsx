import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { Issue } from '../mocks/mock-data';

export interface TaskDetailProps {
  issue: Issue;
  onBack: () => void;
  onLogs: () => void;
}

export default function TaskDetailScreen({ issue, onBack, onLogs }: TaskDetailProps): JSX.Element {
  useInput((input, key) => {
    if (key.escape) onBack();
    if (input === 'l') onLogs();
  });

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="blue" height="100%">
      <Box justifyContent="center" paddingY={1}>
        <Text bold color="blue">Task Detail - #{issue.id}</Text>
      </Box>
      <Box flexGrow={1} paddingX={2}>
        <Text>{issue.title}</Text>
      </Box>
      <Box borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} paddingX={2} paddingY={1}>
        <Text dimColor>[l] View Logs  [Esc] Back</Text>
      </Box>
    </Box>
  );
}
