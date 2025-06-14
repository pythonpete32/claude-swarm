# Workflow: Work on Task

← [Back to Index](../README.md) | [Workflow Overview](../03-workflows.md) | [Next: Review Task →](./review-task.md)

## Purpose
Orchestrates the complete development workflow for working on a GitHub issue, from worktree creation to Claude Code launch with proper context.

## Function Signatures

### Main Workflow Function
```typescript
async function workOnTask(options: WorkOnTaskOptions): Promise<WorkOnTaskResult>
```

### Configuration Interface
```typescript
interface WorkOnTaskOptions {
  issueNumber: number;              // Required: Issue to work on
  agentId?: string | number;        // Agent identifier for parallel development
  mode?: 'direct' | 'review';       // Work mode (default: 'direct')
  force?: boolean;                  // Force recreate worktree
  skipContext?: boolean;            // Skip Claude context setup
  model?: string;                   // Claude model override
  resumeSession?: boolean;          // Resume existing session
  interactive?: boolean;            // Enable user prompts
}
```

### Result Interface
```typescript
interface WorkOnTaskResult {
  worktree: WorktreeInfo;           // Created or resumed worktree
  session: TmuxSessionInfo;         // Created tmux session
  claudeSession: ClaudeSessionInfo; // Launched Claude session
  resumed: boolean;                 // Whether resumed existing work
  workPrompt: string;               // Generated work prompt
}
```

### Supporting Interfaces
```typescript
interface ClaudeSessionInfo {
  sessionName: string;              // tmux session name
  workingDirectory: string;         // Session working directory
  prompt: string;                   // Initial prompt sent
  model?: string;                   // Claude model used
  pid?: number;                     // Process ID if available
}
```

## CLI Entry Points

### Direct Execution
```bash
bun .claude/workflows/work-on-task.ts 123
bun .claude/workflows/work-on-task.ts 123 --agent-id 1
```

### Package Script
```bash
bun run swarm:work 123
```

### Claude Command
```
/project:work-on-issue $ISSUE_NUMBER=123 $MODE=direct $AGENT_ID=1
```

## Workflow Logic

### 1. Validation Phase
- Validate GitHub authentication using `validateAuthentication()`
- Detect repository context using `detectRepository()`
- Fetch issue details using `getIssue()`

### 2. Existing Work Detection
- Search for existing worktrees using `findWorktrees()` with agent-specific patterns
- Display parallel agent status for the same issue
- Resume existing work or create new environment

### 3. Environment Creation
- Generate agent-specific branch and worktree names
- Create isolated worktree using `createWorktree()`
- Set up proper branch tracking and upstream

### 4. Context Setup
- Ensure Claude context files using `ensureClaudeContext()`
- Copy missing context using `copyClaudeContext()`
- Validate command availability

### 5. Prompt Generation
- Get complete branch information using `getCurrentBranch()`
- Generate context-aware prompt using `generateWorkPrompt()`
- Include resumption context if applicable

### 6. Session Launch
- Create tmux session using `createTmuxSession()`
- Launch Claude interactively using `launchClaudeInteractive()`
- Provide user guidance and monitoring instructions

## Error Handling

### Error Types
```typescript
interface WorkOnTaskError extends Error {
  code: 'GITHUB_AUTH_FAILED' | 'ISSUE_NOT_FOUND' | 'WORKTREE_EXISTS' | 'CONTEXT_SETUP_FAILED';
  issueNumber?: number;
  worktreePath?: string;
  originalError?: Error;
}
```

### Recovery Actions
- GitHub authentication failures: Guide user to `gh auth login`
- Issue not found: Provide repository issue URL
- Worktree conflicts: Offer cleanup or force options
- Context setup failures: Clean up created worktree

## Parallel Development Support

### Agent Isolation
- Each agent gets unique worktree: `../task-{issue}-agent-{id}-{timestamp}/`
- Each agent gets unique branch: `issue-{issue}-agent-{id}-{slug}`
- Each agent gets unique session: `swarm-task-{issue}-agent-{id}`

### Agent Coordination
- Display other agents working on same issue
- No file conflicts due to worktree isolation
- Independent tmux sessions for monitoring

## Integration Points

### Core Module Dependencies
- **core-github**: `validateAuthentication()`, `detectRepository()`, `getIssue()`
- **core-worktree**: `findWorktrees()`, `createWorktree()`, `getCurrentBranch()`
- **core-files**: `ensureClaudeContext()`, `copyClaudeContext()`
- **core-claude**: `generateWorkPrompt()`, `launchClaudeInteractive()`
- **core-tmux**: `createTmuxSession()`

### Output Artifacts
- Git worktree with complete development environment
- tmux session with Claude actively running
- Ready for issue implementation work

## Testing Considerations
- Validate worktree creation and cleanup
- Test authentication and GitHub integration
- Verify tmux session management
- Test parallel agent coordination
- Validate context setup and command availability