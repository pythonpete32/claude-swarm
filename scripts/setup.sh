#!/bin/bash

# Claude Swarm Setup Script
# Creates and links GitHub project

set -e

echo "🚀 Claude Swarm Setup"
echo "===================="

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: This must be run from within a git repository"
    exit 1
fi

# Check for required tools
if ! command -v gh &> /dev/null; then
    echo "❌ Error: GitHub CLI (gh) is required. Install with: brew install gh"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "❌ Error: jq is required. Install with: brew install jq"
    exit 1
fi

# Check if user is authenticated with GitHub CLI
if ! gh auth status &> /dev/null; then
    echo "❌ Error: Please authenticate with GitHub CLI first: gh auth login --scopes project"
    exit 1
fi

# Check if we have project scope
if ! gh auth status 2>&1 | grep -q "project"; then
    echo "❌ Error: GitHub CLI needs 'project' scope. Run: gh auth refresh -s project"
    exit 1
fi

echo "✅ All dependencies check out"

# Get repository information
REPO_OWNER=$(gh repo view --json owner --jq '.owner.login')
REPO_NAME=$(gh repo view --json name --jq '.name')

echo "📁 Repository: ${REPO_OWNER}/${REPO_NAME}"

# Check if project already exists
echo "🔍 Checking for existing project..."

# Get both the node ID and the number for existing projects
EXISTING_PROJECT_DATA=$(gh project list --owner "$REPO_OWNER" --format json | jq -r --arg name "$REPO_NAME" '.projects[] | select(.title == $name) | "\(.id)|\(.number)"' || echo "")

if [ -n "$EXISTING_PROJECT_DATA" ]; then
    PROJECT_NODE_ID=$(echo "$EXISTING_PROJECT_DATA" | cut -d'|' -f1)
    PROJECT_NUMBER=$(echo "$EXISTING_PROJECT_DATA" | cut -d'|' -f2)
    echo "✅ Project '$REPO_NAME' already exists (Number: $PROJECT_NUMBER)"
else
    echo "🆕 Creating new GitHub project..."
    PROJECT_URL=$(gh project create --owner "$REPO_OWNER" --title "$REPO_NAME")
    PROJECT_NUMBER=$(echo "$PROJECT_URL" | grep -o '[0-9]\+$')
    PROJECT_NODE_ID=$(gh project list --owner "$REPO_OWNER" --format json | jq -r --arg name "$REPO_NAME" '.projects[] | select(.title == $name) | .id')
    echo "✅ Created project: $PROJECT_URL"
fi

# Link project to repository using the node ID
echo "🔗 Linking project to repository..."
if gh project link "$PROJECT_NODE_ID" --repo "$REPO_OWNER/$REPO_NAME" 2>/dev/null; then
    echo "✅ Project linked successfully"
else
    echo "⚠️  Project may already be linked (this is okay)"
fi

echo ""
echo "🎉 Setup complete!"
echo "📊 GitHub Project: https://github.com/users/${REPO_OWNER}/projects/${PROJECT_NUMBER}"
echo ""
echo "Next steps:"
echo "1. Visit the project URL above"
echo "2. Start planning: claude /project:create-plans"
echo "3. Create tasks: claude /project:create-task-batch planning/"