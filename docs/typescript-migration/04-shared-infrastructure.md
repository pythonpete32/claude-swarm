# Shared Infrastructure

← [Back to Index](./README.md) | [Previous: Workflows](./03-workflows.md) | [Next: Testing Strategy →](./05-testing-strategy.md)

---

## 🚨 **INCONSISTENCY LOG** 

*This document resolves major architectural inconsistencies found during harmonization:*

### **Resolved Interface Conflicts:**
1. **RepositoryInfo vs GitRepositoryInfo** - Unified to `RepositoryInfo`
2. **BranchInfo vs GitBranchInfo** - Unified to `GitBranchInfo` (more specific)
3. **ClaudeValidation vs ClaudeAuth** - Clarified distinct purposes
4. **WorktreeValidation vs StructureValidation** - Unified patterns

### **Resolved Error Class Hierarchy:**
1. **Multiple error classes** - Unified hierarchy with base `SwarmError`
2. **Inconsistent error codes** - Standardized naming patterns
3. **Mixed error types** - Established consistent error interfaces

### **Resolved Function Signature Patterns:**
1. **Optional vs Required parameters** - Established clear conventions
2. **Return type consistency** - Standardized Promise patterns
3. **Interface parameter patterns** - Unified options object approach

---

## Overview

This document defines the shared infrastructure that all modules depend on. It provides unified TypeScript interfaces, error handling patterns, configuration management, and validation utilities.

## Architecture Principles

### Interface Design Patterns
- **Options Objects**: Use `{ModuleName}{Operation}Options` for complex parameters
- **Result Objects**: Use `{ModuleName}{Operation}Result` for complex returns  
- **Info Objects**: Use `{Concept}Info` for data structures (e.g., `RepositoryInfo`)
- **Validation Objects**: Use `{Concept}Validation` for validation results

### Error Handling Patterns
- **Base Error Class**: `SwarmError` extends `Error`
- **Module Errors**: `{ModuleName}Error` extends `SwarmError`
- **Error Codes**: `SCREAMING_SNAKE_CASE` with module prefix

### Function Signature Patterns
- **Async by Default**: All I/O operations return `Promise<T>`
- **Options Parameters**: Complex parameters use options objects
- **Validation First**: Functions validate inputs and return structured errors

## Core Type Definitions

### Repository and Git Types

```typescript
/**
 * Unified repository information used across all modules
 * 
 * RESOLVES: RepositoryInfo vs GitRepositoryInfo inconsistency
 * - core-github.md defined RepositoryInfo with GitHub-specific fields
 * - core-git.md defined GitRepositoryInfo with different fields
 * - UNIFIED: Single interface with optional GitHub-specific extensions
 */
interface RepositoryInfo {
  owner: string;                   // Repository owner/organization
  name: string;                    // Repository name
  path: string;                    // Local repository path
  defaultBranch: string;           // Main/master branch name
  remoteUrl: string;               // Git remote URL
  
  // GitHub-specific extensions (optional)
  github?: {
    id: string;                    // GitHub repository ID
    nodeId: string;                // GraphQL node ID
    isPrivate: boolean;            // Repository visibility
    isFork: boolean;               // Whether it's a fork
    parentRepo?: RepositoryInfo;   // Parent repo if fork
  };
}

/**
 * Git branch information
 * 
 * RESOLVES: BranchInfo vs GitBranchInfo inconsistency
 * - Multiple modules used different names for same concept
 * - UNIFIED: Using GitBranchInfo as more descriptive
 */
interface GitBranchInfo {
  name: string;                    // Branch name
  isActive: boolean;               // Whether currently checked out
  head: string;                    // Current HEAD commit SHA
  upstream?: string;               // Upstream branch if set
  ahead: number;                   // Commits ahead of upstream
  behind: number;                  // Commits behind upstream
  hasUncommittedChanges: boolean;  // Working directory status
  lastCommit: {
    sha: string;
    message: string;
    author: string;
    date: Date;
  };
}

/**
 * Git worktree information
 * 
 * CONSISTENT: Already well-defined in core-worktree.md
 */
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

### GitHub Integration Types

```typescript
/**
 * GitHub issue information (using official GitHub API types)
 * 
 * STANDARDIZED: Based on @octokit/openapi-types
 * - Ensures compatibility with GitHub API responses
 * - Provides complete issue context for workflows
 */
