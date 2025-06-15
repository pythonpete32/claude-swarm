# Testing Strategy

← [Back to Index](./README.md) | [Previous: Shared Infrastructure](./04-shared-infrastructure.md) | [Next: Configuration →](./06-configuration.md)

## Overview

This document defines a comprehensive testing strategy for the Claude Swarm TypeScript migration, ensuring robust, reliable, and maintainable code across all modules and workflows.

## Testing Philosophy

### 1. **Test-Driven Development (TDD)**
- Write tests before implementation where possible
- Use tests to validate interface contracts
- Ensure behavior matches specifications

### 2. **Test Pyramid Strategy**
```
         E2E Tests (10%)
        ─────────────────
       Integration Tests (30%)
      ─────────────────────────
     Unit Tests (60%)
    ───────────────────────────
```

### 3. **Quality Gates**
- **Unit Test Coverage**: Minimum 90% for all core modules
- **Integration Test Coverage**: All public APIs tested
- **E2E Coverage**: Critical user workflows tested
- **Performance Tests**: All operations meet benchmarks

## Testing Architecture

### Test Structure
```
tests/
├── unit/                     # Isolated module testing
│   ├── core-worktree.test.ts
│   ├── core-github.test.ts
│   ├── core-claude.test.ts
│   ├── core-tmux.test.ts
│   ├── core-git.test.ts
│   └── core-files.test.ts
├── integration/              # Module interaction testing
│   ├── worktree-github.test.ts
│   ├── claude-tmux.test.ts
│   └── workflow-integration.test.ts
├── e2e/                      # End-to-end workflow testing
│   ├── work-on-task.test.ts
│   ├── review-task.test.ts
│   └── parallel-agents.test.ts
├── fixtures/                 # Test data and mock repositories
│   ├── mock-repositories/
│   ├── test-issues/
│   └── sample-configs/
└── helpers/                  # Test utilities and mocks
    ├── mock-github.ts
    ├── mock-tmux.ts
    └── test-harness.ts
```

## Unit Testing Strategy

### Core Module Testing

#### **core-worktree.test.ts**
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createWorktree, removeWorktree, validateWorktreeState } from '../src/core/worktree';
import { mockGitRepository, cleanupTestRepo } from './helpers/git-helpers';

describe('core-worktree', () => {
  let testRepo: string;

  beforeEach(async () => {
    testRepo = await mockGitRepository();
  });

  afterEach(async () => {
    await cleanupTestRepo(testRepo);
  });

  describe('createWorktree', () => {
    it('should create worktree with simple naming strategy', async () => {
      const result = await createWorktree({
        name: 'test-task',
        sourceBranch: 'main',
        namingStrategy: 'simple',
        repositoryPath: testRepo
      });

      expect(result.name).toBe('test-task');
      expect(result.path).toContain('test-task');
      expect(result.isActive).toBe(true);
    });

    it('should handle agent isolation for parallel development', async () => {
      const agent1 = await createWorktree({
        name: 'task-123',
        agentId: 1,
        namingStrategy: 'timestamped',
        repositoryPath: testRepo
      });

      const agent2 = await createWorktree({
        name: 'task-123', 
        agentId: 2,
        namingStrategy: 'timestamped',
        repositoryPath: testRepo
      });

      expect(agent1.path).not.toBe(agent2.path);
      expect(agent1.branch).not.toBe(agent2.branch);
    });

    it('should throw WorktreeError for invalid repository', async () => {
      expect(async () => {
        await createWorktree({
          name: 'test',
          repositoryPath: '/invalid/path'
        });
      }).toThrow('WORKTREE_INVALID_REPOSITORY');
    });
  });

  describe('validateWorktreeState', () => {
    it('should validate clean worktree state', async () => {
      const worktree = await createWorktree({
        name: 'validation-test',
        repositoryPath: testRepo
      });

      const validation = await validateWorktreeState(worktree.path);
      
      expect(validation.isValid).toBe(true);
      expect(validation.isClean).toBe(true);
      expect(validation.isRegistered).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });
  });
});
```

#### **core-github.test.ts**
```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { detectRepository, getIssue, validateAuthentication } from '../src/core/github';
import { MockOctokit } from './helpers/mock-github';

