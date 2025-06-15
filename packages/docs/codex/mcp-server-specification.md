# MCP Server Specification

This document defines the Model Context Protocol (MCP) server for Claude Codex, providing tools that allow the three specialized agent types (Planning, Coding, Review) to coordinate instances, update state, and manage their lifecycles through structured tool calls.

## Overview

The MCP server acts as the coordination layer between Claude agents and the Claude Codex system. It provides standardized tools that enable:

**Agent Coordination**:
- Coding Agents can spawn Review Agents via `request_review`
- Review Agents can communicate with Coding Agents via `send_feedback`
- All agents can create PRs and query system state

**Status Communication**:
- Specific "status-updating" MCP tools trigger database state changes
- Database updates flow to UI via WebSocket notifications
- Complete audit trail of all agent interactions

**Git Integration**:
- MCP tools orchestrate git operations (merge, branch, worktree management)
- Tools provide both operational effects AND observability tracking
- Agent communication flows through git artifacts with database visibility

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

### 1. request_review

**Purpose**: Coding Agent requests creation of a Review Agent for completed work

**Input Schema**:
- `reviewer_prompt` (optional): Custom prompt for review agent
- `completion_message` (optional): Summary of completed work

**Agent Context Integration**:
- MCP server knows calling Coding Agent's instance ID from connection context
- Automatically determines source branch and worktree for review
- Only Coding Agents can call this tool (authorization boundary)

**Review Loop Protection**:
- Check current review iteration count for calling Coding Agent
- Enforce maximum review iterations (default: 3, configurable via user_config)
- Block `request_review` if agent is at review limit
- Return clear error message when review limit exceeded

**Status Update**: Triggers `WAITING_REVIEW` status for calling Coding Agent (if under review limit)

**Core Package Integration**:
- Use `createWorktree()` to fork review environment from Coding Agent's branch
- Use `createTmuxSession()` and `launchClaudeInteractive()` to start Review Agent
- Use `generateReviewPrompt()` for default review prompt generation

**Database Operations**:
- Create new instance record with type='review'
- Create relationship record linking Coding Agent → Review Agent
- Update Coding Agent status to `WAITING_REVIEW`
- Log MCP event for complete audit trail

**Agent Spawning Process with Loop Protection**:
1. **Validate Agent Type**: Ensure calling agent is a Coding Agent
2. **Check Review History**: Query instance_relationships for review iteration count
3. **Enforce Limits**: Block if agent has reached max review iterations (configurable, default: 3)
4. **Calculate Iteration**: Determine next review iteration number (previous + 1)
5. **Fork Worktree**: Create review environment from Coding Agent's current branch
6. **Launch Review Agent**: Start Review Agent in new tmux session
7. **Update Database**: Create relationship record with correct review_iteration
8. **Status Update**: Set Coding Agent to `WAITING_REVIEW`

**Loop Protection Logic**:
```sql
-- Before spawning review, check iteration count
SELECT COALESCE(MAX(review_iteration), 0) as current_iteration
FROM instance_relationships 
WHERE parent_instance = :coding_agent_id 
    AND relationship_type = 'spawned_review';

-- If current_iteration >= max_iterations (from config), reject request
```

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

**Purpose**: Review Agent delivers feedback to related Coding Agent via git merge + database tracking

**Input Schema**:
- `feedback` (required): Detailed feedback content
- `feedback_type` (required): `needs_work`, `suggestions`, `clarification`
- `priority` (optional): Feedback priority level
- `actionable_items` (optional): List of specific tasks

**Agent Context Integration**:
- MCP server knows calling agent is a Review Agent
- Automatically resolves relationship to find target Coding Agent
- Only Review Agents can call this tool (authorization boundary)

**Unified Git + Database Operation**:
1. **Git Operations**: Write feedback to structured file (e.g., `REVIEW_FEEDBACK.md`)
2. **Git Merge**: Merge feedback file into Coding Agent's worktree
3. **Database Tracking**: Log feedback exchange in `mcp_events` table
4. **Status Update**: Update instance relationships
5. **Agent Cleanup**: Terminate Review Agent after feedback delivery

**Core Package Integration**:
- Use existing file operations to create structured feedback documents
- Use git operations to merge feedback into target worktree
- Use database queries to resolve instance relationships

**Database Operations**:
- Store feedback record with full content for UI display
- Log MCP event with git commit hash for audit trail
- Update Review Agent status to `TERMINATED`
- Maintain instance relationship tracking

**Return Data**:
- `feedback_id`: Unique feedback identifier
- `git_commit_hash`: Commit hash of feedback merge
- `target_instance_id`: Coding Agent that received feedback
- `cleanup_status`: Review Agent termination status

