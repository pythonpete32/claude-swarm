# Database Module Usage Guide

## Quick Start

```typescript
import { initializeDatabase, type DatabaseInterface } from '@claude-codex/core/database';

// Initialize with default local-first configuration
const db: DatabaseInterface = await initializeDatabase();

// Create an instance
const instanceId = await db.createInstance({
  id: 'work-123-a1',
  type: 'coding',
  status: 'started',
  worktree_path: '/path/to/worktree',
  branch_name: 'feature/new-feature',
  base_branch: 'main',
  tmux_session: 'claude-session',
  claude_pid: 12345,
  issue_number: 123,
  agent_number: 1,
  system_prompt: 'You are a coding assistant...'
});

// Update instance status
await db.updateInstanceStatus(instanceId, 'waiting_review');

// List instances with filtering
const instances = await db.listInstances({
  types: ['coding'],
  statuses: ['started', 'waiting_review'],
  limit: 10,
  orderBy: 'last_activity',
  orderDirection: 'DESC'
});
```

## Configuration

### Default Local-First Setup
```typescript
import { getDefaultDatabaseConfig } from '@claude-codex/core/database';

const defaultConfig = getDefaultDatabaseConfig();
// Uses: file:claude-codex.db, WAL mode, auto-migrate enabled
```

### Custom Configuration
```typescript
const db = await initializeDatabase({
  local: {
    file: 'file:./my-database.db',
    enableWAL: true,
    busyTimeout: 10000,
    autoMigrate: true,
    logQueries: false
  },
  cloud: {
    enabled: false  // Local-first by default
  },
  connection: {
    maxRetries: 5,
    retryDelay: 2000,
    queryTimeout: 60000
  }
});
```

### Future Cloud Sync Setup
```typescript
// When cloud features are needed
const db = await initializeDatabase({
  local: {
    file: 'file:./local.db',
    enableWAL: true,
    autoMigrate: true
  },
  cloud: {
    enabled: true,
    syncUrl: 'libsql://your-database.turso.io',
    authToken: 'your-auth-token',
    syncInterval: 300,  // 5 minutes
    readYourWrites: true
  }
});
```

## Core Operations

### Instance Management
```typescript
// Create instance
const instanceId = await db.createInstance({
  id: 'unique-id',
  type: 'coding' | 'review' | 'planning',
  status: 'started' | 'waiting_review' | 'pr_created' | 'terminated',
  worktree_path: '/path/to/worktree',
  branch_name: 'feature-branch',
  base_branch: 'main',
  tmux_session: 'session-name',
  claude_pid: 12345,
  issue_number: 123,
  agent_number: 1,
  system_prompt: 'Your prompt...'
});

// Update instance
await db.updateInstance(instanceId, {
  status: 'waiting_review',
  pr_number: 456,
  pr_url: 'https://github.com/org/repo/pull/456'
});

// Get instance
const instance = await db.getInstance(instanceId);

// Delete instance
await db.deleteInstance(instanceId);
```

### MCP Event Tracking
```typescript
// Log successful operation
await db.logMCPEvent({
  instance_id: 'work-123-a1',
  tool_name: 'edit_file',
  success: true,
  metadata: JSON.stringify({ file: 'src/main.ts', lines: 50 })
});

// Log failed operation
await db.logMCPEvent({
  instance_id: 'work-123-a1',
  tool_name: 'run_tests',
  success: false,
  error_message: 'Test suite failed with 3 errors',
  metadata: JSON.stringify({ failed_tests: ['test1', 'test2', 'test3'] })
});

// Get events for instance
const events = await db.getMCPEvents('work-123-a1', 50);

// Get recent events across all instances
const recentEvents = await db.getRecentMCPEvents(
  new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
);
```

### Instance Relationships
```typescript
// Create parent-child relationship
await db.createRelationship({
  parent_instance: 'work-123-a1',
  child_instance: 'review-123-a1',
  relationship_type: 'spawned_review',
  review_iteration: 1,
  metadata: JSON.stringify({ reason: 'Code review requested' })
});

// Get all relationships for an instance
const relationships = await db.getRelationships('work-123-a1');

// Update relationship
await db.updateRelationship(relationshipId, {
  review_iteration: 2
});
```