describe('core-github', () => {
  let mockOctokit: MockOctokit;

  beforeEach(() => {
    mockOctokit = new MockOctokit();
  });

  describe('detectRepository', () => {
    it('should detect GitHub repository from git remote', async () => {
      mockOctokit.mockRepository({
        owner: 'test-owner',
        name: 'test-repo',
        default_branch: 'main'
      });

      const result = await detectRepository();
      
      expect(result.owner).toBe('test-owner');
      expect(result.name).toBe('test-repo');
      expect(result.defaultBranch).toBe('main');
    });

    it('should throw GitHubError for invalid remote', async () => {
      mockOctokit.mockError(404);

      expect(async () => {
        await detectRepository();
      }).toThrow('GITHUB_REPOSITORY_NOT_FOUND');
    });
  });

  describe('getIssueWithRelationships', () => {
    it('should fetch issue with project associations', async () => {
      mockOctokit.mockIssue({
        number: 123,
        title: 'Test issue',
        state: 'open'
      });

      mockOctokit.mockProjectAssociations([
        {
          project: { id: 'proj_1', title: 'Test Project' },
          status: 'Todo'
        }
      ]);

      const result = await getIssueWithRelationships(
        { owner: 'test', name: 'repo' },
        123
      );

      expect(result.number).toBe(123);
      expect(result.projectAssociations).toHaveLength(1);
      expect(result.projectAssociations[0].project.title).toBe('Test Project');
    });
  });
});
```

#### **Mock and Test Helpers**

```typescript
// tests/helpers/mock-github.ts
export class MockOctokit {
  private responses = new Map();

  mockRepository(repo: any) {
    this.responses.set('repos.get', { data: repo });
  }

  mockIssue(issue: any) {
    this.responses.set('issues.get', { data: issue });
  }

  mockError(status: number) {
    this.responses.set('error', { status });
  }

  // Integration with actual Octokit mocking
  install() {
    // Mock Octokit calls using the stored responses
  }
}

// tests/helpers/git-helpers.ts
export async function mockGitRepository(): Promise<string> {
  const tempDir = await fs.mkdtemp('/tmp/claude-swarm-test-');
  
  // Initialize git repository
  await exec('git init', { cwd: tempDir });
  await exec('git config user.name "Test User"', { cwd: tempDir });
  await exec('git config user.email "test@example.com"', { cwd: tempDir });
  
  // Create initial commit
  await fs.writeFile(path.join(tempDir, 'README.md'), '# Test Repository');
  await exec('git add README.md', { cwd: tempDir });
  await exec('git commit -m "Initial commit"', { cwd: tempDir });
  
  return tempDir;
}

