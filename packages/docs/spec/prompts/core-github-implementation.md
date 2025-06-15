# Core GitHub Integration Module Implementation Prompt

<instructions>
Implement the core-github module for the Claude Swarm TypeScript migration project using Test-Driven Development (TDD) methodology. This module provides GitHub API integration operations supporting repository management, issue handling, pull request automation, and collaborative development workflows across all Claude Swarm operations.

Build a robust, testable, and well-documented GitHub integration module that:
- Manages GitHub API authentication and rate limiting with retry logic
- Handles repository discovery, cloning, and synchronization operations
- Provides issue and pull request lifecycle management with automation
- Integrates seamlessly with Git operations and worktree management
- Follows the established error handling and configuration patterns
- Integrates with core-git for local Git operations and core-worktree for workspace management

Create the module at `src/core/github.ts` with comprehensive tests following TDD principles.

## Required Reading

Before implementation, review these specification files for context and integration requirements:

1. **Core Architecture**: `spec/prompts/core-files-implementation.md` - Reference implementation showing TDD methodology, error handling patterns, and testing structure that should be mirrored in this module.

2. **Related Core Modules**: 
   - `spec/core-git.md` - Git operations interface and patterns that core-github will depend on
   - `spec/core-worktree.md` - Worktree management patterns for GitHub workspace integration
   - `spec/core-claude.md` - Claude Code integration for AI-assisted development workflows

3. **Workflow Integration**:
   - `spec/workflows/work-on-task.md` - Primary consumer of GitHub issue and repository management
   - `spec/workflows/review-task.md` - Pull request creation and review automation
   - `spec/workflows/sync-repository.md` - Repository synchronization and branch management

4. **Shared Infrastructure**:
   - `src/shared/errors.ts` - Existing error codes and patterns (GITHUB_* codes already defined)
   - `src/shared/types.ts` - RepositoryInfo, GitBranchInfo interfaces with GitHub extensions
   - `src/shared/validation.ts` - CommonValidators for input validation

5. **Testing Reference**: 
   - `tests/unit/core/files.test.ts` - Comprehensive TDD test structure with Mock patterns
   - `tests/unit/core/worktree.test.ts` - Advanced dependency injection and mock testing patterns
   - `tests/fixtures/` - Test data patterns and mock repository structures

These specifications provide the context for proper integration with existing modules and adherence to established patterns.
</instructions>

<requirements>
Functional Requirements:
- `authenticateGitHub()` - Authenticate with GitHub API using tokens or device flow
- `getRepositoryInfo()` - Retrieve comprehensive repository information and metadata
- `cloneRepository()` - Clone GitHub repositories with authentication and configuration
- `createRepository()` - Create new repositories with templates and settings
- `listRepositoryIssues()` - Enumerate and filter repository issues with pagination
- `getIssueDetails()` - Get comprehensive issue information including comments and events
- `createIssue()` - Create new issues with labels, assignees, and templates
- `updateIssueStatus()` - Modify issue state, labels, assignees, and milestones
- `createPullRequest()` - Create pull requests with automation and validation
- `getPullRequestDetails()` - Retrieve PR information including reviews and checks
- `updatePullRequestStatus()` - Modify PR state and handle merging operations
- `searchRepositories()` - Search GitHub repositories with advanced filtering
- `checkRateLimit()` - Monitor API rate limits and implement backoff strategies
- `validateWebhookSignature()` - Verify GitHub webhook authenticity

Technical Requirements:
- TypeScript with strict type checking and 90%+ test coverage
- Use shared types from `@/shared/types` (RepositoryInfo with GitHub extensions)
- Use standardized error handling from `@/shared/errors`
- Use validation utilities from `@/shared/validation`
- Integrate with core-git for local repository operations
- Integrate with core-worktree for workspace management
- Support GitHub API rate limiting and retry logic with exponential backoff
- Handle GitHub API edge cases and error conditions gracefully
- Provide atomic operations with proper rollback on failures
- Support GitHub Enterprise Server in addition to GitHub.com

Interface Requirements:
- Export all functions as named exports
- Use RepositoryInfo interface with GitHub extensions from shared types
- Accept configuration objects for customization behavior
- Return structured result objects with detailed status information
- Support dependency injection for testing (GitHubAPIInterface, GitOperations)
- Provide both synchronous validation and asynchronous GitHub operations
</requirements>

<architecture>
Layer Position: Core Layer (src/core/)
- Used by: workflows/work-on-task, workflows/review-task, workflows/sync-repository
- Uses: shared/types, shared/errors, shared/validation, core/git, core/worktree, Node.js https, fs/promises
- Dependencies: core-git (for Git operations), core-worktree (for workspace setup), shared infrastructure

