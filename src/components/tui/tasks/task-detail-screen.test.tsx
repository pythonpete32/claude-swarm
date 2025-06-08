import React from 'react';
import { render, fireEvent } from 'ink-testing-library';
import TaskDetailScreen, { TaskDetailScreenProps } from './task-detail-screen';
import { mockTaskDetails } from './mocks/task-data';

// Mock ink-text-input
jest.mock('ink-text-input', () => ({
  __esModule: true,
  default: jest.fn(({ value, onChange, onSubmit, placeholder }) => (
    <div data-testid="text-input">
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
            placeholder={placeholder}
        />
    </div>
  )),
}));

const getOutputText = (lastFrame: () => string | undefined): string => {
    const frame = lastFrame();
    return frame ? frame.replace(/\u001b\[.*?m/g, '') : '';
};

const defaultProps: TaskDetailScreenProps = {
  taskDetails: { ...mockTaskDetails },
  messageInput: "",
  onMessageInputChange: jest.fn(),
  onSendMessage: jest.fn(),
  onGoToDashboard: jest.fn(),
  onStopTask: jest.fn(),
  onGoToFullLog: jest.fn(),
};

describe('TaskDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    defaultProps.taskDetails = { ...mockTaskDetails }; // Reset mock details
    defaultProps.messageInput = "";
  });

  it('renders header with task number, title, status, and runtime', () => {
    const { lastFrame } = render(<TaskDetailScreen {...defaultProps} />);
    const output = getOutputText(lastFrame);
    expect(output).toContain(`#${mockTaskDetails.issueNumber}: ${mockTaskDetails.issueTitle}`);
    expect(output).toContain(mockTaskDetails.agentStatus);
    expect(output).toContain(`Runtime: ${mockTaskDetails.runtime}`);
    expect(output).toContain(`Current Step: ${mockTaskDetails.currentStep}`);
  });

  it('renders message input area', () => {
    const { getByTestId } = render(<TaskDetailScreen {...defaultProps} />);
    expect(getByTestId('text-input')).toBeDefined();
    // Check placeholder if mock TextInput passes it through
    const inputElement = getByTestId('text-input').querySelector('input');
    expect(inputElement?.placeholder).toBe('Type your message...');
  });

  it('calls onMessageInputChange when message input changes', () => {
    const { getByTestId } = render(<TaskDetailScreen {...defaultProps} />);
    const inputElement = getByTestId('text-input').querySelector('input')!;
    fireEvent.change(inputElement, { target: { value: "Hello agent" } });
    expect(defaultProps.onMessageInputChange).toHaveBeenCalledWith("Hello agent");
  });

  it('calls onSendMessage when Enter is pressed in message input', () => {
     // Assuming TextInput is focused by default or focus management is handled.
     // The mock TextInput calls onSubmit on Enter.
    const { getByTestId } = render(<TaskDetailScreen {...defaultProps} />);
    const inputElement = getByTestId('text-input').querySelector('input')!;
    fireEvent.keyDown(inputElement, { key: 'Enter' });
    expect(defaultProps.onSendMessage).toHaveBeenCalledTimes(1);
  });

  it('renders task steps with indicators', () => {
    const { lastFrame } = render(<TaskDetailScreen {...defaultProps} />);
    const output = getOutputText(lastFrame);
    expect(output).toContain('Task Steps');
    mockTaskDetails.subTasks.forEach(task => {
      expect(output).toContain(task.text);
      // Check for indicators (✓, ○, ●, ✗) based on status
      if (task.status === 'done') expect(output).toContain('✓');
      else if (task.status === 'pending') expect(output).toContain('○');
    });
  });

  it('renders activity log entries', () => {
    const { lastFrame } = render(<TaskDetailScreen {...defaultProps} />);
    const output = getOutputText(lastFrame);
    expect(output).toContain('Activity Log');
    mockTaskDetails.logEntries.slice(0, 10).forEach(log => { // Only visible logs
      expect(output).toContain(log.timestamp);
      if (log.type === 'user_message') expect(output).toContain(`You: ${log.message}`);
      else if (log.type === 'agent_message') expect(output).toContain(`Agent: ${log.message}`);
      else expect(output).toContain(log.message);
    });
  });

  it('calls onGoToDashboard on Escape key press', () => {
    const { stdin } = render(<TaskDetailScreen {...defaultProps} />);
    fireEvent.keyDown(stdin, { key: 'Escape' });
    expect(defaultProps.onGoToDashboard).toHaveBeenCalledTimes(1);
  });

  it('calls onStopTask on "s" key press', () => {
    const { stdin } = render(<TaskDetailScreen {...defaultProps} />);
    fireEvent.keyPress(stdin, { key: 's' });
    expect(defaultProps.onStopTask).toHaveBeenCalledTimes(1);
  });

  it('calls onGoToFullLog on "l" key press if prop provided', () => {
    const { stdin } = render(<TaskDetailScreen {...defaultProps} />);
    fireEvent.keyPress(stdin, { key: 'l' });
    expect(defaultProps.onGoToFullLog).toHaveBeenCalledTimes(1);
  });

  it('scrolls log with up/down arrow keys', () => {
    // This test is more complex as it needs to verify which log entries are visible.
    // For simplicity, we'll check that the component doesn't crash and state changes.
    // A more robust test would involve checking the rendered output for specific log entries.
    const manyLogs = Array.from({ length: 20 }, (_, i) => ({
        id: `log${i}`, timestamp: `10:00:0${i % 10}`, message: `Log message ${i}`, type: 'info' as const
    }));
    const propsWithManyLogs = { ...defaultProps, taskDetails: { ...mockTaskDetails, logEntries: manyLogs }};
    const { stdin, lastFrame } = render(<TaskDetailScreen {...propsWithManyLogs} />);

    const initialOutput = getOutputText(lastFrame());
    expect(initialOutput).toContain("Log message 0");
    expect(initialOutput).not.toContain("Log message 15"); // Assuming logViewHeight is around 10

    fireEvent.keyDown(stdin, { key: 'ArrowDown' });
    fireEvent.keyDown(stdin, { key: 'ArrowDown' }); // Scroll down twice

    const scrolledOutput = getOutputText(lastFrame());
    // Depending on how state updates are reflected in ink-testing-library's lastFrame,
    // this might require `act` or direct inspection if state was exposed.
    // For now, assume re-render happens and output changes.
    expect(scrolledOutput).not.toContain("Log message 0"); // First message scrolled out of view
    expect(scrolledOutput).toContain("Log message 2"); // New messages scrolled into view
  });

  it('renders footer instructions', () => {
    const { lastFrame } = render(<TaskDetailScreen {...defaultProps} />);
    const output = getOutputText(lastFrame);
    expect(output).toContain('[Enter] Send Message');
    expect(output).toContain('[Esc] Dashboard');
    expect(output).toContain('[s] Stop Task');
    expect(output).toContain('[l] Full Log');
    expect(output).toContain('[↑↓] Scroll Log');
  });

});
