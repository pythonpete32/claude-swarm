# Core Worktree Module Implementation Prompt

<instructions>
Implement the core-worktree module for the Claude Swarm TypeScript migration project using Test-Driven Development (TDD) methodology. This module provides Git worktree management operations supporting isolated development environments, task-specific workspace creation, and automated worktree lifecycle management across all workflows.

Build a robust, testable, and well-documented worktree management module that:
- Creates and manages isolated Git worktrees for task development
- Handles worktree lifecycle from creation to cleanup with proper state validation
- Provides worktree discovery and status checking across repositories
- Integrates seamlessly with task workflows and branch management
- Follows the established error handling and configuration patterns
- Integrates with core-git for underlying Git operations and core-files for context setup

Create the module at `src/core/worktree.ts` with comprehensive tests following TDD principles.

## Required Reading

Before implementation, review these specification files for context and integration requirements:

1. **Core Architecture**: `spec/prompts/core-files-implementation.md` - Reference implementation showing TDD methodology, error handling patterns, and testing structure that should be mirrored in this module.

2. **Related Core Modules**: 
   - `spec/core-git.md` - Git operations interface and patterns that core-worktree will depend on
   - `spec/core-github.md` - GitHub integration patterns for worktree branch management
   - `spec/core-claude.md` - Claude Code integration for development environment setup

3. **Workflow Integration**:
   - `spec/workflows/work-on-task.md` - Primary consumer of worktree creation and management
   - `spec/workflows/review-task.md` - Worktree switching and cleanup patterns
   - `spec/workflows/sync-repository.md` - Multi-worktree synchronization requirements

4. **Shared Infrastructure**:
   - `src/shared/errors.ts` - Existing error codes and patterns (WORKTREE_* codes already defined)
   - `src/shared/types.ts` - WorktreeInfo, RepositoryInfo, GitBranchInfo interfaces
   - `src/shared/validation.ts` - CommonValidators for input validation

5. **Testing Reference**: 
   - `tests/unit/core/files.test.ts` - Comprehensive TDD test structure with MockFileSystem patterns
   - `tests/fixtures/` - Test data patterns and mock repository structures

These specifications provide the context for proper integration with existing modules and adherence to established patterns.
</instructions>

<requirements>
Functional Requirements:
- `createWorktree()` - Create new worktree with branch and task isolation
- `removeWorktree()` - Clean removal of worktree with uncommitted change validation
- `listWorktrees()` - Discover and enumerate all repository worktrees
- `getWorktreeInfo()` - Get detailed information about specific worktree
- `validateWorktreeState()` - Check worktree health and Git state
- `switchWorktree()` - Switch active development context between worktrees
- `getActiveWorktree()` - Identify currently active worktree
- `cleanupOrphanedWorktrees()` - Remove invalid or corrupted worktree references
- `ensureWorktreeBranch()` - Ensure worktree has correct branch setup

Technical Requirements:
- TypeScript with strict type checking and 90%+ test coverage
- Use shared types from `@/shared/types` (WorktreeInfo, RepositoryInfo, GitBranchInfo)
- Use standardized error handling from `@/shared/errors`
- Use validation utilities from `@/shared/validation`
- Integrate with core-git for Git operations and status checking
- Integrate with core-files for Claude context management
- Support cross-platform path operations (macOS, Linux, Windows)
- Handle Git worktree edge cases and error conditions gracefully
- Provide atomic operations with proper rollback on failures

Interface Requirements:
- Export all functions as named exports
- Use WorktreeInfo, RepositoryInfo, GitBranchInfo interfaces from shared types
- Accept configuration objects for customization behavior
- Return structured result objects with detailed status information
- Support dependency injection for testing (GitOperations, FileOperations)
- Provide both synchronous validation and asynchronous worktree operations
</requirements>

<architecture>
Layer Position: Core Layer (src/core/)
- Used by: workflows/work-on-task, workflows/review-task, workflows/sync-repository
- Uses: shared/types, shared/errors, shared/validation, core/git, core/files, Node.js path, fs/promises
- Dependencies: core-git (for Git operations), core-files (for context setup), shared infrastructure

