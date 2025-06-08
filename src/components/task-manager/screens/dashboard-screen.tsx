import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Issue } from '../mocks/mock-data';

export interface DashboardProps {
  issues: Issue[];
  onSelectIssue: (issue: Issue) => void;
  onSettings: () => void;
}

export default function DashboardScreen({ issues, onSelectIssue, onSettings }: DashboardProps): JSX.Element {
  const [index, setIndex] = useState(0);

  useInput((input, key) => {
    if (key.downArrow) setIndex((i) => Math.min(i + 1, issues.length - 1));
    if (key.upArrow) setIndex((i) => Math.max(i - 1, 0));
    if (key.return) onSelectIssue(issues[index]);
    if (input === 's') onSettings();
  });

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="blue" height="100%">
      <Box justifyContent="space-between" paddingX={2} paddingY={1}>
        <Text bold color="blue">Task Dashboard</Text>
        <Text>[s] Settings</Text>
      </Box>
      <Box flexDirection="column" paddingX={2} flexGrow={1}>
        {issues.map((iss, i) => (
          <Text key={iss.id} color={i === index ? 'cyan' : undefined}>
            {i === index ? '› ' : '  '}
            #{iss.id} {iss.title}
          </Text>
        ))}
      </Box>
      <Box borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} paddingX={2} paddingY={1}>
        <Text dimColor>[Enter] View Issue  [s] Settings</Text>
      </Box>
    </Box>
  );
}
