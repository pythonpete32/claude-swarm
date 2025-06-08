import { useState, useCallback } from 'react';
import { mockGitHubAuth, mockApiConfig, type GitHubAuthData, type ApiConfigData } from '../mocks/onboarding-data';

export type OnboardingScreen = 'splash' | 'github-auth' | 'api-config';

export interface OnboardingFlowState {
  currentScreen: OnboardingScreen;
  canGoBack: boolean;
  githubAuth: GitHubAuthData;
  apiConfig: ApiConfigData;
}

export interface OnboardingFlowActions {
  navigateForward: () => void;
  navigateBackward: () => void;
  completeOnboarding: () => void;
  updateGitHubAuth: (data: Partial<GitHubAuthData>) => void;
  updateApiConfig: (data: Partial<ApiConfigData>) => void;
}

export function useOnboardingFlow(): OnboardingFlowState & OnboardingFlowActions {
  const [currentScreen, setCurrentScreen] = useState<OnboardingScreen>('splash');
  const [githubAuth, setGitHubAuth] = useState<GitHubAuthData>(mockGitHubAuth);
  const [apiConfig, setApiConfig] = useState<ApiConfigData>(mockApiConfig);

  const canGoBack = currentScreen !== 'splash';

  const navigateForward = useCallback(() => {
    switch (currentScreen) {
      case 'splash':
        setCurrentScreen('github-auth');
        break;
      case 'github-auth':
        setCurrentScreen('api-config');
        break;
      case 'api-config':
        // This will be handled by completeOnboarding
        break;
    }
  }, [currentScreen]);

  const navigateBackward = useCallback(() => {
    if (!canGoBack) return;
    
    switch (currentScreen) {
      case 'github-auth':
        setCurrentScreen('splash');
        break;
      case 'api-config':
        setCurrentScreen('github-auth');
        break;
    }
  }, [currentScreen, canGoBack]);

  const completeOnboarding = useCallback(() => {
    // This will trigger app transition - for now just a placeholder
    console.log('Onboarding completed, transitioning to main app...');
  }, []);

  const updateGitHubAuth = useCallback((data: Partial<GitHubAuthData>) => {
    setGitHubAuth(prev => ({ ...prev, ...data }));
  }, []);

  const updateApiConfig = useCallback((data: Partial<ApiConfigData>) => {
    setApiConfig(prev => ({ ...prev, ...data }));
  }, []);

  return {
    currentScreen,
    canGoBack,
    githubAuth,
    apiConfig,
    navigateForward,
    navigateBackward,
    completeOnboarding,
    updateGitHubAuth,
    updateApiConfig,
  };
}