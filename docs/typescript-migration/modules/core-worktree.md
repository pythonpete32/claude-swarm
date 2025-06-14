# Core Module: Worktree

← [Back to Index](../README.md) | [Architecture Overview](../01-architecture-overview.md) | [Next: tmux Module →](./core-tmux.md)

## Purpose
Provides reusable git worktree operations that can be parameterized for different workflow contexts (task work, review, etc).

## Dependencies
- `shared/types.ts` - WorktreeInfo, RepositoryInfo, GitBranchInfo interfaces
- `shared/errors.ts` - WorktreeError class and error codes
- `shared/config.ts` - WorktreeConfig for default behavior
- `core/git.ts` - Git repository operations
- Node.js `child_process` - For git command execution

## Function Signatures

### Primary Operations

#### createWorktree
```typescript
async function createWorktree(options: CreateWorktreeOptions): Promise<WorktreeInfo>
```

**Parameters:**
```typescript
// Uses shared interface from shared/types.ts
interface CreateWorktreeOptions {
  name: string;                    // Worktree identifier (e.g., 'task-123', 'review-issue-45')
  branchName?: string;             // Specific branch name to create/use
  sourceBranch?: string;           // Branch to create from (default: current branch)
  basePath?: string;               // Base directory (default: from WorktreeConfig)
  namingStrategy?: 'simple' | 'timestamped';  // Default: from WorktreeConfig
  forceCreate?: boolean;           // Override existing worktree (default: false)
  repositoryPath?: string;         // Repository root path (default: current repo)
  agentId?: string | number;       // Agent identifier for parallel development
}
```

**Returns:**
```typescript
// Uses shared interface from shared/types.ts
// See shared/types.ts for complete WorktreeInfo definition
```

**Behavior:**
- Validates git repository exists
- Handles both new and existing branch creation
- Generates appropriate path based on naming strategy:
  - `simple`: `{basePath}/{repoName}-{name}`
  - `timestamped`: `{basePath}/{name}-{timestamp}`
- Detects and handles conflicts with existing worktrees
- Creates worktree using `git worktree add`

**Error Conditions:**
- `WorktreeError('WORKTREE_INVALID_REPOSITORY')` - Not in git repository
- `WorktreeError('WORKTREE_EXISTS')` - Worktree already exists at path
- `WorktreeError('WORKTREE_BRANCH_CHECKOUT_CONFLICT')` - Branch already checked out
- `WorktreeError('WORKTREE_INVALID_SOURCE_BRANCH')` - Source branch doesn't exist
- `WorktreeError('WORKTREE_PERMISSION_DENIED')` - Cannot create directory/worktree

*Error codes follow shared ERROR_CODES pattern: MODULE_ERROR_TYPE*

---

#### removeWorktree
```typescript
async function removeWorktree(path: string, options?: RemoveWorktreeOptions): Promise<void>
```

**Parameters:**
```typescript
interface RemoveWorktreeOptions {
  force?: boolean;                 // Force removal even with uncommitted changes
  pruneReferences?: boolean;       // Clean up git worktree references (default: true)
}
```

**Behavior:**
- Validates worktree exists and is registered with git
- Checks for uncommitted changes (throws error unless force=true)
- Removes worktree using `git worktree remove`
- Optionally runs `git worktree prune` to clean references

**Error Conditions:**
- `WorktreeError('WORKTREE_NOT_FOUND')` - Path doesn't exist or isn't a worktree
- `WorktreeError('WORKTREE_UNCOMMITTED_CHANGES')` - Has changes and force=false
- `WorktreeError('WORKTREE_REMOVAL_FAILED')` - Git command failed

*Error codes follow shared ERROR_CODES pattern: MODULE_ERROR_TYPE*

---

#### findWorktrees
```typescript
async function findWorktrees(pattern?: string): Promise<WorktreeInfo[]>
```

**Parameters:**
- `pattern?: string` - Optional glob pattern to filter worktrees (e.g., 'review-issue-*', '*task-123*')

**Returns:** Array of WorktreeInfo objects for matching worktrees, sorted by creation date (newest first)

**Behavior:**
- Lists all git worktrees using `git worktree list`
- Filters by glob pattern if provided
- Supports wildcards: `*task-123*`, `review-issue-*-20241214-*`
- Returns structured information for each worktree
- Sorts by creation timestamp, newest first

---

#### getWorktreeInfo
```typescript
async function getWorktreeInfo(path: string): Promise<WorktreeInfo>
```

**Parameters:**
- `path: string` - Path to worktree directory

**Returns:** WorktreeInfo object with current worktree state

**Error Conditions:**
- `WorktreeError('WORKTREE_NOT_FOUND')` - Path is not a valid worktree

---

### Utility Operations

#### validateWorktreeState
```typescript
async function validateWorktreeState(path: string): Promise<WorktreeValidation>
```

**Returns:**
```typescript
// Uses shared WorktreeValidation interface from shared/types.ts
// Extends ValidationResult with worktree-specific fields:
// - isClean: boolean
// - isRegistered: boolean  
// - hasUnpushedCommits: boolean
// See shared/types.ts for complete interface definition
```

