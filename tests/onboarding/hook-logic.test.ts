import { describe, it, expect } from "vitest";
import { mockGitHubAuth, mockApiConfig } from "../../src/components/onboarding/mocks/onboarding-data.js";

describe("Onboarding Hook Logic", () => {
  it("mock data has correct initial values", () => {
    expect(mockGitHubAuth.deviceCode).toBe('ABCD-1234');
    expect(mockGitHubAuth.expiresIn).toBe(900);
    expect(mockGitHubAuth.status).toBe('waiting');
    
    expect(mockApiConfig.provider).toBe('OpenAI');
    expect(mockApiConfig.model).toBe('gpt-4o-mini');
    expect(mockApiConfig.apiKey).toBe('');
  });

  it("API providers have correct structure", () => {
    // This tests the mock data structure that the hook relies on
    const { mockApiProviders } = require("../../src/components/onboarding/mocks/onboarding-data.js");
    
    expect(mockApiProviders).toHaveLength(3);
    expect(mockApiProviders[0].name).toBe('OpenAI');
    expect(mockApiProviders[0].models).toContain('gpt-4o-mini');
    expect(mockApiProviders[1].name).toBe('Anthropic');
    expect(mockApiProviders[1].models).toContain('claude-3-5-sonnet');
  });
});