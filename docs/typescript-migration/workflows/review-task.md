# Workflow: Review Task

← [Back to Index](../README.md) | [Previous: Work on Task](./work-on-task.md) | [Next: Setup Project →](./setup-project.md)

## Purpose
Creates an isolated, ephemeral review environment to analyze completed work, make approval decisions, and handle outcomes (PR creation or feedback generation).

## User Entry Points

### CLI Command
```bash
# Review specific work branch
bun .claude/workflows/review-task.ts 123 --branch issue-123-agent-1-implement-auth

# Review from work worktree path
bun .claude/workflows/review-task.ts 123 --worktree ../task-123-agent-1-20241214-150000

# Auto-detect most recent work
bun .claude/workflows/review-task.ts 123
```

### Claude Slash Command
```
/project:review-issue $ISSUE_NUMBER=123 $BRANCH=issue-123-agent-1-implement-auth
```

## Workflow Steps

### 1. Initialize and Detect Work

```typescript
import { 
  detectRepository, 
  getIssue,
  validateAuthentication,
  findWorktrees,
  getCurrentBranch,
  getRepositoryRoot
} from 'claude-swarm';

// Validate environment
const auth = await validateAuthentication();
if (!auth.isValid) {
  throw new Error('GitHub authentication required. Run: gh auth login');
}

// Detect repository context
const repoInfo = await detectRepository();
const repoRoot = await getRepositoryRoot();

// Get issue details
const issue = await getIssue(repoInfo, issueNumber);
console.log(`Reviewing issue #${issue.number}: ${issue.title}`);

// Determine work source
let workBranch: string;
let workWorktree: WorktreeInfo | undefined;

if (options.branch) {
  // Explicit branch provided
  workBranch = options.branch;
  console.log(`📌 Reviewing branch: ${workBranch}`);
} else if (options.worktree) {
  // Explicit worktree path provided
  workWorktree = await getWorktreeInfo(options.worktree);
  workBranch = workWorktree.branch;
  console.log(`📂 Reviewing worktree: ${workWorktree.path}`);
} else {
  // Auto-detect most recent work
  // First, check for swarm worktrees
  const workWorktrees = await findWorktrees(`*task-${issueNumber}*`);
  
  if (workWorktrees.length > 0) {
    // Use most recent swarm worktree (findWorktrees returns sorted by creation time)
    workWorktree = workWorktrees[0];
    workBranch = workWorktree.branch;
    console.log(`🔍 Auto-detected swarm work: ${workWorktree.path}`);
    console.log(`📌 Branch: ${workBranch}`);
  } else {
    // Fall back to current branch if no swarm worktrees found
    const currentBranch = await getCurrentBranch(repoRoot);
    
    // Validate we're not on a protected branch
    if (currentBranch === repoInfo.defaultBranch || currentBranch === 'master') {
      throw new Error(
        `Cannot review from protected branch '${currentBranch}'. ` +
        `Either create work using work-on-task or switch to a feature branch.`
      );
    }
    
    // Check if current branch is related to the issue
    const branchPattern = new RegExp(`(issue|task|feat).*${issueNumber}`, 'i');
    if (!branchPattern.test(currentBranch)) {
      console.warn(`⚠️  Current branch '${currentBranch}' doesn't match issue #${issueNumber} pattern`);
      console.warn(`   Expected pattern: issue-${issueNumber}-* or similar`);
      console.warn(`   Proceeding anyway...`);
    }
    
    workBranch = currentBranch;
    console.log(`🔍 Auto-detected current branch work: ${workBranch}`);
    console.log(`   No swarm worktrees found for issue #${issueNumber}`);
  }
}
```

### 2. Validate Work Readiness

```typescript
import { branchExists, getDiff, getCommitRange } from 'claude-swarm';

// Verify work branch exists
const branchCheck = await branchExists(workBranch, repoRoot);
if (!branchCheck.exists) {
  throw new Error(`Work branch '${workBranch}' not found`);
}

// Check if there are changes to review
const diff = await getDiff({
  from: repoInfo.defaultBranch,
  to: workBranch,
  repositoryPath: repoRoot
});

if (!diff.hasChanges) {
  throw new Error(`No changes found in branch '${workBranch}' to review`);
}

