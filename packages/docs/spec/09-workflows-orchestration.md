# Workflows Orchestration Package

← [Back to Index](./README.md) | [Previous: Library Export](./08-library-export.md)

## Purpose

The Workflows package provides agent lifecycle orchestration for Claude Codex's three-agent system (Planning, Coding, Review). It serves as the coordination layer between the UI/API and core operations, managing complete agent lifecycles through composition of core package functions.

## Dependencies

- `@claude-codex/core` - All foundational operations (database, git, tmux, github, claude, files)
- `shared/types.ts` - Workflow interfaces and agent state types
- `shared/errors.ts` - WorkflowError classes extending SwarmError patterns
- `shared/config.ts` - Workflow configuration management

## Architecture Principles

### Composition Over Implementation

Workflows are **orchestrators**, not implementers:
- ✅ Compose existing core package functions
- ✅ Add agent-specific coordination logic  
- ✅ Manage state transitions via core database functions
- ❌ Reimplement git, tmux, or GitHub operations
- ❌ Handle low-level resource management
- ❌ Duplicate core package functionality

### Agent Lifecycle Management

Each agent type has a dedicated workflow class managing its complete lifecycle:
- **CodingAgentWorkflow**: Issue-driven development with review coordination
- **ReviewAgentWorkflow**: Ephemeral code review with feedback delivery
- **PlanningAgentWorkflow**: Requirement gathering and issue creation

### State Management Strategy

- **Database Integration**: All state persisted via core database functions
- **Real-time Updates**: Status changes trigger UI notifications through database events
- **Agent Relationships**: Parent-child relationships tracked for review cycles
- **Error Recovery**: Comprehensive error handling with cleanup procedures

## Core Interfaces

### Base Workflow Interface

```typescript
export interface BaseWorkflow<TConfig, TState> {
  readonly type: WorkflowType;
  
  // Lifecycle management
  execute(config: TConfig): Promise<WorkflowExecution<TState>>;
  terminate(instanceId: string, reason?: string): Promise<void>;
  
  // State management
  getState(instanceId: string): Promise<TState | null>;
  updateState(instanceId: string, updates: Partial<TState>): Promise<void>;
}

export type WorkflowType = 'coding' | 'review' | 'planning';
```

### Workflow Execution Result

```typescript
export interface WorkflowExecution<TState = any> {
  id: string;                    // Instance ID (e.g., "work-123-a1")
  type: WorkflowType;
  status: ExecutionStatus;
  currentState: TState;
  
  // Resource information
  resources: WorkflowResources;
  
  // Metadata
  config: any;                   // Original configuration
  startedAt: Date;
  updatedAt: Date;
  terminatedAt?: Date;
}

export interface WorkflowResources {
  worktreePath: string;
  sessionName: string;
  branch: string;
  claudeSessionId?: string;
}

export type ExecutionStatus = 
  | 'started' 
  | 'running' 
  | 'waiting_review' 
  | 'pr_created' 
  | 'pr_merged' 
  | 'pr_closed' 
  | 'terminated' 
  | 'failed';
```

## Workflow Implementations

### 1. Coding Agent Workflow

**Purpose**: Orchestrates coding agents working on GitHub issues or custom tasks

#### Interface Definition

```typescript
export interface CodingWorkflow extends BaseWorkflow<CodingConfig, CodingAgentState> {
  // Core operations
  execute(config: CodingConfig): Promise<WorkflowExecution<CodingAgentState>>;
  
  // Review management
  requestReview(instanceId: string, reviewConfig?: ReviewConfig): Promise<string>;
  
  // Direct PR creation (bypass review)
  createPullRequest(instanceId: string, prConfig: PullRequestConfig): Promise<string>;
}
```

#### Configuration Interface

```typescript
export interface CodingConfig {
  // Repository context
  repository: RepositoryInfo;      // From core types
  baseBranch: string;
  targetBranch?: string;           // Auto-generated if not provided
  
  // Task context
  issue?: GitHubIssueInfo;         // From core types
  systemPrompt?: string;
  customInstructions?: string;
  
  // Workflow behavior
  requireReview: boolean;          // Default: false
  maxReviewCycles: number;         // Default: 3
  autoCreatePR: boolean;          // Default: false
  executionTimeout?: number;       // Default: 24 hours
  
  // Resource configuration
  worktreeOptions?: Partial<CreateWorktreeOptions>;    // From core
  tmuxOptions?: Partial<CreateTmuxSessionOptions>;     // From core
  claudeOptions?: Partial<ClaudeSessionConfig>;        // From core
}
```

