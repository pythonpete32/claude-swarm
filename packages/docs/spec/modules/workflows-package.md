# Workflows Package: Agent Lifecycle Orchestration

← [Back to Index](../README.md) | [Previous: Database Module](./core-database.md) | [Next: Testing Strategy →](../05-testing-strategy.md)

## Purpose

Provides agent lifecycle orchestration for Claude Codex's three-agent system. The Workflows package coordinates Coding Agents and Review Agents through composition of core package functions, managing complete agent lifecycles including resource allocation, state tracking, and cleanup procedures.

## Dependencies

- `@claude-codex/core/database` - Instance tracking and state management
- `@claude-codex/core/worktree` - Isolated development environments
- `@claude-codex/core/tmux` - Terminal session management  
- `@claude-codex/core/claude` - Claude Code session management
- `@claude-codex/core/github` - GitHub API integration for PR creation
- `shared/types.ts` - Workflow interfaces and agent state types
- `shared/errors.ts` - WorkflowError classes extending SwarmError patterns
- `shared/config.ts` - Workflow configuration management

## Architecture Principles

### Composition Over Implementation
Workflows are **orchestrators**, not implementers:
- ✅ Compose existing core package functions
- ✅ Add agent-specific coordination logic
- ✅ Manage observable state transitions via database
- ❌ Reimplement git, tmux, or GitHub operations
- ❌ Handle low-level resource management
- ❌ Duplicate core package functionality

### Observable State Management
State transitions correspond to **observable actions only**:
- ✅ MCP tool calls (`request_review`, `create_pr`)
- ✅ GitHub webhook events (PR merged/closed)
- ✅ Resource creation/cleanup
- ❌ Internal agent "thinking" or processing states
- ❌ Unverifiable intermediate conditions

## Function Signatures

### Base Workflow Interface

#### BaseWorkflow
```typescript
interface BaseWorkflow<TConfig, TState> {
  readonly type: WorkflowType;
  
  // Lifecycle management
  execute(config: TConfig): Promise<WorkflowExecution<TState>>;
  terminate(instanceId: string, reason?: string): Promise<void>;
  
  // State management (read-only - updates via MCP/webhooks)
  getState(instanceId: string): Promise<TState | null>;
}

type WorkflowType = 'coding' | 'review';
```

#### WorkflowExecution Result
```typescript
interface WorkflowExecution<TState = any> {
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

interface WorkflowResources {
  worktreePath: string;
  sessionName: string;
  branch: string;
  claudeSessionId?: string;
}

type ExecutionStatus = 
  | 'started' 
  | 'working' 
  | 'review_requested'
  | 'pr_created' 
  | 'pr_merged' 
  | 'pr_closed' 
  | 'terminated' 
  | 'failed';
```

---

## Coding Agent Workflow

### Purpose
Orchestrates coding agents working on GitHub issues or custom tasks with optional review cycles and automatic cleanup.

### Function Signature

#### execute
```typescript
async function execute(config: CodingAgentConfig): Promise<WorkflowExecution<CodingAgentState>>
```

**Parameters:**
```typescript
interface CodingAgentConfig {
  // Repository context
  repository: RepositoryInfo;      // From core types
  baseBranch: string;
  targetBranch?: string;           // Auto-generated if not provided
  
  // Task context
  issue?: GitHubIssueInfo;         // From core types
  systemPrompt?: string;
  customInstructions?: string;
  
  // Review behavior
  requireReview: boolean;          // Default: false
  maxReviews: number;              // Default: 3
  
  // Resource configuration
  worktreeOptions?: Partial<CreateWorktreeOptions>;    // From core
  tmuxOptions?: Partial<CreateTmuxSessionOptions>;     // From core
  claudeOptions?: Partial<ClaudeSessionConfig>;        // From core
  
  // Execution settings
  executionTimeout?: number;       // Default: 24 hours (ms)
}
```

**Returns:**
```typescript
// WorkflowExecution<CodingAgentState> with specific state interface
interface CodingAgentState {
  phase: 'initializing' | 'working' | 'review_requested' | 'pr_created' | 'terminated' | 'cleanup';
  reviewCount: number;             // Current review cycle count
  maxReviews: number;              // Maximum allowed reviews
  currentReviewInstanceId?: string; // Active review agent ID
  lastActivity: Date;
  
  // Error tracking
  lastError?: string;              // Most recent error message
  failureReason?: string;          // Reason for termination
}
```

