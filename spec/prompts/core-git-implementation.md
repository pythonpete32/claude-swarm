# Core Git Module Implementation Prompt

<instructions>
Implement the core-git module for the Claude Swarm TypeScript migration project. This module provides foundational git operations that all other core modules depend on. 

Build a robust, testable, and well-documented git operations module that:
- Validates repository state and structure
- Provides branch management operations
- Parses and validates git remote URLs
- Analyzes repository changes and diffs
- Follows the established error handling and configuration patterns
- Integrates seamlessly with the shared infrastructure

Create the module at `src/core/git.ts` with comprehensive tests at `tests/unit/core/git.test.ts`.
</instructions>

<requirements>
Functional Requirements:
- `validateRepository()` - Verify git repository is valid and accessible
- `getCurrentBranch()` - Get current branch name and tracking information
- `parseRemoteUrl()` - Parse git remote URLs to extract GitHub info
- `createBranch()` - Create new branches with proper tracking setup
- `getDiff()` - Generate diffs for changed files and commits
- `getRemoteInfo()` - Extract remote repository information
- `checkWorkingTreeClean()` - Verify working directory has no uncommitted changes

Technical Requirements:
- TypeScript with strict type checking
- Use shared types from `@/shared/types`
- Use standardized error handling from `@/shared/errors`
- Use configuration from `@/shared/config`
- Support both synchronous and asynchronous operations
- Handle git command execution with proper timeout and error handling
- Cross-platform compatibility (macOS, Linux, Windows)

Interface Requirements:
- Export all functions as named exports
- Use GitRepository, GitBranch, GitDiff interfaces from shared types
- Accept configuration objects for customization
- Return structured result objects, not raw command output
- Support dependency injection for testing
</requirements>

<architecture>
Layer Position: Core Layer (src/core/)
- Used by: core-worktree, core-github, workflows
- Uses: shared/types, shared/errors, shared/config, Node.js child_process
- No dependencies on other core modules

Design Patterns:
- Pure functions where possible (no hidden state)
- Dependency injection for git command executor
- Factory pattern for creating git operation contexts
- Builder pattern for complex git commands

File Structure:
```
src/core/git.ts              # Main implementation
tests/unit/core/git.test.ts   # Unit tests with mocks
tests/integration/git.test.ts # Integration tests with real git
```
</architecture>

<error-handling>
Use Hierarchical Error System:
- Import ErrorFactory and ERROR_CODES from `@/shared/errors`
- Throw structured errors with specific error codes:
  - `GIT_REPOSITORY_NOT_FOUND` - Repository doesn't exist
  - `GIT_COMMAND_FAILED` - Git command execution failed
  - `GIT_INVALID_REMOTE` - Remote URL parsing failed
  - `GIT_BRANCH_NOT_FOUND` - Branch doesn't exist
  - `GIT_WORKING_TREE_DIRTY` - Uncommitted changes present

Error Handling Patterns:
```typescript
try {
  const result = await executeGitCommand(command);
  return parseGitOutput(result);
} catch (error) {
  throw ErrorFactory.git(
    ERROR_CODES.GIT_COMMAND_FAILED,
    `Git operation failed: ${command}`,
    { command, originalError: error }
  );
}
```

Include helpful suggestions in error messages and context data.
</error-handling>

<testing>
Testing Strategy (90% coverage minimum):

Unit Tests:
- Mock all git command executions using test helpers
- Test each function with valid inputs and expected outputs
- Test error conditions and edge cases
- Test cross-platform path handling
- Use fixtures for consistent test data

Integration Tests:
- Test against real git repositories
- Create temporary test repositories for isolation
- Test actual git command execution
- Verify end-to-end functionality

Test Structure:
```typescript
describe('core-git', () => {
  describe('validateRepository', () => {
    it('should validate existing git repository')
    it('should throw GIT_REPOSITORY_NOT_FOUND for invalid path')
    it('should handle permission errors gracefully')
  });
  
  describe('parseRemoteUrl', () => {
    it('should parse HTTPS GitHub URLs correctly')
    it('should parse SSH GitHub URLs correctly') 
    it('should throw GIT_INVALID_REMOTE for invalid URLs')
  });
});
```

Mock Strategy:
- Mock child_process.exec for git commands
- Use test fixtures for git output
- Create helper functions for common test setups
- Clean up test repositories after each test
</testing>

<dependencies>
External Dependencies:
- Node.js `child_process` for git command execution
- Node.js `path` for cross-platform path handling
- Node.js `fs/promises` for file system checks

