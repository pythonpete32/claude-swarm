# Onboarding Flow Implementation PRD

## Overview & Goals

Create a complete onboarding flow UI for the Agent Task Manager terminal application. This implementation focuses on building the user interface components with realistic mock data, supporting backward navigation, and comprehensive component-level testing.

**Primary Goal:** Build polished UI components for the 3-screen onboarding flow that users will experience on first run.

**Scope:** UI components only - no external service integration, persistence, or error handling beyond happy path scenarios.

## User Flow & Experience

### Onboarding Sequence
1. **Splash Screen** - Welcome message + prerequisites check display
2. **GitHub Auth Screen** - Device flow simulation with countdown
3. **API Config Screen** - API key input with provider selection
4. **Completion** - Transition to main application

### Navigation Rules
- **Forward:** Enter/Space key advances to next screen
- **Backward:** Escape key returns to previous screen (except from splash)
- **Exit:** Ctrl+C exits application entirely

### Skip Mechanism
- Environment variable `SKIP_ONBOARDING=true` bypasses entire onboarding flow
- When skipped, app proceeds directly to main application

## Technical Architecture

### Entry Point Modification
```typescript
// src/cli.tsx modification
const shouldOnboard = !process.env.SKIP_ONBOARDING && !isAlreadyOnboarded();
const App = shouldOnboard ? OnboardingApp : MainApp;
```

### Component Structure
```
src/components/onboarding/
├── onboarding-app.tsx              # Main coordinator
├── screens/
│   ├── splash-screen.tsx           # Welcome + prerequisites  
│   ├── github-auth-screen.tsx      # Device auth simulation
│   └── api-config-screen.tsx       # API key configuration
├── hooks/
│   └── use-onboarding-flow.ts      # State management & navigation
└── mocks/
    └── onboarding-data.ts          # Hardcoded mock data
```

### State Management
- Single hook `useOnboardingFlow()` manages current screen and navigation
- In-memory state only (no persistence)
- State shape:
```typescript
{
  currentScreen: 'splash' | 'github-auth' | 'api-config',
  canGoBack: boolean,
  githubAuth: { deviceCode: string, expiresIn: number },
  apiConfig: { provider: string, apiKey: string, model: string }
}
```

## Screen Specifications

### 1. Splash Screen (`splash-screen.tsx`)

**Layout:** Two-column with welcome text (left) and prerequisites check (right)

**Mock Data:**
```typescript
const prerequisites = [
  { name: 'Claude Code CLI', status: 'installed' },
  { name: 'GitHub CLI (gh)', status: 'installed' },
  { name: 'GitHub Auth', status: 'not_found' },
  { name: 'API Key', status: 'required' }
];
```

**Interactions:**
- Enter key → advance to GitHub Auth
- Escape → none (first screen)

**UI Elements:**
- Title: "Agent Task Manager"
- Subtitle: "Autonomous GitHub Issue Resolution"
- Bullet points about capabilities
- Prerequisites checklist with status icons
- Footer: "[Enter] Continue [q] Quit"

### 2. GitHub Auth Screen (`github-auth-screen.tsx`)

**Layout:** Single column with auth status panel and countdown

**Mock Data:**
```typescript
const authData = {
  deviceCode: 'ABCD-1234',
  expiresIn: 900, // 15 minutes in seconds
  status: 'waiting'
};
```

**Interactions:**
- Enter key → check auth status (always succeeds)
- 'r' key → retry (restart countdown)
- 'm' key → manual token entry (future feature - show message)
- Escape → back to splash

**UI Elements:**
- Title: "GitHub Authentication"
- Device code display
- Countdown timer (mm:ss format)
- Status message: "Waiting for browser authentication..."
- Footer: "[Enter] Check Status [r] Retry [m] Manual Token [Esc] Back"

**Behavior:**
- Countdown decrements every second (fake timer)
- After 3 seconds on screen, auto-advance to next step

### 3. API Config Screen (`api-config-screen.tsx`)

**Layout:** Form-style with provider dropdown, API key input, and model selection

**Mock Data:**
```typescript
const providers = ['OpenAI', 'Anthropic', 'Azure OpenAI'];
const models = {
  'OpenAI': ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
  'Anthropic': ['claude-3-5-sonnet', 'claude-3-haiku'],
  'Azure OpenAI': ['gpt-4o-mini', 'gpt-4o']
};
```

**Interactions:**
- Tab/Arrow keys → navigate form fields
- Enter on dropdowns → cycle options
- Enter on text input → accept input
- 's' key → skip configuration
- Enter on "Save & Continue" → complete onboarding
- Escape → back to GitHub Auth

**UI Elements:**
- Title: "Configure AI Summary API"
- Provider dropdown with arrow indicator
- API key input field (masked with asterisks)
- Model dropdown
- Explanation panel about why API key is needed
- Footer: "[Enter] Save & Continue [s] Skip for Now [Tab] Next Field"

## Component Implementation Details

