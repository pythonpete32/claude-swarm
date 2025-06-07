import type { ChatMessage } from "../../types";

import { Box, Text } from "ink";
import React from "react";

export interface TerminalMessageHistoryProps {
  messages: ChatMessage[];
  terminalColumns: number;
}

const TerminalMessageHistory: React.FC<TerminalMessageHistoryProps> = ({
  messages,
  terminalColumns,
}) => {
  if (messages.length === 0) {
    return (
      <Box padding={1}>
        <Text dimColor>No messages yet. Type something to start chatting!</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {messages.map((message) => (
        <Box key={message.id} marginBottom={1} flexDirection="column">
          <Box>
            <Text bold color={message.role === "user" ? "green" : "cyan"}>
              {message.role === "user" ? "You" : "Assistant"}:
            </Text>
            <Text dimColor> {message.timestamp.toLocaleTimeString()}</Text>
          </Box>
          <Box paddingLeft={2}>
            <Text wrap="wrap">{message.content}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default TerminalMessageHistory;