# TUI Agent Task Manager - Design Document

## Overview
A terminal-based task management system for orchestrating multiple Claude Code agents working asynchronously on GitHub issues within a repository.

## Screen Flow

1. Initial Splash → GitHub Auth → API Config → Repository Selection
2. Repository Selection → (Download if needed) → Task Dashboard
3. Task Dashboard → Task Detail View / Issue Creation / Configuration

## Screen Architecture

### Screen: Task Dashboard (Main)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Repo: acme/webapp    [e] Editor  [s] Settings    [Tab] Issues  Running       │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─ Ad-hoc Task ───────────────────────────────────────────────────────────┐ │
│ │ > Run quick task: _                                    [Ctrl+Enter] Run  │ │
│ └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ ┌─ Active Agents (3/5 slots) ──────────────────────────────────────────────┐ │
│ │ #42  Fix auth middleware timeout    │ "Implementing backoff"   │ 5m 23s  │ │
│ │ #41  Add user profile API           │ "Tests passing, ready"   │ 1m 45s  │ │
│ │ #37  Refactor database connections  │ "PR awaiting review"     │ 12m 08s │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ ┌─ Issues ─────────────────────────────────────────────────────────────────┐ │
│ │   Open 26    Closed 142                                                  │ │
│ ├───────────────────────────────────────────────────────────────────────────┤ │
│ │ [ ] #45 [FEATURE] Implement webhook handlers            enhancement     │ │
│ │     pythonpete32 opened 2 days ago                                       │ │
│ │                                                                           │ │
│ │ [ ] #44 [BUG] Fix memory leak in worker threads         bug  critical   │ │
│ │     janedoe opened 3 days ago                                            │ │
│ │                                                                           │ │
│ │ [ ] #43 [TASK] Update dependencies to latest versions   maintenance     │ │
│ │     devops-bot opened 1 week ago                                         │ │
│ │                                                                           │ │
│ │ [ ] #40 [FEATURE] Add OAuth2 integration                enhancement     │ │
│ │     mikechan opened 1 week ago                                           │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ [↑↓] Navigate  [Enter] View Details  [n] New Issue  [c] Configure  [r] Run  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### User Story: Quick Task Execution
- As a developer, I want to run ad-hoc tasks without creating GitHub issues
- **Acceptance Criteria:**
  - [ ] Can type task description in ad-hoc input box
  - [ ] Ctrl+Enter submits task to next available agent slot
  - [ ] Task appears in Active Agents panel immediately
  - [ ] No GitHub issue is created for ad-hoc tasks
  - [ ] Ad-hoc tasks show with temporary ID (e.g., "tmp-1")

### User Story: Active Agent Monitoring
- As a developer, I want to see AI-summarized status of running agents
- **Acceptance Criteria:**
  - [ ] Each active agent shows issue number and title
  - [ ] Middle column shows AI-generated status summary
  - [ ] Runtime is displayed and updates every second
  - [ ] Completed tasks show clickable PR links
  - [ ] Can click on any active agent to see detail view

---

### Screen: Task Configuration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Configure Task: #44 [BUG] Fix memory leak in worker threads                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ┌─ Agent Configuration ────────────────────────────────────────────────────┐ │
│ │                                                                           │ │
│ │   Model:            [claude-3-5-sonnet        ▼]                         │ │
│ │                                                                           │ │
│ │   Custom Instructions:                                                    │ │
│ │   ┌─────────────────────────────────────────────────────────────────┐   │ │
│ │   │ Focus on memory profiling and leak detection.                   │   │ │
│ │   │ Check for circular references and event listener cleanup.       │   │ │
│ │   └─────────────────────────────────────────────────────────────────┘   │ │
│ │                                                                           │ │
│ │   [✓] Enable Review Agent                                                │ │
│ │   Max Review Cycles:     [3    ]                                         │ │
│ │   [✓] Auto-create PR on success                                          │ │
│ │   [ ] Require tests to pass                                              │ │
│ │                                                                           │ │
│ └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Enter] Start Task  [Esc] Cancel  [Tab] Next Field  [s] Save as Default     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### User Story: Task Configuration
- As a developer, I want to configure agent behavior before running
- **Acceptance Criteria:**
  - [ ] Model selection dropdown with available Claude models
  - [ ] Custom instructions text area for task-specific guidance
  - [ ] Toggle for review agent with max cycles setting
  - [ ] Auto-PR creation toggle
  - [ ] Can save configuration as default
  - [ ] Enter starts task, Escape returns to dashboard

