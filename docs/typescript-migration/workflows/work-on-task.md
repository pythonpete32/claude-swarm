# Workflow: Work on Task

← [Back to Index](../README.md) | [Workflow Overview](../03-workflows.md) | [Next: Review Task →](./review-task.md)

## Purpose
Orchestrates the complete development workflow for working on a GitHub issue, from worktree creation to Claude Code launch with proper context.

## User Entry Points

### CLI Command
```bash
# Direct execution
bun .claude/workflows/work-on-task.ts 123

# With agent ID for parallel development
bun .claude/workflows/work-on-task.ts 123 --agent-id 1
bun .claude/workflows/work-on-task.ts 123 --agent-id 2

# Via package.json script
bun run swarm:work 123
```

### Claude Slash Command
```
/project:work-on-issue $ISSUE_NUMBER=123 $MODE=direct $AGENT_ID=1
```

## Workflow Steps

### 1. Initialize and Validate

```typescript
import { 
  detectRepository, 
  getIssue,
  validateAuthentication 
} from 'claude-swarm';

// Validate environment
const auth = await validateAuthentication();
if (!auth.isValid) {
  throw new Error('GitHub authentication required. Run: gh auth login');
}

// Detect repository context
const repoInfo = await detectRepository();
console.log(`Working in: ${repoInfo.owner}/${repoInfo.name}`);

// Get issue details
const issue = await getIssue(repoInfo, issueNumber);
console.log(`Issue #${issue.number}: ${issue.title}`);
```

### 2. Check for Existing Work

```typescript
import { findWorktrees, getWorktreeInfo } from 'claude-swarm';

// Generate agent-specific search pattern
const agentSuffix = agentId ? `-agent-${agentId}` : '';
const searchPattern = `*task-${issueNumber}${agentSuffix}*`;

// Check for existing worktrees for this issue/agent combination
const existingWorktrees = await findWorktrees(searchPattern);

if (existingWorktrees.length > 0) {
  // Found existing worktree for this agent
  const worktree = existingWorktrees[0];
  console.log(`Found existing worktree: ${worktree.path}`);
  console.log(`Agent: ${agentId || 'default'}`);
  
  // Validate it's still valid
  const validation = await validateWorktreeState(worktree.path);
  if (!validation.isClean) {
    console.warn('⚠️  Worktree has uncommitted changes');
    // In interactive mode, prompt user
    // For now, continue with existing
  }
  
  return { worktree, resumed: true };
}

// Show other agents working on same issue
const allIssueWorktrees = await findWorktrees(`*task-${issueNumber}*`);
if (allIssueWorktrees.length > 0) {
  console.log(`\n📊 Other agents working on issue #${issueNumber}:`);
  allIssueWorktrees.forEach(wt => {
    const agentMatch = wt.name.match(/agent-(\d+)/);
    const agent = agentMatch ? agentMatch[1] : 'default';
    console.log(`   Agent ${agent}: ${wt.path}`);
  });
  console.log(`   Starting new agent: ${agentId || 'default'}\n`);
}
```

### 3. Create Development Environment

```typescript
import { 
  createWorktree, 
  getCurrentBranch,
  getRepositoryRoot 
} from 'claude-swarm';

// Get repository context (FIXING: interface issue from validation)
const repoRoot = await getRepositoryRoot();
const currentBranch = await getCurrentBranch(repoRoot);

// Create agent-specific branch name
const agentSuffix = agentId ? `-agent-${agentId}` : '';
const issueSlug = issue.title
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .substring(0, 40);
const branchName = `issue-${issueNumber}${agentSuffix}-${issueSlug}`;

// Create worktree with agent-specific naming
const worktreeName = `task-${issueNumber}${agentSuffix}`;
const worktree = await createWorktree({
  name: worktreeName,
  branchName: branchName,
  sourceBranch: repoInfo.defaultBranch,
  basePath: '../',
  namingStrategy: 'timestamped',
  repositoryPath: repoRoot  // FIXED: Added missing parameter
});

console.log(`✅ Created worktree: ${worktree.path}`);
console.log(`📌 Branch: ${worktree.branch}`);
```

### 4. Setup Claude Context

```typescript
import { ensureClaudeContext, copyClaudeContext } from 'claude-swarm';

// Ensure Claude context exists in worktree (FIXING: source path issue)
const contextStatus = await ensureClaudeContext(
  worktree.path,
  repoRoot  // FIXED: Added source repository path
);

