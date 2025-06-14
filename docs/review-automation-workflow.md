# Workflow: Review Automation

## Purpose
Enables two-layer agent swarm architecture for software development using GitHub Projects and git worktrees. Implementation agents work on tasks in parallel, then separate review agents evaluate their work with fresh perspective before creating PRs.

## Function Signatures

### Main Review Functions
```typescript
async function runSmokeTest(options: SmokeTestOptions): Promise<SmokeTestResult>
async function cleanupSmokeTest(options: CleanupSmokeTestOptions): Promise<CleanupSmokeTestResult>
```

### Configuration Interfaces
```typescript
interface SmokeTestOptions {
  issueNumber: number;              // Required: Issue to review
  reviewId?: string;                // Optional: Review identifier for parallel reviews
  skipTests?: boolean;              // Skip automated test execution
  model?: string;                   // Claude model override
  timeout?: number;                 // Review timeout in minutes
  interactive?: boolean;            // Enable user prompts
}

interface CleanupSmokeTestOptions {
  issueNumber: number;              // Required: Issue to cleanup
  force?: boolean;                  // Force cleanup without warnings
  preserveFeedback?: boolean;       // Keep feedback files after cleanup
  pruneWorktrees?: boolean;         // Clean git worktree references
}
```

### Result Interfaces
```typescript
interface SmokeTestResult {
  reviewWorktree: WorktreeInfo;     // Created review worktree
  claudeSession: ClaudeSessionInfo; // Launched review session
  trackingIssue?: GitHubIssue;      // Created tracking issue
  reviewStatus: 'STARTED' | 'FAILED'; // Initial status
}

interface CleanupSmokeTestResult {
  reviewStatus: 'APPROVED' | 'NEEDS_WORK'; // Final review outcome
  feedbackMerged: boolean;          // Whether feedback was found and merged
  worktreeRemoved: boolean;         // Whether worktree was cleaned up
  feedbackPath?: string;            // Path to merged feedback file
  nextSteps: string[];              // Recommended next actions
}
```

### Review Decision Interface
```typescript
interface ReviewDecision {
  status: 'APPROVED' | 'NEEDS_WORK'; // Review outcome
  summary: string;                  // Brief decision summary
  issues: ReviewIssue[];            // Found issues (if NEEDS_WORK)
  testResults: TestExecutionResult; // Automated test results
  validationSteps: string[];        // Completed validation steps
}

interface ReviewIssue {
  severity: 'CRITICAL' | 'MEDIUM' | 'LOW'; // Issue priority
  category: 'FUNCTIONALITY' | 'QUALITY' | 'SECURITY' | 'PERFORMANCE' | 'DOCUMENTATION';
  problem: string;                  // Issue description
  expected: string;                 // Expected behavior
  found: string;                    // Actual behavior
  fix: string;                      // Recommended solution
  impact: string;                   // Why this matters
}
```

### Supporting Interfaces
```typescript
interface ReviewWorktreeInfo extends WorktreeInfo {
  reviewId: string;                 // Unique review identifier
  sourceIssue: number;              // Original issue being reviewed
  trackingIssue?: number;           // GitHub tracking issue number
  isolated: boolean;                // Context isolation confirmed
}

interface TestExecutionResult {
  passed: boolean;                  // Overall test status
  testsRun: number;                 // Number of tests executed
  testsFailed: number;              // Number of failed tests
  lintPassed: boolean;              // Linting status
  buildPassed: boolean;             // Build status
  output: string;                   // Test execution output
}
```

## CLI Entry Points

### Start Review
```bash
/project:run-smoke-test 123
```

### Cleanup Review
```bash
/project:cleanup-smoke-test 123
```

## Two-Layer Architecture

### Layer 1: Implementation Agents
- Multiple agents work simultaneously on different GitHub issues
- Each agent works in isolated worktree: `../work-issue-{number}-{timestamp}/`
- Agents implement features, fix bugs, or complete assigned tasks
- Work happens in parallel without agent interference

### Layer 2: Review Agents (Fresh Context)
- Fresh agents review completed work with clean context
- Each review agent works in separate worktree: `../review-issue-{number}-{timestamp}/`
- Critical isolation: Review agents have no implementation context
- Objective evaluation leads to APPROVED (auto-PR) or NEEDS_WORK (feedback)

## Review Workflow Logic

### Phase 1: Fresh Review Agent Initiation

#### 1. Environment Setup
- Create isolated review worktree using `createWorktree()`
- Copy clean context files using `copyClaudeContext()`
- Create GitHub tracking issue using `createIssue()`
- Launch fresh Claude agent using `launchClaudeInteractive()`

