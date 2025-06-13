# Review GitHub Issue Implementation

Review work completed on a GitHub issue before creating a PR, ensuring quality and completeness.

**Usage**: `/project:review-issue $ISSUE_NUMBER`

## Purpose

Perform a thorough review of implemented work against the original issue requirements, validate functionality through smoke tests, and either request fixes or approve for PR creation.

## Parameters

- **$ISSUE_NUMBER**: The GitHub issue number to review (e.g., "123" or "#123")

## Process

### 1. Understand Requirements

```bash
# Fetch the issue details
gh issue view $ISSUE_NUMBER

# Extract:
# - Original requirements
# - Acceptance criteria
# - Expected behavior
# - Any specific validation mentioned
```

### 2. Check Implementation Report

```bash
# Look for work report if it exists
cat planning/temp/work-report/$ISSUE_NUMBER.md

# Understand:
# - What was claimed to be done
# - Implementation decisions made
# - Any concerns noted
```

### 3. Review Code Changes

```bash
# Get current branch name
BRANCH=$(git branch --show-current)

# View all commits on this branch
git log --oneline main..$BRANCH

# Review the actual changes
git diff main..$BRANCH

# Check for:
# - Code quality and style
# - Adherence to CLAUDE.md conventions
# - Completeness of implementation
# - Test coverage
```

### 4. Run Smoke Tests

**Automated Tests**:
```bash
# Run existing test suite
npm test # or appropriate test command

# Check linting
npm run lint # or appropriate lint command
```

**Manual Validation**:
Based on the issue requirements, perform manual smoke tests:
- If it's a new feature: Test the feature works as expected
- If it's a bug fix: Verify the bug no longer occurs
- If it's a refactor: Ensure functionality remains unchanged
- Test edge cases mentioned in the issue
- Verify no regressions in related functionality

Document each validation step and its result.

### 5. Make Review Decision (Enhanced Decision Tree)

After completing all validation steps, you MUST make one of two decisions:

#### 🟢 APPROVED PATH - All checks passed, ready for merge

**When to choose APPROVED**:
- All automated tests pass
- Manual smoke tests successful
- Code quality meets standards
- No security concerns
- Documentation updated appropriately
- All requirements satisfied

**APPROVED Actions**:
1. **Final validation** - Run tests one more time to confirm
2. **Create PR immediately** using this exact command:
   ```bash
   gh pr create \
     --title "feat(scope): [clear description of implementation] (#$ISSUE_NUMBER)" \
     --body "## Summary
   
   Implements #$ISSUE_NUMBER - [brief description of what was implemented]
   
   ## Changes Made
   - [List specific changes made]
   - [Include any breaking changes]
   - [Note new features or improvements]
   
   ## Testing Completed
   - ✅ All automated tests pass
   - ✅ Manual validation completed:
     - [List specific tests performed]
     - [Include edge cases tested]
     - [Note any performance validation]
   
   ## Validation Instructions
   To verify this implementation:
   1. [Specific step to test main functionality]
   2. [Step to verify edge cases]
   3. [Expected results]
   
   Closes #$ISSUE_NUMBER" \
     --assignee @me \
     --label "enhancement" \
     --project "claude-swarm"
   ```
3. **Report success** - State that PR was created and provide the URL

#### 🔴 NEEDS_WORK PATH - Issues found that must be addressed

**When to choose NEEDS_WORK**:
- Tests failing
- Bugs discovered during testing
- Code quality issues
- Security vulnerabilities
- Incomplete implementation
- Missing documentation
- Performance problems

