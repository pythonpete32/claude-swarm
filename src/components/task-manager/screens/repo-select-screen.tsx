import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Repository } from '../mocks/mock-data';

export interface RepoSelectProps {
  recent: Repository[];
  github: Repository[];
  onSelect: (repo: Repository) => void;
  onExit?: () => void;
}

export default function RepoSelectScreen({
  recent,
  github,
  onSelect,
  onExit,
}: RepoSelectProps): JSX.Element {
  const [index, setIndex] = useState(0);
  const all = [...recent, ...github];

  useInput((input, key) => {
    if (key.downArrow) setIndex((i) => Math.min(i + 1, all.length - 1));
    if (key.upArrow) setIndex((i) => Math.max(i - 1, 0));
    if (key.return) onSelect(all[index]);
    if (key.escape) onExit?.();
  });

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="blue" height="100%">
      <Box justifyContent="center" paddingY={1}>
        <Text bold color="blue">Select Repository</Text>
      </Box>
      <Box flexDirection="column" paddingX={2} flexGrow={1}>
        {all.map((r, i) => (
          <Text key={r.name} color={i === index ? 'cyan' : undefined}>
            {i === index ? '› ' : '  '}
            {r.name}
          </Text>
        ))}
      </Box>
      <Box borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} paddingX={2} paddingY={1}>
        <Text dimColor>[Enter] Select  [Esc] Back</Text>
      </Box>
    </Box>
  );
}
