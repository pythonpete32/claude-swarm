import React from 'react';
import { render, fireEvent } from 'ink-testing-library';
import IssueCreationScreen, { IssueCreationScreenProps } from './issue-creation-screen';
import { initialAIChatHistory, initialIssuePreview, sampleUpdatedIssuePreview } from './mocks/issue-creation-data';

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

const defaultProps: IssueCreationScreenProps = {
  chatHistory: initialAIChatHistory,
  currentIssuePreview: initialIssuePreview,
  currentUserInput: "",
  onUserInputChange: jest.fn(),
  onSendMessage: jest.fn(),
  onSaveIssue: jest.fn(),
  onNavigateBack: jest.fn(),
};

describe('IssueCreationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset props for each test
    defaultProps.chatHistory = [...initialAIChatHistory];
    defaultProps.currentIssuePreview = {...initialIssuePreview};
    defaultProps.currentUserInput = "";
  });

  it('renders the header', () => {
    const { lastFrame } = render(<IssueCreationScreen {...defaultProps} />);
    const output = getOutputText(lastFrame);
    expect(output).toContain('Create Issue with AI Assistant');
  });

  it('renders chat history panel with initial AI prompt', () => {
    const { lastFrame } = render(<IssueCreationScreen {...defaultProps} />);
    const output = getOutputText(lastFrame);
    expect(output).toContain('Chat History');
    initialAIChatHistory.forEach(msg => {
      const prefix = msg.sender === 'ai' ? 'AI: ' : 'You: ';
      expect(output).toContain(prefix + msg.text);
    });
  });

  it('renders user input field', () => {
    const { getByTestId } = render(<IssueCreationScreen {...defaultProps} />);
    const inputElement = getByTestId('text-input').querySelector('input');
    expect(inputElement).toBeDefined();
    expect(inputElement?.placeholder).toBe('Describe the task or problem...');
  });

  it('calls onUserInputChange when user types in input field', () => {
    const { getByTestId } = render(<IssueCreationScreen {...defaultProps} />);
    const inputElement = getByTestId('text-input').querySelector('input')!;
    fireEvent.change(inputElement, { target: { value: "New user message" } });
    expect(defaultProps.onUserInputChange).toHaveBeenCalledWith("New user message");
  });

  it('calls onSendMessage when Enter is pressed in input field', () => {
    const { getByTestId } = render(<IssueCreationScreen {...defaultProps} />);
    const inputElement = getByTestId('text-input').querySelector('input')!;
    fireEvent.keyDown(inputElement, { key: 'Enter' });
    expect(defaultProps.onSendMessage).toHaveBeenCalledTimes(1);
  });

  it('renders issue preview panel with initial empty state', () => {
    const { lastFrame } = render(<IssueCreationScreen {...defaultProps} />);
    const output = getOutputText(lastFrame);
    expect(output).toContain('Issue Preview');
    expect(output).toContain('Title:');
    expect(output).toContain('AI will generate this...');
    expect(output).toContain('Description:');
    expect(output).toContain('AI will generate this...');
    expect(output).toContain('Acceptance Criteria:');
    expect(output).toContain('AI will generate these...');
  });

  it('renders updated issue preview data', () => {
    const propsWithPreview = { ...defaultProps, currentIssuePreview: sampleUpdatedIssuePreview };
    const { lastFrame } = render(<IssueCreationScreen {...propsWithPreview} />);
    const output = getOutputText(lastFrame);
    expect(output).toContain(`Title:\n${sampleUpdatedIssuePreview.title}`);
    expect(output).toContain(`Description:\n${sampleUpdatedIssuePreview.description}`);
    sampleUpdatedIssuePreview.acceptanceCriteria.forEach(ac => {
      expect(output).toContain(`- ${ac}`);
    });
    if (sampleUpdatedIssuePreview.technicalNotes) {
      expect(output).toContain(`Technical Notes:\n${sampleUpdatedIssuePreview.technicalNotes}`);
    }
  });

  it('calls onSaveIssue on Ctrl+S key press', () => {
    const { stdin } = render(<IssueCreationScreen {...defaultProps} />);
    fireEvent.keyDown(stdin, { key: 's', ctrlKey: true });
    expect(defaultProps.onSaveIssue).toHaveBeenCalledTimes(1);
  });

  it('calls onNavigateBack on Escape key press if prop provided', () => {
    const { stdin } = render(<IssueCreationScreen {...defaultProps} />);
    fireEvent.keyDown(stdin, { key: 'Escape' });
    expect(defaultProps.onNavigateBack).toHaveBeenCalledTimes(1);
  });

  it('does not call onNavigateBack on Escape if prop not provided', () => {
    const propsWithoutBack = { ...defaultProps, onNavigateBack: undefined };
    const { stdin } = render(<IssueCreationScreen {...propsWithoutBack} />);
    fireEvent.keyDown(stdin, { key: 'Escape' });
    // onNavigateBack mock on defaultProps should not be called
    expect(defaultProps.onNavigateBack).not.toHaveBeenCalled();
  });


  it('renders footer instructions', () => {
    const { lastFrame } = render(<IssueCreationScreen {...defaultProps} />);
    const output = getOutputText(lastFrame);
    expect(output).toContain('[Enter] Send Message');
    expect(output).toContain('[Ctrl+S] Save Issue');
    expect(output).toContain('[Esc] Back (if available)');
  });
});