Design Patterns:
- Dependency injection for Git and file operations (enables testing)
- Factory pattern for creating worktree configurations
- State pattern for worktree lifecycle management (created, active, stale, orphaned)
- Command pattern for atomic worktree operations with rollback
- Observer pattern for worktree status change notifications

File Structure:
```
src/core/worktree.ts                    # Main implementation
tests/unit/core/worktree.test.ts        # Unit tests with mocked Git/file operations
tests/integration/worktree.test.ts      # Integration tests with real Git repositories
tests/fixtures/worktree/                # Test repository structures and scenarios
  ├── mock-repositories/                # Sample Git repos for testing
  ├── worktree-scenarios/               # Different worktree configurations
  ├── branch-structures/                # Various branch setups
  └── conflict-cases/                   # Edge cases and error scenarios
```
</architecture>

<error-handling>
Use Hierarchical Error System:
- Import ErrorFactory and ERROR_CODES from `@/shared/errors`
- Extend existing worktree error codes in ERROR_CODES:
  - `WORKTREE_EXISTS` - Worktree already exists at path
  - `WORKTREE_NOT_FOUND` - Worktree doesn't exist or invalid
  - `WORKTREE_UNCOMMITTED_CHANGES` - Uncommitted changes prevent operation
  - `WORKTREE_CREATION_FAILED` - Failed to create worktree
  - `WORKTREE_REMOVAL_FAILED` - Failed to remove worktree
  - `WORKTREE_INVALID_PATH` - Invalid or inaccessible worktree path
  - `WORKTREE_BRANCH_MISMATCH` - Worktree branch doesn't match expected
  - `WORKTREE_CORRUPTED` - Worktree in invalid or corrupted state
  - `WORKTREE_OPERATION_FAILED` - General worktree operation failure

Error Handling Patterns:
```typescript
// Worktree creation with validation
try {
  await this.gitOps.worktreeAdd(targetPath, branchName);
  return { success: true, path: targetPath, branch: branchName };
} catch (error) {
  if (error.code === 'EEXIST') {
    throw ErrorFactory.worktree(
      ERROR_CODES.WORKTREE_EXISTS,
      `Worktree already exists at: ${targetPath}`,
      { path: targetPath, branch: branchName, suggestion: 'Use --force or choose different path' }
    );
  }
  if (error.message.includes('fatal: invalid reference')) {
    throw ErrorFactory.worktree(
      ERROR_CODES.GIT_BRANCH_NOT_FOUND,
      `Branch not found: ${branchName}`,
      { branch: branchName, suggestion: 'Create branch first or use existing branch' }
    );
  }
  throw ErrorFactory.worktree(
    ERROR_CODES.WORKTREE_CREATION_FAILED,
    `Failed to create worktree: ${error.message}`,
    { path: targetPath, branch: branchName, originalError: error }
  );
}

// Worktree removal with safety checks
const validation = await validateWorktreeState(worktreePath);
if (!validation.isClean) {
  throw ErrorFactory.worktree(
    ERROR_CODES.WORKTREE_UNCOMMITTED_CHANGES,
    `Worktree has uncommitted changes: ${validation.uncommittedFiles.join(', ')}`,
    { 
      path: worktreePath, 
      uncommittedFiles: validation.uncommittedFiles,
      suggestion: 'Commit changes or use --force to discard them'
    }
  );
}
```

Include helpful suggestions in error messages and provide context data for debugging.
</error-handling>

<testing>
TDD Implementation Strategy (Test-Driven Development):

Red-Green-Refactor Cycles:
1. **Red Phase**: Write failing tests for each function before implementation
2. **Green Phase**: Write minimal code to make tests pass
3. **Refactor Phase**: Improve code quality while maintaining test coverage

Unit Testing Strategy (90% coverage minimum):
- Mock Git operations using dependency injection (GitOperationsInterface)
- Mock file system operations using FileSystemInterface from core-files
- Test each function with valid inputs and expected outputs
- Test error conditions: path conflicts, Git failures, permission issues
- Test cross-platform path handling with different separators
- Use test fixtures for consistent repository structures
- Mock core-files integration for context management