Design Patterns:
- Dependency injection for GitHub API and Git operations (enables testing)
- Factory pattern for creating GitHub API clients with different configurations
- Strategy pattern for authentication methods (token, device flow, app authentication)
- Command pattern for atomic GitHub operations with rollback
- Observer pattern for webhook event handling and processing
- Retry pattern with exponential backoff for rate limit handling

File Structure:
```
src/core/github.ts                      # Main implementation
tests/unit/core/github.test.ts           # Unit tests with mocked GitHub API
tests/integration/github.test.ts         # Integration tests with GitHub API
tests/fixtures/github/                   # Test data and mock responses
  ├── api-responses/                     # Sample GitHub API responses
  ├── webhook-payloads/                  # Webhook event examples
  ├── repository-structures/             # Various repo configurations
  └── error-scenarios/                   # API error cases and edge conditions
```
</architecture>

<error-handling>
Use Hierarchical Error System:
- Import ErrorFactory and ERROR_CODES from `@/shared/errors`
- Extend existing GitHub error codes in ERROR_CODES:
  - `GITHUB_AUTH_FAILED` - Authentication failure
  - `GITHUB_API_ERROR` - General API error
  - `GITHUB_RATE_LIMIT_EXCEEDED` - Rate limit exceeded
  - `GITHUB_REPOSITORY_NOT_FOUND` - Repository doesn't exist or no access
  - `GITHUB_PERMISSION_DENIED` - Insufficient permissions
  - `GITHUB_NETWORK_ERROR` - Network connectivity issues

Error Handling Patterns:
```typescript
// GitHub API request with retry logic
async function makeGitHubRequest<T>(url: string, options: RequestOptions): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
    try {
      const response = await this.httpClient.request(url, options);
      
      if (response.status === 401) {
        throw ErrorFactory.github(
          ERROR_CODES.GITHUB_AUTH_FAILED,
          'GitHub authentication failed. Check token validity.',
          { url, attempt, suggestion: 'Verify token with gh auth status' }
        );
      }
      
      if (response.status === 403 && response.headers['x-ratelimit-remaining'] === '0') {
        const resetTime = new Date(parseInt(response.headers['x-ratelimit-reset']) * 1000);
        throw new GitHubRateLimitError(resetTime, 
          parseInt(response.headers['x-ratelimit-limit']),
          0,
          { url, attempt }
        );
      }
      
      if (response.status === 404) {
        throw ErrorFactory.github(
          ERROR_CODES.GITHUB_REPOSITORY_NOT_FOUND,
          `Repository not found or access denied: ${url}`,
          { url, suggestion: 'Check repository name and access permissions' }
        );
      }
      
      return response.data;
    } catch (error) {
      lastError = error;
      
      if (error.code === ERROR_CODES.GITHUB_RATE_LIMIT_EXCEEDED) {
        const waitTime = this.calculateBackoffDelay(attempt);
        await this.delay(waitTime);
        continue;
      }
      
      if (attempt === this.maxRetries) break;
      
      // Exponential backoff for network errors
      if (this.isRetryableError(error)) {
        const waitTime = this.calculateBackoffDelay(attempt);
        await this.delay(waitTime);
        continue;
      }
      
      throw error;
    }
  }
  
  throw ErrorFactory.github(
    ERROR_CODES.GITHUB_API_ERROR,
    `GitHub API request failed after ${this.maxRetries} attempts: ${lastError.message}`,
    { url, attempts: this.maxRetries, originalError: lastError }
  );
}

// Repository operations with validation
async function cloneRepository(repositoryUrl: string, targetPath: string): Promise<RepositoryCloneResult> {
  try {
    // Validate repository access
    const repoInfo = await this.getRepositoryInfo(repositoryUrl);
    
    // Check local path availability
    if (await this.fileSystem.exists(targetPath)) {
      throw ErrorFactory.github(
        ERROR_CODES.FILE_ALREADY_EXISTS,
        `Target path already exists: ${targetPath}`,
        { path: targetPath, suggestion: 'Choose different path or use --force' }
      );
    }
    
    // Perform clone operation
    const cloneResult = await this.gitOps.clone(repositoryUrl, targetPath, {
      depth: 1,
      recursive: true
    });
    
    return {
      success: true,
      path: targetPath,
      repository: repoInfo,
      cloneInfo: cloneResult
    };
  } catch (error) {
    if (error.code === 'EACCES') {
      throw ErrorFactory.github(
        ERROR_CODES.GITHUB_PERMISSION_DENIED,
        `Permission denied accessing repository: ${repositoryUrl}`,
        { url: repositoryUrl, suggestion: 'Check repository permissions and authentication' }
      );
    }
    
    throw ErrorFactory.github(
      ERROR_CODES.GITHUB_API_ERROR,
      `Failed to clone repository: ${error.message}`,
      { url: repositoryUrl, path: targetPath, originalError: error }
    );
  }
}
```

