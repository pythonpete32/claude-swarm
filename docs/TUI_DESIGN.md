# TUI Agent Task Manager - Design Document

## Overview
A terminal-based task management system for orchestrating multiple Claude Code agents working asynchronously on GitHub issues within a repository.

## Screen Architecture

### Screen: Task Dashboard (Main)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Repo: acme/webapp                                    [Tab] Issues  Running   │
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

### Screen: Task Detail View (Split Pane)

```
┌─────────────────────────────────────────┬───────────────────────────────────┐
│ Task #42: Fix auth middleware timeout   │ Agent Pipeline                    │
├─────────────────────────────────────────┼───────────────────────────────────┤
│ Status: Coding (Revision 2)             │ ┌─ Pipeline Status ─────────────┐ │
│ Started: 15m ago                        │ │ 1. Coding Agent    [●] Active │ │
│ Agent: claude-3-5-sonnet               │ │    └─ Revision 2 of 3         │ │
│                                        │ │ 2. Review Agent    [ ] Queued │ │
│ ┌─ Task List ────────────────────────┐ │ │    └─ Max reviews: 3          │ │
│ │ [✓] Analyze auth middleware code   │ │ └───────────────────────────────┘ │
│ │ [✓] Identify timeout issue         │ │                                   │
│ │ [●] Add retry logic                │ │ ┌─ Previous Attempts ──────────┐ │
│ │ [ ] Update tests                   │ │ │ Revision 1:                   │ │
│ │ [ ] Test error scenarios           │ │ │ └─ Review: Missing tests      │ │
│ └─────────────────────────────────────┘ │ └───────────────────────────────┘ │
│                                        │                                   │
│ ┌─ Activity Log ─────────────────────┐ │ ┌─ Configuration ───────────────┐ │
│ │ [15:23] Starting revision 2...     │ │ │ Model: claude-3-5-sonnet      │ │
│ │ [15:23] Reading auth.middleware.ts │ │ │ Review: Enabled               │ │
│ │ [15:24] Found timeout at line 47   │ │ │ Max Reviews: 3                │ │
│ │ [15:24] Implementing retry wrapper  │ │ │ Auto-PR: true                 │ │
│ │ [15:25] > Added exponential backoff│ │ │ [e] Edit Configuration        │ │
│ │ [15:25] > Max retries set to 3     │ │ └───────────────────────────────┘ │
│ │ [15:26] Writing changes...         │ │                                   │
│ │ ▊                                  │ │                                   │
│ └─────────────────────────────────────┘ │                                   │
│ [Esc] Back  [l] Full Log  [s] Stop     │ [Tab] Switch Panes               │
└─────────────────────────────────────────┴───────────────────────────────────┘
```

### User Story: Real-time Task Monitoring
- As a developer, I want to monitor agent progress in real-time
- **Acceptance Criteria:**
  - [ ] Activity log auto-scrolls with new entries
  - [ ] Can scroll back through full history
  - [ ] Task list shows real-time checkbox updates
  - [ ] Pipeline status shows current agent and revision count
  - [ ] Previous review feedback is visible
  - [ ] Can stop task with 's' key

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

## Next Screens to Design

1. **Initial Setup/Repository Selection**
2. **Agent Logs Full View**
3. **Settings/Configuration Screen**
4. **Error Handling/Failed Task View**