---

### Screen: Task Detail View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ #42: Fix auth middleware timeout | Coding Agent Rev 2/3 | Running 15m       │
├────────────────────────────────────┬────────────────────────────────────────┤
│                                    │ [✓] Analyze auth middleware code       │
│                                    │ [✓] Identify timeout issue             │
│                                    │ [●] Add retry logic                    │
│                                    │ [ ] Update tests                       │
│                                    │ [ ] Test error scenarios               │
│                                    ├────────────────────────────────────────┤
│                                    │ [15:23] Starting revision 2...         │
│                                    │ [15:23] Reading auth.middleware.ts     │
│                                    │ [15:24] Found timeout at line 47       │
│                                    │ [15:24] Implementing retry wrapper      │
│                                    │ [15:25] > Added exponential backoff     │
│                                    │ [15:25] > Max retries set to 3         │
│                                    │ [15:26] Running tests...               │
│                                    │ [15:26] > auth.test.ts PASSED          │
│                                    │ [15:27] Writing changes...             │
│                                    │ [15:27] Committing changes             │
│                                    │ [15:28] Running linter...              │
│                                    │ [15:28] > No issues found              │
│                                    │ ▊                                      │
│ > _                                │                                        │
├────────────────────────────────────┴────────────────────────────────────────┤
│ [Enter] Send  [Esc] Dashboard  [s] Stop  [l] Full Log  [↑↓] Scroll         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### User Story: Real-time Task Monitoring
- As a developer, I want to monitor agent progress in real-time
- **Acceptance Criteria:**
  - [ ] Activity log auto-scrolls with new entries
  - [ ] Can scroll back through full history
  - [ ] Task list shows real-time checkbox updates
  - [ ] Shows current agent type and revision count in header
  - [ ] Runtime updates every second
  - [ ] Can stop task with 's' key

### User Story: Agent Interruption
- As a developer, I want to guide agents while they're working
- **Acceptance Criteria:**
  - [ ] Input field at bottom left for sending messages
  - [ ] Enter key sends message to running agent
  - [ ] Agent incorporates feedback in real-time
  - [ ] Input clears after sending
  - [ ] Can access command history with up/down arrows

---

### Screen: Issue Creation (Canvas-style)

```
┌──────────────────────────────────┬──────────────────────────────────────────┐
│ Create Issue with AI             │ Issue Preview                            │
├──────────────────────────────────┼──────────────────────────────────────────┤
│ > Describe the task:             │ ## Title: Implement User Analytics API   │
│                                  │                                          │
│ We need to track user behavior   │ ## Description:                          │
│ across the app. Should capture   │ Create a comprehensive analytics API     │
│ page views, clicks, and time     │ that tracks user interactions including: │
│ spent. Need GDPR compliance.     │                                          │
│                                  │ - Page view events with timestamps      │
│ [AI Response]                    │ - Click events on interactive elements  │
│ I'll help structure this issue.  │ - Session duration tracking              │
│ Key considerations:              │ - GDPR-compliant data collection         │
│ - Event batching for performance │                                          │
│ - User consent management        │ ## Acceptance Criteria:                  │
│ - Data retention policies        │ - [ ] Event collection endpoint          │
│                                  │ - [ ] Batch processing (100 events/req)  │
│ > Should we include A/B testing? │ - [ ] User consent verification          │
│ _                                │ - [ ] Data anonymization                 │
│                                  │ - [ ] Retention policy (90 days)         │
│                                  │                                          │
│ [Enter] Send  [Ctrl+S] Save Issue│ ## Technical Notes:                      │
│                                  │ - Use PostgreSQL for event storage       │
│                                  │ - Consider Redis for event queue         │
└──────────────────────────────────┴──────────────────────────────────────────┘
```

### User Story: AI-Assisted Issue Creation
- As a product manager, I want AI help to create well-structured issues
- **Acceptance Criteria:**
  - [ ] Natural language input converts to structured issue format
  - [ ] AI suggests acceptance criteria based on description
  - [ ] Can have back-and-forth conversation to refine
  - [ ] Preview updates in real-time
  - [ ] Ctrl+S creates GitHub issue and returns to dashboard

