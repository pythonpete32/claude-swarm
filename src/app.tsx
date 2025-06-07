import type { ChatMessage } from "./types";

import TerminalChat from "./components/chat/terminal-chat";
import { APP_NAME, CLI_VERSION } from "./constants/app";
import { checkInGit } from "./utils/check-in-git";
import { ConfirmInput } from "@inkjs/ui";
import { Box, Text, useApp, useStdin } from "ink";
import React, { useMemo, useState } from "react";

export default function App(): JSX.Element {
  const app = useApp();
  const [accepted, setAccepted] = useState(() => false);
  const [messages, setMessages] = useState<Array<ChatMessage>>([
    {
      id: "welcome",
      content: `Welcome to ${APP_NAME}! Type a message to get started.`,
      role: "assistant",
      timestamp: new Date(),
    },
  ]);

  const [cwd, inGitRepo] = useMemo(
    () => [process.cwd(), checkInGit(process.cwd())],
    [],
  );
  const { internal_eventEmitter } = useStdin();
  internal_eventEmitter.setMaxListeners(20);

  // Simple message handler - echo back for demo
  const handleSendMessage = (content: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content,
      role: "user",
      timestamp: new Date(),
    };

    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      content: `You said: "${content}"`,
      role: "assistant",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
  };

  // Git repository check (keep this pattern from original)
  if (!accepted && inGitRepo) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold color="yellow">
          ⚠️ Git Repository Detected
        </Text>
        <Text>
          This appears to be a git repository. The chat app will create example
          files for demonstration.
        </Text>
        <Text dimColor>Continue anyway?</Text>
        <ConfirmInput
          onConfirm={() => setAccepted(true)}
          onCancel={() => app.exit()}
        />
      </Box>
    );
  }

  return (
    <TerminalChat
      messages={messages}
      onSendMessage={handleSendMessage}
      version={CLI_VERSION}
      cwd={cwd}
    />
  );
}
