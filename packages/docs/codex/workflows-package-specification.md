# Workflows Package Specification

This document defines the Workflows package for Claude Codex, which provides agent lifecycle orchestration by composing functions from the core package. The workflows package serves as the coordination layer between the UI/API and the foundational core operations.

## Overview

The Workflows package implements **agent lifecycle management** as thin orchestration layers that compose core package functions. Each workflow type manages the complete lifecycle of a specific agent type while maintaining clean separation from the underlying implementation details.

### Core Principle: Composition Over Implementation

Workflows are **orchestrators**, not implementers:
- ✅ Compose existing core package functions
- ✅ Add agent-specific coordination logic
- ✅ Manage state transitions via core database functions
- ❌ Reimplement git, tmux, or GitHub operations
- ❌ Handle low-level resource management
- ❌ Duplicate core package functionality

## Package Architecture

### Package Location
```
packages/workflows/
├── src/
│   ├── workflows/              # Agent lifecycle implementations
│   │   ├── coding-agent-workflow.ts
│   │   ├── review-agent-workflow.ts
│   │   └── planning-agent-workflow.ts
│   ├── state/                  # State management (uses core database)
│   │   ├── workflow-state-manager.ts
│   │   └── instance-coordinator.ts
│   ├── types/                  # Workflow-specific types
│   │   ├── workflow-config.ts
│   │   ├── workflow-execution.ts
│   │   └── agent-states.ts
│   └── index.ts               # Public API exports
├── tests/
│   ├── unit/                  # Individual workflow tests
│   ├── integration/           # Workflow coordination tests
│   └── fixtures/              # Test data and mocks
└── package.json
```

### Dependencies
```json
{
  "dependencies": {
    "@claude-codex/core": "workspace:*"
  },
  "devDependencies": {
    "@claude-codex/core": "workspace:*"
  }
}
```

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

### Workflow Execution
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

**Purpose**: Orchestrates the complete lifecycle of a coding agent working on a GitHub issue or custom task.

```typescript
export interface CodingWorkflow extends BaseWorkflow<CodingConfig, CodingAgentState> {
  // Core operations
  execute(config: CodingConfig): Promise<WorkflowExecution<CodingAgentState>>;
  
  // Review management
  requestReview(instanceId: string, reviewConfig?: ReviewConfig): Promise<string>;
  
  // Direct PR creation (bypass review)
  createPullRequest(instanceId: string, prConfig: PullRequestConfig): Promise<string>;
}

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

**Implementation Pattern**:
```typescript
export class CodingAgentWorkflow implements CodingWorkflow {
  readonly type = 'coding' as const;
  
  constructor(
    private deps: WorkflowDependencies = defaultDependencies
  ) {}
  
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
      return {
        id: instanceId,
        type: 'coding',
        status: 'running',
        currentState: {
          phase: 'working',
          completedTasks: [],
          reviewCycles: 0,
          lastActivity: new Date(),
          errors: [],
          retryCount: 0,
          currentBranch: worktreeResult.branch,
          commitCount: 0,
          hasUncommittedChanges: false
        },
        resources: {
          worktreePath: worktreeResult.path,
          sessionName: sessionResult.name,
          branch: worktreeResult.branch,
          claudeSessionId: claudeResult.sessionId
        },
        config,
        startedAt: new Date(),
        updatedAt: new Date()
      };
      
    } catch (error) {
      // Use core error handling patterns
      await this.handleWorkflowError(instanceId, error);
      throw error;
    }
  }
  
  async requestReview(instanceId: string, reviewConfig?: ReviewConfig): Promise<string> {
    // Check review limits using core database functions
    const relationships = await this.deps.database.getInstanceRelationships(instanceId);
    const reviewCount = relationships.filter(r => r.relationship_type === 'spawned_review').length;
    
    const instance = await this.deps.database.getInstance(instanceId);
    const maxReviews = reviewConfig?.maxCycles || 3;
    
    if (reviewCount >= maxReviews) {
      throw ErrorFactory.workflow(ERROR_CODES.WORKFLOW_MAX_REVIEW_CYCLES_EXCEEDED, 
        `Maximum review cycles (${maxReviews}) exceeded for instance ${instanceId}`);
    }
    
    // Update status to waiting_review
    await this.deps.database.updateInstanceStatus(instanceId, 'waiting_review');
    
    // Return review instance ID (will be created by MCP tool)
    return `review-${instance.issue_number}-a${reviewCount + 1}`;
  }
  
  private generateInstanceId(config: CodingConfig): string {
    if (config.issue) {
      return `work-${config.issue.number}-a1`; // TODO: Handle parallel agents
    }
    return `adhoc-${Date.now()}`;
  }
  
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
  }
}
```

### 2. Review Agent Workflow

**Purpose**: Orchestrates ephemeral review agents that evaluate coding agent work and provide feedback.

```typescript
export interface ReviewWorkflow extends BaseWorkflow<ReviewConfig, ReviewAgentState> {
  execute(config: ReviewConfig): Promise<WorkflowExecution<ReviewAgentState>>;
  