Include helpful suggestions in error messages and provide context data for debugging and recovery.
</error-handling>

<testing>
TDD Implementation Strategy (Test-Driven Development):

Red-Green-Refactor Cycles:
1. **Red Phase**: Write failing tests for each function before implementation
2. **Green Phase**: Write minimal code to make tests pass
3. **Refactor Phase**: Improve code quality while maintaining test coverage

Unit Testing Strategy (90% coverage minimum):
- Mock GitHub API using dependency injection (GitHubAPIInterface)
- Mock Git operations using GitOperationsInterface from core-git
- Test each function with valid inputs and expected outputs
- Test error conditions: authentication failures, rate limits, network issues
- Test pagination handling for large result sets
- Use test fixtures for consistent GitHub API response structures
- Mock webhook signature validation and event processing

Integration Testing Strategy:
- Test real GitHub API operations in isolated test repositories
- Test actual repository cloning, issue creation, and PR workflows
- Test integration with core-git for local repository operations
- Test integration with core-worktree for workspace management
- Test rate limiting and retry logic with real API calls
- Verify authentication flows with different token types

Testing Structure:
```typescript
// Unit tests with mocks
describe('core-github unit tests', () => {
  let mockGitHubAPI: MockGitHubAPIInterface;
  let mockGitOps: MockGitOperationsInterface;
  let mockFileSystem: MockFileSystemInterface;
  
  beforeEach(() => {
    mockGitHubAPI = new MockGitHubAPI();
    mockGitOps = new MockGitOperations();
    mockFileSystem = new MockFileSystem();
  });
  
  describe('authenticateGitHub', () => {
    it('should authenticate with valid token');
    it('should handle invalid token gracefully');
    it('should support device flow authentication');
    it('should cache authentication state');
  });
  
  describe('getRepositoryInfo', () => {
    it('should retrieve repository information with GitHub extensions');
    it('should handle private repository access');
    it('should handle repository not found errors');
    it('should validate repository URL format');
  });
  
  describe('createPullRequest', () => {
    it('should create PR with proper branch validation');
    it('should handle duplicate PR creation');
    it('should apply PR templates and automation');
    it('should validate branch relationships');
  });
});

// Integration tests with real GitHub API
describe('core-github integration tests', () => {
  let testToken: string;
  let testRepository: string;
  
  beforeEach(async () => {
    testToken = process.env.GITHUB_TEST_TOKEN;
    testRepository = 'claude-swarm/test-repository';
    
    if (!testToken) {
      console.warn('Skipping GitHub integration tests - no token provided');
      return;
    }
  });
  
  it('should perform full issue lifecycle', async () => {
    // Test with actual GitHub API
  });
  
  it('should handle rate limiting gracefully', async () => {
    // Test rate limit handling
  });
});
```

Test Coverage Requirements:
- All public functions: 100% coverage
- Error paths: 90% coverage
- Authentication scenarios: All token types and device flow
- Performance: API operations under 5 seconds for typical scenarios
- Rate limiting: Proper backoff and retry behavior
</testing>

<implementation-order>
TDD Implementation Phases:

Phase 1: Authentication and API Client Setup
1. Define GitHubAPIInterface for GitHub API operations
2. Define authentication interfaces (token, device flow, app auth)
3. Create default implementations and mock implementations
4. Set up test infrastructure with GitHub API response fixtures

Phase 2: Core Repository Operations (Test-First)
```typescript
// 1. Write failing tests first
describe('getRepositoryInfo', () => {
  it('should retrieve repository with GitHub extensions');
  it('should handle private repositories');
  it('should extract owner and name from various URL formats');
  it('should detect fork relationships');
});

// 2. Implement minimal functionality to pass tests
async function getRepositoryInfo(
  repositoryIdentifier: string,
  githubAPI: GitHubAPIInterface = defaultGitHubAPI
): Promise<RepositoryInfo>

// 3. Refactor implementation for quality and performance
```

