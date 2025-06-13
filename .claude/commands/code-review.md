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

### 5. Generate Review Outcome

**If issues found**:
- Create `planning/temp/review-feedback/$ISSUE_NUMBER-feedback.md`
- Structure:
  ```markdown
  # Review Feedback for Issue #$ISSUE_NUMBER
  
  ## Summary
  [Brief overview of review findings]
  
  ## Issues Found
  
  ### 1. [Issue Title]
  **Problem**: [What's wrong]
  **Expected**: [What should happen]
  **Found**: [What actually happens]
  **Fix**: [Suggested solution]
  
  ### 2. [Next Issue]
  ...
  
  ## Required Actions
  - [ ] Fix [specific issue]
  - [ ] Add test for [scenario]
  - [ ] Update [documentation/code]
  
  ## Validation Steps to Retry
  1. [Step that failed]
  2. [How to verify when fixed]
  ```

**If all checks pass**:
- Create PR with comprehensive description:
  ```bash
  gh pr create \
    --title "[Clear description of implementation]" \
    --body "## Summary
    
    Implements #$ISSUE_NUMBER
    
    ## Changes Made
    - [List key changes]
    
    ## Testing Done
    - ✅ All automated tests pass
    - ✅ Manual smoke tests completed:
      - [List specific validations performed]
    
    ## Validation Instructions
    To verify this implementation:
    1. [Specific step]
    2. [Next step]
    3. [Expected result]
    
    closes #$ISSUE_NUMBER" \
    --assignee @me
  ```

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

The goal is to catch issues before PR creation, saving time and ensuring quality. 