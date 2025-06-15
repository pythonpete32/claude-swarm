# Claude Codex Architecture & Design Document

## Overview

Claude Codex is a UI-first multi-agent development platform that orchestrates three specialized agent types through isolated environments. The system abstracts away the complexity of Git worktrees and tmux sessions, providing an intuitive web interface for managing parallel Claude Code agents working on the same or different issues.

### Core Concept: Three-Agent System
The system manages three distinct agent types, each with specialized responsibilities:

**Planning Agent**: Conversational planning and specification creation
- Turn-based interaction with users to define requirements
- Creates formal artifacts (PRDs, specifications)
- Translates planning documents into GitHub issues

**Coding Agent**: Primary development workhorse  
- Issue-driven development with configurable system prompts
- Operates in observable interactive sessions
- Can spawn Review Agents for completed work
- Supports parallel instances per GitHub issue

**Review Agent**: Ephemeral, automated code review
- Spawned by Coding Agents via MCP tools
- Forks worktree for isolated review environment
- Makes binary decisions: Approve → PR or Reject → Feedback
- Communicates through git-based artifact exchange

Each agent instance consists of:
- **Git Worktree**: Isolated development environment with agent-specific context
- **tmux Session**: Persistent terminal session for real-time observation
- **Claude Agent**: AI assistant with full Claude Code capabilities + project-specific MCP tools

## System Architecture

### Package Structure
```
packages/
├── core/           # Existing - foundational functions (worktree, tmux, github, claude)
├── cli/            # Existing - command line interface  
├── ui/             # Web dashboard frontend (React + Vite + TypeScript)
├── server/         # UI backend (Hono + WebSocket + REST API)
└── mcp-codex/      # MCP server providing tools for Claude agents
```

### Data Flow Architecture
```
┌─ Web UI ─────────┐    ┌─ Claude Agents ─────┐
│ Dashboard        │    │ (with MCP tools)    │
│ Terminal Viewer  │    │                     │
│ Instance Manager │    │                     │
└────┬─────────────┘    └───────┬─────────────┘
     │                          │
┌────▼─────────────┐    ┌───────▼─────────────┐
│ UI Server        │    │ MCP Server          │
│ - REST API       │    │ - Agent Tools       │
│ - WebSocket      │    │ - State Updates     │
│ - Terminal Proxy │    │ - Instance Coord    │
└────┬─────────────┘    └───────┬─────────────┘
     │                          │
     └──────────────┬───────────┘
                    │
            ┌───────▼────────────┐
            │ Shared SQLite      │
            │ Database           │
            └────────────────────┘
```

## Design Decisions

### Instance Management Strategy
**Chosen: Discovery-Based (Lightweight)**
- Scan filesystem + processes to discover instances
- Resilient to machine restarts
- Worktrees and tmux sessions survive independently
- Lightweight database for coordination

### Agent Lifecycle Design
**Principle: Specialized Agent Types, Not Generic Workflows**

A "workflow" in Claude Codex is simply the lifecycle management of a specific agent type:

- **Coding Agent Workflow**: Launch → Monitor → Status Updates → Completion/Cleanup
- **Review Agent Workflow**: Spawn → Fork → Review → Decision → Cleanup  
- **Planning Agent Workflow**: Launch → Conversation → Document Creation → Issue Generation

**Key Insight**: Workflows are agent lifecycle management, not configurable process engines.

### Terminal Integration
**Chosen: Direct tmux Streaming**
- Pure tmux session streaming via WebSocket
- No middleware interference with Claude's interactive experience
- Maximum terminal real estate with collapsible sidebar controls

### Instance Identification
**Format: `{type}-{issue}-a{agent}`**
```
work-123-a1     # First Coding Agent on issue 123
work-123-a2     # Second Coding Agent on issue 123 (parallel development)
review-123-a1   # Review Agent for first agent's work
planning-a1     # Planning Agent for project specification
adhoc-a1        # Adhoc Coding Agent (no specific issue)
```