if (!contextStatus.isComplete) {
  console.log('📝 Setting up Claude context...');
  
  // Copy missing context files
  const copiedFiles = await copyClaudeContext(repoRoot, worktree.path, {
    overwrite: false,
    preserveLocal: true,
    includeCommands: true
  });
  
  console.log(`✅ Copied ${copiedFiles.length} context files`);
}

// Verify commands are available
if (contextStatus.commandsAvailable.includes('work-on-issue')) {
  console.log('✅ work-on-issue command available');
}
```

### 5. Generate Work Prompt

```typescript
import { generateWorkPrompt } from 'claude-swarm';

// Determine work mode based on parameters
const workMode = mode || 'direct'; // 'direct' or 'review'

// Generate context-aware prompt
const workPrompt = await generateWorkPrompt({
  issueNumber: issue.number,
  mode: workMode,
  repositoryInfo: repoInfo,
  branchInfo: {
    name: worktree.branch,
    isClean: true,
    head: worktree.head,
    sourceBranch: repoInfo.defaultBranch  // FIXED: Added missing field
  },
  additionalContext: resumed ? 
    'Resuming work on existing worktree. Check git status for current state.' : 
    undefined
});

// Save prompt for reference (ADDING: missing feature from validation)
await fs.writeFile(
  path.join(worktree.path, '.claude', 'last-work-prompt.md'),
  workPrompt
);
```

### 6. Launch Development Session

```typescript
import { 
  createTmuxSession, 
  launchClaudeInteractive,
  getClaudeSessions 
} from 'claude-swarm';

// Create agent-specific session name
const sessionName = `swarm-task-${issueNumber}${agentSuffix}`;

// Check for existing Claude sessions (ADDING: missing feature)
const existingSessions = await getClaudeSessions();
const existingSession = existingSessions.find(s => 
  s.sessionName === sessionName
);

if (existingSession) {
  console.log(`♻️  Reusing existing session: ${existingSession.sessionName}`);
  // Send new prompt to existing session
  await sendPromptToSession(existingSession.sessionName, workPrompt);
} else {
  // Create new tmux session
  const session = await createTmuxSession({
    name: sessionName,
    workingDirectory: worktree.path,
    detached: true
  });

  console.log(`🖥️  Created tmux session: ${session.name}`);

  // Launch Claude in the session
  const claudeSession = await launchClaudeInteractive({
    workingDirectory: worktree.path,
    prompt: workPrompt,
    sessionName: session.name,
    useTmux: true,
    skipPermissions: true,
    additionalDirs: ['../lib'],  // Include shared libraries if present
    model: process.env.CLAUDE_MODEL  // Allow model override
  });

  console.log(`🤖 Claude launched in session: ${claudeSession.sessionName}`);
}
```

### 7. Provide User Guidance

```typescript
// Final output to user
console.log('\n' + '='.repeat(60));
console.log('🚀 Development Environment Ready!\n');
console.log(`📍 Issue: #${issue.number} - ${issue.title}`);
console.log(`🤖 Agent: ${agentId || 'default'}`);
console.log(`📂 Worktree: ${worktree.path}`);
console.log(`🌿 Branch: ${worktree.branch}`);
console.log(`💻 Session: ${session.name}\n`);
console.log('Next steps:');
console.log(`1. Monitor progress: tmux attach-session -t ${session.name}`);
console.log(`2. Check worktree: cd ${worktree.path}`);
console.log(`3. Claude will use: /project:work-on-issue ${issueNumber}`);

// Show parallel development info
if (agentId) {
  console.log(`\n🔄 Parallel Development Mode:`);
  console.log(`   Multiple agents can work on issue #${issueNumber} simultaneously`);
  console.log(`   Each agent will create separate branches and PRs`);
  console.log(`   Review all solutions to pick the best approach`);
}

console.log('\n' + '='.repeat(60));

