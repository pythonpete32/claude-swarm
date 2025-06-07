import { Box, Text, useInput } from "ink";
import React from "react";

/**
 * An overlay that shows help information for the Claude Swarm system.
 * Can be dismissed with Escape or Q key to return to swarm interface.
 */
export default function HelpOverlay({
  onClose,
  terminalColumns,
}: {
  onClose: () => void;
  terminalColumns: number;
}): JSX.Element {
  useInput((input, key) => {
    if (key.escape || input === "q") {
      onClose(); // Close overlay instead of exiting app
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      width={Math.min(80, terminalColumns - 4)}
      paddingX={2}
      paddingY={1}
    >
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="cyan">
          💬 Claude Swarm - Help
        </Text>
      </Box>

      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold color="yellow">
            Slash Commands
          </Text>
          <Text>
            <Text color="cyan">/help</Text> – show this help overlay
          </Text>
          <Text>
            <Text color="cyan">/clear</Text> – clear the terminal screen
          </Text>
          <Text>
            <Text color="cyan">/history</Text> – show message history (demo)
          </Text>
        </Box>

        <Box flexDirection="column">
          <Text bold color="yellow">
            Keyboard Shortcuts
          </Text>
          <Text>
            <Text color="green">Enter</Text> – send message
          </Text>
          <Text>
            <Text color="green">Shift+Enter</Text> – insert newline
          </Text>
          <Text>
            <Text color="green">Ctrl+C</Text> – quit application
          </Text>
        </Box>

        <Box flexDirection="column">
          <Text bold color="yellow">
            Features
          </Text>
          <Text>• Multi-line message support</Text>
          <Text>• Message history display with timestamps</Text>
          <Text>• Echo bot demonstration</Text>
          <Text>• Extensible component architecture</Text>
          <Text>• Terminal state management</Text>
        </Box>

        <Box justifyContent="center" marginTop={1}>
          <Text dimColor>
            Press <Text bold>Esc</Text> or <Text bold>Q</Text> to close this
            help
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