### GitHub Integration
```typescript
// Sync GitHub issue
await db.upsertGitHubIssue({
  number: 123,
  title: 'Implement new feature',
  body: 'Description of the feature...',
  state: 'open',
  assignee: 'developer',
  labels: JSON.stringify(['feature', 'priority-high']),
  repo_owner: 'organization',
  repo_name: 'repository'
});

// Get GitHub issue
const issue = await db.getGitHubIssue(123);

// Bulk sync issues
await db.syncGitHubIssues(issues);
```

### Configuration Management
```typescript
// Set configuration
await db.setConfig('github.token', 'ghp_token123', true); // encrypted
await db.setConfig('default.branch', 'main', false);

// Get configuration
const token = await db.getConfig('github.token');
const defaultBranch = await db.getConfig('default.branch');

// Delete configuration
await db.deleteConfig('old.setting');
```

### Advanced Filtering
```typescript
// Complex instance filtering
const instances = await db.listInstances({
  types: ['coding', 'review'],
  statuses: ['started', 'waiting_review'],
  issueNumber: 123,
  parentInstance: 'work-123-a1',
  orderBy: 'last_activity',
  orderDirection: 'DESC',
  limit: 20,
  offset: 40  // For pagination
});

// Filter by date ranges (using created_at ordering)
const recentInstances = await db.listInstances({
  orderBy: 'created_at',
  orderDirection: 'DESC',
  limit: 10
});
```

## Error Handling

All database operations use standardized error codes:

```typescript
import { ERROR_CODES } from '@claude-codex/core/errors';

try {
  await db.createInstance(instance);
} catch (error) {
  if (error.code === ERROR_CODES.DATABASE_INSTANCE_EXISTS) {
    console.log('Instance already exists');
  } else if (error.code === ERROR_CODES.DATABASE_INSERT_FAILED) {
    console.log('Failed to create instance:', error.message);
  }
}
```

### Available Error Codes:
- `DATABASE_CONNECTION_FAILED`
- `DATABASE_INITIALIZATION_FAILED`
- `DATABASE_INSTANCE_EXISTS`
- `DATABASE_INSTANCE_NOT_FOUND`
- `DATABASE_RELATIONSHIP_EXISTS`
- `DATABASE_INSERT_FAILED`
- `DATABASE_UPDATE_FAILED`
- `DATABASE_DELETE_FAILED`
- `DATABASE_QUERY_FAILED`
- `DATABASE_LOG_FAILED`
- `DATABASE_OPERATION_FAILED`

## Database Maintenance

```typescript
// Manual vacuum (optimize database)
await db.vacuum();

// Create backup
await db.backup('/path/to/backup.db');

// Manual sync (if cloud enabled)
await db.sync();

// Check connection status
const isConnected = db.isConnected();

// Disconnect (cleanup)
await db.disconnect();
```

## Migration Management

Migrations are handled automatically by default:

```typescript
// Automatic migrations (default)
const db = await initializeDatabase({
  local: { autoMigrate: true }
});

// Manual migration control
const db = await initializeDatabase({
  local: { autoMigrate: false }
});

// Run migrations manually if needed
import { runMigrationsWithDatabase } from '@claude-codex/core/db/migrate';
await runMigrationsWithDatabase(db);
```

## Testing Support

For testing, use the provided test utilities:

```typescript
import { createInMemoryTestDb } from '@claude-codex/core/tests/fixtures/test-utils';

// In-memory database for unit tests
const testDb = await createInMemoryTestDb();

// Generate test data
const testInstance = generateTestInstance({
  type: 'coding',
  status: 'started'
});

await testDb.createInstance(testInstance);
```

## Performance Considerations

1. **Indexing**: All queries use appropriate indexes for performance
2. **WAL Mode**: Enabled by default for better concurrency
3. **Connection Pooling**: Single connection with efficient reuse
4. **Pagination**: Use `limit` and `offset` for large result sets
5. **Bulk Operations**: Use batch operations when possible

## Schema Overview

The database includes these main tables:
- **instances**: Core agent instances and their metadata
- **mcp_events**: Tool usage and operation tracking
- **relationships**: Parent-child instance relationships
- **github_issues**: Synchronized GitHub issue data
- **user_config**: Application configuration storage

All tables include proper indexing, constraints, and foreign key relationships for data integrity.