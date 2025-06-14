# Core Claude Integration Module Implementation Prompt

<instructions>
Implement the core-claude module for the Claude Swarm TypeScript migration project using Test-Driven Development (TDD) methodology. This module provides Claude Code integration operations supporting AI-assisted development workflows, session management, and intelligent code generation across all Claude Swarm operations.

Build a robust, testable, and well-documented Claude Code integration module that:
- Manages Claude Code session discovery, launch, and lifecycle management
- Handles intelligent code generation and analysis with context awareness
- Provides seamless integration with worktree and repository management
- Supports automated workflow execution with AI assistance
- Follows the established error handling and configuration patterns
- Integrates with core-files for context management and core-worktree for workspace integration

Create the module at `src/core/claude.ts` with comprehensive tests following TDD principles.

## Required Reading

Before implementation, review these specification files for context and integration requirements:

1. **Core Architecture**: `spec/prompts/core-files-implementation.md` - Reference implementation showing TDD methodology, error handling patterns, and testing structure that should be mirrored in this module.

2. **Related Core Modules**: 
   - `spec/prompts/core-github-implementation.md` - GitHub integration patterns that Claude workflows will orchestrate
   - `spec/core-git.md` - Git operations interface that Claude will use for repository management
   - `spec/core-worktree.md` - Worktree management patterns for Claude workspace integration
   - `spec/core-files.md` - File operations and context management for Claude Code

3. **Workflow Integration**:
   - `spec/workflows/work-on-task.md` - Primary consumer of Claude Code AI assistance
   - `spec/workflows/review-task.md` - Code review automation with Claude analysis
   - `spec/workflows/sync-repository.md` - Repository synchronization with AI guidance

4. **Shared Infrastructure**:
   - `src/shared/errors.ts` - Existing error codes and patterns (CLAUDE_* codes already defined)
   - `src/shared/types.ts` - Repository and context interfaces that Claude will extend
   - `src/shared/validation.ts` - CommonValidators for input validation

5. **Testing Reference**: 
   - `tests/unit/core/github.test.ts` - Comprehensive TDD test structure with dependency injection
   - `tests/unit/core/worktree.test.ts` - Advanced mock testing patterns for system integration
   - `tests/fixtures/` - Test data patterns and mock structures

These specifications provide the context for proper integration with existing modules and adherence to established patterns.
</instructions>

<requirements>
Functional Requirements:
- `launchClaudeSession()` - Launch new Claude Code sessions with workspace configuration
- `findActiveClaudeSessions()` - Discover and connect to existing Claude sessions
- `executeClaudeCommand()` - Execute commands in Claude Code with error handling and timeouts
- `analyzeCodeWithClaude()` - Request Claude analysis of code with context awareness
- `generateCodeWithClaude()` - Generate code using Claude with repository context
- `reviewCodeWithClaude()` - Automated code review using Claude AI capabilities
- `optimizeCodeWithClaude()` - Code optimization suggestions and implementation
- `explainCodeWithClaude()` - Generate code explanations and documentation
- `setupClaudeWorkspace()` - Configure Claude workspace with project context
- `getClaudeSessionStatus()` - Monitor Claude session health and connectivity
- `terminateClaudeSession()` - Gracefully shutdown Claude sessions with cleanup
- `validateClaudeInstallation()` - Check Claude Code installation and version compatibility
- `configureClaudeSettings()` - Manage Claude Code preferences and API settings
- `handleClaudeContext()` - Manage CLAUDE.md and context file synchronization

Technical Requirements:
- TypeScript with strict type checking and 90%+ test coverage
- Use shared types from `@/shared/types` with Claude-specific extensions
- Use standardized error handling from `@/shared/errors`
- Use validation utilities from `@/shared/validation`
- Integrate with core-files for context management and CLAUDE.md handling
- Integrate with core-worktree for workspace and session isolation
- Support Claude Code CLI and API integration with proper error handling
- Handle Claude session lifecycle with automatic recovery and reconnection
- Provide atomic operations with proper cleanup on failures
- Support both local and remote Claude Code instances

Interface Requirements:
- Export all functions as named exports
- Use ClaudeSession interface with status and metadata tracking
- Accept configuration objects for customization behavior
- Return structured result objects with detailed status information
- Support dependency injection for testing (ClaudeInterface, ProcessOperations)
- Provide both synchronous validation and asynchronous Claude operations
</requirements>

<architecture>
Layer Position: Core Layer (src/core/)
- Used by: workflows/work-on-task, workflows/review-task, workflows/sync-repository
- Uses: shared/types, shared/errors, shared/validation, core/files, core/worktree, Node.js child_process, fs/promises
- Dependencies: core-files (for context management), core-worktree (for workspace setup), shared infrastructure