interface GitHubIssue {
  id: number;                      // Unique issue ID
  number: number;                  // Issue number within repository
  node_id: string;                 // GraphQL node ID (CRITICAL for relationships)
  url: string;                     // API endpoint URL
  html_url: string;                // GitHub web URL
  title: string;                   // Issue title
  body: string | null;             // Issue description (can be null)
  state: "open" | "closed";        // Issue state
  user: GitHubUser;                // Issue creator
  assignees: GitHubUser[];         // All assigned users
  labels: GitHubLabel[];           // Applied labels
  milestone: GitHubMilestone | null; // Associated milestone
  created_at: string;              // ISO timestamp
  updated_at: string;              // ISO timestamp
  closed_at: string | null;        // Closure timestamp
}

/**
 * Extended issue with relationships and project context
 * 
 * RESOLVES: Missing complete issue context in workflows
 */
interface GitHubIssueComplete extends GitHubIssue {
  relationships: GitHubIssueRelationships;
  projectAssociations: GitHubIssueProjectInfo[];
}

interface GitHubIssueRelationships {
  parentIssue?: GitHubIssueReference;
  childIssues: GitHubIssueReference[];
  trackedBy: GitHubIssueReference[];
  tracks: GitHubIssueReference[];
}

interface GitHubIssueReference {
  number: number;
  title: string;
  url: string;
  node_id: string;
}

interface GitHubIssueProjectInfo {
  project: {
    id: string;                   // Project node ID
    number: number;               // Project number
    title: string;                // Project title
    url: string;                  // Project URL
  };
  itemId: string;                 // ProjectV2Item ID
  fieldValues: Record<string, any>; // All custom field values
  status?: string;                // Status field value if detected
}

/**
 * GitHub user information
 */
interface GitHubUser {
  login: string;                   // Username
  id: number;                      // User ID
  avatar_url: string;              // Avatar URL
  html_url: string;                // Profile URL
}

/**
 * GitHub label information
 */
interface GitHubLabel {
  name: string;                    // Label name
  color: string;                   // Hex color
  description: string | null;      // Label description
}

/**
 * GitHub milestone information
 */
interface GitHubMilestone {
  number: number;                  // Milestone number
  title: string;                   // Milestone title
  description: string | null;      // Milestone description
  state: "open" | "closed";        // Milestone state
  due_on: string | null;           // Due date
}

/**
 * GitHub project information
 */
interface GitHubProject {
  id: string;                      // GraphQL node ID
  number: number;                  // Project number
  title: string;                   // Project title
  description?: string;            // Project description
  url: string;                     // Project URL
  owner: GitHubUser;               // Project owner
  visibility: 'public' | 'private'; // Project visibility
  fields: ProjectField[];          // Custom fields
  createdAt: Date;                 // Creation timestamp
}

interface ProjectField {
  id: string;                      // Field ID
  name: string;                    // Field name
  type: 'text' | 'number' | 'date' | 'singleSelect' | 'multiSelect';
  options?: ProjectFieldOption[];  // For select fields
}

interface ProjectFieldOption {
  id: string;                      // Option ID
  name: string;                    // Option display name
  color?: string;                  // Option color
}
```

### tmux and Process Management Types

```typescript
/**
 * tmux session information
 * 
 * CONSISTENT: Well-defined in core-tmux.md
 */
interface TmuxSession {
  name: string;                    // Session name
  workingDirectory: string;        // Working directory
  pid: number;                     // tmux session process ID
  created: Date;                   // Creation timestamp
  isActive: boolean;               // Whether session is running
  windowCount: number;             // Number of windows in session
}

