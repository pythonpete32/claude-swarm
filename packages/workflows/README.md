# Claude Codex Workflows Package

Production-ready agent lifecycle orchestration for the Claude Codex system. This package provides high-level workflow classes that coordinate multiple core operations to manage coding and review agents.

## 🏗️ Architecture: Direct Core Integration

This package follows a **library-first design** with **direct core integration**. No adapters, no custom interfaces - it imports and uses core functions directly.

```
workflows → core (direct function calls)
     ↓
┌─────────────────┐    ┌──────────────────┐
│   Workflows     │────│   Core Package   │
│                 │    │                  │
│ CodingWorkflow  │    │ createWorktree   │
│ ReviewWorkflow  │    │ launchClaude     │
│                 │    │ DatabaseOps      │
└─────────────────┘    └──────────────────┘
```

### Key Principles

- **Core as Source of Truth**: All types, functions, and schemas come from `@claude-codex/core`
- **No Abstraction Layers**: Direct function imports, no custom interfaces or adapters
- **Pure Library Design**: Workflows are reusable building blocks, not hardcoded applications
- **Dependency Injection**: Core functions can be overridden for testing

## 🚀 Quick Start

```typescript
import { CodingAgentWorkflow, ReviewAgentWorkflow } from "@claude-codex/workflows";
import { getDatabase } from "@claude-codex/core";

// Get a real core database instance
const database = getDatabase();

// Create workflows - core functions are automatically imported
const codingWorkflow = new CodingAgentWorkflow(database);
const reviewWorkflow = new ReviewAgentWorkflow(database);

// Execute a coding workflow
const result = await codingWorkflow.execute({
  repository: { url: "https://github.com/owner/repo" },
  baseBranch: "main",
  issue: { number: 123, title: "Fix bug" },
  requireReview: true,
  maxReviews: 3
});

console.log(`Coding agent started: ${result.id}`);
console.log(`Resources: ${result.resources.worktreePath}`);
```

## 📋 Workflow Types

### CodingAgentWorkflow

Orchestrates coding agents that work on GitHub issues:

- Creates isolated worktrees
- Launches Claude sessions with proper context
- Manages tmux sessions for development
- Handles review request flow
- Tracks parent-child relationships

```typescript
const config: CodingAgentConfig = {
  repository: { url: "https://github.com/owner/repo" },
  baseBranch: "main",
  targetBranch: "feature/fix-123", // Optional: auto-generated if not provided
  issue: { number: 123, title: "Fix authentication bug" },
  requireReview: true,
  maxReviews: 3,
  systemPrompt: "You are a senior developer working on authentication fixes"
};

const execution = await codingWorkflow.execute(config);
```

### ReviewAgentWorkflow

Orchestrates ephemeral review agents:

- Creates forked worktrees from parent agent's work
- Provides isolated review environment
- Supports merge-back or PR creation decisions
- Auto-cleanup after review completion

```typescript
const config: ReviewAgentConfig = {
  parentInstanceId: "work-123-1700000000",
  reviewPrompt: "Focus on security and performance",
  preserveChanges: false, // Ephemeral by default
  timeoutMinutes: 30
};

const review = await reviewWorkflow.execute(config);
```

## 🔧 Core Integration Details

### Direct Function Usage

Workflows import core functions directly without any wrapper layers:

```typescript
// In workflow constructors - real core functions with optional overrides for testing
constructor(
  private database: DatabaseInterface,
  private createWorktreeFunc = createWorktree,    // Direct core function
  private launchClaudeFunc = launchClaudeSession, // Direct core function
  private createTmuxFunc = createTmuxSession,     // Direct core function
) {}
```

### Core Types and Schema

All types come directly from core's database schema:

```typescript
import type { 
  InstanceStatus,     // "started" | "waiting_review" | "pr_created" | "terminated"
  InstanceType,       // "coding" | "review" | "planning"
  DatabaseInterface,  // Core's database interface
  CreateWorktreeOptions,
  LaunchSessionResult
} from "@claude-codex/core";
```

### Status Vocabulary

Workflows use core's status vocabulary exactly:

- `"started"` - Agent is active and working
- `"waiting_review"` - Coding agent waiting for review
- `"pr_created"` - Pull request has been created  
- `"pr_merged"` - Pull request has been merged
- `"terminated"` - Agent has finished or been stopped

