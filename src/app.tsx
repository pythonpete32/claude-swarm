import type { Agent, ChatMessage } from "./types";

import SwarmChat from "./components/chat/swarm-chat";
import GitHubLogin from "./components/onboarding/github-login";
import RepoPicker from "./components/onboarding/repo-picker";
import AgentLogViewer from "./components/agents/agent-log-viewer";
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

  const [view, setView] = useState<'login' | 'repo' | 'chat' | 'logs'>(
    'login',
  );
  const [agents, setAgents] = useState<Array<Agent>>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Simple message handler - echo back and spawn mock agent
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

    const agentId = `${Date.now()}`;
    const agentName = `Agent-${agents.length + 1}`;
    const newAgent: Agent = { id: agentId, name: agentName, status: "running", logs: [] };
    setAgents((prev) => [...prev, newAgent]);

    // Mock log streaming
    const steps = [
      "Starting task analysis...",
      "Creating branch feat/demo",
      "Analyzing existing code...",
      "Writing changes...",
      "Running tests...",
      "Done",
    ];
    let idx = 0;
    const interval = setInterval(() => {
      idx += 1;
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agentId
            ? {
                ...a,
                logs: [...a.logs, `[${new Date().toLocaleTimeString()}] ${steps[idx - 1]}`],
                status: idx === steps.length ? "completed" : "running",
              }
            : a,
        ),
      );
      if (idx === steps.length) clearInterval(interval);
    }, 2000);
  };

  // Git repository check (keep this pattern from original)
  if (!accepted && inGitRepo) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold color="yellow">⚠️ Git Repository Detected</Text>
        <Text>
          This appears to be a git repository. The chat app will create example
          files for demonstration.
        </Text>
        <Text dimColor>Continue anyway?</Text>
        <ConfirmInput onConfirm={() => setAccepted(true)} onCancel={() => app.exit()} />
      </Box>
    );
  }

  if (view === 'login') {
    return <GitHubLogin onLogin={() => setView('repo')} />;
  }

  if (view === 'repo') {
    const repos = [
      { label: 'sample-repo-1', value: 'repo1' },
      { label: 'sample-repo-2', value: 'repo2' },
      { label: 'sample-repo-3', value: 'repo3' },
    ];
    return <RepoPicker repos={repos} onSelect={() => setView('chat')} />;
  }

  if (view === 'logs' && selectedAgent) {
    const agent = agents.find((a) => a.id === selectedAgent)!;
    return <AgentLogViewer agent={agent} onExit={() => setView('chat')} />;
  }

  return (
    <SwarmChat
      messages={messages}
      agents={agents}
      onSendMessage={handleSendMessage}
      onSelectAgent={(id) => {
        setSelectedAgent(id);
        setView('logs');
      }}
      version={CLI_VERSION}
      cwd={cwd}
    />
  );
}

