# Core Module: Worktree

← [Back to Index](../README.md) | [Architecture Overview](../01-architecture-overview.md) | [Next: tmux Module →](./core-tmux.md)

## Purpose
Provides reusable git worktree operations that can be parameterized for different workflow contexts (task work, review, etc).

## Dependencies
- `shared/types.ts` - WorktreeInfo, WorktreeOptions interfaces
- `shared/errors.ts` - WorktreeError class
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
interface CreateWorktreeOptions {
  name: string;                    // Worktree identifier (e.g., 'task-123', 'review-issue-45')
  branchName?: string;             // Specific branch name to create/use
  sourceBranch?: string;           // Branch to create from (default: current branch)
  basePath?: string;               // Base directory (default: '../')
  namingStrategy?: 'simple' | 'timestamped';  // Default: 'simple'
  forceCreate?: boolean;           // Override existing worktree (default: false)
  repositoryPath?: string;         // Repository root path (default: current repo)
}
```

**Returns:**
```typescript
interface WorktreeInfo {
  name: string;                    // Worktree name
  path: string;                    // Absolute path to worktree
  branch: string;                  // Associated branch name
  sourceBranch: string;            // Branch it was created from
  created: Date;                   // Creation timestamp
  isActive: boolean;               // Whether worktree is currently active
  head: string;                    // Current HEAD commit SHA
}
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
- `WorktreeError('INVALID_REPOSITORY')` - Not in git repository
- `WorktreeError('WORKTREE_EXISTS')` - Worktree already exists at path
- `WorktreeError('BRANCH_CHECKOUT_CONFLICT')` - Branch already checked out
- `WorktreeError('INVALID_SOURCE_BRANCH')` - Source branch doesn't exist
- `WorktreeError('PERMISSION_DENIED')` - Cannot create directory/worktree

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
- `WorktreeError('UNCOMMITTED_CHANGES')` - Has changes and force=false
- `WorktreeError('REMOVAL_FAILED')` - Git command failed

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
interface WorktreeValidation {
  isValid: boolean;                // Worktree exists and is valid
  isClean: boolean;                // No uncommitted changes
  isRegistered: boolean;           // Known to git worktree list
  hasUnpushedCommits: boolean;     // Has commits not pushed to remote
  issues: string[];                // Array of validation problems
}
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
}): string
```

**Behavior:**
- Pure function for path generation
- Handles different naming strategies
- Ensures path uniqueness for timestamped strategy

## Usage Examples

### Task Worktree Creation
```typescript
const taskWorktree = await createWorktree({
  name: 'task-123',
  sourceBranch: 'main',
  namingStrategy: 'simple'
});
// Result: ../claude-swarm-task-123/
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
```

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

### Configurable Behavior
- Base path for worktree creation
- Default naming strategy
- Cleanup behavior (auto-prune references)

## Performance Considerations

- **Path validation**: Cache git repository root detection
- **Worktree listing**: Cache and refresh git worktree list
- **Cleanup batching**: Batch operations when removing multiple worktrees

## Future Extensions

- **Worktree templates**: Pre-configured worktree setups
- **Cleanup policies**: Automatic cleanup of old worktrees  
- **Monitoring**: Worktree usage tracking and reporting