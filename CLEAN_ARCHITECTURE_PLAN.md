# Claude Codex Clean Architecture Plan

**Version**: 1.0  
**Date**: 2025-01-16  
**Purpose**: Complete architectural blueprint for implementing Claude Codex three-agent system

## 🎯 Executive Summary

This document provides a complete architectural plan for implementing the Claude Codex system - a three-agent workflow automation platform where Planning, Coding, and Review agents work independently through specialized MCP (Model Context Protocol) interfaces.

### Key Principles
- **Agent Isolation**: No direct agent-to-agent communication
- **MCP-Driven Interaction**: Agents communicate only through MCP tools
- **Clean Layering**: Interface → Orchestration → Primitives
- **Minimal Complexity**: Simple, focused components

## 🏗️ High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Coding    │    │   MCP Review    │    │  MCP Planning   │
│     Server      │    │     Server      │    │     Server      │
│                 │    │                 │    │                 │
│ • request_review│    │ • request_changes│    │ • create_task   │
│ • create_pr     │    │ • create_pr     │    │ • analyze_repo  │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Workflows Package                            │
│                                                                 │
│  CodingWorkflow      ReviewWorkflow      PlanningWorkflow      │
│  • launch()          • launch()          • launch()            │
│  • terminate()       • terminate()       • terminate()         │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Core Package                               │
│                                                                 │
│  Database  Worktree  TMUX  Claude  GitHub  Git  Files  Config  │
└─────────────────────────────────────────────────────────────────┘
```

## 📦 Package Structure

### Final Package Layout
```
packages/
├── core/           # Primitive operations and utilities
├── workflows/      # Agent lifecycle orchestration  
├── mcp-coding/     # MCP server for coding agents
├── mcp-review/     # MCP server for review agents
└── mcp-planning/   # MCP server for planning agents
```

### Dependency Graph
```
mcp-* packages → workflows → core
```

## 🔄 Agent Lifecycle Flows

### Coding Agent Flow
```
1. Launch → Database record + Worktree + TMUX + Coding MCP + Claude
2. Work → Agent uses coding environment independently  
3. Decision Point:
   a) Direct PR → create_pr tool → GitHub PR → Done
   b) Request Review → request_review tool → Spawns Review Agent → Wait
4. If Review Feedback → TMUX injection → Continue from step 2
```

### Review Agent Flow  
```
1. Spawn → Database record + Review Worktree (from coding branch) + TMUX + Review MCP + Claude
2. Review → Agent analyzes code changes independently
3. Decision Point:
   a) Accept → create_pr tool → GitHub PR → Cleanup Review Agent → Done
   b) Deny → request_changes tool → TMUX inject to Coding Agent → Cleanup Review Agent → Done
```

### Planning Agent Flow
```
1. Launch → Database record + Worktree + TMUX + Planning MCP + Claude  
2. Analyze → Agent analyzes repository/issues independently
3. Output → create_task tool → Creates structured task plan → Done
```

## 🛠️ Core Package Design

### Purpose
Provides all primitive operations needed by the Claude Codex system. Zero business logic - just building blocks.

### Module Structure
```
packages/core/src/
├── core/
│   ├── database.ts     # Database operations and schema
│   ├── worktree.ts     # Git worktree management
│   ├── tmux.ts         # TMUX session management  
│   ├── claude.ts       # Claude Code integration
│   ├── github.ts       # GitHub API operations
│   ├── git.ts          # Git operations
│   └── files.ts        # File system operations
├── shared/
│   ├── types.ts        # All TypeScript interfaces
│   ├── errors.ts       # Error classes and codes
│   ├── config.ts       # Configuration management
│   └── validation.ts   # Input validation utilities
└── index.ts            # Public API exports
```

### Key Interfaces

#### Database Operations
```typescript
interface DatabaseInterface {
  // Connection
  connect(): Promise<void>
  disconnect(): Promise<void>
  
