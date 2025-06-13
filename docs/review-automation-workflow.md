# Review Automation Workflow

## Overview

The Review Automation workflow enables you to run multiple Claude agents simultaneously without them interfering with each other. Using git worktrees, each review process gets its own isolated environment, preventing context confusion and file conflicts between parallel agent sessions.

### Problem Solved

**Before**: Running multiple agents in the same repository causes:
- **Context mixing**: Agents share the same conversation context and get confused by each other's system prompts
- **File conflicts**: When agents work in parallel, one agent updates a file while another is working on a different file, leading to confusion about unexpected changes
- **Cognitive overload**: Complex worktree management requires users to understand git internals

**After**: Isolated worktree environments allow:
- **Clean separation**: Each agent works in its own copy of the repository
- **Parallel execution**: Run multiple reviews simultaneously without interference  
- **Simple commands**: Easy-to-use slash commands handle all the complexity

### Key Benefits

- 🔄 **Parallel Processing**: Run multiple agents simultaneously on different issues
- 🏗️ **Complete Isolation**: Each agent gets its own workspace with full context
- 🤖 **Autonomous Workflows**: Clear decision paths for automatic PR creation or feedback
- 🎯 **Simplified Interface**: Complex worktree operations hidden behind simple commands
- 📊 **Comprehensive Reviews**: Full code quality, testing, and security validation
- 🔗 **GitHub Integration**: Seamless issue tracking and PR creation

## Quick Start

```bash
# Start an isolated review for issue #25
/project:run-smoke-test 25

# After review completes, clean up the worktree
/project:cleanup-smoke-test 25
```

That's it! You can run multiple reviews in parallel - each gets its own isolated environment.

## Architecture Overview

```mermaid
graph TD
    A[Agent 1: Issue #42] --> B[/run-smoke-test 42]
    A1[Agent 2: Issue #43] --> B1[/run-smoke-test 43] 
    A2[Agent 3: Issue #44] --> B2[/run-smoke-test 44]
    
    B --> C[Isolated worktree: ../review-issue-42-*]
    B1 --> C1[Isolated worktree: ../review-issue-43-*]
    B2 --> C2[Isolated worktree: ../review-issue-44-*]
    
    C --> D[Agent 1 works in isolation]
    C1 --> D1[Agent 2 works in isolation]
    C2 --> D2[Agent 3 works in isolation]
    
    D --> E{Review Decision}
    D1 --> E1{Review Decision}
    D2 --> E2{Review Decision}
    
    E -->|APPROVED| F[Create PR #42]
    E -->|NEEDS_WORK| G[Create feedback]
    E1 -->|APPROVED| F1[Create PR #43]
    E2 -->|NEEDS_WORK| G2[Create feedback]
    
    F --> H[/cleanup-smoke-test 42]
    G --> H
    F1 --> H1[/cleanup-smoke-test 43]
    G2 --> H2[/cleanup-smoke-test 44]
```

## Detailed Workflow

### Phase 1: Review Initiation

#### Command: `/project:run-smoke-test ISSUE_NUMBER`

**What happens:**
1. **Creates isolated worktree** at `../review-issue-NUMBER-TIMESTAMP/`
2. **Copies context files** (CLAUDE.md, .claude/commands/) so the agent has full context
3. **Creates GitHub tracking issue** with proper relationships
4. **Launches Claude agent** in the isolated environment

**Files created:**
```
../review-issue-25-20250613-123456/
├── CLAUDE.md                    # Project guidance
├── .claude/commands/            # All available commands
│   ├── code-review.md          # Enhanced with decision tree
│   ├── run-smoke-test.md       # This workflow
│   └── cleanup-smoke-test.md   # Cleanup process
├── scripts/                    # All project scripts
├── [all other project files]  # Complete codebase copy
```

#### Prerequisites Checked:
- ✅ Git repository
- ✅ Claude CLI installed and accessible
- ✅ GitHub CLI authenticated with project scope
- ✅ CLAUDE.md and .claude/ directory (recommended)