**Behavior:**
- Checks if path is a valid git worktree
- Verifies worktree is registered with git
- Checks for uncommitted changes using `git status`
- Checks for unpushed commits
- Returns detailed validation status

#### generateWorktreePath
```typescript
function generateWorktreePath(options: {
  name: string;
  basePath: string;
  namingStrategy: 'simple' | 'timestamped';
  repoName: string;
  agentId?: string | number;       // Agent identifier for parallel development
}): string
```

**Behavior:**
- Pure function for path generation using shared NAMING_PATTERNS
- Handles different naming strategies from shared/types.ts
- Supports agent isolation for parallel development
- Ensures path uniqueness for timestamped strategy
- Uses NAMING_PATTERNS.WORKTREE_SIMPLE and NAMING_PATTERNS.WORKTREE_TIMESTAMPED

## Usage Examples

### Task Worktree Creation (Single Agent)
```typescript
const taskWorktree = await createWorktree({
  name: 'task-123',
  sourceBranch: 'main',
  namingStrategy: 'simple'
});
// Result: ../claude-swarm-task-123/
```

### Task Worktree Creation (Parallel Agents)
```typescript
// Agent 1
const agent1Worktree = await createWorktree({
  name: 'task-123',
  sourceBranch: 'main',
  agentId: 1,
  namingStrategy: 'timestamped'
});
// Result: ../task-123-agent-1-20241214-143022/

// Agent 2 working on same issue
const agent2Worktree = await createWorktree({
  name: 'task-123',
  sourceBranch: 'main',
  agentId: 2,
  namingStrategy: 'timestamped'
});
// Result: ../task-123-agent-2-20241214-143045/
```

### Review Worktree Creation  
```typescript
const reviewWorktree = await createWorktree({
  name: 'review-issue-45',
  sourceBranch: 'feature-auth',  // Review the current work
  namingStrategy: 'timestamped'
});
// Result: ../review-issue-45-20241214-143022/
```

### Cleanup Operations
```typescript
// Find review worktrees for cleanup
const reviewWorktrees = await findWorktrees('review-issue-*');

// Remove specific worktree
await removeWorktree(reviewWorktrees[0].path, { force: false });

// Find abandoned agent worktrees
const abandonedWorktrees = await findAbandonedWorktrees({
  pattern: 'task-*-agent-*',
  maxAge: 7
});
```

---

### Cleanup Operations

#### cleanupCurrentWorktree
```typescript
async function cleanupCurrentWorktree(options?: CurrentWorktreeCleanupOptions): Promise<CleanupResult>
```

**Parameters:**
```typescript
interface CurrentWorktreeCleanupOptions {
  preserveFeedback?: boolean;      // Keep feedback documents before cleanup
  preserveWorkReport?: boolean;    // Keep work reports before cleanup  
  confirmRemoval?: boolean;        // Prompt before removing worktree
  sessionName?: string;            // tmux session to terminate
}
```

**Returns:**
```typescript
// Uses shared interface pattern from shared/types.ts
interface CleanupResult extends BaseWorkflowResult {
  worktreeRemoved: boolean;        // Worktree was deleted
  sessionTerminated: boolean;      // tmux session was killed
  filesPreserved: string[];        // Files saved before cleanup
  tempFilesRemoved: number;        // Temporary files deleted
  spaceSaved: number;              // Disk space freed (bytes)
  errors: string[];                // Any cleanup failures
}
```

**Behavior:**
- Detects current worktree path automatically
- Preserves specified documents to permanent locations
- Removes worktree and cleans up references
- Safe to call from within the worktree being cleaned

**Error Conditions:**
- `WorktreeError('NOT_IN_WORKTREE')` - Not currently in a worktree
- `WorktreeError('REMOVAL_FAILED')` - Cannot remove current worktree

---

#### findAbandonedWorktrees
```typescript
async function findAbandonedWorktrees(options?: AbandonedWorktreeOptions): Promise<AbandonedWorktree[]>
```

**Parameters:**
```typescript
interface AbandonedWorktreeOptions {
  basePath?: string;               // Base path to search (default: '../')
  maxAge?: number;                 // Consider abandoned after N days
  includeActive?: boolean;         // Include worktrees with active sessions
  pattern?: string;                // Worktree name pattern to match
}

interface AbandonedWorktree {
  path: string;                    // Worktree directory path
  branch: string;                  // Associated branch name
  age: number;                     // Days since creation
  lastActivity: Date;              // Last file modification
  hasUncommittedChanges: boolean;  // Dirty working directory
  hasUnpushedCommits: boolean;     // Unpushed commits exist
  safeToRemove: boolean;           // No valuable data will be lost
  removalRisk: 'low' | 'medium' | 'high'; // Risk assessment
}
```

**Behavior:**
- Scans for worktrees matching claude-swarm patterns
- Analyzes activity and age to determine abandonment
- Checks for uncommitted/unpushed work
- Assesses data loss risk for each worktree

**Error Conditions:**
- `FileError('SCAN_FAILED')` - Cannot scan directories
- `WorktreeError('LIST_FAILED')` - Git worktree listing failed

