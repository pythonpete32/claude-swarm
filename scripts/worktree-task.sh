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

# Check if session already exists
SESSION_EXISTS=false
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    SESSION_EXISTS=true
fi

# If we're in a terminal and session exists, attach to it
if [ -t 0 ] && [ -t 1 ] && [ "$SESSION_EXISTS" = true ]; then
    echo "Attaching to existing tmux session: $SESSION_NAME"
    exec tmux attach-session -t "$SESSION_NAME"
fi

# Create tmux session (detached if not in terminal)
if [ "$SESSION_EXISTS" = false ]; then
    echo "Creating tmux session: $SESSION_NAME"
    
    # Create session in detached mode
    tmux new-session -d -s "$SESSION_NAME" -c "$WORKTREE_ABS_PATH" \; \
         send-keys "# Ready to work on $BRANCH_NAME" C-m \; \
         send-keys "# Run: claude /project:work-on-task \$ISSUE_NUMBER=XXX" C-m
    
    echo "✅ Tmux session created successfully"
fi

# Show summary and instructions
echo ""
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ 🚀 Worktree Environment Ready!                              │"
echo "├─────────────────────────────────────────────────────────────┤"
echo "│ Branch:    $BRANCH_NAME"
echo "│ Worktree:  $WORKTREE_ABS_PATH"
echo "│ Session:   $SESSION_NAME"
echo "├─────────────────────────────────────────────────────────────┤"
echo "│ To start working:                                           │"
echo "│   tmux attach-session -t $SESSION_NAME"
echo "│                                                             │"
echo "│ Or if you prefer:                                           │"
echo "│   tmux a -t $SESSION_NAME"
echo "└─────────────────────────────────────────────────────────────┘"

# If in terminal and creating new session, offer to attach
if [ -t 0 ] && [ -t 1 ] && [ "$SESSION_EXISTS" = false ]; then
    echo ""
    read -p "Would you like to attach to the session now? [Y/n] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        exec tmux attach-session -t "$SESSION_NAME"
    fi
fi