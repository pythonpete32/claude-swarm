# Database Schema Design

This document defines the SQLite database schema for Claude Codex, supporting the three-agent system with instance management, relationship tracking, parallel agent coordination, and GitHub integration.

## Design Principles

The schema is designed around the **Five Critical State Transitions** that we can reliably observe through status-updating MCP tools:

**✅ Observable State Transitions:**
- `STARTED`: Instance created with worktree + tmux session
- `WAITING_REVIEW`: Coding Agent called `request_review` MCP tool
- `PR_CREATED`: Agent called `create_pr` MCP tool  
- `PR_MERGED`: GitHub webhook/polling detected merge
- `PR_CLOSED`: GitHub webhook/polling detected closure

**✅ Agent Relationships We Track:**
- Coding Agent → Review Agent (via `request_review`)
- Multiple Coding Agents per GitHub issue (parallel development)
- Planning Agent → GitHub Issues (via issue creation)
- Feedback exchanges (via `send_feedback` with git commit tracking)

**❌ Things We Explicitly Don't Track:**
- Claude "idle" vs "actively working" states
- General terminal activity or arbitrary MCP calls
- Unstructured agent interactions outside our tool framework

## Core Tables

### 1. `instances` Table
```sql
CREATE TABLE instances (
    id TEXT PRIMARY KEY,                    -- "work-123-a1", "review-123-a1", "planning-a1"
    type TEXT NOT NULL,                     -- "coding", "review", "planning"
    status TEXT NOT NULL,                   -- "started", "waiting_review", "pr_created", "pr_merged", "pr_closed", "terminated"
    
    -- Git/Worktree Info
    worktree_path TEXT NOT NULL,
    branch_name TEXT NOT NULL,
    base_branch TEXT,
    
    -- Session Info
    tmux_session TEXT NOT NULL,
    claude_pid INTEGER,
    
    -- GitHub Integration
    issue_number INTEGER,
    pr_number INTEGER,
    pr_url TEXT,
    
    -- Agent Relationships (for Review Agents)
    parent_instance_id TEXT,                -- Links Review Agent to Coding Agent
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    terminated_at DATETIME,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Agent Configuration
    system_prompt TEXT,
    agent_number INTEGER DEFAULT 1,        -- For parallel agents (work-123-a1, work-123-a2)
    
    -- Constraints
    CHECK (type IN ('coding', 'review', 'planning')),
    CHECK (status IN ('started', 'waiting_review', 'pr_created', 'pr_merged', 'pr_closed', 'terminated')),
    
    FOREIGN KEY (parent_instance_id) REFERENCES instances(id)
);
```

### 2. `instance_relationships` Table
```sql
CREATE TABLE instance_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_instance TEXT NOT NULL,
    child_instance TEXT NOT NULL,
    relationship_type TEXT NOT NULL,        -- "spawned_review", "created_fork", "planning_to_issue"
    review_iteration INTEGER DEFAULT 1,    -- For tracking review loops (1st review, 2nd review, etc.)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,                          -- JSON for relationship-specific data
    
    FOREIGN KEY (parent_instance) REFERENCES instances(id),
    FOREIGN KEY (child_instance) REFERENCES instances(id),
    
    CHECK (relationship_type IN ('spawned_review', 'created_fork', 'planning_to_issue')),
    CHECK (review_iteration > 0 AND review_iteration <= 5)  -- Max 5 review iterations
);
```

### 3. `mcp_events` Table
```sql
CREATE TABLE mcp_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,               -- "request_review", "create_pr", "send_feedback"
    success BOOLEAN NOT NULL,
    error_message TEXT,
    metadata TEXT,                         -- JSON with tool-specific data
    git_commit_hash TEXT,                  -- For tools that create git operations
    status_change TEXT,                    -- New status if this was a status-updating tool
    is_status_updating BOOLEAN DEFAULT FALSE,  -- TRUE for tools that trigger UI updates
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (instance_id) REFERENCES instances(id)
);
```

### 4. `github_issues` Table
```sql
CREATE TABLE github_issues (
    number INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT,
    state TEXT NOT NULL,
    assignee TEXT,
    labels TEXT,                           -- JSON array
    created_at DATETIME,
    updated_at DATETIME,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    repo_owner TEXT NOT NULL,
    repo_name TEXT NOT NULL
);
```

### 5. `user_config` Table
```sql
CREATE TABLE user_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,                   -- Encrypted for sensitive values
    is_encrypted BOOLEAN DEFAULT FALSE,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Performance Indexes

```sql
-- Instance lookups
CREATE INDEX idx_instances_type_status ON instances(type, status);
CREATE INDEX idx_instances_issue ON instances(issue_number);
CREATE INDEX idx_instances_created ON instances(created_at);

-- Relationships
CREATE INDEX idx_relationships_parent ON instance_relationships(parent_instance);
CREATE INDEX idx_relationships_child ON instance_relationships(child_instance);
CREATE INDEX idx_relationships_review_iteration ON instance_relationships(parent_instance, review_iteration) 
    WHERE relationship_type = 'spawned_review';  -- For review loop detection

-- MCP Events
CREATE INDEX idx_mcp_events_instance ON mcp_events(instance_id);
CREATE INDEX idx_mcp_events_timestamp ON mcp_events(timestamp);

