# Error Handling Strategy

← [Back to Index](./README.md) | [Previous: Configuration](./06-configuration.md) | [Next: Library Export →](./08-library-export.md)

## Overview

Claude Swarm implements a comprehensive error handling strategy that provides consistent, recoverable, and informative error management across all modules and workflows. The system is built on a hierarchical error class structure with standardized error codes and recovery patterns.

## Error Handling Philosophy

### 1. **Fail Fast with Context**
- Detect errors as early as possible
- Provide maximum context about what went wrong
- Include suggestions for resolution when possible

### 2. **Graceful Degradation**
- Attempt recovery when safe to do so
- Fall back to simpler functionality when complex features fail
- Preserve user work and provide cleanup on failures

### 3. **Consistent Error Interface**
- All errors follow the same structure and patterns
- Error codes are standardized and documented
- Error messages are human-readable and actionable

## Error Class Hierarchy

### Base Error Class

```typescript
// shared/errors.ts
class SwarmError extends Error {
  constructor(
    message: string,
    public code: string,
    public module: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'SwarmError';
    Error.captureStackTrace(this, SwarmError);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      module: this.module,
      details: this.details,
      stack: this.stack
    };
  }
}
```

### Module-Specific Error Classes

#### **WorktreeError**
```typescript
class WorktreeError extends SwarmError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, code, 'worktree', details);
    this.name = 'WorktreeError';
  }
}

// Usage example
throw new WorktreeError(
  'Worktree already exists at path',
  'WORKTREE_EXISTS',
  { path: '/path/to/worktree', branch: 'feature-branch' }
);
```

#### **GitHubError**  
```typescript
class GitHubError extends SwarmError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, code, 'github', details);
    this.name = 'GitHubError';
  }
}

// Specialized GitHub API errors
class GitHubAPIError extends GitHubError {
  constructor(message: string, public status: number, public response?: any) {
    super(message, 'GITHUB_API_ERROR', { status, response });
    this.name = 'GitHubAPIError';
  }
}

class GitHubRateLimitError extends GitHubError {
  constructor(public resetTime: Date) {
    super('Rate limit exceeded', 'GITHUB_RATE_LIMIT_EXCEEDED', { resetTime });
    this.name = 'GitHubRateLimitError';
  }
}
```

#### **ClaudeError**
```typescript
class ClaudeError extends SwarmError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, code, 'claude', details);
    this.name = 'ClaudeError';
  }
}
```

#### **TmuxError**
```typescript
class TmuxError extends SwarmError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, code, 'tmux', details);
    this.name = 'TmuxError';
  }
}
```

#### **GitError**
```typescript
class GitError extends SwarmError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, code, 'git', details);
    this.name = 'GitError';
  }
}
```

#### **FileError**
```typescript
class FileError extends SwarmError {
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message, code, 'files', details);
    this.name = 'FileError';
  }
}
```

## Standardized Error Codes

### Error Code Naming Convention
- **Pattern**: `{MODULE}_{ERROR_TYPE}`
- **Case**: `SCREAMING_SNAKE_CASE`
- **Consistency**: All codes follow this pattern without exception

### Complete Error Code Registry

