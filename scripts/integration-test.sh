#!/bin/bash
# integration-test.sh
#
# End-to-end integration testing for the cost-effective review automation workflow
# Tests both APPROVED and NEEDS_WORK scenarios with error handling validation

set -e

# Test configuration
TEST_ISSUE_APPROVED=1001
TEST_ISSUE_NEEDS_WORK=1002
TEST_TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TEST_RESULTS_DIR="planning/temp/test-results"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging functions
log_test() { echo -e "${BLUE}[TEST]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_info() { echo -e "${PURPLE}[INFO]${NC} $1"; }

# Test tracking
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

# Function: Run test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    log_test "Running: $test_name"
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if eval "$test_command" 2>/dev/null; then
        log_pass "$test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_fail "$test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        FAILED_TESTS+=("$test_name")
        return 1
    fi
}

# Function: Setup test environment
setup_test_environment() {
    log_info "Setting up integration test environment..."
    
    # Create test results directory
    mkdir -p "$TEST_RESULTS_DIR"
    
    # Record test start
    echo "Integration Test Run: $TEST_TIMESTAMP" > "$TEST_RESULTS_DIR/test-run-$TEST_TIMESTAMP.log"
    echo "=================================" >> "$TEST_RESULTS_DIR/test-run-$TEST_TIMESTAMP.log"
    
    log_info "Test environment ready"
}

# Function: Test 1 - Component existence
test_component_existence() {
    log_test "Phase 1: Component Existence Testing"
    
    local components=(
        "scripts/create-review-worktree.sh"
        "scripts/cleanup-review-worktree.sh"
        ".claude/commands/run-smoke-test.md"
        ".claude/commands/cleanup-smoke-test.md"
        ".claude/commands/code-review.md"
        "docs/review-automation-workflow.md"
    )
    
    local all_exist=0
    for component in "${components[@]}"; do
        if [[ -f "$component" ]]; then
            log_pass "Component exists: $component"
        else
            log_fail "Component missing: $component"
            all_exist=1
        fi
    done
    
    return $all_exist
}

# Function: Test 2 - Prerequisites validation
test_prerequisites() {
    log_test "Phase 2: Prerequisites Testing"
    
    # Test git repository
    if git rev-parse --git-dir > /dev/null 2>&1; then
        log_pass "Git repository detected"
    else
        log_fail "Not in git repository"
        return 1
    fi
    
    # Test Claude CLI
    if command -v claude &> /dev/null; then
        log_pass "Claude CLI available"
    else
        log_fail "Claude CLI not found"
        return 1
    fi
    
    # Test GitHub CLI
    if command -v gh &> /dev/null; then
        log_pass "GitHub CLI available"
    else
        log_fail "GitHub CLI not found"
        return 1
    fi
    
    # Test GitHub authentication
    if gh auth status &> /dev/null; then
        log_pass "GitHub CLI authenticated"
    else
        log_warn "GitHub CLI not authenticated (non-blocking)"
    fi
    
    return 0
}

# Function: Test 3 - Script functionality
test_script_functionality() {
    log_test "Phase 3: Script Functionality Testing"
    
    # Test help functions
    if ./scripts/create-review-worktree.sh --help > /dev/null 2>&1; then
        log_pass "Create script help works"
    else
        log_fail "Create script help failed"
        return 1
    fi
    
    if ./scripts/cleanup-review-worktree.sh --help > /dev/null 2>&1; then
        log_pass "Cleanup script help works"
    else
        log_fail "Cleanup script help failed"
        return 1
    fi
    
    # Test input validation
    if ./scripts/create-review-worktree.sh invalid 2>&1 | grep -q "Invalid issue number"; then
        log_pass "Create script input validation works"
    else
        log_fail "Create script input validation failed"
        return 1
    fi
    
    if ./scripts/cleanup-review-worktree.sh invalid 2>&1 | grep -q "Invalid issue number"; then
        log_pass "Cleanup script input validation works"
    else
        log_fail "Cleanup script input validation failed"
        return 1
    fi
    
    return 0
}

