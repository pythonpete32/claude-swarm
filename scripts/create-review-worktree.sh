#!/bin/bash
# create-review-worktree.sh
#
# Creates an isolated git worktree for code review, allowing Claude Code to run 
# in interactive mode (account billing) rather than expensive headless mode.
#
# Usage: ./scripts/create-review-worktree.sh ISSUE_NUMBER

set -e  # Exit on any error

# Configuration - Auto-detect from git remote or use environment variables
OWNER="${GITHUB_OWNER:-$(git remote get-url origin | sed -n 's/.*github\.com[:/]\([^/]*\).*/\1/p')}"
REPO="${GITHUB_REPO:-$(git remote get-url origin | sed -n 's/.*github\.com[:/][^/]*\/\([^/.]*\).*/\1/p')}"
PROJECT_NUMBER="${GITHUB_PROJECT_NUMBER:-}"
PROJECT_ID="${GITHUB_PROJECT_ID:-}"

# Field IDs for GitHub Project - make configurable
STATUS_FIELD_ID="${GITHUB_STATUS_FIELD_ID:-}"
PARENT_FIELD_ID="${GITHUB_PARENT_FIELD_ID:-}"

# Status Options - will be detected dynamically
TODO_OPTION_ID="${GITHUB_TODO_OPTION_ID:-}"
IN_PROGRESS_OPTION_ID="${GITHUB_IN_PROGRESS_OPTION_ID:-}"

# Function: Detect project field IDs and status options dynamically
detect_project_configuration() {
    local project_number="$1"
    local owner="$2"
    
    if [[ -z "$project_number" || -z "$owner" ]]; then
        return 1
    fi
    
    log_info "Detecting project configuration for project #$project_number..."
    
    # Get project fields
    local fields_json
    if ! fields_json=$(gh project field-list "$project_number" --owner "$owner" --format json 2>/dev/null); then
        log_warn "Failed to detect project fields"
        return 1
    fi
    
    # Extract Status field ID and options
    local status_field_info
    status_field_info=$(echo "$fields_json" | jq -r '.fields[] | select(.name == "Status" and .type == "ProjectV2SingleSelectField")')
    
    if [[ -n "$status_field_info" ]]; then
        # Update STATUS_FIELD_ID if not already set
        if [[ -z "$STATUS_FIELD_ID" ]]; then
            STATUS_FIELD_ID=$(echo "$status_field_info" | jq -r '.id')
            log_info "Detected Status field ID: $STATUS_FIELD_ID"
        fi
        
        # Detect appropriate status options
        local options_json
        options_json=$(echo "$status_field_info" | jq -r '.options[]')
        
        # Try to match common status column names (in priority order)
        local todo_patterns=("Todo" "Backlog" "Ready for Work" "To Do" "New")
        local progress_patterns=("In Progress" "Human Review" "PR/Review" "In Review" "Working")
        
        if [[ -z "$TODO_OPTION_ID" ]]; then
            for pattern in "${todo_patterns[@]}"; do
                local option_id
                option_id=$(echo "$status_field_info" | jq -r ".options[] | select(.name == \"$pattern\") | .id")
                if [[ -n "$option_id" && "$option_id" != "null" ]]; then
                    TODO_OPTION_ID="$option_id"
                    log_info "Detected TODO status: '$pattern' (ID: $option_id)"
                    break
                fi
            done
        fi
        
        if [[ -z "$IN_PROGRESS_OPTION_ID" ]]; then
            for pattern in "${progress_patterns[@]}"; do
                local option_id
                option_id=$(echo "$status_field_info" | jq -r ".options[] | select(.name == \"$pattern\") | .id")
                if [[ -n "$option_id" && "$option_id" != "null" ]]; then
                    IN_PROGRESS_OPTION_ID="$option_id"
                    log_info "Detected IN_PROGRESS status: '$pattern' (ID: $option_id)"
                    break
                fi
            done
        fi
    fi
    
    # Extract Parent field ID if not set
    if [[ -z "$PARENT_FIELD_ID" ]]; then
        local parent_field_id
        parent_field_id=$(echo "$fields_json" | jq -r '.fields[] | select(.name == "Parent issue" or .name == "Parent" or .name == "Epic") | .id' | head -1)
        if [[ -n "$parent_field_id" && "$parent_field_id" != "null" ]]; then
            PARENT_FIELD_ID="$parent_field_id"
            log_info "Detected Parent field ID: $PARENT_FIELD_ID"
        fi
    fi
    
    return 0
}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function: Print colored output
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Function: Validate input
validate_input() {
    local issue_number="$1"
    
    if [ -z "$issue_number" ]; then
        log_error "Issue number is required"
        echo "Usage: $0 ISSUE_NUMBER"
        echo "Example: $0 25"
        exit 1
    fi
    
    if ! [[ "$issue_number" =~ ^[0-9]+$ ]]; then
        log_error "Invalid issue number format: '$issue_number'"
        echo "Issue number must be a positive integer"
        exit 1
    fi
}

