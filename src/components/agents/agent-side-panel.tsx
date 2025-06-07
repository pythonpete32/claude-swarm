import type { Agent } from "../../types";
import Spinner from "../vendor/ink-spinner";
import { Box, Text, useInput } from "ink";
import React, { useState } from "react";

export default function AgentSidePanel({
  agents,
  onSelect,
}: {
  agents: Agent[];
  onSelect: (id: string) => void;
}): JSX.Element {
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
    } else if (key.downArrow) {
      setCursor((c) => Math.min(agents.length - 1, c + 1));
    } else if (key.return) {
      if (agents[cursor]) onSelect(agents[cursor]!.id);
    }
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>Active Agents</Text>
      {agents.map((agent, i) => {
        const selected = i === cursor;
        const statusIcon =
          agent.status === "completed"
            ? "✅"
            : agent.status === "running"
            ? <Spinner />
            : "⌛";
        return (
          <Box key={agent.id}>
            <Text color={selected ? "cyan" : undefined}>{selected ? "› " : "  "}</Text>
            <Text color={selected ? "cyan" : undefined}>{agent.name}: </Text>
            {typeof statusIcon === "string" ? (
              <Text>{statusIcon}</Text>
            ) : (
              statusIcon
            )}
          </Box>
        );
      })}
    </Box>
  );
}
