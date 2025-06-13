# Complete GitHub Issue Creation Guide - With Relationships & Fixes

This guide documents the complete process of creating GitHub issues with full metadata, including the fixes discovered during implementation.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Basic Issue Creation](#basic-issue-creation)
3. [Project Integration](#project-integration)
4. [Setting Relationships](#setting-relationships)
5. [Milestone Management](#milestone-management)
6. [Complete Automation Script](#complete-automation-script)
7. [Lessons Learned & Fixes](#lessons-learned--fixes)

## Prerequisites

### 1. Authorization with Project Scope
```bash
gh auth refresh -s project
```

### 2. Get Project Information
```bash
# List projects
gh project list

# Get project fields (including relationship fields)
gh api graphql -f query='{ user(login: "OWNER") { projectV2(number: PROJECT_NUMBER) { fields(first: 20) { nodes { __typename ... on ProjectV2Field { id name } ... on ProjectV2SingleSelectField { id name options { id name } } } } } } }'
```

### Key Field IDs (claude-swarm project)
```
Project ID: PVT_kwHOAvwmhc4A7Xq2
Status Field: PVTSSF_lAHOAvwmhc4A7Xq2zgvsF-A
  - Todo: f75ad846
  - In Progress: 47fc9ee4
  - Done: 98236657
Parent Issue Field: PVTF_lAHOAvwmhc4A7Xq2zgvsF-Y
Linked PRs Field: PVTF_lAHOAvwmhc4A7Xq2zgvsF-I
```

## Basic Issue Creation

### Step 1: Create Issue with Basic Metadata
```bash
ISSUE_URL=$(gh issue create \
  --title "Issue Title" \
  --body "Issue description" \
  --label "enhancement,high-priority" \
  --assignee "@me" \
  --milestone "Milestone Name" \
  2>&1)

ISSUE_NUMBER=$(echo $ISSUE_URL | grep -o '[0-9]*$')
```

### Step 2: Add to Project
```bash
gh project item-add PROJECT_NUMBER \
  --owner OWNER_NAME \
  --url $ISSUE_URL
```

### Step 3: Get Project Item ID
```bash
# CRITICAL: Add sleep to allow GitHub to sync
sleep 2

ITEM_ID=$(gh project item-list PROJECT_NUMBER --owner OWNER_NAME --format json | \
  jq -r ".items[] | select(.content.number == $ISSUE_NUMBER) | .id")
```

### Step 4: Set Status to Todo
```bash
gh project item-edit \
  --project-id PROJECT_ID \
  --id $ITEM_ID \
  --field-id STATUS_FIELD_ID \
  --single-select-option-id TODO_OPTION_ID
```

## Setting Relationships

### Parent-Child Relationships (Epic → Sub-issues)

For sub-issues that belong to an epic:
```bash
# Set parent issue relationship
gh project item-edit \
  --project-id PVT_kwHOAvwmhc4A7Xq2 \
  --id $ITEM_ID \
  --field-id PVTF_lAHOAvwmhc4A7Xq2zgvsF-Y \
  --text "#20"  # Parent issue number
```

### In Issue Body (for visibility)
Include relationships in the issue description:
```markdown
## Dependencies
- Epic: #20 (Parent epic)
- Requires: #21 (Must complete first)
- Blocks: #24 (Waiting for this)
- Related: #19 (Working in same area)
```

## Milestone Management

### Create Milestone with CORRECT Date
```bash
# Use future date! Current year or later
gh api repos/:owner/:repo/milestones \
  --method POST \
  -f title="Sprint Name" \
  -f description="Sprint goals" \
  -f due_on="2025-02-01T00:00:00Z"  # FUTURE date
```

### Fix Existing Milestone Date
```bash
gh api repos/:owner/:repo/milestones/MILESTONE_NUMBER \
  --method PATCH \
  -f due_on="2025-02-01T00:00:00Z"
```

## Complete Automation Script

```bash
#!/bin/bash
# create-issue-with-relationships.sh

# Configuration
OWNER="pythonpete32"
REPO="claude-swarm"
PROJECT_NUMBER="2"
PROJECT_ID="PVT_kwHOAvwmhc4A7Xq2"
STATUS_FIELD_ID="PVTSSF_lAHOAvwmhc4A7Xq2zgvsF-A"
TODO_OPTION_ID="f75ad846"
PARENT_FIELD_ID="PVTF_lAHOAvwmhc4A7Xq2zgvsF-Y"

# Function to create issue with full metadata
create_issue_complete() {
  local title="$1"
  local body_file="$2"
  local labels="$3"
  local milestone="$4"
  local parent_issue="$5"  # Optional parent issue number
  
  # Create issue
  ISSUE_URL=$(gh issue create \
    --title "$title" \
    --body-file "$body_file" \
    --label "$labels" \
    --assignee "@me" \
    --milestone "$milestone" \
    --repo "$OWNER/$REPO" \
    2>&1)
  
  ISSUE_NUMBER=$(echo $ISSUE_URL | grep -o '[0-9]*$')
  echo "Created issue #$ISSUE_NUMBER"
  
  # Add to project
  gh project item-add $PROJECT_NUMBER \
    --owner $OWNER \
    --url $ISSUE_URL
  
  # CRITICAL: Wait for sync
  sleep 3
  
  # Get item ID
  ITEM_ID=$(gh project item-list $PROJECT_NUMBER --owner $OWNER --format json | \
    jq -r ".items[] | select(.content.number == $ISSUE_NUMBER) | .id")
  
  if [ -z "$ITEM_ID" ]; then
    echo "ERROR: Failed to get project item ID"
    return 1
  fi
  
  # Set status to Todo
  gh project item-edit \
    --project-id $PROJECT_ID \
    --id $ITEM_ID \
    --field-id $STATUS_FIELD_ID \
    --single-select-option-id $TODO_OPTION_ID
  
  # Set parent issue if provided
  if [ ! -z "$parent_issue" ]; then
    gh project item-edit \
      --project-id $PROJECT_ID \
      --id $ITEM_ID \
      --field-id $PARENT_FIELD_ID \
      --text "#$parent_issue"
    echo "Set parent issue to #$parent_issue"
  fi
  
  echo "Issue #$ISSUE_NUMBER fully configured"
}

# Example usage
create_issue_complete \
  "Create Review Worktree Script" \
  "issue-content.md" \
  "enhancement,scripts,high-priority" \
  "Review Automation Epic" \
  "20"  # Parent epic
```

## Lessons Learned & Fixes

### 1. Milestone Date Issue
**Problem**: Created milestone with past date (2024 instead of 2025)
**Fix**: Always use future dates for milestones
```bash
# Wrong
-f due_on="2024-02-01T00:00:00Z"  # Past date!

# Correct  
-f due_on="2025-02-01T00:00:00Z"  # Future date
```

### 2. Missing Relationships
**Problem**: GitHub Projects has relationship fields, but they weren't being set
**Fix**: Use the Parent Issue field
```bash
gh project item-edit \
  --project-id PROJECT_ID \
  --id $ITEM_ID \
  --field-id PARENT_FIELD_ID \
  --text "#20"
```

### 3. Timing Issues
**Problem**: Project item ID not found immediately after adding to project
**Fix**: Add sleep delay
```bash
gh project item-add ...
sleep 3  # Critical! Wait for GitHub to sync
ITEM_ID=$(gh project item-list ...)
```

### 4. Complex Field IDs
**Problem**: Field IDs are cryptic and hard to remember
**Fix**: Store them as constants in scripts or documentation

### 5. No Native Epic Support
**Problem**: GitHub doesn't have true epic/sub-issue relationships
**Fix**: Use combination of:
- Parent Issue field in projects
- Task lists in epic body
- Clear documentation in issue descriptions

## Real-World Example

Here's exactly how the Review Automation Epic (#20) and its sub-issues (#21-#27) were created:

```bash
# 1. Create milestone (with CORRECT future date)
gh api repos/pythonpete32/claude-swarm/milestones \
  --method POST \
  -f title="Review Automation Epic" \
  -f description="Cost-effective review automation" \
  -f due_on="2025-02-01T00:00:00Z"

# 2. Create epic
EPIC_URL=$(gh issue create ...)
# Add to project, set status...

# 3. Create sub-issues with parent relationship
for issue in 21 22 23 24 25 26 27; do
  # Create issue
  ISSUE_URL=$(gh issue create ...)
  
  # Add to project
  gh project item-add 2 --owner pythonpete32 --url $ISSUE_URL
  
  # Wait for sync
  sleep 3
  
  # Get item ID
  ITEM_ID=$(...)
  
  # Set status AND parent
  gh project item-edit \
    --project-id PVT_kwHOAvwmhc4A7Xq2 \
    --id $ITEM_ID \
    --field-id PVTSSF_lAHOAvwmhc4A7Xq2zgvsF-A \
    --single-select-option-id f75ad846
    
  gh project item-edit \
    --project-id PVT_kwHOAvwmhc4A7Xq2 \
    --id $ITEM_ID \
    --field-id PVTF_lAHOAvwmhc4A7Xq2zgvsF-Y \
    --text "#20"
done
```

## Best Practices

1. **Always use future dates** for milestones
2. **Add sleep delays** after project operations
3. **Set parent relationships** for epic/sub-issue tracking
4. **Document relationships** in issue body for clarity
5. **Test with single issue** before bulk operations
6. **Store field IDs** as constants
7. **Check for empty responses** when getting IDs

This complete guide includes all the fixes discovered during implementation and provides a robust approach to creating fully integrated GitHub issues.