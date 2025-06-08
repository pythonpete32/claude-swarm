import React from 'react';
import { render, act } from 'ink-testing-library'; // Added act for timer testing
import RepoDownloadingScreen, { RepoDownloadingScreenProps } from './repo-downloading-screen';
import { ProgressStep, MOCK_SELECTED_REPO_NAME } from './mocks/repo-data';

// Mock ink-spinner as it's used for 'in_progress' state
jest.mock('ink-spinner', () => ({
  __esModule: true,
  default: jest.fn(() => <text>⟳</text>), // Simple text representation for testing
}));

jest.useFakeTimers(); // Use Jest's fake timers for useEffect simulation

const getOutputText = (lastFrame: () => string | undefined): string => {
    const frame = lastFrame();
    return frame ? frame.replace(/\u001b\[.*?m/g, '') : ''; // Strip ANSI codes
};

const initialSteps: ProgressStep[] = [
  { id: '1', text: 'Cloning...', status: 'done' },
  { id: '2', text: 'Setting up workspace...', status: 'in_progress' },
  { id: '3', text: 'Installing dependencies...', status: 'pending' },
];

const defaultProps: RepoDownloadingScreenProps = {
  repoName: MOCK_SELECTED_REPO_NAME,
  progressPercentage: 50,
  progressSteps: initialSteps,
  onComplete: jest.fn(),
};

describe('RepoDownloadingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset defaultProps for each test to avoid interference
     defaultProps.progressPercentage = 50;
     defaultProps.progressSteps = [
        { id: '1', text: 'Cloning...', status: 'done' },
        { id: '2', text: 'Setting up workspace...', status: 'in_progress' },
        { id: '3', text: 'Installing dependencies...', status: 'pending' },
     ];
     defaultProps.onComplete = jest.fn();
  });

  it('renders header with repository name', () => {
    const { lastFrame } = render(<RepoDownloadingScreen {...defaultProps} />);
    const output = getOutputText(lastFrame);
    expect(output).toContain(`Setting up: ${MOCK_SELECTED_REPO_NAME}`);
  });

  it('renders progress bar based on progressPercentage', () => {
    const { lastFrame } = render(<RepoDownloadingScreen {...defaultProps} progressPercentage={75} />);
    const output = getOutputText(lastFrame);
    // PROGRESS_BAR_WIDTH is 30. 75% of 30 is 22.5, floor is 22.
    const expectedBar = `[${'█'.repeat(22)}${'-'.repeat(8)}] 75%`;
    expect(output).toContain(expectedBar);
  });

  it('renders progress steps with correct indicators', () => {
    const { lastFrame } = render(<RepoDownloadingScreen {...defaultProps} />);
    const output = getOutputText(lastFrame);

    expect(output).toContain('✓ Cloning...');
    expect(output).toContain('⟳ Setting up workspace...'); // Mocked spinner
    expect(output).toContain('○ Installing dependencies...');
  });

  it('renders error step correctly', () => {
    const errorSteps: ProgressStep[] = [
        { id: '1', text: 'Cloning...', status: 'done' },
        { id: '2', text: 'Something went wrong', status: 'error' },
    ];
    const { lastFrame } = render(<RepoDownloadingScreen {...defaultProps} progressSteps={errorSteps} />);
    const output = getOutputText(lastFrame);
    expect(output).toContain('✗ Something went wrong');
  });


  it('calls onComplete when progressPercentage reaches 100 after a short delay', () => {
    const { rerender } = render(<RepoDownloadingScreen {...defaultProps} progressPercentage={99} />);
    expect(defaultProps.onComplete).not.toHaveBeenCalled();

    rerender(<RepoDownloadingScreen {...defaultProps} progressPercentage={100} />);
    expect(defaultProps.onComplete).not.toHaveBeenCalled(); // Should not be called immediately

    act(() => {
      jest.advanceTimersByTime(500); // Advance timer by 500ms
    });
    expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not call onComplete if progress is less than 100', () => {
    render(<RepoDownloadingScreen {...defaultProps} progressPercentage={90} />);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(defaultProps.onComplete).not.toHaveBeenCalled();
  });

  it('clears timeout if component unmounts before completion', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const { unmount, rerender } = render(<RepoDownloadingScreen {...defaultProps} progressPercentage={99} />);

    rerender(<RepoDownloadingScreen {...defaultProps} progressPercentage={100} />); // Start the timeout
    unmount(); // Unmount before the 500ms timeout completes

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    // Also ensure onComplete was not called
    act(() => {
        jest.runAllTimers(); // Try to run any remaining timers
    });
    expect(defaultProps.onComplete).not.toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('renders informational text', () => {
    const { lastFrame } = render(<RepoDownloadingScreen {...defaultProps} />);
    const output = getOutputText(lastFrame);
    expect(output).toContain('This may take a few moments...');
  });
});