Phase 3: Issue Management Operations (Test-First)
```typescript
// Tests for listRepositoryIssues, getIssueDetails, createIssue, updateIssueStatus
// Implementation following same TDD cycle
```

Phase 4: Pull Request Operations (Test-First)
```typescript
// Tests for createPullRequest, getPullRequestDetails, updatePullRequestStatus
// Implementation following same TDD cycle
```

Phase 5: Repository Lifecycle Management (Test-First)
```typescript
// Tests for cloneRepository, createRepository, searchRepositories
// Implementation following same TDD cycle
```

Phase 6: Advanced Operations (Test-First)
```typescript
// Tests for checkRateLimit, validateWebhookSignature
// Implementation following same TDD cycle
```

Function Implementation Priority:
1. `authenticateGitHub()` - Foundation for all API operations
2. `getRepositoryInfo()` - Core repository information retrieval
3. `checkRateLimit()` - Essential for rate limit management
4. `listRepositoryIssues()` - Issue discovery and filtering
5. `getIssueDetails()` - Detailed issue information
6. `createIssue()` - Issue creation workflow
7. `updateIssueStatus()` - Issue lifecycle management
8. `cloneRepository()` - Repository cloning with authentication
9. `createPullRequest()` - PR creation workflow
10. `getPullRequestDetails()` - PR information retrieval
11. `updatePullRequestStatus()` - PR lifecycle management
12. `createRepository()` - Repository creation with templates
13. `searchRepositories()` - Repository discovery
14. `validateWebhookSignature()` - Webhook security validation
</implementation-order>

<interfaces>
TypeScript Interfaces (extends shared types):

