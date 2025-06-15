# Claude Codex Architecture Specification v2.0
**Date**: 2025-01-15  
**Status**: Approved Architecture  
**Authors**: Architecture Session Analysis  

## Executive Summary

Claude Codex has evolved from a CLI-focused tool to a sophisticated **UI-first multi-agent development platform**. The system orchestrates three specialized agent types (Planning, Coding, Review) through isolated worktree environments, with real-time terminal streaming and GitHub integration. This document represents the definitive architectural specification following comprehensive codebase analysis and architectural planning.

## Architecture Evolution

### Original Vision vs. Current Reality
- **Original**: `commands/ → workflows/ → core/ → shared/` (CLI-driven)
- **Current**: `ui/ ↔ server/ → core/` (Web UI-driven)
- **Impact**: Fundamental architectural pivot requiring new integration patterns

### Key Architectural Shift
The system now abstracts away complex `git worktree` and `tmux` session management, providing a seamless multi-agent development experience through a web interface.

## Three-Agent System Architecture

### Agent Types and Responsibilities

#### 1. Planning Agent
- **Purpose**: Conversational planning and specification creation
- **Interaction**: Turn-based conversation with user
- **Output**: Formal artifacts (PRD, specifications)
- **Action**: Creates GitHub issues using MCP tools
- **Lifecycle**: Interactive → Document Creation → Issue Generation

#### 2. Coding Agent
- **Purpose**: Primary development workhorse
- **Input**: GitHub issue + system prompt
- **Behavior**: Mostly automated, runs in observable interactive session
- **Capabilities**: 
  - Can spawn Review Agents
  - Configurable completion behavior (immediate PR vs. review request)
- **Isolation**: Separate worktree + tmux session per instance

#### 3. Review Agent
- **Purpose**: Ephemeral, automated code review
- **Lifecycle**: Fork worktree → Review → Decision → Cleanup
- **Decision Branches**:
  - **APPROVE**: Create PR → Cleanup → Terminate
  - **REJECT**: Write feedback → Merge to coding branch → Terminate
- **Communication**: Git-based artifact exchange only

### Agent Relationships
```
Planning Agent ──[creates issues]──→ Coding Agent ──[spawns]──→ Review Agent
                                         ↓                         ↓
                                   [git worktree]           [forked worktree]
                                   [tmux session]           [automated review]
```

## Core Infrastructure

### Current Implementation Status
- **Core Package**: 95% complete, production-ready (421 passing tests)
- **UI Package**: 80% complete, polished interface with mock data
- **Server Package**: 5% complete, basic structure exists
- **Integration**: 0% complete, missing orchestration layer

### Component Isolation Strategy
- **Worktree Isolation**: Each agent gets separate git worktree
- **Session Isolation**: Each agent runs in dedicated tmux session
- **Context Isolation**: Prevents file conflicts between parallel agents
- **Terminal Streaming**: Real-time WebSocket connection to tmux sessions

## MCP Tool Framework

### Core MCP Tools (Status-Updating)
These specific tools trigger database state updates:

```typescript
interface StatusUpdateMCPTool {
  name: string;
  execute(params: any): Promise<any>;
  updateInstanceStatus(instanceId: string, newStatus: InstanceStatus): void;
}

// Core Tools:
- request_review → WAITING_REVIEW status
- create_pr → PR_CREATED status  
- spawn_review_instance → Creates new Review Agent instance
```

### Status Communication Model
**Principle**: Track high-leverage events through structured MCP tool calls, not terminal output parsing.

**Five Critical State Transitions**:
```typescript
enum InstanceStatus {
  STARTED = 'started',           // Worktree created, agent launched
  WAITING_REVIEW = 'waiting_review',  // request_review MCP called
  PR_CREATED = 'pr_created',     // create_pr MCP called
  PR_MERGED = 'pr_merged',       // GitHub webhook/polling
  PR_CLOSED = 'pr_closed'        // GitHub webhook/polling
}
```

## Database Architecture

