# Architectural Decisions Record (ADR)

**Date**: January 15, 2025  
**Status**: Approved  
**Authors**: Comprehensive Architecture Analysis Session  

## Summary

This document records the key architectural decisions made during the comprehensive analysis and harmonization of the Claude Codex architecture. These decisions resolve inconsistencies across documentation and establish the definitive package structure and integration patterns.

## Key Architectural Decisions

### 1. Package Structure and Responsibilities

**Decision**: Harmonized package architecture with clear separation of concerns

**Final Package Structure**:
```
packages/
├── core/              # Foundational functions + database module
│   ├── src/core/
│   │   ├── git.ts                 # Git operations (existing)
│   │   ├── worktree.ts           # Worktree management (existing)
│   │   ├── github.ts             # GitHub integration (existing)
│   │   ├── tmux.ts               # Session management (existing)
│   │   ├── claude.ts             # Claude integration (existing)
│   │   ├── files.ts              # File operations (existing)
│   │   └── database.ts           # SQLite operations (NEW MODULE)
│   └── src/shared/               # Error handling, types, config (existing)
│
├── workflows/         # Agent lifecycle orchestration (NEW PACKAGE)
│   ├── src/workflows/
│   │   ├── coding-agent-workflow.ts
│   │   ├── review-agent-workflow.ts
│   │   └── planning-agent-workflow.ts
│   ├── src/state/
│   │   └── workflow-state-manager.ts
│   └── src/types/
│       └── workflow-types.ts
│
├── mcp-codex/         # MCP server for agent coordination (NEW PACKAGE)
│   ├── src/tools/
│   │   ├── request-review.ts
│   │   ├── create-pr.ts
│   │   └── send-feedback.ts
│   └── src/server.ts
│
├── cli/               # Command line interface (existing)
├── ui/                # Web dashboard frontend (existing)
└── server/            # UI backend + WebSocket (existing)
```

**Rationale**:
- **Database in Core**: Database operations are foundational building blocks, needed by multiple packages
- **Workflows Separate**: Orchestration logic is higher-level than core operations
- **MCP Server Separate**: Agent coordination is distinct from core operations
- **Clear Dependencies**: workflows → core, mcp-codex → core, server → workflows + core

### 2. Database Integration Strategy

**Decision**: Database module integrated into core package, not separate package

**Implementation**:
- **Location**: `@claude-codex/core/database`
- **Pattern**: Function-based API following core's dependency injection patterns
- **Usage**: Workflows, MCP server, UI server all import database functions from core
- **Benefits**: Single source of truth, consistent patterns, reusable across packages

**Key Functions**:
```typescript
// Core database exports
export { createInstance, updateInstanceStatus, logMCPEvent } from '@claude-codex/core/database';
```

**Rationale**: Database operations are foundational infrastructure, not application-specific logic. Following core's established patterns ensures consistency and testability.

### 3. Workflow Architecture Philosophy

**Decision**: Workflows as thin orchestration layers that compose core functions

**Key Principles**:
- ✅ **Compose, don't reimplement**: Use existing core functions
- ✅ **Orchestrate lifecycle**: Manage agent state transitions
- ✅ **Add coordination logic**: Handle agent-to-agent communication
- ❌ **No low-level operations**: No direct git/tmux/file operations
- ❌ **No duplicate functionality**: Core package owns all implementations

**Example Pattern**:
```typescript
export class CodingAgentWorkflow {
  async execute(config: CodingConfig): Promise<WorkflowExecution> {
    // 1. Create database record (uses core)
    await this.deps.database.createInstance(instanceRecord);
    
    // 2. Create worktree (uses core)
    const worktree = await this.deps.worktree.createWorktree(options);
    
    // 3. Create session (uses core)  
    const session = await this.deps.tmux.createTmuxSession(options);
    
    // 4. Launch Claude (uses core)
    await this.deps.claude.launchClaudeSession(options);
    
    // 5. Update state (uses core)
    await this.deps.database.updateInstanceStatus(instanceId, 'running');
    
    return executionResult;
  }
}
```

**Rationale**: Maintains architectural integrity while enabling complex orchestration. Core remains pure and testable, workflows add business logic.

### 4. MCP Server Integration Pattern

**Decision**: MCP server uses core functions and coordinates with workflows package

**Architecture**:
- **MCP Server**: Implements agent coordination tools
- **Core Integration**: Uses core database, worktree, tmux, claude functions
- **Workflow Coordination**: Both MCP server and workflows use same core functions
- **State Management**: MCP tools trigger database updates via core functions

**Integration Pattern**:
```typescript
// MCP tool implementation
export async function requestReviewTool(params: RequestReviewParams): Promise<ReviewResult> {
  // Use core database functions
  await logMCPEvent(/* ... */);
  await createRelationship(/* ... */);
  await updateInstanceStatus(instanceId, 'waiting_review');
  
  // Use core worktree functions  
  const reviewWorktree = await createWorktree(/* ... */);
  
  // Use core tmux functions
  const reviewSession = await createTmuxSession(/* ... */);
  
  return result;
}
```

**Rationale**: Ensures consistency between workflow orchestration and MCP tool execution. Both use identical core functions, preventing drift.