Integration Testing Strategy:
- Test real Git worktree operations in isolated temporary repositories
- Test actual worktree creation, switching, and removal workflows
- Test integration with core-git for branch operations
- Test integration with core-files for Claude context setup
- Test cleanup operations with real Git worktree scenarios
- Verify cross-platform Git worktree behavior

Testing Structure:
```typescript
// Unit tests with mocks
describe('core-worktree unit tests', () => {
  let mockGitOps: MockGitOperationsInterface;
  let mockFileOps: MockFileSystemInterface;
  let mockPath: MockPathInterface;
  
  beforeEach(() => {
    mockGitOps = new MockGitOperations();
    mockFileOps = new MockFileSystem();
    mockPath = new MockPath();
  });
  
  describe('createWorktree', () => {
    it('should create worktree with new branch when branch does not exist');
    it('should create worktree with existing branch when branch exists');
    it('should handle path conflicts gracefully');
    it('should setup Claude context after worktree creation');
    it('should rollback on Git operation failures');
  });
  
  describe('removeWorktree', () => {
    it('should remove clean worktree successfully');
    it('should prevent removal of worktree with uncommitted changes');
    it('should handle force removal when requested');
    it('should clean up Git references properly');
  });
});

// Integration tests with real Git
describe('core-worktree integration tests', () => {
  let tempRepo: string;
  let repoPath: string;
  
  beforeEach(async () => {
    tempRepo = await createTempTestRepository();
    repoPath = path.join(tempRepo, '.git');
  });
  
  afterEach(async () => {
    await cleanupTempTestRepository(tempRepo);
  });
  
  it('should create and manage real Git worktrees', async () => {
    // Test with actual Git operations
  });
});
```

Test Coverage Requirements:
- All public functions: 100% coverage
- Error paths: 90% coverage
- Cross-platform scenarios: Linux/macOS/Windows path handling
- Performance: Worktree operations under 2 seconds for typical scenarios
- Git integration: All Git command variations and error cases
</testing>

<implementation-order>
TDD Implementation Phases:

Phase 1: Dependency Injection Setup
1. Define GitOperationsInterface for Git worktree operations
2. Define WorktreeOperationsInterface for higher-level operations
3. Create default implementations and mock implementations
4. Set up test infrastructure with Git repository fixtures

Phase 2: Core Worktree Operations (Test-First)
```typescript
// 1. Write failing tests first
describe('createWorktree', () => {
  it('should create worktree at specified path with branch');
  it('should create branch if it does not exist');
  it('should setup Claude context in new worktree');
  it('should handle existing path conflicts');
});

// 2. Implement minimal functionality to pass tests
async function createWorktree(
  options: CreateWorktreeOptions,
  gitOps: GitOperationsInterface = defaultGitOps,
  fileOps: FileOperationsInterface = defaultFileOps
): Promise<WorktreeResult>

// 3. Refactor implementation for quality and performance
```

Phase 3: Worktree Discovery and Status (Test-First)
```typescript
// Tests for listWorktrees, getWorktreeInfo, validateWorktreeState
// Implementation following same TDD cycle
```

Phase 4: Worktree Lifecycle Management (Test-First)
```typescript
// Tests for removeWorktree, switchWorktree, cleanupOrphanedWorktrees
// Implementation following same TDD cycle
```

Phase 5: Advanced Operations (Test-First)
```typescript
// Tests for getActiveWorktree, ensureWorktreeBranch
// Implementation following same TDD cycle
```

Function Implementation Priority:
1. `validateWorktreeState()` - Foundation for safe operations
2. `createWorktree()` - Core worktree creation functionality
3. `listWorktrees()` - Worktree discovery and enumeration
4. `getWorktreeInfo()` - Detailed worktree information
5. `removeWorktree()` - Safe worktree removal
6. `switchWorktree()` - Context switching between worktrees
7. `getActiveWorktree()` - Active worktree identification
8. `ensureWorktreeBranch()` - Branch consistency management
9. `cleanupOrphanedWorktrees()` - Maintenance and cleanup
</implementation-order>

<interfaces>
TypeScript Interfaces (extends shared types):

