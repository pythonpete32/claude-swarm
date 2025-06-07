import type { ChatMessage, OverlayMode } from "../../types";

import TerminalChatInput from "./terminal-chat-input";
import TerminalHeader from "./terminal-header";
import TerminalMessageHistory from "./terminal-message-history";
import { useTerminalSize } from "../../hooks/use-terminal-size";
import { clearTerminal } from "../../utils/terminal";
import HelpOverlay from "../help-overlay";
import { Box } from "ink";
import React, { useState, useCallback } from "react";

export interface TerminalChatProps {
  messages: Array<ChatMessage>;
  onSendMessage: (message: string) => void;
  version: string;
  cwd: string;
}

const TerminalChat: React.FC<TerminalChatProps> = ({
  messages,
  onSendMessage,
  version,
  cwd,
}) => {
  const { rows: terminalRows, columns: terminalColumns } = useTerminalSize();
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("none");

  // Handle slash commands
  const handleSlashCommand = useCallback((command: string) => {
    switch (command) {
      case "/help":
        setOverlayMode("help");
        return true;
      case "/clear":
        clearTerminal();
        return true;
      case "/history":
        setOverlayMode("history");
        return true;
      default:
        return false;
    }
  }, []);

  const handleSendMessage = useCallback(
    (content: string) => {
      // Check for slash commands first
      if (content.startsWith("/")) {
        const handled = handleSlashCommand(content);
        if (handled) return;
      }

      // Send regular message
      onSendMessage(content);
    },
    [onSendMessage, handleSlashCommand],
  );

  // Render overlays
  if (overlayMode === "help") {
    return (
      <HelpOverlay
        onClose={() => setOverlayMode("none")}
        terminalColumns={terminalColumns}
      />
    );
  }

  return (
    <Box flexDirection="column" height={terminalRows}>
      {/* Header showing app info */}
      <TerminalHeader
        terminalRows={terminalRows}
        version={version}
        PWD={cwd}
        model="Echo Bot" // Simple demo model
        approvalPolicy="demo"
        colorsByPolicy={{ demo: "cyan" }}
      />

      {/* Message history */}
      <Box flexGrow={1} flexDirection="column">
        <TerminalMessageHistory
          messages={messages}
          terminalColumns={terminalColumns}
        />
      </Box>

      {/* Input area */}
      <TerminalChatInput
        onSendMessage={handleSendMessage}
        terminalColumns={terminalColumns}
      />
    </Box>
  );
};

export default TerminalChat;