#### State Interface

```typescript
export interface CodingAgentState {
  phase: 'initializing' | 'working' | 'reviewing' | 'completing' | 'cleanup';
  currentTask?: string;
  completedTasks: string[];
  reviewCycles: number;
  lastActivity: Date;
  
  // Error tracking
  errors: string[];
  retryCount: number;
  
  // Git state
  currentBranch: string;
  commitCount: number;
  hasUncommittedChanges: boolean;
}
```

#### Execution Flow

```typescript
async execute(config: CodingConfig): Promise<WorkflowExecution<CodingAgentState>> {
  const instanceId = this.generateInstanceId(config);
  
  try {
    // 1. Create database record using core function
    await this.deps.database.createInstance({
      id: instanceId,
      type: 'coding',
      status: 'started',
      issue_number: config.issue?.number,
      system_prompt: config.systemPrompt,
      created_at: new Date()
    });
    
    // 2. Create worktree using core function
    const worktreeResult = await this.deps.worktree.createWorktree({
      name: instanceId,
      branch: config.targetBranch || `work/${instanceId}`,
      baseBranch: config.baseBranch,
      setupContext: true,
      ...config.worktreeOptions
    });
    
    // 3. Create tmux session using core function
    const sessionResult = await this.deps.tmux.createTmuxSession({
      name: instanceId,
      workingDirectory: worktreeResult.path,
      ...config.tmuxOptions
    });
    
    // 4. Launch Claude session using core function
    const claudeResult = await this.deps.claude.launchClaudeSession({
      workspacePath: worktreeResult.path,
      environmentVars: {
        MCP_SERVER_URL: process.env.MCP_SERVER_URL,
        INSTANCE_ID: instanceId
      },
      ...config.claudeOptions
    });
    
    // 5. Update database with resource information
    await this.deps.database.updateInstance(instanceId, {
      status: 'running',
      worktree_path: worktreeResult.path,
      tmux_session: sessionResult.name,
      branch_name: worktreeResult.branch,
      last_activity: new Date()
    });
    
    // 6. Return execution object
    return { /* execution details */ };
    
  } catch (error) {
    await this.handleWorkflowError(instanceId, error);
    throw error;
  }
}
```

### 2. Review Agent Workflow

**Purpose**: Orchestrates ephemeral review agents that evaluate coding agent work

#### Interface Definition

```typescript
export interface ReviewWorkflow extends BaseWorkflow<ReviewConfig, ReviewAgentState> {
  execute(config: ReviewConfig): Promise<WorkflowExecution<ReviewAgentState>>;
  
  // Review decisions
  approveAndCreatePR(instanceId: string, prConfig: PullRequestConfig): Promise<string>;
  rejectWithFeedback(instanceId: string, feedback: ReviewFeedback): Promise<void>;
}
```

#### Configuration Interface

```typescript
export interface ReviewConfig {
  parentInstanceId: string;        // Coding agent being reviewed
  reviewPrompt?: string;          // Custom review criteria
  maxIterations: number;          // Default: 1 (single review)
  approvalThreshold?: number;     // Confidence threshold for auto-approval
  
  // Fork configuration
  reviewBranch?: string;          // Auto-generated if not provided
  preserveChanges: boolean;       // Default: false
}
```

#### State Interface

```typescript
export interface ReviewAgentState {
  phase: 'forking' | 'analyzing' | 'reviewing' | 'deciding' | 'cleanup';
  parentInstance: string;
  reviewCriteria: string[];
  
  // Analysis results
  findings: ReviewFinding[];
  overallScore?: number;
  confidence: number;
  
  // Decision tracking
  decision?: 'approve' | 'reject' | 'needs_clarification';
  decisionReason?: string;
  feedbackDelivered: boolean;
}
```

### 3. Planning Agent Workflow

**Purpose**: Orchestrates planning agents for requirement gathering and issue creation

#### Interface Definition

