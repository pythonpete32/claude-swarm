# Core Modules Design

← [Back to Index](./README.md) | [Previous: Architecture Overview](./01-architecture-overview.md) | [Next: Workflows →](./03-workflows.md)

## Overview

Core modules provide the foundational building blocks for all Claude Swarm workflows. Each module encapsulates a specific domain of functionality and can be used independently or composed together to create complex workflow orchestrations.

## Module Architecture Principles

### 1. **Single Responsibility**
Each core module has one clear purpose:
- **core-worktree**: Git worktree lifecycle management
- **core-github**: GitHub API integration and project management
- **core-claude**: Claude Code session management and prompt generation
- **core-tmux**: Terminal session isolation and process management
- **core-git**: Core git operations and repository validation
- **core-files**: File system operations and context management

### 2. **Dependency Injection**
All modules accept configuration and dependencies through:
- Shared interface types from `shared/types.ts`
- Configuration objects from `shared/config.ts`
- Error handling through `shared/errors.ts`

### 3. **Composability**
Modules are designed to work together:
```typescript
// Example: Complete workflow composition
const repoInfo = await detectRepository();           // core-github
const worktree = await createWorktree(options);      // core-worktree  
const session = await createTmuxSession(options);    // core-tmux
const claudeSession = await launchClaudeInteractive(options); // core-claude
```

## Core Module Specifications

### [**core-worktree**](./modules/core-worktree.md) 🌳
**Purpose**: Git worktree lifecycle management with agent coordination

**Key Functions**:
- `createWorktree()` - Create isolated development environments
- `removeWorktree()` - Clean up worktrees safely
- `findWorktrees()` - Discover existing worktrees
- `getActiveAgents()` - Agent coordination for parallel development
- `validateWorktreeState()` - Validation and health checking

**Dependencies**: `core-git`, `shared/types`, `shared/errors`

**Critical For**: All development workflows, parallel agent support

---

### [**core-github**](./modules/core-github.md) 🐙
**Purpose**: Complete GitHub API integration replacing `gh` CLI

**Key Functions**:
- `detectRepository()` - Auto-detect GitHub repository context
- `getIssueWithRelationships()` - Fetch issues with project context
- `createIssueWithProject()` - Create issues and add to projects
- `detectProjectFields()` - Intelligent project field detection
- `validateAuthentication()` - GitHub auth verification

**Dependencies**: `@octokit/rest`, `@octokit/graphql`, `shared/types`, `shared/errors`

**Critical For**: Issue management, project integration, automated PR creation

---

### [**core-claude**](./modules/core-claude.md) 🤖
**Purpose**: Claude Code integration and session management

**Key Functions**:
- `launchClaudeInteractive()` - Launch Claude in tmux sessions
- `generateWorkPrompt()` - Context-aware prompt generation
- `validateClaudeAvailable()` - Claude CLI availability checking
- `sendPromptToSession()` - Send commands to running sessions
- `terminateClaudeSession()` - Clean session shutdown

**Dependencies**: `core-tmux`, `shared/types`, `shared/errors`

**Critical For**: AI-powered development workflows, interactive sessions

---

### [**core-tmux**](./modules/core-tmux.md) 🖥️
**Purpose**: Terminal session isolation and process management

**Key Functions**:
- `createTmuxSession()` - Create isolated terminal sessions
- `launchProcessInSession()` - Run processes in sessions
- `listSessions()` - Session discovery and monitoring
- `killSession()` - Clean session termination
- `attachToSession()` - User session attachment

**Dependencies**: `shared/types`, `shared/errors`

**Critical For**: Process isolation, user monitoring, session management

---

### [**core-git**](./modules/core-git.md) 📚
**Purpose**: Core git operations and repository validation

**Key Functions**:
- `validateRepository()` - Repository validation and info
- `getCurrentBranch()` - Branch state analysis
- `createBranch()` - Branch creation with tracking
- `getDiff()` - Change analysis and diff generation
- `parseRemoteUrl()` - Remote URL parsing for GitHub detection

**Dependencies**: `shared/types`, `shared/errors`

**Critical For**: Repository operations, branch management, change analysis

---

### [**core-files**](./modules/core-files.md) 📁
**Purpose**: File system operations and Claude context management

**Key Functions**:
- `ensureClaudeContext()` - Setup Claude configuration in worktrees
- `copyClaudeContext()` - Context file synchronization
- `validateStructure()` - Project structure validation
- `analyzeChangedFiles()` - File change analysis
- `createDirectory()` - Safe directory creation