### OnboardingApp (`onboarding-app.tsx`)
```typescript
interface OnboardingAppProps {}

export default function OnboardingApp(): JSX.Element {
  const {
    currentScreen,
    canGoBack,
    navigateForward,
    navigateBackward,
    completeOnboarding
  } = useOnboardingFlow();

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'splash': return <SplashScreen onContinue={navigateForward} />;
      case 'github-auth': return <GitHubAuthScreen onSuccess={navigateForward} onBack={navigateBackward} />;
      case 'api-config': return <ApiConfigScreen onComplete={completeOnboarding} onBack={navigateBackward} />;
    }
  };

  return <Box flexDirection="column">{renderCurrentScreen()}</Box>;
}
```

### useOnboardingFlow Hook
```typescript
export function useOnboardingFlow() {
  const [currentScreen, setCurrentScreen] = useState<OnboardingScreen>('splash');
  const [authData, setAuthData] = useState(mockAuthData);
  const [apiConfig, setApiConfig] = useState(mockApiConfig);
  
  const navigateForward = () => { /* screen transition logic */ };
  const navigateBackward = () => { /* back navigation logic */ };
  const completeOnboarding = () => { /* transition to main app */ };

  return { currentScreen, navigateForward, navigateBackward, /* ... */ };
}
```

## Testing Strategy

### Component Test Coverage
Each screen component gets comprehensive tests following existing patterns:

**1. Splash Screen Tests:**
- Renders welcome content and prerequisites correctly
- Shows proper status icons for each prerequisite  
- Handles Enter key navigation
- Footer displays correct instructions

**2. GitHub Auth Screen Tests:**
- Displays device code and countdown
- Timer decrements properly (using fake timers)
- Handles all keyboard interactions (Enter, 'r', 'm', Escape)
- Auto-advances after success simulation

**3. API Config Screen Tests:**  
- Form fields render and accept input
- Tab navigation works between fields
- Dropdown cycling functions correctly
- API key masking works properly
- Skip functionality works

**4. OnboardingApp Tests:**
- Screen transitions work correctly
- Navigation state updates properly
- Integration between hook and components

**5. Hook Tests:**
- State transitions follow expected flow
- Navigation guards work (can't go back from splash)
- Completion triggers app transition

### Test File Structure
```
tests/onboarding/
├── splash-screen.test.tsx
├── github-auth-screen.test.tsx  
├── api-config-screen.test.tsx
├── onboarding-app.test.tsx
└── use-onboarding-flow.test.ts
```

### Testing Patterns Used
- `renderTui()` helper for component rendering
- `type()` helper for keyboard input simulation
- Fake timers for countdown testing
- Mock data imports for consistent test state

## Implementation Plan

### Phase 1: Core Foundation
1. Create `useOnboardingFlow` hook with state management
2. Set up mock data constants
3. Create `OnboardingApp` coordinator component
4. Implement basic screen switching logic

### Phase 2: Screen Components  
1. Build `SplashScreen` with prerequisites display
2. Build `GitHubAuthScreen` with countdown timer
3. Build `ApiConfigScreen` with form elements
4. Implement keyboard navigation for each screen

### Phase 3: Integration & Polish
1. Wire up screen-to-screen navigation
2. Add backward navigation support
3. Implement completion transition
4. Add SKIP_ONBOARDING environment variable support

### Phase 4: Comprehensive Testing
1. Write component tests for each screen
2. Test navigation flows and keyboard interactions
3. Test hook behavior and state management
4. Verify mock data displays correctly

## Acceptance Criteria

### Functional Requirements
- [ ] All three onboarding screens render correctly with mock data
- [ ] Forward navigation works with Enter/Space keys
- [ ] Backward navigation works with Escape key (except splash)
- [ ] Skip onboarding works with `SKIP_ONBOARDING=true`
- [ ] Completion transitions to main app
- [ ] Countdown timer functions on auth screen
- [ ] Form inputs work on API config screen

### Technical Requirements
- [ ] All components follow existing codebase patterns
- [ ] Comprehensive test coverage for each component
- [ ] TypeScript types defined for all interfaces
- [ ] Mock data is realistic and displays properly
- [ ] No external service dependencies
- [ ] Clean separation between UI and state logic

### Quality Requirements
- [ ] All tests pass with `bun test`
- [ ] TypeScript compilation succeeds
- [ ] ESLint passes without warnings
- [ ] Components handle edge cases gracefully
- [ ] Keyboard navigation is intuitive and consistent
- [ ] UI matches design specifications from TUI_DESIGN.md

## Success Metrics

**Implementation Complete When:**
1. `bun dev` shows onboarding flow on first run
2. `SKIP_ONBOARDING=true bun dev` bypasses to main app
3. All three screens display correctly with realistic data
4. Navigation works flawlessly in both directions
5. Component test suite has 100% coverage
6. All acceptance criteria are met

This PRD provides complete specification for building the onboarding flow UI components with the requested mock data, navigation, and testing approach.