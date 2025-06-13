# Create Review Worktree Script - Complete Implementation Guide

## Overview

This script creates an isolated git worktree for code review, allowing Claude Code to run in interactive mode (cost-effective) rather than expensive headless mode. It includes full GitHub issue creation with relationships and validation.

## Dependencies & Context

- **Epic**: #20 (Cost-Effective Review Automation with Worktree Isolation)
- **Blocks**: #24 (Run Smoke Test Command) 
- **Related**: #22 (Cleanup Review Worktree Script - paired functionality)

## Core Requirements

### 1. Git Worktree Creation
- [ ] Create worktree from current branch with naming convention `../review-issue-NUMBER-TIMESTAMP`
- [ ] Copy relevant context files (CLAUDE.md, .claude/commands/)
- [ ] Handle error cases (existing worktree, git issues)

### 2. Review Prompt Generation
- [ ] Generate review prompt with issue context and decision tree logic
- [ ] Include instructions from `.claude/commands/code-review.md`
- [ ] Support both APPROVED and NEEDS_WORK workflow paths

### 3. Claude Code Integration  
- [ ] Launch Claude Code interactively with initial prompt: `claude "review prompt"`
- [ ] Ensure proper context is available in worktree

### 4. GitHub Issue Linking
- [ ] Create GitHub issues for tracking
- [ ] Link issues using body references (manual approach)
- [ ] Set proper project metadata and relationships

## Implementation Details

### Script Location & Usage
```bash
# Location
scripts/create-review-worktree.sh

# Usage
./scripts/create-review-worktree.sh ISSUE_NUMBER
```

### Core Commands to Test

#### 1. Git Worktree Operations
```bash
# Test: Create worktree with naming convention
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
WORKTREE_PATH="../review-issue-${ISSUE_NUMBER}-${TIMESTAMP}"
git worktree add $WORKTREE_PATH

# Test: Copy context files
cp CLAUDE.md $WORKTREE_PATH/
cp -r .claude $WORKTREE_PATH/ 2>/dev/null || echo "No .claude directory"

# Test: Navigate to worktree
cd $WORKTREE_PATH
```

#### 2. GitHub Issue Creation with Relationships
```bash
# Prerequisites
gh auth refresh -s project

# Create main issue with metadata
ISSUE_URL=$(gh issue create \
  --title "Review Request: [Description]" \
  --body "$(cat <<EOF
## Review Context
Issue: #${ISSUE_NUMBER}
Branch: $(git branch --show-current)
Timestamp: $(date)

## Dependencies
- Epic: #20 (Cost-Effective Review Automation)
- Blocks: #24 (Run Smoke Test Command)
- Related: #22 (Cleanup Review Worktree Script)

## Review Instructions
- Check code quality and adherence to standards
- Verify tests pass and coverage is adequate
- Ensure documentation is updated
- Validate security considerations

## Decision Tree
- **APPROVED**: Create PR and merge
- **NEEDS_WORK**: Provide detailed feedback and return to development
EOF
)" \
  --label "review,enhancement,high-priority" \
  --assignee "@me" \
  --milestone "Review Automation Epic")

# Extract issue number
ISSUE_NUMBER=$(echo $ISSUE_URL | grep -o '[0-9]*$')

# Add to project
gh project item-add 2 --owner pythonpete32 --url $ISSUE_URL

# Wait for GitHub sync
sleep 3

# Get project item ID
ITEM_ID=$(gh project item-list 2 --owner pythonpete32 --format json | \
  jq -r ".items[] | select(.content.number == $ISSUE_NUMBER) | .id")

# Set project status to Todo
gh project item-edit \
  --project-id PVT_kwHOAvwmhc4A7Xq2 \
  --id $ITEM_ID \
  --field-id PVTSSF_lAHOAvwmhc4A7Xq2zgvsF-A \
  --single-select-option-id f75ad846

# Set parent relationship to epic
gh project item-edit \
  --project-id PVT_kwHOAvwmhc4A7Xq2 \
  --id $ITEM_ID \
  --field-id PVTF_lAHOAvwmhc4A7Xq2zgvsF-Y \
  --text "#20"
```

#### 3. Claude Code Launch
```bash
# Test: Generate review prompt
REVIEW_PROMPT="Execute code review for issue #${ISSUE_NUMBER}:

## Context
- Review worktree: $(pwd)
- Original issue: #${ISSUE_NUMBER}
- Branch: $(git branch --show-current)

## Instructions
1. Review all changed files for code quality
2. Check test coverage and run existing tests
3. Verify documentation updates
4. Assess security implications
5. Provide detailed feedback

## Decision Required
After review, choose:
- APPROVED: Ready for PR creation
- NEEDS_WORK: Provide specific improvement recommendations

Begin review now."

# Test: Launch Claude Code interactively
claude "$REVIEW_PROMPT"
```