**NEEDS_WORK Actions**:
1. **Create detailed feedback document** at `planning/temp/review-feedback/$ISSUE_NUMBER-feedback.md`:
   ```markdown
   # Review Feedback for Issue #$ISSUE_NUMBER
   
   ## Summary
   Review identified [number] issues that must be addressed before approval.
   
   ## Issues Found (Prioritized by Severity)
   
   ### 🔴 CRITICAL: [High Priority Issue]
   **Problem**: [Specific description of what's wrong]
   **Expected**: [What should happen instead]
   **Found**: [Current behavior or implementation]
   **Fix**: [Specific steps to resolve]
   **Impact**: [Why this must be fixed]
   
   ### 🟡 MEDIUM: [Medium Priority Issue]
   **Problem**: [Description]
   **Expected**: [Expected behavior]
   **Found**: [Current state]
   **Fix**: [Suggested solution]
   
   ### 🟢 LOW: [Nice to have improvement]
   **Problem**: [Description]
   **Fix**: [Optional improvement]
   
   ## Required Actions (Must Complete All)
   - [ ] [Critical fix #1 - specific action required]
   - [ ] [Critical fix #2 - specific action required]  
   - [ ] [Medium priority fix - specific action]
   - [ ] [Add missing tests for scenario X]
   - [ ] [Update documentation for feature Y]
   
   ## Validation Steps to Retry After Fixes
   1. [Specific test to run to verify fix #1]
   2. [Command to verify fix #2]
   3. [How to confirm all issues resolved]
   4. [Final validation before re-review]
   
   ## Next Steps
   1. Address all required actions above
   2. Test fixes using validation steps
   3. Re-run review: `/project:review-issue $ISSUE_NUMBER`
   
   Status: **NEEDS_WORK** - Issues must be resolved before approval
   ```
2. **Save and report** - Confirm feedback file was created and provide path

#### ⚠️ Decision Making Guidelines

**Be decisive but thorough**:
- Don't create PR if ANY significant issues exist
- Don't mark NEEDS_WORK for minor style issues that don't affect functionality
- When in doubt, prefer NEEDS_WORK with constructive feedback
- Focus on user impact and system reliability

**CRITICAL decision criteria**:
- **Tests must pass** (blocking for APPROVED)
- **Core functionality must work** (blocking for APPROVED)  
- **No security vulnerabilities** (blocking for APPROVED)
- **No data loss or corruption risks** (blocking for APPROVED)

## Key Review Points

### Code Quality Checks
- **Correctness**: Does it solve the stated problem?
- **Completeness**: Are all requirements addressed?
- **Testing**: Is there adequate test coverage?
- **Style**: Does it follow project conventions?
- **Performance**: No obvious performance issues?
- **Security**: No security vulnerabilities introduced?

### Functional Validation
- **Happy path**: Normal use cases work
- **Edge cases**: Boundary conditions handled
- **Error handling**: Failures handled gracefully
- **Backwards compatibility**: Existing functionality preserved
- **Documentation**: Changes documented where needed

## Examples

```bash
# Review implementation of issue 123
/project:review-issue $ISSUE_NUMBER=123

# The command will:
# 1. Check what issue 123 requires
# 2. Review the implementation against requirements
# 3. Run automated tests
# 4. Perform manual smoke tests
# 5. Either create feedback doc or create PR
```

## Smoke Test Examples

For different types of changes:

**New API Endpoint**:
```bash
# Test the endpoint works
curl -X POST http://localhost:3000/api/new-endpoint -d '{"test": "data"}'
# Verify response format
# Test error cases
# Check authentication if applicable
```

**UI Component**:
```bash
# Start dev server
npm run dev
# Navigate to component
# Test interactions
# Verify responsive behavior
# Check accessibility
```

**Bug Fix**:
```bash
# Reproduce original bug scenario
# Verify it no longer occurs
# Test related functionality still works
# Check no new bugs introduced
```

## Remember

- **ULTRA THINK**: Use your maximum analytical capabilities to thoroughly examine all aspects of the project based on the available codebase context.
- **Be thorough but practical**: Focus on functionality over perfection
- **Document everything**: Clear feedback helps quick fixes
- **Test like a user**: Think about real-world usage
- **Verify claims**: Don't just trust the report, validate everything
- **Be constructive**: Feedback should guide, not criticize

## Review Decision Summary

**At the end of every review, you MUST:**

1. **State your decision clearly**: "APPROVED" or "NEEDS_WORK"
2. **Execute the appropriate action**:
   - **APPROVED**: Create PR using the exact command template
   - **NEEDS_WORK**: Create detailed feedback document with specific fixes
3. **Provide next steps**: Clear guidance on what happens next

**Success criteria**:
- APPROVED reviews result in a created PR with proper metadata
- NEEDS_WORK reviews result in actionable feedback that guides fixes
- All decisions are well-justified and focus on user impact

The goal is to catch issues before PR creation, saving time and ensuring quality while maintaining a clear, automated workflow. 