**Parallel Agent Support**: Multiple Coding Agents can work on the same issue simultaneously, each producing separate potential solutions as PRs. This allows for solution diversity and comparison.

### GitHub Integration
**Full Integration: Issues + Projects**
- Mirror GitHub Projects structure
- Support for custom fields and workflows
- Smart filtering and search capabilities

## User Interface Design

### Main Dashboard Layout
```
┌─ Claude Codex ────────────────── [⚙️ Settings] [📋 Kanban] ─┐
│                                                             │
│ ┌─ Launch New Instance ─────────────────────────────────────┐ │
│ │ 💬 What do you want to work on?                           │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ Implement authentication for the login page...         │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │                                                           │ │
│ │ Branch: [main ▼]  Issue: [#123 - Fix auth ▼] [🚀 Start] │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Active (3)] [Inactive (2)] [All (5)]                      │
│                                                             │
│ 🔽 work-123-a1                    ✅ Running        [View] │
│    │ Issue #123: Fix authentication system                 │
│    │ Branch: feat/auth-fix    Started: 2h ago    Agent 1  │
│    │ Last activity: 5min ago  Status: Working on tests    │
│    └─ [🔬 Review] [🗑️ Kill] [📁 Editor] [📋 Copy]        │
└─────────────────────────────────────────────────────────────┘
```

### Instance Detail View
```
┌─ work-123-a1 ────────────────────────────────────────────────────────┐
│ ← Dashboard     [⚙️] ← Click to expand sidebar                       │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─ Terminal ───────────────────────────────────────────────────────┐ │
│ │ claude@work-123-a1:~/worktrees/work-123-a1$                     │ │
│ │ > Working on authentication implementation...                    │ │
│ │ > Created new auth service                                       │ │
│ │ > Running test suite...                                          │ │
│ │ > ✅ All tests passing                                           │ │
│ │ > What would you like me to work on next?                       │ │
│ │ > █                                                              │ │
│ └──────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

**Collapsible Sidebar Controls:**
```
┌─ Actions ──────┐
│ 🔬 Launch Review│
│ 🗑️ Kill Instance│
│ 📁 Open Editor  │
│ 📋 Copy Branch  │
│ ├─ Fork Instance│
│ ├─ Merge Back   │
│ └─ Branch Info  │
│                │
│ ────────────── │
│ Issue #123     │
│ feat/auth      │
│ ✅ 2h ago      │
└────────────────┘
```

### Multiple Views
- **Dashboard**: Primary accordion view + optional table view
- **Kanban Board**: GitHub Projects integration with drag-drop
- **Settings**: Configuration and preferences

## State Management

### Instance Lifecycle
```
UI Chat Box → UI Server → Core Functions → Database Update
                ↓
    New Instance (worktree + tmux + Claude + MCP)