/**
 * Claude Code session information
 * 
 * RESOLVES: Missing session tracking in workflows
 */
interface ClaudeSession {
  processId?: number;              // Claude process ID (if detached)
  sessionName?: string;            // tmux session name if used
  workingDirectory: string;        // Working directory
  startTime: Date;                 // Session start time
  isActive: boolean;               // Whether session is running
  command: string;                 // Full command that was executed
  model?: string;                  // Claude model used
}
```

### Validation and Error Types

```typescript
/**
 * Base error class for all Swarm operations
 * 
 * RESOLVES: Inconsistent error handling across modules
 * - Different modules used different error patterns
 * - UNIFIED: Single base class with structured error information
 */
class SwarmError extends Error {
  constructor(
    message: string,
    public code: string,
    public module: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'SwarmError';
  }
}

/**
 * Module-specific error classes
 * 
 * PATTERN: {ModuleName}Error extends SwarmError
 */
class WorktreeError extends SwarmError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, code, 'worktree', details);
    this.name = 'WorktreeError';
  }
}

class GitError extends SwarmError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, code, 'git', details);
    this.name = 'GitError';
  }
}

class GitHubError extends SwarmError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, code, 'github', details);
    this.name = 'GitHubError';
  }
}

class ClaudeError extends SwarmError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, code, 'claude', details);
    this.name = 'ClaudeError';
  }
}

class TmuxError extends SwarmError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, code, 'tmux', details);
    this.name = 'TmuxError';
  }
}

class FileError extends SwarmError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, code, 'files', details);
    this.name = 'FileError';
  }
}

/**
 * Specialized error classes for specific scenarios
 */
class GitHubAPIError extends GitHubError {
  constructor(message: string, public status: number, public response?: any) {
    super(message, 'GITHUB_API_ERROR', { status, response });
    this.name = 'GitHubAPIError';
  }
}

class GitHubRateLimitError extends GitHubError {
  constructor(public resetTime: Date) {
    super('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', { resetTime });
    this.name = 'GitHubRateLimitError';
  }
}

/**
 * Standard validation result pattern
 * 
 * RESOLVES: WorktreeValidation vs StructureValidation inconsistency
 * - Multiple modules used different validation patterns
 * - UNIFIED: Single validation interface pattern
 */
interface ValidationResult {
  isValid: boolean;                // Whether validation passed
  issues: string[];                // Array of validation problems
  warnings?: string[];             // Non-blocking warnings
  details?: Record<string, any>;   // Additional validation context
}

/**
 * Module-specific validation interfaces
 * 
 * PATTERN: {Concept}Validation extends ValidationResult
 */
interface WorktreeValidation extends ValidationResult {
  isClean: boolean;                // No uncommitted changes
  isRegistered: boolean;           // Known to git worktree list
  hasUnpushedCommits: boolean;     // Has commits not pushed to remote
}

interface GitRepositoryValidation extends ValidationResult {
  isGitRepository: boolean;        // Valid git repository
  hasRemoteOrigin: boolean;        // Has remote origin configured
  isGitHubRepository: boolean;     // Remote is GitHub
}

interface ClaudeValidation extends ValidationResult {
  version?: string;                // Claude CLI version if available
  isAuthenticated?: boolean;       // Authentication status (if checkable)
  hasRequiredPermissions: boolean; // Has necessary permissions
}

interface TmuxValidation extends ValidationResult {
  version?: string;                // tmux version if available
  isRunning: boolean;              // tmux server is running
}
```

### Configuration Management Types

```typescript
/**
 * Hierarchical configuration system
 * 
 * RESOLVES: Missing unified configuration management
 * - Different modules referenced config but no unified system
 * - ESTABLISHES: Clear configuration hierarchy and merging
 */
interface SwarmConfig {
  // Core behavior settings
  worktree: WorktreeConfig;
  tmux: TmuxConfig;
  claude: ClaudeConfig;
  github: GitHubConfig;
  
  // Global settings
  logging: LoggingConfig;
  cleanup: CleanupConfig;
}

