#!/bin/bash

# Code review using headless Claude Code with issue number context
set -e

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
    echo "Usage: $0 <issue-number> [command-file]"
    echo "Example: $0 5"
    echo "Example: $0 5 .claude/commands/code-review.md"
    exit 1
fi

ISSUE_NUMBER="$1"
COMMAND_FILE="${2:-.claude/commands/code-review.md}"

# Validate issue number is numeric
if ! [[ "$ISSUE_NUMBER" =~ ^[0-9]+$ ]]; then
    echo "Error: Issue number must be a positive integer"
    exit 1
fi

# Check if command file exists
if [ ! -f "$COMMAND_FILE" ]; then
    echo "Error: Command file '$COMMAND_FILE' does not exist"
    exit 1
fi

CURRENT_BRANCH=$(git branch --show-current)

echo "Running code review for issue #$ISSUE_NUMBER on current branch: $CURRENT_BRANCH"
echo "Using command file: $COMMAND_FILE"

# Read the command file content
echo "Reading command file and executing Claude Code review..."
COMMAND_CONTENT=$(cat "$COMMAND_FILE")

# Create explicit prompt for Claude to execute the review with issue context
REVIEW_PROMPT="Please execute the following code review process for issue #$ISSUE_NUMBER on the current branch '$CURRENT_BRANCH':

$COMMAND_CONTENT

IMPORTANT: Replace \$ISSUE_NUMBER with $ISSUE_NUMBER throughout the process. Use 'gh issue view $ISSUE_NUMBER' to get the issue details and requirements. Then review the current branch implementation against those requirements.

Execute this review process now and provide the review results."

# Run Claude Code with the explicit review prompt and verbose turn-by-turn output
# Use script command to allocate PTY for real-time output on macOS
script -q /dev/null claude -p "$REVIEW_PROMPT" --verbose --output-format text

echo "Review complete! Check output above for results."