Internal Dependencies:
- `@/shared/types` - GitRepository, GitBranch, GitDiff interfaces
- `@/shared/errors` - ErrorFactory and ERROR_CODES
- `@/shared/config` - Git configuration settings
- `@/shared/validation` - Input validation utilities

Used By (Future):
- `core-worktree` - Repository validation and branch operations
- `core-github` - Remote URL parsing for GitHub detection
- `workflows/work-on-task` - Branch creation and validation
- `workflows/review-task` - Change analysis and diff generation
</dependencies>

<performance>
Performance Requirements:
- Repository validation: < 500ms
- Branch operations: < 1 second
- Diff generation: < 2 seconds for reasonable file sizes
- Remote URL parsing: < 10ms (synchronous)

Optimization Guidelines:
- Cache repository validation results when appropriate
- Use git plumbing commands for faster execution
- Implement timeout handling for long-running operations
- Stream large diff outputs instead of loading into memory
- Use parallel execution for independent operations

Memory Usage:
- Limit diff output size to prevent memory issues
- Clean up temporary files and processes
- Use streams for large file operations
</performance>

<guidelines>
Code Style:
- Follow existing patterns from shared infrastructure
- Use descriptive function and variable names
- Add JSDoc comments for all public functions
- Use TypeScript strict mode features
- Follow the established import/export patterns

Security:
- Validate all input parameters
- Sanitize git command arguments to prevent injection
- Use absolute paths to prevent directory traversal
- Handle sensitive information (tokens, passwords) securely
- Log operations without exposing sensitive data

Documentation:
- Include usage examples in JSDoc comments
- Document error conditions and recovery strategies
- Explain complex git operations with comments
- Provide troubleshooting guidance for common issues

Git Command Patterns:
```typescript
// ✅ Good - Safe command construction
const command = ['git', 'status', '--porcelain'];
const result = await executeCommand(command, { cwd: repositoryPath });

// ❌ Bad - String interpolation risk
const command = `git status --porcelain ${userInput}`;
```

Configuration Integration:
- Use git timeout from shared config
- Respect debug mode for verbose logging
- Support custom git executable path
- Allow configuration overrides via parameters
</guidelines>

<validation>
Input Validation Requirements:
- Validate repository paths exist and are accessible
- Sanitize branch names for git compatibility
- Validate remote URLs match expected patterns
- Check file paths are within repository boundaries
- Verify command arguments are safe for execution

Validation Patterns:
```typescript
// Use shared validation utilities
import { validatePath, sanitizeGitRef } from '@/shared/validation';

function createBranch(name: string, repositoryPath: string) {
  validatePath(repositoryPath, 'Repository path');
  const safeBranchName = sanitizeGitRef(name);
  // ... implementation
}
```
</validation>

<examples>
Usage Examples:

```typescript
// Repository validation
const repoInfo = await validateRepository('/path/to/repo');
if (!repoInfo.isValid) {
  throw new Error('Invalid repository');
}

// Branch operations
const currentBranch = await getCurrentBranch('/path/to/repo');
const newBranch = await createBranch('feature/new-feature', '/path/to/repo');

// Remote parsing
const remoteInfo = parseRemoteUrl('git@github.com:owner/repo.git');
console.log(remoteInfo.owner, remoteInfo.name);

// Change analysis
const diff = await getDiff('/path/to/repo', 'main', 'feature/branch');
console.log(`${diff.changedFiles.length} files changed`);
```

Integration with Other Modules:
```typescript
// Used by core-worktree
const repoValid = await validateRepository(basePath);
const branch = await createBranch(`task-${issueNumber}`, basePath);

// Used by core-github  
const remoteInfo = parseRemoteUrl(gitRemoteUrl);
const repoDetails = await detectRepository(remoteInfo);
```
</examples>

<success-criteria>
Implementation Complete When:
- ✅ All required functions implemented and working
- ✅ Unit tests achieve 90%+ coverage
- ✅ Integration tests pass with real git repositories
- ✅ Error handling follows established patterns
- ✅ TypeScript compilation passes with no errors
- ✅ Performance benchmarks met
- ✅ Documentation is complete and accurate
- ✅ Code follows established style guidelines
- ✅ Module integrates properly with shared infrastructure

Quality Gates:
- All tests pass in CI environment
- No linting or formatting issues
- Memory usage within acceptable limits
- Cross-platform compatibility verified
- Security review passed
</success-criteria>