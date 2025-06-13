# GitHub Issue Creation Guide - Complete Metadata Setup

This guide documents how to create GitHub issues with full project integration, including project assignment, status setting, milestone linking, and relationship management.

## Prerequisites

### 1. Authorization Setup
GitHub CLI requires project scope for project management:
```bash
gh auth refresh -s project
```

### 2. Gather Project Information
First, get your project details:
```bash
# List all projects
gh project list

# Get project field IDs (replace with your project number)
gh api graphql -f query='{ user(login: "OWNER") { projectV2(number: PROJECT_NUMBER) { fields(first: 20) { nodes { __typename ... on ProjectV2Field { id name } ... on ProjectV2SingleSelectField { id name options { id name } } } } } } }'
```

## Complete Issue Creation Process

### Step 1: Create the Issue
```bash
# Basic issue creation
ISSUE_URL=$(gh issue create \
  --title "Issue Title" \
  --body "Issue description" \
  --label "enhancement,high-priority" \
  --assignee "@me" \
  --output-url)

# Extract issue number
ISSUE_NUMBER=$(echo $ISSUE_URL | grep -o '[0-9]*$')
```

### Step 2: Add to Project
```bash
# Add issue to project (returns without output on success)
gh project item-add PROJECT_NUMBER \
  --owner OWNER_NAME \
  --url $ISSUE_URL
```

### Step 3: Get Project Item ID
```bash
# Get the project item ID for the issue
ITEM_ID=$(gh project item-list PROJECT_NUMBER --owner OWNER_NAME --format json | \
  jq -r ".items[] | select(.content.number == $ISSUE_NUMBER) | .id")
```

### Step 4: Set Status to "Todo"
```bash
# Set status (using field and option IDs from prerequisites)
gh project item-edit \
  --project-id PROJECT_ID \
  --id $ITEM_ID \
  --field-id STATUS_FIELD_ID \
  --single-select-option-id TODO_OPTION_ID
```

## Managing Milestones

### Create a Milestone
```bash
# Create milestone with due date
gh api repos/:owner/:repo/milestones \
  --method POST \
  -f title="Sprint 1 - Review Automation" \
  -f description="Implement cost-effective review automation with worktree isolation" \
  -f due_on="2024-02-01T00:00:00Z"
```

### List Milestones
```bash
# Get all milestones
gh api repos/:owner/:repo/milestones

# Get open milestones only
gh api repos/:owner/:repo/milestones?state=open
```

### Assign Milestone to Issue
```bash
# During creation
gh issue create --milestone "Sprint 1 - Review Automation" ...

# After creation
gh issue edit ISSUE_NUMBER --milestone "Sprint 1 - Review Automation"
```

## Managing Relationships

### Epic/Sub-issue Relationships
GitHub doesn't have native epic support, but you can use:

1. **Task Lists in Epic Issue**:
```markdown
## Sub-issues
- [ ] #21 Create Review Worktree Script
- [ ] #22 Cleanup Review Worktree Script
- [ ] #23 Enhanced Review Decision Logic
```

2. **Parent Issue Field in Project**:
```bash
# Set parent issue relationship in project
gh project item-edit \
  --project-id PROJECT_ID \
  --id $ITEM_ID \
  --field-id PARENT_ISSUE_FIELD_ID \
  --text "#20"
```

### Dependencies
Document in issue body:
```markdown
## Dependencies
- Requires: #19 (must complete first)
- Blocks: #25 (waiting for this)
- Related: #18 (working in same area)
```

## Real Example: Issue #19 Manual Fix

Here's exactly how issue #19 was fixed:

```bash
# 1. Add to project
gh issue edit 19 --add-project "claude-swarm"

# 2. Assign to user
gh issue edit 19 --add-assignee "@me"

# 3. Add to project board
gh project item-add 2 --owner pythonpete32 \
  --url https://github.com/pythonpete32/claude-swarm/issues/19

# 4. Get item ID
ITEM_ID=$(gh project item-list 2 --owner pythonpete32 --format json | \
  jq -r '.items[] | select(.content.number == 19) | .id')
# Result: PVTI_lAHOAvwmhc4A7Xq2zgbduCI

# 5. Set status to Todo
gh project item-edit \
  --project-id PVT_kwHOAvwmhc4A7Xq2 \
  --id PVTI_lAHOAvwmhc4A7Xq2zgbduCI \
  --field-id PVTSSF_lAHOAvwmhc4A7Xq2zgvsF-A \
  --single-select-option-id f75ad846
```

## Complete Automated Script

```bash
#!/bin/bash
# create-issue-complete.sh

# Configuration
OWNER="pythonpete32"
REPO="claude-swarm"
PROJECT_NUMBER="2"
PROJECT_ID="PVT_kwHOAvwmhc4A7Xq2"
STATUS_FIELD_ID="PVTSSF_lAHOAvwmhc4A7Xq2zgvsF-A"
TODO_OPTION_ID="f75ad846"

# Create issue
ISSUE_URL=$(gh issue create \
  --title "$1" \
  --body-file "$2" \
  --label "$3" \
  --assignee "@me" \
  --milestone "$4" \
  --repo "$OWNER/$REPO" \
  2>&1)

# Extract issue number
ISSUE_NUMBER=$(echo $ISSUE_URL | grep -o '[0-9]*$')

echo "Created issue #$ISSUE_NUMBER"

# Add to project
gh project item-add $PROJECT_NUMBER \
  --owner $OWNER \
  --url $ISSUE_URL

# Get item ID
sleep 2  # Wait for project sync
ITEM_ID=$(gh project item-list $PROJECT_NUMBER --owner $OWNER --format json | \
  jq -r ".items[] | select(.content.number == $ISSUE_NUMBER) | .id")

# Set status to Todo
if [ ! -z "$ITEM_ID" ]; then
  gh project item-edit \
    --project-id $PROJECT_ID \
    --id $ITEM_ID \
    --field-id $STATUS_FIELD_ID \
    --single-select-option-id $TODO_OPTION_ID
  echo "Issue #$ISSUE_NUMBER added to project with Todo status"
else
  echo "Failed to get project item ID"
fi
```

## Field IDs Reference (claude-swarm project)

```
Project ID: PVT_kwHOAvwmhc4A7Xq2
Status Field ID: PVTSSF_lAHOAvwmhc4A7Xq2zgvsF-A
  - Todo: f75ad846
  - In Progress: 47fc9ee4
  - Done: 98236657
Title Field: PVTF_lAHOAvwmhc4A7Xq2zgvsF94
Assignees Field: PVTF_lAHOAvwmhc4A7Xq2zgvsF98
Labels Field: PVTF_lAHOAvwmhc4A7Xq2zgvsF-E
Milestone Field: PVTF_lAHOAvwmhc4A7Xq2zgvsF-M
Parent Issue Field: PVTF_lAHOAvwmhc4A7Xq2zgvsF-Y
```

## Best Practices

1. **Always verify project assignment** after issue creation
2. **Use sleep between operations** to allow GitHub to sync
3. **Check for empty responses** when getting item IDs
4. **Document relationships** in issue body for clarity
5. **Use milestones** for sprint/release management
6. **Label consistently** for better organization

This guide provides the complete process for creating fully integrated GitHub issues with all metadata properly set.