Design Patterns:
- Dependency injection for Claude Code operations and process management (enables testing)
- Factory pattern for creating Claude sessions with different configurations
- Strategy pattern for different Claude operation types (code generation, analysis, review)
- Command pattern for atomic Claude operations with rollback capabilities
- Observer pattern for Claude session monitoring and health checking
- Retry pattern with exponential backoff for Claude API calls and session management

File Structure:
```
src/core/claude.ts                      # Main implementation
tests/unit/core/claude.test.ts           # Unit tests with mocked Claude operations
tests/integration/claude.test.ts        # Integration tests with real Claude Code
tests/fixtures/claude-responses.json    # Mock Claude response data
tests/helpers/claude-test-utils.ts      # Claude testing utilities
```

Error Handling:
- Use ERROR_CODES.CLAUDE_* for all Claude-specific errors
- Handle Claude Code installation and version compatibility issues
- Manage session timeouts and connectivity problems gracefully
- Provide detailed error context for debugging Claude integration issues
- Support automatic retry for transient Claude API failures
</architecture>

<implementation-phases>
## Phase 1: Session Management Foundation (TDD)
**Dependencies**: Process operations, session discovery
- Write tests for `validateClaudeInstallation()` - Check Claude Code availability
- Write tests for `launchClaudeSession()` - Session creation with workspace context
- Write tests for `findActiveClaudeSessions()` - Session discovery and connection
- Write tests for `getClaudeSessionStatus()` - Health monitoring and status checks
- Write tests for `terminateClaudeSession()` - Graceful session cleanup

**Test Focus**: Mock process operations, session state management, error handling for installation issues

## Phase 2: Core Claude Operations (TDD)
**Dependencies**: Session management, command execution
- Write tests for `executeClaudeCommand()` - Command execution with timeout handling
- Write tests for `setupClaudeWorkspace()` - Workspace configuration and context setup
- Write tests for `configureClaudeSettings()` - Settings management and preferences
- Write tests for `handleClaudeContext()` - CLAUDE.md synchronization and context management

**Test Focus**: Command execution mocking, workspace setup validation, context file management

## Phase 3: AI-Assisted Development Features (TDD)
**Dependencies**: Core operations, context management
- Write tests for `analyzeCodeWithClaude()` - Code analysis with repository context
- Write tests for `generateCodeWithClaude()` - Code generation with project integration
- Write tests for `reviewCodeWithClaude()` - Automated code review workflows
- Write tests for `optimizeCodeWithClaude()` - Performance optimization suggestions

**Test Focus**: Mock Claude AI responses, context awareness testing, code quality validation

## Phase 4: Advanced Features and Integration (TDD)
**Dependencies**: All previous phases
- Write tests for `explainCodeWithClaude()` - Documentation generation and explanations
- Write tests for complex workflow integration scenarios
- Write tests for error recovery and session reconnection
- Write tests for concurrent session management and isolation

**Test Focus**: Integration with other core modules, workflow orchestration, advanced error scenarios

## Phase 5: Performance and Reliability (TDD)
**Dependencies**: Complete feature set
- Write tests for session pooling and resource management
- Write tests for Claude API rate limiting and backoff strategies
- Write tests for large codebase handling and context optimization
- Write tests for cross-platform compatibility and process management

**Test Focus**: Performance testing, resource cleanup, scalability concerns

## Phase 6: Integration Testing (Optional)
**Dependencies**: Real Claude Code installation
- Create tests with actual Claude Code CLI
- Test real workspace setup and context synchronization
- Validate actual AI responses and code generation
- Test session lifecycle with real process management
</implementation-phases>

<testing-strategy>
## Mock Strategy
- **MockClaudeInterface**: Complete Claude Code operation simulation
- **MockProcessOperations**: Child process and CLI command mocking  
- **MockFileOperations**: Context file and workspace management mocking
- **Test Fixtures**: Pre-defined Claude responses, session configurations, and workspace setups

## Test Coverage Requirements
- Session lifecycle management: 95% coverage
- Command execution and error handling: 90% coverage
- AI operation mocking and validation: 85% coverage
- Integration points with other core modules: 90% coverage
- Cross-platform process management: 80% coverage

## Integration Test Requirements (Optional)
- Real Claude Code installation and session management
- Actual workspace setup with repository context
- Live AI operations with response validation
- Performance testing with large codebases
- Cross-platform compatibility validation
</testing-strategy>