```typescript
// GitHub API Interface for dependency injection
export interface GitHubAPIInterface {
  authenticate(options: GitHubAuthOptions): Promise<GitHubAuthResult>;
  request<T>(endpoint: string, options?: RequestOptions): Promise<GitHubResponse<T>>;
  paginate<T>(endpoint: string, options?: PaginationOptions): AsyncGenerator<T[], void, unknown>;
  getRateLimit(): Promise<GitHubRateLimit>;
  validateWebhook(payload: string, signature: string, secret: string): boolean;
}

// GitHub Authentication Options
export interface GitHubAuthOptions {
  token?: string;                        // Personal access token
  type?: 'token' | 'app' | 'device';     // Authentication type
  appId?: string;                        // GitHub App ID
  privateKey?: string;                   // GitHub App private key
  installationId?: string;               // GitHub App installation ID
  deviceCode?: string;                   // Device flow code
}

// GitHub Authentication Result
export interface GitHubAuthResult {
  success: boolean;                      // Authentication success
  type: 'token' | 'app' | 'device';      // Authentication method used
  login: string;                         // Authenticated user login
  scopes: string[];                      // Available permission scopes
  rateLimit: GitHubRateLimit;            // Current rate limit status
  expiresAt?: Date;                      // Token expiration time
}

// GitHub Rate Limit Information
export interface GitHubRateLimit {
  limit: number;                         // Total requests per hour
  remaining: number;                     // Remaining requests
  resetTime: Date;                       // Rate limit reset time
  resource: string;                      // Rate limit resource type
}

// GitHub API Response Wrapper
export interface GitHubResponse<T> {
  data: T;                               // Response data
  status: number;                        // HTTP status code
  headers: Record<string, string>;       // Response headers
  url: string;                           // Request URL
  rateLimit: GitHubRateLimit;            // Rate limit information
}

// Repository Clone Options
export interface CloneRepositoryOptions {
  branch?: string;                       // Specific branch to clone
  depth?: number;                        // Clone depth for shallow clones
  recursive?: boolean;                   // Clone submodules recursively
  targetPath?: string;                   // Custom clone destination
  setupWorktree?: boolean;               // Setup worktree after clone
  setupContext?: boolean;                // Setup Claude context
}

// Repository Clone Result
export interface RepositoryCloneResult {
  success: boolean;                      // Clone operation success
  path: string;                          // Local repository path
  repository: RepositoryInfo;            // Repository information
  branch: string;                        // Cloned branch
  commit: string;                        // Current commit SHA
  worktreeInfo?: WorktreeInfo;           // Worktree information if created
}

// Repository Creation Options
export interface CreateRepositoryOptions {
  name: string;                          // Repository name
  description?: string;                  // Repository description
  private?: boolean;                     // Repository visibility
  template?: string;                     // Template repository
  gitignoreTemplate?: string;            // .gitignore template
  licenseTemplate?: string;              // License template
  allowSquashMerge?: boolean;            // Allow squash merging
  allowMergeCommit?: boolean;            // Allow merge commits
  allowRebaseMerge?: boolean;            // Allow rebase merging
  deleteBranchOnMerge?: boolean;         // Delete head branches after merge
  hasIssues?: boolean;                   // Enable issues
  hasProjects?: boolean;                 // Enable projects
  hasWiki?: boolean;                     // Enable wiki
}

// Issue Information
export interface GitHubIssueInfo {
  id: string;                            // Issue ID
  number: number;                        // Issue number
  title: string;                         // Issue title
  body: string;                          // Issue description
  state: 'open' | 'closed';              // Issue state
  labels: GitHubLabel[];                 // Issue labels
  assignees: GitHubUser[];               // Assigned users
  milestone?: GitHubMilestone;           // Associated milestone
  author: GitHubUser;                    // Issue author
  createdAt: Date;                       // Creation timestamp
  updatedAt: Date;                       // Last update timestamp
  closedAt?: Date;                       // Close timestamp
  comments: number;                      // Comment count
  url: string;                           // Issue URL
}

// Pull Request Information
export interface GitHubPullRequestInfo {
  id: string;                            // PR ID
  number: number;                        // PR number
  title: string;                         // PR title
  body: string;                          // PR description
  state: 'open' | 'closed' | 'merged';   // PR state
  head: GitHubBranchRef;                 // Source branch
  base: GitHubBranchRef;                 // Target branch
  author: GitHubUser;                    // PR author
  assignees: GitHubUser[];               // Assigned reviewers
  requestedReviewers: GitHubUser[];      // Requested reviewers
  labels: GitHubLabel[];                 // PR labels
  milestone?: GitHubMilestone;           // Associated milestone
  mergeable: boolean | null;             // Whether PR can be merged
  rebaseable: boolean | null;            // Whether PR can be rebased
  draft: boolean;                        // Whether PR is draft
  createdAt: Date;                       // Creation timestamp
  updatedAt: Date;                       // Last update timestamp
  mergedAt?: Date;                       // Merge timestamp
  closedAt?: Date;                       // Close timestamp
  commits: number;                       // Commit count
  additions: number;                     // Lines added
  deletions: number;                     // Lines deleted
  changedFiles: number;                  // Files changed
  url: string;                           // PR URL
}

// GitHub Label
export interface GitHubLabel {
  id: string;                            // Label ID
  name: string;                          // Label name
  color: string;                         // Label color (hex)
  description?: string;                  // Label description
}

// GitHub User
export interface GitHubUser {
  id: string;                            // User ID
  login: string;                         // Username
  name?: string;                         // Display name
  email?: string;                        // Email address
  avatarUrl: string;                     // Avatar image URL
  url: string;                           // Profile URL
  type: 'User' | 'Bot' | 'Organization'; // User type
}

// GitHub Milestone
export interface GitHubMilestone {
  id: string;                            // Milestone ID
  number: number;                        // Milestone number
  title: string;                         // Milestone title
  description?: string;                  // Milestone description
  state: 'open' | 'closed';              // Milestone state
  dueOn?: Date;                          // Due date
  createdAt: Date;                       // Creation timestamp
  updatedAt: Date;                       // Last update timestamp
  closedAt?: Date;                       // Close timestamp
}

// GitHub Branch Reference
export interface GitHubBranchRef {
  ref: string;                           // Branch reference
  sha: string;                           // Commit SHA
  repository: RepositoryInfo;            // Repository information
  user: GitHubUser;                      // Repository owner
}

// Issue Search Options
export interface SearchIssuesOptions {
  state?: 'open' | 'closed' | 'all';     // Issue state filter
  labels?: string[];                     // Label filters
  assignee?: string;                     // Assignee filter
  author?: string;                       // Author filter
  milestone?: string;                    // Milestone filter
  since?: Date;                          // Updated since date
  sort?: 'created' | 'updated' | 'comments'; // Sort criteria
  direction?: 'asc' | 'desc';            // Sort direction
  perPage?: number;                      // Results per page
  page?: number;                         // Page number
}

// Repository Search Options
export interface SearchRepositoriesOptions {
  query: string;                         // Search query
  sort?: 'stars' | 'forks' | 'help-wanted-issues' | 'updated'; // Sort criteria
  order?: 'asc' | 'desc';                // Sort order
  perPage?: number;                      // Results per page
  page?: number;                         // Page number
}

// Pagination Options
export interface PaginationOptions {
  perPage?: number;                      // Items per page (default: 30, max: 100)
  page?: number;                         // Page number (default: 1)
  maxPages?: number;                     // Maximum pages to fetch
}

// Request Options
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; // HTTP method
  headers?: Record<string, string>;      // Request headers
  body?: unknown;                        // Request body
  timeout?: number;                      // Request timeout
  retries?: number;                      // Retry attempts
}

// Webhook Validation Options
export interface WebhookValidationOptions {
  payload: string;                       // Webhook payload
  signature: string;                     // GitHub signature header
  secret: string;                        // Webhook secret
  algorithm?: 'sha1' | 'sha256';         // Signature algorithm
}

// Issue Creation Options
export interface CreateIssueOptions {
  title: string;                         // Issue title
  body?: string;                         // Issue description
  labels?: string[];                     // Initial labels
  assignees?: string[];                  // Initial assignees
  milestone?: number;                    // Milestone number
}

// Issue Update Options
export interface UpdateIssueOptions {
  title?: string;                        // New title
  body?: string;                         // New description
  state?: 'open' | 'closed';             // New state
  labels?: string[];                     // New labels (replaces existing)
  assignees?: string[];                  // New assignees (replaces existing)
  milestone?: number | null;             // New milestone (null removes)
}

// Pull Request Creation Options
export interface CreatePullRequestOptions {
  title: string;                         // PR title
  body?: string;                         // PR description
  head: string;                          // Source branch
  base: string;                          // Target branch
  draft?: boolean;                       // Create as draft
  maintainerCanModify?: boolean;         // Allow maintainer edits
}

// Pull Request Update Options
export interface UpdatePullRequestOptions {
  title?: string;                        // New title
  body?: string;                         // New description
  state?: 'open' | 'closed';             // New state
  base?: string;                         // New base branch
  maintainerCanModify?: boolean;         // Allow maintainer edits
}
```
</interfaces>

