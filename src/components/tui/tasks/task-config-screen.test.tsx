import React from 'react';
import { render, fireEvent } from 'ink-testing-library';
import TaskConfigScreen, { TaskConfigScreenProps } from './task-config-screen';
import { mockTaskConfig, mockAvailableModels } from './mocks/task-data';

// Mock ink-text-input
jest.mock('ink-text-input', () => ({
  __esModule: true,
  default: jest.fn(({ value, onChange, focus, placeholder }) => (
    <div data-testid={`text-input-${placeholder ? placeholder.slice(0,10) : 'val'}`}>
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            data-focus={focus ? 'true' : 'false'}
            placeholder={placeholder}
        />
    </div>
  )),
}));

const getOutputText = (lastFrame: () => string | undefined): string => {
    const frame = lastFrame();
    return frame ? frame.replace(/\u001b\[.*?m/g, '') : '';
};

const defaultProps: TaskConfigScreenProps = {
  initialConfig: { ...mockTaskConfig },
  issueTitle: "Test Issue Title",
  issueNumber: 123,
  availableModels: mockAvailableModels,
  onStartTask: jest.fn(),
  onCancel: jest.fn(),
  onSaveAsDefault: jest.fn(),
};

describe('TaskConfigScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure initialConfig is a fresh copy for each test
    defaultProps.initialConfig = { ...mockTaskConfig };
  });

  it('renders header with issue number and title', () => {
    const { lastFrame } = render(<TaskConfigScreen {...defaultProps} />);
    const output = getOutputText(lastFrame);
    expect(output).toContain(`Configure Task: #${defaultProps.issueNumber} ${defaultProps.issueTitle}`);
  });

  it('renders all configuration fields with initial values', () => {
    const { lastFrame, getByTestId } = render(<TaskConfigScreen {...defaultProps} />);
    const output = getOutputText(lastFrame);

    expect(output).toContain(`Model: [ ${mockTaskConfig.model}`); // Check model name part
    // For TextInput fields, check their presence via testid from mock
    expect(getByTestId('text-input-Enter custo')).toBeDefined(); // Custom Instructions
    expect(getByTestId('text-input-val')).toBeDefined(); // Max Review Cycles (no placeholder in mock)

    expect(output).toContain(`Enable Review Agent: ${mockTaskConfig.enableReviewAgent ? '[X]' : '[ ]'}`);
    expect(output).toContain(`Auto-create PR: ${mockTaskConfig.autoCreatePR ? '[X]' : '[ ]'}`);
    expect(output).toContain(`Require Tests: ${mockTaskConfig.requireTests ? '[X]' : '[ ]'}`);
  });

  it('cycles through models on Enter when Model field is focused', () => {
    const { stdin, lastFrame } = render(<TaskConfigScreen {...defaultProps} />);
    // Model is focused by default
    fireEvent.keyDown(stdin, { key: 'Enter' });
    const newModel = mockAvailableModels[1]; // Should cycle to the next model
    expect(getOutputText(lastFrame())).toContain(`Model: [ ${newModel}`);
  });

  it('toggles boolean fields on Enter', () => {
    const { stdin, lastFrame } = render(<TaskConfigScreen {...defaultProps} />);
    // Navigate to "Enable Review Agent"
    fireEvent.keyDown(stdin, { key: 'Tab' }); // -> Custom Instructions
    fireEvent.keyDown(stdin, { key: 'Tab' }); // -> Max Review Cycles
    fireEvent.keyDown(stdin, { key: 'Tab' }); // -> Enable Review Agent

    const initialValue = defaultProps.initialConfig.enableReviewAgent;
    expect(getOutputText(lastFrame())).toContain(`Enable Review Agent: ${initialValue ? '[X]' : '[ ]'}`);
    fireEvent.keyDown(stdin, { key: 'Enter' }); // Toggle
    expect(getOutputText(lastFrame())).toContain(`Enable Review Agent: ${!initialValue ? '[X]' : '[ ]'}`);
  });

  it('updates text input for custom instructions', () => {
    const { getByTestId } = render(<TaskConfigScreen {...defaultProps} />);
    // Navigate to Custom Instructions
    fireEvent.keyDown(defaultProps.stdin, { key: 'Tab' }); // stdin not on props. Use render's stdin.
    const { stdin: newStdin } = render(<TaskConfigScreen {...defaultProps} />); // Re-render to get fresh stdin if needed for focus
    fireEvent.keyDown(newStdin, {key: 'Tab'}); // Focus custom instructions

    // The mock TextInput's onChange will be called. The component state handles the update.
    // We can't directly check the input's value easily with ink-testing-library for TextInput.
    // Instead, we'll verify that onStartTask is called with the updated value.
    const customInstructionsInput = getByTestId('text-input-Enter custo').querySelector('input')!;
    fireEvent.change(customInstructionsInput, { target: { value: "New custom instruction" } });

    // Navigate to Start Task button and press Enter
    fireEvent.keyDown(newStdin, { key: 'Tab' }); // Max Review
    fireEvent.keyDown(newStdin, { key: 'Tab' }); // Review Agent
    fireEvent.keyDown(newStdin, { key: 'Tab' }); // Auto PR
    fireEvent.keyDown(newStdin, { key: 'Tab' }); // Req Tests
    fireEvent.keyDown(newStdin, { key: 'Tab' }); // Start Button
    fireEvent.keyDown(newStdin, { key: 'Enter' });

    expect(defaultProps.onStartTask).toHaveBeenCalledWith(
      expect.objectContaining({ customInstructions: "New custom instruction" })
    );
  });

  it('updates number input for max review cycles', () => {
    const { getByTestId, stdin } = render(<TaskConfigScreen {...defaultProps} />);
    // Navigate to Max Review Cycles
    fireEvent.keyDown(stdin, { key: 'Tab' }); // Custom Instr
    fireEvent.keyDown(stdin, { key: 'Tab' }); // Max Review

    const maxCyclesInput = getByTestId('text-input-val').querySelector('input')!;
    fireEvent.change(maxCyclesInput, { target: { value: "5" } });

    // Navigate to Start Task and submit
    fireEvent.keyDown(stdin, { key: 'Tab' }); // Review Agent
    fireEvent.keyDown(stdin, { key: 'Tab' }); // Auto PR
    fireEvent.keyDown(stdin, { key: 'Tab' }); // Req Tests
    fireEvent.keyDown(stdin, { key: 'Tab' }); // Start
    fireEvent.keyDown(stdin, { key: 'Enter' });

    expect(defaultProps.onStartTask).toHaveBeenCalledWith(
      expect.objectContaining({ maxReviewCycles: 5 })
    );
  });


  it('calls onStartTask with current config when Start Task is actioned', () => {
    const { stdin } = render(<TaskConfigScreen {...defaultProps} />);
    // Navigate to Start Task button
    for(let i=0; i<6; i++) fireEvent.keyDown(stdin, { key: 'Tab' });
    fireEvent.keyDown(stdin, { key: 'Enter' });
    expect(defaultProps.onStartTask).toHaveBeenCalledWith(defaultProps.initialConfig);
  });

  it('calls onCancel when Cancel is actioned or Escape is pressed', () => {
    const { stdin } = render(<TaskConfigScreen {...defaultProps} />);
    fireEvent.keyDown(stdin, { key: 'Escape' });
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);

    // Navigate to Cancel button
    for(let i=0; i<8; i++) fireEvent.keyDown(stdin, { key: 'Tab' }); // To Cancel
    fireEvent.keyDown(stdin, { key: 'Enter' });
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(2);
  });

  it('calls onSaveAsDefault when Save as Default is actioned or "s" is pressed on buttons', () => {
    if (!defaultProps.onSaveAsDefault) fail('onSaveAsDefault is undefined');

    const { stdin } = render(<TaskConfigScreen {...defaultProps} />);
    // Navigate to Save as Default button
    for(let i=0; i<7; i++) fireEvent.keyDown(stdin, { key: 'Tab' }); // To Save

    fireEvent.keyDown(stdin, { key: 'Enter' });
    expect(defaultProps.onSaveAsDefault).toHaveBeenCalledWith(defaultProps.initialConfig);
    expect(defaultProps.onSaveAsDefault).toHaveBeenCalledTimes(1);

    fireEvent.keyPress(stdin, { key: 's' }); // 's' shortcut while a button is focused
    expect(defaultProps.onSaveAsDefault).toHaveBeenCalledTimes(2);
  });

  it('navigates fields with Tab and Shift+Tab', () => {
    const { stdin, lastFrame } = render(<TaskConfigScreen {...defaultProps} />);
    // Default focus: Model
    expect(getOutputText(lastFrame())).toContain("› Model:");

    fireEvent.keyDown(stdin, { key: 'Tab' }); // To Custom Instructions
    expect(getOutputText(lastFrame())).toContain("› Custom Instructions:");

    fireEvent.keyDown(stdin, { key: 'Tab' }); // To Max Review Cycles
    expect(getOutputText(lastFrame())).toContain("› Max Review Cycles");

    fireEvent.keyDown(stdin, { key: 'Shift+Tab' }); // Back to Custom Instructions
     // Shift+Tab is not directly supported by ink-testing-library's fireEvent in this way.
     // We simulate by passing key: 'Tab', shiftKey: true
    fireEvent.keyDown(stdin, { key: 'Tab', shiftKey: true });
    expect(getOutputText(lastFrame())).toContain("› Custom Instructions:");
  });

});
