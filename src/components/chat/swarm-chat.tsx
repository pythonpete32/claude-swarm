import type { Agent, ChatMessage } from "../../types";
import TerminalChatInput from "./terminal-chat-input";
import TerminalHeader from "./terminal-header";
import TerminalMessageHistory from "./terminal-message-history";
import AgentSidePanel from "../agents/agent-side-panel";
import { useTerminalSize } from "../../hooks/use-terminal-size";
import { Box } from "ink";
import React from "react";

export default function SwarmChat({
  messages,
  agents,
  onSendMessage,
  onSelectAgent,
  cwd,
  version,
}: {
  messages: ChatMessage[];
  agents: Agent[];
  onSendMessage: (text: string) => void;
  onSelectAgent: (id: string) => void;
  cwd: string;
  version: string;
}): JSX.Element {
  const { rows, columns } = useTerminalSize();
  const sideWidth = Math.min(30, Math.max(20, Math.floor(columns * 0.3)));

  return (
    <Box flexDirection="column" height={rows}>
      <TerminalHeader
        terminalRows={rows}
        version={version}
        PWD={cwd}
        model="Mock"
        approvalPolicy="demo"
        colorsByPolicy={{ demo: "cyan" }}
      />
      <Box flexGrow={1} flexDirection="row">
        <Box flexDirection="column" flexGrow={1}>
          <TerminalMessageHistory messages={messages} terminalColumns={columns - sideWidth} />
          <TerminalChatInput onSendMessage={onSendMessage} terminalColumns={columns - sideWidth} />
        </Box>
        <Box width={sideWidth} borderLeftStyle="single" borderColor="gray">
          <AgentSidePanel agents={agents} onSelect={onSelectAgent} />
        </Box>
      </Box>
    </Box>
  );
}