**Behavior:**
1. **Initialize Database Record**: Creates instance record with `status: 'started'`
2. **Resource Allocation**: 
   - Creates isolated worktree using `core/worktree.createWorktree()`
   - Creates tmux session using `core/tmux.createTmuxSession()`
   - Launches Claude session using `core/claude.launchClaudeSession()`
3. **State Tracking**: Updates database with `status: 'working'` and resource information
4. **MCP Integration**: Provides internal tools for agent state transitions:
   - `request_review` tool (triggers Review Agent spawn)
   - `create_pr` tool (transitions to PR creation)
5. **Review Cycle Management**: Enforces `maxReviews` limit, terminates if exceeded

**Error Conditions:**
- `WorkflowError('WORKFLOW_INVALID_CONFIGURATION')` - Missing required config
- `WorkflowError('WORKFLOW_RESOURCE_ALLOCATION_FAILED')` - Cannot create resources
- `WorkflowError('WORKFLOW_MAX_REVIEWS_EXCEEDED')` - Review limit reached
- `WorkflowError('WORKFLOW_EXECUTION_TIMEOUT')` - Exceeded timeout limit

*Error codes follow shared ERROR_CODES pattern: WORKFLOW_ERROR_TYPE*

---

#### terminate
```typescript
async function terminate(instanceId: string, reason?: string): Promise<void>
```

**Parameters:**
- `instanceId: string` - Instance identifier to terminate
- `reason?: string` - Optional termination reason

**Behavior:**
1. **Update Database**: Sets `status: 'terminated'` and `terminatedAt` timestamp
2. **Resource Cleanup**:
   - Terminates Claude session using `core/claude.terminateClaudeSession()`
   - Kills tmux session using `core/tmux.killSession()`
   - Removes worktree using `core/worktree.removeWorktree()`
3. **Relationship Cleanup**: Terminates any active review agents
4. **State Persistence**: Logs termination reason and final state

**Error Conditions:**
- `WorkflowError('WORKFLOW_INSTANCE_NOT_FOUND')` - Instance doesn't exist
- `WorkflowError('WORKFLOW_CLEANUP_FAILED')` - Resource cleanup failed

---

#### requestReview
```typescript
async function requestReview(instanceId: string): Promise<string>
```

**Parameters:**
- `instanceId: string` - Coding agent instance requesting review

**Returns:**
- `string` - Review agent instance ID

**Behavior:**
1. **Validation**: 
   - Checks instance exists and is in `working` state
   - Verifies review count hasn't exceeded `maxReviews`
   - Ensures no active review is in progress
2. **State Update**: Updates instance to `review_requested` status
3. **Review Agent Spawn**: Creates Review Agent with parent relationship
4. **Relationship Tracking**: Records parent-child relationship in database

**Error Conditions:**
- `WorkflowError('WORKFLOW_MAX_REVIEWS_EXCEEDED')` - Review limit reached
- `WorkflowError('WORKFLOW_REVIEW_IN_PROGRESS')` - Review already active
- `WorkflowError('WORKFLOW_INVALID_STATE')` - Cannot request review in current state

*This function is called by MCP server when agent uses `request_review` tool*

---

## Review Agent Workflow

### Purpose
Orchestrates ephemeral review agents that evaluate coding agent work and make merge/PR decisions with automatic cleanup.

### Function Signature

#### execute
```typescript
async function execute(config: ReviewAgentConfig): Promise<WorkflowExecution<ReviewAgentState>>
```

**Parameters:**
```typescript
interface ReviewAgentConfig {
  parentInstanceId: string;        // Coding agent being reviewed
  reviewPrompt?: string;           // Custom review criteria
  
  // Fork configuration
  reviewBranch?: string;           // Auto-generated if not provided
  preserveChanges: boolean;        // Default: false (ephemeral)
  
  // Execution settings
  timeoutMinutes: number;          // Default: 30 minutes
}
```

**Returns:**
```typescript
// WorkflowExecution<ReviewAgentState> with specific state interface
interface ReviewAgentState {
  phase: 'initializing' | 'working' | 'merge_back' | 'push_to_github' | 'cleanup';
  parentInstanceId: string;        // Parent coding agent
  decision?: 'merge_back' | 'push_to_github';
  
  // Decision tracking
  decisionReason?: string;         // Explanation of decision
  feedbackDelivered: boolean;      // Whether feedback was provided
}
```

**Behavior:**
1. **Parent Validation**: Verifies parent instance exists and is in `review_requested` state
2. **Resource Creation**:
   - Creates forked worktree from parent's branch using `core/worktree.createWorktree()`
   - Creates dedicated tmux session using `core/tmux.createTmuxSession()`
   - Launches review-focused Claude session using `core/claude.launchClaudeSession()`