# Function: Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if in git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository"
        exit 1
    fi
    
    # Validate auto-detected repository info
    if [ -z "$OWNER" ] || [ -z "$REPO" ]; then
        log_error "Failed to auto-detect repository information"
        echo "Could not extract owner/repo from git remote origin"
        echo "Set manually with: export GITHUB_OWNER=your-username GITHUB_REPO=your-repo"
        exit 1
    fi
    
    log_info "Repository: $OWNER/$REPO"
    
    # Check if Claude CLI is available
    if ! command -v claude &> /dev/null; then
        log_error "Claude CLI not found"
        echo "Install with: npm install -g @anthropic-ai/claude-cli"
        exit 1
    fi
    
    # Check if GitHub CLI is available and authenticated
    if ! command -v gh &> /dev/null; then
        log_error "GitHub CLI not found"
        echo "Install with: brew install gh"
        exit 1
    fi
    
    if ! gh auth status &> /dev/null; then
        log_error "GitHub CLI not authenticated"
        echo "Run: gh auth login"
        exit 1
    fi
    
    # Check project scope only if project integration is configured
    if [[ -n "$PROJECT_NUMBER" ]]; then
        if ! gh auth status 2>&1 | grep -q "project"; then
            log_warn "GitHub CLI missing project scope (needed for project integration)"
            echo "Run: gh auth refresh -s project"
        fi
    fi
    
    log_info "Prerequisites check completed"
}

# Function: Create worktree
create_worktree() {
    local issue_number="$1"
    local timestamp="$(date +%Y%m%d-%H%M%S)"
    local worktree_path="../review-issue-${issue_number}-${timestamp}"
    
    log_info "Creating worktree at: $worktree_path"
    
    # Check if worktree already exists (similar pattern)
    if ls ../review-issue-${issue_number}-* 2>/dev/null | head -1 | grep -q .; then
        log_warn "Existing worktree found for issue #${issue_number}"
        local existing=$(ls -d ../review-issue-${issue_number}-* 2>/dev/null | head -1)
        echo "Existing worktree: $existing"
        read -p "Continue with new worktree? (y/N): " confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            log_info "Operation cancelled"
            exit 0
        fi
    fi
    
    # Get current branch
    local current_branch="$(git branch --show-current)"
    log_info "Creating worktree from branch: $current_branch"
    
    # Create worktree (use current commit if branch is already checked out)
    if ! git worktree add "$worktree_path" "$current_branch" 2>/dev/null; then
        log_warn "Branch '$current_branch' already checked out, using current commit"
        git worktree add "$worktree_path" HEAD
    fi
    
    # Store worktree path for other functions
    WORKTREE_PATH="$worktree_path"
    
    log_info "Worktree created successfully"
}

# Function: Copy context files
copy_context_files() {
    log_info "Copying context files to worktree..."
    
    # Copy CLAUDE.md if it exists
    if [ -f "CLAUDE.md" ]; then
        cp "CLAUDE.md" "$WORKTREE_PATH/"
        log_info "Copied CLAUDE.md"
    else
        log_warn "CLAUDE.md not found in current directory"
    fi
    
    # Copy .claude directory if it exists
    if [ -d ".claude" ]; then
        cp -r ".claude" "$WORKTREE_PATH/"
        log_info "Copied .claude directory"
    else
        log_warn ".claude directory not found"
    fi
    
    log_info "Context files copied successfully"
}