export async function cleanupTestRepo(repoPath: string): Promise<void> {
  await fs.rmdir(repoPath, { recursive: true });
}
```

## Integration Testing Strategy

### Module Interaction Testing

#### **Worktree + GitHub Integration**
```typescript
// tests/integration/worktree-github.test.ts
describe('Worktree + GitHub Integration', () => {
  it('should create worktree based on GitHub issue context', async () => {
    // Setup mock GitHub issue
    mockGitHub.mockIssue({
      number: 123,
      title: 'Implement user authentication',
      labels: [{ name: 'feature' }]
    });

    // Test integrated workflow
    const repoInfo = await detectRepository();
    const issue = await getIssue(repoInfo, 123);
    
    const worktree = await createWorktree({
      name: `task-${issue.number}`,
      sourceBranch: repoInfo.defaultBranch
    });

    expect(worktree.name).toBe('task-123');
    expect(worktree.sourceBranch).toBe('main');
  });
});
```

#### **Claude + tmux Integration**
```typescript
// tests/integration/claude-tmux.test.ts
describe('Claude + tmux Integration', () => {
  it('should launch Claude in tmux session', async () => {
    const session = await createTmuxSession({
      name: 'test-claude-session',
      workingDirectory: '/tmp/test'
    });

    const claudeSession = await launchClaudeInteractive({
      workingDirectory: '/tmp/test',
      sessionName: session.name,
      prompt: 'Test prompt'
    });

    expect(claudeSession.sessionName).toBe('test-claude-session');
    expect(claudeSession.isActive).toBe(true);
    
    // Cleanup
    await terminateClaudeSession(claudeSession.sessionName);
    await killSession(session.name);
  });
});
```

## End-to-End Testing Strategy

### Complete Workflow Testing

#### **Work on Task E2E Test**
```typescript
// tests/e2e/work-on-task.test.ts
describe('Work on Task E2E', () => {
  it('should complete full work-on-task workflow', async () => {
    // Setup test environment
    const testRepo = await createTestRepository();
    const mockIssue = await createMockIssue(123);

    // Execute workflow
    const result = await workOnTask({
      issueNumber: 123,
      agentId: 1,
      mode: 'direct'
    });

    // Verify results
    expect(result.success).toBe(true);
    expect(result.worktree).toBeDefined();
    expect(result.session).toBeDefined();
    expect(result.claudeSession).toBeDefined();
    
    // Verify isolation
    const activeAgents = await getActiveAgents(123);
    expect(activeAgents).toHaveLength(1);
    expect(activeAgents[0].id).toBe(1);

    // Cleanup
    await coordinateAgentCleanup(123);
  });

  it('should handle parallel agent coordination', async () => {
    // Launch multiple agents on same issue
    const agent1Promise = workOnTask({
      issueNumber: 456,
      agentId: 1
    });
    
    const agent2Promise = workOnTask({
      issueNumber: 456,
      agentId: 2
    });

    const [result1, result2] = await Promise.all([agent1Promise, agent2Promise]);

    // Verify isolation
    expect(result1.worktree.path).not.toBe(result2.worktree.path);
    expect(result1.session.name).not.toBe(result2.session.name);

    // Verify coordination
    const conflicts = await detectAgentConflicts(456);
    expect(conflicts).toHaveLength(0); // Should be no conflicts due to isolation
  });
});
```

## Performance Testing Strategy

### Performance Benchmarks

```typescript
// tests/performance/benchmarks.test.ts
describe('Performance Benchmarks', () => {
  it('should create worktree within acceptable time', async () => {
    const startTime = performance.now();
    
    await createWorktree({
      name: 'perf-test',
      sourceBranch: 'main'
    });
    
    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(5000); // 5 seconds max
  });

  it('should handle concurrent agent creation efficiently', async () => {
    const agents = Array.from({ length: 10 }, (_, i) => 
      workOnTask({
        issueNumber: 999,
        agentId: i + 1
      })
    );

    const startTime = performance.now();
    const results = await Promise.all(agents);
    const duration = performance.now() - startTime;

    expect(results).toHaveLength(10);
    expect(duration).toBeLessThan(30000); // 30 seconds for 10 agents
  });
});
```

## Test Configuration

### Test Environment Setup

```typescript
// tests/setup.ts
import { beforeAll, afterAll } from 'bun:test';

beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.GITHUB_TOKEN = 'mock-token';
  
  // Setup test database/storage
  await setupTestEnvironment();
  
  // Initialize mocks
  setupGlobalMocks();
});

afterAll(async () => {
  // Cleanup test environment
  await cleanupTestEnvironment();
});

function setupGlobalMocks() {
  // Mock external dependencies
  global.fetch = mockFetch;
  
  // Mock file system operations in test environment
  jest.mock('fs/promises', () => mockFs);
}
```

### Test Data Management

```typescript
// tests/fixtures/test-data.ts
export const TEST_REPOSITORIES = {
  simple: {
    owner: 'test-owner',
    name: 'simple-repo',
    defaultBranch: 'main'
  },
  complex: {
    owner: 'complex-owner', 
    name: 'complex-repo',
    defaultBranch: 'development',
    hasProjects: true,
    issueCount: 50
  }
};

