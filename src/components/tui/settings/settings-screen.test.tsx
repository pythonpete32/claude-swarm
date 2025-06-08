import React from 'react';
import { render, fireEvent } from 'ink-testing-library';
import SettingsScreen, { SettingsScreenProps } from './settings-screen';
import { defaultAppSettings, mockAvailableModels, mockAvailableEditors, mockAvailableApiProviders } from './mocks/settings-data';

// Mock ink-text-input
jest.mock('ink-text-input', () => ({
  __esModule: true,
  default: jest.fn(({ value, onChange, focus, mask }) => (
    <div data-testid={`text-input-${mask ? 'masked' : 'clear'}`}>
      <input
        type={mask ? 'password' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-focus={focus ? 'true' : 'false'}
      />
    </div>
  )),
}));

const getOutputText = (lastFrame: () => string | undefined): string => {
    const frame = lastFrame();
    return frame ? frame.replace(/\u001b\[.*?m/g, '') : '';
};

const baseDefaultProps: SettingsScreenProps = {
  initialSettings: { ...defaultAppSettings },
  availableModels: mockAvailableModels,
  availableEditors: mockAvailableEditors,
  availableApiProviders: mockAvailableApiProviders,
  onSaveSettings: jest.fn(),
  onCancel: jest.fn(),
  onResetToDefaults: jest.fn(),
  onTestApiKey: jest.fn(),
  onReconnectGitHub: jest.fn(),
};

// Create a fresh copy of props for each test
let props: SettingsScreenProps;

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Deep copy initialSettings for each test to prevent modification across tests
    props = JSON.parse(JSON.stringify(baseDefaultProps));
  });

  it('renders header and footer instructions', () => {
    const { lastFrame } = render(<SettingsScreen {...props} />);
    const output = getOutputText(lastFrame);
    expect(output).toContain('Settings');
    expect(output).toContain('[Ctrl+S] Save');
    expect(output).toContain('[Tab] Next Field [Enter] Select/Confirm [Esc] Cancel [d] Reset Defaults');
  });

  // Test rendering of each section
  it('renders Agent Configuration section with initial values', () => {
    const { lastFrame } = render(<SettingsScreen {...props} />);
    const output = getOutputText(lastFrame);
    expect(output).toContain('Agent Configuration');
    expect(output).toContain(`Default Model: [ ${props.initialSettings.agent.defaultModel}`);
    expect(output).toContain(`Max Concurrent Agents: ${props.initialSettings.agent.maxConcurrentAgents}`);
    expect(output).toContain(`Review Agent by Default: [${props.initialSettings.agent.enableReviewAgentByDefault ? 'X' : ' '}]`);
  });

  it('renders Editor Integration section with initial value', () => {
    const { lastFrame } = render(<SettingsScreen {...props} />);
    const output = getOutputText(lastFrame);
    const editorLabel = props.availableEditors.find(e => e.value === props.initialSettings.editor.preferredEditor)?.label;
    expect(output).toContain('Editor Integration');
    expect(output).toContain(`Preferred Editor: [ ${editorLabel}`);
  });

  it('renders API Keys section with initial values', () => {
    const { lastFrame } = render(<SettingsScreen {...props} />);
    const output = getOutputText(lastFrame);
    expect(output).toContain('API Keys (Summaries)');
    expect(output).toContain(`Provider: [ ${props.initialSettings.api.summaryProvider}`);
    // API Key is a TextInput, check its presence
    expect(lastFrame()).toContain('text-input-masked'); // Assuming API key is masked if not empty
    expect(output).toContain(`Model: [ ${props.initialSettings.api.summaryModel}`);
  });

  it('renders GitHub Integration section with initial values', () => {
    const { lastFrame } = render(<SettingsScreen {...props} />);
    const output = getOutputText(lastFrame);
    expect(output).toContain('GitHub Integration');
    expect(output).toContain(`Authenticated User: ${props.initialSettings.github.username}`);
    expect(output).toContain(`Auto-sync Issues: [${props.initialSettings.github.autoSyncIssues ? 'X' : ' '}]`);
  });

  // Test interactions
  it('cycles through dropdown options on Enter (e.g., Agent Default Model)', () => {
    const { stdin, lastFrame } = render(<SettingsScreen {...props} />);
    // Agent Default Model is focused by default
    fireEvent.keyDown(stdin, { key: 'Enter' }); // Cycle to next model
    const nextModel = props.availableModels[1];
    expect(getOutputText(lastFrame())).toContain(`Default Model: [ ${nextModel}`);
  });

  it('toggles boolean fields on Enter (e.g., Enable Review Agent)', () => {
    const { stdin, lastFrame } = render(<SettingsScreen {...props} />);
    // Navigate to 'agent.enableReviewAgentByDefault'
    fireEvent.keyDown(stdin, { key: 'Tab' }); // -> Max Concurrent Agents
    fireEvent.keyDown(stdin, { key: 'Tab' }); // -> Enable Review Agent

    const initialValue = props.initialSettings.agent.enableReviewAgentByDefault;
    fireEvent.keyDown(stdin, { key: 'Enter' }); // Toggle
    expect(getOutputText(lastFrame())).toContain(`Review Agent by Default: [${!initialValue ? 'X' : ' '}]`);
  });

  it('updates text input field (e.g., Max Concurrent Agents) and calls onSaveSettings with updated value', () => {
    const { stdin, getByTestId } = render(<SettingsScreen {...props} />);
    // Navigate to 'agent.maxConcurrentAgents'
    fireEvent.keyDown(stdin, { key: 'Tab' });

    // The mock TextInput's onChange will be called.
    // The component's internal state `settings` will be updated.
    // We verify this by checking the arguments to onSaveSettings.
    const agentMaxAgentsInput = getByTestId('text-input-clear').querySelector('input')!; // Max agents input is not masked
    fireEvent.change(agentMaxAgentsInput, { target: { value: "7" } });

    // Navigate to Save button and press Enter
    for(let i=0; i<13; i++) fireEvent.keyDown(stdin, { key: 'Tab' }); // Navigate to Save
    fireEvent.keyDown(stdin, { key: 'Enter' });

    expect(props.onSaveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ agent: expect.objectContaining({ maxConcurrentAgents: 7 }) })
    );
  });

  it('calls onSaveSettings with current settings on Ctrl+S', () => {
    const { stdin } = render(<SettingsScreen {...props} />);
    fireEvent.keyDown(stdin, { key: 's', ctrlKey: true });
    expect(props.onSaveSettings).toHaveBeenCalledWith(props.initialSettings); // initialSettings is the current state at this point
  });

  it('calls onCancel on Escape key', () => {
    const { stdin } = render(<SettingsScreen {...props} />);
    fireEvent.keyDown(stdin, { key: 'Escape' });
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onResetToDefaults on "d" key if available', () => {
    const { stdin } = render(<SettingsScreen {...props} />);
    fireEvent.keyPress(stdin, { key: 'd' });
    expect(props.onResetToDefaults).toHaveBeenCalledTimes(1);
  });

  it('does not call onResetToDefaults if prop not provided', () => {
    const propsWithoutReset = { ...props, onResetToDefaults: undefined };
    const { stdin } = render(<SettingsScreen {...propsWithoutReset} />);
    fireEvent.keyPress(stdin, { key: 'd' });
    expect(props.onResetToDefaults).not.toHaveBeenCalled(); // Original mock should not be called
  });

  it('calls onTestApiKey when Test API Key button is actioned', () => {
    const { stdin } = render(<SettingsScreen {...props} />);
    // Navigate to 'api.testButton'
    for(let i=0; i<9; i++) fireEvent.keyDown(stdin, { key: 'Tab' });
    fireEvent.keyDown(stdin, { key: 'Enter' });
    expect(props.onTestApiKey).toHaveBeenCalledWith(
        props.initialSettings.api.summaryProvider,
        props.initialSettings.api.summaryApiKey,
        props.initialSettings.api.summaryModel
    );
  });

  it('calls onReconnectGitHub when Reconnect GitHub button is actioned', () => {
    const { stdin } = render(<SettingsScreen {...props} />);
    // Navigate to 'github.reconnectButton'
    for(let i=0; i<12; i++) fireEvent.keyDown(stdin, { key: 'Tab' });
    fireEvent.keyDown(stdin, { key: 'Enter' });
    expect(props.onReconnectGitHub).toHaveBeenCalledTimes(1);
  });

  it('navigates focus with Tab and Shift+Tab', () => {
    const { stdin, lastFrame } = render(<SettingsScreen {...props} />);
    // Default focus: agent.defaultModel
    expect(getOutputText(lastFrame())).toContain("› Default Model:");

    fireEvent.keyDown(stdin, { key: 'Tab' }); // -> agent.maxConcurrentAgents
    expect(getOutputText(lastFrame())).toContain("› Max Concurrent Agents:");

    fireEvent.keyDown(stdin, { key: 'Tab', shiftKey: true }); // Back to agent.defaultModel
    expect(getOutputText(lastFrame())).toContain("› Default Model:");
  });

});
