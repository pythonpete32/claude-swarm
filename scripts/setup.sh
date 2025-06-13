#!/bin/bash

# Claude Swarm Setup Script
# Creates GitHub labels, projects, and links them to repository

set -e

echo "🚀 Claude Swarm Setup"
echo "===================="

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: This must be run from within a git repository"
    exit 1
fi

# Function to check if command exists and is not aliased away
check_command() {
    local cmd="$1"
    if ! command -v "$cmd" &> /dev/null; then
        return 1
    fi
    # Check if it's aliased to a message (like in some environments)
    if command -v "$cmd" | grep -q "alias"; then
        return 1
    fi
    return 0
}

# Check for required tools
if ! check_command gh; then
    echo "❌ Error: GitHub CLI (gh) is required. Install with: brew install gh"
    exit 1
fi

if ! check_command jq; then
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

# Function to create label if it doesn't exist
create_label() {
    local name="$1"
    local description="$2"
    local color="$3"
    
    if gh label list --json name --jq '.[].name' | grep -q "^${name}$"; then
        echo "  ✅ Label '$name' already exists"
        return 0
    fi
    
    if gh label create "$name" --description "$description" --color "$color"; then
        echo "  ✅ Created label '$name'"
        return 0
    else
        echo "  ❌ Failed to create label '$name'"
        return 1
    fi
}

# Create required GitHub labels
echo "🏷️  Setting up GitHub labels..."

# Define labels needed for claude-swarm workflow
declare -A LABELS=(
    ["enhancement"]="Feature requests and improvements|0052CC"
    ["scripts"]="Related to automation scripts|F9D71C"
    ["high-priority"]="Urgent issues that need immediate attention|D73A4A"
    ["commands"]="Related to claude commands|6F42C1"
    ["template"]="Template or boilerplate related|28A745"
    ["testing"]="Related to testing functionality|1D76DB"
    ["validation"]="Validation and quality assurance|8B5CF6"
    ["documentation"]="Documentation improvements|0075CA"
    ["user-experience"]="User experience improvements|E99695"
)

LABEL_ERRORS=0
for label_name in "${!LABELS[@]}"; do
    IFS='|' read -r description color <<< "${LABELS[$label_name]}"
    if ! create_label "$label_name" "$description" "$color"; then
        ((LABEL_ERRORS++))
    fi
done

if [ $LABEL_ERRORS -gt 0 ]; then
    echo "⚠️  $LABEL_ERRORS label(s) could not be created, but setup will continue"
else
    echo "✅ All labels created successfully"
fi

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

# Capture both stdout and stderr for better error handling
LINK_OUTPUT=$(gh project link "$PROJECT_NODE_ID" --repo "$REPO_OWNER/$REPO_NAME" 2>&1)
LINK_EXIT_CODE=$?

if [ $LINK_EXIT_CODE -eq 0 ]; then
    echo "✅ Project linked successfully"
    PROJECT_LINKED=true
else
    echo "❌ Failed to link project to repository"
    echo "Error output: $LINK_OUTPUT"
    
    # Check if it's already linked by trying to list linked projects
    echo "🔍 Checking if project is already linked..."
    if gh repo view --json projects --jq '.projects[] | select(.title == "'"$REPO_NAME"'") | .title' | grep -q "$REPO_NAME"; then
        echo "✅ Project appears to be already linked"
        PROJECT_LINKED=true
    else
        echo "❌ Project is not linked and automatic linking failed"
        PROJECT_LINKED=false
    fi
fi

# Verify project appears in repository
echo "🔍 Verifying project visibility..."
if [ "$PROJECT_LINKED" = true ]; then
    echo "✅ Project should now appear in repository Projects tab"
else
    echo "⚠️  Manual linking may be required:"
    echo "   1. Go to your repository: https://github.com/${REPO_OWNER}/${REPO_NAME}"
    echo "   2. Click on 'Projects' tab"
    echo "   3. Click 'Link a project' and select '$REPO_NAME'"
    echo "   4. Or visit: https://github.com/users/${REPO_OWNER}/projects/${PROJECT_NUMBER}/settings"
fi

echo ""
echo "🎉 Setup complete!"
echo "📊 GitHub Project: https://github.com/users/${REPO_OWNER}/projects/${PROJECT_NUMBER}"
echo "📁 Repository Projects: https://github.com/${REPO_OWNER}/${REPO_NAME}/projects"
echo ""
echo "✅ Summary:"
echo "   - GitHub labels: Created/verified"
echo "   - GitHub project: Created/found"
echo "   - Project linking: $([ "$PROJECT_LINKED" = true ] && echo "✅ Success" || echo "⚠️  Manual action needed")"
echo ""
echo "Next steps:"
echo "1. Verify project appears in repository Projects tab: https://github.com/${REPO_OWNER}/${REPO_NAME}/projects"
echo "2. Start planning: claude /project:create-plans"
echo "3. Create tasks: claude /project:create-task-batch planning/"
echo ""
echo "🧪 Test the setup:"
echo "   gh issue create --title 'Test Issue' --body 'Testing setup' --label 'enhancement,scripts'"