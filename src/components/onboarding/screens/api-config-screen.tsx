import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { mockApiProviders, type ApiConfigData } from '../mocks/onboarding-data';

export interface ApiConfigScreenProps {
  apiConfig: ApiConfigData;
  onComplete: () => void;
  onBack: () => void;
  onUpdateConfig: (data: Partial<ApiConfigData>) => void;
}

type FormField = 'provider' | 'apiKey' | 'model' | 'continue';

export default function ApiConfigScreen({ 
  apiConfig, 
  onComplete, 
  onBack, 
  onUpdateConfig 
}: ApiConfigScreenProps): JSX.Element {
  const [activeField, setActiveField] = useState<FormField>('provider');
  const [isEditing, setIsEditing] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(apiConfig.apiKey);

  const currentProvider = mockApiProviders.find(p => p.name === apiConfig.provider);
  const availableModels = currentProvider?.models || [];

  useInput((input, key) => {
    if (key.escape) {
      if (isEditing) {
        setIsEditing(false);
        if (activeField === 'apiKey') {
          setTempApiKey(apiConfig.apiKey);
        }
      } else {
        onBack();
      }
      return;
    }

    if (key.tab || (key.downArrow && !isEditing)) {
      // Navigate to next field
      const fields: FormField[] = ['provider', 'apiKey', 'model', 'continue'];
      const currentIndex = fields.indexOf(activeField);
      const nextIndex = (currentIndex + 1) % fields.length;
      const nextField = fields[nextIndex];
      if (nextField) {
        setActiveField(nextField);
      }
      return;
    }

    if (key.upArrow && !isEditing) {
      // Navigate to previous field
      const fields: FormField[] = ['provider', 'apiKey', 'model', 'continue'];
      const currentIndex = fields.indexOf(activeField);
      const prevIndex = (currentIndex - 1 + fields.length) % fields.length;
      const prevField = fields[prevIndex];
      if (prevField) {
        setActiveField(prevField);
      }
      return;
    }

    if (input === 's' && !isEditing) {
      // Skip configuration
      onComplete();
      return;
    }

    if (key.return) {
      if (activeField === 'apiKey' && !isEditing) {
        setIsEditing(true);
        return;
      }

      if (activeField === 'apiKey' && isEditing) {
        onUpdateConfig({ apiKey: tempApiKey });
        setIsEditing(false);
        return;
      }

      if (activeField === 'provider') {
        // Cycle through providers
        const currentIndex = mockApiProviders.findIndex(p => p.name === apiConfig.provider);
        const nextIndex = (currentIndex + 1) % mockApiProviders.length;
        const nextProvider = mockApiProviders[nextIndex];
        if (nextProvider) {
          const newProvider = nextProvider.name;
          const newModel = nextProvider.models[0];
          if (newModel) {
            onUpdateConfig({ 
              provider: newProvider,
              model: newModel 
            });
          }
        }
        return;
      }

      if (activeField === 'model') {
        // Cycle through models for current provider
        const currentIndex = availableModels.indexOf(apiConfig.model);
        const nextIndex = (currentIndex + 1) % availableModels.length;
        const nextModel = availableModels[nextIndex];
        if (nextModel) {
          onUpdateConfig({ model: nextModel });
        }
        return;
      }

      if (activeField === 'continue') {
        // Complete onboarding
        onComplete();
        return;
      }

      // Default action - should not happen with current navigation
      return;
    }

    // Handle API key editing
    if (activeField === 'apiKey' && isEditing) {
      if (key.backspace || key.delete) {
        setTempApiKey(prev => prev.slice(0, -1));
      } else if (input && input.length === 1 && input.match(/[a-zA-Z0-9-_]/)) {
        setTempApiKey(prev => prev + input);
      }
    }
  });

  const maskApiKey = (key: string) => {
    if (!key) return '';
    const visibleChars = Math.min(4, key.length);
    const maskedPart = '*'.repeat(Math.max(0, key.length - visibleChars));
    const visiblePart = key.slice(-visibleChars);
    return maskedPart + visiblePart;
  };

  const getFieldDisplay = (field: FormField, isActive: boolean) => {
    const prefix = isActive ? '› ' : '  ';
    const color = isActive ? 'cyan' : undefined;
    
    switch (field) {
      case 'provider':
        return (
          <Box>
            <Text color={color}>{prefix}Provider: [{apiConfig.provider}                    ▼]</Text>
          </Box>
        );
      case 'apiKey':
        const displayKey = isEditing ? tempApiKey : apiConfig.apiKey;
        const maskedKey = isEditing ? displayKey : maskApiKey(displayKey);
        const keyDisplay = maskedKey.padEnd(36, '_');
        return (
          <Box>
            <Text color={color}>{prefix}API Key:  [{keyDisplay}]</Text>
          </Box>
        );
      case 'model':
        return (
          <Box>
            <Text color={color}>{prefix}Model: [{apiConfig.model}                  ▼]</Text>
          </Box>
        );
      case 'continue':
        return (
          <Box>
            <Text color={color}>{prefix}[Save & Continue]</Text>
          </Box>
        );
    }
  };

  return (
    <Box flexDirection="column" height="100%" borderStyle="single" borderColor="blue">
      {/* Header */}
      <Box justifyContent="center" paddingY={1}>
        <Text bold color="blue">Configure AI Summary API</Text>
      </Box>

      {/* Main content */}
      <Box flexGrow={1} flexDirection="column" paddingX={4} paddingY={2}>
        <Text>For generating task summaries, we need an AI API key.</Text>
        <Text>This is separate from Claude Code which handles the main agent work.</Text>
        <Text></Text>

        {/* Form fields */}
        <Box flexDirection="column" marginY={1}>
          {getFieldDisplay('provider', activeField === 'provider')}
          <Text></Text>
          {getFieldDisplay('apiKey', activeField === 'apiKey')}
          <Text></Text>
          {getFieldDisplay('model', activeField === 'model')}
          <Text></Text>
          {getFieldDisplay('continue', activeField === 'continue')}
        </Box>

        <Text></Text>

        {/* Why do we need this panel */}
        <Box 
          borderStyle="single" 
          borderColor="gray" 
          flexDirection="column" 
          paddingX={2} 
          paddingY={1}
        >
          <Text bold>Why do we need this?</Text>
          <Text>• Quick status summaries in the dashboard</Text>
          <Text>• Real-time progress updates</Text>
          <Text>• Issue classification and prioritization</Text>
          <Text>• Uses fast, cheap models (gpt-4o-mini)</Text>
        </Box>
      </Box>

      {/* Footer */}
      <Box borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} paddingX={2} paddingY={1}>
        <Text dimColor>[Enter] Save & Continue  [s] Skip for Now  [Tab] Next Field</Text>
      </Box>
    </Box>
  );
}