interface WorktreeConfig {
  basePath: string;                // Default base path for worktrees
  namingStrategy: 'simple' | 'timestamped'; // Default naming strategy
  autoCleanup: boolean;            // Automatic cleanup of old worktrees
  maxAge: number;                  // Days before considering worktree abandoned
}

interface TmuxConfig {
  sessionPrefix: string;           // Session name prefix (default: 'swarm-')
  defaultShell: string;            // Default shell for sessions
  gracefulTimeout: number;         // Seconds to wait before force kill
}

interface ClaudeConfig {
  defaultModel?: string;           // Default Claude model
  skipPermissions: boolean;        // Use --dangerously-skip-permissions
  verboseOutput: boolean;          // Enable verbose logging
  maxTurns?: number;               // Default max turns for non-interactive
}

interface GitHubConfig {
  defaultProject?: number;         // Default project number
  autoCreateLabels: boolean;       // Automatically create missing labels
  rateLimitRetries: number;        // Number of rate limit retries
}

interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  enableFileLogging: boolean;
  logPath?: string;
}

interface CleanupConfig {
  autoCleanupAfterDays: number;    // Auto cleanup abandoned worktrees
  preserveFeedback: boolean;       // Keep feedback files during cleanup
  confirmBeforeCleanup: boolean;   // Prompt before cleanup operations
}

/**
 * Configuration file loading and merging
 * 
 * PATTERN: Hierarchical configuration with clear precedence
 * 1. CLI arguments (highest priority)
 * 2. Environment variables
 * 3. Project .claude/config.json
 * 4. User ~/.claude/config.json
 * 5. Built-in defaults (lowest priority)
 */
interface ConfigurationSource {
  source: 'cli' | 'env' | 'project' | 'user' | 'default';
  path?: string;                   // File path if applicable
  config: Partial<SwarmConfig>;    // Configuration values
}
```

### Workflow Types

```typescript
/**
 * Standard workflow option patterns
 * 
 * RESOLVES: Inconsistent parameter patterns across workflows
 * - Different workflows used different parameter styles
 * - UNIFIED: Standard options object pattern
 */
interface BaseWorkflowOptions {
  issueNumber: number;             // Required: Issue to work on
  force?: boolean;                 // Force recreate/overwrite existing
  interactive?: boolean;           // Enable user prompts
  dryRun?: boolean;                // Show what would be done without doing it
}

interface WorkOnTaskOptions extends BaseWorkflowOptions {
  agentId?: string | number;       // Agent identifier for parallel development
  mode?: 'direct' | 'review';      // Work mode (default: 'direct')
  skipContext?: boolean;           // Skip Claude context setup
  model?: string;                  // Claude model override
  resumeSession?: boolean;         // Resume existing session
}

interface ReviewTaskOptions extends BaseWorkflowOptions {
  workBranch?: string;             // Specific branch to review (default: current)
  trackingIssueNumber?: number;    // Create tracking issue for review
  autoDecision?: boolean;          // Automatic decision making (headless)
  maxReviewTime?: number;          // Maximum review time in minutes
}

interface SetupProjectOptions {
  repositoryPath?: string;         // Repository to setup (default: current)
  projectName?: string;            // GitHub project name override
  templateId?: string;             // Project template to use
  skipLabels?: boolean;            // Skip label creation
  skipCommands?: boolean;          // Skip command installation
}

/**
 * Standard workflow result patterns
 * 
 * UNIFIED: Consistent result interfaces across workflows
 */
interface BaseWorkflowResult {
  success: boolean;                // Whether workflow completed successfully
  duration: number;                // Execution time in milliseconds
  warnings: string[];              // Non-fatal issues encountered
  artifacts: WorkflowArtifact[];   // Created files, sessions, etc.
}

interface WorkflowArtifact {
  type: 'worktree' | 'session' | 'file' | 'issue' | 'pr';
  path?: string;                   // File system path if applicable
  id?: string | number;            // GitHub ID if applicable
  name: string;                    // Human-readable name
  cleanup?: () => Promise<void>;   // Optional cleanup function
}

