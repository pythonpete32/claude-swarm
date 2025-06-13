#!/bin/bash

# Simple worktree + tmux setup
set -e

if [ $# -ne 1 ]; then
    echo "Usage: $0 <branch-name>"
    echo "Example: $0 feature-auth"
    exit 1
fi

BRANCH_NAME="$1"
REPO_NAME=$(basename "$(git rev-parse --show-toplevel)")
WORKTREE_PATH="../${REPO_NAME}-${BRANCH_NAME}"

# Create worktree as sibling directory
if [ -d "$WORKTREE_PATH" ]; then
    echo "Worktree already exists: $WORKTREE_PATH"
else
    git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH"
    echo "Created worktree: $WORKTREE_PATH"
fi

# Create/attach tmux session
if tmux has-session -t "$BRANCH_NAME" 2>/dev/null; then
    echo "Attaching to existing session: $BRANCH_NAME"
    exec tmux attach-session -t "$BRANCH_NAME"
else
    echo "Creating tmux session: $BRANCH_NAME"
    exec tmux new-session -s "$BRANCH_NAME" -c "$WORKTREE_PATH"
fi