<examples>
Usage Examples and Integration Patterns:

```typescript
// Example 1: Repository Management with Authentication
import { authenticateGitHub, getRepositoryInfo, cloneRepository } from '@/core/github';
import { createWorktree } from '@/core/worktree';

async function setupRepositoryWorkspace(repositoryUrl: string, taskNumber: number) {
  // Authenticate with GitHub
  const authResult = await authenticateGitHub({
    token: process.env.GITHUB_TOKEN,
    type: 'token'
  });
  
  if (!authResult.success) {
    throw new Error(`GitHub authentication failed: ${authResult.login}`);
  }
  
  console.log(`Authenticated as: ${authResult.login}`);
  console.log(`Rate limit: ${authResult.rateLimit.remaining}/${authResult.rateLimit.limit}`);
  
  // Get repository information
  const repoInfo = await getRepositoryInfo(repositoryUrl);
  console.log(`Repository: ${repoInfo.owner}/${repoInfo.name}`);
  console.log(`Default branch: ${repoInfo.defaultBranch}`);
  console.log(`Private: ${repoInfo.github?.isPrivate}`);
  
  // Clone repository if not already present
  const localPath = `./repositories/${repoInfo.name}`;
  let cloneResult: RepositoryCloneResult;
  
  try {
    cloneResult = await cloneRepository(repositoryUrl, {
      targetPath: localPath,
      branch: repoInfo.defaultBranch,
      setupWorktree: true,
      setupContext: true
    });
  } catch (error) {
    if (error.code === 'FILE_ALREADY_EXISTS') {
      console.log('Repository already exists locally');
      cloneResult = {
        success: true,
        path: localPath,
        repository: repoInfo,
        branch: repoInfo.defaultBranch,
        commit: 'existing'
      };
    } else {
      throw error;
    }
  }
  
  // Create task-specific worktree
  const worktree = await createWorktree({
    name: `task-${taskNumber}`,
    path: `${localPath}/worktrees/task-${taskNumber}`,
    branch: `feature/task-${taskNumber}`,
    baseBranch: repoInfo.defaultBranch,
    setupContext: true
  });
  
  console.log(`Workspace ready: ${worktree.path}`);
  return { repository: repoInfo, clone: cloneResult, worktree };
}

// Example 2: Issue-Driven Development Workflow
import { listRepositoryIssues, getIssueDetails, updateIssueStatus } from '@/core/github';

async function startWorkOnIssue(repositoryUrl: string, issueNumber: number) {
  // Get issue details
  const issue = await getIssueDetails(repositoryUrl, issueNumber);
  
  if (issue.state === 'closed') {
    throw new Error(`Issue #${issueNumber} is already closed`);
  }
  
  console.log(`Starting work on: ${issue.title}`);
  console.log(`Labels: ${issue.labels.map(l => l.name).join(', ')}`);
  console.log(`Assignees: ${issue.assignees.map(a => a.login).join(', ')}`);
  
  // Update issue to indicate work has started
  await updateIssueStatus(repositoryUrl, issueNumber, {
    labels: [...issue.labels.map(l => l.name), 'in-progress'],
    assignees: issue.assignees.length > 0 ? 
      issue.assignees.map(a => a.login) : 
      ['self'] // Assign to authenticated user
  });
  
  // Setup workspace for the issue
  const workspace = await setupRepositoryWorkspace(repositoryUrl, issueNumber);
  
  console.log(`Issue #${issueNumber} workspace ready at: ${workspace.worktree.path}`);
  return { issue, workspace };
}