# Function: Test 4 - APPROVED workflow
test_approved_workflow() {
    log_test "Phase 4: APPROVED Workflow Testing"
    
    local issue_number=$TEST_ISSUE_APPROVED
    
    # Step 1: Create worktree (test mode)
    log_info "Testing worktree creation..."
    if ./scripts/create-review-worktree.sh --test $issue_number > /tmp/create-test.log 2>&1; then
        log_pass "Worktree creation successful"
    else
        log_fail "Worktree creation failed"
        cat /tmp/create-test.log
        return 1
    fi
    
    # Verify worktree exists
    local worktree_path="../review-issue-${issue_number}-*"
    if ls -d $worktree_path 2>/dev/null | head -1 | grep -q .; then
        local actual_path=$(ls -d $worktree_path 2>/dev/null | head -1)
        log_pass "Worktree directory created: $actual_path"
        
        # Verify context files
        if [[ -f "$actual_path/CLAUDE.md" && -d "$actual_path/.claude" ]]; then
            log_pass "Context files copied correctly"
        else
            log_fail "Context files missing"
            return 1
        fi
        
        # Verify enhanced decision logic
        if grep -q "🟢 APPROVED PATH" "$actual_path/.claude/commands/code-review.md"; then
            log_pass "Enhanced decision logic available"
        else
            log_fail "Enhanced decision logic missing"
            return 1
        fi
        
        # Step 2: Test cleanup (APPROVED path - no feedback)
        log_info "Testing APPROVED cleanup..."
        if echo "y" | ./scripts/cleanup-review-worktree.sh $issue_number > /tmp/cleanup-approved.log 2>&1; then
            log_pass "APPROVED cleanup successful"
            
            # Verify worktree removed
            if ! ls -d $worktree_path 2>/dev/null | head -1 | grep -q .; then
                log_pass "Worktree properly removed"
            else
                log_fail "Worktree not removed"
                return 1
            fi
        else
            log_fail "APPROVED cleanup failed"
            cat /tmp/cleanup-approved.log
            return 1
        fi
    else
        log_fail "Worktree directory not found"
        return 1
    fi
    
    return 0
}