```typescript
// shared/errors.ts
export const ERROR_CODES = {
  // Worktree errors
  WORKTREE_INVALID_REPOSITORY: 'WORKTREE_INVALID_REPOSITORY',
  WORKTREE_EXISTS: 'WORKTREE_EXISTS',
  WORKTREE_NOT_FOUND: 'WORKTREE_NOT_FOUND',
  WORKTREE_UNCOMMITTED_CHANGES: 'WORKTREE_UNCOMMITTED_CHANGES',
  WORKTREE_BRANCH_CHECKOUT_CONFLICT: 'WORKTREE_BRANCH_CHECKOUT_CONFLICT',
  WORKTREE_INVALID_SOURCE_BRANCH: 'WORKTREE_INVALID_SOURCE_BRANCH',
  WORKTREE_PERMISSION_DENIED: 'WORKTREE_PERMISSION_DENIED',
  WORKTREE_REMOVAL_FAILED: 'WORKTREE_REMOVAL_FAILED',
  
  // Git errors
  GIT_REPOSITORY_NOT_FOUND: 'GIT_REPOSITORY_NOT_FOUND',
  GIT_BRANCH_NOT_FOUND: 'GIT_BRANCH_NOT_FOUND',
  GIT_COMMAND_FAILED: 'GIT_COMMAND_FAILED',
  GIT_INVALID_REMOTE_URL: 'GIT_INVALID_REMOTE_URL',
  GIT_UNCOMMITTED_CHANGES: 'GIT_UNCOMMITTED_CHANGES',
  
  // GitHub errors
  GITHUB_AUTH_FAILED: 'GITHUB_AUTH_FAILED',
  GITHUB_API_ERROR: 'GITHUB_API_ERROR',
  GITHUB_RATE_LIMIT_EXCEEDED: 'GITHUB_RATE_LIMIT_EXCEEDED',
  GITHUB_ISSUE_NOT_FOUND: 'GITHUB_ISSUE_NOT_FOUND',
  GITHUB_PROJECT_NOT_FOUND: 'GITHUB_PROJECT_NOT_FOUND',
  GITHUB_NO_REMOTE_ORIGIN: 'GITHUB_NO_REMOTE_ORIGIN',
  GITHUB_INVALID_REMOTE_URL: 'GITHUB_INVALID_REMOTE_URL',
  GITHUB_REPOSITORY_NOT_FOUND: 'GITHUB_REPOSITORY_NOT_FOUND',
  GITHUB_PROJECT_CREATE_FAILED: 'GITHUB_PROJECT_CREATE_FAILED',
  GITHUB_INVALID_OWNER: 'GITHUB_INVALID_OWNER',
  GITHUB_PROJECT_EXISTS: 'GITHUB_PROJECT_EXISTS',
  GITHUB_PROJECT_ADD_FAILED: 'GITHUB_PROJECT_ADD_FAILED',
  GITHUB_FIELD_UPDATE_FAILED: 'GITHUB_FIELD_UPDATE_FAILED',
  GITHUB_ACCESS_DENIED: 'GITHUB_ACCESS_DENIED',
  GITHUB_INVALID_TOKEN: 'GITHUB_INVALID_TOKEN',
  GITHUB_INSUFFICIENT_SCOPES: 'GITHUB_INSUFFICIENT_SCOPES',
  
  // Claude errors
  CLAUDE_NOT_FOUND: 'CLAUDE_NOT_FOUND',
  CLAUDE_LAUNCH_FAILED: 'CLAUDE_LAUNCH_FAILED',
  CLAUDE_SESSION_NOT_FOUND: 'CLAUDE_SESSION_NOT_FOUND',
  CLAUDE_DIRECTORY_NOT_FOUND: 'CLAUDE_DIRECTORY_NOT_FOUND',
  CLAUDE_TMUX_SESSION_FAILED: 'CLAUDE_TMUX_SESSION_FAILED',
  CLAUDE_SEND_FAILED: 'CLAUDE_SEND_FAILED',
  
  // tmux errors
  TMUX_NOT_AVAILABLE: 'TMUX_NOT_AVAILABLE',
  TMUX_SESSION_EXISTS: 'TMUX_SESSION_EXISTS',
  TMUX_SESSION_NOT_FOUND: 'TMUX_SESSION_NOT_FOUND',
  TMUX_SESSION_INACTIVE: 'TMUX_SESSION_INACTIVE',
  TMUX_CREATION_FAILED: 'TMUX_CREATION_FAILED',
  TMUX_COMMAND_FAILED: 'TMUX_COMMAND_FAILED',
  TMUX_ATTACH_FAILED: 'TMUX_ATTACH_FAILED',
  TMUX_KILL_FAILED: 'TMUX_KILL_FAILED',
  TMUX_NO_TTY: 'TMUX_NO_TTY',
  TMUX_INVALID_DIRECTORY: 'TMUX_INVALID_DIRECTORY',
  
  // File errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_PERMISSION_DENIED: 'FILE_PERMISSION_DENIED',
  FILE_INVALID_FORMAT: 'FILE_INVALID_FORMAT',
  FILE_CONTEXT_INCOMPLETE: 'FILE_CONTEXT_INCOMPLETE',
  FILE_COPY_FAILED: 'FILE_COPY_FAILED',
  FILE_VALIDATION_FAILED: 'FILE_VALIDATION_FAILED'
} as const;

// Type-safe error code usage
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
```