// Example 3: Pull Request Automation with Validation
import { createPullRequest, getPullRequestDetails } from '@/core/github';
import { validateWorktreeState } from '@/core/worktree';

async function createTaskPullRequest(
  repositoryUrl: string, 
  worktreePath: string, 
  issueNumber: number
) {
  // Validate worktree state before creating PR
  const validation = await validateWorktreeState(worktreePath);
  
  if (!validation.isValid) {
    throw new Error(`Worktree validation failed: ${validation.issues.join(', ')}`);
  }
  
  if (!validation.isClean) {
    console.warn('Worktree has uncommitted changes:');
    validation.uncommittedFiles.forEach(file => console.warn(`  - ${file}`));
    
    const shouldContinue = await confirmUserAction(
      'Create PR with uncommitted changes?'
    );
    
    if (!shouldContinue) {
      return { created: false, reason: 'uncommitted_changes' };
    }
  }
  
  // Get issue details for PR content
  const issue = await getIssueDetails(repositoryUrl, issueNumber);
  const repoInfo = await getRepositoryInfo(repositoryUrl);
  
  // Create pull request
  const prResult = await createPullRequest(repositoryUrl, {
    title: `Fix #${issueNumber}: ${issue.title}`,
    body: `
## Summary
Fixes #${issueNumber}

${issue.body}

## Changes
- Implemented solution for ${issue.title}
- Added tests and documentation
- Verified functionality

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated

🤖 Generated with [Claude Code](https://claude.ai/code)
    `.trim(),
    head: `feature/task-${issueNumber}`,
    base: repoInfo.defaultBranch,
    draft: false
  });
  
  if (prResult.success) {
    console.log(`Pull request created: ${prResult.url}`);
    console.log(`PR #${prResult.number}: ${prResult.title}`);
    
    // Update issue with PR reference
    await updateIssueStatus(repositoryUrl, issueNumber, {
      labels: [...issue.labels.map(l => l.name).filter(l => l !== 'in-progress'), 'under-review']
    });
  }
  
  return prResult;
}

// Example 4: Repository Search and Discovery
import { searchRepositories } from '@/core/github';

async function findSimilarRepositories(topic: string, language?: string) {
  const searchQuery = [
    `topic:${topic}`,
    language ? `language:${language}` : '',
    'is:public',
    'archived:false'
  ].filter(Boolean).join(' ');
  
  console.log(`Searching for repositories: ${searchQuery}`);
  
  const repositories = await searchRepositories({
    query: searchQuery,
    sort: 'stars',
    order: 'desc',
    perPage: 10
  });
  
  console.log(`Found ${repositories.length} repositories:`);
  
  for (const repo of repositories) {
    console.log(`\n${repo.owner}/${repo.name}`);
    console.log(`  ⭐ ${repo.github?.starCount || 0} stars`);
    console.log(`  🍴 ${repo.github?.forkCount || 0} forks`);
    console.log(`  📝 ${repo.description || 'No description'}`);
    console.log(`  🔗 ${repo.github?.htmlUrl || repo.remoteUrl}`);
    
    if (repo.github?.topics?.length) {
      console.log(`  🏷️ Topics: ${repo.github.topics.join(', ')}`);
    }
  }
  
  return repositories;
}

// Example 5: Rate Limiting and Error Handling
import { checkRateLimit } from '@/core/github';
import { ErrorFactory, ERROR_CODES } from '@/shared/errors';