-- GitHub integration
CREATE INDEX idx_github_issues_state ON github_issues(state);
CREATE INDEX idx_github_issues_updated ON github_issues(updated_at);
```

## Key Queries

### Instance Discovery for Dashboard
```sql
-- Get all running instances with issue info
SELECT 
    i.*,
    gi.title as issue_title,
    CASE 
        WHEN i.status = 'running' THEN 'Running'
        ELSE 'Terminated'
    END as display_status
FROM instances i
LEFT JOIN github_issues gi ON i.issue_number = gi.number
WHERE i.status = 'running'
ORDER BY i.created_at DESC;
```

### Instance Relationships
```sql
-- Get all review instances spawned from a work instance
SELECT 
    child.*,
    ir.relationship_type,
    ir.created_at as relationship_created
FROM instances child
JOIN instance_relationships ir ON child.id = ir.child_instance
WHERE ir.parent_instance = 'work-123-a1'
  AND ir.relationship_type = 'spawned_review';
```

### Issue-based Grouping (Parallel Agents)
```sql
-- Get all Coding Agents working on the same issue (parallel development)
SELECT 
    i.*,
    COUNT(ir.child_instance) as review_count,
    MAX(ir.review_iteration) as max_review_iteration,
    MAX(ir.created_at) as last_review_request
FROM instances i
LEFT JOIN instance_relationships ir ON i.id = ir.parent_instance 
    AND ir.relationship_type = 'spawned_review'
WHERE i.issue_number = 123 
    AND i.type = 'coding'
GROUP BY i.id
ORDER BY i.created_at;

-- Review loop tracking - detect agents approaching review limits
SELECT 
    i.id as coding_agent,
    COUNT(ir.id) as total_reviews,
    MAX(ir.review_iteration) as highest_iteration,
    CASE 
        WHEN MAX(ir.review_iteration) >= 3 THEN 'APPROACHING_LIMIT'
        WHEN MAX(ir.review_iteration) >= 5 THEN 'AT_LIMIT'
        ELSE 'NORMAL'
    END as review_status
FROM instances i
JOIN instance_relationships ir ON i.id = ir.parent_instance
WHERE ir.relationship_type = 'spawned_review'
    AND i.type = 'coding'
    AND i.status != 'terminated'
GROUP BY i.id
HAVING MAX(ir.review_iteration) >= 2  -- Show agents with multiple review cycles
ORDER BY MAX(ir.review_iteration) DESC;
```

### MCP Tool Activity
```sql
-- Recent status-updating tool calls for UI updates
SELECT 
    me.*,
    i.type as instance_type,
    i.status as current_status
FROM mcp_events me
JOIN instances i ON me.instance_id = i.id
WHERE me.is_status_updating = TRUE
    AND me.timestamp > datetime('now', '-1 day')
ORDER BY me.timestamp DESC;

-- Complete agent interaction audit trail
SELECT 
    me.timestamp,
    me.tool_name,
    i.id as instance_id,
    i.type as agent_type,
    me.git_commit_hash,
    me.status_change,
    me.success
FROM mcp_events me
JOIN instances i ON me.instance_id = i.id
WHERE me.timestamp > datetime('now', '-1 week')
ORDER BY me.timestamp DESC;
```

## Configuration Management

### Database-Stored Configuration
```sql
-- User preferences that should persist
INSERT INTO user_config (key, value, is_encrypted) VALUES 
('github.token', 'encrypted_token_here', TRUE),
('editor.command', 'code', FALSE),
('worktrees.base_path', './worktrees', FALSE),
('terminal.theme', 'dark', FALSE),
('instances.cleanup_policy', 'manual', FALSE),
('review.max_iterations', '3', FALSE),           -- Maximum review loops per coding agent
('review.auto_abandon_after', '5', FALSE),       -- Auto-abandon after 5 failed reviews
('review.timeout_hours', '24', FALSE);           -- Auto-terminate stuck reviews after 24h
```

### Environment Variables
Keep these as environment variables rather than database config:
- Development/debugging flags
- Server ports and URLs  
- Database file path
- MCP server connection details

## Migration Strategy

```sql
-- Schema version tracking
CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_migrations (version) VALUES (1);
```

## Implementation Notes

1. **Five-Status Model**: Track the five observable state transitions triggered by status-updating MCP tools
2. **Parallel Agent Support**: Multiple Coding Agents per issue with proper relationship tracking
3. **Agent Type Boundaries**: Clear separation between coding, review, and planning agent data
4. **Git Integration Tracking**: MCP events include git commit hashes for complete audit trail
5. **Status-Updating Tools**: Only specific MCP tools (`request_review`, `create_pr`, `send_feedback`) trigger UI notifications
6. **Relationship Hierarchy**: Review Agents linked to parent Coding Agents via `parent_instance_id`
7. **GitHub Integration**: Cache issue data with sync timestamps to reduce API calls
8. **Security**: Encrypt sensitive configuration values like GitHub tokens
9. **Review Loop Protection**: `review_iteration` field and database constraints prevent infinite review cycles
10. **Configurable Limits**: Review limits stored in `user_config` table for flexible policy management
11. **Performance**: Indexes optimized for parallel agent queries and real-time dashboard updates

---

*This schema supports the core functionality defined in the [Architecture & Design Document](./architecture-design.md) while remaining simple and focused on observable state.*