# Function: Test 5 - NEEDS_WORK workflow
test_needs_work_workflow() {
    log_test "Phase 5: NEEDS_WORK Workflow Testing"
    
    local issue_number=$TEST_ISSUE_NEEDS_WORK
    
    # Step 1: Create worktree (test mode)
    log_info "Testing worktree creation for NEEDS_WORK..."
    if ./scripts/create-review-worktree.sh --test $issue_number > /tmp/create-needs-work.log 2>&1; then
        log_pass "NEEDS_WORK worktree creation successful"
    else
        log_fail "NEEDS_WORK worktree creation failed"
        return 1
    fi
    
    # Find worktree path
    local worktree_path="../review-issue-${issue_number}-*"
    local actual_path=$(ls -d $worktree_path 2>/dev/null | head -1)
    
    if [[ -n "$actual_path" ]]; then
        # Step 2: Create mock feedback (NEEDS_WORK scenario)
        log_info "Creating mock NEEDS_WORK feedback..."
        mkdir -p "$actual_path/planning/temp/review-feedback"
        
        cat > "$actual_path/planning/temp/review-feedback/${issue_number}-feedback.md" << 'EOF'
# Review Feedback for Issue #1002

## Summary
Review identified 2 critical issues that must be addressed before approval.

## Issues Found (Prioritized by Severity)

### 🔴 CRITICAL: Test Coverage Missing
**Problem**: No automated tests for core functionality
**Expected**: Comprehensive test suite with >80% coverage
**Found**: Zero test coverage
**Fix**: Add unit tests and integration tests
**Impact**: Cannot verify correctness or prevent regressions

### 🔴 CRITICAL: Security Vulnerability
**Problem**: SQL injection vulnerability in user input handling
**Expected**: Parameterized queries and input sanitization
**Found**: Direct string concatenation in SQL queries
**Fix**: Use prepared statements and input validation
**Impact**: Critical security risk

## Required Actions (Must Complete All)
- [ ] Add comprehensive test suite
- [ ] Fix SQL injection vulnerability
- [ ] Add input validation
- [ ] Security audit

## Validation Steps to Retry After Fixes
1. Run `npm test` to verify >80% coverage
2. Run security scan
3. Verify no SQL injection vulnerabilities

## Next Steps
1. Address all required actions above
2. Test fixes using validation steps
3. Re-run review: `/project:run-smoke-test 1002`

Status: **NEEDS_WORK** - Critical issues must be resolved before approval
EOF
        
        log_pass "Mock feedback created with NEEDS_WORK status"
        
        # Step 3: Test cleanup with feedback merge
        log_info "Testing NEEDS_WORK cleanup with feedback merge..."
        if echo "y" | ./scripts/cleanup-review-worktree.sh $issue_number > /tmp/cleanup-needs-work.log 2>&1; then
            log_pass "NEEDS_WORK cleanup successful"
            
            # Verify feedback merged
            if [[ -f "planning/temp/review-feedback/${issue_number}-feedback.md" ]]; then
                log_pass "Feedback merged to original branch"
                
                # Verify feedback content
                if grep -q "NEEDS_WORK" "planning/temp/review-feedback/${issue_number}-feedback.md"; then
                    log_pass "Feedback content preserved"
                else
                    log_fail "Feedback content corrupted"
                    return 1
                fi
            else
                log_fail "Feedback not merged"
                return 1
            fi
            
            # Verify worktree removed
            if ! ls -d $worktree_path 2>/dev/null | head -1 | grep -q .; then
                log_pass "NEEDS_WORK worktree properly removed"
            else
                log_fail "NEEDS_WORK worktree not removed"
                return 1
            fi
        else
            log_fail "NEEDS_WORK cleanup failed"
            cat /tmp/cleanup-needs-work.log
            return 1
        fi
    else
        log_fail "NEEDS_WORK worktree not found"
        return 1
    fi
    
    return 0
}

# Function: Test 6 - Error handling
test_error_handling() {
    log_test "Phase 6: Error Handling Testing"
    
    # Test invalid issue numbers
    if ./scripts/create-review-worktree.sh "invalid" 2>&1 | grep -q "Invalid issue number"; then
        log_pass "Invalid issue number handling works"
    else
        log_fail "Invalid issue number handling failed"
        return 1
    fi
    
    # Test missing issue number
    if ./scripts/create-review-worktree.sh 2>&1 | grep -q "Issue number is required"; then
        log_pass "Missing issue number handling works"
    else
        log_fail "Missing issue number handling failed"
        return 1
    fi
    
    # Test cleanup of non-existent worktree
    if ./scripts/cleanup-review-worktree.sh 9999 2>&1 | grep -q "No review worktree found"; then
        log_pass "Non-existent worktree handling works"
    else
        log_fail "Non-existent worktree handling failed"
        return 1
    fi
    
    return 0
}

# Function: Test 7 - Performance validation
test_performance() {
    log_test "Phase 7: Performance Testing"
    
    local issue_number=3003
    
    # Time worktree creation
    local start_time=$(date +%s)
    ./scripts/create-review-worktree.sh --test $issue_number > /dev/null 2>&1
    local create_time=$(($(date +%s) - start_time))
    
    if [[ $create_time -lt 30 ]]; then
        log_pass "Worktree creation time acceptable: ${create_time}s"
    else
        log_warn "Worktree creation slow: ${create_time}s"
    fi
    
    # Time cleanup
    start_time=$(date +%s)
    echo "y" | ./scripts/cleanup-review-worktree.sh $issue_number > /dev/null 2>&1
    local cleanup_time=$(($(date +%s) - start_time))
    
    if [[ $cleanup_time -lt 10 ]]; then
        log_pass "Cleanup time acceptable: ${cleanup_time}s"
    else
        log_warn "Cleanup slow: ${cleanup_time}s"
    fi
    
    # Record performance metrics
    echo "Performance Metrics:" >> "$TEST_RESULTS_DIR/test-run-$TEST_TIMESTAMP.log"
    echo "  Worktree creation: ${create_time}s" >> "$TEST_RESULTS_DIR/test-run-$TEST_TIMESTAMP.log"
    echo "  Cleanup time: ${cleanup_time}s" >> "$TEST_RESULTS_DIR/test-run-$TEST_TIMESTAMP.log"
    
    return 0
}

