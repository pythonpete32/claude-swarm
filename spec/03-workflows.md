# Workflows Design

← [Back to Index](./README.md) | [Previous: Core Modules](./02-core-modules.md) | [Next: Shared Infrastructure →](./04-shared-infrastructure.md)

## Overview

Workflows orchestrate core modules into complete business processes. Each workflow represents a high-level operation that users want to perform, implemented as TypeScript files that can be called from CLI or Claude slash commands.

## Workflow Architecture

### Location
```
.claude/
├── workflows/                    # User-visible workflows
│   ├── work-on-task.ts          # Development workflow
│   ├── review-task.ts           # Review workflow
│   ├── setup-project.ts         # Initial setup
│   └── cleanup-review.ts        # Cleanup operations
└── commands/                     # Slash commands that invoke workflows
    ├── work-on-issue.md
    └── review-issue.md
```

### Workflow Structure
Each workflow follows this pattern:

```typescript
#!/usr/bin/env bun
import { /* core modules */ } from 'claude-swarm';

interface WorkflowOptions {
  // Workflow-specific parameters
}

async function runWorkflow(options: WorkflowOptions) {
  // 1. Validate environment and parameters
  // 2. Execute core operations in sequence
  // 3. Handle errors and cleanup
  // 4. Provide user feedback
}

// CLI entry point
if (import.meta.main) {
  const options = parseArguments(process.argv);
  await runWorkflow(options);
}

// Export for programmatic use
export { runWorkflow };
```

## Core Workflows

### 1. [Work on Task](./workflows/work-on-task.md)
**Purpose**: Set up isolated development environment for a GitHub issue

**Entry Points**:
- CLI: `bun .claude/workflows/work-on-task.ts 123`
- Claude: `/project:work-on-issue $ISSUE_NUMBER=123`

**Key Operations**:
- Creates git worktree with proper naming
- Sets up Claude context files
- Launches Claude in tmux session
- Generates context-aware development prompt

### 2. [Review Task](./workflows/review-task.md)
**Purpose**: Review completed work in isolated environment

**Entry Points**:
- CLI: `bun .claude/workflows/review-task.ts 123`
- Claude: `/project:review-issue $ISSUE_NUMBER=123`

**Key Operations**:
- Creates review worktree from work branch
- Validates implementation against requirements
- Generates review prompt with decision tree
- Creates feedback documents or PRs

### 3. [Setup Project](./workflows/setup-project.md)
**Purpose**: Initial claude-swarm setup for a repository

**Entry Points**:
- CLI: `bunx claude-swarm setup`
- Manual: `bun .claude/workflows/setup-project.ts`

**Key Operations**:
- Creates GitHub project and labels
- Installs Claude commands
- Sets up initial configuration
- Creates example workflows

### 4. [Cleanup Review](./workflows/cleanup-review.md)
**Purpose**: Clean up review worktrees after decisions

**Entry Points**:
- CLI: `bun .claude/workflows/cleanup-review.ts 123`
- Claude: Called automatically after review decisions

**Key Operations**:
- Archives feedback documents
- Removes review worktrees
- Updates issue tracking
- Cleans temporary files

## Workflow Patterns

### Error Handling
All workflows implement consistent error handling:

```typescript
try {
  await runWorkflow(options);
} catch (error) {
  if (error.code === 'KNOWN_ERROR') {
    // Specific error handling
    console.error(`❌ ${error.message}`);
    // Cleanup if needed
    process.exit(1);
  }
  // Unknown errors bubble up
  throw error;
}
```

### Progress Feedback
Workflows provide clear progress indicators:

```typescript
console.log('🔍 Validating environment...');
// validation steps

console.log('🔧 Creating development environment...');
// creation steps

console.log('✅ Environment ready!');
```

### Configuration
Workflows respect hierarchical configuration:

1. CLI arguments (highest priority)
2. Environment variables
3. Project `.claude/config.json`
4. User `~/.claude/config.json`
5. Built-in defaults

## Creating Custom Workflows

Users can create custom workflows by:

1. **Copy existing workflow as template**
   ```bash
   cp .claude/workflows/work-on-task.ts .claude/workflows/my-workflow.ts
   ```

2. **Import core modules**
   ```typescript
   import { 
     createWorktree, 
     getIssue, 
     launchClaudeInteractive 
   } from 'claude-swarm';
   ```

3. **Implement custom logic**
   ```typescript
   async function runMyWorkflow(options) {
     // Use core modules with custom orchestration
   }
   ```

4. **Create slash command** (optional)
   ```markdown
   # .claude/commands/my-command.md
   Executes my custom workflow...
   ```

## Workflow Testing

Each workflow should include:

- **Unit tests**: Mock core module calls
- **Integration tests**: Test with real git/GitHub
- **Error scenarios**: Test all failure modes
- **User experience**: Test output formatting

## Best Practices

1. **Keep workflows focused** - One clear purpose per workflow
2. **Use core modules** - Don't duplicate functionality
3. **Provide clear output** - Users should understand what's happening
4. **Handle interruptions** - Clean up on failure
5. **Document parameters** - Clear CLI help and examples
6. **Version compatibility** - Check claude-swarm version