### Schema Design (State-Based)
```sql
-- Core instance tracking
instances (
  id VARCHAR PRIMARY KEY,
  type ENUM('planning', 'coding', 'review'),
  status ENUM('started', 'waiting_review', 'pr_created', 'pr_merged', 'pr_closed'),
  worktree_path VARCHAR,
  tmux_session VARCHAR,
  issue_number INTEGER,
  system_prompt TEXT,
  parent_instance_id VARCHAR, -- For Review Agent relationships
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- MCP tool call tracking (audit trail)
mcp_events (
  id INTEGER PRIMARY KEY,
  instance_id VARCHAR,
  tool_name VARCHAR,
  parameters JSON,
  result JSON,
  status_change BOOLEAN, -- True if this call updated instance status
  timestamp TIMESTAMP
);

-- GitHub integration state
github_state (
  instance_id VARCHAR PRIMARY KEY,
  pr_number INTEGER,
  pr_status VARCHAR,
  pr_url VARCHAR,
  last_sync TIMESTAMP
);

-- Support for parallel agents on same issue
issue_instances (
  issue_number INTEGER,
  instance_id VARCHAR,
  created_at TIMESTAMP,
  PRIMARY KEY (issue_number, instance_id)
);
```

### Key Database Features
1. **Parallel Agent Support**: Multiple Coding Agents per GitHub issue
2. **Instance Relationships**: Parent-child tracking for Review Agents
3. **State-Based Updates**: Current status stored and updated in place
4. **Audit Trail**: MCP events provide complete action history

## Communication Patterns

### UI ↔ Server Communication
- **REST API**: Instance CRUD operations, configuration
- **WebSocket**: Real-time terminal streaming (tmux sessions)
- **Status Updates**: Database state changes pushed via WebSocket

### Agent ↔ System Communication  
- **MCP Tools**: Structured interface for system operations
- **Git Operations**: File-based artifact exchange between agents
- **No Direct Messaging**: Agents communicate only through git commits

### Status Update Flow
```
Agent MCP Call → Database State Update → WebSocket Notification → UI Update
```

## Technical Decisions & Clarifications

### 1. MCP Tool Scope
- **Status-Updating Tools**: Only specific core tools trigger state changes
- **Generic Tools**: Agents can use other MCP tools without affecting instance state
- **Tool Categories**: Core system tools vs. general-purpose development tools

### 2. Abstraction Goals
- **Hidden Complexity**: Worktree and tmux management completely abstracted from users
- **Seamless Experience**: Backend handles all lifecycle management automatically
- **User Focus**: Users interact with high-level concepts (issues, agents, reviews)

### 3. GitHub Integration Strategy
- **MVP Approach**: Assume PRs only created via `create_pr` MCP tool
- **Future Enhancement**: Add webhook-based out-of-band state synchronization
- **Simplified Initial Implementation**: Defer complex GitHub state management

### 4. Workflow Definition
**Clarification**: "Workflows" are agent lifecycle management, not configurable process engines.
- **Workflow = Agent Type + Lifecycle Management**
- **No Generic Workflow Engine**: Three specialized agent types only
- **Limited Configuration**: System prompts and completion options only

## Implementation Roadmap

### Phase 1: Coding Agent Proof-of-Concept (Immediate)
**Goal**: Full lifecycle implementation for single agent type

**Components to Build**:
1. **Worktree Management**: Creation, isolation, cleanup
2. **Tmux Session Management**: Session creation, attachment, monitoring
3. **Core MCP Tools**: `request_review`, `create_pr`, `spawn_review_instance`
4. **Database Integration**: State updates on MCP tool execution
5. **Agent Lifecycle**: Launch → Monitor → Status Updates → Cleanup

**Success Criteria**:
- Launch Coding Agent with GitHub issue
- Monitor agent through terminal streaming
- Trigger status updates via MCP tools
- Clean agent lifecycle management

### Phase 2: Review Agent Integration (Next)
**Goal**: Implement agent-to-agent spawning and communication

