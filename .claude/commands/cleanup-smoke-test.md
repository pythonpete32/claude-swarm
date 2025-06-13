# Cleanup Smoke Test Command

Clean up review worktrees and merge feedback after cost-effective review completion, finalizing the review cycle.

**Usage**: `/project:cleanup-smoke-test $ISSUE_NUMBER`

## Purpose

Complete the review cycle by merging any feedback from the review worktree back to the original branch and safely removing the isolated worktree. This command handles both APPROVED and NEEDS_WORK review outcomes.

## Parameters

- **$ISSUE_NUMBER**: The GitHub issue number that was reviewed (e.g., "123" or "#123")

## Process

### 1. Execute Cleanup Review Worktree Script

```bash
# Run the cleanup script
./scripts/cleanup-review-worktree.sh $ISSUE_NUMBER

# This will:
# - Find review worktree: ../review-issue-NUMBER-TIMESTAMP
# - Check for review feedback in worktree
# - Merge feedback to original branch (if exists)
# - Safely remove review worktree
# - Provide summary and next steps
```

### 2. Feedback Processing

The cleanup process handles both review outcomes:

#### 🟢 APPROVED Review Cleanup
When no feedback file is found (review was approved):

1. **Verify worktree state**
   - Check for uncommitted changes
   - Confirm no feedback document exists

2. **Clean removal**
   - Remove worktree: `git worktree remove --force`
   - Prune git worktree references
   - Report successful cleanup

3. **Next steps provided**
   - PR already created and ready for merge
   - Review tracking issue can be updated
   - Worktree fully cleaned up

#### 🔴 NEEDS_WORK Review Cleanup  
When feedback file is found (issues discovered):

1. **Feedback detection**
   - Scan for feedback files at multiple locations:
     - `planning/temp/review-feedback/$ISSUE_NUMBER-feedback.md`
     - `planning/temp/review-feedback.md`
     - `review-feedback.md`

2. **Feedback merge**
   - Copy feedback to original branch location
   - Create both specific and general feedback files
   - Preserve feedback structure and formatting

3. **Status determination**
   - Analyze feedback content for severity indicators
   - Detect NEEDS_WORK vs informational feedback
   - Provide appropriate next steps

4. **Clean removal**
   - Remove worktree after feedback extraction
   - Ensure no work is lost

### 3. Cleanup Validation

The script performs comprehensive validation:

#### Pre-cleanup Checks
- **Worktree existence**: Verify review worktree exists
- **Multiple worktrees**: Handle multiple worktrees for same issue
- **Git registration**: Confirm worktree is properly registered
- **Uncommitted changes**: Warn about unsaved work

#### Post-cleanup Verification
- **Complete removal**: Verify worktree directory deleted
- **Git references**: Confirm git worktree list updated
- **Feedback placement**: Validate feedback files copied correctly
- **Status reporting**: Provide clear outcome summary

## Review Outcome Handling

### APPROVED Workflow
```
Review Worktree (APPROVED)
    ↓
No feedback file found
    ↓
Clean worktree removal
    ↓
PR already exists → Ready for merge
```

**Output Example:**
```
✓ Review status: APPROVED (no feedback file found)
✓ Review worktree cleaned up
✓ Git worktree references pruned

Next steps for APPROVED:
  1. Create PR for issue #25
  2. Reference review completion in PR description
```

### NEEDS_WORK Workflow
```
Review Worktree (NEEDS_WORK)
    ↓
Feedback file found
    ↓
Merge feedback to original branch
    ↓
Clean worktree removal
    ↓
Address feedback → Re-review
```

**Output Example:**
```
✓ Feedback merged to: planning/temp/review-feedback/25-feedback.md
⚠ Review status: NEEDS_WORK (check feedback for required actions)
✓ Review worktree cleaned up
✓ Git worktree references pruned

Next steps for NEEDS_WORK:
  1. Review feedback: cat planning/temp/review-feedback/25-feedback.md
  2. Address identified issues
  3. Re-run review: /run-smoke-test 25
```

