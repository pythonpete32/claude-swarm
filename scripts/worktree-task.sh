#!/bin/bash

# Simple worktree + tmux setup
set -e

# Check dependencies
if ! command -v git &> /dev/null; then
    echo "Error: git is not installed"
    exit 1
fi

if ! command -v tmux &> /dev/null; then
    echo "Error: tmux is not installed"
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Error: Not in a git repository"
    exit 1
fi

if [ $# -ne 1 ]; then
    echo "Usage: $0 <branch-name>"
    echo "Example: $0 feature-auth"
    exit 1
fi

BRANCH_NAME="$1"

# Validate branch name
if [[ ! "$BRANCH_NAME" =~ ^[a-zA-Z0-9_/-]+$ ]]; then
    echo "Error: Invalid branch name. Use only alphanumeric characters, underscores, hyphens, and slashes"
    exit 1
fi

# Get repository information
REPO_ROOT=$(git rev-parse --show-toplevel)
REPO_NAME=$(basename "$REPO_ROOT")
WORKTREE_PATH="../${REPO_NAME}-${BRANCH_NAME}"

# Convert to absolute path for clarity
WORKTREE_ABS_PATH=$(cd "$(dirname "$REPO_ROOT")" && pwd)/"${REPO_NAME}-${BRANCH_NAME}"

# Check if branch already exists
if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
    echo "Branch already exists: $BRANCH_NAME"
    echo "Creating worktree for existing branch..."
    
    # Create worktree for existing branch
    if [ -d "$WORKTREE_PATH" ]; then
        echo "Worktree already exists: $WORKTREE_ABS_PATH"
    else
        git worktree add "$WORKTREE_PATH" "$BRANCH_NAME"
        echo "Created worktree: $WORKTREE_ABS_PATH"
    fi
else
    # Create worktree with new branch
    if [ -d "$WORKTREE_PATH" ]; then
        echo "Error: Worktree directory already exists but branch doesn't: $WORKTREE_ABS_PATH"
        echo "Please remove the directory or choose a different branch name"
        exit 1
    else
        git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH"
        echo "Created new branch and worktree: $WORKTREE_ABS_PATH"
    fi
fi

# Verify worktree was created successfully
if [ ! -d "$WORKTREE_PATH" ]; then
    echo "Error: Failed to create worktree"
    exit 1
fi

# Create/attach tmux session
SESSION_NAME="swarm-${BRANCH_NAME}"

# Check if running in a terminal
if [ -t 0 ] && [ -t 1 ]; then
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        echo "Attaching to existing tmux session: $SESSION_NAME"
        exec tmux attach-session -t "$SESSION_NAME"
    else
        echo "Creating new tmux session: $SESSION_NAME"
        echo "Working directory: $WORKTREE_ABS_PATH"
        
        # Create tmux session with claude command ready
        exec tmux new-session -s "$SESSION_NAME" -c "$WORKTREE_ABS_PATH" \; \
             send-keys "# Ready to work on $BRANCH_NAME" C-m \; \
             send-keys "# Run: claude /project:work-on-task \$ISSUE_NUMBER=XXX" C-m
    fi
else
    echo ""
    echo "⚠️  Not running in a terminal - skipping tmux session creation"
    echo ""
    echo "To work in this worktree:"
    echo "  cd $WORKTREE_ABS_PATH"
    echo "  tmux new-session -s \"$SESSION_NAME\""
    echo ""
    echo "Or run this script directly in a terminal."
fi