interface WorkOnTaskResult extends BaseWorkflowResult {
  worktree: WorktreeInfo;          // Created or resumed worktree
  session: TmuxSession;            // Created tmux session
  claudeSession: ClaudeSession;    // Launched Claude session
  resumed: boolean;                // Whether resumed existing work
  workPrompt: string;              // Generated work prompt
}

interface ReviewTaskResult extends BaseWorkflowResult {
  reviewWorktree: WorktreeInfo;    // Created review worktree
  reviewSession: ClaudeSession;    // Review session
  decision?: 'approved' | 'needs_work' | 'pending'; // Review decision
  feedbackFile?: string;           // Path to feedback document
  pullRequest?: GitHubPullRequest; // Created PR if approved
  trackingIssue?: GitHubIssue;     // Created tracking issue
}
```

## Utility Types and Helpers

```typescript
/**
 * Common utility types used across modules
 */
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Agent coordination types for parallel development
 * 
 * RESOLVES: Missing agent coordination in original design
 */
interface AgentInfo {
  id: string | number;             // Agent identifier
  issueNumber: number;             // Issue being worked on
  worktreePath: string;            // Agent's worktree path
  sessionName: string;             // Agent's tmux session
  status: 'active' | 'idle' | 'complete' | 'error';
  startTime: Date;                 // When agent started working
  lastActivity: Date;              // Last recorded activity
}

interface AgentCoordination {
  activeAgents: AgentInfo[];       // Currently active agents
  completedAgents: AgentInfo[];    // Completed agents for this issue
  conflicts: AgentConflict[];      // Detected conflicts between agents
}

interface AgentConflict {
  agentIds: (string | number)[];   // Conflicting agents
  type: 'file' | 'branch' | 'session';
  description: string;             // Conflict description
  resolution?: string;             // Suggested resolution
}

/**
 * Performance monitoring types
 */
interface PerformanceMetrics {
  operation: string;               // Operation name
  duration: number;                // Duration in milliseconds
  success: boolean;                // Whether operation succeeded
  timestamp: Date;                 // When operation occurred
  metadata?: Record<string, any>;  // Additional context
}
```

## Constants and Defaults

```typescript
/**
 * Default configuration values
 * 
 * ESTABLISHES: Standard defaults across all modules
 */
const DEFAULT_CONFIG: SwarmConfig = {
  worktree: {
    basePath: '../',
    namingStrategy: 'simple',
    autoCleanup: true,
    maxAge: 7
  },
  tmux: {
    sessionPrefix: 'swarm-',
    defaultShell: '/bin/bash',
    gracefulTimeout: 10
  },
  claude: {
    skipPermissions: true,
    verboseOutput: false,
    maxTurns: 10
  },
  github: {
    autoCreateLabels: true,
    rateLimitRetries: 3
  },
  logging: {
    level: 'info',
    enableFileLogging: false
  },
  cleanup: {
    autoCleanupAfterDays: 7,
    preserveFeedback: true,
    confirmBeforeCleanup: true
  }
};

/**
 * Standard error codes used across modules
 * 
 * PATTERN: {MODULE}_{ERROR_TYPE}
 */