## Error Recovery Patterns

### 1. **Automatic Retry Pattern**

```typescript
// Automatic retry with exponential backoff
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = options;
  
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain error types
      if (error instanceof GitHubError && error.code === 'GITHUB_AUTH_FAILED') {
        throw error;
      }
      
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// Usage example
const issue = await retryWithBackoff(
  () => getIssue(repoInfo, issueNumber),
  { maxRetries: 3, baseDelay: 1000 }
);
```

### 2. **Resource Cleanup Pattern**

```typescript
// Ensure cleanup happens even on failure
export async function withCleanup<T>(
  resource: () => Promise<any>,
  operation: (resource: any) => Promise<T>,
  cleanup: (resource: any) => Promise<void>
): Promise<T> {
  let resourceHandle: any;
  
  try {
    resourceHandle = await resource();
    return await operation(resourceHandle);
  } catch (error) {
    throw error;
  } finally {
    if (resourceHandle) {
      try {
        await cleanup(resourceHandle);
      } catch (cleanupError) {
        console.warn('Cleanup failed:', cleanupError);
      }
    }
  }
}

// Usage example
const result = await withCleanup(
  () => createTmuxSession({ name: 'temp-session' }),
  async (session) => {
    return await launchClaudeInteractive({ sessionName: session.name });
  },
  async (session) => {
    await killSession(session.name);
  }
);
```

### 3. **Graceful Degradation Pattern**

```typescript
// Fall back to simpler functionality on failure
export async function getIssueWithFallback(
  repoInfo: RepositoryInfo,
  issueNumber: number
): Promise<GitHubIssue> {
  try {
    // Try to get issue with full relationships and project context
    return await getIssueWithRelationships(repoInfo, issueNumber);
  } catch (error) {
    if (error instanceof GitHubError && error.code === 'GITHUB_PROJECT_NOT_FOUND') {
      console.warn('Project access failed, falling back to basic issue data');
      // Fall back to basic issue without project context
      return await getIssue(repoInfo, issueNumber);
    }
    throw error;
  }
}
```

### 4. **Validation and Early Exit Pattern**

```typescript
// Validate preconditions and fail fast
export async function createWorktreeWithValidation(
  options: CreateWorktreeOptions
): Promise<WorktreeInfo> {
  // Validate repository first
  const repoValidation = await validateRepository(options.repositoryPath);
  if (!repoValidation.isValid) {
    throw new WorktreeError(
      'Invalid git repository',
      'WORKTREE_INVALID_REPOSITORY',
      { path: options.repositoryPath, issues: repoValidation.issues }
    );
  }
  
  // Check if worktree already exists
  const existingWorktrees = await findWorktrees(options.name);
  if (existingWorktrees.length > 0 && !options.forceCreate) {
    throw new WorktreeError(
      'Worktree already exists',
      'WORKTREE_EXISTS',
      { existingPaths: existingWorktrees.map(w => w.path) }
    );
  }
  
  // Proceed with creation
  return await createWorktree(options);
}
```

## Error Context and Debugging

### Enhanced Error Information

