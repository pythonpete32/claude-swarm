# Work on GitHub Issue

Implement a GitHub issue that's ready for development.

**Usage**: `/project:work-on-issue $ISSUE_NUMBER $MODE`

## Purpose

Take a well-defined issue and implement it. All the thinking has been done - now it's time to build.

## Parameters

- **$ISSUE_NUMBER**: The GitHub issue to implement (e.g., "123" or "#123")
- **$MODE**: How to complete the work
  - `direct` (default): Implement → test → create PR
  - `review`: Implement → test → create review doc for human

## Process

### 1. Get Context

```bash
# Fetch the issue details
gh issue view $ISSUE_NUMBER

# Understand:
# - What needs to be built
# - Acceptance criteria
# - Any linked context
```

### 2. Implement

Based on the issue description:
- Write the code
- Follow conventions in CLAUDE.md
- Create appropriate tests
- Update relevant documentation

### 3. Complete Work

**Quality Gates** (required before any PR or review):
- ✅ All tests pass
- ✅ Code is linted and formatted
- ✅ No existing functionality broken
- ✅ Always include validation instructions

**If MODE="direct"**:
- Run tests to ensure everything works
- Commit with clear message referencing issue
- Create PR with:
  - Title: Clear description of what was done
  - Body: `closes #$ISSUE_NUMBER`
  - **Validation instructions**: "To verify this works: [specific steps]"

**If MODE="review"**:
- Create `planning/temp/work-report/$ISSUE_NUMBER.md`
- Document what was implemented
- List any decisions made
- **Include validation instructions**: "To verify this works: [specific steps]"
- Note any concerns or questions
- Ask: "Please review the implementation. Should I proceed with creating a PR?"

## Key Behaviors

- **Trust the issue**: Don't second-guess the requirements
- **Stay focused**: Implement exactly what's asked
- **Test thoroughly**: Ensure it works before marking complete
- **Document decisions**: If you make implementation choices, note them
- **Ask when uncertain**: Better to clarify than assume

## Examples

```bash
# Direct implementation
/project:work-on-issue $ISSUE_NUMBER=123

# Implementation with review
/project:work-on-issue $ISSUE_NUMBER=45 $MODE="review"
```

## Remember

At this stage, the thinking is done. Your job is clean, focused execution. The issue contains everything you need to succeed.