```typescript
// Git Operations Interface for dependency injection
export interface GitOperationsInterface {
  worktreeAdd(path: string, branch?: string): Promise<void>;
  worktreeRemove(path: string, force?: boolean): Promise<void>;
  worktreeList(): Promise<GitWorktreeInfo[]>;
  worktreePrune(): Promise<void>;
  isWorktree(path: string): Promise<boolean>;
  getWorktreeRoot(path: string): Promise<string>;
  getCurrentBranch(path: string): Promise<string>;
  hasUncommittedChanges(path: string): Promise<boolean>;
  createBranch(name: string, startPoint?: string): Promise<void>;
  branchExists(name: string): Promise<boolean>;
}

// Worktree Creation Options
export interface CreateWorktreeOptions {
  name: string;                          // Worktree name/identifier
  path?: string;                         // Custom path (default: derived from name)
  branch?: string;                       // Branch name (default: derived from name)
  baseBranch?: string;                   // Source branch (default: main/master)
  force?: boolean;                       // Force creation if path exists
  setupContext?: boolean;                // Setup Claude context (default: true)
  agentId?: string;                      // Agent identifier for isolation
}

// Worktree Removal Options
export interface RemoveWorktreeOptions {
  force?: boolean;                       // Force removal ignoring uncommitted changes
  cleanup?: boolean;                     // Clean up Git references
  preserveContext?: boolean;             // Keep Claude context files
}

// Worktree Result Information
export interface WorktreeResult {
  success: boolean;                      // Operation success status
  path: string;                          // Worktree path
  branch: string;                        // Associated branch
  info?: WorktreeInfo;                   // Detailed worktree information
  contextStatus?: ClaudeContextStatus;   // Claude context setup status
}

// Extended Worktree Information
export interface ExtendedWorktreeInfo extends WorktreeInfo {
  repositoryPath: string;                // Parent repository path
  gitDir: string;                        // Git directory path
  isActive: boolean;                     // Whether this is the active worktree
  hasUncommittedChanges: boolean;        // Whether there are uncommitted changes
  lastModified: Date;                    // Last modification time
  claudeContext?: ClaudeContextStatus;   // Claude context status
}

// Git Worktree Information (from git worktree list)
export interface GitWorktreeInfo {
  path: string;                          // Worktree path
  branch: string;                        // Current branch
  commit: string;                        // Current commit
  isBare: boolean;                       // Whether it's a bare worktree
  isLocked: boolean;                     // Whether worktree is locked
  lockReason?: string;                   // Lock reason if locked
}

// Worktree State Validation
export interface WorktreeStateValidation {
  isValid: boolean;                      // Worktree is in valid state
  isClean: boolean;                      // No uncommitted changes
  hasValidGitDir: boolean;               // Git directory is valid
  hasValidBranch: boolean;               // Branch reference is valid
  uncommittedFiles: string[];            // List of uncommitted files
  issues: string[];                      // Validation problems found
  warnings: string[];                    // Non-critical issues
}

// Worktree Switching Options
export interface SwitchWorktreeOptions {
  path: string;                          // Target worktree path
  createIfMissing?: boolean;             // Create worktree if it doesn't exist
  setupEnvironment?: boolean;            // Setup development environment
  preserveSession?: boolean;             // Preserve tmux/terminal session
}

// Worktree Discovery Options
export interface ListWorktreesOptions {
  includeMainWorktree?: boolean;         // Include main repository worktree
  includeInactive?: boolean;             // Include inactive/stale worktrees
  validateState?: boolean;               // Validate each worktree state
  sortBy?: 'name' | 'path' | 'lastModified' | 'branch'; // Sort criteria
}

// Cleanup Options for Orphaned Worktrees
export interface CleanupWorktreesOptions {
  dryRun?: boolean;                      // Show what would be cleaned
  includeActive?: boolean;               // Include active worktrees in cleanup
  olderThan?: Date;                      // Only clean worktrees older than date
  patterns?: string[];                   // Path patterns to match for cleanup
  preserveBranches?: string[];           // Branch names to preserve
}

// Cleanup Result
export interface WorktreeCleanupResult {
  removedWorktrees: string[];            // Paths of removed worktrees
  preservedWorktrees: string[];          // Paths of preserved worktrees
  errors: WorktreeCleanupError[];        // Cleanup failures
  spaceSaved: number;                    // Disk space freed (bytes)
}

// Cleanup Error Details
export interface WorktreeCleanupError {
  path: string;                          // Failed worktree path
  error: string;                         // Error description
  canRetry: boolean;                     // Whether operation can be retried
}

// Branch Synchronization Options
export interface EnsureBranchOptions {
  baseBranch?: string;                   // Source branch for new branches
  createIfMissing?: boolean;             // Create branch if it doesn't exist
  resetToUpstream?: boolean;             // Reset to upstream if exists
  pullLatest?: boolean;                  // Pull latest changes
}
```
</interfaces>