  // Instance management
  createInstance(instance: NewInstance): Promise<string>
  updateInstance(id: string, updates: Partial<Instance>): Promise<void>
  getInstance(id: string): Promise<Instance | null>
  deleteInstance(id: string): Promise<void>
  
  // Relationship tracking
  createRelationship(rel: NewRelationship): Promise<void>
  getRelationships(instanceId: string): Promise<Relationship[]>
  
  // MCP event logging
  logMCPEvent(event: MCPEvent): Promise<void>
  getMCPEvents(instanceId: string): Promise<MCPEvent[]>
}
```

#### Worktree Operations
```typescript
interface WorktreeOperations {
  createWorktree(config: WorktreeConfig): Promise<WorktreeResult>
  removeWorktree(path: string): Promise<void>
  listWorktrees(): Promise<WorktreeInfo[]>
  getWorktreeStatus(path: string): Promise<WorktreeStatus>
}

interface WorktreeConfig {
  name: string
  baseBranch: string
  targetBranch?: string
  setupContext?: boolean
}
```

#### TMUX Operations  
```typescript
interface TMUXOperations {
  createSession(config: TMUXConfig): Promise<TMUXSession>
  killSession(name: string): Promise<void>
  sendKeys(sessionName: string, keys: string[]): Promise<void>
  activateSession(sessionName: string): Promise<void>
  getSessionStatus(name: string): Promise<TMUXStatus>
}
```

#### Claude Integration
```typescript
interface ClaudeOperations {
  launchSession(config: ClaudeConfig): Promise<LaunchResult>
  terminateSession(sessionId: string): Promise<void>
  getSessionStatus(sessionId: string): Promise<ClaudeSession>
  validateInstallation(): Promise<InstallationInfo>
}

interface ClaudeConfig {
  workspacePath: string
  mcpServer: MCPServerConfig
  environmentVars?: Record<string, string>
  systemPrompt?: string
}
```

### Core Function Signatures

#### Database Functions
```typescript
export async function createInstance(instance: NewInstance, db?: DatabaseInterface): Promise<string>
export async function updateInstance(id: string, updates: Partial<Instance>, db?: DatabaseInterface): Promise<void>
export async function getInstance(id: string, db?: DatabaseInterface): Promise<Instance | null>
export async function logMCPEvent(event: MCPEvent, db?: DatabaseInterface): Promise<void>
```

#### Worktree Functions
```typescript
export async function createWorktree(config: WorktreeConfig): Promise<WorktreeResult>
export async function removeWorktree(path: string): Promise<void>
export async function getWorktreeStatus(path: string): Promise<WorktreeStatus>
```

#### TMUX Functions
```typescript
export async function createTMUXSession(config: TMUXConfig): Promise<TMUXSession>
export async function killTMUXSession(name: string): Promise<void>
export async function sendKeysToTMUX(sessionName: string, keys: string[]): Promise<void>
export async function activateTMUXSession(sessionName: string): Promise<void>
```

#### Claude Functions
```typescript
export async function launchClaudeSession(config: ClaudeConfig): Promise<LaunchResult>
export async function terminateClaudeSession(sessionId: string): Promise<void>
export async function getClaudeStatus(sessionId: string): Promise<ClaudeSession>
```

### Error Handling Strategy
```typescript
// Hierarchical error codes
const ERROR_CODES = {
  // Database errors
  DATABASE_CONNECTION_FAILED: 'DATABASE_CONNECTION_FAILED',
  DATABASE_QUERY_FAILED: 'DATABASE_QUERY_FAILED',
  
  // Worktree errors  
  WORKTREE_CREATION_FAILED: 'WORKTREE_CREATION_FAILED',
  WORKTREE_NOT_FOUND: 'WORKTREE_NOT_FOUND',
  
  // TMUX errors
  TMUX_SESSION_FAILED: 'TMUX_SESSION_FAILED',
  TMUX_SESSION_NOT_FOUND: 'TMUX_SESSION_NOT_FOUND',
  
  // Claude errors
  CLAUDE_LAUNCH_FAILED: 'CLAUDE_LAUNCH_FAILED',
  CLAUDE_SESSION_NOT_FOUND: 'CLAUDE_SESSION_NOT_FOUND'
}