```

### Agent-Driven State Transitions
**Core Principle**: Status updates only occur through high-leverage MCP tool calls

```
Coding Agent → [MCP: request_review] → Review Agent spawned
Review Agent → [MCP: create_pr] → PR created + Review Agent terminated
Review Agent → [MCP: send_feedback] → Feedback merged to Coding Agent + Review Agent terminated
Coding Agent → [MCP: create_pr] → Direct PR creation (bypass review)
Planning Agent → [MCP: create_issues] → GitHub issues created from planning artifacts
```

**Five Critical State Transitions**:
- `STARTED`: Instance launched with worktree + tmux session
- `WAITING_REVIEW`: Coding Agent requested review via MCP tool
- `PR_CREATED`: Agent created pull request via MCP tool
- `PR_MERGED`: GitHub webhook/polling detected merge
- `PR_CLOSED`: GitHub webhook/polling detected closure

### Status Communication Architecture
**Primary Mechanism**: Status-updating MCP tools trigger database state changes

**Core Status-Updating MCP Tools**:
- `request_review` → `WAITING_REVIEW` status
- `create_pr` → `PR_CREATED` status
- `spawn_review_instance` → Creates new Review Agent instance
- `send_feedback` → Git merge + database event logging

**Rejected Approach**: Terminal output parsing, file watchers, or hybrid monitoring systems are unnecessary. The MCP-centric approach provides sufficient observability.

**UI Updates**: WebSocket notifications triggered by database state changes from MCP tool execution
**Fallback**: Periodic discovery scanning only for orphaned instances (machine restart recovery)

## Technical Specifications

### MCP Integration Architecture
**Agent Access Pattern**: All agents connect to shared MCP server providing project-specific tools

**Core MCP Tools (Status-Updating Only)**:
1. **`request_review`** - Coding Agent spawns Review Agent with review loop protection
2. **`create_pr`** - Any agent creates GitHub pull request
3. **`send_feedback`** - Review Agent delivers feedback via git merge + database tracking

**Review Loop Protection**: `request_review` enforces configurable maximum review iterations (default: 3) to prevent infinite Coding Agent → Review Agent → Feedback loops.

**Unified Communication**: MCP tools orchestrate git operations (don't bypass git) while providing database tracking for UI observability. For example, `send_feedback` both merges feedback files into the Coding Agent's worktree AND logs the interaction for dashboard visibility.

### Database Strategy
**Chosen: SQLite**
- Simple relational queries for instance relationships
- Atomic transactions for state consistency
- Shared between UI Server and MCP Server

### Launch Context
```bash
# User runs from their project root
cd my-project/
npx @claude-codex/ui