// ADDING: Performance metrics (missing feature from validation)
if (process.env.CLAUDE_SWARM_METRICS === 'true') {
  const endTime = Date.now();
  console.log(`\n⏱️  Setup completed in ${endTime - startTime}ms`);
}
```

## Error Handling

```typescript
try {
  await runWorkflow();
} catch (error) {
  if (error.code === 'GITHUB_AUTH_FAILED') {
    console.error('❌ GitHub authentication failed');
    console.error('Run: gh auth login --scopes repo,project');
    process.exit(1);
  }
  
  if (error.code === 'ISSUE_NOT_FOUND') {
    console.error(`❌ Issue #${issueNumber} not found`);
    console.error(`Check: ${repoInfo.owner}/${repoInfo.name}/issues`);
    process.exit(1);
  }
  
  if (error.code === 'WORKTREE_EXISTS') {
    console.error('❌ Worktree already exists');
    console.error('Use --force to override or clean up first');
    process.exit(1);
  }
  
  // Cleanup on failure
  if (worktree?.path) {
    console.log('🧹 Cleaning up failed worktree...');
    await removeWorktree(worktree.path, { force: true });
  }
  
  throw error;
}
```

## Configuration Options

```typescript
interface WorkOnTaskOptions {
  issueNumber: number;              // Required: Issue to work on
  agentId?: string | number;        // Agent identifier for parallel development
  mode?: 'direct' | 'review';       // Work mode (default: 'direct')
  force?: boolean;                  // Force recreate worktree
  skipContext?: boolean;            // Skip Claude context setup
  model?: string;                   // Claude model override
  resumeSession?: boolean;          // Resume existing session
  interactive?: boolean;            // Enable user prompts
}
```

## Integration with Claude Commands

The workflow prepares the environment for Claude to execute:

```markdown
# .claude/commands/work-on-issue.md

When invoked with `/project:work-on-issue $ISSUE_NUMBER $MODE`:

1. Fetch issue details using `gh issue view $ISSUE_NUMBER`
2. Understand requirements and acceptance criteria
3. Implement the solution following CLAUDE.md conventions
4. Create appropriate tests
5. Run validation: `npm test` or `bun test`
6. Commit changes with conventional commit message
7. If MODE=direct: Create PR when complete
8. If MODE=review: Create work report for review
```

## Workflow Outputs

### Success Outputs
- Git worktree created at predictable location
- Development branch created and checked out
- Claude context files properly configured
- tmux session running with Claude
- Work prompt saved for reference

### File Artifacts
```
../task-123-20241214-150000/
├── .claude/
│   ├── settings.local.json
│   ├── commands/
│   │   └── work-on-issue.md
│   └── last-work-prompt.md      # Generated prompt
├── CLAUDE.md                     # Project conventions
└── [project files]               # Checked out code
```

## Testing Considerations

### Unit Tests
- Mock GitHub API responses
- Mock git command execution
- Test branch name generation
- Test prompt generation logic

### Integration Tests
- Real worktree creation and cleanup
- Real tmux session management
- Claude CLI availability checking

### Test Scenarios
- Existing worktree handling
- Authentication failures
- Missing issues
- Interrupted workflows
- Session recovery

## Parallel Development Workflow

### Multiple Agents on Same Issue

```bash
# Terminal 1: Start Agent 1
bun .claude/workflows/work-on-task.ts 123 --agent-id 1

# Terminal 2: Start Agent 2 
bun .claude/workflows/work-on-task.ts 123 --agent-id 2

# Terminal 3: Start Agent 3
bun .claude/workflows/work-on-task.ts 123 --agent-id 3
```

**Results in:**
- **Worktrees**: `../task-123-agent-1-*/`, `../task-123-agent-2-*/`, `../task-123-agent-3-*/`
- **Branches**: `issue-123-agent-1-implement-auth`, `issue-123-agent-2-implement-auth`, `issue-123-agent-3-implement-auth`
- **Sessions**: `swarm-task-123-agent-1`, `swarm-task-123-agent-2`, `swarm-task-123-agent-3`

### Benefits
1. **Diverse Solutions** - Different approaches to the same problem
2. **Risk Mitigation** - If one agent fails, others continue
3. **Quality Comparison** - Choose the best implementation
4. **Learning** - See different problem-solving strategies

### Review Process
After agents complete work:
1. Each creates separate PRs
2. Review all solutions for quality, approach, and completeness
3. Merge the best solution or combine elements from multiple
4. Use learnings to improve future agent prompts

## Future Enhancements

1. **Template System**
   - Custom prompt templates
   - Project-specific workflows

2. **Progress Tracking**
   - Save workflow state
   - Resume from interruptions

3. **Metrics Collection**
   - Time to completion
   - Success rates
   - Solution quality comparison