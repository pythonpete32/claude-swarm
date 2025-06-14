# Core Module: Git

← [Back to Index](../README.md) | [Previous: GitHub Module](./core-github.md) | [Next: Claude Module →](./core-claude.md)

## Purpose
Provides core Git repository operations that support worktree management, GitHub integration, and workflow automation. Handles repository validation, branch operations, diff analysis, and remote URL parsing.

## Dependencies
- `shared/types.ts` - Git-related interfaces
- `shared/errors.ts` - GitError class
- `shared/config.ts` - Git configuration
- Node.js `child_process` - For git command execution

## External Documentation References
- [Git Documentation](https://git-scm.com/docs)
- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- [Git Remote Documentation](https://git-scm.com/docs/git-remote)

## Function Signatures

### Repository Operations

#### validateRepository
```typescript
async function validateRepository(path?: string): Promise<Yeah, let's tackle the code. Let's tackle the code typescript next.>
```

**Parameters:**
- `path?: string` - Directory to validate (default: current working directory)

**Returns:**
```typescript
interface GitRepositoryInfo {
  isRepository: boolean;           // Whether directory is a git repository
  rootPath: string;                // Absolute path to repository root
  gitDir: string;                  // Path to .git directory
  workTree: string;                // Working tree path
  isBare: boolean;                 // Whether repository is bare
  isWorktree: boolean;             // Whether this is a worktree
  worktreeInfo?: GitWorktreeInfo;  // Worktree details if applicable
}

interface GitWorktreeInfo {
  mainRepoPath: string;            // Path to main repository
  branch: string;                  // Associated branch
  head: string;                    // Current HEAD commit
  isDetached: boolean;             // Whether HEAD is detached
}
```

**Behavior:**
- Validates git repository exists using `git rev-parse --git-dir`
- Determines repository type (normal, bare, worktree)
- Returns comprehensive repository information

**Error Conditions:**
- `GitError('NOT_A_REPOSITORY')` - Directory is not a git repository
- `GitError('INVALID_PATH')` - Path doesn't exist or not accessible

---

#### getRepositoryRoot
```typescript
async function getRepositoryRoot(path?: string): Promise<string>
```

**Parameters:**
- `path?: string` - Starting directory (default: current working directory)

**Returns:** Absolute path to repository root

**Behavior:**
- Uses `git rev-parse --show-toplevel` to find repository root
- Works from any subdirectory within repository

**Error Conditions:**
- `GitError('NOT_A_REPOSITORY')` - Not in a git repository

---

### Branch Operations

#### getCurrentBranch
```typescript
async function getCurrentBranch(repositoryPath?: string): Promise<GitBranchInfo>
```

**Returns:**
```typescript
interface GitBranchInfo {
  name: string;                    // Branch name (e.g., 'main', 'feature-auth')
  isDetached: boolean;             // Whether HEAD is detached
  head: string;                    // Current HEAD commit SHA
  upstream?: GitUpstreamInfo;      // Upstream branch info if configured
  isClean: boolean;                // Whether working directory is clean
  hasUncommittedChanges: boolean;  // Whether there are uncommitted changes
  hasStagedChanges: boolean;       // Whether there are staged changes
}

interface GitUpstreamInfo {
  remote: string;                  // Remote name (e.g., 'origin')
  branch: string;                  // Upstream branch name
  ahead: number;                   // Commits ahead of upstream
  behind: number;                  // Commits behind upstream
}
```

**Behavior:**
- Uses `git branch --show-current` for branch name
- Uses `git status --porcelain` for working directory status
- Uses `git rev-list --count` for upstream comparison

**Error Conditions:**
- `GitError('DETACHED_HEAD')` - HEAD is detached (not on a branch)
- `GitError('NO_COMMITS')` - Repository has no commits yet

---

#### branchExists
```typescript
async function branchExists(branchName: string, repositoryPath?: string): Promise<GitBranchExistence>
```

**Returns:**
```typescript
interface GitBranchExistence {
  exists: boolean;                 // Whether branch exists
  isLocal: boolean;                // Whether branch exists locally
  isRemote: boolean;               // Whether branch exists on remote
  remoteRefs: string[];            // Remote references if any
  lastCommit?: string;             // Last commit SHA if branch exists
}
```

**Behavior:**
- Checks local branches using `git show-ref --verify`
- Checks remote branches using `git ls-remote`
- Returns comprehensive branch existence information

---

#### createBranch
```typescript
async function createBranch(options: CreateBranchOptions): Promise<GitBranchInfo>
```

**Parameters:**
```typescript
interface CreateBranchOptions {
  name: string;                    // New branch name
  startPoint?: string;             // Starting commit/branch (default: HEAD)
  checkout?: boolean;              // Whether to checkout after creation (default: false)
  force?: boolean;                 // Force creation if branch exists (default: false)
  track?: boolean;                 // Set up upstream tracking (default: false)
  repositoryPath?: string;         // Repository path
}
```

**Behavior:**
- Creates branch using `git branch` or `git checkout -b`
- Optionally sets up upstream tracking
- Returns information about created branch

**Error Conditions:**
- `GitError('BRANCH_EXISTS')` - Branch already exists and force=false
- `GitError('INVALID_START_POINT')` - Start point doesn't exist
- `GitError('CHECKOUT_FAILED')` - Failed to checkout new branch

---

### Diff and Change Operations

#### getDiff
```typescript
async function getDiff(options: GitDiffOptions): Promise<GitDiffResult>
```

**Parameters:**
```typescript
interface GitDiffOptions {
  from?: string;                   // Source commit/branch (default: HEAD)
  to?: string;                     // Target commit/branch (default: working directory)
  paths?: string[];                // Specific paths to diff
  staged?: boolean;                // Include staged changes (default: false)
  nameOnly?: boolean;              // Return only changed file names (default: false)
  stat?: boolean;                  // Include diff statistics (default: false)
  repositoryPath?: string;         // Repository path
}
```

**Returns:**
```typescript
interface GitDiffResult {
  hasChanges: boolean;             // Whether there are any changes
  files: GitDiffFile[];            // Changed files
  stats: GitDiffStats;             // Overall statistics
  raw?: string;                    // Raw diff output if requested
}

interface GitDiffFile {
  path: string;                    // File path
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
  additions: number;               // Lines added
  deletions: number;               // Lines deleted
  oldPath?: string;                // Original path for renames/copies
  isBinary: boolean;               // Whether file is binary
}

interface GitDiffStats {
  filesChanged: number;            // Total files changed
  additions: number;               // Total lines added
  deletions: number;               // Total lines deleted
}
```

**Behavior:**
- Uses `git diff` with appropriate options
- Parses diff output into structured format
- Supports various diff scenarios (branch comparison, working directory, staged changes)

**Usage Examples:**
```typescript
// Compare current branch with main
const diff = await getDiff({ from: 'main', to: 'HEAD' });

// Get working directory changes
const workingDiff = await getDiff({ to: 'working' });

// Get staged changes
const stagedDiff = await getDiff({ staged: true });
```

---

#### getChangedFiles
```typescript
async function getChangedFiles(options: GetChangedFilesOptions): Promise<string[]>
```

**Parameters:**
```typescript
interface GetChangedFilesOptions {
  from?: string;                   // Source commit/branch
  to?: string;                     // Target commit/branch
  includeUntracked?: boolean;      // Include untracked files (default: false)
  includeStaged?: boolean;         // Include staged files (default: true)
  repositoryPath?: string;         // Repository path
}
```

**Returns:** Array of file paths that have changed

**Behavior:**
- Optimized version of `getDiff` for when only file names are needed
- Uses `git diff --name-only` for performance

---

### Remote Operations

#### getRemoteInfo
```typescript
async function getRemoteInfo(repositoryPath?: string): Promise<GitRemoteInfo[]>
```

**Returns:**
```typescript
interface GitRemoteInfo {
  name: string;                    // Remote name (e.g., 'origin')
  fetchUrl: string;                // Fetch URL
  pushUrl: string;                 // Push URL (may differ from fetch)
  type: 'https' | 'ssh' | 'git';   // URL protocol type
  host?: string;                   // Host (e.g., 'github.com')
  owner?: string;                  // Repository owner/organization
  repository?: string;             // Repository name
}
```

**Behavior:**
- Uses `git remote -v` to get remote information
- Parses URLs to extract host, owner, and repository information
- Supports GitHub, GitLab, and other Git hosting services

---

#### parseRemoteUrl
```typescript
function parseRemoteUrl(url: string): GitRemoteParsed
```

**Parameters:**
- `url: string` - Git remote URL to parse

**Returns:**
```typescript
interface GitRemoteParsed {
  protocol: 'https' | 'ssh' | 'git';
  host: string;                    // e.g., 'github.com'
  owner: string;                   // Repository owner/organization
  repository: string;              // Repository name (without .git)
  fullName: string;                // owner/repository
  isValid: boolean;                // Whether URL could be parsed
}
```

**Behavior:**
- Pure function for parsing Git remote URLs
- Supports various URL formats:
  - `https://github.com/owner/repo.git`
  - `git@github.com:owner/repo.git`
  - `ssh://git@github.com/owner/repo.git`

---

### Commit Operations

#### getCommitInfo
```typescript
async function getCommitInfo(commitish?: string, repositoryPath?: string): Promise<GitCommitInfo>
```

**Parameters:**
- `commitish?: string` - Commit reference (default: HEAD)
- `repositoryPath?: string` - Repository path

**Returns:**
```typescript
interface GitCommitInfo {
  sha: string;                     // Full commit SHA
  shortSha: string;                // Abbreviated commit SHA
  message: string;                 // Commit message
  subject: string;                 // First line of commit message
  body: string;                    // Commit message body
  author: GitCommitAuthor;         // Author information
  committer: GitCommitAuthor;      // Committer information
  date: Date;                      // Commit date
  parents: string[];               // Parent commit SHAs
}

interface GitCommitAuthor {
  name: string;                    // Author name
  email: string;                   // Author email
  date: Date;                      // Author date
}
```

**Behavior:**
- Uses `git show --format` to get commit information
- Parses commit data into structured format

---

#### getCommitRange
```typescript
async function getCommitRange(options: GitCommitRangeOptions): Promise<GitCommitInfo[]>
```

**Parameters:**
```typescript
interface GitCommitRangeOptions {
  from: string;                    // Starting commit/branch
  to?: string;                     // Ending commit/branch (default: HEAD)
  maxCount?: number;               // Maximum number of commits (default: 100)
  oneline?: boolean;               // Return minimal commit info (default: false)
  repositoryPath?: string;         // Repository path
}
```

**Returns:** Array of commits in the specified range

**Behavior:**
- Uses `git log` to get commit range
- Supports various commit range formats (from..to, from...to)

---

### Status and State Operations

#### getWorkingDirectoryStatus
```typescript
async function getWorkingDirectoryStatus(repositoryPath?: string): Promise<GitWorkingStatus>
```

**Returns:**
```typescript
interface GitWorkingStatus {
  isClean: boolean;                // No uncommitted changes
  hasUncommittedChanges: boolean;  // Has working directory changes
  hasStagedChanges: boolean;       // Has staged changes
  hasUntrackedFiles: boolean;      // Has untracked files
  files: GitStatusFile[];          // File status details
  ahead: number;                   // Commits ahead of upstream
  behind: number;                  // Commits behind upstream
}

interface GitStatusFile {
  path: string;                    // File path
  indexStatus: GitFileStatus;      // Status in index (staged)
  worktreeStatus: GitFileStatus;   // Status in working tree
  isConflicted: boolean;           // Whether file has merge conflicts
}

type GitFileStatus = 'unmodified' | 'modified' | 'added' | 'deleted' | 'renamed' | 'copied' | 'untracked' | 'ignored';
```

**Behavior:**
- Uses `git status --porcelain=v1` for machine-readable output
- Parses status into structured format
- Includes upstream comparison if available

## Usage Examples

### Repository Validation
```typescript
// Validate current directory is a git repository
const repoInfo = await validateRepository();
if (!repoInfo.isRepository) {
  throw new GitError('Not in a git repository');
}

// Get repository root
const rootPath = await getRepositoryRoot();
console.log(`Repository root: ${rootPath}`);
```

### Branch Operations
```typescript
// Get current branch information
const branchInfo = await getCurrentBranch();
console.log(`Current branch: ${branchInfo.name}`);
console.log(`Clean: ${branchInfo.isClean}`);

// Check if branch exists before creating worktree
const exists = await branchExists('feature-auth');
if (exists.exists) {
  console.log('Branch already exists');
}
```

### Diff Analysis for Review
```typescript
// Compare current branch with main for review
const diff = await getDiff({ from: 'main', to: 'HEAD' });
console.log(`Files changed: ${diff.stats.filesChanged}`);
console.log(`Lines added: ${diff.stats.additions}`);

// Get changed files for validation
const changedFiles = await getChangedFiles({ from: 'main' });
console.log(`Modified files: ${changedFiles.join(', ')}`);
```

### Remote Repository Detection
```typescript
// Get remote information for GitHub integration
const remotes = await getRemoteInfo();
const origin = remotes.find(r => r.name === 'origin');
if (origin) {
  console.log(`GitHub repo: ${origin.owner}/${origin.repository}`);
}

// Parse remote URL
const parsed = parseRemoteUrl('git@github.com:owner/repo.git');
console.log(`Repository: ${parsed.fullName}`);
```

## Testing Considerations

### Unit Tests
- **URL parsing**: Test various remote URL formats
- **Command construction**: Test git command building
- **Output parsing**: Test parsing of git command outputs

### Integration Tests
- **Real git operations**: Test against actual git repositories
- **Repository states**: Test with clean, dirty, and conflicted repositories
- **Branch scenarios**: Test with various branch configurations

### Mocking Strategy
- Mock `child_process.exec` for git command execution
- Provide test repositories with known states
- Mock file system operations for path validation

## Configuration Requirements

### Environment Dependencies
- Git 2.0+ installed and in PATH
- Proper git configuration (user.name, user.email)
- Repository access permissions

### Performance Considerations
- **Command caching**: Cache expensive operations like repository validation
- **Batch operations**: Combine multiple git commands where possible
- **Output limiting**: Use appropriate limits for log and diff operations

## Error Recovery Patterns

### Repository State Validation
```typescript
// Always validate repository state before operations
const repoInfo = await validateRepository();
if (!repoInfo.isRepository) {
  throw new GitError('Operation requires git repository');
}
```

### Branch Existence Checking
```typescript
// Check branch existence before operations that depend on it
const exists = await branchExists(branchName);
if (!exists.exists) {
  throw new GitError(`Branch '${branchName}' does not exist`);
}
```

## Future Extensions

- **Submodule support**: Operations for repositories with submodules
- **LFS support**: Large File Storage integration
- **Advanced merge operations**: Conflict resolution and merge strategies
- **Hooks integration**: Git hook management and execution
- **Stash operations**: Working directory stashing and restoration