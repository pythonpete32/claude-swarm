# Workflow: Cleanup Worktree

← [Back to Index](../README.md) | [Previous: Setup Project](./setup-project.md)

## Purpose
Provides cleanup functions for agents to remove their own work environments and maintains system cleanliness by removing abandoned worktrees, tmux sessions, and temporary files. Used by both work and review agents when completing tasks.

## Dependencies
- `core/worktree.ts` - Worktree detection and removal
- `core/tmux.ts` - Session management and cleanup
- `core/files.ts` - Temporary file cleanup
- `shared/types.ts` - Cleanup operation interfaces
- Node.js `fs/promises` - File system operations
- Node.js `path` - Path manipulation

## Function Signatures

### Agent Cleanup Functions

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
interface CleanupResult {
  success: boolean;                // Cleanup completed successfully
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
- Terminates associated tmux session
- Removes worktree and temporary files
- Safe to call from within the worktree being cleaned

**Error Conditions:**
- `WorktreeError('NOT_IN_WORKTREE')` - Not currently in a worktree
- `WorktreeError('REMOVAL_FAILED')` - Cannot remove current worktree
- `TmuxError('SESSION_KILL_FAILED')` - Cannot terminate session

---

#### cleanupWorktree
```typescript
async function cleanupWorktree(worktreePath: string, options?: WorktreeCleanupOptions): Promise<CleanupResult>
```

**Parameters:**
- `worktreePath: string` - Path to worktree to remove
- `options: WorktreeCleanupOptions` - Cleanup configuration

```typescript
interface WorktreeCleanupOptions {
  force?: boolean;                 // Override safety checks
  preserveData?: boolean;          // Archive important files
  removeSession?: boolean;         // Kill associated tmux session
  removeTempFiles?: boolean;       // Clean related temporary files
}
```

**Behavior:**
- Removes specified worktree from any location
- Validates worktree safety before removal
- Handles associated session and file cleanup
- Works from outside the target worktree

**Error Conditions:**
- `WorktreeError('PATH_NOT_FOUND')` - Worktree path doesn't exist
- `WorktreeError('NOT_WORKTREE')` - Path is not a git worktree
- `WorktreeError('IN_USE')` - Worktree currently active

---

### System Maintenance Functions

#### findAbandonedWorktrees
```typescript
async function findAbandonedWorktrees(options: AbandonedWorktreeOptions): Promise<AbandonedWorktree[]>
```

**Parameters:**
```typescript
interface AbandonedWorktreeOptions {
  basePath?: string;               // Base path to search (default: '../')
  maxAge?: number;                 // Consider abandoned after N days
  includeActive?: boolean;         // Include worktrees with active sessions
  pattern?: string;                // Worktree name pattern to match
  checkActivity?: boolean;         // Check for recent file modifications
}
```

**Returns:**
```typescript
interface AbandonedWorktree {
  path: string;                    // Worktree directory path
  branch: string;                  // Associated branch name
  age: number;                     // Days since creation
  lastActivity: Date;              // Last file modification
  hasUncommittedChanges: boolean;  // Dirty working directory
  hasUnpushedCommits: boolean;     // Unpushed commits exist
  associatedSessions: string[];    // Related tmux sessions
  tempFiles: string[];             // Associated temporary files
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
async function cleanupAbandonedWorktrees(worktrees: AbandonedWorktree[], options: BatchCleanupOptions): Promise<BatchCleanupResult>
```

**Parameters:**
```typescript
interface BatchCleanupOptions {
  confirmEach?: boolean;           // Prompt for each worktree
  preserveRisky?: boolean;         // Skip high-risk removals
  archiveBeforeRemoval?: boolean;  // Create archives of removed data
  maxConcurrent?: number;          // Maximum parallel operations
  dryRun?: boolean;                // Show what would be done
}
```

**Returns:**
```typescript
interface BatchCleanupResult {
  totalProcessed: number;          // Total worktrees processed
  successfulRemovals: number;      // Worktrees successfully removed
  skippedWorktrees: number;        // Worktrees preserved/skipped
  totalSpaceSaved: number;         // Total disk space freed
  preservedData: string[];         // Files archived before removal
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
- Provides progress reporting for long operations
- Handles individual failures gracefully

**Error Conditions:**
- `BatchError('TOO_MANY_FAILURES')` - Excessive cleanup failures
- `ResourceError('INSUFFICIENT_RESOURCES')` - System resource constraints

---

### Session Management

#### cleanupOrphanedSessions
```typescript
async function cleanupOrphanedSessions(options?: SessionCleanupOptions): Promise<SessionCleanupResult>
```

**Parameters:**
```typescript
interface SessionCleanupOptions {
  sessionPattern?: string;         // Pattern to match (default: 'swarm-*')
  maxIdleTime?: number;            // Maximum idle time (minutes)
  excludeActive?: boolean;         // Skip sessions with active processes
  force?: boolean;                 // Force kill even if active
}
```

**Returns:**
```typescript
interface SessionCleanupResult {
  sessionsFound: string[];         // All matching sessions found
  sessionsKilled: string[];        // Sessions successfully terminated
  sessionsPreserved: string[];     // Active sessions kept
  errors: string[];                // Session termination failures
}
```

**Behavior:**
- Finds tmux sessions matching claude-swarm patterns
- Checks session activity and process status
- Terminates idle or orphaned sessions
- Preserves active work sessions

**Error Conditions:**
- `TmuxError('SESSION_LIST_FAILED')` - Cannot list sessions
- `TmuxError('KILL_FAILED')` - Cannot terminate session

---

### Temporary File Management

#### cleanupTempFiles
```typescript
async function cleanupTempFiles(options?: TempFileCleanupOptions): Promise<TempFileCleanupResult>
```

**Parameters:**
```typescript
interface TempFileCleanupOptions {
  basePath?: string;               // Base path for temp files (default: 'planning/temp/')
  maxAge?: number;                 // Maximum file age in days
  preserveActive?: boolean;        // Keep files for active worktrees
  includeReports?: boolean;        // Clean work reports
  includeFeedback?: boolean;       // Clean feedback files
}
```

**Returns:**
```typescript
interface TempFileCleanupResult {
  filesScanned: number;            // Total files examined
  filesRemoved: number;            // Files successfully deleted
  filesPreserved: number;          // Files kept (active/recent)
  spaceSaved: number;              // Disk space freed
  preservedFiles: string[];        // List of preserved files
  errors: string[];                // File removal failures
}
```

**Behavior:**
- Scans temporary file directories recursively
- Identifies files older than specified age
- Preserves files associated with active worktrees
- Reports detailed cleanup statistics

**Error Conditions:**
- `FileError('SCAN_FAILED')` - Cannot scan temp directories
- `FileError('REMOVAL_FAILED')` - Cannot delete temp files

---

### Data Preservation

#### preserveWorktreeData
```typescript
async function preserveWorktreeData(worktreePath: string, options: PreservationOptions): Promise<PreservationResult>
```

**Parameters:**
```typescript
interface PreservationOptions {
  preservationPath: string;        // Where to save preserved data
  includeGitHistory?: boolean;     // Preserve git commits
  includeTempFiles?: boolean;      // Preserve temp files
  includeWorkReports?: boolean;    // Preserve work reports
  includeFeedback?: boolean;       // Preserve feedback documents
  createArchive?: boolean;         // Create compressed archive
}
```

**Returns:**
```typescript
interface PreservationResult {
  dataPreserved: boolean;          // Data preservation succeeded
  preservedFiles: string[];        // List of preserved files
  archivePath?: string;            // Path to archive if created
  preservationSize: number;        // Size of preserved data
  errors: string[];                // Preservation failures
}
```

**Behavior:**
- Extracts valuable data from worktree before removal
- Copies files to permanent storage locations
- Creates archives for long-term storage
- Generates preservation metadata

**Error Conditions:**
- `PreservationError('TARGET_EXISTS')` - Preservation target already exists
- `FileError('COPY_FAILED')` - Cannot copy files to preservation location

---

## Workflow Integration

### Command Line Interface

#### CLI Entry Point
```typescript
// .claude/workflows/cleanup-worktree.ts
async function main(args: string[]): Promise<void>
```

**Usage Examples:**
```bash
# Clean current worktree (called by agents)
bun .claude/workflows/cleanup-worktree.ts --current

# Clean specific worktree
bun .claude/workflows/cleanup-worktree.ts --path ../task-123-agent-1-20241214

# Find and clean abandoned worktrees
bun .claude/workflows/cleanup-worktree.ts --abandoned --age 7

# Clean orphaned sessions
bun .claude/workflows/cleanup-worktree.ts --sessions

# Full system cleanup
bun .claude/workflows/cleanup-worktree.ts --all

# Dry run
bun .claude/workflows/cleanup-worktree.ts --abandoned --dry-run
```

**Command Line Options:**
```typescript
interface CleanupWorktreeOptions {
  current?: boolean;               // Clean current worktree
  path?: string;                   // Clean specific worktree path
  abandoned?: boolean;             // Find and clean abandoned worktrees
  sessions?: boolean;              // Clean orphaned tmux sessions
  tempFiles?: boolean;             // Clean temporary files
  all?: boolean;                   // Full system cleanup
  age?: number;                    // Age threshold for cleanup
  force?: boolean;                 // Override safety checks
  preserve?: boolean;              // Preserve data before cleanup
  dryRun?: boolean;                // Show what would be cleaned
}
```

### Integration with Agent Workflows

**Work Agent Usage:**
```typescript
// At end of work-on-task workflow
await cleanupCurrentWorktree({
  preserveWorkReport: true,
  sessionName: 'swarm-task-123'
});
```

**Review Agent Usage:**
```typescript
// At end of review-task workflow  
await cleanupCurrentWorktree({
  preserveFeedback: true,
  sessionName: 'swarm-review-123'
});
```

**Maintenance Usage:**
```bash
# Daily cleanup job
bun .claude/workflows/cleanup-worktree.ts --abandoned --age 3 --sessions --temp-files
```

## Error Handling

### Safety Mechanisms

**Data Protection:**
- Never remove worktrees with uncommitted changes by default
- Always preserve feedback and work reports
- Create backups before destructive operations
- Provide clear warnings about data loss

**Process Safety:**
- Check for active tmux sessions before worktree removal
- Validate that worktree is not current working directory
- Ensure no running processes in target worktree

**User Control:**
- Dry-run mode for preview
- Confirmation prompts for risky operations
- Force flags to override safety checks
- Detailed error reporting

### Error Recovery

**Partial Cleanup Recovery:**
- Continue cleanup even if individual operations fail
- Report which operations succeeded/failed
- Provide manual cleanup instructions for failures
- Allow retry of failed operations

**Data Recovery:**
- Archive data before removal when possible
- Provide restoration instructions
- Maintain cleanup logs for audit trail

## Testing Considerations

### Unit Tests
- Worktree detection and validation
- Session activity checking
- Temporary file age calculation
- Data preservation operations
- Safety check validation

### Integration Tests
- Full cleanup workflow execution
- Agent integration (cleanup-after-work)
- Cross-platform compatibility
- Large-scale cleanup operations
- Error scenarios and recovery

### Test Scenarios
- Cleanup from within target worktree
- Cleanup of active vs inactive worktrees
- Preservation of important data
- Handling of permission errors
- Network-mounted worktree cleanup

## Configuration Options

### Cleanup Policies

**Conservative (Default):**
- Preserve all work reports and feedback
- Skip worktrees with any uncommitted changes
- Require confirmation for all removals
- Never force-kill active sessions

**Maintenance:**
- Clean worktrees older than 7 days
- Preserve only critical data
- Minimal confirmations
- Clean orphaned sessions automatically

**Aggressive:**
- Clean all completed worktrees
- Minimal data preservation
- Force cleanup when safe
- Automated cleanup scheduling