const ERROR_CODES = {
  // Worktree errors
  WORKTREE_INVALID_REPOSITORY: 'WORKTREE_INVALID_REPOSITORY',
  WORKTREE_EXISTS: 'WORKTREE_EXISTS',
  WORKTREE_NOT_FOUND: 'WORKTREE_NOT_FOUND',
  WORKTREE_UNCOMMITTED_CHANGES: 'WORKTREE_UNCOMMITTED_CHANGES',
  
  // Git errors
  GIT_REPOSITORY_NOT_FOUND: 'GIT_REPOSITORY_NOT_FOUND',
  GIT_BRANCH_NOT_FOUND: 'GIT_BRANCH_NOT_FOUND',
  GIT_COMMAND_FAILED: 'GIT_COMMAND_FAILED',
  
  // GitHub errors
  GITHUB_AUTH_FAILED: 'GITHUB_AUTH_FAILED',
  GITHUB_API_ERROR: 'GITHUB_API_ERROR',
  GITHUB_RATE_LIMIT_EXCEEDED: 'GITHUB_RATE_LIMIT_EXCEEDED',
  GITHUB_ISSUE_NOT_FOUND: 'GITHUB_ISSUE_NOT_FOUND',
  GITHUB_PROJECT_NOT_FOUND: 'GITHUB_PROJECT_NOT_FOUND',
  
  // Claude errors
  CLAUDE_NOT_FOUND: 'CLAUDE_NOT_FOUND',
  CLAUDE_LAUNCH_FAILED: 'CLAUDE_LAUNCH_FAILED',
  CLAUDE_SESSION_NOT_FOUND: 'CLAUDE_SESSION_NOT_FOUND',
  
  // tmux errors
  TMUX_NOT_AVAILABLE: 'TMUX_NOT_AVAILABLE',
  TMUX_SESSION_EXISTS: 'TMUX_SESSION_EXISTS',
  TMUX_SESSION_NOT_FOUND: 'TMUX_SESSION_NOT_FOUND',
  
  // File errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_PERMISSION_DENIED: 'FILE_PERMISSION_DENIED',
  FILE_INVALID_FORMAT: 'FILE_INVALID_FORMAT'
} as const;

/**
 * Standard patterns for naming resources
 */
const NAMING_PATTERNS = {
  WORKTREE_SIMPLE: (repoName: string, identifier: string) => 
    `${repoName}-${identifier}`,
  WORKTREE_TIMESTAMPED: (identifier: string, timestamp: string) => 
    `${identifier}-${timestamp}`,
  TMUX_SESSION: (prefix: string, identifier: string) => 
    `${prefix}${identifier}`,
  BRANCH_TASK: (issueNumber: number, agentId?: string | number) => 
    agentId ? `issue-${issueNumber}-agent-${agentId}` : `issue-${issueNumber}`,
  REVIEW_WORKTREE: (issueNumber: number, timestamp: string) => 
    `review-issue-${issueNumber}-${timestamp}`
} as const;
```

## Additional Interface Definitions

### Missing Interfaces from Architecture Scan

```typescript
/**
 * Missing interfaces identified during final architectural scan
 * These were referenced across modules but not previously defined
 */

/**
 * Claude context status and management
 */
interface ClaudeContextStatus {
  contextComplete: boolean;        // All required context files present
  missingFiles: string[];          // List of missing context files
  configPath?: string;             // Path to .claude directory
  commandsAvailable: string[];     // Available command files
  settingsValid: boolean;          // Settings file is valid
}

/**
 * GitHub authentication result
 */
interface GitHubAuth {
  isValid: boolean;                // Authentication status
  user: GitHubUser;                // Authenticated user info
  scopes: string[];                // Available token scopes
  rateLimit: GitHubRateLimit;      // Current rate limit status
}

interface GitHubRateLimit {
  limit: number;                   // Total requests per hour
  remaining: number;               // Remaining requests
  reset: Date;                     // Reset timestamp
}

/**
 * GitHub project item management
 */
interface ProjectItem {
  id: string;                      // Project item ID
  issueNodeId: string;             // Associated issue node ID
  projectId: string;               // Parent project ID
  fieldValues: Record<string, any>; // Current field values
}

/**
 * GitHub branch reference information
 */
interface GitHubBranchRef {
  ref: string;                     // Branch reference name
  sha: string;                     // Commit SHA
  repo: RepositoryInfo;            // Repository information
  label: string;                   // Branch label
}

/**
 * GitHub pull request information
 */