```typescript
export interface PlanningWorkflow extends BaseWorkflow<PlanningConfig, PlanningAgentState> {
  execute(config: PlanningConfig): Promise<WorkflowExecution<PlanningAgentState>>;
  
  // Issue creation
  createIssuesFromPlan(instanceId: string): Promise<string[]>;
}
```

#### Configuration Interface

```typescript
export interface PlanningConfig {
  repository: RepositoryInfo;
  planningPrompt?: string;
  issueTemplate?: string;
  
  // Planning scope
  projectArea?: string;
  stakeholders?: string[];
  timeframe?: string;
}
```

#### State Interface

```typescript
export interface PlanningAgentState {
  phase: 'initializing' | 'gathering' | 'planning' | 'documenting' | 'creating_issues';
  requirements: Requirement[];
  artifacts: PlanningArtifact[];
  issuesCreated: number[];
  stakeholderFeedback: FeedbackRecord[];
}
```

## State Management

### Workflow State Manager

```typescript
export interface WorkflowStateManager {
  // Execution management
  createExecution<T>(execution: WorkflowExecution<T>): Promise<void>;
  updateExecutionState<T>(instanceId: string, state: Partial<T>): Promise<void>;
  listActiveExecutions(): Promise<WorkflowExecution[]>;
  getExecutionHistory(instanceId: string): Promise<WorkflowExecution[]>;
  
  // Resource coordination
  allocateResources(config: ResourceRequirements): Promise<ResourceAllocation>;
  releaseResources(instanceId: string): Promise<void>;
  checkResourceAvailability(): Promise<ResourceStatus>;
}
```

### Database Integration Patterns

```typescript
// State persistence using core database functions
await this.deps.database.createInstance({
  id: execution.id,
  type: execution.type,
  status: execution.status,
  worktree_path: execution.resources.worktreePath,
  tmux_session: execution.resources.sessionName,
  branch_name: execution.resources.branch,
  created_at: execution.startedAt
});

// State updates with automatic activity tracking
await this.deps.database.updateInstance(instanceId, {
  last_activity: new Date()
});

// Relationship tracking for review cycles
await this.deps.database.createRelationship({
  parent_instance: codingInstanceId,
  child_instance: reviewInstanceId,
  relationship_type: 'spawned_review',
  review_iteration: reviewCount + 1,
  created_at: new Date()
});
```

## Dependency Injection

### Workflow Dependencies Interface

```typescript
export interface WorkflowDependencies {
  // Core package modules
  worktree: typeof import('@claude-codex/core/worktree');
  tmux: typeof import('@claude-codex/core/tmux');
  claude: typeof import('@claude-codex/core/claude');
  github: typeof import('@claude-codex/core/github');
  files: typeof import('@claude-codex/core/files');
  database: typeof import('@claude-codex/core/database');
  
  // Configuration
  config: () => WorkflowConfig;
}
```

### Default Dependencies (Production)

```typescript
export const defaultDependencies: WorkflowDependencies = {
  worktree: require('@claude-codex/core/worktree'),
  tmux: require('@claude-codex/core/tmux'),
  claude: require('@claude-codex/core/claude'),
  github: require('@claude-codex/core/github'),
  files: require('@claude-codex/core/files'),
  database: require('@claude-codex/core/database'),
  config: () => getConfig().workflows
};
```

### Mock Dependencies (Testing)

```typescript
export const mockWorkflowDependencies: WorkflowDependencies = {
  worktree: mockWorktreeModule,
  tmux: mockTmuxModule,
  claude: mockClaudeModule,
  github: mockGitHubModule,
  files: mockFilesModule,
  database: mockDatabaseModule,
  config: () => mockWorkflowConfig
};
```

## Error Handling

### Workflow Error System