console.log(`📊 Changes to review:`);
console.log(`   Files changed: ${diff.stats.filesChanged}`);
console.log(`   Lines added: ${diff.stats.additions}`);
console.log(`   Lines deleted: ${diff.stats.deletions}`);

// Get commit history for context
const commits = await getCommitRange({
  from: repoInfo.defaultBranch,
  to: workBranch,
  maxCount: 10,
  repositoryPath: repoRoot
});

console.log(`📝 Commits: ${commits.length}`);
```

### 3. Create Review Environment

```typescript
import { createWorktree } from 'claude-swarm';

// Create ephemeral review worktree
const reviewWorktree = await createWorktree({
  name: `review-issue-${issueNumber}`,
  branchName: workBranch,  // Check out the work branch
  sourceBranch: workBranch,
  basePath: '../',
  namingStrategy: 'timestamped',
  repositoryPath: repoRoot,
  forceCreate: false  // Fail if review already exists
});

console.log(`🔬 Created review environment: ${reviewWorktree.path}`);
console.log(`📋 Reviewing branch: ${reviewWorktree.branch}`);
```

### 4. Setup Review Context

```typescript
import { ensureClaudeContext } from 'claude-swarm';

// Ensure Claude context in review worktree (copy .claude/ and CLAUDE.md)
await ensureClaudeContext(reviewWorktree.path, repoRoot);
console.log(`✅ Setup review context`);
```

### 5. Generate Review Prompt

```typescript
import { generateReviewPrompt } from 'claude-swarm';

// Generate comprehensive review prompt (Claude will analyze changes directly)
const reviewPrompt = await generateReviewPrompt({
  issueNumber: issue.number,
  repositoryInfo: repoInfo,
  workBranch: workBranch,
  workTreePath: reviewWorktree.path,
  baseBranch: repoInfo.defaultBranch
});

console.log(`📝 Generated review prompt`);
```

### 6. Launch Review Session

```typescript
import { 
  createTmuxSession, 
  launchClaudeInteractive 
} from 'claude-swarm';

// Create ephemeral review session
const sessionName = `swarm-review-${issueNumber}-${Date.now()}`;
const session = await createTmuxSession({
  name: sessionName,
  workingDirectory: reviewWorktree.path,
  detached: true
});

console.log(`🖥️  Created review session: ${session.name}`);

// Launch Claude for review
const claudeSession = await launchClaudeInteractive({
  workingDirectory: reviewWorktree.path,
  prompt: reviewPrompt,
  sessionName: session.name,
  useTmux: true,
  skipPermissions: true,
  model: process.env.CLAUDE_MODEL
});

console.log(`🤖 Review agent launched in session: ${claudeSession.sessionName}`);
```

### 7. Review Decision Handling

The review workflow sets up the environment and launches Claude. Claude then uses the `/project:review-issue` command to make decisions. The workflow handles the outcomes:

```typescript
// This logic would be implemented in the core modules
// and called by Claude's /project:review-issue command

async function handleReviewDecision(decision: 'approved' | 'needs_work', context: ReviewContext) {
  if (decision === 'approved') {
    await handleApprovalWorkflow(context);
  } else {
    await handleFeedbackWorkflow(context);
  }
  
  // Always cleanup review environment
  await cleanupReviewEnvironment(context);
}

async function handleApprovalWorkflow(context: ReviewContext) {
  console.log('✅ Work APPROVED - Creating PR...');
  
  // Create pull request
  const pr = await createPullRequest(context.repoInfo, {
    title: `feat: resolve issue #${context.issueNumber} - ${context.issue.title}`,
    body: generatePRDescription(context),
    head: context.workBranch,
    base: context.repoInfo.defaultBranch
  });
  
  console.log(`🚀 Created PR: ${pr.url}`);
  
  // Update issue with PR link
  // Close work worktree if desired
}

