import React from 'react';
import { render, fireEvent } from 'ink-testing-library';
import SplashScreen, { SplashScreenProps } from './splash-screen';
import { mockPrerequisites } from '../mocks/onboarding-data';

const defaultProps: SplashScreenProps = {
  onContinue: jest.fn(),
  onQuit: jest.fn(),
  prerequisites: mockPrerequisites,
};

describe('SplashScreen', () => {
  it('renders title and subtitles', () => {
    const { lastFrame } = render(<SplashScreen {...defaultProps} />);
    expect(lastFrame()).toContain('Agent Task Manager');
    expect(lastFrame()).toContain('Autonomous GitHub Issue Resolution');
    expect(lastFrame()).toContain('Powered by Claude Code');
  });

  it('renders welcome message and features', () => {
    const { lastFrame } = render(<SplashScreen {...defaultProps} />);
    expect(lastFrame()).toContain("Welcome! Let's get you started.");
    expect(lastFrame()).toContain('• Agents work asynchronously');
  });

  it('renders prerequisites from props', () => {
    const customPrerequisites = [
      { name: 'Test Prereq 1', status: 'installed' as const },
      { name: 'Test Prereq 2', status: 'not_found' as const },
    ];
    const { lastFrame } = render(
      <SplashScreen {...defaultProps} prerequisites={customPrerequisites} />
    );

    expect(lastFrame()).toContain('Test Prereq 1');
    expect(lastFrame()).toContain('Installed');
    expect(lastFrame()).toContain('Test Prereq 2');
    expect(lastFrame()).toContain('Not found');
  });

  it('calls onContinue when Enter is pressed', () => {
    const onContinueMock = jest.fn();
    const { stdin } = render(<SplashScreen {...defaultProps} onContinue={onContinueMock} />);

    fireEvent.keyDown(stdin, { key: 'return' });
    expect(onContinueMock).toHaveBeenCalledTimes(1);
  });

  it('calls onQuit when "q" is pressed', () => {
    const onQuitMock = jest.fn();
    // Note: Ink's useInput hook receives the character itself for non-special keys.
    const { stdin } = render(<SplashScreen {...defaultProps} onQuit={onQuitMock} />);

    fireEvent.keyPress(stdin, { key: 'q' });
    expect(onQuitMock).toHaveBeenCalledTimes(1);
  });

  it('calls onQuit when Escape is pressed', () => {
    const onQuitMock = jest.fn();
    const { stdin } = render(<SplashScreen {...defaultProps} onQuit={onQuitMock} />);

    fireEvent.keyDown(stdin, { key: 'escape' });
    expect(onQuitMock).toHaveBeenCalledTimes(1);
  });

  it('renders bottom instructions', () => {
    const { lastFrame } = render(<SplashScreen {...defaultProps} />);
    expect(lastFrame()).toContain('[Enter] Continue  [q] Quit');
  });
});
