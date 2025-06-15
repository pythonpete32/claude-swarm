# Claude Codex UI: Architecture & Design Document

## Overview

Claude Codex UI is a local development instance manager that provides a web-based dashboard for managing multiple Claude Code agents working in isolated environments. It abstracts away the complexity of Git worktrees and tmux sessions, providing an intuitive interface similar to ChatGPT Codex but running locally.

### Core Concept
Each "instance" consists of:
- **Git Worktree**: Isolated development environment
- **tmux Session**: Persistent terminal session
- **Claude Agent**: AI assistant with full context

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

### Workflow Design
**Chosen: Issue-Centric**
- `start-work-session` (issue + optional prompt)
- `start-review-session` 
- `start-adhoc-session` (just prompt)

### Terminal Integration
**Chosen: Direct tmux Streaming**
- Pure tmux session streaming via WebSocket
- No middleware interference with Claude's interactive experience
- Maximum terminal real estate with collapsible sidebar controls

### Instance Identification
**Format: `{type}-{issue}-a{agent}`**
```
work-123-a1     # First agent on issue 123
work-123-a2     # Second agent on issue 123  
review-123-a1   # Review of first agent's work
adhoc-a1        # First adhoc session
```

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
```
work-123-a1 → [MCP: spawn_review] → review-123-a1
review-123-a1 → [MCP: create_pr] → Done state  
review-123-a1 → [MCP: send_feedback] → work-123-a1 (iteration)
```

### Real-Time Updates
**Primary**: Agent MCP calls trigger database updates
**Fallback**: Periodic discovery scanning for orphaned instances
**UI**: WebSocket for real-time dashboard updates

## Technical Specifications

### MCP Integration
- Claude agents launch with custom MCP server attached
- MCP provides tools for instance management and coordination
- Function calls automatically update shared database state

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
- UI Server with REST API + WebSocket
- SQLite database schema
- Integration with existing core package functions

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

**Tools Specified:**
- ✅ `spawn_review_instance` - Create review from work instance
- ✅ `create_pull_request` - Generate PR from completed work
- ✅ `send_feedback` - Pass review feedback to work instance
- ✅ `update_instance_status` - Real-time status updates
- ✅ `query_instances` - Query instance metadata and relationships

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