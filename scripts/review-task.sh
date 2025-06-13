#!/bin/bash

# Simple code review using headless Claude Code
set -e

if [ $# -ne 1 ]; then
    echo "Usage: $0 <branch-name>"
    echo "Example: $0 feature-auth"
    exit 1
fi

BRANCH_NAME="$1"

# Check if branch exists
if ! git rev-parse --verify "$BRANCH_NAME" >/dev/null 2>&1; then
    echo "Error: Branch '$BRANCH_NAME' does not exist"
    exit 1
fi

echo "Running code review for branch: $BRANCH_NAME"

# Switch to the branch temporarily
CURRENT_BRANCH=$(git branch --show-current)
git checkout "$BRANCH_NAME"

# Run the code review command in headless mode
# The prompt comes from .claude/commands/code-review.md and will save to planning/temp/$BRANCH_NAME.md
claude -p "/code-review"

# Switch back to original branch
git checkout "$CURRENT_BRANCH"

echo "Review complete! Report saved to: planning/temp/${BRANCH_NAME}.md"