import React from 'react';
import { render, fireEvent } from 'ink-testing-library';
import ApiConfigScreen, { ApiConfigScreenProps } from './api-config-screen';
import { mockApiConfig, mockApiProviders } from '../mocks/onboarding-data';

const defaultProps: ApiConfigScreenProps = {
  apiConfig: { ...mockApiConfig, apiKey: '', provider: 'OpenAI', model: 'gpt-4o-mini' },
  onComplete: jest.fn(),
  onBack: jest.fn(),
  onUpdateConfig: jest.fn(),
};

// Helper to get text content from Ink's output
const getOutput = (lastFrame: () => string | undefined): string => {
  const frame = lastFrame();
  return frame ? frame.replace(/\x1B\[[0-9;]*[mG]/g, '') : ''; // Strip ANSI codes
};

describe('ApiConfigScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset props to a clean state for each test
    defaultProps.apiConfig = { ...mockApiConfig, apiKey: '', provider: 'OpenAI', model: 'gpt-4o-mini' };
    defaultProps.onComplete = jest.fn();
    defaultProps.onBack = jest.fn();
    defaultProps.onUpdateConfig = jest.fn();
  });

  it('renders initial state correctly', () => {
    const { lastFrame } = render(<ApiConfigScreen {...defaultProps} />);
    const output = getOutput(lastFrame);
    expect(output).toContain('Configure AI Summary API');
    expect(output).toContain('Provider: [OpenAI                    ▼]');
    expect(output).toContain('API Key:  [____________________________________]'); // Empty key
    expect(output).toContain('Model: [gpt-4o-mini                  ▼]');
    expect(output).toContain('[Save & Continue]');
    expect(output).toContain('[Enter] Save & Continue  [s] Skip for Now  [Tab] Next Field');
  });

  it('calls onBack on Escape press when not editing', () => {
    const { stdin } = render(<ApiConfigScreen {...defaultProps} />);
    fireEvent.keyDown(stdin, { key: 'escape' });
    expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
  });

  it('calls onComplete on "s" press', () => {
    const { stdin } = render(<ApiConfigScreen {...defaultProps} />);
    fireEvent.keyPress(stdin, { key: 's' });
    expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
  });

  it('navigates fields with Tab and Arrow keys', () => {
    const { stdin, lastFrame } = render(<ApiConfigScreen {...defaultProps} />);
    let output = getOutput(lastFrame);
    expect(output).toMatch(/› Provider: .*/); // Provider active

    fireEvent.keyDown(stdin, { key: 'tab' });
    output = getOutput(lastFrame);
    expect(output).toMatch(/› API Key: .*/);  // API Key active

    fireEvent.keyDown(stdin, { key: 'arrowDown' });
    output = getOutput(lastFrame);
    expect(output).toMatch(/› Model: .*/);    // Model active

    fireEvent.keyDown(stdin, { key: 'arrowUp' });
    output = getOutput(lastFrame);
    expect(output).toMatch(/› API Key: .*/);  // API Key active again
  });

  it('cycles through providers on Enter when Provider field is active', () => {
    const { stdin } = render(<ApiConfigScreen {...defaultProps} />); // Active field is provider by default

    // Initial provider is OpenAI
    fireEvent.keyDown(stdin, { key: 'return' }); // Press Enter
    const nextProvider = mockApiProviders[1]; // Anthropic
    expect(defaultProps.onUpdateConfig).toHaveBeenCalledWith({
      provider: nextProvider.name,
      model: nextProvider.models[0],
    });
  });

  it('cycles through models on Enter when Model field is active', () => {
    // Set initial provider to one with multiple models
    const currentProviderName = 'OpenAI'; // Has multiple models
    const currentProvider = mockApiProviders.find(p => p.name === currentProviderName)!;
    const initialModel = currentProvider.models[0];

    const props = {
        ...defaultProps,
        apiConfig: { ...defaultProps.apiConfig, provider: currentProviderName, model: initialModel },
    };
    const { stdin } = render(<ApiConfigScreen {...props} />);

    // Navigate to Model field
    fireEvent.keyDown(stdin, { key: 'tab' }); // To API Key
    fireEvent.keyDown(stdin, { key: 'tab' }); // To Model

    // Cycle to next model
    fireEvent.keyDown(stdin, { key: 'return' });
    expect(props.onUpdateConfig).toHaveBeenCalledWith({ model: currentProvider.models[1] });
  });

  it('enters editing mode for API Key on Enter, exits editing mode, and updates key', () => {
    const { stdin, lastFrame } = render(<ApiConfigScreen {...defaultProps} />);
    // Navigate to API Key field
    fireEvent.keyDown(stdin, { key: 'tab' });
    let output = getOutput(lastFrame);
    expect(output).toMatch(/› API Key:  \[____________________________________\]/);

    // Press Enter to start editing API Key
    fireEvent.keyDown(stdin, { key: 'return' });

    // Type an API key
    fireEvent.keyPress(stdin, { key: 't' });
    fireEvent.keyPress(stdin, { key: 'e' });
    fireEvent.keyPress(stdin, { key: 's' });
    fireEvent.keyPress(stdin, { key: 't' });
    output = getOutput(lastFrame);
    // During editing, the actual key is shown (not masked by the component's display logic for active editing)
    // The component's internal tempApiKey state would be "test"
    // The rendered output for the API key field in editing mode is `tempApiKey`
    expect(output).toMatch(/› API Key:  \[test________________________________\]/);


    // Press Enter to save API Key
    fireEvent.keyDown(stdin, { key: 'return' });
    expect(defaultProps.onUpdateConfig).toHaveBeenCalledWith({ apiKey: 'test' });
    // After saving, the component should exit editing mode
    // and the key should be masked if we were to re-render with new props
  });

  it('masks API key when not editing', () => {
    const propsWithKey = {
        ...defaultProps,
        apiConfig: { ...defaultProps.apiConfig, apiKey: 'secretkey123' },
    };
    const { lastFrame } = render(<ApiConfigScreen {...propsWithKey} />);
    // Navigate to API Key field to check its display
    fireEvent.keyDown(defaultProps.stdin, { key: 'tab' }); // Assuming stdin is available on defaultProps or obtained fresh
    const output = getOutput(lastFrame);
    expect(output).toContain('API Key:  [********key123________________________]');
  });

  it('calls onComplete when "Save & Continue" is activated with Enter', () => {
    const { stdin } = render(<ApiConfigScreen {...defaultProps} />);
    // Navigate to "Save & Continue"
    fireEvent.keyDown(stdin, { key: 'tab' }); // To API Key
    fireEvent.keyDown(stdin, { key: 'tab' }); // To Model
    fireEvent.keyDown(stdin, { key: 'tab' }); // To Continue

    fireEvent.keyDown(stdin, { key: 'return' });
    expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
  });

  it('handles API key backspace correctly during editing', () => {
    const { stdin, lastFrame } = render(<ApiConfigScreen {...defaultProps} />);
    fireEvent.keyDown(stdin, { key: 'tab' }); // Navigate to API Key
    fireEvent.keyDown(stdin, { key: 'return' }); // Enter editing mode

    fireEvent.keyPress(stdin, { key: 'a' });
    fireEvent.keyPress(stdin, { key: 'b' });
    fireEvent.keyPress(stdin, { key: 'c' });
    let output = getOutput(lastFrame);
    expect(output).toMatch(/› API Key:  \[abc_________________________________\]/);

    fireEvent.keyDown(stdin, { key: 'backspace' });
    output = getOutput(lastFrame);
    expect(output).toMatch(/› API Key:  \[ab__________________________________\]/);

    fireEvent.keyDown(stdin, { key: 'return' }); // Save
    expect(defaultProps.onUpdateConfig).toHaveBeenCalledWith({ apiKey: 'ab' });
  });

  it('exits API key editing mode on Escape', () => {
    const { stdin, lastFrame } = render(<ApiConfigScreen {...defaultProps} />);
    fireEvent.keyDown(stdin, { key: 'tab' }); // Navigate to API Key
    fireEvent.keyDown(stdin, { key: 'return' }); // Enter editing mode

    fireEvent.keyPress(stdin, { key: 't' }); // Type something
    let output = getOutput(lastFrame);
    expect(output).toMatch(/› API Key:  \[t___________________________________\]/);


    fireEvent.keyDown(stdin, { key: 'escape' }); // Press escape
    output = getOutput(lastFrame);
    // Should revert to non-editing display (empty and masked if it had a saved value)
    // Since initial apiKey is empty, it shows underscores
    expect(output).toMatch(/› API Key:  \[____________________________________\]/);
    expect(defaultProps.onUpdateConfig).not.toHaveBeenCalledWith(expect.objectContaining({apiKey: 't'})); // Key 't' should not be saved
  });

});