## 🧪 Testing Strategy

### Dependency Injection for Testing

Core functions can be overridden for isolated testing:

```typescript
// Test setup
const mockCreateWorktree = vi.fn().mockResolvedValue({
  path: "/test/worktree",
  branch: "test-branch"
});

const workflow = new CodingAgentWorkflow(
  mockDatabase,
  mockCreateWorktree,  // Override for testing
  // ... other function overrides
);
```

### Real Integration Testing

For integration tests, use real core functions with test databases:

```typescript
import { createTestDatabase } from "@claude-codex/core/testing";

const testDb = await createTestDatabase();
const workflow = new CodingAgentWorkflow(testDb);
// Uses real core functions with test data
```

## 📊 State Management

### Instance Tracking

Each workflow execution creates a database record tracking:

```typescript
interface Instance {
  id: string;              // Unique instance ID
  type: InstanceType;      // "coding" | "review" 
  status: InstanceStatus;  // Current workflow status
  worktree_path: string;   // File system location
  tmux_session: string;    // Session identifier
  claude_pid: number;      // Claude process ID
  parent_instance_id?: string; // For review agents
  // ... additional tracking fields
}
```

### Relationship Tracking

Parent-child relationships between agents:

```typescript
interface Relationship {
  parent_instance: string;     // Coding agent ID
  child_instance: string;      // Review agent ID  
  relationship_type: "spawned_review";
  review_iteration: number;    // Which review cycle
}
```

## 🔗 MCP Integration

### Workflow MCP Handlers

Connect workflows to Model Context Protocol tools:

```typescript
import { WorkflowMCPHandlers } from "@claude-codex/workflows";

const handlers = new WorkflowMCPHandlers(codingWorkflow, reviewWorkflow);

// Handle MCP tool calls from Claude agents
await handlers.handleRequestReview(instanceId, maxReviews);
await handlers.handleMergeBack(reviewInstanceId, feedback);
```

### Available MCP Tools

- `request_review` - Start review process from coding agent
- `merge_back` - Merge review feedback back to parent
- `create_pr` - Create pull request from review agent

## 🏭 Production Deployment

### Database Setup

```typescript
import { getDatabase } from "@claude-codex/core";

// Production database with real persistence
const database = await getDatabase({
  url: process.env.DATABASE_URL,
  // ... other config
});
```

### Workflow System Setup

```typescript
// Full production setup
const codingWorkflow = new CodingAgentWorkflow(database);
const reviewWorkflow = new ReviewAgentWorkflow(database);
const mcpHandlers = new WorkflowMCPHandlers(codingWorkflow, reviewWorkflow);

// Ready for production use
```

## 📈 Monitoring and Observability

### Instance Queries

```typescript
// Get all active coding agents
const activeInstances = await database.getInstances({
  types: ["coding"],
  statuses: ["started", "waiting_review"]
});

// Get review history for a coding agent
const reviews = await database.getRelationships(codingInstanceId);
```

### Resource Cleanup

Workflows handle automatic cleanup:
- Terminated Claude processes
- Removed tmux sessions  
- Cleaned worktree directories

## 🔄 Migration from Adapters

If migrating from the old adapter-based architecture:

### Before (with adapters)
```typescript
const adapter = createWorkflowDatabaseAdapter(coreDb);
const deps = createWorkflowDependencies(adapter);
const workflow = createCodingAgentWorkflow(deps);
```

### After (direct core)
```typescript
const workflow = new CodingAgentWorkflow(coreDb);
// That's it! Core functions are automatically available
```

## 🛠️ Development

### Running Tests
```bash
bun run test:run      # Run all tests
bun run typecheck     # Type checking
bun run lint:fix      # Lint and format
```

### Type Safety
The package is fully type-safe with core's TypeScript definitions. All functions, types, and schemas are imported directly from core.

## 📝 API Reference

See the [Type Definitions](./src/types/) for complete API documentation:

- [Workflow Config Types](./src/types/workflow-config.ts)
- [Workflow Execution Types](./src/types/workflow-execution.ts)  
- [Agent State Types](./src/types/agent-states.ts)
- [Core Dependencies](./src/types/dependencies.ts)

---

**Ready for Production**: This package uses real core implementations and is designed for production deployment with proper error handling, resource management, and observability.