# Function: Create GitHub issue for tracking
create_github_issue() {
    local issue_number="$1"
    local current_branch="$(git branch --show-current)"
    local timestamp="$(date)"
    local worktree_path="$WORKTREE_PATH"
    
    log_info "Creating GitHub tracking issue..."
    
    # Create issue body
    local issue_body="$(cat <<EOF
## Review Context
Original Issue: #${issue_number}
Branch: ${current_branch}
Worktree: ${worktree_path}
Timestamp: ${timestamp}

## Dependencies
- Epic: #20 (Cost-Effective Review Automation)
- Reviews: #${issue_number} (Original implementation)

## Review Instructions
- Check code quality and adherence to standards
- Verify tests pass and coverage is adequate
- Ensure documentation is updated
- Validate security considerations

## Decision Tree
- **APPROVED**: Create PR and merge
- **NEEDS_WORK**: Provide detailed feedback and return to development

## Validation Steps
1. Review all changed files for code quality
2. Run automated tests and check coverage
3. Perform manual smoke tests
4. Validate against original requirements
5. Check for security implications

## Next Steps
This issue will be updated with review results and decision.
EOF
)"
    
    # Create the issue
    local issue_url
    issue_url=$(gh issue create \
        --title "Review Request: Issue #${issue_number}" \
        --body "$issue_body" \
        --label "review,enhancement,high-priority" \
        --assignee "@me" \
        --milestone "Review Automation Epic" \
        --repo "$OWNER/$REPO" 2>&1)
    
    if [[ $? -ne 0 ]]; then
        log_error "Failed to create GitHub issue"
        echo "$issue_url"
        return 1
    fi
    
    # Extract issue number
    local review_issue_number="$(echo $issue_url | grep -o '[0-9]*$')"
    log_info "Created review issue #${review_issue_number}"
    
    # Add to project with error handling (skip if no project configured)
    if [[ -n "$PROJECT_NUMBER" && -n "$OWNER" ]]; then
        # Detect project configuration dynamically
        detect_project_configuration "$PROJECT_NUMBER" "$OWNER" || log_warn "Could not detect all project fields"
        
        if gh project item-add $PROJECT_NUMBER --owner $OWNER --url "$issue_url" 2>/dev/null; then
            log_info "Added issue to project #$PROJECT_NUMBER"
            
            # Only attempt advanced project integration if all IDs are available
            if [[ -n "$PROJECT_ID" && -n "$STATUS_FIELD_ID" && -n "$TODO_OPTION_ID" ]]; then
                # Wait for GitHub sync
                sleep 3
                
                # Get project item ID
                local item_id
                item_id=$(gh project item-list $PROJECT_NUMBER --owner $OWNER --format json 2>/dev/null | \
                    jq -r ".items[] | select(.content.number == $review_issue_number) | .id" 2>/dev/null)
                
                if [ -n "$item_id" ]; then
                    # Set status to Todo
                    gh project item-edit \
                        --project-id $PROJECT_ID \
                        --id "$item_id" \
                        --field-id $STATUS_FIELD_ID \
                        --single-select-option-id $TODO_OPTION_ID 2>/dev/null || log_warn "Failed to set project status"
                    
                    # Set parent relationship if configured
                    if [[ -n "$PARENT_FIELD_ID" ]]; then
                        gh project item-edit \
                            --project-id $PROJECT_ID \
                            --id "$item_id" \
                            --field-id $PARENT_FIELD_ID \
                            --text "#20" 2>/dev/null || log_warn "Failed to set parent relationship"
                    fi
                    
                    log_info "Issue added to project with relationships"
                else
                    log_warn "Could not configure project relationships"
                fi
            else
                log_info "Basic project integration complete (advanced fields not configured)"
            fi
        else
            log_warn "Failed to add issue to project (may not have project scope)"
        fi
    else
        log_info "No GitHub project configured, skipping project integration"
    fi
    
    REVIEW_ISSUE_NUMBER="$review_issue_number"
}