async function handleFeedbackWorkflow(context: ReviewContext) {
  console.log('📝 Work NEEDS CHANGES - Creating feedback...');
  
  // Create feedback document
  const feedbackPath = await createFeedbackDocument({
    issueNumber: context.issueNumber,
    reviewResult: 'needs_work',
    feedback: context.reviewFeedback,
    workBranch: context.workBranch
  });
  
  console.log(`📄 Created feedback: ${feedbackPath}`);
  
  // Copy feedback to work worktree if it exists
  if (context.workWorktree) {
    const workFeedbackPath = path.join(context.workWorktree.path, 'review-feedback.md');
    await fs.copyFile(feedbackPath, workFeedbackPath);
    console.log(`📋 Copied feedback to work environment: ${workFeedbackPath}`);
  }
}

async function cleanupReviewEnvironment(context: ReviewContext) {
  console.log('🧹 Cleaning up review environment...');
  
  // Kill review session
  await killSession(context.sessionName, { force: true });
  
  // Remove review worktree
  await removeWorktree(context.reviewWorktree.path, { force: true });
  
  console.log('✅ Review environment cleaned up');
}
```

### 8. User Guidance

```typescript
// Provide clear guidance during review
console.log('\n' + '='.repeat(60));
console.log('🔬 Review Environment Ready!\n');
console.log(`📍 Issue: #${issue.number} - ${issue.title}`);
console.log(`🔍 Reviewing: ${workBranch}`);
console.log(`📂 Review worktree: ${reviewWorktree.path}`);
console.log(`💻 Session: ${session.name}\n`);
console.log('Review process:');
console.log('1. Claude will analyze the implementation');
console.log('2. Compare against issue requirements');
console.log('3. Run validation tests');
console.log('4. Make APPROVED or NEEDS_WORK decision');
console.log('5. Handle outcome and cleanup automatically\n');
console.log(`Monitor: tmux attach-session -t ${session.name}`);
console.log('\n' + '='.repeat(60));
```

## Error Handling

```typescript
try {
  await runReviewWorkflow(options);
} catch (error) {
  if (error.code === 'NO_WORK_FOUND') {
    console.error(`❌ No work found for issue #${issueNumber}`);
    console.error('Run work-on-task first to create work to review');
    process.exit(1);
  }
  
  if (error.code === 'REVIEW_EXISTS') {
    console.error('❌ Review already in progress');
    console.error('Wait for current review to complete or clean up first');
    process.exit(1);
  }
  
  if (error.code === 'NO_CHANGES') {
    console.error(`❌ No changes found in branch '${workBranch}'`);
    console.error('Ensure work is complete before requesting review');
    process.exit(1);
  }
  
  // Cleanup on any failure
  if (reviewWorktree?.path) {
    console.log('🧹 Cleaning up failed review...');
    await removeWorktree(reviewWorktree.path, { force: true });
  }
  
  throw error;
}
```

## Configuration Options

```typescript
interface ReviewTaskOptions {
  issueNumber: number;              // Required: Issue to review
  branch?: string;                  // Specific branch to review
  worktree?: string;                // Specific worktree path to review
  model?: string;                   // Claude model override
  skipValidation?: boolean;         // Skip pre-review validation
  interactive?: boolean;            // Enable user prompts
  keepReviewEnvironment?: boolean;  // Don't cleanup for debugging
}
```

## Integration with Claude Commands

The workflow prepares the environment for Claude to execute:

```markdown
# .claude/commands/review-issue.md

When invoked with `/project:review-issue $ISSUE_NUMBER`:

1. **Understand Requirements**
   - Read issue description and acceptance criteria
   - Review any existing work reports

2. **Analyze Implementation**
   - Examine code changes: `git diff main..HEAD`
   - Check test coverage and quality
   - Validate against requirements

3. **Run Validation**
   - Execute test suite: `npm test` or `bun test`
   - Check for regressions
   - Validate functionality manually if needed

4. **Make Decision**
   - **APPROVED**: Implementation meets requirements
     - Create PR with descriptive title and body
     - Link to original issue
   - **NEEDS_WORK**: Implementation incomplete or issues found
     - Document specific issues and requirements
     - Provide actionable feedback for improvement

5. **Cleanup**
   - Review environment is automatically cleaned up
   - Feedback is saved to appropriate locations
```

## Workflow Outputs

### Success Outputs
- **Approved**: PR created, review environment cleaned up
- **Needs Work**: Feedback document created, review environment cleaned up

## Testing Considerations
- Test review worktree lifecycle
- Test PR creation and feedback generation
- Test cleanup logic

