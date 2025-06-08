import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { type GitHubAuthData } from '../mocks/onboarding-data';

export interface GitHubAuthScreenProps {
  authData: GitHubAuthData;
  onSuccess: () => void;
  onBack: () => void;
  onUpdateAuth: (data: Partial<GitHubAuthData>) => void;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export default function GitHubAuthScreen({ 
  authData, 
  onSuccess, 
  onBack, 
  onUpdateAuth 
}: GitHubAuthScreenProps): JSX.Element {
  const [timeOnScreen, setTimeOnScreen] = useState(0);

  // Countdown timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      onUpdateAuth({ 
        expiresIn: Math.max(0, authData.expiresIn - 1) 
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [authData.expiresIn, onUpdateAuth]);

  // Auto-advance timer (after 3 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeOnScreen(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Auto-advance to next screen after 3 seconds
  useEffect(() => {
    if (timeOnScreen >= 3 && authData.status === 'waiting') {
      onUpdateAuth({ status: 'success' });
      setTimeout(() => {
        onSuccess();
      }, 500);
    }
  }, [timeOnScreen, authData.status, onUpdateAuth, onSuccess]);

  useInput((input, key) => {
    if (key.return) {
      // Simulate auth check - always succeeds
      onUpdateAuth({ status: 'success' });
      setTimeout(() => {
        onSuccess();
      }, 500);
    } else if (input === 'r') {
      // Reset timer
      onUpdateAuth({ 
        expiresIn: 900,
        status: 'waiting'
      });
      setTimeOnScreen(0);
    } else if (input === 'm') {
      // Manual token entry - show message for now
      console.log('Manual token entry will be implemented later');
    } else if (key.escape) {
      onBack();
    }
  });

  const getStatusMessage = () => {
    switch (authData.status) {
      case 'waiting':
        return 'Waiting for browser authentication...';
      case 'checking':
        return 'Checking authentication status...';
      case 'success':
        return 'Authentication successful!';
    }
  };

  const getStatusColor = () => {
    switch (authData.status) {
      case 'waiting':
        return 'yellow';
      case 'checking':
        return 'blue';
      case 'success':
        return 'green';
    }
  };

  return (
    <Box flexDirection="column" height="100%" borderStyle="single" borderColor="blue">
      {/* Header */}
      <Box justifyContent="center" paddingY={1}>
        <Text bold color="blue">GitHub Authentication</Text>
      </Box>

      {/* Main content */}
      <Box flexGrow={1} flexDirection="column" paddingX={4} paddingY={2}>
        <Text>To access your repositories, we need to authenticate with GitHub.</Text>
        <Text></Text>
        <Text>This will open your browser to complete authentication.</Text>
        <Text></Text>

        {/* Authentication Status Panel */}
        <Box 
          borderStyle="single" 
          borderColor="gray" 
          flexDirection="column" 
          paddingX={2} 
          paddingY={1}
          marginY={1}
        >
          <Text bold>Authentication Status</Text>
          <Text></Text>
          <Text color={getStatusColor()}>{getStatusMessage()}</Text>
          <Text></Text>
          <Text>Device Code: <Text bold color="cyan">{authData.deviceCode}</Text></Text>
          <Text>Expires in: <Text bold color="yellow">{formatTime(authData.expiresIn)}</Text></Text>
        </Box>

        <Text>After authenticating, press [Enter] to continue...</Text>
      </Box>

      {/* Footer */}
      <Box borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} paddingX={2} paddingY={1}>
        <Text dimColor>[Enter] Check Status  [r] Retry  [m] Manual Token  [Esc] Back</Text>
      </Box>
    </Box>
  );
}