---

---

### Screen: Initial Splash / Onboarding

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Agent Task Manager                                 │
│                                                                              │
│                    Autonomous GitHub Issue Resolution                        │
│                         Powered by Claude Code                               │
├──────────────────────────────────┬──────────────────────────────────────────┤
│                                  │ Prerequisites Check:                     │
│ Welcome! Let's get you started.  │                                          │
│                                  │ [✓] Claude Code CLI         Installed   │
│ This tool orchestrates multiple  │ [✓] GitHub CLI (gh)         Installed   │
│ AI agents to work on your GitHub │ [✗] GitHub Auth             Not found   │
│ issues autonomously.             │ [ ] API Key                 Required    │
│                                  │                                          │
│ • Agents work asynchronously     │ Required Actions:                        │
│ • Auto-creates PRs               │ 1. Authenticate GitHub                   │
│ • Manages review cycles          │ 2. Configure API key for summaries      │
│ • Tracks progress in real-time   │                                          │
│                                  │                                          │
│ Press [Enter] to begin setup...  │ [Enter] Continue  [q] Quit              │
└──────────────────────────────────┴──────────────────────────────────────────┘
```

### User Story: First-time Onboarding
- As a new user, I want a smooth setup experience
- **Acceptance Criteria:**
  - [ ] Prerequisites are checked automatically
  - [ ] Clear indication of what's missing
  - [ ] GitHub auth uses device flow
  - [ ] API key setup is optional but recommended
  - [ ] Can skip and configure later

---

### Screen: GitHub Authentication

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ GitHub Authentication                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ To access your repositories, we need to authenticate with GitHub.           │
│                                                                              │
│ This will open your browser to complete authentication.                      │
│                                                                              │
│ ┌─ Authentication Status ──────────────────────────────────────────────────┐ │
│ │                                                                          │ │
│ │   Waiting for browser authentication...                                  │ │
│ │                                                                          │ │
│ │   Device Code: ABCD-1234                                                │ │
│ │   Expires in: 14:32                                                     │ │
│ │                                                                          │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ After authenticating, press [Enter] to continue...                          │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Enter] Check Status  [r] Retry  [m] Manual Token  [Esc] Back              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Screen: API Configuration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Configure AI Summary API                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ For generating task summaries, we need an AI API key.                       │
│ This is separate from Claude Code which handles the main agent work.        │
│                                                                              │
│ Provider: [OpenAI                    ▼]                                      │
│                                                                              │
│ API Key:  [********************************____]                           │
│                                                                              │
│ ┌─ Why do we need this? ──────────────────────────────────────────────────┐ │
│ │ • Quick status summaries in the dashboard                               │ │
│ │ • Real-time progress updates                                            │ │
│ │ • Issue classification and prioritization                               │ │
│ │ • Uses fast, cheap models (gpt-4o-mini)                                 │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ Model: [gpt-4o-mini                  ▼]                                      │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Enter] Save & Continue  [s] Skip for Now  [Tab] Next Field                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Screen: Repository Selection

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Select Repository                              user: janedoe | [s] Settings  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ┌─ Recent Projects ────────────────────────────────────────────────────────┐ │
│ │                                                                          │ │
│ │  1. acme/webapp                    3 active | 12 done | 2 hours ago    │ │
│ │  2. acme/mobile-app                1 active | 8 done  | yesterday      │ │
│ │  3. personal/blog-engine           0 active | 5 done  | 3 days ago     │ │
│ │                                                                          │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ ┌─ Available on GitHub ────────────────────────────────────────────────────┐ │
│ │                                                                          │ │
│ │  4. acme/api-gateway              42 open issues                        │ │
│ │  5. acme/documentation            8 open issues                         │ │
│ │  6. tools/deployment-scripts      3 open issues                         │ │
│ │  7. experimental/ml-pipeline      16 open issues                        │ │
│ │                                                                          │ │
│ │  + Browse all repositories...                                           │ │
│ │                                                                          │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ > _                                                                          │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ Type number or repository name. [Enter] to select. [Ctrl+C] to exit.        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### User Story: Repository Management
- As a developer, I want to easily switch between projects
- **Acceptance Criteria:**
  - [ ] Recent projects shown at top
  - [ ] Can browse all GitHub repos
  - [ ] Shows issue count for each repo
  - [ ] Repos downloaded automatically on first use
  - [ ] Quick number selection or name search
  - [ ] Can open repo in preferred editor from dashboard

---

### Screen: Downloading Repository

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Setting up: acme/api-gateway                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ┌─ Progress ───────────────────────────────────────────────────────────────┐ │
│ │                                                                          │ │
│ │  Cloning repository...           ████████████████░░░░  80%              │ │
│ │                                                                          │ │
│ │  ✓ Repository cloned                                                    │ │
│ │  ✓ Worktree configured                                                  │ │
│ │  ✓ GitHub issues fetched (42 open)                                      │ │
│ │  ⟳ Setting up agent workspace...                                        │ │
│ │  ○ Indexing codebase...                                                 │ │
│ │                                                                          │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│ This may take a few moments for large repositories...                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

---

### Screen: Settings/Configuration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Settings                                                            [s] Save │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ ┌─ Agent Configuration ────────────────────────────────────────────────────┐ │
│ │                                                                           │ │
│ │   Default Model:        [claude-3-5-sonnet        ▼]                     │ │
│ │   Max Concurrent Agents: [5      ]                                       │ │
│ │   [✓] Enable Review Agent by default                                     │ │
│ │   Default Max Reviews:   [3      ]                                       │ │
│ │   [✓] Auto-create PRs on success                                         │ │
│ │   [✓] Run tests before creating PR                                       │ │
│ │                                                                           │ │
│ └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ ┌─ Editor Integration ─────────────────────────────────────────────────────┐ │
│ │                                                                           │ │
│ │   Preferred Editor:     [Cursor               ▼]                         │ │
│ │                        (VS Code, Cursor, Vim, Nano)                      │ │
│ │                                                                           │ │
│ └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ ┌─ API Keys ───────────────────────────────────────────────────────────────┐ │
│ │                                                                           │ │
│ │   Summary Provider:     [OpenAI               ▼]                         │ │
│ │   API Key:              [*********************_____] [t] Test           │ │
│ │   Model:                [gpt-4o-mini          ▼]                         │ │
│ │                                                                           │ │
│ └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ ┌─ GitHub Integration ─────────────────────────────────────────────────────┐ │
│ │                                                                           │ │
│ │   Authenticated as:     janedoe                           [r] Reconnect  │ │
│ │   [✓] Auto-sync issues every 5 minutes                                   │ │
│ │   [✓] Create draft PRs by default                                        │ │
│ │                                                                           │ │
│ └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Tab] Next Field  [Enter] Save  [Esc] Cancel  [d] Reset to Defaults        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### User Story: Global Configuration
- As a developer, I want to set preferences once and apply them to all projects
- **Acceptance Criteria:**
  - [ ] Accessible via [s] key or menu item in dashboard header
  - [ ] Default agent model selection applies to new tasks
  - [ ] Editor preset selection (VS Code, Cursor, Vim, Nano)
  - [ ] API key management with test functionality
  - [ ] GitHub integration settings
  - [ ] Can reset all settings to defaults

---

### Screen: Full Log View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Full Log: #42 Fix auth middleware timeout                         [Esc] Back │
├─────────────────────────────────────────────────────────────────────────────┤
│ Filter: [All Levels ▼] [●] Auto-scroll  Search: _               [/] Find    │
├─────────────────────────────────────────────────────────────────────────────┤
│ [15:18:45] INFO  Starting task execution                                     │
│ [15:18:45] INFO  Repository: acme/webapp                                     │
│ [15:18:45] INFO  Issue: #42 - Fix auth middleware timeout                    │
│ [15:18:45] INFO  Model: claude-3-5-sonnet                                    │
│ [15:18:46] DEBUG Initializing Claude Code session                            │
│ [15:18:47] INFO  Session established: sess_abc123                            │
│ [15:18:47] USER  Initial prompt sent to agent                                │
│ [15:18:48] AGENT Reading issue description...                                │
│ [15:18:49] AGENT Analyzing auth middleware code                              │
│ [15:18:52] DEBUG Found file: src/middleware/auth.js                          │
│ [15:18:53] AGENT Located timeout issue at line 47                           │
│ [15:18:54] AGENT Current timeout: 5000ms, needs increase                     │
│ [15:18:55] AGENT Implementing retry logic with exponential backoff          │
│ [15:19:12] DEBUG File modified: src/middleware/auth.js                       │
│ [15:19:13] AGENT Added retry mechanism with max 3 attempts                  │
│ [15:19:14] AGENT Running existing tests...                                   │
│ [15:19:18] TEST  npm test -- auth.test.js                                    │
│ [15:19:22] TEST  ✓ All auth tests passing                                    │
│ [15:19:22] AGENT Creating new test for retry logic                           │
│ [15:19:28] DEBUG File created: src/tests/auth-retry.test.js                  │
│ [15:19:30] TEST  Running new retry tests...                                  │
│ [15:19:34] TEST  ✓ Retry tests passing                                       │
│ [15:19:34] AGENT Committing changes...                                       │
│ [15:19:35] GIT   Staged 2 files for commit                                   │
│ [15:19:36] GIT   Commit: "fix: add retry logic to auth middleware"           │
│ [15:19:36] INFO  ✓ Coding phase complete                                     │
│ [15:19:37] INFO  Starting review phase...                                    │
│ [15:19:37] REVIEW Initializing review agent                                  │
│ [15:19:38] REVIEW Analyzing changes in auth.middleware.js                    │
│ [15:19:42] REVIEW Code structure looks good                                  │
│ [15:19:43] REVIEW Checking test coverage...                                  │
│ [15:19:45] REVIEW ✓ Good test coverage for new functionality                 │
│ [15:19:46] REVIEW Checking error handling...                                 │
│ [15:19:48] REVIEW ✓ Proper error handling implemented                        │
│ [15:19:49] REVIEW All checks passed, approving changes                       │
│ [15:19:50] INFO  ✓ Review phase complete                                     │
│ [15:19:50] INFO  Creating pull request...                                    │
│ [15:19:52] GIT   Push to branch: fix/auth-middleware-timeout                 │
│ [15:19:55] GIT   ✓ Changes pushed successfully                               │
│ [15:19:56] PR    Creating PR: "Fix auth middleware timeout"                  │
│ [15:19:58] PR    ✓ Pull request created: #89                                 │
│ [15:19:58] INFO  ✓ Task completed successfully                               │
│ ▊                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ [↑↓] Scroll  [PgUp/PgDn] Page  [Home/End] Top/Bottom  [f] Filter  [c] Copy  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### User Story: Detailed Log Analysis
- As a developer, I want to see the complete execution history
- **Acceptance Criteria:**
  - [ ] Shows all log levels with timestamps
  - [ ] Can filter by log level or search text
  - [ ] Auto-scroll option for real-time viewing
  - [ ] Can copy log sections for debugging
  - [ ] Clear distinction between agent actions and system events

### User Story: Log Navigation
- As a developer, I want efficient log navigation
- **Acceptance Criteria:**
  - [ ] Keyboard shortcuts for quick navigation
  - [ ] Search functionality with highlighting
  - [ ] Filter dropdown for different event types
  - [ ] Can access from task detail view with [l] key

---

## Additional Interactions & Enhancements

### Repository Management
- **Remove Repository**: Option to remove repos from recent list
- **Switch Repository**: Quick way to change active repo without going through selection

### Task Management  
- **Cancel Queued Tasks**: Ability to remove tasks from queue before they start
- **View Completed Tasks**: Access historical task details and logs
- **Retry Failed Tasks**: Re-run tasks that failed with updated configuration

### Navigation Enhancements
- **Breadcrumbs**: Clear indication of current location (especially in detail views)
- **Quick Actions**: Keyboard shortcuts for common operations
- **Context Menus**: Right-click or menu key for additional options

### Empty States
- **No Active Agents**: Helpful message when no tasks are running
- **No Issues**: Guide users to create first issue or pull from GitHub
- **Connection Issues**: Graceful handling of GitHub API failures

## Implementation Notes

- All screens designed for minimum 80x24 terminal size
- Consistent keyboard navigation patterns across screens
- Real-time updates via polling or webhooks
- State persistence for user preferences and session data
- Git worktree management abstracted from user