// Error factory pattern
export class ErrorFactory {
  static database(code: string, message: string, context?: Record<string, unknown>): DatabaseError
  static worktree(code: string, message: string, context?: Record<string, unknown>): WorktreeError  
  static tmux(code: string, message: string, context?: Record<string, unknown>): TMUXError
  static claude(code: string, message: string, context?: Record<string, unknown>): ClaudeError
}
```

## 🔀 Workflows Package Design

### Purpose
Provides agent lifecycle orchestration by composing core operations into complete agent launch/terminate flows.

### Module Structure
```
packages/workflows/src/
├── workflows/
│   ├── coding.ts       # Coding agent orchestration
│   ├── review.ts       # Review agent orchestration  
│   └── planning.ts     # Planning agent orchestration
├── types/
│   └── workflow-types.ts # Workflow-specific interfaces
└── index.ts            # Public exports
```

### Workflow Classes

#### CodingWorkflow
```typescript
export class CodingWorkflow {
  constructor(private deps: WorkflowDependencies) {}
  
  /**
   * Launch a coding agent with full environment setup
   * @param config Coding configuration (prompt, issue, repository)
   * @returns Instance ID of launched coding agent
   */
  async launch(config: CodingConfig): Promise<string>
  
  /**
   * Terminate coding agent and cleanup all resources
   * @param instanceId Agent instance to terminate
   */
  async terminate(instanceId: string): Promise<void>
  
  /**
   * Get current status of coding agent
   * @param instanceId Agent instance ID
   */
  async getStatus(instanceId: string): Promise<CodingStatus>
}
```

#### ReviewWorkflow
```typescript
export class ReviewWorkflow {
  constructor(private deps: WorkflowDependencies) {}
  
  /**
   * Launch a review agent for an existing coding agent
   * @param config Review configuration (parent instance, review prompt)
   * @returns Instance ID of launched review agent
   */
  async launch(config: ReviewConfig): Promise<string>
  
  /**
   * Terminate review agent and cleanup resources
   * @param instanceId Review agent instance to terminate
   */
  async terminate(instanceId: string): Promise<void>
  
  /**
   * Get current status of review agent
   * @param instanceId Review agent instance ID  
   */
  async getStatus(instanceId: string): Promise<ReviewStatus>
}
```

### Workflow Configuration Types
```typescript
interface CodingConfig {
  prompt: string
  issue: {
    number: number
    title: string
    description: string
  }
  repository: {
    url: string
    baseBranch: string
  }
  requireReview?: boolean
  systemPrompt?: string
}

interface ReviewConfig {
  parentInstanceId: string
  reviewPrompt?: string
  preserveChanges?: boolean
  timeoutMinutes?: number
}

interface PlanningConfig {
  repository: {
    url: string  
    branch: string
  }
  analysisScope: 'full' | 'issues' | 'recent'
  outputFormat: 'structured' | 'markdown'
}
```

### Dependency Injection
```typescript
interface WorkflowDependencies {
  // Core function overrides for testing
  database?: DatabaseInterface
  createWorktree?: typeof createWorktree
  createTMUXSession?: typeof createTMUXSession
  launchClaudeSession?: typeof launchClaudeSession
  // ... other core functions
}
```

## 🔌 MCP Package Designs

### MCP Coding Package

#### Purpose
Provides MCP server with tools specific to coding agents.

#### Package Structure
```
packages/mcp-coding/
├── src/
│   ├── server.ts           # MCP server setup
│   ├── tools/
│   │   ├── request-review.ts   # Spawn review agent
│   │   └── create-pr.ts        # Create GitHub PR
│   └── types/
│       └── mcp-types.ts        # Tool-specific types
├── bin/
│   └── mcp-coding.js       # CLI entry point
└── package.json
```

#### Tool Specifications

##### request_review Tool
```typescript
interface RequestReviewInput {
  description: string  // What was accomplished and needs review
}