# System automatically detects:
# - Git repository root
# - Current branch
# - GitHub remote
# - Available issues
# - Existing worktrees
```

### Instance Actions Available
- **View**: Open instance detail with terminal
- **Review**: Launch review agent for completed work
- **Kill**: Terminate instance and cleanup
- **Editor**: Open worktree in configured editor (VS Code, Cursor, etc.)
- **Copy**: Copy branch name or other details
- **Fork**: Create new instance from current branch
- **Merge**: Merge instance branch back to parent

## Implementation Strategy

### MVP Phase 1: Core Dashboard
**Priority 1 - Essential Features:**
1. Main dashboard with chat box for launching instances
2. Accordion view of active/inactive instances  
3. Terminal streaming via WebSocket
4. Basic instance management (create, view, kill)

**Dependencies:**
- **Workflows Package**: Agent lifecycle orchestration (NEW PACKAGE - 0% complete)
- **Database Module**: SQLite operations in core package (NEW MODULE - 0% complete)
- **MCP Server**: Agent coordination tools (NEW PACKAGE - 0% complete)
- **UI Server**: REST API + WebSocket integration (5% complete)
- **Core Package Integration**: Replace server mocks with real operations (MISSING)

**Current Implementation Gap**: The core package (95% complete) and UI components (80% complete) exist, but the critical integration layers are missing.

### Phase 2: Agent Integration  
**Priority 2 - Agent Coordination:**
1. MCP server with core agent tools
2. Agent-driven state transitions
3. Cross-instance communication (spawn review, etc.)
4. Real-time state synchronization

### Phase 3: Advanced Features
**Priority 3 - Enhanced Experience:**
1. Kanban board with GitHub Projects integration
2. Advanced instance actions (fork, merge, etc.)
3. Settings and configuration management
4. Performance optimizations

## Development Tracks

### Parallel Development Approach
**Track A: UI + UI Server**
- Can start immediately using existing core functions
- Mock/simulate agent interactions initially
- Focus on UX and terminal integration

**Track B: MCP Server**
- Build agent tools independently
- Test with standalone Claude instances
- Develop state synchronization logic

**Track C: Database & Integration**
- Define shared schema
- Build integration layer
- Coordinate between Track A and B

### Dogfooding Strategy
Start using the tool to build itself as soon as basic functionality is available, allowing rapid iteration and real-world testing of the core workflows.

## Outstanding Specifications Required

### 1. Database Schema Design
**Status: ✅ Complete** - See [Database Schema](./database-schema.md)
- ✅ SQLite table structure for instances
- ✅ Instance relationships (work → review → PR chains)
- ✅ Performance indexes
- ✅ Migration strategy

**Tables Defined:**
- `instances` - Core instance data
- `instance_relationships` - Parent/child relationships  
- `github_issues` - Issue/PR mappings
- `mcp_events` - MCP tool call tracking
- `user_config` - Settings and preferences

### 2. MCP Server Specification
**Status: ✅ Complete** - See [MCP Server Specification](./mcp-server-specification.md)
- ✅ Complete tool interfaces and schemas defined
- ✅ Error handling and validation patterns specified
- ✅ Security model for agent authorization implemented
- ✅ Tool discovery and registration documented

**Core Tools Specified:**
- ✅ `request_review` - Coding Agent spawns Review Agent (with loop protection)
- ✅ `create_pr` - Generate PR from completed work
- ✅ `send_feedback` - Review Agent delivers feedback via git merge + database tracking

**Design Principle**: Minimal core tool set focused on state-changing operations only. Instance queries handled by UI server REST API, not MCP tools.

### 3. UI Component Architecture
**Status: ✅ Complete** - See [UI Component Architecture](./ui-component-architecture.md)
- ✅ React component hierarchy and data flow defined
- ✅ State management strategy specified (React Query + Zustand + useState)
- ✅ Component interface definitions with TypeScript
- ✅ Styling system and design tokens architecture

**Key Components Specified:**
- ✅ `Dashboard` - Main instance management view
- ✅ `InstanceCard` - Accordion item for each instance
- ✅ `TerminalView` - Full-screen terminal interface
- ✅ `CreateInstanceForm` - New instance creation interface
- ✅ `KanbanBoard` - GitHub Projects integration

### 4. API Specification
**Status: Required**
- REST endpoint definitions with request/response schemas
- WebSocket message protocols for terminal streaming
- Authentication and authorization strategy
- Error response formats and codes

**REST Endpoints:**
- `GET /api/instances` - List all instances
- `POST /api/instances` - Create new instance
- `DELETE /api/instances/:id` - Terminate instance
- `GET /api/github/issues` - Fetch available issues
- `GET /api/github/projects` - Fetch project boards

**WebSocket Protocols:**
- Terminal session attachment and streaming
- Real-time instance status updates
- Bidirectional terminal I/O

### 5. Configuration Management
**Status: Required**
- Environment variable definitions
- User preference storage and sync
- Default configuration values
- Runtime configuration validation

**Configuration Areas:**
- GitHub integration settings
- Editor preferences (VS Code, Cursor, etc.)
- Terminal appearance and behavior
- Instance lifecycle policies
- MCP server connection details

### 6. Integration Specifications
**Status: Required**
- GitHub API integration patterns
- Claude Code MCP attachment process
- Core package function mapping
- Error propagation between layers

**Integration Points:**
- How UI Server calls core package functions
- How MCP Server shares database with UI Server
- How agents discover and connect to MCP Server
- How real-time updates flow through the system

### 7. Testing Strategy
**Status: Required**
- Unit testing approach for each package
- Integration testing between packages
- End-to-end testing scenarios
- Mock strategies for external dependencies

**Test Coverage:**
- MCP tool functionality with mock Claude agents
- Database operations and schema validation
- WebSocket terminal streaming reliability
- GitHub API integration resilience

### 8. Deployment & Distribution
**Status: Required**
- Package build and publishing strategy
- Local development setup instructions
- NPX launch configuration
- Dependency management between packages

**Distribution:**
- How users install and run `npx @claude-codex/ui`
- How MCP server gets bundled and launched
- How packages discover each other locally
- Version compatibility between packages

---

*This document captures the architectural decisions and design choices made for Claude Codex UI, providing the foundation for implementation across multiple parallel development tracks.*

**Next Phase:** Complete the outstanding specifications above before beginning implementation to ensure smooth parallel development and minimal coordination overhead.