import React, { useState, useRef, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { TaskDetails, SubTask, LogEntry } from './mocks/task-data';

export interface TaskDetailScreenProps {
  taskDetails: TaskDetails;
  messageInput: string;
  onMessageInputChange: (value: string) => void;
  onSendMessage: () => void;
  onGoToDashboard: () => void;
  onStopTask: () => void;
  onGoToFullLog?: () => void; // Optional for now
  // onScrollLog: (direction: 'up' | 'down') => void; // Internal scroll for this example
}

const getStepIndicator = (status: SubTask['status']) => {
  switch (status) {
    case 'pending': return <Text color="gray">○</Text>;
    case 'in_progress': return <Text color="yellow">●</Text>; // Or use Spinner
    case 'done': return <Text color="green">✓</Text>;
    case 'error': return <Text color="red">✗</Text>;
    default: return <Text> </Text>;
  }
};

const TaskDetailScreen: React.FC<TaskDetailScreenProps> = ({
  taskDetails,
  messageInput,
  onMessageInputChange,
  onSendMessage,
  onGoToDashboard,
  onStopTask,
  onGoToFullLog,
}) => {
  const [logScrollOffset, setLogScrollOffset] = useState(0);
  const logViewHeight = 10; // Example height, adjust as needed

  const visibleLogEntries = taskDetails.logEntries.slice(
    logScrollOffset,
    logScrollOffset + logViewHeight
  );

  useInput((input, key) => {
    if (key.escape) {
      onGoToDashboard();
    } else if (input === 's' && !key.ctrl && !key.meta) { // Simple 's' for stop
      onStopTask();
    } else if (input === 'l' && onGoToFullLog) {
      onGoToFullLog();
    } else if (key.upArrow) {
      setLogScrollOffset(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setLogScrollOffset(prev => Math.min(taskDetails.logEntries.length - logViewHeight, prev + 1));
    }
    // Let TextInput handle Enter for onSendMessage if it's focused
  });

  return (
    <Box flexDirection="column" padding={1} borderStyle="single" width="100%">
      {/* Header */}
      <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <Text bold color="blue">
          #{taskDetails.issueNumber}: {taskDetails.issueTitle}
        </Text>
        <Text bold color={taskDetails.agentStatus === "Running" ? "green" : "yellow"}>
          {taskDetails.agentStatus}
        </Text>
        <Text>Runtime: {taskDetails.runtime}</Text>
      </Box>
      <Box marginBottom={1}><Text dimColor>Current Step: {taskDetails.currentStep}</Text></Box>


      {/* Main Content Area */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Left Panel: Message Input */}
        <Box flexDirection="column" width="30%" marginRight={2}>
          <Text bold>Send Message to Agent:</Text>
          <Box borderStyle="round" height={5}>
            <TextInput
              value={messageInput}
              onChange={onMessageInputChange}
              onSubmit={onSendMessage}
              placeholder="Type your message..."
              // focus={true} // Assuming message input is often the primary focus
            />
          </Box>
        </Box>

        {/* Right Panel: Task List & Activity Log */}
        <Box flexDirection="column" flexGrow={1} borderStyle="round" paddingX={1}>
          <Box flexDirection="column" height="40%" borderBottomStyle="single" paddingBottom={1} marginBottom={1}>
            <Text bold>Task Steps ({taskDetails.subTasks.filter(t=>t.status==='done').length}/{taskDetails.subTasks.length})</Text>
            {taskDetails.subTasks.map(task => (
              <Box key={task.id}>
                {getStepIndicator(task.status)} <Text>{task.text}</Text>
              </Box>
            ))}
          </Box>
          <Box flexDirection="column" flexGrow={1} minHeight={logViewHeight}>
            <Text bold>Activity Log (Scroll ↑↓):</Text>
            {visibleLogEntries.map(log => (
              <Box key={log.id} flexDirection="row">
                <Text dimColor>{log.timestamp} </Text>
                <Text
                    color={log.type === 'error' ? 'red' : log.type === 'user_message' ? 'cyan' : log.type === 'agent_message' ? 'green' : 'white'}
                >
                    {log.type === 'user_message' ? `You: ${log.message}` :
                     log.type === 'agent_message' ? `Agent: ${log.message}` : log.message}
                </Text>
              </Box>
            ))}
             {taskDetails.logEntries.length === 0 && <Text dimColor>No activity yet.</Text>}
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box marginTop={1} justifyContent="space-between">
        <Text dimColor>[Enter] Send Message [Esc] Dashboard</Text>
        <Text dimColor>[s] Stop Task [l] Full Log [↑↓] Scroll Log</Text>
      </Box>
    </Box>
  );
};

export default TaskDetailScreen;