**Dependencies**: Node.js `fs/promises`, `shared/types`, `shared/errors`

**Critical For**: Context management, file operations, project setup

## Module Integration Patterns

### 1. **Repository Discovery Pattern**
```typescript
// Standard pattern for initializing repository context
const repoInfo = await detectRepository();          // core-github
const repoValidation = await validateRepository();  // core-git
if (!repoValidation.isValid) {
  throw new GitError('Invalid repository', 'GIT_INVALID_REPOSITORY');
}
```

### 2. **Worktree Creation Pattern**
```typescript
// Standard pattern for creating isolated environments
const worktree = await createWorktree({            // core-worktree
  name: `task-${issueNumber}`,
  agentId: agentId,
  sourceBranch: 'main'
});

await ensureClaudeContext(worktree.path);          // core-files
```

### 3. **Session Management Pattern**
```typescript
// Standard pattern for session lifecycle
const session = await createTmuxSession({          // core-tmux
  name: `swarm-task-${issueNumber}`,
  workingDirectory: worktree.path
});

const claudeSession = await launchClaudeInteractive({ // core-claude
  workingDirectory: worktree.path,
  sessionName: session.name,
  prompt: workPrompt
});
```

### 4. **Error Handling Pattern**
```typescript
// Consistent error handling across modules
try {
  const result = await moduleOperation(options);
} catch (error) {
  if (error instanceof WorktreeError && error.code === 'WORKTREE_EXISTS') {
    // Handle specific error condition
    await removeWorktree(existingPath, { force: true });
    return await moduleOperation(options); // Retry
  }
  throw error; // Re-throw unhandled errors
}
```

## Configuration Integration

All core modules use shared configuration from `shared/config.ts`:

```typescript
interface SwarmConfig {
  worktree: WorktreeConfig;        // core-worktree settings
  tmux: TmuxConfig;                // core-tmux settings  
  claude: ClaudeConfig;            // core-claude settings
  github: GitHubConfig;            // core-github settings
  logging: LoggingConfig;          // Cross-module logging
}
```

## Testing Strategy

### Unit Testing
- **Isolated Testing**: Each module tested independently with mocked dependencies
- **Interface Compliance**: All functions tested against their TypeScript interfaces
- **Error Scenarios**: Comprehensive error condition testing

### Integration Testing  
- **Module Interaction**: Test module composition patterns
- **Real Dependencies**: Test against actual git, GitHub, tmux, Claude
- **End-to-End Flows**: Complete workflow testing

### Performance Testing
- **Resource Usage**: Memory and CPU usage monitoring
- **Concurrent Operations**: Parallel agent coordination testing
- **Cleanup Efficiency**: Resource cleanup verification

## Implementation Guidelines

### 1. **Start with Shared Infrastructure**
Implement in this order:
1. `shared/types.ts` - Interface definitions
2. `shared/errors.ts` - Error classes
3. `shared/config.ts` - Configuration management

### 2. **Core Module Implementation Order**
1. **core-git** - Foundation for repository operations
2. **core-files** - File system utilities  
3. **core-worktree** - Builds on git and files
4. **core-tmux** - Independent session management
5. **core-github** - External API integration
6. **core-claude** - Builds on tmux integration

### 3. **Quality Gates**
- All modules must pass TypeScript compilation
- Unit test coverage > 90%
- Integration tests for all public functions
- Performance benchmarks established

## Module Dependencies Graph

```
core-claude  ──┐
               ├─── core-tmux
core-worktree ─┘

core-worktree ──┐
                ├─── core-git ──┐
core-github   ──┘              ├─── shared/*
                                │
core-files    ──────────────────┘
```

## Success Criteria

- ✅ All modules implement their specified interfaces
- ✅ Integration patterns work seamlessly
- ✅ Error handling is consistent and recoverable
- ✅ Configuration system provides proper defaults
- ✅ Agent coordination enables parallel development
- ✅ Performance meets established benchmarks

## Next Steps

1. **Review Module Specifications**: Read each core module documentation
2. **Understand Integration Patterns**: Study the composition examples
3. **Set Up Development Environment**: Prepare TypeScript/Bun environment
4. **Begin Implementation**: Start with shared infrastructure

The core modules provide a solid foundation for building sophisticated AI development workflows with proper separation of concerns and robust error handling.