### Phase 2: Interactive Review Process

Once in the worktree, Claude automatically follows the `/project:review-issue` process:

#### Step 1: Understand Requirements
```bash
# Fetch original issue details
gh issue view $ISSUE_NUMBER

# Key information extracted:
# - Original requirements and acceptance criteria
# - Expected behavior and validation mentioned
# - Linked context and dependencies
```

#### Step 2: Review Implementation
```bash
# Check for work report
cat planning/temp/work-report/$ISSUE_NUMBER.md

# Review actual changes
git diff main..$(git branch --show-current)

# Analysis includes:
# - Code quality and style
# - Adherence to CLAUDE.md conventions
# - Completeness of implementation
# - Test coverage
```

#### Step 3: Comprehensive Validation

**Automated Tests:**
```bash
# Run existing test suite
npm test  # or appropriate test command

# Check linting
npm run lint  # or appropriate lint command
```

**Manual Validation:**
- **New features**: Test the feature works as expected
- **Bug fixes**: Verify the bug no longer occurs  
- **Refactoring**: Ensure functionality remains unchanged
- **Edge cases**: Test boundary conditions mentioned in issue
- **Regression testing**: Verify no related functionality breaks

#### Step 4: Enhanced Decision Tree

Claude must choose one of two paths:

##### 🟢 **APPROVED PATH** - All checks passed

**Criteria for APPROVED:**
- ✅ All automated tests pass
- ✅ Manual smoke tests successful
- ✅ Code quality meets standards
- ✅ No security concerns
- ✅ Documentation updated appropriately
- ✅ All requirements satisfied

**Actions taken:**
1. **Final validation**: Run tests one more time
2. **Create PR immediately**: 
   ```bash
   gh pr create \
     --title "feat(scope): [description] (#$ISSUE_NUMBER)" \
     --body "## Summary
   
   Implements #$ISSUE_NUMBER - [brief description]
   
   ## Changes Made
   - [specific changes]
   
   ## Testing Completed
   - ✅ All automated tests pass
   - ✅ Manual validation completed
   
   ## Validation Instructions
   1. [specific steps to verify]
   
   Closes #$ISSUE_NUMBER" \
     --assignee @me \
     --label "enhancement" \
     --project "claude-swarm"
   ```
3. **Report success**: Provide PR URL

##### 🔴 **NEEDS_WORK PATH** - Issues found

**Criteria for NEEDS_WORK:**
- ❌ Tests failing
- ❌ Bugs discovered during testing
- ❌ Code quality issues
- ❌ Security vulnerabilities
- ❌ Incomplete implementation
- ❌ Missing documentation
- ❌ Performance problems

**Actions taken:**
1. **Create detailed feedback** at `planning/temp/review-feedback/$ISSUE_NUMBER-feedback.md`:
   ```markdown
   # Review Feedback for Issue #$ISSUE_NUMBER
   
   ## Summary
   Review identified [number] issues that must be addressed.
   
   ## Issues Found (Prioritized by Severity)
   
   ### 🔴 CRITICAL: [High Priority Issue]
   **Problem**: [specific description]
   **Expected**: [what should happen]
   **Found**: [current behavior]
   **Fix**: [specific steps to resolve]
   **Impact**: [why this must be fixed]
   
   ### 🟡 MEDIUM: [Medium Priority Issue]
   [same structure]
   
   ## Required Actions (Must Complete All)
   - [ ] [specific action required]
   - [ ] [specific action required]
   
   ## Validation Steps to Retry After Fixes
   1. [specific test to verify fix]
   2. [command to verify fix]
   
   Status: **NEEDS_WORK**
   ```

### Phase 3: Review Completion

#### Command: `/project:cleanup-smoke-test ISSUE_NUMBER`

**What happens:**
1. **Finds review worktree** by pattern matching
2. **Checks for feedback document** in multiple locations
3. **Merges feedback** to original branch (if exists)
4. **Safely removes worktree** with change warnings
5. **Provides next steps** based on review outcome