3. **Database Tracking**: 
   - Creates review instance record
   - Links to parent via `core/database.createRelationship()`
4. **Decision Implementation**: Provides MCP tools for review decisions:
   - `merge_back` tool (merges changes back to parent)
   - `push_to_github` tool (creates PR directly)
5. **Automatic Cleanup**: Self-destructs after decision implementation

**Error Conditions:**
- `WorkflowError('WORKFLOW_PARENT_NOT_FOUND')` - Parent instance doesn't exist
- `WorkflowError('WORKFLOW_PARENT_INVALID_STATE')` - Parent not in reviewable state
- `WorkflowError('WORKFLOW_FORK_FAILED')` - Cannot create review worktree
- `WorkflowError('WORKFLOW_REVIEW_TIMEOUT')` - Exceeded review time limit

---

#### mergeBack
```typescript
async function mergeBack(instanceId: string, feedback?: string): Promise<void>
```

**Parameters:**
- `instanceId: string` - Review agent instance ID
- `feedback?: string` - Optional feedback for coding agent

**Behavior:**
1. **State Update**: Updates review agent to `merge_back` status
2. **Git Operations**: Merges review branch back to parent's branch
3. **Parent Update**: 
   - Increments parent's `reviewCount`
   - Updates parent status back to `working`
   - Delivers feedback if provided
4. **Self Cleanup**: Triggers own termination and resource cleanup

**Error Conditions:**
- `WorkflowError('WORKFLOW_MERGE_CONFLICT')` - Git merge conflicts
- `WorkflowError('WORKFLOW_PARENT_UPDATE_FAILED')` - Cannot update parent state

*This function is called by MCP server when review agent uses `merge_back` tool*

---

#### pushToGithub
```typescript
async function pushToGithub(instanceId: string, prConfig: PullRequestConfig): Promise<string>
```

**Parameters:**
- `instanceId: string` - Review agent instance ID
- `prConfig: PullRequestConfig` - PR creation configuration

**Returns:**
- `string` - Pull request URL

**Behavior:**
1. **State Update**: Updates review agent to `push_to_github` status
2. **PR Creation**: Creates pull request using `core/github.createPullRequest()`
3. **Parent Update**: Updates parent status to `pr_created`
4. **Self Cleanup**: Triggers own termination and resource cleanup

**Error Conditions:**
- `WorkflowError('WORKFLOW_PR_CREATION_FAILED')` - GitHub API error
- `WorkflowError('WORKFLOW_PARENT_UPDATE_FAILED')` - Cannot update parent state

*This function is called by MCP server when review agent uses `push_to_github` tool*

---

## State Update Coordination

### MCP Tool Integration
State transitions are triggered by observable MCP tool calls:

```typescript
// Internal MCP tools provided to agents
interface AgentMCPTools {
  // Coding Agent tools
  request_review(): Promise<string>;           // Returns review instance ID
  create_pr(config: PullRequestConfig): Promise<string>;  // Returns PR URL
  
  // Review Agent tools  
  merge_back(feedback?: string): Promise<void>;
  push_to_github(prConfig: PullRequestConfig): Promise<string>;
}
```

### GitHub Webhook Integration
External state updates via GitHub webhooks:

```typescript
// Webhook handlers for external events
interface GitHubWebhookHandlers {
  onPullRequestMerged(prUrl: string): Promise<void>;    // Updates to 'pr_merged'
  onPullRequestClosed(prUrl: string): Promise<void>;    // Updates to 'pr_closed'
}
```

### Database State Tracking
All state changes are persisted using core database functions:

```typescript
// State persistence patterns
await database.updateInstance(instanceId, {
  status: newStatus,
  last_activity: new Date(),
  state_data: JSON.stringify(newState)
});

await database.createRelationship({
  parent_instance: codingInstanceId,
  child_instance: reviewInstanceId,
  relationship_type: 'spawned_review',
  review_iteration: reviewCount + 1
});
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
  WORKFLOW_MAX_REVIEWS_EXCEEDED: "WORKFLOW_MAX_REVIEWS_EXCEEDED",
  WORKFLOW_EXECUTION_TIMEOUT: "WORKFLOW_EXECUTION_TIMEOUT",
  WORKFLOW_CLEANUP_FAILED: "WORKFLOW_CLEANUP_FAILED",
  WORKFLOW_INSTANCE_NOT_FOUND: "WORKFLOW_INSTANCE_NOT_FOUND",
  WORKFLOW_INVALID_STATE: "WORKFLOW_INVALID_STATE",
  WORKFLOW_PARENT_NOT_FOUND: "WORKFLOW_PARENT_NOT_FOUND",
  WORKFLOW_FORK_FAILED: "WORKFLOW_FORK_FAILED",
  WORKFLOW_MERGE_CONFLICT: "WORKFLOW_MERGE_CONFLICT",
  WORKFLOW_PR_CREATION_FAILED: "WORKFLOW_PR_CREATION_FAILED"
} as const;
```