```typescript
// Extends core error patterns
export class WorkflowError extends SwarmError {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(code, "workflow", message, details);
  }
}

export const WORKFLOW_ERROR_CODES = {
  WORKFLOW_INVALID_CONFIGURATION: "WORKFLOW_INVALID_CONFIGURATION",
  WORKFLOW_RESOURCE_ALLOCATION_FAILED: "WORKFLOW_RESOURCE_ALLOCATION_FAILED",
  WORKFLOW_EXECUTION_TIMEOUT: "WORKFLOW_EXECUTION_TIMEOUT",
  WORKFLOW_MAX_REVIEW_CYCLES_EXCEEDED: "WORKFLOW_MAX_REVIEW_CYCLES_EXCEEDED",
  WORKFLOW_AGENT_SPAWN_FAILED: "WORKFLOW_AGENT_SPAWN_FAILED",
  WORKFLOW_STATE_INCONSISTENT: "WORKFLOW_STATE_INCONSISTENT",
  WORKFLOW_CLEANUP_FAILED: "WORKFLOW_CLEANUP_FAILED"
} as const;

export const WorkflowErrorFactory = {
  workflow: (code: string, message: string, details?: Record<string, unknown>) => 
    new WorkflowError(code, message, details)
};
```

### Error Recovery Patterns

```typescript
// Workflow error handling with cleanup
private async handleWorkflowError(instanceId: string, error: any): Promise<void> {
  // Update database with error state
  await this.deps.database.updateInstance(instanceId, {
    status: 'failed',
    terminated_at: new Date()
  });
  
  // Log error using core database function
  await this.deps.database.logMCPEvent({
    instance_id: instanceId,
    tool_name: 'workflow_execute',
    success: false,
    error_message: error.message,
    timestamp: new Date()
  });
  
  // Attempt resource cleanup
  try {
    await this.cleanupResources(instanceId);
  } catch (cleanupError) {
    // Log cleanup failure but don't throw
    console.error(`Cleanup failed for ${instanceId}:`, cleanupError);
  }
}
```

## Configuration

### Workflow Configuration Interface

```typescript
export interface WorkflowConfig {
  coding: {
    defaultSystemPrompt: string;
    requireReview: boolean;
    maxReviewCycles: number;
    executionTimeoutHours: number;
    autoCleanup: boolean;
  };
  
  review: {
    defaultReviewPrompt: string;
    maxIterations: number;
    approvalThreshold: number;
    timeoutMinutes: number;
  };
  
  planning: {
    defaultPlanningPrompt: string;
    issueTemplate: string;
    maxIssuesPerPlan: number;
  };
  
  resources: {
    maxConcurrentInstances: number;
    worktreeBasePath: string;
    cleanupPolicy: 'manual' | 'auto' | 'scheduled';
  };
}

// Extends core configuration
declare module '@claude-codex/core' {
  interface SwarmConfig {
    workflows: WorkflowConfig;
  }
}
```

### Default Configuration Values

```typescript
export function getDefaultWorkflowConfig(): WorkflowConfig {
  return {
    coding: {
      defaultSystemPrompt: "You are a coding agent working on a specific GitHub issue...",
      requireReview: false,
      maxReviewCycles: 3,
      executionTimeoutHours: 24,
      autoCleanup: true
    },
    review: {
      defaultReviewPrompt: "Review the following code changes against the requirements...",
      maxIterations: 1,
      approvalThreshold: 0.8,
      timeoutMinutes: 30
    },
    planning: {
      defaultPlanningPrompt: "Create a comprehensive plan for the following project...",
      issueTemplate: "## Summary\n\n## Requirements\n\n## Acceptance Criteria",
      maxIssuesPerPlan: 10
    },
    resources: {
      maxConcurrentInstances: 5,
      worktreeBasePath: '../worktrees',
      cleanupPolicy: 'auto'
    }
  };
}
```

## Usage Patterns

### UI Server Integration

```typescript
// UI Server creates coding agents
import { CodingAgentWorkflow, WorkflowStateManager } from '@claude-codex/workflows';

const codingWorkflow = new CodingAgentWorkflow();
const stateManager = new WorkflowStateManager();

// Create new coding agent
const execution = await codingWorkflow.execute({
  repository: repositoryInfo,
  baseBranch: 'main',
  issue: issueInfo,
  requireReview: true,
  maxReviewCycles: 3
});

// Monitor active executions
const activeExecutions = await stateManager.listActiveExecutions();
```

### MCP Server Integration

```typescript
// MCP Server spawns review agents
import { ReviewAgentWorkflow } from '@claude-codex/workflows';

const reviewWorkflow = new ReviewAgentWorkflow();

// Spawn review agent for coding agent
const reviewExecution = await reviewWorkflow.execute({
  parentInstanceId: 'work-123-a1',
  reviewPrompt: customReviewCriteria,
  maxIterations: 1,
  preserveChanges: false
});
```