#### APPROVED Cleanup Flow:
```
No feedback file found
    ↓
Clean worktree removal
    ↓
Report: PR ready for merge
```

**Output:**
```
✅ Review status: APPROVED (no feedback file found)
✅ Review worktree cleaned up
✅ Git worktree references pruned

Next steps for APPROVED:
  1. Merge PR for issue #25
  2. Close review tracking issue
```

#### NEEDS_WORK Cleanup Flow:
```
Feedback file found
    ↓
Merge feedback to: planning/temp/review-feedback/25-feedback.md
    ↓
Clean worktree removal
    ↓
Report: Address feedback and re-review
```

**Output:**
```
✅ Feedback merged to: planning/temp/review-feedback/25-feedback.md
⚠ Review status: NEEDS_WORK (check feedback for required actions)
✅ Review worktree cleaned up

Next steps for NEEDS_WORK:
  1. Review feedback: cat planning/temp/review-feedback/25-feedback.md
  2. Address identified issues
  3. Re-run review: /run-smoke-test 25
```

## Usage Examples

### Example 1: Parallel Reviews

```bash
# Start multiple reviews simultaneously
/project:run-smoke-test 42  # Authentication feature
/project:run-smoke-test 43  # Database optimization  
/project:run-smoke-test 44  # UI component updates

# Each agent works in isolation:
# Agent 1: Reviews auth in ../review-issue-42-timestamp/
# Agent 2: Reviews DB in ../review-issue-43-timestamp/
# Agent 3: Reviews UI in ../review-issue-44-timestamp/

# No interference between agents!

# Clean up when done
/project:cleanup-smoke-test 42
/project:cleanup-smoke-test 43  
/project:cleanup-smoke-test 44
```

### Example 2: Bug Fix Requiring Changes

```bash
# Start review for bug fix
/project:run-smoke-test 18

# Claude identifies issues:
# ❌ Original bug not fully fixed
# ❌ Missing test for edge case
# ❌ Performance regression introduced

# Result: Detailed feedback created

# Clean up and get feedback
/cleanup-smoke-test 18
# Output: "Feedback merged to planning/temp/review-feedback/18-feedback.md"

# Address feedback
cat planning/temp/review-feedback/18-feedback.md
# Fix the issues...

# Re-review
/project:run-smoke-test 18
# This time: ✅ APPROVED
```

### Example 3: Multiple Review Iterations

```bash
# First attempt
/project:run-smoke-test 67
/cleanup-smoke-test 67  # NEEDS_WORK

# Address feedback, second attempt  
/project:run-smoke-test 67
/cleanup-smoke-test 67  # NEEDS_WORK

# Address remaining issues, final attempt
/project:run-smoke-test 67
/cleanup-smoke-test 67  # APPROVED ✅
```

## File Locations & Structure

### Generated Files

#### Review Worktrees
```
../review-issue-{NUMBER}-{TIMESTAMP}/
├── [complete project copy]
├── CLAUDE.md
└── .claude/commands/
    ├── code-review.md      # Enhanced decision logic
    ├── run-smoke-test.md
    └── cleanup-smoke-test.md
```

#### Feedback Files (NEEDS_WORK path)
```
planning/temp/review-feedback/
├── {NUMBER}-feedback.md    # Specific issue feedback
└── review-feedback.md      # Latest feedback (symlink)
```

#### GitHub Integration
- **Tracking issues** created with relationships to epic #20
- **PRs** created with comprehensive metadata
- **Project board** integration (if available)

### Command Files
```
.claude/commands/
├── run-smoke-test.md       # Start cost-effective review
├── cleanup-smoke-test.md   # Complete review cycle
└── code-review.md          # Enhanced with decision tree
```

### Scripts
```
scripts/
├── create-review-worktree.sh   # Creates isolated review environment
└── cleanup-review-worktree.sh  # Merges feedback and cleans up
```

## Troubleshooting

### Common Issues & Solutions

