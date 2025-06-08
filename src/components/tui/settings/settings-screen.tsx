import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input'; // For API keys, numeric inputs
// For dropdowns, a custom component or ink-select-input might be used.
// For this example, dropdowns will cycle on Enter, similar to previous components.

import { AppSettings, AgentSettings, EditorSettings, ApiSettings, GitHubSettings } from './mocks/settings-data';

export interface SettingsScreenProps {
  initialSettings: AppSettings;
  availableModels: string[];
  availableEditors: Array<{label: string, value: EditorSettings['preferredEditor']}>;
  availableApiProviders: string[];

  onSaveSettings: (settings: AppSettings) => void;
  onCancel: () => void;
  onResetToDefaults?: () => void; // Optional
  // onUpdateSetting: (path: string, value: any) => void; // For finer-grained updates to a parent store
  onTestApiKey?: (provider: string, apiKey: string, model?: string) => void;
  onReconnectGitHub?: () => void;
}

type FocusableSetting =
  // Agent
  | 'agent.defaultModel' | 'agent.maxConcurrentAgents' | 'agent.enableReviewAgentByDefault'
  | 'agent.autoCreatePRByDefault' | 'agent.runTestsByDefault'
  // Editor
  | 'editor.preferredEditor'
  // API
  | 'api.summaryProvider' | 'api.summaryApiKey' | 'api.summaryModel' | 'api.testButton'
  // GitHub
  | 'github.username' | 'github.autoSyncIssues' | 'github.createDraftPRs' | 'github.reconnectButton'
  // Actions
  | 'action.save' | 'action.cancel' | 'action.reset';