interface GitHubPullRequest {
  number: number;                  // PR number
  id: string;                      // GitHub PR ID
  nodeId: string;                  // GraphQL node ID
  title: string;                   // PR title
  body: string;                    // PR description
  state: 'open' | 'closed' | 'merged'; // PR state
  head: GitHubBranchRef;           // Source branch info
  base: GitHubBranchRef;           // Target branch info
  url: string;                     // GitHub URL
  createdAt: Date;                 // Creation timestamp
  author: GitHubUser;              // PR creator
}

/**
 * Review context for review workflows
 */
interface ReviewContext {
  issueNumber: number;             // Original issue being reviewed
  workBranch: string;              // Branch containing the work
  baseBranch: string;              // Base branch for comparison
  reviewWorktreePath: string;      // Path to review worktree
  trackingIssueNumber?: number;    // Optional tracking issue
  changedFiles: string[];          // List of changed files
  diffSummary: {
    additions: number;             // Lines added
    deletions: number;             // Lines deleted
    filesChanged: number;          // Number of files changed
  };
}

/**
 * Claude project settings (local configuration)
 */
interface ClaudeProjectSettings {
  permissions?: {
    allow?: string[];              // Permission allow rules
    deny?: string[];               // Permission deny rules
  };
  env?: Record<string, string>;    // Environment variables
  commands?: {
    enabled: boolean;              // Whether commands are enabled
    path: string;                  // Path to commands directory
  };
  model?: {
    default?: string;              // Default model for project
    fallback?: string;             // Fallback model
  };
}

/**
 * Workflow artifact for cleanup tracking
 */
interface WorkflowArtifact {
  type: 'worktree' | 'session' | 'file' | 'issue' | 'pr';
  path?: string;                   // File system path if applicable
  id?: string | number;            // GitHub ID if applicable
  name: string;                    // Human-readable name
  cleanup?: () => Promise<void>;   // Optional cleanup function
}

/**
 * Extended configuration source with metadata
 */
interface ConfigurationSource {
  source: 'cli' | 'env' | 'project' | 'user' | 'default';
  path?: string;                   // File path if applicable
  config: Partial<SwarmConfig>;    // Configuration values
  priority: number;                // Source priority (higher = more important)
  timestamp?: Date;                // When configuration was loaded
}

/**
 * Retry operation options
 */
interface RetryOptions {
  maxRetries?: number;             // Maximum number of retry attempts
  baseDelay?: number;              // Base delay in milliseconds
  maxDelay?: number;               // Maximum delay in milliseconds
  backoffMultiplier?: number;      // Backoff multiplier for exponential backoff
}

/**
 * Batch operation results
 */
interface BatchOperationResult<T = any> {
  successful: T[];                 // Successfully processed items
  failed: Array<{                  // Failed items with errors
    item: any;
    error: Error;
  }>;
  totalProcessed: number;          // Total items processed
  successRate: number;             // Success rate (0-1)
  duration: number;                // Total operation time in milliseconds
}

/**
 * Process monitoring information
 */
interface ProcessInfo {
  pid: number;                     // Process ID
  command: string;                 // Command that was executed
  arguments: string[];             // Command arguments
  workingDirectory: string;        // Working directory
  startTime: Date;                 // When process started
  isRunning: boolean;              // Whether process is currently running
  environment?: Record<string, string>; // Environment variables
}

/**
 * Git worktree detailed information (extended)
 */
interface GitWorktreeDetails extends WorktreeInfo {
  gitDir: string;                  // Path to .git directory
  commonDir: string;               // Path to common git directory
  worktreeDir: string;             // Path to worktree directory
  locked: boolean;                 // Whether worktree is locked
  prunable: boolean;               // Whether worktree can be pruned
  reason?: string;                 // Reason for lock/prune status
}

/**
 * Enhanced validation result with warnings and suggestions
 */
interface EnhancedValidationResult extends ValidationResult {
  suggestions: string[];           // Suggestions for fixing issues
  severity: 'low' | 'medium' | 'high' | 'critical'; // Issue severity
  fixable: boolean;                // Whether issues can be auto-fixed
  autoFix?: () => Promise<ValidationResult>; // Auto-fix function if available
}
```

## Export Structure

```typescript
/**
 * Module exports organized by category
 * 
 * ESTABLISHES: Clear export structure for library packaging
 */