```typescript
// Comprehensive error context
export function enhanceError(error: Error, context: ErrorContext): SwarmError {
  const enhanced = new SwarmError(
    error.message,
    error instanceof SwarmError ? error.code : 'UNKNOWN_ERROR',
    error instanceof SwarmError ? error.module : 'unknown',
    {
      originalError: error.name,
      context,
      timestamp: new Date().toISOString(),
      ...error instanceof SwarmError ? error.details : {}
    }
  );
  
  enhanced.stack = error.stack;
  return enhanced;
}

interface ErrorContext {
  operation: string;
  parameters?: Record<string, any>;
  environment?: {
    cwd: string;
    platform: string;
    nodeVersion: string;
  };
  userContext?: {
    repository?: RepositoryInfo;
    worktree?: WorktreeInfo;
    session?: string;
  };
}

// Usage example
try {
  await createWorktree(options);
} catch (error) {
  throw enhanceError(error, {
    operation: 'createWorktree',
    parameters: { ...options },
    environment: {
      cwd: process.cwd(),
      platform: process.platform,
      nodeVersion: process.version
    },
    userContext: {
      repository: currentRepo
    }
  });
}
```

### Error Logging and Monitoring

```typescript
// Structured error logging
export class ErrorLogger {
  private static logError(error: SwarmError, level: 'warn' | 'error' = 'error') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      module: error.module,
      code: error.code,
      message: error.message,
      details: error.details,
      stack: error.stack
    };
    
    console[level](JSON.stringify(logEntry, null, 2));
    
    // Send to external monitoring if configured
    if (process.env.ERROR_REPORTING_URL) {
      this.sendToMonitoring(logEntry);
    }
  }
  
  private static async sendToMonitoring(logEntry: any) {
    try {
      await fetch(process.env.ERROR_REPORTING_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry)
      });
    } catch (monitoringError) {
      console.warn('Failed to send error to monitoring:', monitoringError);
    }
  }
  
  static logAndThrow(error: SwarmError): never {
    this.logError(error);
    throw error;
  }
  
  static logAndContinue(error: SwarmError): void {
    this.logError(error, 'warn');
  }
}
```

## Workflow Error Handling

### Workflow-Level Error Recovery

```typescript
// workflows/work-on-task.ts
export async function workOnTask(options: WorkOnTaskOptions): Promise<WorkOnTaskResult> {
  let createdResources: WorkflowArtifact[] = [];
  
  try {
    // Step 1: Validate environment
    const repoInfo = await detectRepository();
    const issue = await getIssue(repoInfo, options.issueNumber);
    
    // Step 2: Create worktree
    const worktree = await createWorktree({
      name: `task-${options.issueNumber}`,
      agentId: options.agentId,
      sourceBranch: repoInfo.defaultBranch
    });
    createdResources.push({
      type: 'worktree',
      path: worktree.path,
      name: worktree.name,
      cleanup: () => removeWorktree(worktree.path)
    });
    
    // Step 3: Create tmux session
    const session = await createTmuxSession({
      name: `swarm-task-${options.issueNumber}`,
      workingDirectory: worktree.path
    });
    createdResources.push({
      type: 'session',
      name: session.name,
      cleanup: () => killSession(session.name)
    });
    
    // Step 4: Launch Claude
    const claudeSession = await launchClaudeInteractive({
      workingDirectory: worktree.path,
      sessionName: session.name,
      prompt: await generateWorkPrompt({ ...options, repositoryInfo: repoInfo })
    });
    
    return {
      success: true,
      duration: 0, // Calculate actual duration
      warnings: [],
      artifacts: createdResources,
      worktree,
      session,
      claudeSession,
      resumed: false,
      workPrompt: ''
    };
    
  } catch (error) {
    // Cleanup all created resources on failure
    await cleanupResources(createdResources);
    
    // Enhance error with workflow context
    throw enhanceError(error, {
      operation: 'workOnTask',
      parameters: options,
      userContext: {
        createdResources: createdResources.map(r => ({
          type: r.type,
          name: r.name,
          path: r.path
        }))
      }
    });
  }
}

async function cleanupResources(resources: WorkflowArtifact[]): Promise<void> {
  for (const resource of resources.reverse()) { // Cleanup in reverse order
    try {
      if (resource.cleanup) {
        await resource.cleanup();
      }
    } catch (cleanupError) {
      console.warn(`Failed to cleanup ${resource.type} ${resource.name}:`, cleanupError);
    }
  }
}
```

