import React from 'react';
import { Box, Text, useInput } from 'ink';

export interface TaskConfigProps {
  onBack: () => void;
}

export default function TaskConfigScreen({ onBack }: TaskConfigProps): JSX.Element {
  useInput((input, key) => {
    if (key.escape) onBack();
  });

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="blue" height="100%">
      <Box justifyContent="center" paddingY={1}>
        <Text bold color="blue">Configure Task</Text>
      </Box>
      <Box flexGrow={1} paddingX={2}>
        <Text>Model: [claude-3-5-sonnet ▼]</Text>
        <Text>Custom Instructions...</Text>
      </Box>
      <Box borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} paddingX={2} paddingY={1}>
        <Text dimColor>[Esc] Back</Text>
      </Box>
    </Box>
  );
}
