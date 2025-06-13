#!/bin/bash

# Cleanup script for worktrees and tmux sessions
set -e

# Check dependencies
if ! command -v git &> /dev/null; then
    echo "Error: git is not installed"
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Error: Not in a git repository"
    exit 1
fi

# Function to clean up a specific worktree
cleanup_worktree() {
    local branch_name="$1"
    local repo_name=$(basename "$(git rev-parse --show-toplevel)")
    local worktree_path="../${repo_name}-${branch_name}"
    local session_name="swarm-${branch_name}"
    
    echo "Cleaning up worktree for branch: $branch_name"
    
    # Kill tmux session if it exists
    if command -v tmux &> /dev/null && tmux has-session -t "$session_name" 2>/dev/null; then
        echo "Killing tmux session: $session_name"
        tmux kill-session -t "$session_name"
    fi
    
    # Remove worktree
    if git worktree list | grep -q "$worktree_path"; then
        echo "Removing worktree: $worktree_path"
        git worktree remove "$worktree_path" --force
    elif [ -d "$worktree_path" ]; then
        echo "Directory exists but not a worktree, removing: $worktree_path"
        rm -rf "$worktree_path"
    else
        echo "Worktree not found: $worktree_path"
    fi
}

# Function to list all worktrees
list_worktrees() {
    echo "Current worktrees:"
    git worktree list
    
    if command -v tmux &> /dev/null; then
        echo -e "\nCurrent tmux sessions:"
        tmux ls 2>/dev/null | grep "^swarm-" || echo "No swarm tmux sessions found"
    fi
}

# Main script logic
if [ $# -eq 0 ]; then
    echo "Usage: $0 <branch-name|--all|--list>"
    echo ""
    echo "Options:"
    echo "  <branch-name>  Clean up specific branch worktree and session"
    echo "  --all          Clean up all worktrees (except main)"
    echo "  --list         List all worktrees and tmux sessions"
    echo ""
    echo "Examples:"
    echo "  $0 feature-auth"
    echo "  $0 --all"
    echo "  $0 --list"
    exit 1
fi

case "$1" in
    --list)
        list_worktrees
        ;;
    --all)
        echo "Cleaning up all worktrees (except main)..."
        
        # Get all worktrees except the main one
        git worktree list --porcelain | grep "^worktree" | cut -d' ' -f2- | while read -r worktree_path; do
            if [[ ! "$worktree_path" =~ ^/.*claude-swarm$ ]]; then
                # Extract branch name from path
                branch_name=$(basename "$worktree_path" | sed "s/^$(basename "$(git rev-parse --show-toplevel)")-//")
                cleanup_worktree "$branch_name"
            fi
        done
        
        echo "Cleanup complete!"
        ;;
    *)
        cleanup_worktree "$1"
        ;;
esac