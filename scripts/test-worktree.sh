#!/bin/bash

# Test script for worktree functionality
set -e

echo "=== Testing Worktree Script Functionality ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"
    
    echo -n "Testing: $test_name... "
    
    if eval "$test_command"; then
        if [ "$expected_result" = "pass" ]; then
            echo -e "${GREEN}PASSED${NC}"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}FAILED${NC} (expected to fail but passed)"
            ((TESTS_FAILED++))
        fi
    else
        if [ "$expected_result" = "fail" ]; then
            echo -e "${GREEN}PASSED${NC} (correctly failed)"
            ((TESTS_PASSED++))
        else
            echo -e "${RED}FAILED${NC}"
            ((TESTS_FAILED++))
        fi
    fi
}

# Clean up any existing test worktrees
echo "Cleaning up any existing test worktrees..."
./scripts/worktree-cleanup.sh --all 2>/dev/null || true
echo ""

# Test 1: Check dependencies
run_test "Dependency check (git)" "which git >/dev/null 2>&1" "pass"
run_test "Dependency check (tmux)" "which tmux >/dev/null 2>&1" "pass"

# Test 2: Invalid inputs
run_test "No arguments" "./scripts/worktree-task.sh 2>&1 | grep -q 'Usage:'" "pass"
run_test "Invalid branch name" "./scripts/worktree-task.sh 'bad@branch!' 2>&1 | grep -q 'Invalid branch name'" "pass"

# Test 3: Create new worktree (non-interactive)
TEST_BRANCH="test-validation-$(date +%s)"
run_test "Create new worktree" "./scripts/worktree-task.sh $TEST_BRANCH 2>&1 | grep -q 'Created new branch and worktree'" "pass"

# Test 4: Verify worktree exists
run_test "Worktree exists in git" "git worktree list | grep -q $TEST_BRANCH" "pass"
run_test "Worktree directory exists" "[ -d ../claude-swarm-$TEST_BRANCH ]" "pass"

# Test 5: Check tmux session (if in terminal)
if [ -t 0 ] && [ -t 1 ]; then
    # Kill any existing session first
    tmux kill-session -t "swarm-$TEST_BRANCH" 2>/dev/null || true
    
    # Create tmux session in background
    tmux new-session -d -s "swarm-$TEST_BRANCH" -c "../claude-swarm-$TEST_BRANCH" 2>/dev/null
    run_test "Tmux session created" "tmux has-session -t 'swarm-$TEST_BRANCH' 2>/dev/null" "pass"
    
    # Clean up tmux session
    tmux kill-session -t "swarm-$TEST_BRANCH" 2>/dev/null || true
else
    echo -e "${YELLOW}Skipping tmux tests (not in terminal)${NC}"
fi

# Test 6: Try to create same worktree again
run_test "Worktree already exists message" "./scripts/worktree-task.sh $TEST_BRANCH 2>&1 | grep -q 'Worktree already exists'" "pass"

# Test 7: Create worktree for existing branch
EXISTING_BRANCH="existing-test-$(date +%s)"
git branch "$EXISTING_BRANCH" 2>/dev/null
run_test "Create worktree for existing branch" "./scripts/worktree-task.sh $EXISTING_BRANCH 2>&1 | grep -q 'Branch already exists'" "pass"

# Test 8: Cleanup single worktree
run_test "Cleanup single worktree" "./scripts/worktree-cleanup.sh $TEST_BRANCH 2>&1 | grep -q 'Removing worktree'" "pass"
run_test "Worktree removed" "! git worktree list | grep -q $TEST_BRANCH" "pass"

# Test 9: Cleanup all
./scripts/worktree-task.sh "cleanup-test-1" >/dev/null 2>&1
./scripts/worktree-task.sh "cleanup-test-2" >/dev/null 2>&1
run_test "Cleanup all worktrees" "./scripts/worktree-cleanup.sh --all 2>&1 | grep -q 'Cleanup complete'" "pass"

# Test 10: List functionality
run_test "List worktrees" "./scripts/worktree-cleanup.sh --list 2>&1 | grep -q 'Current worktrees:'" "pass"

# Clean up test branches
git branch -D "$EXISTING_BRANCH" 2>/dev/null || true
git branch -D "cleanup-test-1" 2>/dev/null || true
git branch -D "cleanup-test-2" 2>/dev/null || true

echo ""
echo "=== Test Summary ==="
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi