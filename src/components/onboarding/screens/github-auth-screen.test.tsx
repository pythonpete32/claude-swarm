import React from 'react';
import { render, fireEvent } from 'ink-testing-library';
import GitHubAuthScreen, { GitHubAuthScreenProps } from './github-auth-screen';
import { mockGitHubAuth, GitHubAuthData } from '../mocks/onboarding-data';

// Mock setTimeout and clearTimeout
jest.useFakeTimers();

const defaultProps: GitHubAuthScreenProps = {
  authData: { ...mockGitHubAuth },
  onSuccess: jest.fn(),
  onBack: jest.fn(),
  onUpdateAuth: jest.fn(),
};

describe('GitHubAuthScreen', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Reset authData to a fresh copy
    defaultProps.authData = { ...mockGitHubAuth, expiresIn: 900, status: 'waiting' };
  });

  it('renders initial state correctly', () => {
    const { lastFrame } = render(<GitHubAuthScreen {...defaultProps} />);
    expect(lastFrame()).toContain('GitHub Authentication');
    expect(lastFrame()).toContain('To access your repositories, we need to authenticate with GitHub.');
    expect(lastFrame()).toContain('Waiting for browser authentication...');
    expect(lastFrame()).toContain(`Device Code: ${mockGitHubAuth.deviceCode}`);
    expect(lastFrame()).toContain('Expires in: 15:00'); // 900 seconds
    expect(lastFrame()).toContain('[Enter] Check Status  [r] Retry  [m] Manual Token  [Esc] Back');
  });

  it('calls onUpdateAuth for timer countdown', () => {
    render(<GitHubAuthScreen {...defaultProps} />);
    expect(defaultProps.onUpdateAuth).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1000); // Advance 1 second
    });
    expect(defaultProps.onUpdateAuth).toHaveBeenCalledWith({ expiresIn: 899 });
    act(() => {
      jest.advanceTimersByTime(1000); // Advance another 1 second
    });
    expect(defaultProps.onUpdateAuth).toHaveBeenCalledWith({ expiresIn: 898 });
  });

  it('calls onUpdateAuth with success and onSuccess after 3 seconds (auto-advance)', () => {
    render(<GitHubAuthScreen {...defaultProps} />);
    expect(defaultProps.onUpdateAuth).not.toHaveBeenCalledWith({ status: 'success' });
    expect(defaultProps.onSuccess).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(3000); // Advance 3 seconds for auto-advance
    });

    expect(defaultProps.onUpdateAuth).toHaveBeenCalledWith({ status: 'success' });

    act(() => {
      jest.advanceTimersByTime(500); // For the setTimeout before onSuccess
    });
    expect(defaultProps.onSuccess).toHaveBeenCalledTimes(1);
  });

  it('calls onUpdateAuth with success and onSuccess on Enter press', () => {
    const { stdin } = render(<GitHubAuthScreen {...defaultProps} />);
    fireEvent.keyDown(stdin, { key: 'return' });

    expect(defaultProps.onUpdateAuth).toHaveBeenCalledWith({ status: 'success' });

    act(() => {
      jest.advanceTimersByTime(500); // For the setTimeout before onSuccess
    });
    expect(defaultProps.onSuccess).toHaveBeenCalledTimes(1);
  });

  it('calls onUpdateAuth with reset values on "r" press', () => {
    const { stdin } = render(<GitHubAuthScreen {...defaultProps} />);
    fireEvent.keyPress(stdin, { key: 'r' });

    expect(defaultProps.onUpdateAuth).toHaveBeenCalledWith({
      expiresIn: 900,
      status: 'waiting',
    });
  });

  it('logs to console on "m" press (manual token)', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    const { stdin } = render(<GitHubAuthScreen {...defaultProps} />);
    fireEvent.keyPress(stdin, { key: 'm' });

    expect(consoleSpy).toHaveBeenCalledWith('Manual token entry will be implemented later');
    consoleSpy.mockRestore();
  });

  it('calls onBack on Escape press', () => {
    const { stdin } = render(<GitHubAuthScreen {...defaultProps} />);
    fireEvent.keyDown(stdin, { key: 'escape' });
    expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
  });

  it('displays success message when authData status is "success"', () => {
    const successAuthData: GitHubAuthData = { ...mockGitHubAuth, status: 'success' };
    const { lastFrame } = render(<GitHubAuthScreen {...defaultProps} authData={successAuthData} />);
    expect(lastFrame()).toContain('Authentication successful!');
  });

  it('formats time correctly', () => {
    const authDataWithSpecificTime: GitHubAuthData = { ...mockGitHubAuth, expiresIn: 65 }; // 1 minute 5 seconds
    const { lastFrame } = render(<GitHubAuthScreen {...defaultProps} authData={authDataWithSpecificTime} />);
    expect(lastFrame()).toContain('Expires in: 1:05');
  });
});

// Helper for act if not globally available via testing-library/react
// For Ink, direct interaction and timer mocks are often more relevant.
// If you see warnings about act, you might need to wrap updates.
// For example, when timers cause state updates:
// import { act } from 'react-dom/test-utils'; // or from @testing-library/react
// act(() => { jest.advanceTimersByTime(1000); });
// The ink-testing-library doesn't re-export 'act' directly in older versions.
// For this test setup, direct jest.advanceTimersByTime and checking effects should work.
// If "act" is needed, ensure you import it from "react-test-renderer" or "@testing-library/react"
// and wrap any code that causes React state updates.
// For these tests, fireEvent and jest.advanceTimersByTime should be sufficient.
import { act } from '@testing-library/react';