### Error Handling & Validation

#### Error Cases to Test
```bash
# Test: Invalid issue number
./scripts/create-review-worktree.sh "invalid"

# Test: Worktree already exists
./scripts/create-review-worktree.sh 123
./scripts/create-review-worktree.sh 123  # Should fail gracefully

# Test: Not in git repository
cd /tmp
./scripts/create-review-worktree.sh 123  # Should fail with clear message

# Test: Claude not installed
which claude || echo "Claude CLI not found"
```

#### Required Error Messages
- "Error: Invalid issue number format"
- "Error: Worktree already exists at [path]"  
- "Error: Not in a git repository"
- "Error: Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-cli"
- "Error: GitHub CLI not authenticated. Run: gh auth login"

### Project Configuration Constants
```bash
# GitHub Project Details (claude-swarm)
OWNER="pythonpete32"
REPO="claude-swarm"  
PROJECT_NUMBER="2"
PROJECT_ID="PVT_kwHOAvwmhc4A7Xq2"

# Field IDs
STATUS_FIELD_ID="PVTSSF_lAHOAvwmhc4A7Xq2zgvsF-A"
PARENT_FIELD_ID="PVTF_lAHOAvwmhc4A7Xq2zgvsF-Y"

# Status Options
TODO_OPTION_ID="f75ad846"
IN_PROGRESS_OPTION_ID="47fc9ee4" 
DONE_OPTION_ID="98236657"
```

## Validation Checklist

### Smoke Test Scenarios
1. **Happy Path**
   ```bash
   ./scripts/create-review-worktree.sh 25
   # Expected: Worktree created, issue created, Claude launches
   ```

2. **File Copy Verification**
   ```bash
   ls -la ../review-issue-25-*/
   # Expected: CLAUDE.md and .claude/ directory present
   ```

3. **GitHub Integration**
   ```bash
   gh issue view 25  # Should show relationships in body
   gh project item-list 2 --owner pythonpete32  # Should show new item
   ```

4. **Claude Launch**
   - Claude should start with review prompt
   - Context files should be accessible
   - Review instructions should be clear

### Edge Case Testing
- [ ] Invalid issue number (non-numeric)
- [ ] Worktree already exists
- [ ] Not in git repository  
- [ ] Missing CLAUDE.md file
- [ ] GitHub API failures
- [ ] Claude CLI not installed
- [ ] Network connectivity issues

## Workflow Paths

### APPROVED Path
1. Review completed successfully
2. Create PR from worktree branch
3. Update GitHub issue status to "Done"
4. Clean up worktree after merge

### NEEDS_WORK Path  
1. Review identifies issues
2. Update GitHub issue with feedback
3. Set status to "In Progress"
4. Keep worktree for continued development
5. Re-run review after fixes

## Script Template Structure
```bash
#!/bin/bash
# create-review-worktree.sh

set -e  # Exit on any error

# Configuration
OWNER="pythonpete32"
REPO="claude-swarm"
PROJECT_NUMBER="2"
# ... other constants

# Functions
validate_input() { ... }
check_prerequisites() { ... }
create_worktree() { ... }
copy_context_files() { ... }
create_github_issue() { ... }
generate_review_prompt() { ... }
launch_claude() { ... }
handle_error() { ... }

# Main execution
main() {
  validate_input "$1"
  check_prerequisites
  create_worktree "$1"
  copy_context_files
  create_github_issue "$1"
  generate_review_prompt "$1"
  launch_claude
}

main "$@"
```

## Manual Issue Linking Approach

Since GitHub CLI doesn't support direct relationship creation, we use:

1. **Body References**: Include relationship keywords in issue descriptions
   - "Epic: #20" 
   - "Blocks: #24"
   - "Related: #22"

2. **Project Fields**: Set parent relationships using project custom fields
   ```bash
   gh project item-edit --field-id PARENT_FIELD_ID --text "#20"
   ```

3. **Labels**: Use consistent labeling for grouping related issues
   - `review`, `enhancement`, `high-priority`

This approach provides visual relationship tracking in both issue views and project boards while working within GitHub CLI limitations.

## Testing & Validation Requirements

Before finalizing this script:
- [ ] Test all commands individually
- [ ] Verify error handling works correctly
- [ ] Confirm GitHub issue creation and linking
- [ ] Validate Claude Code integration
- [ ] Test both APPROVED and NEEDS_WORK workflows
- [ ] Document any discovered limitations or workarounds

This comprehensive guide ensures the review worktree script will work reliably when implemented as a slash command.