# Function: Generate review prompt
generate_review_prompt() {
    local issue_number="$1"
    local current_branch="$(git branch --show-current)"
    
    REVIEW_PROMPT="Execute code review for issue #${issue_number}:

## Context
- Review worktree: ${WORKTREE_PATH}
- Original issue: #${issue_number}
- Branch: ${current_branch}
- Review tracking: #${REVIEW_ISSUE_NUMBER}

## Instructions
Use the /project:review-issue command with the following process:

1. **Understand Requirements**
   - Fetch issue #${issue_number} details: \`gh issue view ${issue_number}\`
   - Extract original requirements and acceptance criteria

2. **Review Implementation**
   - Check work report: \`cat planning/temp/work-report/${issue_number}.md\`
   - Review code changes: \`git diff main..${current_branch}\`
   - Validate implementation completeness

3. **Run Validation**
   - Execute automated tests
   - Perform manual smoke tests based on requirements
   - Check for regressions

4. **Generate Decision**
   - **APPROVED**: Create PR with comprehensive description
   - **NEEDS_WORK**: Create detailed feedback document

## Decision Required
After thorough review, update issue #${REVIEW_ISSUE_NUMBER} with your decision and next steps.

Begin review process now using: /project:review-issue ${issue_number}"
}

# Function: Launch Claude Code
launch_claude() {
    log_info "Launching Claude Code in worktree..."
    
    # Navigate to worktree
    cd "$WORKTREE_PATH"
    
    log_info "Current directory: $(pwd)"
    log_info "Review prompt generated. Launching Claude..."
    
    # Launch Claude with the review prompt
    claude "$REVIEW_PROMPT"
}

# Function: Handle errors
handle_error() {
    local exit_code=$?
    log_error "Script failed with exit code: $exit_code"
    
    if [ -n "$WORKTREE_PATH" ] && [ -d "$WORKTREE_PATH" ]; then
        log_info "Cleaning up worktree: $WORKTREE_PATH"
        cd ..
        git worktree remove "$WORKTREE_PATH" --force 2>/dev/null || true
    fi
    
    exit $exit_code
}

# Function: Display usage
show_usage() {
    echo "Create Review Worktree Script"
    echo ""
    echo "Usage: $0 [--test] ISSUE_NUMBER"
    echo ""
    echo "Creates an isolated git worktree for code review, allowing Claude Code"
    echo "to run in interactive mode (cost-effective) rather than headless mode."
    echo ""
    echo "Arguments:"
    echo "  ISSUE_NUMBER    GitHub issue number to review (e.g., 25)"
    echo ""
    echo "Options:"
    echo "  --test          Test mode (skip GitHub issue creation and Claude launch)"
    echo ""
    echo "Examples:"
    echo "  $0 25           Review implementation of issue #25"
    echo "  $0 --test 42    Test script functionality with issue #42"
    echo ""
    echo "Requirements:"
    echo "  - Git repository"
    echo "  - GitHub CLI (gh) authenticated with project scope"
    echo "  - Claude CLI installed"
    echo "  - CLAUDE.md and .claude/ directory (recommended)"
}

# Main execution function
main() {
    # Set up error handling
    trap handle_error ERR
    
    # Handle help flags
    if [[ "$1" == "-h" || "$1" == "--help" ]]; then
        show_usage
        exit 0
    fi
    
    # Handle test mode
    local test_mode=false
    if [[ "$1" == "--test" ]]; then
        test_mode=true
        shift
    fi
    
    local issue_number="$1"
    
    log_info "Starting create-review-worktree for issue #${issue_number}"
    
    # Execute main workflow
    validate_input "$issue_number"
    check_prerequisites
    create_worktree "$issue_number"
    copy_context_files
    
    if [[ "$test_mode" == "true" ]]; then
        log_info "TEST MODE: Skipping GitHub issue creation and Claude launch"
        generate_review_prompt "$issue_number"
        log_info "Review prompt generated successfully:"
        echo "--------------------"
        echo "$REVIEW_PROMPT"
        echo "--------------------"
        log_info "Test completed successfully!"
        log_info "Worktree location: $WORKTREE_PATH"
        log_info "Run: cd $WORKTREE_PATH && claude \"\$REVIEW_PROMPT\" to start review"
    else
        create_github_issue "$issue_number"
        generate_review_prompt "$issue_number"
        launch_claude
        
        log_info "Review worktree created and Claude launched successfully"
        log_info "Worktree location: $WORKTREE_PATH"
        log_info "Review tracking issue: #$REVIEW_ISSUE_NUMBER"
    fi
}

# Execute main function with all arguments
main "$@"