# Architecture Overview

← [Back to Index](./README.md) | [Next: Core Modules →](./02-core-modules.md)

This document defines the complete architecture for migrating bash scripts to TypeScript with Bun runtime.

## System Overview

The system orchestrates AI development workflows through isolated worktrees, tmux sessions, and GitHub integration. The architecture consists of **Core Operations** (building blocks), **Workflows** (orchestration sequences), and **Shared Infrastructure** (common utilities).

## Architecture Layers

### 1. Core Operations (Building Blocks)

Reusable operations that different workflows compose together:

```typescript
core/
├── worktree.ts      // Git worktree management operations
├── tmux.ts          // Terminal session management
├── github.ts        // GitHub API operations (replaces gh CLI)
├── git.ts           // Git operations
├── files.ts         // File system operations
└── claude.ts        // Claude Code integration
```

### 2. Workflows (Orchestration Sequences)

Complete business processes that coordinate multiple core operations:

```typescript
workflows/
├── work-on-task.ts     // Development workflow: worktree → tmux → Claude
├── review-task.ts      // Review workflow: review worktree → tmux → Claude review
├── cleanup-review.ts   // Cleanup workflow: extract feedback → merge → cleanup
└── setup-project.ts    // Setup workflow: GitHub project creation
```

### 3. Shared Infrastructure

Common utilities and infrastructure:

```typescript
shared/
├── types.ts        // All TypeScript interfaces and types
├── config.ts       // Configuration management
├── validation.ts   // Input validation utilities
├── logger.ts       // Relinka logging integration
└── errors.ts       // Error handling and custom error types
```

### 4. Command Entry Points

CLI entry points that call workflows:

```typescript
commands/
├── work-on-task.ts      // Calls workOnTaskWorkflow()
├── review-task.ts       // Calls reviewTaskWorkflow()
├── cleanup-review.ts    // Calls cleanupReviewWorkflow()
└── setup-project.ts     // Calls setupProjectWorkflow()
```

## Key Design Principles

### DRY (Don't Repeat Yourself)
- **Shared Operations**: Worktree creation used by both development and review workflows
- **Common Patterns**: Repository detection, validation, GitHub API calls
- **Reusable Components**: Same building blocks for different use cases

### Library-First Design
- **No Hardcoded Assumptions**: Configurable for any repository
- **Clean API**: Simple exports for other projects to consume
- **Dependency Injection**: Core operations don't depend on specific configurations

### Testability
- **Pure Functions**: Core operations have no side effects where possible
- **Dependency Injection**: Easy to mock external dependencies
- **Clear Interfaces**: Well-defined inputs and outputs

### Robustness
- **Error Handling**: Comprehensive error recovery at each layer
- **Validation**: Input validation at workflow entry points
- **Cleanup**: Proper resource cleanup on failures

## Workflow Orchestration Examples

### Work on Task Workflow
```
1. Get GitHub repository info
2. Create worktree for task (from main branch)
3. Create tmux session in worktree
4. Launch Claude Code with work prompt
5. User can monitor via tmux session
```

### Review Task Workflow  
```
1. Get repository info and current branch
2. Create worktree (parameterized for review context)
3. Create tmux session in worktree
4. Launch Claude Code with review prompt (text prompt, not slash command)
5. Claude reviews current branch against GitHub issue requirements
6. Claude creates PR (if requirements met) or feedback file (if not)
7. Claude runs a cleanup command to remove the review worktree
```


## Integration Points

### GitHub API Integration
- **Direct GraphQL/REST**: Replace gh CLI with Octokit
- **Project Management**: Full Projects v2 API support
- **Issue Tracking**: Automated issue creation and linking

### tmux Integration
- **Session Management**: Create, attach, monitor sessions
- **Process Isolation**: Each workflow gets its own session
- **User Interface**: Easy attachment for monitoring

### Claude Code Integration
- **Interactive Mode**: Cost-effective interactive sessions
- **Prompt Generation**: Context-aware prompts for each workflow
- **Command Integration**: Leverages existing .claude/commands structure

## Next Steps

1. Design core modules (starting with worktree.ts)
2. Define shared infrastructure 
3. Design workflow orchestrations
4. Define command entry points
5. Create comprehensive implementation guide

## Success Criteria

- **Complete Bash Replacement**: All existing functionality preserved
- **Improved Maintainability**: Clear separation of concerns
- **Enhanced Testability**: Comprehensive test coverage possible
- **Library Ready**: Easy installation in other projects
- **Cost Optimization**: Maintains interactive vs headless cost benefits