export const TEST_ISSUES = {
  simple: {
    number: 1,
    title: 'Simple test issue',
    state: 'open',
    labels: []
  },
  withProject: {
    number: 2,
    title: 'Issue with project',
    state: 'open',
    labels: [{ name: 'enhancement' }],
    projectAssociations: [
      {
        project: { title: 'Test Project' },
        status: 'Todo'
      }
    ]
  }
};
```

## Continuous Integration Testing

### GitHub Actions Configuration

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - uses: oven-sh/setup-bun@v1
      with:
        bun-version: latest
    
    - run: bun install
    
    - name: Run unit tests
      run: bun test tests/unit/
      
    - name: Run integration tests  
      run: bun test tests/integration/
      
    - name: Run E2E tests
      run: bun test tests/e2e/
      
    - name: Generate coverage report
      run: bun test --coverage
      
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
```

## Testing Tools and Frameworks

### Primary Testing Stack
- **Test Runner**: Bun's built-in test runner
- **Assertions**: Bun's built-in expect API
- **Mocking**: Custom mock implementations for external services
- **Coverage**: Bun's built-in coverage reporting

### External Tool Mocking
- **Git**: Mock git commands using test repositories
- **GitHub API**: Mock Octokit responses
- **tmux**: Mock tmux sessions for CI environment
- **Claude CLI**: Mock Claude commands and responses
- **File System**: Mock file operations for isolation

## Quality Metrics

### Coverage Requirements
- **Unit Tests**: 90% line coverage minimum
- **Integration Tests**: 100% public API coverage
- **E2E Tests**: 100% critical workflow coverage

### Performance Requirements
- **Worktree Creation**: < 5 seconds
- **GitHub API Calls**: < 2 seconds per call
- **Claude Session Launch**: < 10 seconds
- **Full Workflow**: < 30 seconds

### Reliability Requirements
- **Test Suite Pass Rate**: 99.5%
- **Flaky Test Rate**: < 0.1%
- **CI Build Time**: < 10 minutes

## Testing Best Practices

### 1. **Test Isolation**
- Each test should be completely independent
- Use fresh mocks and test data for each test
- Clean up all resources after each test

### 2. **Descriptive Test Names**
```typescript
// Good
it('should create worktree with agent isolation when agentId provided')

// Bad  
it('should create worktree')
```

### 3. **Arrange-Act-Assert Pattern**
```typescript
it('should validate worktree state correctly', async () => {
  // Arrange
  const worktree = await createTestWorktree();
  
  // Act
  const validation = await validateWorktreeState(worktree.path);
  
  // Assert
  expect(validation.isValid).toBe(true);
});
```

### 4. **Error Testing**
```typescript
it('should throw WorktreeError for invalid repository', async () => {
  expect(async () => {
    await createWorktree({ repositoryPath: '/invalid' });
  }).toThrow(WorktreeError);
  
  expect(async () => {
    await createWorktree({ repositoryPath: '/invalid' });
  }).toThrow('WORKTREE_INVALID_REPOSITORY');
});
```

## Implementation Roadmap

### Phase 1: Core Testing Infrastructure
1. Set up test environment and configuration
2. Create mock helpers and test utilities
3. Implement unit tests for shared infrastructure

### Phase 2: Module Unit Testing
1. Unit tests for core-git and core-files (foundational)
2. Unit tests for core-worktree and core-tmux
3. Unit tests for core-github and core-claude

### Phase 3: Integration Testing
1. Module interaction tests
2. Workflow composition tests
3. Error handling integration tests

### Phase 4: E2E and Performance Testing
1. Complete workflow E2E tests
2. Performance benchmarks and optimization
3. CI/CD integration and automation

This comprehensive testing strategy ensures reliable, maintainable, and performant code across the entire Claude Swarm TypeScript migration.