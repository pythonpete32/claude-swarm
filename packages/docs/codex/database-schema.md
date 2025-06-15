# Database Schema Design

This document defines the SQLite database schema for Claude Codex UI, supporting instance management, relationship tracking, and GitHub integration.

## Design Principles

The schema is designed to track only what we can actually observe and control:

**✅ Things We Know:**
- When instances are created (via UI or MCP)
- When our MCP tools are called (`spawn_review_instance`, `create_pull_request`, etc.)
- When instances are terminated (process dies or user kills)
- Relationships created through our tools
- GitHub issue data (from API)

**❌ Things We Can't Know:**
- Whether Claude is "idle" vs "actively working" 
- General "activity" in the terminal
- Arbitrary MCP calls to other tools
- User interactions within Claude that don't use our tools

## Core Tables

### 1. `instances` Table
```sql
CREATE TABLE instances (
    id TEXT PRIMARY KEY,                    -- "work-123-a1", "review-123-a1", etc.
    type TEXT NOT NULL,                     -- "work", "review", "adhoc"
    status TEXT NOT NULL,                   -- "running", "terminated"
    
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
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    terminated_at DATETIME,
    
    -- Metadata
    prompt TEXT,
    agent_number INTEGER DEFAULT 1,
    
    CHECK (status IN ('running', 'terminated'))
);
```

### 2. `instance_relationships` Table
```sql
CREATE TABLE instance_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_instance TEXT NOT NULL,
    child_instance TEXT NOT NULL,
    relationship_type TEXT NOT NULL,        -- "spawned_review", "created_fork"
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (parent_instance) REFERENCES instances(id),
    FOREIGN KEY (child_instance) REFERENCES instances(id),
    
    CHECK (relationship_type IN ('spawned_review', 'created_fork'))
);
```

### 3. `mcp_events` Table
```sql
CREATE TABLE mcp_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,               -- "spawn_review_instance", "create_pull_request"
    success BOOLEAN NOT NULL,
    error_message TEXT,
    metadata TEXT,                         -- JSON with tool-specific data
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

### Issue-based Grouping
```sql
-- Get all instances for a specific issue
SELECT *
FROM instances
WHERE issue_number = 123
ORDER BY created_at;
```

### MCP Tool Activity
```sql
-- Recent MCP tool usage for debugging
SELECT 
    me.*,
    i.type as instance_type
FROM mcp_events me
JOIN instances i ON me.instance_id = i.id
WHERE me.timestamp > datetime('now', '-1 day')
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
('instances.cleanup_policy', 'manual', FALSE);
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

1. **Instance Status**: Only track `running` vs `terminated` - we can't reliably detect "idle" state
2. **Relationships**: Only track relationships created through our MCP tools
3. **GitHub Integration**: Cache issue data to reduce API calls
4. **Security**: Encrypt sensitive configuration values like GitHub tokens
5. **Performance**: Indexes optimized for dashboard queries and instance lookups

---

*This schema supports the core functionality defined in the [Architecture & Design Document](./architecture-design.md) while remaining simple and focused on observable state.*