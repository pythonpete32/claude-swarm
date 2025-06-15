# MCP Server Specification

This document defines the Model Context Protocol (MCP) server for Claude Codex UI, providing tools that allow Claude agents to coordinate instances, update state, and manage workflows.

## Overview

The MCP server acts as the coordination layer between Claude agents and the Codex UI system. It provides standardized tools that agents can call to:

- Spawn new instances (reviews, forks)
- Update instance status and metadata
- Create pull requests and handle workflow outcomes
- Query instance information and relationships
- Send feedback between agents

## Architecture Principles

### Core Package Integration
The MCP server **MUST** reuse existing functions from `@claude-swarm/core`:
- Use `createWorktree()` for all worktree operations
- Use `createTmuxSession()` and `launchClaudeInteractive()` for session management
- Use `createPullRequest()` from core GitHub integration
- Use `generateReviewPrompt()` and `generateWorkPrompt()` for prompt generation
- Use existing validation and error handling patterns

### Responsibility Boundaries
- **MCP Server**: Tool interface, validation, database updates, agent coordination
- **Core Package**: All actual operations (Git, tmux, GitHub, file system)
- **Database**: State persistence and instance relationship tracking

### Connection Model
```
┌─ Claude Agent ─────────┐    ┌─ MCP Server ─────────┐    ┌─ Core Package ──┐
│ Instance: work-123-a1  │───▶│ Tool: spawn_review   │───▶│ createWorktree() │
│ Calls MCP tools       │    │ Validates & executes │    │ createTmuxSession│
│ Gets structured data   │◀───│ Returns results      │◀───│ launchClaude()   │
└────────────────────────┘    └──────────────────────┘    └──────────────────┘
                                        │
                                        ▼
                               ┌─ SQLite Database ──┐
                               │ Update instance    │
                               │ Log MCP events     │
                               │ Track relationships│
                               └────────────────────┘
```

## Tool Specifications

### 1. spawn_review_instance

**Purpose**: Creates a review instance from a completed work instance

**Input Schema**:
- `reviewer_prompt` (optional): Custom prompt for review agent

**Agent Context Integration**:
- MCP server knows calling agent's instance ID from connection context
- Automatically determines which work instance needs review
- No need for agent to specify instance IDs

**Core Package Integration**:
- Use `createWorktree()` to create review environment from work branch
- Use `createTmuxSession()` and `launchClaudeInteractive()` to start review agent
- Use `generateReviewPrompt()` for default review prompt generation

**Database Operations**:
- Create new instance record with type='review'
- Create relationship record linking work → review
- Log MCP event for audit trail

**Return Data**:
- `review_instance_id`: Generated ID for new review instance
- `session_name`: tmux session name for monitoring
- `worktree_path`: Path to review environment
- `branch_name`: Branch being reviewed

### 2. create_pull_request

**Purpose**: Creates a GitHub pull request from completed work

**Input Schema**:
- `title` (required): PR title
- `description` (required): PR body/description
- `base_branch` (optional): Target branch (defaults to main)

**Agent Context Integration**:
- MCP server knows calling agent's instance ID from connection context
- Automatically uses agent's current branch and worktree

**Core Package Integration**:
- Use `detectRepository()` to get repository information
- Use `getDiff()` to validate changes exist
- Use `createPullRequest()` from core GitHub integration

**Database Operations**:
- Update instance record with PR number
- Log MCP event for audit trail

**Return Data**:
- `pr_number`: GitHub PR number
- `pr_url`: Direct link to created PR
- `branch_name`: Branch that was merged

### 3. send_feedback

**Purpose**: Sends feedback from a review instance to a work instance

**Input Schema**:
- `feedback` (required): Detailed feedback content
- `feedback_type` (required): Type - needs_work, suggestions, clarification
- `priority` (optional): Feedback priority level

**Agent Context Integration**:
- MCP server knows calling agent is a review instance
- Automatically looks up relationship to find target work instance
- No need to specify from/to instance IDs