<examples>
Usage Examples and Integration Patterns:

```typescript
// Example 1: Task-Oriented Worktree Creation
import { createWorktree, ensureWorktreeBranch } from '@/core/worktree';
import { ensureClaudeContext } from '@/core/files';

async function setupTaskWorktree(taskNumber: number, issueTitle: string) {
  // Create task-specific worktree
  const worktreeResult = await createWorktree({
    name: `task-${taskNumber}`,
    branch: `feature/task-${taskNumber}-${slugify(issueTitle)}`,
    baseBranch: 'main',
    setupContext: true,
    agentId: `agent-${Date.now()}`
  });
  
  if (!worktreeResult.success) {
    throw new Error(`Failed to create worktree: ${worktreeResult.path}`);
  }
  
  // Ensure branch is properly configured
  await ensureWorktreeBranch(worktreeResult.path, {
    createIfMissing: true,
    pullLatest: true
  });
  
  console.log(`Task worktree ready: ${worktreeResult.path}`);
  console.log(`Branch: ${worktreeResult.branch}`);
  console.log(`Context: ${worktreeResult.contextStatus?.isComplete ? 'Ready' : 'Incomplete'}`);
  
  return worktreeResult;
}

// Example 2: Safe Worktree Removal with Validation
import { removeWorktree, validateWorktreeState } from '@/core/worktree';

async function cleanupTaskWorktree(worktreePath: string, force = false) {
  // Validate worktree state before removal
  const validation = await validateWorktreeState(worktreePath);
  
  if (!validation.isClean && !force) {
    console.warn('Worktree has uncommitted changes:');
    validation.uncommittedFiles.forEach(file => console.warn(`  - ${file}`));
    
    const shouldContinue = await confirmDangerousOperation(
      'Remove worktree with uncommitted changes?'
    );
    
    if (!shouldContinue) {
      return { removed: false, reason: 'user_cancelled' };
    }
  }
  
  // Remove worktree safely
  const result = await removeWorktree(worktreePath, {
    force: force || !validation.isClean,
    cleanup: true,
    preserveContext: false
  });
  
  if (result.success) {
    console.log(`Worktree removed: ${worktreePath}`);
  }
  
  return result;
}

// Example 3: Worktree Discovery and Status Report
import { listWorktrees, getWorktreeInfo } from '@/core/worktree';

async function generateWorktreeReport() {
  // List all worktrees with validation
  const worktrees = await listWorktrees({
    includeMainWorktree: true,
    validateState: true,
    sortBy: 'lastModified'
  });
  
  console.log(`\nWorktree Status Report (${worktrees.length} worktrees):`);
  console.log('=' .repeat(60));
  
  for (const worktree of worktrees) {
    const info = await getWorktreeInfo(worktree.path);
    const status = info.hasUncommittedChanges ? '🔶 DIRTY' : '✅ CLEAN';
    const active = info.isActive ? '🎯 ACTIVE' : '';
    
    console.log(`${status} ${active} ${info.path}`);
    console.log(`  Branch: ${info.branch} (${info.commit.substring(0, 8)})`);
    console.log(`  Modified: ${info.lastModified.toLocaleDateString()}`);
    
    if (info.claudeContext?.isComplete) {
      console.log(`  Context: ✅ Claude context ready`);
    } else {
      console.log(`  Context: ⚠️ Incomplete`);
    }
    console.log('');
  }
}

// Example 4: Worktree Switching with Environment Setup
import { switchWorktree, getActiveWorktree } from '@/core/worktree';

async function switchToTaskWorktree(taskNumber: number) {
  const currentWorktree = await getActiveWorktree();
  const targetPath = `./worktrees/task-${taskNumber}`;
  
  // Check if target worktree exists
  let targetExists: boolean;
  try {
    await validateWorktreeState(targetPath);
    targetExists = true;
  } catch {
    targetExists = false;
  }
  
  if (!targetExists) {
    console.log(`Worktree for task ${taskNumber} doesn't exist. Creating...`);
    await setupTaskWorktree(taskNumber, `Task ${taskNumber}`);
  }
  
  // Switch to target worktree
  const switchResult = await switchWorktree({
    path: targetPath,
    setupEnvironment: true,
    preserveSession: true
  });
  
  if (switchResult.success) {
    console.log(`Switched from ${currentWorktree?.path} to ${targetPath}`);
    console.log(`Now working on: ${switchResult.info?.branch}`);
  }
  
  return switchResult;
}