#### "Worktree already exists"
**Problem**: Previous review attempt left worktree behind
```
Error: ../review-issue-25-20250613-123456 already exists
```

**Solution**: 
```bash
# List existing worktrees
git worktree list

# Remove old worktree
git worktree remove ../review-issue-25-20250613-123456 --force

# Or use cleanup command
./scripts/cleanup-review-worktree.sh 25
```

#### "Claude CLI not found"
**Problem**: Claude CLI not installed or not in PATH
```
Error: Claude CLI not found
```

**Solution**:
```bash
# Check if installed
which claude

# Install if missing
npm install -g @anthropic-ai/claude-cli

# Or check alias
type claude
```

#### "GitHub CLI not authenticated"
**Problem**: Missing GitHub authentication or project scope
```
Error: GitHub CLI not authenticated
```

**Solution**:
```bash
# Login to GitHub
gh auth login

# Add project scope (required for project integration)
gh auth refresh -s project

# Verify authentication
gh auth status
```

#### "Review feedback not merging"
**Problem**: Feedback file not found or permissions issue
```
Warning: No feedback file found
```

**Solutions**:
```bash
# Check if feedback exists in worktree
ls ../review-issue-25-*/planning/temp/review-feedback/

# Manually copy if needed
cp ../review-issue-25-*/planning/temp/review-feedback/25-feedback.md \
   planning/temp/review-feedback/

# Check file permissions
ls -la planning/temp/review-feedback/
```

#### "Uncommitted changes in worktree"
**Problem**: Review process left changes uncommitted
```
Warning: Review worktree has uncommitted changes
```

**Solutions**:
```bash
# Option 1: Force cleanup (loses changes)
echo "y" | ./scripts/cleanup-review-worktree.sh 25

# Option 2: Save changes first
cd ../review-issue-25-*/
git add . && git commit -m "Review changes"
cd -
./scripts/cleanup-review-worktree.sh 25
```

#### "Multiple worktrees for same issue"
**Problem**: Multiple review attempts created worktrees
```
Warning: Multiple review worktrees found for issue #25
```

**Solution**: Script automatically uses most recent, but you can clean up manually:
```bash
# List all review worktrees
ls -d ../review-issue-25-*

# Remove older ones
git worktree remove ../review-issue-25-20250613-123456 --force
git worktree remove ../review-issue-25-20250613-234567 --force

# Keep only the most recent
```

### Error Recovery

#### Cleanup Failed Worktrees
```bash
# List all worktrees
git worktree list

# Remove problematic worktrees
git worktree remove ../problematic-worktree --force

# Prune references
git worktree prune
```

#### Reset Git State
```bash
# If git gets confused about worktrees
git worktree prune

# Check repository health
git fsck

# Reset if necessary
git reset --hard HEAD
```

#### Manual Feedback Merge
```bash
# If automatic merge fails, copy manually
ISSUE_NUMBER=25
cp ../review-issue-${ISSUE_NUMBER}-*/planning/temp/review-feedback/${ISSUE_NUMBER}-feedback.md \
   planning/temp/review-feedback/

# Verify content
cat planning/temp/review-feedback/${ISSUE_NUMBER}-feedback.md
```

## Migration Guide

### From review-task.sh

#### Old Workflow (Single Agent)
```bash
# Old approach (sequential, blocking)
./scripts/review-task.sh 25
# - Only one review at a time
# - Context mixing issues
# - Manual worktree management
```

#### New Workflow (Agent Swarm)
```bash
# New approach (parallel, isolated)
/project:run-smoke-test 25
/project:run-smoke-test 26  # Can run simultaneously!
/project:run-smoke-test 27  # No interference!

# Clean up when done
/project:cleanup-smoke-test 25
/project:cleanup-smoke-test 26
/project:cleanup-smoke-test 27
```

### Command Comparison

