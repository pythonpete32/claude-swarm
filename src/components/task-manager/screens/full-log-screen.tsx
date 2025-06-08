import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { LogLine } from '../mocks/mock-data';

export interface LogScreenProps {
  logs: LogLine[];
  onBack: () => void;
}

export default function FullLogScreen({ logs, onBack }: LogScreenProps): JSX.Element {
  useInput((input, key) => {
    if (key.escape) onBack();
  });

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="blue" height="100%">
      <Box justifyContent="center" paddingY={1}>
        <Text bold color="blue">Full Log</Text>
      </Box>
      <Box flexDirection="column" paddingX={2} flexGrow={1}>
        {logs.map((l, i) => (
          <Text key={i}>{`[${l.time}] ${l.message}`}</Text>
        ))}
      </Box>
      <Box borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} paddingX={2} paddingY={1}>
        <Text dimColor>[Esc] Back</Text>
      </Box>
    </Box>
  );
}