// Example 5: Maintenance and Cleanup Operations
import { cleanupOrphanedWorktrees } from '@/core/worktree';

async function performWorktreeMaintenance() {
  // Clean up old worktrees (older than 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const cleanupResult = await cleanupOrphanedWorktrees({
    dryRun: false,
    olderThan: thirtyDaysAgo,
    preserveBranches: ['main', 'develop', 'staging'],
    patterns: ['task-*', 'feature-*']
  });
  
  console.log(`Maintenance completed:`);
  console.log(`  Removed: ${cleanupResult.removedWorktrees.length} worktrees`);
  console.log(`  Preserved: ${cleanupResult.preservedWorktrees.length} worktrees`);
  console.log(`  Space saved: ${Math.round(cleanupResult.spaceSaved / 1024 / 1024)}MB`);
  
  if (cleanupResult.errors.length > 0) {
    console.warn(`Cleanup errors:`);
    cleanupResult.errors.forEach(error => {
      console.warn(`  ${error.path}: ${error.error}`);
    });
  }
  
  return cleanupResult;
}

// Example 6: Error Handling Patterns
import { ErrorFactory, ERROR_CODES } from '@/shared/errors';

async function safeWorktreeOperation(worktreePath: string) {
  try {
    const info = await getWorktreeInfo(worktreePath);
    return { success: true, info };
  } catch (error) {
    if (error.code === ERROR_CODES.WORKTREE_NOT_FOUND) {
      // Handle missing worktree gracefully
      console.warn(`Worktree not found: ${worktreePath}`);
      return { success: false, reason: 'not_found' };
    }
    
    if (error.code === ERROR_CODES.WORKTREE_CORRUPTED) {
      // Provide recovery suggestion
      throw ErrorFactory.worktree(
        ERROR_CODES.WORKTREE_CORRUPTED,
        `Worktree corrupted: ${worktreePath}. Try: git worktree prune && git worktree repair`,
        { path: worktreePath, suggestion: 'Run git worktree repair or remove and recreate' }
      );
    }
    
    // Re-throw other errors
    throw error;
  }
}
```

Integration with Other Core Modules:
```typescript
// Integration with core-git for Git operations
import { getCurrentBranch, hasUncommittedChanges } from '@/core/git';

// Integration with core-files for context management
import { ensureClaudeContext, copyClaudeContext } from '@/core/files';

// Integration with shared validation
import { CommonValidators } from '@/shared/validation';

// Integration pattern for workflow operations
async function workflowWorktreeOperations(taskInfo: TaskInfo) {
  // Validate inputs using shared validators
  CommonValidators.taskId().validateOrThrow(taskInfo.id);
  
  // Create worktree with integrated context setup
  const worktree = await createWorktree({
    name: `task-${taskInfo.id}`,
    branch: `feature/${taskInfo.branch}`,
    setupContext: true
  });
  
  // Validate integrated state
  const validation = await validateWorktreeState(worktree.path);
  if (!validation.isValid) {
    throw ErrorFactory.worktree(
      ERROR_CODES.WORKTREE_INVALID_PATH,
      `Worktree validation failed: ${validation.issues.join(', ')}`,
      { path: worktree.path, issues: validation.issues }
    );
  }
  
  return worktree;
}
```
</examples>