  // Review decisions
  approveAndCreatePR(instanceId: string, prConfig: PullRequestConfig): Promise<string>;
  rejectWithFeedback(instanceId: string, feedback: ReviewFeedback): Promise<void>;
}

export interface ReviewConfig {
  parentInstanceId: string;        // Coding agent being reviewed
  reviewPrompt?: string;          // Custom review criteria
  maxIterations: number;          // Default: 1 (single review)
  approvalThreshold?: number;     // Confidence threshold for auto-approval
  
  // Fork configuration
  reviewBranch?: string;          // Auto-generated if not provided
  preserveChanges: boolean;       // Default: false
}

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

**Purpose**: Orchestrates planning agents for requirement gathering and issue creation.

```typescript
export interface PlanningWorkflow extends BaseWorkflow<PlanningConfig, PlanningAgentState> {
  execute(config: PlanningConfig): Promise<WorkflowExecution<PlanningAgentState>>;
  
  // Issue creation
  createIssuesFromPlan(instanceId: string): Promise<string[]>;
}

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

## State Management

### Workflow State Manager

```typescript
export class WorkflowStateManager {
  constructor(private deps: WorkflowDependencies) {}
  
  async createExecution<T>(execution: WorkflowExecution<T>): Promise<void> {
    // Uses core database functions
    await this.deps.database.createInstance({
      id: execution.id,
      type: execution.type,
      status: execution.status,
      worktree_path: execution.resources.worktreePath,
      tmux_session: execution.resources.sessionName,
      branch_name: execution.resources.branch,
      created_at: execution.startedAt
    });
  }
  
  async updateExecutionState<T>(
    instanceId: string, 
    state: Partial<T>
  ): Promise<void> {
    await this.deps.database.updateInstance(instanceId, {
      last_activity: new Date()
    });
    
    // Store state in metadata or separate state table
    // Implementation depends on state complexity
  }
  
  async listActiveExecutions(): Promise<WorkflowExecution[]> {
    const instances = await this.deps.database.listInstances({
      status: ['started', 'running', 'waiting_review']
    });
    
    return instances.map(this.instanceToExecution);
  }
}
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

// Default dependencies (production)
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
  WORKFLOW_AGENT_SPAWN_FAILED: "WORKFLOW_AGENT_SPAWN_FAILED"
} as const;

export const WorkflowErrorFactory = {
  workflow: (code: string, message: string, details?: Record<string, unknown>) => 
    new WorkflowError(code, message, details)
};
```

## Configuration

### Workflow Configuration

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

## Testing Strategy

### Test Structure
```
tests/
├── unit/
│   ├── coding-workflow.test.ts
│   ├── review-workflow.test.ts
│   └── planning-workflow.test.ts
├── integration/
│   ├── workflow-coordination.test.ts
│   └── core-integration.test.ts
└── fixtures/
    ├── mock-dependencies.ts
    └── test-data.ts
```

### Mock Strategy
```typescript
// Mock core dependencies for testing
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

## Public API

### Package Exports
```typescript
// packages/workflows/src/index.ts
export { CodingAgentWorkflow } from './workflows/coding-agent-workflow';
export { ReviewAgentWorkflow } from './workflows/review-agent-workflow';
export { PlanningAgentWorkflow } from './workflows/planning-agent-workflow';

export { WorkflowStateManager } from './state/workflow-state-manager';

export type {
  BaseWorkflow,
  WorkflowExecution,
  CodingConfig,
  ReviewConfig,
  PlanningConfig,
  CodingAgentState,
  ReviewAgentState,
  PlanningAgentState
} from './types';

export { WORKFLOW_ERROR_CODES, WorkflowErrorFactory } from './errors';
```

### Usage by Other Packages
```typescript
// UI Server usage
import { CodingAgentWorkflow, WorkflowStateManager } from '@claude-codex/workflows';

const codingWorkflow = new CodingAgentWorkflow();
const execution = await codingWorkflow.execute(config);

// MCP Server usage (for spawning review agents)
import { ReviewAgentWorkflow } from '@claude-codex/workflows';

const reviewWorkflow = new ReviewAgentWorkflow();
const reviewExecution = await reviewWorkflow.execute(reviewConfig);
```

## Implementation Priority

### Phase 1: Core Workflow (Week 1)
1. **CodingAgentWorkflow**: Basic lifecycle without review integration
2. **WorkflowStateManager**: Database integration for state tracking
3. **Error handling**: Workflow-specific errors extending core patterns
4. **Basic testing**: Unit tests with mocked dependencies

### Phase 2: Review Integration (Week 2)
1. **ReviewAgentWorkflow**: Complete review lifecycle
2. **Review coordination**: Coding → Review agent spawning
3. **Feedback delivery**: Git-based communication patterns
4. **Integration testing**: Multi-workflow coordination

### Phase 3: Planning & Production (Week 3)
1. **PlanningAgentWorkflow**: Issue generation and planning
2. **Production features**: Error recovery, monitoring
3. **Performance optimization**: Concurrent workflow handling
4. **Documentation**: API documentation and usage guides

---

*This Workflows Package Specification provides the orchestration layer that connects the UI/API to core package functionality while maintaining clean architectural boundaries and comprehensive error handling.*