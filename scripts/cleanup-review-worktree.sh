#!/bin/bash
# cleanup-review-worktree.sh
#
# Merges feedback from review worktree back to original branch and cleans up 
# the worktree, completing the review cycle for cost-effective review automation.
#
# Usage: ./scripts/cleanup-review-worktree.sh ISSUE_NUMBER

set -e  # Exit on any error

# Configuration - Auto-detect from git remote or use environment variables
OWNER="${GITHUB_OWNER:-$(git remote get-url origin | sed -n 's/.*github\.com[:/]\([^/]*\).*/\1/p')}"
REPO="${GITHUB_REPO:-$(git remote get-url origin | sed -n 's/.*github\.com[:/][^/]*\/\([^/.]*\).*/\1/p')}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function: Print colored output
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_success() { echo -e "${BLUE}[SUCCESS]${NC} $1"; }

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
    
    log_info "Prerequisites check completed"
}

# Function: Find review worktree
find_review_worktree() {
    local issue_number="$1"
    local pattern="../review-issue-${issue_number}-*"
    
    log_info "Looking for review worktree with pattern: $pattern"
    
    # Find matching directories
    local worktrees=($(ls -d $pattern 2>/dev/null || true))
    
    if [ ${#worktrees[@]} -eq 0 ]; then
        log_error "No review worktree found for issue #${issue_number}"
        echo "Expected pattern: ../review-issue-${issue_number}-TIMESTAMP"
        echo ""
        echo "Available worktrees:"
        git worktree list | grep -E "review-issue-[0-9]+" || echo "  No review worktrees found"
        exit 1
    elif [ ${#worktrees[@]} -gt 1 ]; then
        log_warn "Multiple review worktrees found for issue #${issue_number}:"
        for wt in "${worktrees[@]}"; do
            echo "  - $wt"
        done
        echo ""
        # Use the most recent one (last in alphabetical order due to timestamp)
        REVIEW_WORKTREE_PATH="${worktrees[-1]}"
        log_info "Using most recent: $REVIEW_WORKTREE_PATH"
    else
        REVIEW_WORKTREE_PATH="${worktrees[0]}"
        log_info "Found review worktree: $REVIEW_WORKTREE_PATH"
    fi
    
    # Verify it's actually a git worktree
    if ! git worktree list | grep -q "$REVIEW_WORKTREE_PATH"; then
        log_error "Found directory but it's not a registered git worktree: $REVIEW_WORKTREE_PATH"
        echo "Use: git worktree remove --force $REVIEW_WORKTREE_PATH"
        exit 1
    fi
}

# Function: Check for review feedback
check_feedback() {
    local issue_number="$1"
    
    log_info "Checking for review feedback..."
    
    # Check for feedback in review worktree
    local feedback_paths=(
        "$REVIEW_WORKTREE_PATH/planning/temp/review-feedback/${issue_number}-feedback.md"
        "$REVIEW_WORKTREE_PATH/planning/temp/review-feedback.md"
        "$REVIEW_WORKTREE_PATH/review-feedback.md"
    )
    
    FEEDBACK_FILE=""
    for path in "${feedback_paths[@]}"; do
        if [ -f "$path" ]; then
            FEEDBACK_FILE="$path"
            log_info "Found feedback file: $path"
            break
        fi
    done
    
    if [ -z "$FEEDBACK_FILE" ]; then
        log_info "No feedback file found - assuming APPROVED review path"
        return 0
    fi
    
    # Display feedback summary
    log_info "Review feedback summary:"
    echo "----------------------------------------"
    head -20 "$FEEDBACK_FILE" | sed 's/^/  /'
    if [ $(wc -l < "$FEEDBACK_FILE") -gt 20 ]; then
        echo "  ... (truncated)"
    fi
    echo "----------------------------------------"
}

# Function: Merge feedback to original branch
merge_feedback() {
    local issue_number="$1"
    
    if [ -z "$FEEDBACK_FILE" ]; then
        log_info "No feedback to merge (APPROVED path)"
        return 0
    fi
    
    log_info "Merging feedback to original branch..."
    
    # Ensure feedback directory exists in original branch
    mkdir -p "planning/temp/review-feedback"
    
    # Copy feedback file to original branch
    local target_file="planning/temp/review-feedback/${issue_number}-feedback.md"
    cp "$FEEDBACK_FILE" "$target_file"
    
    # Also create a general feedback file for easy access
    cp "$FEEDBACK_FILE" "planning/temp/review-feedback.md"
    
    log_success "Feedback merged to: $target_file"
    
    # Check if feedback indicates NEEDS_WORK
    if grep -qi "needs.work\|issues.found\|required.actions" "$FEEDBACK_FILE" 2>/dev/null; then
        log_warn "Review indicates NEEDS_WORK - check feedback for required actions"
        echo ""
        echo "Next steps:"
        echo "1. Review feedback: cat $target_file"
        echo "2. Address issues identified in feedback"
        echo "3. Re-run review when ready: ./scripts/create-review-worktree.sh $issue_number"
    else
        log_success "Review appears to be APPROVED - feedback is informational"
    fi
}

# Function: Check for uncommitted changes
check_uncommitted_changes() {
    log_info "Checking for uncommitted changes in review worktree..."
    
    # Check if there are any changes in the review worktree
    local current_dir="$(pwd)"
    cd "$REVIEW_WORKTREE_PATH"
    
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        log_warn "Review worktree has uncommitted changes"
        echo ""
        echo "Changed files:"
        git status --porcelain | sed 's/^/  /'
        echo ""
        read -p "Continue with cleanup? Changes will be lost. (y/N): " confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            log_info "Cleanup cancelled - review worktree preserved"
            cd "$current_dir"
            exit 0
        fi
    else
        log_info "No uncommitted changes found"
    fi
    
    cd "$current_dir"
}

# Function: Clean up worktree
cleanup_worktree() {
    local issue_number="$1"
    
    log_info "Cleaning up review worktree..."
    
    # Remove the worktree
    if git worktree remove "$REVIEW_WORKTREE_PATH" --force 2>/dev/null; then
        log_success "Review worktree removed: $REVIEW_WORKTREE_PATH"
    else
        log_error "Failed to remove worktree with git command"
        log_warn "Attempting manual cleanup..."
        
        # Manual cleanup as fallback
        if [ -d "$REVIEW_WORKTREE_PATH" ]; then
            rm -rf "$REVIEW_WORKTREE_PATH"
            log_success "Directory manually removed: $REVIEW_WORKTREE_PATH"
        fi
    fi
    
    # Verify cleanup
    if [ -d "$REVIEW_WORKTREE_PATH" ]; then
        log_error "Failed to clean up: $REVIEW_WORKTREE_PATH still exists"
        exit 1
    fi
    
    # Clean up any orphaned git worktree references
    git worktree prune 2>/dev/null || true
}

# Function: Update GitHub issue status (if applicable)
update_github_status() {
    local issue_number="$1"
    
    # Check if this was a tracking issue created by create-review-worktree.sh
    if command -v gh &> /dev/null && gh auth status &> /dev/null; then
        log_info "Checking for review tracking issues..."
        
        # Look for review tracking issues
        local review_issues=$(gh issue list --repo "${OWNER}/${REPO}" --search "Review Request: Issue #${issue_number}" --limit 5 --json number,title 2>/dev/null | jq -r '.[] | "\(.number):\(.title)"' 2>/dev/null || true)
        
        if [ -n "$review_issues" ]; then
            echo "Found review tracking issues:"
            echo "$review_issues" | sed 's/^/  /'
            echo ""
            log_info "Consider updating review tracking issue status manually"
        fi
    fi
}

# Function: Display summary
display_summary() {
    local issue_number="$1"
    
    echo ""
    log_success "Review cleanup completed for issue #${issue_number}"
    echo ""
    echo "Summary:"
    
    if [ -n "$FEEDBACK_FILE" ]; then
        echo "  ✓ Feedback merged to: planning/temp/review-feedback/${issue_number}-feedback.md"
        if grep -qi "needs.work\|needs_work\|issues.found\|required.actions" "$FEEDBACK_FILE" 2>/dev/null; then
            echo "  ⚠ Review status: NEEDS_WORK (check feedback for required actions)"
            REVIEW_STATUS="NEEDS_WORK"
        else
            echo "  ✓ Review status: APPROVED (feedback is informational)"
            REVIEW_STATUS="APPROVED"
        fi
    else
        echo "  ✓ Review status: APPROVED (no feedback file found)"
        REVIEW_STATUS="APPROVED"
    fi
    
    echo "  ✓ Review worktree cleaned up"
    echo "  ✓ Git worktree references pruned"
    echo ""
    
    if [[ "$REVIEW_STATUS" == "NEEDS_WORK" ]]; then
        echo "Next steps for NEEDS_WORK:"
        echo "  1. Review feedback: cat planning/temp/review-feedback/${issue_number}-feedback.md"
        echo "  2. Address identified issues"
        echo "  3. Re-run review: ./scripts/create-review-worktree.sh ${issue_number}"
    else
        echo "Next steps for APPROVED:"
        echo "  1. Create PR for issue #${issue_number}"
        echo "  2. Reference review completion in PR description"
    fi
}

# Function: Display usage
show_usage() {
    echo "Cleanup Review Worktree Script"
    echo ""
    echo "Usage: $0 ISSUE_NUMBER"
    echo ""
    echo "Merges feedback from review worktree back to original branch and cleans up"
    echo "the worktree, completing the review cycle for cost-effective review automation."
    echo ""
    echo "Arguments:"
    echo "  ISSUE_NUMBER    GitHub issue number that was reviewed (e.g., 25)"
    echo ""
    echo "Examples:"
    echo "  $0 25           Cleanup review worktree for issue #25"
    echo "  $0 42           Cleanup review worktree for issue #42"
    echo ""
    echo "What this script does:"
    echo "  1. Finds review worktree (../review-issue-NUMBER-TIMESTAMP)"
    echo "  2. Checks for review feedback in worktree"
    echo "  3. Merges feedback to original branch (if exists)"
    echo "  4. Safely removes review worktree"
    echo "  5. Provides summary and next steps"
    echo ""
    echo "Review Paths:"
    echo "  APPROVED: No feedback file found, ready for PR creation"
    echo "  NEEDS_WORK: Feedback file found, address issues and re-review"
}

# Function: Handle errors
handle_error() {
    local exit_code=$?
    log_error "Script failed with exit code: $exit_code"
    
    if [ -n "$REVIEW_WORKTREE_PATH" ] && [ -d "$REVIEW_WORKTREE_PATH" ]; then
        log_info "Review worktree preserved for investigation: $REVIEW_WORKTREE_PATH"
    fi
    
    exit $exit_code
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
    
    local issue_number="$1"
    
    log_info "Starting cleanup-review-worktree for issue #${issue_number}"
    
    # Execute main workflow
    validate_input "$issue_number"
    check_prerequisites
    find_review_worktree "$issue_number"
    check_feedback "$issue_number"
    check_uncommitted_changes
    merge_feedback "$issue_number"
    cleanup_worktree "$issue_number"
    update_github_status "$issue_number"
    display_summary "$issue_number"
}

# Execute main function with all arguments
main "$@"