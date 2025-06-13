# Run Smoke Test Command

Execute a cost-effective review in an isolated worktree using interactive Claude Code sessions instead of expensive API credits.

**Usage**: `/project:run-smoke-test $ISSUE_NUMBER`

## Purpose

Create an isolated git worktree for code review that runs in interactive mode (account billing) rather than expensive headless mode. This enables real-time streaming output and maintains isolation between review and development work.

## Parameters

- **$ISSUE_NUMBER**: The GitHub issue number to review (e.g., "123" or "#123")

## Process

### 1. Execute Create Review Worktree Script

```bash
# Run the worktree creation script
./scripts/create-review-worktree.sh $ISSUE_NUMBER

# This will:
# - Create isolated worktree at ../review-issue-NUMBER-TIMESTAMP
# - Copy CLAUDE.md and .claude/ context files
# - Create GitHub tracking issue with relationships
# - Generate comprehensive review prompt
# - Launch Claude Code interactively in the worktree
```

### 2. Claude Interactive Review Process

Once launched in the worktree, Claude will automatically:

1. **Understand Requirements**
   - Fetch original issue details: `gh issue view $ISSUE_NUMBER`
   - Extract requirements and acceptance criteria
   - Understand the scope of changes

2. **Review Implementation**
   - Check work report: `cat planning/temp/work-report/$ISSUE_NUMBER.md`
   - Review code changes: `git diff main..$(git branch --show-current)`
   - Validate implementation completeness

3. **Run Comprehensive Validation**
   - Execute automated tests (npm test, pytest, etc.)
   - Perform manual smoke tests based on requirements
   - Check for regressions in existing functionality
   - Validate security considerations

4. **Make Review Decision** (Using Enhanced Decision Tree)

   **🟢 APPROVED PATH** - If all checks pass:
   - Run final test validation
   - Create PR immediately using: `gh pr create` with proper metadata
   - Report PR URL and completion

   **🔴 NEEDS_WORK PATH** - If issues found:
   - Create detailed feedback document at `planning/temp/review-feedback/$ISSUE_NUMBER-feedback.md`
   - Include prioritized issues (🔴 CRITICAL, 🟡 MEDIUM, 🟢 LOW)
   - Provide specific fix recommendations
   - List validation steps to retry

### 3. Review Completion

The review process will end in one of two states:

**APPROVED**: 
- PR created and ready for merge
- Use `/cleanup-smoke-test $ISSUE_NUMBER` to clean up worktree

**NEEDS_WORK**:
- Feedback document created in worktree  
- Use `/cleanup-smoke-test $ISSUE_NUMBER` to merge feedback and clean up
- Address feedback and re-run `/run-smoke-test $ISSUE_NUMBER`

## Success Indicators

### For APPROVED Reviews
- ✅ All automated tests pass
- ✅ Manual smoke tests successful  
- ✅ PR created with comprehensive description
- ✅ Issue automatically closed by PR

### For NEEDS_WORK Reviews
- ✅ Detailed feedback document created
- ✅ Issues prioritized by severity
- ✅ Specific action items provided
- ✅ Clear validation steps for fixes

## Error Handling

The script includes comprehensive error handling:

- **Invalid issue number**: Clear error message and usage help
- **Missing prerequisites**: Checks for git, Claude CLI, GitHub CLI
- **Existing worktree**: Option to continue or cancel
- **Git repository issues**: Validates current directory
- **Authentication problems**: Checks GitHub CLI auth status

## Integration Points

### With Existing Scripts
- Calls `./scripts/create-review-worktree.sh` for worktree creation
- Integrates with enhanced review decision logic
- Prepares for `./scripts/cleanup-review-worktree.sh` cleanup

### With GitHub
- Creates tracking issues with proper relationships
- Sets up project board integration
- Enables PR creation with full metadata

### With Claude Code
- Launches interactive sessions (account billing)
- Provides real-time streaming output
- Uses enhanced `/project:review-issue` command

## Usage Examples

```bash
# Review implementation of issue #25
/project:run-smoke-test $ISSUE_NUMBER=25

# The command will:
# 1. Create ../review-issue-25-TIMESTAMP/ worktree
# 2. Launch Claude in interactive mode
# 3. Perform comprehensive review
# 4. Either create PR (APPROVED) or feedback (NEEDS_WORK)
```

```bash
# Review a bug fix for issue #42
/project:run-smoke-test $ISSUE_NUMBER=42

# For bug fixes, the review will focus on:
# - Reproducing original bug scenario
# - Verifying fix resolves the issue
# - Testing related functionality still works
# - Ensuring no regressions introduced
```

## Cost Benefits

### Before (Headless Mode)
- Uses expensive API credits
- No real-time output visibility
- Limited interactive capabilities
- Higher cost per review

### After (Interactive Mode)
- Uses Claude Code account billing
- Real-time streaming output
- Full interactive capabilities
- Significantly lower cost per review
- Better user experience

## Next Steps After Review

### If APPROVED
```bash
# Clean up the review worktree
/cleanup-smoke-test $ISSUE_NUMBER

# PR is ready for merge
# Review tracking issue can be closed
```

### If NEEDS_WORK
```bash
# Merge feedback to main branch
/cleanup-smoke-test $ISSUE_NUMBER

# Address feedback items
# Re-run review when ready
/run-smoke-test $ISSUE_NUMBER
```

## Remember

- **Cost-effective**: This uses account billing instead of API credits
- **Isolated**: Review happens in separate worktree, doesn't affect main work
- **Autonomous**: Clear decision tree leads to automatic actions
- **Comprehensive**: Includes tests, code quality, security, and documentation checks
- **Streamlined**: Integrates with existing GitHub workflow and project boards

The goal is to provide thorough, cost-effective code review that maintains quality while reducing expenses and improving developer experience.