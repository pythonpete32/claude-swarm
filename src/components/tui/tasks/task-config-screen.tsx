import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input'; // Assuming usage for text fields
// For dropdowns/toggles, one might use ink-select-input or custom components

import { TaskConfig } from './mocks/task-data';

export interface TaskConfigScreenProps {
  initialConfig: TaskConfig;
  issueTitle: string;
  issueNumber: number;
  availableModels: string[];
  onStartTask: (config: TaskConfig) => void;
  onCancel: () => void;
  onSaveAsDefault?: (config: TaskConfig) => void; // Optional
  // onUpdateConfigField: (field: keyof TaskConfig, value: any) => void; // Or manage state internally
}

type FocusableField =
  | 'model'
  | 'customInstructions'
  | 'enableReviewAgent'
  | 'autoCreatePR'
  | 'requireTests'
  | 'maxReviewCycles'
  | 'startButton'
  | 'saveButton'
  | 'cancelButton';

const TaskConfigScreen: React.FC<TaskConfigScreenProps> = ({
  initialConfig,
  issueTitle,
  issueNumber,
  availableModels,
  onStartTask,
  onCancel,
  onSaveAsDefault,
}) => {
  const [config, setConfig] = useState<TaskConfig>(initialConfig);
  const [focusedField, setFocusedField] = useState<FocusableField>('model');

  // Update local state if initialConfig prop changes (e.g. navigating to configure a different task)
  useEffect(() => {
    setConfig(initialConfig);
  }, [initialConfig]);

  const handleUpdate = (field: keyof TaskConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const fieldsOrder: FocusableField[] = [
    'model', 'customInstructions', 'maxReviewCycles',
    'enableReviewAgent', 'autoCreatePR', 'requireTests',
    'startButton', 'saveButton', 'cancelButton'
  ];

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.tab) {
      const currentIndex = fieldsOrder.indexOf(focusedField);
      const nextIndex = (currentIndex + 1) % fieldsOrder.length;
      setFocusedField(fieldsOrder[nextIndex]);
      return;
    }
    if (key.shift && key.tab) {
        const currentIndex = fieldsOrder.indexOf(focusedField);
        const prevIndex = (currentIndex - 1 + fieldsOrder.length) % fieldsOrder.length;
        setFocusedField(fieldsOrder[prevIndex]);
        return;
    }

    if (key.return) {
      switch (focusedField) {
        case 'model':
          const currentModelIndex = availableModels.indexOf(config.model);
          const nextModelIndex = (currentModelIndex + 1) % availableModels.length;
          handleUpdate('model', availableModels[nextModelIndex]);
          break;
        case 'enableReviewAgent': handleUpdate('enableReviewAgent', !config.enableReviewAgent); break;
        case 'autoCreatePR': handleUpdate('autoCreatePR', !config.autoCreatePR); break;
        case 'requireTests': handleUpdate('requireTests', !config.requireTests); break;
        case 'startButton': onStartTask(config); break;
        case 'saveButton': onSaveAsDefault?.(config); break;
        case 'cancelButton': onCancel(); break;
        // customInstructions and maxReviewCycles are handled by TextInput
      }
    }

    if (input === 's' && (key.ctrl || !fieldsOrder.slice(0,6).includes(focusedField) ) ) { // Ctrl+S or 's' if on buttons
        if(onSaveAsDefault) onSaveAsDefault(config);
        return;
    }

    // Let TextInput handle its own input if focused there.
    // Max review cycles could also be a text input or +/- buttons.
  });

  const renderField = (label: string, field: FocusableField, value: string | number | boolean, isTextInput = false) => {
    const isFocused = focusedField === field;
    let displayValue = '';
    if (typeof value === 'boolean') {
      displayValue = value ? '[X]' : '[ ]';
    } else if (typeof value === 'number') {
      displayValue = value.toString();
    } else {
      displayValue = value;
    }

    if (isTextInput && field === 'customInstructions') {
        return (
            <Box flexDirection="column" marginBottom={1}>
                <Text bold color={isFocused ? 'cyan' : 'white'}>{isFocused ? '›' : '  '}{label}:</Text>
                <Box borderStyle="single" borderColor={isFocused ? 'cyan' : 'grey'} width={80} height={5}>
                    <TextInput
                        value={config.customInstructions}
                        onChange={(val) => handleUpdate('customInstructions', val)}
                        focus={isFocused}
                        placeholder="Enter custom instructions for the AI agent..."
                    />
                </Box>
            </Box>
        );
    }
    if (isTextInput && field === 'maxReviewCycles') {
         return (
             <Box flexDirection="row" alignItems="center" marginBottom={1}>
                <Text bold color={isFocused ? 'cyan' : 'white'}>{isFocused ? '›' : '  '}{label}: </Text>
                <Box width={5} borderStyle="round" borderColor={isFocused ? 'cyan' : 'grey'}>
                    <TextInput
                        value={config.maxReviewCycles.toString()}
                        onChange={(val) => {
                            const num = parseInt(val, 10);
                            if (!isNaN(num) && num >=0 && num <= 10) handleUpdate('maxReviewCycles', num);
                            else if (val === "") handleUpdate('maxReviewCycles', 0);
                        }}
                        focus={isFocused}
                    />
                </Box>
            </Box>
        );
    }

    return (
      <Box flexDirection="row" alignItems="center" marginBottom={1}>
        <Text bold color={isFocused ? 'cyan' : 'white'}>{isFocused ? '›' : '  '}{label}: </Text>
        <Text>{field === 'model' ? `[ ${config.model.padEnd(20)} ▼ ]` : displayValue}</Text>
      </Box>
    );
  };

  const renderButton = (label: string, field: FocusableField) => {
    const isFocused = focusedField === field;
    return (
        <Box borderStyle="round" borderColor={isFocused ? 'cyan' : 'grey'} paddingX={2} marginX={1}>
            <Text color={isFocused ? 'cyan' : 'white'}>{label}</Text>
        </Box>
    );
  };

  return (
    <Box flexDirection="column" padding={1} borderStyle="single">
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="blue">Configure Task: #{issueNumber} {issueTitle}</Text>
      </Box>

      <Box flexDirection="column" paddingX={2}>
        <Text bold underline marginBottom={1}>Agent Configuration</Text>
        {renderField('Model', 'model', config.model)}
        {renderField('Custom Instructions', 'customInstructions', config.customInstructions, true)}
        {renderField('Max Review Cycles (0-10)', 'maxReviewCycles', config.maxReviewCycles, true)}

        <Box flexDirection="row" marginTop={1} marginBottom={1} justifyContent="space-around">
            {renderField('Enable Review Agent', 'enableReviewAgent', config.enableReviewAgent)}
            {renderField('Auto-create PR', 'autoCreatePR', config.autoCreatePR)}
            {renderField('Require Tests', 'requireTests', config.requireTests)}
        </Box>
      </Box>

      <Box marginTop={2} flexDirection="row" justifyContent="center">
        {renderButton('Start Task', 'startButton')}
        {onSaveAsDefault && renderButton('Save as Default', 'saveButton')}
        {renderButton('Cancel', 'cancelButton')}
      </Box>

      <Box marginTop={1} justifyContent="center">
        <Text dimColor>[Enter] Select/Confirm [Esc] Cancel [Tab] Next Field [s] Save as Default</Text>
      </Box>
    </Box>
  );
};

export default TaskConfigScreen;
