# Claude Swarm Scripts

This directory contains automation scripts for managing the Claude Swarm workflow.

## Scripts Overview

### worktree-task.sh

Creates isolated development environments using Git worktrees and tmux sessions.

**Usage:**
```bash
./scripts/worktree-task.sh <branch-name>
```

**Features:**
- Creates worktrees as sibling directories (../repo-branch-name/)
- Handles both new and existing branches
- Sets up tmux sessions with helpful prompts
- Validates input and checks dependencies
- Provides clear error messages

**Example:**
```bash
# Create new feature branch with worktree
./scripts/worktree-task.sh feature-authentication

# Use existing branch
./scripts/worktree-task.sh bugfix/issue-123
```

### worktree-cleanup.sh

Manages cleanup of worktrees and associated tmux sessions.

**Usage:**
```bash
./scripts/worktree-cleanup.sh <branch-name|--all|--list>
```

**Options:**
- `<branch-name>`: Clean up specific branch worktree and session
- `--all`: Clean up all worktrees (except main)
- `--list`: List all worktrees and tmux sessions

**Examples:**
```bash
# Clean up specific worktree
./scripts/worktree-cleanup.sh feature-authentication

# List all worktrees
./scripts/worktree-cleanup.sh --list

# Clean up everything
./scripts/worktree-cleanup.sh --all
```

### setup.sh

Initializes a new Claude Swarm project with GitHub integration.

**Features:**
- Creates GitHub project board
- Sets up proper column structure
- Creates issue labels
- Links project to repository

### review-task.sh

Runs autonomous code reviews using headless Claude Code.

**Usage:**
```bash
./scripts/review-task.sh <task-number>
```

## Worktree Directory Structure

When you run `worktree-task.sh feature-auth`, it creates:

```
/parent-directory/
├── claude-swarm/           # Main repository
└── claude-swarm-feature-auth/  # Worktree (sibling directory)
```

This keeps worktrees separate from the main repository while maintaining easy access.

## Requirements

- Git 2.5+ (for worktree support)
- tmux (for session management)
- GitHub CLI with project scope (for setup.sh)
- Claude Code CLI (for review-task.sh)

## Troubleshooting

### "not a terminal" error
This occurs when running the script in a non-interactive environment. The script still creates the worktree successfully; only the tmux session fails to attach.

### Worktree already exists
Use `worktree-cleanup.sh` to remove old worktrees before creating new ones with the same name.

### Permission denied
Ensure scripts are executable:
```bash
chmod +x scripts/*.sh
```