interface RequestReviewOutput {
  reviewInstanceId: string
  reviewWorkspace: string
  message: string
}

/**
 * Spawns a review agent to analyze the coding agent's work
 * Creates new worktree, TMUX session, and review MCP server
 * Updates coding agent status to 'under_review'
 */
export async function requestReviewTool(args: RequestReviewInput, context: MCPContext): Promise<RequestReviewOutput>
```

##### create_pull_request Tool  
```typescript
interface CreatePRInput {
  title: string
  description: string
  draft?: boolean
}

interface CreatePROutput {
  prUrl: string
  prNumber: number
  message: string
}

/**
 * Creates GitHub pull request from current branch
 * Updates agent status to 'completed'
 * Initiates resource cleanup
 */
export async function createPullRequestTool(args: CreatePRInput, context: MCPContext): Promise<CreatePROutput>
```

### MCP Review Package

#### Purpose  
Provides MCP server with tools specific to review agents.

#### Tool Specifications

##### request_changes Tool
```typescript
interface RequestChangesInput {
  feedback: string  // What needs to be changed and why
}

interface RequestChangesOutput {
  feedbackDelivered: boolean
  codingAgentReactivated: boolean
  message: string
}

/**
 * Provides feedback to coding agent and reactivates it
 * Injects feedback into coding agent's TMUX session
 * Updates coding agent status to 'feedback_received'
 * Terminates review agent
 */
export async function requestChangesTool(args: RequestChangesInput, context: MCPContext): Promise<RequestChangesOutput>
```

##### create_pull_request Tool
```typescript
// Same interface as coding MCP
/**
 * Approves changes and creates GitHub pull request
 * Updates parent coding agent status to 'completed'
 * Terminates review agent
 */
export async function createPullRequestTool(args: CreatePRInput, context: MCPContext): Promise<CreatePROutput>
```

### MCP Planning Package

#### Purpose
Provides MCP server with tools specific to planning agents.

#### Tool Specifications

##### create_task Tool
```typescript
interface CreateTaskInput {
  taskTitle: string
  taskDescription: string
  priority: 'low' | 'medium' | 'high'
  estimatedHours?: number
}

/**
 * Creates structured task from planning analysis
 * Saves task to database for later coding agent consumption
 */
export async function createTaskTool(args: CreateTaskInput, context: MCPContext): Promise<void>
```

##### analyze_repository Tool
```typescript
interface AnalyzeRepoInput {
  scope: 'architecture' | 'issues' | 'codebase' | 'dependencies'
  depth: 'shallow' | 'medium' | 'deep'
}

/**
 * Performs repository analysis using git and file system tools
 * Returns structured analysis for planning decisions
 */