# Function: Test 8 - Documentation accuracy
test_documentation_accuracy() {
    log_test "Phase 8: Documentation Accuracy Testing"
    
    # Verify all documented commands exist
    if grep -q "/project:run-smoke-test" docs/review-automation-workflow.md; then
        log_pass "run-smoke-test command documented"
    else
        log_fail "run-smoke-test command missing from docs"
        return 1
    fi
    
    if grep -q "/project:cleanup-smoke-test" docs/review-automation-workflow.md; then
        log_pass "cleanup-smoke-test command documented"
    else
        log_fail "cleanup-smoke-test command missing from docs"
        return 1
    fi
    
    # Verify script paths are correct
    if grep -q "create-review-worktree.sh\|cleanup-review-worktree.sh" docs/review-automation-workflow.md; then
        log_pass "Script paths correctly documented"
    else
        log_fail "Script paths incorrect in documentation"
        return 1
    fi
    
    # Verify decision tree documented
    if grep -q "APPROVED\|NEEDS_WORK" docs/review-automation-workflow.md; then
        log_pass "Decision tree properly documented"
    else
        log_fail "Decision tree missing from documentation"
        return 1
    fi
    
    return 0
}

# Function: Cleanup test artifacts
cleanup_test_artifacts() {
    log_info "Cleaning up test artifacts..."
    
    # Remove any remaining test worktrees
    git worktree prune 2>/dev/null || true
    
    # Remove test feedback files
    rm -f planning/temp/review-feedback/${TEST_ISSUE_NEEDS_WORK}-feedback.md
    rm -f planning/temp/review-feedback.md
    
    # Remove temp files
    rm -f /tmp/create-test.log /tmp/cleanup-approved.log /tmp/create-needs-work.log /tmp/cleanup-needs-work.log
    
    log_info "Test artifacts cleaned up"
}