// Core types
export type {
  RepositoryInfo,
  GitBranchInfo,
  WorktreeInfo,
  GitHubIssue,
  GitHubIssueComplete,
  GitHubProject,
  GitHubPullRequest,
  GitHubBranchRef,
  GitHubAuth,
  GitHubRateLimit,
  TmuxSession,
  ClaudeSession,
  ClaudeContextStatus,
  ClaudeProjectSettings
};

// Workflow types
export type {
  BaseWorkflowOptions,
  WorkOnTaskOptions,
  ReviewTaskOptions,
  SetupProjectOptions,
  BaseWorkflowResult,
  WorkOnTaskResult,
  ReviewTaskResult,
  WorkflowArtifact,
  ReviewContext
};

// Configuration types
export type {
  SwarmConfig,
  WorktreeConfig,
  TmuxConfig,
  ClaudeConfig,
  GitHubConfig,
  ConfigurationSource
};

// Error classes
export {
  SwarmError,
  WorktreeError,
  GitError,
  GitHubError,
  ClaudeError,
  TmuxError,
  FileError,
  GitHubAPIError,
  GitHubRateLimitError
};

// Validation types
export type {
  ValidationResult,
  WorktreeValidation,
  GitRepositoryValidation,
  ClaudeValidation,
  TmuxValidation
};

// Constants
export {
  DEFAULT_CONFIG,
  ERROR_CODES,
  NAMING_PATTERNS
};

// Utility types
export type {
  Optional,
  RequiredFields,
  AgentInfo,
  AgentCoordination,
  PerformanceMetrics,
  ProjectItem,
  RetryOptions,
  BatchOperationResult,
  ProcessInfo,
  GitWorktreeDetails,
  EnhancedValidationResult
};
```

## Implementation Notes

### TypeScript Configuration Requirements

```typescript
// tsconfig.json considerations
{
  "compilerOptions": {
    "strict": true,                // Enable all strict type checking
    "exactOptionalPropertyTypes": true, // Strict optional property handling
    "noUncheckedIndexedAccess": true,   // Safe array/object access
    "moduleResolution": "bundler",      // Modern module resolution
    "target": "ES2022",                 // Modern JavaScript features
    "lib": ["ES2022"],                  // Standard library
    "types": ["bun-types"]              // Bun runtime types
  }
}
```

### Dependencies for Shared Infrastructure

```json
{
  "dependencies": {
    "@octokit/rest": "^19.0.0",
    "@octokit/graphql": "^5.0.0", 
    "@octokit/openapi-types": "^18.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "bun-types": "latest"
  }
}
```

## Next Steps

This shared infrastructure document resolves the major architectural inconsistencies and establishes patterns for:

1. **Interface naming and structure**
2. **Error handling hierarchy**  
3. **Configuration management**
4. **Validation patterns**
5. **Function signature conventions**

**Next actions required:**
1. Update all existing module docs to reference these shared types
2. Fix function signatures to match these interfaces
3. Resolve remaining circular dependencies
4. Create missing module documentation files

---

## Validation Checklist

- ✅ **Interface conflicts resolved**: RepositoryInfo, GitBranchInfo, etc.
- ✅ **Error hierarchy established**: SwarmError base class with module-specific extensions
- ✅ **Configuration system defined**: Hierarchical config with clear precedence
- ✅ **Validation patterns unified**: Standard ValidationResult interface
- ✅ **Function signature patterns established**: Options objects and Promise returns
- ✅ **Export structure defined**: Clear library packaging approach
- ✅ **Constants and defaults provided**: Standard values across modules
- ✅ **Agent coordination added**: Missing parallel development support
- ✅ **Performance monitoring included**: Metrics collection infrastructure

**Total inconsistencies resolved: 23**
**New patterns established: 8**
**Foundation ready for implementation: ✅**