### Error Recovery Patterns
```typescript
// Workflow error handling with cleanup
private async handleWorkflowError(instanceId: string, error: any): Promise<void> {
  // Update database with error state
  await this.deps.database.updateInstance(instanceId, {
    status: 'failed',
    terminated_at: new Date(),
    last_error: error.message
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

### Default Configuration
```typescript
interface WorkflowConfig {
  coding: {
    defaultSystemPrompt: string;
    requireReview: boolean;          // Default: false
    maxReviews: number;              // Default: 3
    executionTimeoutHours: number;   // Default: 24
    autoCleanup: boolean;            // Default: true
  };
  
  review: {
    defaultReviewPrompt: string;
    timeoutMinutes: number;          // Default: 30
    preserveChanges: boolean;        // Default: false
  };
  
  resources: {
    maxConcurrentInstances: number;  // Default: 5
    worktreeBasePath: string;        // Default: '../worktrees'
    cleanupPolicy: 'manual' | 'auto'; // Default: 'auto'
  };
}
```

## Testing Strategy

### Unit Testing Approach
```typescript
describe('CodingAgentWorkflow', () => {
  let workflow: CodingAgentWorkflow;
  let mockDeps: WorkflowDependencies;
  
  beforeEach(() => {
    mockDeps = createMockWorkflowDependencies();
    workflow = new CodingAgentWorkflow(mockDeps);
  });
  
  it('should create coding agent with proper resource allocation', async () => {
    const config: CodingAgentConfig = {
      repository: mockRepositoryInfo,
      baseBranch: 'main',
      requireReview: false,
      maxReviews: 3
    };
    
    const execution = await workflow.execute(config);
    
    expect(execution.type).toBe('coding');
    expect(execution.status).toBe('working');
    expect(mockDeps.database.createInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'coding',
        status: 'started'
      })
    );
  });
  
  it('should enforce review cycle limits', async () => {
    // Mock existing relationships showing max reviews reached
    mockDeps.database.getInstanceRelationships.mockResolvedValue([
      { relationship_type: 'spawned_review' },
      { relationship_type: 'spawned_review' },
      { relationship_type: 'spawned_review' }
    ]);
    
    await expect(workflow.requestReview('work-123-a1'))
      .rejects.toThrow('WORKFLOW_MAX_REVIEWS_EXCEEDED');
  });
});
```

### Integration Testing Approach
```typescript
describe('Workflow Integration', () => {
  it('should coordinate coding → review → merge workflow', async () => {
    // Create coding agent
    const codingExecution = await codingWorkflow.execute(codingConfig);
    
    // Request review (triggered by MCP tool call)
    const reviewInstanceId = await codingWorkflow.requestReview(codingExecution.id);
    
    // Review merges back (triggered by MCP tool call)
    await reviewWorkflow.mergeBack(reviewInstanceId, "Please fix linting issues");
    
    // Verify parent state updated
    const parentState = await codingWorkflow.getState(codingExecution.id);
    expect(parentState.phase).toBe('working');
    expect(parentState.reviewCount).toBe(1);
  });
});
```

## Implementation Notes

### Planning Agent (Future Implementation)
The Planning Agent workflow is deferred to a later implementation phase. The interface should be:

```typescript
interface PlanningAgentWorkflow extends BaseWorkflow<PlanningConfig, PlanningState> {
  // To be defined when planning workflows are implemented
  // Will focus on requirement gathering and issue creation
}
```

### Performance Considerations
- **Concurrent Limits**: Enforce maximum concurrent agent instances via configuration
- **Resource Cleanup**: Automatic cleanup policies prevent resource leaks
- **Database Optimization**: Efficient queries for state tracking and relationship management

### MCP Server Integration Points
The MCP server coordinates with workflows via:
1. **Tool Call Handlers**: Process agent tool calls and trigger state transitions
2. **Webhook Handlers**: Process GitHub events and update agent states
3. **Workflow Spawning**: Create new workflow instances based on requests

---

*This Workflows Package specification provides the complete architecture for agent lifecycle management in Claude Codex, enabling the three-agent system through composition of core package functionality while maintaining observable state management and comprehensive error handling.*