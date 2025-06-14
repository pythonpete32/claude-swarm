# CLAUDE.md

This file provides guidance to Claude Code when working with the Claude Swarm codebase.

## Architecture Principles

### 4-Layer Architecture (ALWAYS follow this structure)
```
commands/ → workflows/ → core/ → shared/
```
- **commands/**: CLI entry points that call workflows
- **workflows/**: Orchestrate multiple core operations 
- **core/**: Reusable building blocks (worktree, git, github, tmux, claude, files)
- **shared/**: Common utilities (types, errors, config, validation)

### Library-First Design
- No hardcoded assumptions - everything configurable
- Pure functions with dependency injection where possible
- Clean APIs for external consumption

## Error Handling Patterns

### Use Hierarchical Error System
```typescript
// ✅ Always use standardized error codes and factories
throw ErrorFactory.worktree(ERROR_CODES.WORKTREE_EXISTS, "Worktree already exists", { path });
throw ErrorFactory.core(ERROR_CODES.CORE_INVALID_CONFIGURATION, "Configuration validation failed", { errors });
throw ErrorFactory.git(ERROR_CODES.GIT_COMMAND_FAILED, "Git operation failed", { command });

// ❌ Never throw generic errors
throw new Error("Something went wrong");
```

### Error Code Format: `MODULE_ERROR_TYPE`
- `WORKTREE_EXISTS`, `GITHUB_AUTH_FAILED`, `GIT_COMMAND_FAILED`
- Include helpful suggestions in error messages

## Configuration Management

### Deep Partial Updates
```typescript
// ✅ Use DeepPartial for config updates
updateConfig({ github: { timeout: 30000 } }); // Only timeout, preserves other github settings

// ❌ Don't require full nested objects
updateConfig({ github: { timeout: 30000, baseUrl: "...", retryCount: 3 } });
```

## Testability Design Principles

### Write Code for Testing
- **Pure Functions**: Core operations have no side effects where possible
- **Dependency Injection**: Pass dependencies as parameters, easy to mock
- **Clear Interfaces**: Well-defined inputs/outputs, avoid global state

```typescript
// ✅ Testable - dependencies injected
async function createWorktree(options: WorktreeOptions, gitOps = defaultGitOps) {
  return gitOps.createWorktree(options);
}

// ❌ Hard to test - hidden dependency
async function createWorktree(options: WorktreeOptions) {
  return exec(`git worktree add ${options.path}`); // Direct system call
}
```

## Testing Requirements

### Test Structure (CRITICAL - always follow)
```
tests/
├── unit/          # 60% - Isolated module testing  
├── integration/   # 30% - Module interaction testing
├── e2e/           # 10% - End-to-end workflow testing
├── fixtures/      # Test data and mock repositories
└── helpers/       # Test utilities and mocks
```

### What Makes a Good Test
1. **Test Isolation**: Each test is completely independent
2. **Mock External Dependencies**: Git commands, GitHub API, file system, tmux
3. **Use Test Fixtures**: Standardized test data in `tests/fixtures/`
4. **Clean Up Resources**: Always clean up after each test
5. **Test Both Success and Error Paths**: Don't just test happy path

### Mock Strategy
```typescript
// ✅ Mock external dependencies
const mockGitOps = {
  createWorktree: vi.fn().mockResolvedValue({ path: '/test/path' }),
  removeWorktree: vi.fn().mockResolvedValue(true)
};

// ✅ Use test fixtures for consistent data
import { TEST_REPOSITORIES, TEST_ISSUES } from '../fixtures/test-data';
```

### Test Quality Gates
- **Unit Coverage**: 90% minimum for core modules
- **Test Runner**: Vitest (NOT bun:test despite spec mentioning it)
- **Include tests in TypeScript checking**: `tsconfig.json` must include `tests/**/*`

### Test Patterns
```typescript
// ✅ Use descriptive test names that explain behavior
it('should create worktree with agent isolation when agentId provided')

// ✅ Follow Arrange-Act-Assert pattern
it('should validate worktree state correctly', async () => {
  // Arrange
  const worktree = await createTestWorktree();
  // Act  
  const validation = await validateWorktreeState(worktree.path);
  // Assert
  expect(validation.isValid).toBe(true);
});

// ✅ Test error codes, not just error types
expect(() => createWorktree({ repositoryPath: '/invalid' }))
  .toThrow('WORKTREE_INVALID_REPOSITORY');

// ✅ Test with proper mocks and cleanup
beforeEach(async () => {
  testRepo = await mockGitRepository();
});
afterEach(async () => {
  await cleanupTestRepo(testRepo);
});
```

1. For maximum efficiency, ALWAYS use parallel tool calls wherever possible.
2. always THINK between tool calls, dont cheap out on the reasoning budget.
3. No one likes a yes man! if the user is asking you to do something that doesn't make sense or can be done better, give them the best alternatives


## Git Workflow

- Use conventional commits: `type(scope): description`
- Types: feat, fix, docs, style, refactor, test, chore
- Include breaking changes and Claude Code attribution

## Validation Patterns

### Control Character Handling
```typescript
// ✅ Use biome-ignore for intentional control char checks
// biome-ignore lint/suspicious/noControlCharactersInRegex: Control chars intentionally checked for security
const invalidChars = /[<>:"|?*\x00-\x1f]/;

// ❌ Alternative (but less explicit about what's being matched)
const invalidChars = /[<>:"|?*\p{Cc}]/gu;
```

### Always Validate at Workflow Entry Points
- Use `CommonValidators` for standard patterns
- Sanitize user input before processing
- Validate configuration updates with proper error messages