| Old Command | New Command | Benefits |
|-------------|-------------|----------|
| `./scripts/review-task.sh 25` | `/project:run-smoke-test 25` | Parallel execution, isolation, simplicity |
| Manual cleanup | `/project:cleanup-smoke-test 25` | Automatic feedback merge, safe cleanup |
| Manual PR creation | Automatic (APPROVED path) | Streamlined workflow, consistent metadata |

### Feature Parity

| Feature | Old System | New System | Status |
|---------|------------|------------|---------|
| Code review | ✅ | ✅ | Enhanced with decision tree |
| Test execution | ✅ | ✅ | Same functionality |
| GitHub integration | ❌ | ✅ | New: tracking issues, PR creation |
| Feedback handling | ❌ | ✅ | New: structured feedback documents |
| Parallel execution | ❌ | ✅ | New: run multiple agents simultaneously |
| Context isolation | ❌ | ✅ | New: no agent interference |
| Simplified interface | ❌ | ✅ | New: simple commands hide complexity |

### Migration Steps

1. **Update workflows** to use new commands
2. **Train team** on new `/project:run-smoke-test` usage
3. **Update documentation** to reference new approach
4. **Remove old scripts** once team is comfortable
5. **Monitor cost savings** from reduced API usage

## Best Practices

### When to Use

- **Feature implementation reviews**: Comprehensive validation of new functionality
- **Bug fix verification**: Ensure fixes work and don't introduce regressions
- **Refactoring validation**: Confirm behavior preservation during code improvements
- **Security reviews**: Validate security considerations and vulnerability fixes
- **Performance optimization**: Verify improvements don't break functionality

### Workflow Tips

1. **Use descriptive issue titles**: Helps with PR generation
2. **Include acceptance criteria**: Guides review validation
3. **Link related issues**: Maintains project context
4. **Keep branches focused**: One feature/fix per review
5. **Address feedback promptly**: Faster iteration cycles

### Performance Optimization

- **Clean up regularly**: Don't let worktrees accumulate
- **Use test mode** for script validation: `--test` flag
- **Monitor disk space**: Worktrees duplicate repository content
- **Batch related changes**: Review multiple related issues together when appropriate

## Security Considerations

### Authentication
- GitHub CLI must be authenticated with appropriate scopes
- Claude CLI uses your account credentials securely
- Project scope required for GitHub project integration

### Data Isolation
- Worktrees are isolated from main development
- Feedback files contain only review information
- No secrets or credentials stored in review artifacts

### Access Control
- Uses existing GitHub repository permissions
- Claude CLI respects your account access levels
- Review tracking issues follow repository visibility

## Scalability Benefits

### Parallel Agent Execution

**Single Repository Limitations**:
- Only one agent can work effectively at a time
- Context conflicts reduce agent effectiveness
- File conflicts cause confusion and errors
- Manual worktree management is complex

**Isolated Worktree Advantages**:
- Run unlimited parallel agents simultaneously
- Each agent maintains clean, isolated context
- No file conflicts or unexpected changes
- Simple commands handle all complexity

### Team Efficiency

For teams working on multiple issues simultaneously:
- **Before**: Sequential reviews, agent interference
- **After**: Parallel reviews, clean isolation
- **Result**: Dramatically faster throughput, better quality

## Conclusion

The Review Automation workflow enables true agent swarm capabilities by providing complete isolation between parallel Claude agent sessions. By leveraging git worktrees behind simple commands, teams can run multiple agents simultaneously without context confusion or file conflicts.

### Key Takeaways

- 🔄 **Parallel Agent Execution** - Run multiple reviews simultaneously
- 🏗️ **Complete Isolation** - No context mixing or file conflicts
- 🤖 **Simplified Interface** - Complex worktree operations hidden behind simple commands
- 📊 **Comprehensive Reviews** - Full validation including tests, quality, and security
- 🔗 **GitHub Integration** - Seamless issue tracking and PR creation
- ⚡ **Team Scalability** - Handle multiple issues simultaneously with ease

Start running agent swarms today:
```bash
/project:run-smoke-test YOUR_ISSUE_NUMBER
```

Ready to unleash parallel agent productivity! 🚀