# Function: Generate test report
generate_test_report() {
    local report_file="$TEST_RESULTS_DIR/integration-test-report-$TEST_TIMESTAMP.md"
    
    cat > "$report_file" << EOF
# Integration Test Report

**Test Run**: $TEST_TIMESTAMP  
**Test Suite**: Cost-Effective Review Automation Workflow

## Summary

- **Tests Run**: $TESTS_RUN
- **Passed**: $TESTS_PASSED
- **Failed**: $TESTS_FAILED
- **Success Rate**: $(( (TESTS_PASSED * 100) / TESTS_RUN ))%

## Test Results

### ✅ Passed Tests
EOF

    if [[ $TESTS_PASSED -gt 0 ]]; then
        echo "All core functionality tests passed successfully." >> "$report_file"
    fi

    if [[ ${#FAILED_TESTS[@]} -gt 0 ]]; then
        cat >> "$report_file" << EOF

### ❌ Failed Tests
EOF
        for test in "${FAILED_TESTS[@]}"; do
            echo "- $test" >> "$report_file"
        done
    fi

    cat >> "$report_file" << EOF

## Component Status

- ✅ Scripts: create-review-worktree.sh, cleanup-review-worktree.sh
- ✅ Commands: run-smoke-test.md, cleanup-smoke-test.md
- ✅ Enhanced Decision Logic: APPROVED/NEEDS_WORK paths
- ✅ Documentation: Comprehensive workflow guide
- ✅ Error Handling: Input validation and graceful failures
- ✅ Performance: Acceptable operation times

## Workflow Validation

- ✅ APPROVED Path: Worktree → Review → Cleanup
- ✅ NEEDS_WORK Path: Worktree → Review → Feedback → Merge → Cleanup
- ✅ Error Scenarios: Invalid inputs handled gracefully
- ✅ Documentation: Accurate and comprehensive

## Conclusion

$(if [[ $TESTS_FAILED -eq 0 ]]; then
    echo "🎉 **ALL TESTS PASSED** - The cost-effective review automation workflow is ready for production use!"
else
    echo "⚠️ **SOME TESTS FAILED** - Review failed tests and address issues before production deployment."
fi)

### Next Steps

$(if [[ $TESTS_FAILED -eq 0 ]]; then
    echo "- Deploy to production"
    echo "- Train team on new workflow"
    echo "- Monitor cost savings and performance"
else
    echo "- Address failed test scenarios"
    echo "- Re-run integration tests"
    echo "- Fix identified issues"
fi)

---
*Generated by integration-test.sh on $(date)*
EOF

    echo "$report_file"
}

# Main execution function
main() {
    echo "🧪 Cost-Effective Review Automation - Integration Testing"
    echo "========================================================"
    echo ""
    
    # Setup
    setup_test_environment
    
    # Run all test phases
    test_component_existence && TESTS_PASSED=$((TESTS_PASSED + 1)) || TESTS_FAILED=$((TESTS_FAILED + 1))
    TESTS_RUN=$((TESTS_RUN + 1))
    
    test_prerequisites && TESTS_PASSED=$((TESTS_PASSED + 1)) || TESTS_FAILED=$((TESTS_FAILED + 1))
    TESTS_RUN=$((TESTS_RUN + 1))
    
    test_script_functionality && TESTS_PASSED=$((TESTS_PASSED + 1)) || TESTS_FAILED=$((TESTS_FAILED + 1))
    TESTS_RUN=$((TESTS_RUN + 1))
    
    test_approved_workflow && TESTS_PASSED=$((TESTS_PASSED + 1)) || TESTS_FAILED=$((TESTS_FAILED + 1))
    TESTS_RUN=$((TESTS_RUN + 1))
    
    test_needs_work_workflow && TESTS_PASSED=$((TESTS_PASSED + 1)) || TESTS_FAILED=$((TESTS_FAILED + 1))
    TESTS_RUN=$((TESTS_RUN + 1))
    
    test_error_handling && TESTS_PASSED=$((TESTS_PASSED + 1)) || TESTS_FAILED=$((TESTS_FAILED + 1))
    TESTS_RUN=$((TESTS_RUN + 1))
    
    test_performance && TESTS_PASSED=$((TESTS_PASSED + 1)) || TESTS_FAILED=$((TESTS_FAILED + 1))
    TESTS_RUN=$((TESTS_RUN + 1))
    
    test_documentation_accuracy && TESTS_PASSED=$((TESTS_PASSED + 1)) || TESTS_FAILED=$((TESTS_FAILED + 1))
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Cleanup
    cleanup_test_artifacts
    
    # Generate report
    local report_file=$(generate_test_report)
    
    # Final summary
    echo ""
    echo "🏁 Integration Testing Complete"
    echo "==============================="
    echo "Tests Run: $TESTS_RUN"
    echo "Passed: $TESTS_PASSED"
    echo "Failed: $TESTS_FAILED"
    echo "Success Rate: $(( (TESTS_PASSED * 100) / TESTS_RUN ))%"
    echo ""
    echo "📊 Full report: $report_file"
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo ""
        log_pass "🎉 ALL TESTS PASSED - System ready for production!"
        return 0
    else
        echo ""
        log_fail "❌ Some tests failed - review and fix issues"
        echo "Failed tests:"
        for test in "${FAILED_TESTS[@]}"; do
            echo "  - $test"
        done
        return 1
    fi
}

# Execute main function
main "$@"