**Components to Build**:
1. **Review Agent Workflow**: Fork → Review → Decision → Cleanup
2. **Agent Spawning**: Coding Agent triggers Review Agent creation
3. **Git-Based Communication**: Feedback delivery via file commits
4. **Parallel Worktree Management**: Forked worktree handling

### Phase 3: UI Real-Time Integration (Following)
**Goal**: Connect UI to real agent operations

**Components to Build**:
1. **Real-Time Status Updates**: Database changes → WebSocket → UI
2. **Agent Management Interface**: Launch agents with configuration
3. **Terminal Integration**: Connect UI terminal to specific agent sessions
4. **Instance Management**: Full CRUD operations for agent instances

### Phase 4: Planning Agent & Production Features (Later)
**Goal**: Complete three-agent system with production readiness

**Components to Build**:
1. **Planning Agent**: Conversational planning interface
2. **Issue Generation**: Planning artifacts → GitHub issues
3. **Parallel Agent Management**: Multiple agents per issue
4. **Production Features**: Error handling, monitoring, security

## Integration Architecture

### Missing Components (Current Gaps)
1. **Workflows Package**: Agent lifecycle orchestration (0% complete)
2. **Server-Core Integration**: API layer connecting UI to core (5% complete)
3. **MCP Server**: Agent coordination and tool execution (0% complete)
4. **Database Layer**: State persistence and management (0% complete)

### Required Integration Layers
```typescript
// Workflow orchestration layer
packages/workflows/
├── coding-agent-workflow.ts    // Coding agent lifecycle
├── review-agent-workflow.ts    // Review agent lifecycle  
├── planning-agent-workflow.ts  // Planning agent lifecycle
└── shared/                     // Common workflow utilities

// Server API integration
packages/server/src/
├── routes/instances.ts         // Instance CRUD operations
├── routes/github.ts           // GitHub integration endpoints
├── services/workflow.ts       // Workflow execution service
└── websocket/terminal.ts      // Terminal streaming (exists, needs integration)
```

## Critical Technical Considerations

### 1. Instance State Management
- **Challenge**: Reliable state synchronization between agents and UI
- **Solution**: MCP tool-driven state updates with database as source of truth
- **Risk Mitigation**: Audit trail via mcp_events table

### 2. Agent Failure Handling
- **Challenge**: Agent crashes or unexpected termination
- **Solution**: Process monitoring and automatic cleanup
- **Implementation**: Monitor tmux session status, cleanup orphaned worktrees

### 3. Concurrent Agent Management
- **Challenge**: Multiple agents accessing same resources
- **Solution**: Strict worktree isolation and resource locking
- **Implementation**: Database-level coordination for resource allocation

### 4. GitHub API Integration
- **Challenge**: Rate limiting and authentication management
- **Solution**: Centralized GitHub client with proper credential handling
- **Implementation**: Reuse existing core package GitHub module

## Success Metrics

### MVP Success Criteria
1. **Single Coding Agent**: Complete lifecycle with real GitHub issue
2. **Terminal Streaming**: Real-time observation of agent activity
3. **Status Updates**: Accurate state tracking through MCP tools
4. **Resource Management**: Clean worktree and session lifecycle

### Full System Success Criteria
1. **Three Agent Types**: All agent types fully functional
2. **Parallel Operations**: Multiple agents per issue working simultaneously
3. **Real-Time UI**: Live status updates and terminal streaming
4. **Production Ready**: Error handling, monitoring, security

## Next Steps

### Immediate Actions
1. **Create Workflows Package**: Implement coding agent lifecycle
2. **MCP Tool Development**: Build core status-updating tools
3. **Database Implementation**: Create SQLite schema and operations
4. **Server Integration**: Connect REST API to workflow execution

### Technical Debt Management
- **Documentation**: API documentation for all new components
- **Testing**: Comprehensive test coverage for workflows
- **Error Handling**: Robust error recovery and user feedback
- **Performance**: Optimize for multiple concurrent agents

---

This specification represents our complete architectural understanding as of January 15, 2025. All future development should reference and align with these architectural decisions.