#### 2. Context Isolation Validation
- Ensure no implementation history contamination
- Verify clean file state and conversation context
- Confirm complete codebase availability for review

### Phase 2: Fresh Agent Review Process

#### 1. Requirements Understanding
- Fetch issue details using `getIssue()`
- Extract acceptance criteria and success metrics
- Understand expected behavior from user perspective

#### 2. Implementation Analysis
- Read work report using `readFile()` (if exists)
- Analyze changes using `getDiff()`
- Evaluate implementation against requirements

#### 3. Comprehensive Validation
- Execute automated tests using `runTests()`
- Perform manual validation steps
- Check for security, performance, and quality issues

#### 4. Decision Making
- Generate review decision using `makeReviewDecision()`
- Choose APPROVED or NEEDS_WORK path
- Create appropriate artifacts (PR or feedback)

### Phase 3: Review Completion

#### APPROVED Path
- Validate all checks passed using `validateApprovalCriteria()`
- Create PR immediately using `createPullRequest()`
- Report success with PR URL

#### NEEDS_WORK Path
- Create structured feedback using `createReviewFeedback()`
- Document specific issues and required fixes
- Provide validation steps for retry

### Phase 4: Cleanup and Feedback Merge

#### 1. Feedback Detection
- Search for feedback documents using `findReviewFeedback()`
- Determine review outcome from artifact presence

#### 2. Feedback Integration
- Merge feedback to original branch using `mergeFeedback()`
- Preserve feedback in `planning/temp/review-feedback/`

#### 3. Worktree Cleanup
- Remove review worktree using `removeWorktree()`
- Prune git references using `pruneWorktrees()`
- Provide next steps guidance

## Error Handling

### Error Types
```typescript
interface ReviewAutomationError extends Error {
  code: 'WORKTREE_EXISTS' | 'ISSUE_NOT_FOUND' | 'CONTEXT_CONTAMINATION' | 'REVIEW_FAILED';
  issueNumber?: number;
  reviewWorktree?: string;
  trackingIssue?: number;
  originalError?: Error;
}
```

### Recovery Actions
- Worktree conflicts: Clean up existing review worktrees
- Issue not found: Verify issue exists and is accessible
- Context contamination: Reset review environment
- Review failures: Preserve state for debugging

## Parallel Review Support

### Multiple Reviews
- Run unlimited parallel reviews simultaneously
- Each review isolated in separate worktree
- No context conflicts or agent interference
- Independent tracking and cleanup

### Review Coordination
- Display active reviews for monitoring
- Track review status and outcomes
- Coordinate feedback merge timing

## Integration Points

### Core Module Dependencies
- **core-github**: `getIssue()`, `createIssue()`, `createPullRequest()`
- **core-worktree**: `createWorktree()`, `removeWorktree()`, `findWorktrees()`
- **core-files**: `copyClaudeContext()`, `readFile()`, `writeFile()`
- **core-claude**: `launchClaudeInteractive()`, `makeReviewDecision()`
- **core-git**: `getDiff()`, `getCurrentBranch()`

### GitHub Integration
- Tracking issues with relationships to original issues
- PRs with comprehensive metadata and validation
- Project board integration for status tracking

### File Structure
```
../review-issue-{number}-{timestamp}/
├── [complete project copy]          # Implementation work to review
├── CLAUDE.md                        # Clean project guidance  
├── .claude/commands/                # Review commands available
├── planning/temp/review-feedback/   # Generated feedback (if NEEDS_WORK)
└── planning/temp/review-metadata.json # Review session metadata
```

## Quality Assurance

### Fresh Perspective Benefits
- No implementation bias or context contamination
- Objective evaluation of work as written
- Fresh eyes catch issues implementation agents miss
- Clean validation of requirements satisfaction

### Comprehensive Validation
- Automated test execution and validation
- Manual smoke testing of functionality
- Code quality and security review
- Documentation and completeness checks

## Testing Considerations
- Test review worktree creation and isolation
- Validate context contamination prevention
- Test feedback generation and merge process
- Verify parallel review coordination
- Test GitHub integration and tracking

## Scalability Benefits

### Parallel Execution
- Run unlimited simultaneous reviews
- No context conflicts between agents
- Independent feedback and PR generation
- Efficient resource utilization

### Team Efficiency
- Sequential to parallel review workflow
- Faster turnaround on implementation validation
- Better quality through fresh perspective
- Reduced context switching overhead