**Key Innovation**: This tool provides both the operational mechanism (git merge) AND observability layer (database tracking) in one atomic operation. The Coding Agent receives feedback through normal git operations, while the UI gains complete visibility into the review process.

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
- **Agent Type Boundaries**: Each agent type has specific tool access patterns
- **Self-Only Operations**: Agents can only modify their own instance status
- **Relationship-Based**: Review Agents can only affect Coding Agents they're reviewing
- **Read-Only Queries**: All agents can query instance information
- **Controlled Spawning**: Only Coding Agents can spawn Review Agents

### Permission Rules by Agent Type

**Coding Agent Permissions**:
- `request_review`: Can spawn Review Agents for their own work (subject to loop limits)
- `create_pr`: Can create PRs for their own instance

**Review Agent Permissions**:
- `send_feedback`: Can send feedback to related Coding Agents only
- `create_pr`: Can create PRs for approved work (terminates review cycle)

**Planning Agent Permissions**:
- `create_issues`: Can create GitHub issues from planning artifacts
- `create_pr`: Can create PRs for planning documents (if needed)

**Removed Tool**: `query_instances`
- **Rationale**: Instance queries handled by UI server REST API, not MCP tools
- **Benefit**: Simplified MCP server with focused state-changing operations only
- **Agent Context**: Agents receive necessary context through tool responses, don't need general query access

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

## Review Loop Management

### Problem: Infinite Review Cycles
Without protection, the following loop could continue indefinitely:
```
Coding Agent → request_review → Review Agent → send_feedback → 
Coding Agent fixes → request_review → Review Agent → send_feedback → ...
```

### Solution: Configurable Review Limits

**Default Limits**:
- **Max Review Iterations**: 3 attempts per Coding Agent
- **Auto-Abandonment**: After 5 failed reviews, mark as abandoned
- **Timeout**: Auto-terminate stuck reviews after 24 hours

**Configuration via user_config table**:
```sql
('review.max_iterations', '3', FALSE)     -- Maximum review loops
('review.auto_abandon_after', '5', FALSE) -- Auto-abandon threshold  
('review.timeout_hours', '24', FALSE)     -- Review timeout
```

**Loop Protection Flow**:
1. **Coding Agent calls `request_review`**
2. **MCP Server checks review history** for this agent
3. **If under limit**: Spawn Review Agent with incremented iteration number
4. **If at limit**: Return error "Maximum review iterations reached (3). Consider creating PR or abandoning."
5. **UI displays**: Clear message about review limits and suggested actions

**Abandonment Strategy**:
- **Manual**: User can abandon via UI after multiple failed reviews
- **Automatic**: System abandons after configured threshold
- **Cleanup**: Abandoned agents terminate sessions and clean up worktrees

**Error Messages for Review Limits**:
```typescript
// When review limit reached
{
  "error": "REVIEW_LIMIT_EXCEEDED",
  "message": "Maximum review iterations (3) reached for agent work-123-a1",
  "suggestions": [
    "Create pull request with current work",
    "Abandon this approach and try different solution",
    "Manually review and fix issues before requesting review"
  ],
  "current_iteration": 3,
  "max_iterations": 3
}
```

## Integration with UI Server

### Shared Database Strategy
- **Single SQLite Database**: Both MCP server and UI server access same database file
- **Atomic Operations**: Use transactions for consistency between MCP operations and UI updates
- **Event Logging**: All MCP tool calls logged to `mcp_events` table for complete audit trail
- **Status-Driven Updates**: Only specific "status-updating" tools trigger UI notifications

### Real-Time Update Flow
**Status-Updating Tools** (`request_review`, `create_pr`, `send_feedback`):
1. **MCP Tool Called**: Agent calls status-updating MCP tool
2. **Git Operations**: Tool orchestrates necessary git operations (merge, branch, etc.)
3. **Database Updated**: Tool updates instance status and relationships atomically
4. **Event Logged**: Operation logged to `mcp_events` with git references
5. **WebSocket Notification**: UI server detects database changes and pushes updates
6. **UI Re-render**: Dashboard reflects new state in real-time

**Non-Status Tools** (`query_instances`):
- Execute operations but don't trigger UI notifications
- Still logged for audit trail but don't change instance state

### Coordination Requirements
- **Database Locking**: Handle concurrent access between MCP and UI servers
- **Event Polling**: UI server polls for new MCP events from status-updating tools
- **Git Synchronization**: Ensure git operations and database updates are atomic
- **Error Propagation**: MCP failures visible in UI dashboard with git context
- **State Consistency**: Database state must reflect actual worktree and session state
- **Agent Cleanup**: Failed or completed agents must clean up worktrees and sessions properly

---

*This MCP Server Specification provides the foundation for agent coordination within the Claude Codex UI system, enabling structured workflows and real-time state management.*