const SettingsScreen: React.FC<SettingsScreenProps> = ({
  initialSettings,
  availableModels,
  availableEditors,
  availableApiProviders,
  onSaveSettings,
  onCancel,
  onResetToDefaults,
  onTestApiKey,
  onReconnectGitHub,
}) => {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [focusedField, setFocusedField] = useState<FocusableSetting>('agent.defaultModel');

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  const handleUpdate = (path: string, value: any) => {
    const keys = path.split('.');
    setSettings(prev => {
      const newState = { ...prev };
      let currentLevel: any = newState;
      keys.forEach((key, index) => {
        if (index === keys.length - 1) {
          currentLevel[key] = value;
        } else {
          currentLevel[key] = { ...currentLevel[key] };
          currentLevel = currentLevel[key];
        }
      });
      return newState;
    });
  };

  const focusOrder: FocusableSetting[] = [
    'agent.defaultModel', 'agent.maxConcurrentAgents', 'agent.enableReviewAgentByDefault',
    'agent.autoCreatePRByDefault', 'agent.runTestsByDefault',
    'editor.preferredEditor',
    'api.summaryProvider', 'api.summaryApiKey', 'api.summaryModel', 'api.testButton',
    'github.username', 'github.autoSyncIssues', 'github.createDraftPRs', 'github.reconnectButton',
    'action.save', 'action.cancel',
  ];
  if (onResetToDefaults) focusOrder.push('action.reset');


  useInput((input, key) => {
    if (key.escape) { onCancel(); return; }
    if (input === 's' && key.ctrl) { onSaveSettings(settings); return; } // Ctrl+S to save
    if (input === 'd' && !key.ctrl && !key.meta && !key.shift && onResetToDefaults) { // 'd' for defaults
        onResetToDefaults(); // This prop should cause initialSettings to update, then useEffect handles it
        return;
    }

    const currentFieldIndex = focusOrder.indexOf(focusedField);
    if (key.tab) {
      const nextIndex = (currentFieldIndex + 1) % focusOrder.length;
      setFocusedField(focusOrder[nextIndex]);
    } else if (key.shift && key.tab) {
      const prevIndex = (currentFieldIndex - 1 + focusOrder.length) % focusOrder.length;
      setFocusedField(focusOrder[prevIndex]);
    } else if (key.return) {
      // Handle Enter for various field types
      switch (focusedField) {
        // Agent Toggles
        case 'agent.enableReviewAgentByDefault': handleUpdate('agent.enableReviewAgentByDefault', !settings.agent.enableReviewAgentByDefault); break;
        case 'agent.autoCreatePRByDefault': handleUpdate('agent.autoCreatePRByDefault', !settings.agent.autoCreatePRByDefault); break;
        case 'agent.runTestsByDefault': handleUpdate('agent.runTestsByDefault', !settings.agent.runTestsByDefault); break;
        // Editor Dropdown (cycle)
        case 'editor.preferredEditor':
          const currentEditorIndex = availableEditors.findIndex(e => e.value === settings.editor.preferredEditor);
          const nextEditorIndex = (currentEditorIndex + 1) % availableEditors.length;
          handleUpdate('editor.preferredEditor', availableEditors[nextEditorIndex].value);
          break;
        // API Dropdowns (cycle)
        case 'api.summaryProvider':
          const currentProviderIndex = availableApiProviders.indexOf(settings.api.summaryProvider);
          const nextProviderIndex = (currentProviderIndex + 1) % availableApiProviders.length;
          handleUpdate('api.summaryProvider', availableApiProviders[nextProviderIndex]);
          break;
        case 'agent.defaultModel': // Also API model, assuming same list for now
        case 'api.summaryModel':
            const path = focusedField === 'agent.defaultModel' ? 'agent.defaultModel' : 'api.summaryModel';
            const currentModel = path === 'agent.defaultModel' ? settings.agent.defaultModel : settings.api.summaryModel;
            const currentModelIdx = availableModels.indexOf(currentModel);
            const nextModelIdx = (currentModelIdx + 1) % availableModels.length;
            handleUpdate(path, availableModels[nextModelIdx]);
            break;
        // GitHub Toggles
        case 'github.autoSyncIssues': handleUpdate('github.autoSyncIssues', !settings.github.autoSyncIssues); break;
        case 'github.createDraftPRs': handleUpdate('github.createDraftPRs', !settings.github.createDraftPRs); break;
        // Buttons
        case 'api.testButton': onTestApiKey?.(settings.api.summaryProvider, settings.api.summaryApiKey, settings.api.summaryModel); break;
        case 'github.reconnectButton': onReconnectGitHub?.(); break;
        case 'action.save': onSaveSettings(settings); break;
        case 'action.cancel': onCancel(); break;
        case 'action.reset': onResetToDefaults?.(); break;
        // TextInputs (agent.maxConcurrentAgents, api.summaryApiKey) are handled by their own onSubmit/onChange usually
        // For this setup, Enter on them might also trigger save, or move to next field. Let's make it save.
        case 'agent.maxConcurrentAgents':
        case 'api.summaryApiKey':
             // No specific action on Enter besides what TextInput does, or could trigger save.
             // For now, let TextInput handle it. Tab navigates away.
            break;
      }
    }
  });

  const renderField = (label: string, fieldName: FocusableSetting, currentValue: any, type: 'text' | 'number' | 'boolean' | 'dropdown', options?: any[]) => {
    const isFocused = focusedField === fieldName;
    let displayValue = currentValue;
    if (type === 'boolean') displayValue = currentValue ? '[X]' : '[ ]';
    if (type === 'dropdown' && fieldName === 'editor.preferredEditor') {
        const editorLabel = availableEditors.find(e => e.value === currentValue)?.label || currentValue;
        displayValue = `[ ${editorLabel.padEnd(20)} ▼ ]`;
    } else if (type === 'dropdown') {
        displayValue = `[ ${currentValue.padEnd(20)} ▼ ]`;
    }

    return (
      <Box flexDirection="row" marginBottom={0.5} alignItems="center">
        <Text bold color={isFocused ? 'cyan' : 'white'} width={35}>{isFocused ? '›' : '  '}{label}: </Text>
        { (fieldName === 'api.summaryApiKey' || fieldName === 'agent.maxConcurrentAgents') ? (
            <Box borderStyle="round" borderColor={isFocused ? 'cyan' : 'grey'} width={fieldName === 'api.summaryApiKey' ? 40 : 5}>
                 <TextInput
                    value={currentValue.toString()}
                    onChange={(val) => handleUpdate(fieldName, fieldName === 'agent.maxConcurrentAgents' ? (parseInt(val,10) || 0) : val)}
                    focus={isFocused}
                    mask={fieldName === 'api.summaryApiKey' && currentValue.length > 0 ? '********************************' : undefined}
                 />
            </Box>
        ) : (
            <Text>{displayValue}</Text>
        )}
      </Box>
    );
  };

  const renderButton = (label: string, actionName: FocusableSetting, isMainAction = false) => {
    const isFocused = focusedField === actionName;
    return (
      <Box borderStyle="round" borderColor={isFocused ? 'cyan' : 'grey'} paddingX={2} marginX={1}>
        <Text color={isFocused ? 'cyan' : (isMainAction ? 'green' : 'white')}>{label}</Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" padding={1} borderStyle="single">
      <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <Text bold color="blue">Settings</Text>
        <Text dimColor>[Ctrl+S] Save</Text>
      </Box>

      <Box flexDirection="row">
        {/* Left Column */}
        <Box flexDirection="column" width="50%" paddingRight={2}>
          <Text bold underline>Agent Configuration</Text>
          {renderField('Default Model', 'agent.defaultModel', settings.agent.defaultModel, 'dropdown', availableModels)}
          {renderField('Max Concurrent Agents', 'agent.maxConcurrentAgents', settings.agent.maxConcurrentAgents, 'number')}
          {renderField('Review Agent by Default', 'agent.enableReviewAgentByDefault', settings.agent.enableReviewAgentByDefault, 'boolean')}
          {renderField('Auto-create PRs by Default', 'agent.autoCreatePRByDefault', settings.agent.autoCreatePRByDefault, 'boolean')}
          {renderField('Run Tests by Default', 'agent.runTestsByDefault', settings.agent.runTestsByDefault, 'boolean')}

          <Text bold underline marginTop={1}>Editor Integration</Text>
          {renderField('Preferred Editor', 'editor.preferredEditor', settings.editor.preferredEditor, 'dropdown', availableEditors.map(e=>e.label))}
        </Box>

        {/* Right Column */}
        <Box flexDirection="column" width="50%" paddingLeft={2} borderLeftStyle="single" borderLeftColor="gray">
          <Text bold underline>API Keys (Summaries)</Text>
          {renderField('Provider', 'api.summaryProvider', settings.api.summaryProvider, 'dropdown', availableApiProviders)}
          {renderField('API Key', 'api.summaryApiKey', settings.api.summaryApiKey, 'text')}
          {renderField('Model', 'api.summaryModel', settings.api.summaryModel, 'dropdown', availableModels)}
          {renderButton('Test API Key', 'api.testButton')}

          <Text bold underline marginTop={1}>GitHub Integration</Text>
          {renderField('Authenticated User', 'github.username', settings.github.username, 'text')}
          {renderField('Auto-sync Issues', 'github.autoSyncIssues', settings.github.autoSyncIssues, 'boolean')}
          {renderField('Create Draft PRs', 'github.createDraftPRs', settings.github.createDraftPRs, 'boolean')}
          {renderButton('Reconnect GitHub', 'github.reconnectButton')}
        </Box>
      </Box>

      <Box marginTop={2} flexDirection="row" justifyContent="center">
        {renderButton('Save Settings', 'action.save', true)}
        {renderButton('Cancel', 'action.cancel')}
        {onResetToDefaults && renderButton('Reset to Defaults', 'action.reset')}
      </Box>
      <Box marginTop={1} justifyContent="center">
        <Text dimColor>[Tab] Next Field [Enter] Select/Confirm [Esc] Cancel [d] Reset Defaults</Text>
      </Box>
    </Box>
  );
};

export default SettingsScreen;
