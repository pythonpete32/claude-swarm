import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import stripAnsi from "strip-ansi";
import SplashScreen from "../../src/components/onboarding/screens/splash-screen.js";
import { mockGitHubAuth, mockApiConfig } from "../../src/components/onboarding/mocks/onboarding-data.js";

describe("Onboarding Component Rendering", () => {
  it("SplashScreen renders welcome content", () => {
    const onContinue = () => {};
    const { lastFrame } = render(<SplashScreen onContinue={onContinue} />);
    
    const frame = stripAnsi(lastFrame() || "");
    expect(frame).toContain("Agent Task Manager");
    expect(frame).toContain("Welcome! Let's get you started.");
    expect(frame).toContain("Prerequisites Check:");
  });

  it("Mock data is properly structured", () => {
    expect(mockGitHubAuth.deviceCode).toBe('ABCD-1234');
    expect(mockGitHubAuth.expiresIn).toBe(900);
    expect(mockGitHubAuth.status).toBe('waiting');
    
    expect(mockApiConfig.provider).toBe('OpenAI');
    expect(mockApiConfig.model).toBe('gpt-4o-mini');
    expect(mockApiConfig.apiKey).toBe('');
  });
});