**Core Package Integration**:
- Use existing file operations to write feedback documents
- Use database queries to find instance relationships

**Database Operations**:
- Store feedback record for persistence
- Automatically resolve relationship from review → work instance
- Log MCP event for audit trail

**Return Data**:
- `feedback_id`: Unique feedback identifier
- `delivery_status`: delivered or queued
- `target_instance_id`: Work instance that received feedback

## Error Handling

### Error Categories
- **Validation Errors**: Invalid input data or instance IDs
- **State Errors**: Instance not in correct state for operation
- **External Service Errors**: GitHub API, Git operations, tmux failures
- **Database Errors**: SQLite operations and concurrent updates

### Error Response Format
All MCP tools return structured errors with:
- `code`: Standardized error code
- `message`: Human-readable description
- `instance_id`: Related instance (when applicable)
- `tool_name`: Tool that generated the error

### Error Handling Strategy
- **Reuse Core Package Errors**: Use existing error codes and patterns from `@claude-swarm/core`
- **Database Rollback**: Ensure database consistency on failures
- **Event Logging**: Log all failures to `mcp_events` table for debugging
- **Graceful Degradation**: Partial failures should not break entire workflows

## Security Model

### Agent Authorization Principles
- **Self-Only Operations**: Agents can only modify their own instance status
- **Relationship-Based**: Review agents can only affect work instances they're reviewing
- **Read-Only Queries**: All agents can query instance information
- **Work Agent Spawning**: Only work agents can spawn review instances of their work

### Permission Rules
- `spawn_review_instance`: Work agents can spawn reviews of their own work
- `create_pull_request`: Any agent can create PRs for their own instance
- `send_feedback`: Review agents can send feedback to related work instances
- `update_instance_status`: Agents can only update their own status
- `query_instances`: Read-only access for all agents

### Input Validation Strategy
- **Reuse Core Validators**: Use existing validation from `@claude-swarm/core`
- **Instance ID Patterns**: Validate against established naming conventions
- **Schema Validation**: JSON schema validation for all tool inputs
- **Relationship Validation**: Verify relationships exist before operations

## Configuration Requirements

### Environment Variables
- `MCP_SERVER_PORT`: Port for MCP server (default: 3001)
- `MCP_DATABASE_PATH`: Path to shared SQLite database
- `GITHUB_TOKEN`: GitHub API authentication
- `MCP_LOG_LEVEL`: Logging verbosity level
- `MCP_TOOL_TIMEOUT`: Timeout for tool operations

### Server Initialization Requirements
- Initialize shared SQLite database connection
- Register all 5 MCP tools with proper schemas
- Configure timeout and error handling
- Set up logging and metrics collection
- Ensure proper shutdown cleanup

### Integration Configuration
- **Database**: Shared SQLite instance with UI server
- **Core Package**: Import and use existing functions
- **Agent Discovery**: How agents find and connect to MCP server
- **Logging**: Consistent with existing logging patterns

## Integration with UI Server

### Shared Database Strategy
- **Single SQLite Database**: Both MCP server and UI server access same database file
- **Atomic Operations**: Use transactions for consistency between MCP operations and UI updates
- **Event Logging**: All MCP tool calls logged to `mcp_events` table for UI dashboard

### Real-Time Update Flow
1. **MCP Tool Called**: Agent calls MCP tool (e.g., spawn_review_instance)
2. **Database Updated**: MCP server updates instances/relationships tables
3. **Event Logged**: Operation logged to mcp_events table
4. **UI Notification**: UI server detects changes and updates dashboard

### Coordination Requirements
- **Database Locking**: Handle concurrent access between MCP and UI servers
- **Event Polling**: UI server polls for new MCP events to trigger updates
- **Error Propagation**: MCP failures visible in UI dashboard
- **State Consistency**: Ensure database always reflects actual system state

---

*This MCP Server Specification provides the foundation for agent coordination within the Claude Codex UI system, enabling structured workflows and real-time state management.*