<expected-interfaces>
```typescript
// Core Claude session management
export interface ClaudeSession {
  id: string;
  pid: number;
  workspacePath: string;
  status: 'launching' | 'active' | 'idle' | 'error' | 'terminated';
  startTime: Date;
  lastActivity?: Date;
  config: ClaudeSessionConfig;
  contextStatus: ClaudeContextStatus;
}

export interface ClaudeSessionConfig {
  workspacePath: string;
  modelPreferences?: ClaudeModelConfig;
  contextFiles?: string[];
  environmentVars?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface ClaudeContextStatus {
  claudeMdExists: boolean;
  claudeDirExists: boolean;
  contextFilesCount: number;
  lastSyncTime?: Date;
  isComplete: boolean;
}

// AI operation interfaces
export interface ClaudeAnalysisRequest {
  code: string;
  filePath?: string;
  analysisType: 'quality' | 'security' | 'performance' | 'maintainability' | 'comprehensive';
  includeContext?: boolean;
  contextFiles?: string[];
}

export interface ClaudeAnalysisResult {
  summary: string;
  issues: ClaudeCodeIssue[];
  suggestions: ClaudeCodeSuggestion[];
  score?: number;
  confidence: number;
  analysisTime: number;
}

export interface ClaudeCodeIssue {
  type: 'error' | 'warning' | 'suggestion' | 'info';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  line?: number;
  column?: number;
  rule?: string;
  fix?: ClaudeCodeFix;
}

export interface ClaudeCodeSuggestion {
  type: 'optimization' | 'refactor' | 'style' | 'architecture';
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  code?: string;
  explanation?: string;
}

export interface ClaudeGenerationRequest {
  prompt: string;
  generationType: 'function' | 'class' | 'module' | 'test' | 'documentation' | 'fix';
  context?: {
    filePath?: string;
    existingCode?: string;
    requirements?: string[];
    style?: 'typescript' | 'javascript' | 'functional' | 'oop';
  };
  constraints?: {
    maxLines?: number;
    includeTests?: boolean;
    includeComments?: boolean;
    followExistingPatterns?: boolean;
  };
}

export interface ClaudeGenerationResult {
  success: boolean;
  generatedCode: string;
  explanation?: string;
  suggestions?: string[];
  confidence: number;
  warnings?: string[];
  generationTime: number;
}

// Command execution interfaces
export interface ClaudeCommandOptions {
  timeout?: number;
  retries?: number;
  silent?: boolean;
  workingDirectory?: string;
  environmentVars?: Record<string, string>;
}

export interface ClaudeCommandResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  executionTime: number;
  command: string;
}

// Session management results
export interface LaunchSessionResult {
  success: boolean;
  session: ClaudeSession;
  warnings?: string[];
}

export interface SessionDiscoveryResult {
  activeSessions: ClaudeSession[];
  totalFound: number;
  errors?: SessionDiscoveryError[];
}

export interface SessionDiscoveryError {
  pid: number;
  error: string;
  recoverable: boolean;
}

// Process operations interface for dependency injection
export interface ProcessOperationsInterface {
  spawn(command: string, args: string[], options?: any): Promise<any>;
  exec(command: string, options?: any): Promise<{ stdout: string; stderr: string }>;
  kill(pid: number, signal?: string): Promise<boolean>;
  findProcesses(pattern: string): Promise<ProcessInfo[]>;
  isProcessRunning(pid: number): Promise<boolean>;
}

export interface ProcessInfo {
  pid: number;
  command: string;
  args: string[];
  workingDirectory?: string;
  startTime: Date;
}

// Claude Code interface for dependency injection
export interface ClaudeInterface {
  launch(config: ClaudeSessionConfig): Promise<ClaudeSession>;
  execute(sessionId: string, command: string, options?: ClaudeCommandOptions): Promise<ClaudeCommandResult>;
  analyze(sessionId: string, request: ClaudeAnalysisRequest): Promise<ClaudeAnalysisResult>;
  generate(sessionId: string, request: ClaudeGenerationRequest): Promise<ClaudeGenerationResult>;
  getStatus(sessionId: string): Promise<ClaudeSession>;
  terminate(sessionId: string): Promise<boolean>;
  validateInstallation(): Promise<ClaudeInstallationInfo>;
}

export interface ClaudeInstallationInfo {
  isInstalled: boolean;
  version?: string;
  path?: string;
  compatible: boolean;
  issues?: string[];
}
```
</expected-interfaces>