## User-Friendly Error Messages

### Error Message Templates

```typescript
// Error message formatting for user display
export const ERROR_MESSAGES = {
  WORKTREE_EXISTS: (details: any) => `
Worktree already exists at: ${details.path}

To resolve this:
• Use --force to recreate the worktree
• Or clean up with: bun cleanup-review ${details.branch}
• Or choose a different name
  `.trim(),
  
  GITHUB_AUTH_FAILED: () => `
GitHub authentication failed.

To resolve this:
• Run: gh auth login
• Ensure your token has 'repo' and 'project' scopes
• Check your internet connection
  `.trim(),
  
  CLAUDE_NOT_FOUND: () => `
Claude CLI not found in PATH.

To resolve this:
• Install Claude CLI from: https://claude.ai/code
• Ensure 'claude' command is in your PATH
• Restart your terminal after installation
  `.trim(),
  
  TMUX_NOT_AVAILABLE: () => `
tmux is not available.

To resolve this:
• Install tmux: brew install tmux (macOS) or apt-get install tmux (Ubuntu)
• Ensure tmux is in your PATH
• Check tmux is working: tmux --version
  `.trim()
};

export function formatErrorForUser(error: SwarmError): string {
  const template = ERROR_MESSAGES[error.code as keyof typeof ERROR_MESSAGES];
  if (template) {
    return template(error.details);
  }
  
  return `${error.message}\n\nError Code: ${error.code}\nModule: ${error.module}`;
}
```

### CLI Error Display

```typescript
// CLI error handling
export function handleCliError(error: Error): never {
  if (error instanceof SwarmError) {
    console.error(`❌ ${formatErrorForUser(error)}`);
    
    if (error.details) {
      console.error('\nError Details:', JSON.stringify(error.details, null, 2));
    }
    
    // Log full error for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('\nFull Error:', error);
    }
  } else {
    console.error(`❌ Unexpected error: ${error.message}`);
    console.error('\nFull Error:', error);
  }
  
  process.exit(1);
}
```

## Testing Error Scenarios

### Error Testing Strategy

```typescript
// tests/unit/error-handling.test.ts
describe('Error Handling', () => {
  describe('WorktreeError', () => {
    it('should throw WORKTREE_EXISTS for existing worktree', async () => {
      // Create a worktree first
      await createWorktree({ name: 'test-exists' });
      
      // Attempt to create the same worktree
      await expect(
        createWorktree({ name: 'test-exists' })
      ).rejects.toThrow(WorktreeError);
      
      await expect(
        createWorktree({ name: 'test-exists' })
      ).rejects.toMatchObject({
        code: 'WORKTREE_EXISTS',
        module: 'worktree'
      });
    });
  });
  
  describe('Error Recovery', () => {
    it('should retry GitHub API calls on rate limit', async () => {
      let attempts = 0;
      const mockApiCall = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new GitHubRateLimitError(new Date(Date.now() + 60000));
        }
        return { success: true };
      });
      
      const result = await retryWithBackoff(mockApiCall, {
        maxRetries: 3,
        baseDelay: 100
      });
      
      expect(result).toEqual({ success: true });
      expect(attempts).toBe(3);
    });
  });
});
```

## Performance and Monitoring

### Error Metrics Collection

```typescript
// Error metrics for monitoring and optimization
export class ErrorMetrics {
  private static metrics = new Map<string, number>();
  
  static recordError(error: SwarmError): void {
    const key = `${error.module}.${error.code}`;
    const count = this.metrics.get(key) || 0;
    this.metrics.set(key, count + 1);
  }
  
  static getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }
  
  static getMostCommonErrors(limit = 10): Array<{ error: string; count: number }> {
    return Array.from(this.metrics.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
}
```

This comprehensive error handling strategy ensures robust, recoverable, and user-friendly error management throughout the Claude Swarm system, with clear patterns for development, testing, and production use.