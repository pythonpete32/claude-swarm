import React from 'react';
import { render, fireEvent } from 'ink-testing-library';
import FullLogViewScreen, { FullLogViewScreenProps } from './full-log-view-screen';
import { mockTaskInfoForLog, mockLogEntries, logLevels } from './mocks/log-data';

// Mock ink-text-input for the search bar
jest.mock('ink-text-input', () => ({
  __esModule: true,
  default: jest.fn(({ value, onChange, onSubmit, placeholder }) => (
    <div data-testid="text-input">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') onSubmit(); }} // onSubmit also for Escape to lose focus
        placeholder={placeholder}
      />
    </div>
  )),
}));

const getOutputText = (lastFrame: () => string | undefined): string => {
    const frame = lastFrame();
    return frame ? frame.replace(/\u001b\[.*?m/g, '') : '';
};

const defaultProps: FullLogViewScreenProps = {
  taskInfo: mockTaskInfoForLog,
  logEntries: mockLogEntries,
  onBack: jest.fn(),
  // For simplicity in these tests, we'll manage filter/search/autoscroll internally
  // If these were controlled, we'd pass mocks for onSetFilterLevel, etc.
};

describe('FullLogViewScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders header with task info and back shortcut', () => {
    const { lastFrame } = render(<FullLogViewScreen {...defaultProps} />);
    const output = getOutputText(lastFrame);
    expect(output).toContain(`Full Log: #${mockTaskInfoForLog.id} ${mockTaskInfoForLog.title}`);
    expect(output).toContain('[Esc] Back');
  });

  it('renders filter/search bar with initial state', () => {
    const { lastFrame } = render(<FullLogViewScreen {...defaultProps} />);
    const output = getOutputText(lastFrame);
    expect(output).toContain('Filter: [ALL'); // Initial filter
    expect(output).toContain('[●] Auto-scroll (a)'); // Initial auto-scroll true
    expect(output).toContain('Search: /'); // Initial empty search
  });

  it('renders log entries', () => {
    const { lastFrame } = render(<FullLogViewScreen {...defaultProps} />);
    const output = getOutputText(lastFrame);
    // Check for a few log entries (visible ones, LOG_VIEW_HEIGHT is 20)
    mockLogEntries.slice(0, 5).forEach(entry => {
      expect(output).toContain(entry.timestamp);
      expect(output).toContain(entry.level);
      expect(output).toContain(entry.message);
    });
  });

  it('calls onBack on Escape key press (when not editing search)', () => {
    const { stdin } = render(<FullLogViewScreen {...defaultProps} />);
    fireEvent.keyDown(stdin, { key: 'Escape' });
    expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
  });

  it('toggles auto-scroll on "a" key press', () => {
    const { stdin, lastFrame } = render(<FullLogViewScreen {...defaultProps} />);
    fireEvent.keyPress(stdin, { key: 'a' }); // Toggle to false
    expect(getOutputText(lastFrame())).toContain('[○] Auto-scroll (a)');
    fireEvent.keyPress(stdin, { key: 'a' }); // Toggle back to true
    expect(getOutputText(lastFrame())).toContain('[●] Auto-scroll (a)');
  });

  it('activates search input on "/" key press and updates search term', () => {
    const { stdin, getByTestId, lastFrame } = render(<FullLogViewScreen {...defaultProps} />);
    fireEvent.keyPress(stdin, { key: '/' });
    // Expect text input to be focused (mock doesn't show visual focus, but state changes)
    // and text input component to be rendered for typing
    const textInputElement = getByTestId('text-input').querySelector('input');
    expect(textInputElement).toBeDefined();

    fireEvent.change(textInputElement!, { target: { value: 'test search' } });
    // Re-render or check component's state to confirm searchTerm update.
    // For this test, assume the internal state of FullLogViewScreen is updated.
    // If search was prop-driven, we'd check onSetSearchTerm.
    // We can check the display after exiting search focus:
    fireEvent.keyDown(textInputElement!, { key: 'Enter' }); // Exit search focus
    expect(getOutputText(lastFrame())).toContain('Search: test search');
  });

  it('filters logs by level when filter is changed', () => {
    const { stdin, lastFrame } = render(<FullLogViewScreen {...defaultProps} />);
    // Focus filter
    fireEvent.keyPress(stdin, { key: 'f' });
    expect(getOutputText(lastFrame())).toContain('Filter: [ALL'); // Focused state might add indicator

    // Change filter level (e.g., to ERROR)
    // We cycle through levels with Enter or Arrow keys. Let's target ERROR.
    const errorIndex = logLevels.indexOf('ERROR');
    for(let i=0; i < errorIndex; i++) {
        fireEvent.keyDown(stdin, { key: 'ArrowRight' }); // or Enter
    }
    expect(getOutputText(lastFrame())).toContain('Filter: [ERROR');

    // Check that only ERROR logs are visible (or fewer logs if none)
    const output = getOutputText(lastFrame());
    const nonErrorEntry = mockLogEntries.find(e => e.level !== 'ERROR');
    const errorEntry = mockLogEntries.find(e => e.level === 'ERROR');
    if (nonErrorEntry) {
        expect(output).not.toContain(nonErrorEntry.message);
    }
    if (errorEntry) {
        expect(output).toContain(errorEntry.message);
    }
  });

  it('filters logs by search term', () => {
    const { stdin, getByTestId, lastFrame } = render(<FullLogViewScreen {...defaultProps} />);
    fireEvent.keyPress(stdin, { key: '/' }); // Focus search
    const textInputElement = getByTestId('text-input').querySelector('input')!;

    const searchTerm = "Network timeout"; // From mock ERROR log
    fireEvent.change(textInputElement!, { target: { value: searchTerm } });
    fireEvent.keyDown(textInputElement!, { key: 'Enter' }); // Exit search focus

    const output = getOutputText(lastFrame());
    expect(output).toContain(searchTerm);
    // Check that a message without the search term is not present
    const messageWithoutSearchTerm = mockLogEntries.find(e => !e.message.includes(searchTerm));
    if (messageWithoutSearchTerm) {
        expect(output).not.toContain(messageWithoutSearchTerm.message);
    }
  });

  // Basic scroll tests (actual visual scrolling is hard to test here)
  it('handles UpArrow for scrolling', () => {
    const { stdin } = render(<FullLogViewScreen {...defaultProps} />);
    // More robust test would check scrollIndex state if exposed or visible items change
    fireEvent.keyDown(stdin, { key: 'ArrowUp' });
    // No crash is a basic pass
  });
  it('handles DownArrow for scrolling', () => {
    const { stdin } = render(<FullLogViewScreen {...defaultProps} />);
    fireEvent.keyDown(stdin, { key: 'ArrowDown' });
  });
  it('handles PageUp for scrolling', () => {
    const { stdin } = render(<FullLogViewScreen {...defaultProps} />);
    fireEvent.keyDown(stdin, { key: 'PageUp' });
  });
  it('handles PageDown for scrolling', () => {
    const { stdin } = render(<FullLogViewScreen {...defaultProps} />);
    fireEvent.keyDown(stdin, { key: 'PageDown' });
  });
   it('handles Home key for scrolling to top', () => {
    const { stdin } = render(<FullLogViewScreen {...defaultProps} />);
    fireEvent.keyDown(stdin, { key: 'Home' });
  });
  it('handles End key for scrolling to bottom (if auto-scroll is off)', () => {
    const { stdin } = render(<FullLogViewScreen {...defaultProps} initialAutoScroll={false} />);
    fireEvent.keyDown(stdin, { key: 'End' });
  });

  it('renders footer instructions', () => {
    const { lastFrame } = render(<FullLogViewScreen {...defaultProps} />);
    const output = getOutputText(lastFrame);
    expect(output).toContain('[↑↓] Scroll [PgUp/Dn] Page [Home/End] Top/Bottom');
    expect(output).toContain('[f] Filter [a] Auto-scroll [/] Search [c] Copy (NYI)');
  });

});
