import type { MultilineTextEditorHandle } from "./multiline-editor";

import MultilineTextEditor from "./multiline-editor";
import { Box, Text, useInput } from "ink";
import React, {
  useCallback,
  useState,
  useRef,
  useEffect,
} from "react";

export interface TerminalChatInputProps {
  onSendMessage: (message: string) => void;
  terminalColumns: number;
}

const TerminalChatInput: React.FC<TerminalChatInputProps> = ({
  onSendMessage,
  terminalColumns,
}) => {
  const [inputText, setInputText] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [editorKey, setEditorKey] = useState(0); // Force remount when needed
  const editorRef = useRef<MultilineTextEditorHandle>(null);

  // Handle sending messages
  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (trimmed) {
      onSendMessage(trimmed);
      // Clear the input and force remount of editor
      setInputText("");
      setEditorKey(prev => prev + 1);
    }
  }, [inputText, onSendMessage]);

  // Handle keyboard shortcuts
  useInput((input, key) => {
    if (isComposing) return;

    // Ctrl+C to exit
    if (key.ctrl && input === "c") {
      process.exit(0);
    }

    // Enter to send (Shift+Enter for new line is handled by MultilineTextEditor)
    if (key.return && !key.shift) {
      handleSend();
    }
  });

  return (
    <Box flexDirection="column">
      {/* Input box with rounded corners and light grey border */}
      <Box 
        borderStyle="round" 
        borderColor="gray" 
        paddingX={1}
        paddingY={0}
        minHeight={3}
      >
        <Box flexDirection="row" alignItems="flex-start">
          <Text color="gray">› </Text>
          <Box flexGrow={1}>
            <MultilineTextEditor
              key={editorKey} // Force remount when key changes
              ref={editorRef}
              value={inputText}
              onChange={setInputText}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder="Type your message..."
              terminalColumns={terminalColumns - 6} // Account for border, padding, and cursor
            />
          </Box>
        </Box>
      </Box>
      
      {/* Help text underneath */}
      <Box paddingX={1} paddingTop={0}>
        <Text dimColor>Enter to send • Shift+Enter for new line • /help for commands</Text>
      </Box>
    </Box>
  );
};

export default TerminalChatInput;