### Agent Relationship Management

```typescript
// Check review limits before spawning
const relationships = await this.deps.database.getInstanceRelationships(instanceId);
const reviewCount = relationships.filter(r => r.relationship_type === 'spawned_review').length;

if (reviewCount >= maxReviews) {
  throw WorkflowErrorFactory.workflow(
    WORKFLOW_ERROR_CODES.WORKFLOW_MAX_REVIEW_CYCLES_EXCEEDED, 
    `Maximum review cycles (${maxReviews}) exceeded for instance ${instanceId}`
  );
}

// Create relationship tracking
await this.deps.database.createRelationship({
  parent_instance: codingInstanceId,
  child_instance: reviewInstanceId,
  relationship_type: 'spawned_review',
  review_iteration: reviewCount + 1,
  created_at: new Date()
});
```

## Testing Strategy

### Unit Testing Approach

```typescript
describe('CodingAgentWorkflow', () => {
  let workflow: CodingAgentWorkflow;
  let mockDeps: WorkflowDependencies;
  
  beforeEach(() => {
    mockDeps = mockWorkflowDependencies;
    workflow = new CodingAgentWorkflow(mockDeps);
  });
  
  it('should create coding agent with proper resource allocation', async () => {
    const config: CodingConfig = {
      repository: mockRepositoryInfo,
      baseBranch: 'main',
      issue: mockIssueInfo
    };
    
    const execution = await workflow.execute(config);
    
    expect(execution.type).toBe('coding');
    expect(execution.status).toBe('running');
    expect(mockDeps.database.createInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'coding',
        status: 'started'
      })
    );
  });
  
  it('should handle review cycle limits properly', async () => {
    // Mock existing relationships
    mockDeps.database.getInstanceRelationships.mockResolvedValue([
      { relationship_type: 'spawned_review' },
      { relationship_type: 'spawned_review' },
      { relationship_type: 'spawned_review' }
    ]);
    
    await expect(workflow.requestReview('work-123-a1'))
      .rejects.toThrow('Maximum review cycles');
  });
});
```

### Integration Testing Approach

```typescript
describe('Workflow Integration', () => {
  it('should coordinate coding → review → PR workflow', async () => {
    // Create coding agent
    const codingExecution = await codingWorkflow.execute(codingConfig);
    
    // Request review
    const reviewInstanceId = await codingWorkflow.requestReview(codingExecution.id);
    
    // Review approves and creates PR
    const prUrl = await reviewWorkflow.approveAndCreatePR(reviewInstanceId, prConfig);
    
    // Verify final state
    const finalInstance = await database.getInstance(codingExecution.id);
    expect(finalInstance.status).toBe('pr_created');
  });
});
```

### Mock Strategy

```typescript
// Mock all core dependencies for isolated testing
export const mockWorkflowDependencies: WorkflowDependencies = {
  worktree: {
    createWorktree: vi.fn().mockResolvedValue({ path: '/mock/worktree', branch: 'work-123' }),
    removeWorktree: vi.fn().mockResolvedValue(true)
  },
  tmux: {
    createTmuxSession: vi.fn().mockResolvedValue({ name: 'work-123-a1' }),
    killSession: vi.fn().mockResolvedValue(true)
  },
  claude: {
    launchClaudeSession: vi.fn().mockResolvedValue({ sessionId: 'claude-123' }),
    terminateClaudeSession: vi.fn().mockResolvedValue(true)
  },
  database: {
    createInstance: vi.fn().mockResolvedValue('work-123-a1'),
    updateInstance: vi.fn().mockResolvedValue(undefined),
    createRelationship: vi.fn().mockResolvedValue(undefined)
  },
  // ... other mocks
};
```

## Performance Considerations

### Resource Management

- **Concurrent Limits**: Enforce maximum concurrent agent instances
- **Resource Pooling**: Reuse tmux sessions and worktrees when possible
- **Cleanup Policies**: Automatic cleanup of idle or completed agents
- **Memory Management**: Periodic state cleanup for long-running agents

### Database Optimization

- **Batch Operations**: Group multiple database updates into transactions
- **Index Utilization**: Ensure proper indexing for instance and relationship queries
- **Query Optimization**: Use efficient queries for dashboard and monitoring