export async function analyzeRepositoryTool(args: AnalyzeRepoInput, context: MCPContext): Promise<AnalysisResult>
```

## 🗄️ Database Schema

### Instance Table
```sql
CREATE TABLE instances (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('coding', 'review', 'planning')),
  status TEXT NOT NULL CHECK (status IN ('started', 'waiting_review', 'under_review', 'feedback_received', 'creating_pr', 'completed', 'failed', 'terminated')),
  
  -- Resource tracking
  worktree_path TEXT,
  branch_name TEXT,
  tmux_session TEXT,
  claude_session_id TEXT,
  mcp_server_pid INTEGER,
  
  -- Context
  issue_number INTEGER,
  system_prompt TEXT,
  parent_instance_id TEXT,
  
  -- GitHub integration
  pr_number INTEGER,
  pr_url TEXT,
  
  -- Timestamps
  created_at DATETIME NOT NULL,
  last_activity DATETIME NOT NULL,
  completed_at DATETIME,
  
  FOREIGN KEY (parent_instance_id) REFERENCES instances(id)
);
```

### MCP Events Table
```sql
CREATE TABLE mcp_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  parameters TEXT, -- JSON
  result TEXT,     -- JSON  
  error_message TEXT,
  timestamp DATETIME NOT NULL,
  
  FOREIGN KEY (instance_id) REFERENCES instances(id)
);
```

### Review Feedback Table
```sql
CREATE TABLE review_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_instance_id TEXT NOT NULL,
  coding_instance_id TEXT NOT NULL,
  feedback TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('changes_requested', 'approved')),
  created_at DATETIME NOT NULL,
  
  FOREIGN KEY (review_instance_id) REFERENCES instances(id),
  FOREIGN KEY (coding_instance_id) REFERENCES instances(id)
);
```

## 🚀 Implementation Strategy

### Phase 1: Core Package
1. **Database module** - Schema, migrations, basic operations
2. **Worktree module** - Git worktree creation/management  
3. **TMUX module** - Session management and key injection
4. **Claude module** - Session launching with MCP integration
5. **GitHub module** - PR creation and issue management
6. **Testing framework** - Unit tests with dependency injection

### Phase 2: Workflows Package  
1. **CodingWorkflow class** - Complete coding agent lifecycle
2. **ReviewWorkflow class** - Complete review agent lifecycle
3. **PlanningWorkflow class** - Complete planning agent lifecycle
4. **Integration tests** - End-to-end workflow testing

### Phase 3: MCP Servers
1. **MCP Coding server** - request_review and create_pr tools
2. **MCP Review server** - request_changes and create_pr tools  
3. **MCP Planning server** - create_task and analyze_repository tools
4. **Integration testing** - Real Claude agents with MCP tools

### Phase 4: Production Readiness
1. **Error handling** - Comprehensive error recovery
2. **Logging** - Structured logging throughout
3. **Monitoring** - Health checks and metrics
4. **Documentation** - API docs and deployment guides

## 🧪 Testing Strategy

### Unit Testing
- **Core functions**: Mock all external dependencies (database, git, tmux, claude)
- **Workflows**: Mock core functions, test orchestration logic
- **MCP tools**: Mock workflows, test tool interfaces

### Integration Testing  
- **Database operations**: Real database with test fixtures
- **Workflow coordination**: Real core functions with test git repos
- **MCP integration**: Real MCP servers with mock Claude responses

### End-to-End Testing
- **Full agent lifecycles**: Real environments with cleanup
- **Multi-agent scenarios**: Coding → Review → PR flows
- **Error scenarios**: Network failures, resource conflicts

## 📋 Success Criteria

### Functional Requirements
- [ ] Coding agent can launch, work, and create PRs
- [ ] Coding agent can request reviews and receive feedback  
- [ ] Review agent can analyze code and provide feedback
- [ ] Review agent can approve and create PRs
- [ ] Planning agent can analyze repos and create tasks
- [ ] All resources cleanup properly on termination

### Non-Functional Requirements
- [ ] Zero agent-to-agent coupling (only MCP communication)
- [ ] Clean error handling with actionable messages
- [ ] Complete test coverage for all components
- [ ] Production-ready logging and monitoring
- [ ] Clear documentation for each component

## 🔄 Future Evolution

### Potential Extensions
- **Web UI**: Dashboard for monitoring agent activities
- **Webhook integration**: GitHub webhook handling for PR events
- **Multi-repository**: Agents working across multiple repos
- **Agent pools**: Multiple agents of same type working in parallel
- **Custom MCP tools**: Plugin system for domain-specific tools

### Architectural Flexibility
- **MCP servers are independent**: Can be updated without changing workflows
- **Workflows are composable**: Can be mixed and matched for different use cases  
- **Core is stable**: Primitive operations rarely change
- **Database-driven**: All state is persistent and queryable

---

**This document serves as the complete blueprint for implementing Claude Codex. Each component can be developed independently following these specifications.**