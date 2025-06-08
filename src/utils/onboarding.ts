/**
 * Check if user has already completed onboarding
 * For now, this is a simple check - in the future this could check for
 * saved configuration files, auth tokens, etc.
 */
export function isAlreadyOnboarded(): boolean {
  // For development, always return false to show onboarding
  // In production, this would check for saved config
  return false;
}

/**
 * Check if onboarding should be skipped based on environment variable
 */
export function shouldSkipOnboarding(): boolean {
  return process.env['SKIP_ONBOARDING'] === 'true';
}