### Monitoring and Metrics

- **Execution Tracking**: Monitor workflow execution times and success rates
- **Resource Utilization**: Track worktree and session usage
- **Error Analytics**: Analyze error patterns for improvement opportunities

## Package Structure

```
packages/workflows/
├── src/
│   ├── workflows/                  # Agent lifecycle implementations
│   │   ├── coding-agent-workflow.ts
│   │   ├── review-agent-workflow.ts
│   │   ├── planning-agent-workflow.ts
│   │   └── base-workflow.ts
│   ├── state/                      # State management
│   │   ├── workflow-state-manager.ts
│   │   └── instance-coordinator.ts
│   ├── types/                      # Workflow-specific types
│   │   ├── workflow-config.ts
│   │   ├── workflow-execution.ts
│   │   ├── agent-states.ts
│   │   └── index.ts
│   ├── errors/                     # Error handling
│   │   ├── workflow-errors.ts
│   │   └── index.ts
│   └── index.ts                    # Public API exports
├── tests/
│   ├── unit/                       # Individual workflow tests
│   │   ├── coding-workflow.test.ts
│   │   ├── review-workflow.test.ts
│   │   └── planning-workflow.test.ts
│   ├── integration/                # Workflow coordination tests
│   │   ├── workflow-coordination.test.ts
│   │   └── core-integration.test.ts
│   └── fixtures/                   # Test data and mocks
│       ├── mock-dependencies.ts
│       └── test-data.ts
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── biome.json                      # Code formatting and linting
└── vitest.config.ts               # Test configuration
```

## Public API Exports

```typescript
// Main workflow classes
export { CodingAgentWorkflow } from './workflows/coding-agent-workflow';
export { ReviewAgentWorkflow } from './workflows/review-agent-workflow';
export { PlanningAgentWorkflow } from './workflows/planning-agent-workflow';

// State management
export { WorkflowStateManager } from './state/workflow-state-manager';
export { InstanceCoordinator } from './state/instance-coordinator';

// Type exports
export type {
  BaseWorkflow,
  WorkflowExecution,
  WorkflowResources,
  CodingConfig,
  CodingAgentState,
  ReviewConfig,
  ReviewAgentState,
  PlanningConfig,
  PlanningAgentState
} from './types';

// Error handling
export { WORKFLOW_ERROR_CODES, WorkflowErrorFactory } from './errors';

// Configuration
export type { WorkflowConfig, WorkflowDependencies } from './types';
export { getDefaultWorkflowConfig, defaultDependencies } from './config';
```

## Implementation Priority

### Phase 1: Core Infrastructure (Week 1)
1. **Package Setup**: Directory structure, dependencies, configuration
2. **Base Interfaces**: `BaseWorkflow`, `WorkflowExecution`, types
3. **CodingAgentWorkflow**: Complete implementation with core integration
4. **Error Handling**: Workflow error system extending core patterns
5. **Basic Testing**: Unit tests with mocked dependencies

### Phase 2: Agent Coordination (Week 2)
1. **ReviewAgentWorkflow**: Complete review lifecycle implementation
2. **WorkflowStateManager**: Database integration and state tracking
3. **Agent Relationships**: Review cycle management and limits
4. **Integration Testing**: Multi-workflow coordination scenarios

### Phase 3: Production Features (Week 3)
1. **PlanningAgentWorkflow**: Issue creation and planning workflows
2. **Advanced Features**: Resource management, monitoring, cleanup
3. **Performance Optimization**: Concurrent handling, resource pooling
4. **Documentation**: API docs, usage guides, examples

## Success Criteria

- ✅ All workflow classes implement complete agent lifecycles
- ✅ Database integration provides full state persistence and tracking
- ✅ Error handling includes recovery and cleanup procedures
- ✅ Dependency injection enables comprehensive testing
- ✅ Integration patterns support MCP server and UI server coordination
- ✅ Performance meets requirements for concurrent agent management
- ✅ Documentation provides clear implementation guidance

---

*This Workflows Orchestration Package specification provides the complete architecture for agent lifecycle management in Claude Codex, enabling the three-agent system through composition of core package functionality while maintaining clean separation of concerns and comprehensive state management.*