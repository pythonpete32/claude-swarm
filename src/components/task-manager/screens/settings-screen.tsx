import React from 'react';
import { Box, Text, useInput } from 'ink';

export interface SettingsProps {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: SettingsProps): JSX.Element {
  useInput((input, key) => {
    if (key.escape) onBack();
  });

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="blue" height="100%">
      <Box justifyContent="center" paddingY={1}>
        <Text bold color="blue">Settings</Text>
      </Box>
      <Box flexGrow={1} paddingX={2}>
        <Text>Default Model: claude-3-5-sonnet</Text>
        <Text>Preferred Editor: Cursor</Text>
      </Box>
      <Box borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} paddingX={2} paddingY={1}>
        <Text dimColor>[Esc] Back</Text>
      </Box>
    </Box>
  );
}