## Error Handling

### Common Error Scenarios
- **No worktree found**: Clear error with available worktrees listed
- **Multiple worktrees**: Uses most recent, warns about multiples
- **Uncommitted changes**: Interactive confirmation before cleanup
- **Permission issues**: Fallback to manual directory removal
- **Git worktree errors**: Graceful degradation with manual cleanup

### Safety Features
- **Change detection**: Warns about uncommitted work
- **Confirmation prompts**: Interactive confirmation for destructive actions
- **Backup strategies**: Preserves important data before cleanup
- **Error recovery**: Provides manual cleanup instructions on failure

## Integration Points

### With Review Scripts
- Calls `./scripts/cleanup-review-worktree.sh`
- Integrates with enhanced feedback format
- Handles output from review decision logic

### With GitHub Integration
- Updates review tracking issues (if available)
- Supports project board status updates
- Maintains issue relationship metadata

### With Development Workflow
- Merges feedback to accessible locations
- Provides clear next steps for iteration
- Maintains clean git worktree state

## Usage Examples

### Successful APPROVED Review
```bash
# After review created PR
/project:cleanup-smoke-test $ISSUE_NUMBER=25

# Expected flow:
# 1. Finds review worktree
# 2. No feedback found (APPROVED)
# 3. Cleans up worktree
# 4. Reports PR ready for merge
```

### NEEDS_WORK Review with Feedback
```bash
# After review identified issues
/project:cleanup-smoke-test $ISSUE_NUMBER=42

# Expected flow:
# 1. Finds review worktree
# 2. Discovers feedback document
# 3. Merges feedback to main branch
# 4. Cleans up worktree
# 5. Provides feedback review instructions
```

### Multiple Worktrees Scenario
```bash
# If multiple review attempts exist
/project:cleanup-smoke-test $ISSUE_NUMBER=15

# The script will:
# 1. List all matching worktrees
# 2. Use the most recent timestamp
# 3. Warn about multiple worktrees
# 4. Proceed with cleanup
```

## Command Output

### Success Indicators
- ✅ Feedback merged (if applicable)
- ✅ Review status determined correctly
- ✅ Worktree cleaned up
- ✅ Git references pruned
- ✅ Clear next steps provided

### Status Reports
- **APPROVED**: Ready for merge workflow
- **NEEDS_WORK**: Feedback review and iteration workflow
- **ERROR**: Clear error messages with resolution steps

## Best Practices

### When to Use
- **After every review**: Whether APPROVED or NEEDS_WORK
- **Before re-review**: Clean up previous attempts
- **Periodic cleanup**: Remove orphaned worktrees

### What It Provides
- **Clean workspace**: No leftover review worktrees
- **Feedback preservation**: Important feedback saved to main branch
- **Clear guidance**: Next steps for both outcomes
- **Git hygiene**: Proper worktree reference management

## Complete Review Cycle

```
1. /run-smoke-test 25
   ↓ Creates review worktree
   ↓ Runs interactive review
   ↓ Generates APPROVED/NEEDS_WORK decision

2. /cleanup-smoke-test 25
   ↓ Merges feedback (if any)
   ↓ Cleans up worktree
   ↓ Provides next steps

3a. If APPROVED: PR ready for merge
3b. If NEEDS_WORK: Address feedback → goto step 1
```

## Remember

- **Always clean up**: Don't leave review worktrees hanging
- **Check feedback**: Review any NEEDS_WORK feedback thoroughly
- **Iterate efficiently**: Use feedback to improve, then re-review
- **Maintain hygiene**: Keep git worktree list clean
- **Trust the process**: The automation handles the complexity

This command completes the cost-effective review workflow by ensuring clean transitions between review cycles while preserving important feedback and maintaining workspace hygiene.