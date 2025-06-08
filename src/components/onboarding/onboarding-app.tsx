import React from 'react';
import { Box, Text, useApp } from 'ink';
import { useOnboardingFlow } from './hooks/use-onboarding-flow';
import SplashScreen from './screens/splash-screen';
import GitHubAuthScreen from './screens/github-auth-screen';
import ApiConfigScreen from './screens/api-config-screen';

export interface OnboardingAppProps {
  onComplete?: () => void;
}

export default function OnboardingApp({ onComplete }: OnboardingAppProps): JSX.Element {
  const app = useApp();
  const {
    currentScreen,
    githubAuth,
    apiConfig,
    navigateForward,
    navigateBackward,
    completeOnboarding,
    updateGitHubAuth,
    updateApiConfig,
  } = useOnboardingFlow();

  const handleComplete = () => {
    completeOnboarding();
    onComplete?.();
  };

  const handleExit = () => {
    app.exit();
  };

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'splash':
        return (
          <SplashScreen 
            onContinue={navigateForward} 
            onExit={handleExit}
          />
        );
      
      case 'github-auth':
        return (
          <GitHubAuthScreen 
            authData={githubAuth}
            onSuccess={navigateForward} 
            onBack={navigateBackward}
            onUpdateAuth={updateGitHubAuth}
          />
        );
      
      case 'api-config':
        return (
          <ApiConfigScreen 
            apiConfig={apiConfig}
            onComplete={handleComplete} 
            onBack={navigateBackward}
            onUpdateConfig={updateApiConfig}
          />
        );
      
      default:
        return <Box><Text>Invalid screen state</Text></Box>;
    }
  };

  return (
    <Box flexDirection="column" height="100%">
      {renderCurrentScreen()}
    </Box>
  );
}