---

#### cleanupAbandonedWorktrees
```typescript
async function cleanupAbandonedWorktrees(worktrees: AbandonedWorktree[], options?: BatchCleanupOptions): Promise<BatchCleanupResult>
```

**Parameters:**
```typescript
interface BatchCleanupOptions {
  confirmEach?: boolean;           // Prompt for each worktree
  preserveRisky?: boolean;         // Skip high-risk removals
  maxConcurrent?: number;          // Maximum parallel operations
  dryRun?: boolean;                // Show what would be done
}

interface BatchCleanupResult {
  totalProcessed: number;          // Total worktrees processed
  successfulRemovals: number;      // Worktrees successfully removed
  skippedWorktrees: number;        // Worktrees preserved/skipped
  totalSpaceSaved: number;         // Total disk space freed
  errors: CleanupError[];          // Individual cleanup failures
}

interface CleanupError {
  worktreePath: string;            // Failed worktree path
  error: string;                   // Error description
  recoverable: boolean;            // Whether error can be resolved
}
```

**Behavior:**
- Processes multiple abandoned worktrees safely
- Applies consistent cleanup policies
- Handles individual failures gracefully
- Provides progress reporting for long operations

**Error Conditions:**
- `BatchError('TOO_MANY_FAILURES')` - Excessive cleanup failures
- `ResourceError('INSUFFICIENT_RESOURCES')` - System resource constraints

---

## Agent Coordination Functions

### getActiveAgents
```typescript
async function getActiveAgents(issueNumber: number): Promise<AgentInfo[]>
```

**Parameters:**
- `issueNumber: number` - Issue number to check for active agents

**Returns:** Array of AgentInfo objects representing agents currently working on the issue

**Behavior:**
- Scans for worktrees matching agent patterns for the issue
- Checks tmux sessions for agent activity
- Returns active agent information for coordination

**Usage:**
```typescript
// Check what agents are working on issue #123
const activeAgents = await getActiveAgents(123);
console.log(`${activeAgents.length} agents working on issue #123`);
```

---

### detectAgentConflicts
```typescript
async function detectAgentConflicts(issueNumber: number): Promise<AgentConflict[]>
```

**Returns:**
```typescript
// Uses shared AgentConflict interface from shared/types.ts
// Detects file conflicts, branch conflicts, session conflicts
```

**Behavior:**
- Analyzes all agent worktrees for the issue
- Detects potential conflicts between agents
- Returns recommendations for conflict resolution

---

### coordinateAgentCleanup
```typescript
async function coordinateAgentCleanup(issueNumber: number, options?: AgentCleanupOptions): Promise<AgentCleanupResult>
```

**Parameters:**
```typescript
interface AgentCleanupOptions {
  preserveActiveAgents?: boolean;  // Keep active agent worktrees
  consolidateResults?: boolean;    // Merge agent work results
  maxConcurrent?: number;          // Maximum parallel cleanup operations
}

interface AgentCleanupResult extends BaseWorkflowResult {
  agentsProcessed: number;         // Total agents processed
  agentsRemoved: number;           // Agents successfully cleaned up
  agentsPreserved: number;         // Agents kept (still active)
  conflictsDetected: AgentConflict[]; // Conflicts that need manual resolution
}
```

**Behavior:**
- Coordinates cleanup of multiple agent worktrees for an issue
- Handles agent-specific cleanup safely
- Preserves active agents by default
- Provides conflict resolution guidance

---

## Testing Considerations

### Unit Tests
- **Path generation**: Test naming strategies and collision handling
- **Validation logic**: Test git repository detection
- **Error handling**: Test all error conditions with mocked git commands

### Integration Tests  
- **Real git operations**: Test against actual git repositories
- **Worktree lifecycle**: Create → validate → remove workflows
- **Conflict scenarios**: Existing worktrees, checked out branches

### Mocking Strategy
- Mock `child_process.exec` for git command execution
- Mock file system operations for path validation
- Provide test repositories for integration tests

## Configuration Requirements

### Environment Dependencies
- Git 2.5+ (for worktree support)
- Write permissions in base directory

### Configurable Behavior (via shared/config.ts)
```typescript
// Uses WorktreeConfig from shared infrastructure
interface WorktreeConfig {
  basePath: string;                // Default base path for worktrees
  namingStrategy: 'simple' | 'timestamped'; // Default naming strategy
  autoCleanup: boolean;            // Automatic cleanup of old worktrees
  maxAge: number;                  // Days before considering worktree abandoned
}
```

**Default Values** (from DEFAULT_CONFIG):
- `basePath: '../'`
- `namingStrategy: 'simple'`
- `autoCleanup: true`
- `maxAge: 7`

## Performance Considerations

- **Path validation**: Cache git repository root detection
- **Worktree listing**: Cache and refresh git worktree list
- **Cleanup batching**: Batch operations when removing multiple worktrees

## Future Extensions

- **Worktree templates**: Pre-configured worktree setups
- **Cleanup policies**: Automatic cleanup of old worktrees  
- **Monitoring**: Worktree usage tracking and reporting