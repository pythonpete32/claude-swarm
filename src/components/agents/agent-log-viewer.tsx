import type { Agent } from "../../types";
import { Box, Text, useInput } from "ink";
import React from "react";

export default function AgentLogViewer({
  agent,
  onExit,
}: {
  agent: Agent;
  onExit: () => void;
}): JSX.Element {
  useInput((input, key) => {
    if (key.escape) onExit();
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1} height={process.stdout.rows || 24}>
      <Text bold>{agent.name} Live Logs</Text>
      <Box flexDirection="column" flexGrow={1} marginTop={1}>
        {agent.logs.map((line, idx) => (
          <Text key={idx}>{line}</Text>
        ))}
      </Box>
      <Text dimColor>[ESC] Back to chat</Text>
    </Box>
  );
}