async function safeGitHubOperation<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  try {
    // Check rate limit before operation
    const rateLimit = await checkRateLimit();
    
    if (rateLimit.remaining < 10) {
      const waitTime = Math.ceil((rateLimit.resetTime.getTime() - Date.now()) / 1000 / 60);
      console.warn(`Low rate limit (${rateLimit.remaining}). Resets in ${waitTime} minutes.`);
      
      if (rateLimit.remaining === 0) {
        throw ErrorFactory.github(
          ERROR_CODES.GITHUB_RATE_LIMIT_EXCEEDED,
          `GitHub rate limit exceeded. Resets at ${rateLimit.resetTime.toISOString()}`,
          { 
            resetTime: rateLimit.resetTime,
            limit: rateLimit.limit,
            suggestion: `Wait ${waitTime} minutes or use a different token`
          }
        );
      }
    }
    
    // Execute operation
    const result = await operation();
    
    console.log(`✅ ${operationName} completed successfully`);
    return result;
    
  } catch (error) {
    if (error.code === ERROR_CODES.GITHUB_RATE_LIMIT_EXCEEDED) {
      console.error(`❌ ${operationName} failed: Rate limit exceeded`);
      console.error(`   Resets at: ${error.resetTime}`);
      throw error;
    }
    
    if (error.code === ERROR_CODES.GITHUB_AUTH_FAILED) {
      console.error(`❌ ${operationName} failed: Authentication error`);
      console.error(`   Suggestion: ${error.getUserMessage()}`);
      throw error;
    }
    
    if (error.code === ERROR_CODES.GITHUB_PERMISSION_DENIED) {
      console.error(`❌ ${operationName} failed: Permission denied`);
      console.error(`   Check repository access and token scopes`);
      throw error;
    }
    
    // Log unexpected errors and re-throw
    console.error(`❌ ${operationName} failed: ${error.message}`);
    throw ErrorFactory.github(
      ERROR_CODES.GITHUB_API_ERROR,
      `GitHub operation failed: ${error.message}`,
      { operation: operationName, originalError: error }
    );
  }
}

// Example 6: Webhook Validation and Event Processing
import { validateWebhookSignature } from '@/core/github';

async function processGitHubWebhook(
  payload: string,
  signature: string,
  event: string
) {
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    throw ErrorFactory.github(
      ERROR_CODES.CORE_INVALID_CONFIGURATION,
      'GitHub webhook secret not configured',
      { suggestion: 'Set GITHUB_WEBHOOK_SECRET environment variable' }
    );
  }
  
  // Validate webhook signature
  const isValid = await validateWebhookSignature({
    payload,
    signature,
    secret: webhookSecret,
    algorithm: 'sha256'
  });
  
  if (!isValid) {
    throw ErrorFactory.github(
      ERROR_CODES.GITHUB_PERMISSION_DENIED,
      'Invalid webhook signature',
      { suggestion: 'Check webhook secret configuration' }
    );
  }
  
  // Parse webhook payload
  const eventData = JSON.parse(payload);
  
  console.log(`📡 GitHub webhook received: ${event}`);
  console.log(`   Repository: ${eventData.repository?.full_name}`);
  console.log(`   Action: ${eventData.action}`);
  
  // Process different event types
  switch (event) {
    case 'issues':
      return await handleIssueEvent(eventData);
    case 'pull_request':
      return await handlePullRequestEvent(eventData);
    case 'push':
      return await handlePushEvent(eventData);
    default:
      console.log(`   Unhandled event type: ${event}`);
      return { processed: false, reason: 'unhandled_event' };
  }
}
```

Integration with Other Core Modules:
```typescript
// Integration with core-git for Git operations
import { getCurrentBranch, hasUncommittedChanges } from '@/core/git';

// Integration with core-worktree for workspace management
import { createWorktree, switchWorktree } from '@/core/worktree';

// Integration with shared validation
import { CommonValidators } from '@/shared/validation';

// Integration pattern for workflow operations
async function workflowGitHubOperations(repositoryUrl: string, issueNumber: number) {
  // Validate inputs using shared validators
  CommonValidators.url().validateOrThrow(repositoryUrl);
  CommonValidators.positiveInteger().validateOrThrow(issueNumber);
  
  // Integrate GitHub and Git operations
  const repoInfo = await getRepositoryInfo(repositoryUrl);
  const issue = await getIssueDetails(repositoryUrl, issueNumber);
  
  // Create worktree with GitHub context
  const worktree = await createWorktree({
    name: `issue-${issueNumber}`,
    branch: `feature/issue-${issueNumber}`,
    setupContext: true
  });
  
  // Validate integrated state
  const hasChanges = await hasUncommittedChanges(worktree.path);
  if (hasChanges) {
    console.warn('Worktree has uncommitted changes');
  }
  
  return { repository: repoInfo, issue, worktree };
}
```
</examples>