<integration-examples>
## Example: AI-Assisted Task Development
```typescript
// From workflow-work-on-task.ts integration
import { 
  launchClaudeSession, 
  analyzeCodeWithClaude, 
  generateCodeWithClaude,
  setupClaudeWorkspace 
} from '@/core/claude';

export async function executeTaskWithAI(taskInfo: TaskInfo, worktreePath: string) {
  // Setup Claude workspace with task context
  const contextStatus = await setupClaudeWorkspace(worktreePath, {
    taskContext: taskInfo,
    includeRepository: true,
    syncFromMain: true
  });

  // Launch Claude session for this task
  const sessionResult = await launchClaudeSession({
    workspacePath: worktreePath,
    contextFiles: contextStatus.contextFiles,
    taskId: taskInfo.id
  });

  // Analyze existing code for context
  const analysis = await analyzeCodeWithClaude(sessionResult.session.id, {
    code: await readTaskRelatedFiles(worktreePath),
    analysisType: 'comprehensive',
    includeContext: true
  });

  // Generate implementation with AI assistance
  const generation = await generateCodeWithClaude(sessionResult.session.id, {
    prompt: `Implement ${taskInfo.title}: ${taskInfo.description}`,
    generationType: 'function',
    context: {
      existingCode: analysis.relevantCode,
      requirements: taskInfo.requirements,
      style: 'typescript'
    },
    constraints: {
      followExistingPatterns: true,
      includeTests: true,
      includeComments: true
    }
  });

  return {
    analysisResult: analysis,
    generatedCode: generation,
    session: sessionResult.session
  };
}
```

## Example: Code Review Automation
```typescript
// From workflow-review-task.ts integration
import { reviewCodeWithClaude, findActiveClaudeSessions } from '@/core/claude';

export async function automatedCodeReview(pullRequestInfo: PullRequestInfo) {
  // Find or create Claude session for review
  const sessions = await findActiveClaudeSessions();
  const reviewSession = sessions.activeSessions.find(s => 
    s.workspacePath === pullRequestInfo.workspacePath
  ) || await launchClaudeSession({
    workspacePath: pullRequestInfo.workspacePath,
    contextFiles: await getReviewContext(pullRequestInfo)
  });

  // Perform AI-assisted code review
  const reviewResult = await reviewCodeWithClaude(reviewSession.session.id, {
    changedFiles: pullRequestInfo.changedFiles,
    diffContent: pullRequestInfo.diff,
    reviewType: 'comprehensive',
    focusAreas: ['security', 'performance', 'maintainability'],
    includeContext: true
  });

  return {
    reviewComments: reviewResult.comments,
    overallScore: reviewResult.score,
    recommendations: reviewResult.suggestions,
    approvalStatus: reviewResult.recommendedAction
  };
}
```

## Example: Context Management Integration
```typescript
// Integration with core-files and core-worktree
import { handleClaudeContext, configureClaudeSettings } from '@/core/claude';
import { ensureClaudeContext } from '@/core/files';
import { createWorktree } from '@/core/worktree';

export async function setupAIWorkspace(taskName: string, repositoryPath: string) {
  // Create isolated worktree
  const worktreeResult = await createWorktree({
    name: taskName,
    setupContext: true,
    aiEnabled: true
  });

  // Ensure Claude context is properly configured
  const contextStatus = await ensureClaudeContext(
    worktreeResult.path, 
    repositoryPath
  );

  // Configure Claude settings for this workspace
  await configureClaudeSettings(worktreeResult.path, {
    modelPreferences: {
      primary: 'claude-3-5-sonnet-20241022',
      fallback: 'claude-3-haiku-20240307'
    },
    contextOptimization: true,
    autoSave: true,
    workflowIntegration: true
  });

  // Synchronize Claude context files
  await handleClaudeContext(worktreeResult.path, {
    syncFromRepository: true,
    updateContextFiles: true,
    validateCompleteness: true
  });

  return {
    worktreePath: worktreeResult.path,
    contextStatus,
    claudeReady: true
  };
}
```
</integration-examples>

<success-criteria>
## Implementation Success Criteria
1. **Test Coverage**: 90%+ coverage with comprehensive mock testing
2. **Session Management**: Reliable session lifecycle with automatic recovery
3. **AI Integration**: Robust Claude Code integration with error handling
4. **Context Awareness**: Seamless CLAUDE.md and context file management
5. **Workflow Integration**: Clean integration points for workflow orchestration
6. **Performance**: Efficient session pooling and resource management
7. **Cross-Platform**: Works on macOS, Linux, and Windows environments
8. **Error Handling**: Comprehensive error recovery and user-friendly messages

## Quality Gates
- All tests must pass with no regressions
- TypeScript compilation must succeed with strict checking
- Linting must pass with established code standards
- Integration points must be validated with other core modules
- Documentation must be complete for all public interfaces
- Error scenarios must have appropriate recovery mechanisms
</success-criteria>