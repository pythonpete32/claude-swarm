import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { AIChatMessage, IssuePreview } from './mocks/issue-creation-data';

export interface IssueCreationScreenProps {
  chatHistory: AIChatMessage[];
  currentIssuePreview: IssuePreview;
  currentUserInput: string;
  onUserInputChange: (value: string) => void;
  onSendMessage: () => void; // Called with currentUserInput on Enter
  onSaveIssue: () => void;   // Called on Ctrl+S
  onNavigateBack?: () => void; // Optional: For Esc key
}

const IssueCreationScreen: React.FC<IssueCreationScreenProps> = ({
  chatHistory,
  currentIssuePreview,
  currentUserInput,
  onUserInputChange,
  onSendMessage,
  onSaveIssue,
  onNavigateBack,
}) => {
  const chatHistoryRef = useRef<Box>(null); // For potential scrolling, not fully implemented here
  const chatViewHeight = 15; // Example fixed height for chat history view

  // Scroll to bottom of chat history (basic version)
  // A more robust solution might involve tracking actual content height
  useEffect(() => {
    // This is a conceptual scroll, Ink doesn't have direct DOM-like scrolling.
    // For real scrolling, one might manage a slice of visible messages.
  }, [chatHistory]);


  useInput((input, key) => {
    if (key.ctrl && input === 's') {
      onSaveIssue();
      return;
    }
    if (key.escape && onNavigateBack) {
      onNavigateBack();
      return;
    }
    // Let TextInput handle Enter for onSendMessage
  });

  const visibleChatHistory = chatHistory.slice(-chatViewHeight); // Show last N messages

  return (
    <Box flexDirection="column" padding={1} borderStyle="single" width="100%">
      {/* Header */}
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="blue">Create Issue with AI Assistant</Text>
      </Box>

      {/* Main Content: Two Panels */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Left Panel: Chat with AI */}
        <Box flexDirection="column" width="50%" marginRight={2} borderStyle="round" padding={1}>
          <Text bold>Chat History</Text>
          <Box flexDirection="column" flexGrow={1} minHeight={chatViewHeight} ref={chatHistoryRef}>
            {visibleChatHistory.map(msg => (
              <Box key={msg.id} marginY={0}>
                <Text bold={msg.sender === 'ai'} color={msg.sender === 'ai' ? 'green' : 'cyan'}>
                  {msg.sender === 'ai' ? 'AI: ' : 'You: '}
                </Text>
                <Text>{msg.text}</Text>
              </Box>
            ))}
          </Box>
          <Box marginTop={1} flexDirection="row" alignItems="center">
            <Text bold>{'> '}</Text>
            <TextInput
              value={currentUserInput}
              onChange={onUserInputChange}
              onSubmit={onSendMessage}
              placeholder="Describe the task or problem..."
              // focus={true} // Assuming input is always focused here
            />
          </Box>
        </Box>

        {/* Right Panel: Issue Preview */}
        <Box flexDirection="column" width="50%" borderStyle="round" padding={1}>
          <Text bold>Issue Preview</Text>
          <Box marginBottom={1}>
            <Text bold underline>Title:</Text>
            <Text>{currentIssuePreview.title || <Text dimColor>AI will generate this...</Text>}</Text>
          </Box>
          <Box marginBottom={1}>
            <Text bold underline>Description:</Text>
            <Text>{currentIssuePreview.description || <Text dimColor>AI will generate this...</Text>}</Text>
          </Box>
          <Box marginBottom={1}>
            <Text bold underline>Acceptance Criteria:</Text>
            {currentIssuePreview.acceptanceCriteria.length > 0
              ? currentIssuePreview.acceptanceCriteria.map((ac, index) => (
                  <Text key={index}>- {ac}</Text>
                ))
              : <Text dimColor>AI will generate these...</Text>
            }
          </Box>
          {currentIssuePreview.technicalNotes && (
            <Box>
              <Text bold underline>Technical Notes:</Text>
              <Text>{currentIssuePreview.technicalNotes}</Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Footer */}
      <Box marginTop={1} justifyContent="center">
        <Text dimColor>[Enter] Send Message [Ctrl+S] Save Issue [Esc] Back (if available)</Text>
      </Box>
    </Box>
  );
};

export default IssueCreationScreen;