### 5. Error Handling Consistency

**Decision**: Extend core's error system for new modules and packages

**Pattern**:
- **Database Module**: Adds `DATABASE_*` error codes to core's `ERROR_CODES`
- **Workflows Package**: Creates `WORKFLOW_*` error codes extending core patterns
- **MCP Server**: Uses core error codes where possible, adds MCP-specific codes

**Implementation**:
```typescript
// Database errors (in core)
export const DATABASE_ERROR_CODES = {
  DATABASE_CONNECTION_FAILED: "DATABASE_CONNECTION_FAILED",
  DATABASE_INSTANCE_NOT_FOUND: "DATABASE_INSTANCE_NOT_FOUND"
} as const;

// Workflow errors (in workflows package)  
export const WORKFLOW_ERROR_CODES = {
  WORKFLOW_MAX_REVIEW_CYCLES_EXCEEDED: "WORKFLOW_MAX_REVIEW_CYCLES_EXCEEDED"
} as const;
```

**Rationale**: Maintains consistency with core's sophisticated error handling while enabling package-specific error management.

### 6. Testing Strategy Alignment

**Decision**: All new packages follow core's testing patterns

**Key Patterns**:
- **Dependency Injection**: Mock core functions in workflows and MCP server tests
- **Mock Classes**: Comprehensive mock implementations of core interfaces
- **Test Structure**: unit/ integration/ fixtures/ structure for all packages
- **Core Integration**: Use core's existing mock patterns

**Example**:
```typescript
// Workflow tests use core mocks
const mockDependencies: WorkflowDependencies = {
  worktree: mockWorktreeModule,    // From core's test helpers
  tmux: mockTmuxModule,           // From core's test helpers
  database: mockDatabaseModule,    // New mock following core patterns
  // ...
};

const workflow = new CodingAgentWorkflow(mockDependencies);
```

**Rationale**: Leverages core's proven testing infrastructure while ensuring all packages maintain same quality standards.

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
1. **Add Database Module to Core Package**
   - SQLite operations with dependency injection
   - Error handling following core patterns
   - Comprehensive unit tests with mocks

2. **Create Workflows Package**
   - Basic coding agent workflow
   - State management using core database functions
   - Integration tests with core mocks

### Phase 2: Coordination (Week 2)
3. **Create MCP Server Package**
   - Core status-updating tools
   - Integration with core database and worktree functions
   - Agent coordination logic

4. **Review Agent Integration**
   - Review workflow implementation
   - Cross-agent communication patterns
   - Feedback delivery mechanisms

### Phase 3: Production (Week 3)
5. **UI Server Integration**
   - Connect UI to workflows package
   - Real-time updates via database monitoring
   - Replace existing mocks with real implementations

6. **Planning Agent & Polish**
   - Planning workflow implementation
   - Error recovery and monitoring
   - Performance optimization

## Benefits of This Architecture

### 1. **Consistency**
- All packages follow core's established patterns
- Single source of truth for database operations
- Unified error handling and testing approaches

### 2. **Maintainability**
- Clear separation of concerns between packages
- Core remains focused on foundational operations
- Workflows add business logic without duplicating infrastructure

### 3. **Testability**
- Dependency injection enables comprehensive mocking
- Core's testing infrastructure reused across packages
- Integration tests verify package coordination

### 4. **Scalability**
- New agent types can be added as workflow implementations
- Core functions can be enhanced without breaking workflows
- Database schema can evolve with migration system

### 5. **Developer Experience**
- Consistent APIs across all packages
- Rich TypeScript types from core package
- Clear architectural boundaries and responsibilities

## Non-Functional Requirements Met

### Performance
- Database operations optimized with proper indexing
- Workflow orchestration minimizes resource overhead
- Core functions remain highly optimized

### Security
- Core's input validation extended to all packages
- Database operations follow secure patterns
- Agent isolation maintained through core's worktree management

### Reliability
- Comprehensive error handling throughout architecture
- Database transactions ensure state consistency
- Process monitoring and cleanup via core functions

### Observability
- Complete audit trail via MCP event logging
- Database state provides real-time system visibility
- Core's logging patterns extended across packages

---

## Implementation Guidelines

### For Database Module (Core Package)
- Follow core's dependency injection patterns exactly
- Use core's error factory and validation functions
- Implement comprehensive mock for testing
- Export function-based API consistent with other core modules

### For Workflows Package
- Import and compose core functions, never reimplement
- Use core database functions for all state management
- Follow core's error handling patterns
- Implement rich TypeScript types extending core types

### For MCP Server Package
- Use core functions for all actual operations
- Use core database functions for event logging and state updates
- Follow core's validation patterns for tool inputs
- Coordinate with workflows through shared core functions

### For UI Server Integration
- Import workflows for orchestration, core for direct operations
- Use core database functions for queries and real-time updates
- Follow existing WebSocket patterns for terminal streaming
- Replace mocks with workflows and core function calls

---

*This Architectural Decisions Record establishes the definitive structure for Claude Codex development, ensuring consistency, maintainability, and scalability while leveraging the robust foundation provided by the existing core package.*