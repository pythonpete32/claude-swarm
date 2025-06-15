# Core Module: Database

← [Back to Index](../README.md) | [Previous: Files Module](./core-files.md) | [Next: Architecture →](../03-workflows.md)

## Purpose
Provides Turso/libSQL database operations for Claude Codex state management, including instance tracking, MCP event logging, and agent coordination. Supports both local development and production embedded replica configurations.

## Dependencies
- `drizzle-orm` - Modern TypeScript ORM with type safety
- `@libsql/client` - libSQL client for enhanced SQLite functionality
- `drizzle-kit` - Schema management and migration toolkit (dev dependency)
- `shared/types.ts` - Database interfaces and record types
- `shared/errors.ts` - DatabaseError class and error codes
- `shared/config.ts` - Database configuration management

## Function Signatures

### Primary Operations

#### initializeDatabase
```typescript
async function initializeDatabase(config?: DatabaseConfig): Promise<DatabaseInterface>
```

**Parameters:**
```typescript
interface DatabaseConfig {
  // Local-first configuration
  localFile?: string;              // Path to local .db file (default: 'claude-codex.db')
  
  // Optional: Future cloud features (disabled by default)
  enableCloudSync?: boolean;       // Enable embedded replica features (default: false)
  syncUrl?: string;                // Turso cloud database URL (if enableCloudSync: true)
  authToken?: string;              // Turso authentication token (if enableCloudSync: true)
  syncInterval?: number;           // Sync interval in seconds (default: 300)
  
  // Connection settings
  readYourWrites?: boolean;        // Ensure read-after-write consistency (default: true)
  enableWAL?: boolean;             // Enable WAL mode for better concurrency (default: true)
  busyTimeout?: number;            // SQLite busy timeout in ms (default: 5000)
}
```

**Returns:**
```typescript
interface DatabaseInterface {
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  sync(): Promise<void>;           // Manual sync for embedded replicas
  
  // Instance management
  createInstance(instance: InstanceRecord): Promise<string>;
  updateInstance(id: string, updates: Partial<InstanceRecord>): Promise<void>;
  updateInstanceStatus(id: string, status: InstanceStatus): Promise<void>;
  getInstance(id: string): Promise<InstanceRecord | null>;
  listInstances(filter?: InstanceFilter): Promise<InstanceRecord[]>;
  deleteInstance(id: string): Promise<void>;
  
  // MCP event tracking
  logMCPEvent(event: MCPEventRecord): Promise<void>;
  getMCPEvents(instanceId: string, limit?: number): Promise<MCPEventRecord[]>;
  getRecentMCPEvents(sinceDate: Date): Promise<MCPEventRecord[]>;
  
  // Instance relationships
  createRelationship(relationship: RelationshipRecord): Promise<void>;
  getRelationships(instanceId: string): Promise<RelationshipRecord[]>;
  updateRelationship(id: number, updates: Partial<RelationshipRecord>): Promise<void>;
  
  // GitHub integration
  upsertGitHubIssue(issue: GitHubIssueRecord): Promise<void>;
  getGitHubIssue(number: number): Promise<GitHubIssueRecord | null>;
  syncGitHubIssues(issues: GitHubIssueRecord[]): Promise<void>;
  
  // Configuration and maintenance
  getConfig(key: string): Promise<string | null>;
  setConfig(key: string, value: string, encrypted?: boolean): Promise<void>;
  deleteConfig(key: string): Promise<void>;
  vacuum(): Promise<void>;
  backup(path: string): Promise<void>;
}
```

**Behavior:**
- **Local-First**: Always uses local SQLite file via libSQL for enhanced performance
- **Schema Management**: Initializes database schema using Drizzle migrations
- **Type Safety**: Returns fully typed Drizzle database instance
- **Connection Optimization**: Configures WAL mode and connection pooling
- **Future-Ready**: Cloud sync capabilities available but disabled by default

**Error Conditions:**
- `DatabaseError('DATABASE_INITIALIZATION_FAILED')` - Failed to initialize database
- `DatabaseError('DATABASE_SCHEMA_MIGRATION_FAILED')` - Schema setup failed
- `DatabaseError('DATABASE_TURSO_CONNECTION_FAILED')` - Cannot connect to Turso
- `DatabaseError('DATABASE_FILE_PERMISSION_DENIED')` - Cannot access database file

*Error codes follow shared ERROR_CODES pattern: MODULE_ERROR_TYPE*

---

#### createInstance
```typescript
async function createInstance(instance: InstanceRecord, db?: DatabaseInterface): Promise<string>
```

**Parameters:**
```typescript
interface InstanceRecord {
  id: string;                      // Instance identifier (e.g., 'work-123-a1')
  type: 'coding' | 'review' | 'planning';
  status: InstanceStatus;
  
  // Git/Worktree information
  worktree_path: string;
  branch_name: string;
  base_branch?: string;
  
  // Session information
  tmux_session: string;
  claude_pid?: number;
  
  // GitHub integration
  issue_number?: number;
  pr_number?: number;
  pr_url?: string;
  
  // Agent relationships
  parent_instance_id?: string;
  
  // Timestamps
  created_at: Date;
  terminated_at?: Date;
  last_activity: Date;
  
  // Configuration
  system_prompt?: string;
  agent_number: number;
}

type InstanceStatus = 
  | 'started' 
  | 'waiting_review' 
  | 'pr_created' 
  | 'pr_merged' 
  | 'pr_closed' 
  | 'terminated';
```

**Returns:** Instance ID string

**Behavior:**
- Validates instance data using shared validators
- Inserts record into instances table with UPSERT logic
- Sets created_at and last_activity timestamps automatically
- Generates unique agent_number if not provided
- Handles database constraints and foreign keys

**Error Conditions:**
- `DatabaseError('DATABASE_INSTANCE_EXISTS')` - Instance ID already exists
- `DatabaseError('DATABASE_VALIDATION_FAILED')` - Invalid instance data
- `DatabaseError('DATABASE_INSERT_FAILED')` - SQL insertion failed

---

#### updateInstanceStatus
```typescript
async function updateInstanceStatus(instanceId: string, status: InstanceStatus, db?: DatabaseInterface): Promise<void>
```

**Parameters:**
- `instanceId: string` - Instance to update
- `status: InstanceStatus` - New status value
- `db?: DatabaseInterface` - Optional database instance (uses default if not provided)

**Behavior:**
- Updates instance status and last_activity timestamp atomically
- Logs status change as MCP event automatically
- Validates status transition is valid
- Updates terminated_at timestamp for terminal statuses

**Error Conditions:**
- `DatabaseError('DATABASE_INSTANCE_NOT_FOUND')` - Instance doesn't exist
- `DatabaseError('DATABASE_INVALID_STATUS_TRANSITION')` - Invalid status change
- `DatabaseError('DATABASE_UPDATE_FAILED')` - SQL update failed

---

#### logMCPEvent
```typescript
async function logMCPEvent(event: MCPEventRecord, db?: DatabaseInterface): Promise<void>
```

**Parameters:**
```typescript
interface MCPEventRecord {
  id?: number;                     // Auto-generated primary key
  instance_id: string;
  tool_name: string;
  success: boolean;
  error_message?: string;
  metadata?: string;               // JSON string for tool-specific data
  git_commit_hash?: string;
  status_change?: string;          // If this event caused status change
  is_status_updating: boolean;     // Whether this tool updates instance status
  timestamp: Date;
}
```

**Behavior:**
- Inserts MCP event record with validation
- Links event to existing instance (foreign key constraint)
- Stores metadata as JSON for tool-specific information
- Automatically sets timestamp if not provided
- Used by MCP server to track all tool executions

**Error Conditions:**
- `DatabaseError('DATABASE_INSTANCE_NOT_FOUND')` - Referenced instance doesn't exist
- `DatabaseError('DATABASE_LOG_FAILED')` - Failed to insert event record

---

### Relationship Management

#### createRelationship
```typescript
async function createRelationship(relationship: RelationshipRecord, db?: DatabaseInterface): Promise<void>
```

**Parameters:**
```typescript
interface RelationshipRecord {
  id?: number;                     // Auto-generated
  parent_instance: string;
  child_instance: string;
  relationship_type: 'spawned_review' | 'created_fork' | 'planning_to_issue';
  review_iteration: number;        // For tracking review cycles
  created_at: Date;
  metadata?: string;               // JSON for relationship-specific data
}
```

**Behavior:**
- Creates parent-child relationship between instances
- Enforces referential integrity (both instances must exist)
- Supports multiple relationship types for different workflows
- Used for tracking review cycles and preventing infinite loops

**Error Conditions:**
- `DatabaseError('DATABASE_PARENT_INSTANCE_NOT_FOUND')` - Parent instance doesn't exist
- `DatabaseError('DATABASE_CHILD_INSTANCE_NOT_FOUND')` - Child instance doesn't exist
- `DatabaseError('DATABASE_RELATIONSHIP_EXISTS')` - Relationship already exists

---

#### getInstanceRelationships
```typescript
async function getInstanceRelationships(instanceId: string, db?: DatabaseInterface): Promise<RelationshipRecord[]>
```

**Returns:** Array of relationships where instanceId is either parent or child

**Behavior:**
- Queries both parent and child relationships for the instance
- Orders results by creation date (newest first)
- Used by workflows to check review limits and coordination

---

### Query Operations

#### listInstances
```typescript
async function listInstances(filter?: InstanceFilter, db?: DatabaseInterface): Promise<InstanceRecord[]>
```

**Parameters:**
```typescript
interface InstanceFilter {
  types?: ('coding' | 'review' | 'planning')[];
  statuses?: InstanceStatus[];
  issueNumber?: number;
  parentInstance?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'last_activity' | 'terminated_at';
  orderDirection?: 'ASC' | 'DESC';
}
```

**Returns:** Array of matching instances, ordered by specified criteria

**Behavior:**
- Supports complex filtering with multiple criteria
- Handles pagination with limit/offset
- Defaults to ordering by last_activity DESC
- Used by UI server for dashboard and API responses

---

#### getMCPEvents
```typescript
async function getMCPEvents(instanceId: string, limit?: number, db?: DatabaseInterface): Promise<MCPEventRecord[]>
```

**Returns:** Recent MCP events for the instance, ordered by timestamp DESC

**Behavior:**
- Retrieves event log for debugging and monitoring
- Limits results to prevent memory issues (default: 100)
- Used by UI for displaying agent activity timeline

---

### GitHub Integration

#### upsertGitHubIssue
```typescript
async function upsertGitHubIssue(issue: GitHubIssueRecord, db?: DatabaseInterface): Promise<void>
```

**Parameters:**
```typescript
interface GitHubIssueRecord {
  number: number;
  title: string;
  body?: string;
  state: string;
  assignee?: string;
  labels?: string;                 // JSON array
  created_at: Date;
  updated_at: Date;
  synced_at: Date;
  repo_owner: string;
  repo_name: string;
}
```

**Behavior:**
- Inserts or updates GitHub issue data
- Used by GitHub integration to cache issue information
- Enables offline querying of issue data
- Tracks sync timestamp for cache invalidation

---

## Usage Examples

### Local-First Development Setup
```typescript
// Local development - enhanced SQLite via libSQL
const db = await initializeDatabase({
  localFile: './claude-codex-dev.db',
  enableWAL: true,
  busyTimeout: 5000
});

// Type-safe instance creation with Drizzle
const instanceId = await db.insert(instancesTable).values({
  id: 'work-123-a1',
  type: 'coding',
  status: 'started',
  worktree_path: '/path/to/worktree',
  branch_name: 'work-123',
  tmux_session: 'work-123-a1',
  created_at: new Date(),
  last_activity: new Date(),
  agent_number: 1
}).returning({ id: instancesTable.id });
```

### Optional Cloud Sync Setup (Future)
```typescript
// Future: Enable cloud sync if needed
const db = await initializeDatabase({
  localFile: './claude-codex.db',
  enableCloudSync: true,
  syncUrl: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
  syncInterval: 300, // 5 minutes
  readYourWrites: true
});

// Manual sync when cloud features enabled
if (db.syncEnabled) {
  await db.sync();
}
```

### Type-Safe Drizzle Queries
```typescript
// Type-safe MCP event logging
await db.insert(mcpEventsTable).values({
  instance_id: 'work-123-a1',
  tool_name: 'request_review',
  success: true,
  is_status_updating: true,
  metadata: JSON.stringify({ reviewConfig }),
  timestamp: new Date()
});

// Type-safe status updates with relations
await db.update(instancesTable)
  .set({ 
    status: 'waiting_review',
    last_activity: new Date()
  })
  .where(eq(instancesTable.id, 'work-123-a1'));
```

### Review Workflow Coordination with Joins
```typescript
// Type-safe review cycle checking with joins
const reviewCount = await db
  .select({ count: count() })
  .from(relationshipsTable)
  .where(
    and(
      eq(relationshipsTable.parent_instance, 'work-123-a1'),
      eq(relationshipsTable.relationship_type, 'spawned_review')
    )
  );

if (reviewCount[0].count >= 3) {
  throw new Error('Maximum review cycles exceeded');
}

// Type-safe relationship creation
await db.insert(relationshipsTable).values({
  parent_instance: 'work-123-a1',
  child_instance: 'review-123-a1',
  relationship_type: 'spawned_review',
  review_iteration: reviewCount[0].count + 1,
  created_at: new Date()
});
```

### Complex Dashboard Queries
```typescript
// Type-safe complex queries with joins and filters
const activeInstancesWithEvents = await db
  .select({
    id: instancesTable.id,
    type: instancesTable.type,
    status: instancesTable.status,
    last_activity: instancesTable.last_activity,
    recent_event_count: count(mcpEventsTable.id)
  })
  .from(instancesTable)
  .leftJoin(mcpEventsTable, eq(instancesTable.id, mcpEventsTable.instance_id))
  .where(
    inArray(instancesTable.status, ['started', 'running', 'waiting_review'])
  )
  .groupBy(instancesTable.id)
  .orderBy(desc(instancesTable.last_activity))
  .limit(50);

// Type-safe recent events with instance details
const recentEventsWithInstances = await db
  .select({
    event: mcpEventsTable,
    instance: {
      id: instancesTable.id,
      type: instancesTable.type,
      branch_name: instancesTable.branch_name
    }
  })
  .from(mcpEventsTable)
  .innerJoin(instancesTable, eq(mcpEventsTable.instance_id, instancesTable.id))
  .where(eq(mcpEventsTable.instance_id, 'work-123-a1'))
  .orderBy(desc(mcpEventsTable.timestamp))
  .limit(20);
```

---

## Configuration Integration

### Database Configuration (extends shared/config.ts)
```typescript
interface DatabaseConfig {
  // Local-first configuration
  local: {
    file: string;                  // './claude-codex.db'
    enableWAL: boolean;            // true - Better concurrency
    busyTimeout: number;           // 5000ms - Handle contention
    autoMigrate: boolean;          // true - Apply migrations automatically
    logQueries: boolean;           // true in dev, false in prod
  };
  
  // Optional cloud features (disabled by default)
  cloud: {
    enabled: boolean;              // false - Local-first approach
    syncUrl?: string;              // From TURSO_DATABASE_URL (if enabled)
    authToken?: string;            // From TURSO_AUTH_TOKEN (if enabled)
    syncInterval: number;          // 300 seconds
    readYourWrites: boolean;       // true
  };
  
  // Connection settings
  connection: {
    maxRetries: number;            // 3
    retryDelay: number;            // 1000ms
    queryTimeout: number;          // 30000ms
  };
  
  // Maintenance
  maintenance: {
    vacuumInterval: number;        // 86400 seconds (daily)
    backupRetention: number;       // 7 days
    logRetention: number;          // 30 days
    autoBackup: boolean;           // true
  };
  
  // Drizzle-specific settings
  drizzle: {
    logger: boolean;               // true in dev
    casing: 'snake_case' | 'camelCase'; // 'snake_case' for consistency
  };
}
```

**Default Values** (from DEFAULT_CONFIG):
- `local.file: './claude-codex.db'`
- `local.enableWAL: true`
- `local.autoMigrate: true`
- `cloud.enabled: false` (Local-first!)
- `connection.maxRetries: 3`
- `maintenance.autoBackup: true`

---

## Schema Management

### Drizzle Schema Definition
```typescript
// src/db/schema.ts - Type-safe schema definitions
import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const instancesTable = sqliteTable('instances', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['coding', 'review', 'planning'] }).notNull(),
  status: text('status', { 
    enum: ['started', 'waiting_review', 'pr_created', 'pr_merged', 'pr_closed', 'terminated'] 
  }).notNull(),
  
  // Git/Worktree information
  worktree_path: text('worktree_path').notNull(),
  branch_name: text('branch_name').notNull(),
  base_branch: text('base_branch'),
  
  // Session information
  tmux_session: text('tmux_session').notNull(),
  claude_pid: integer('claude_pid'),
  
  // GitHub integration
  issue_number: integer('issue_number'),
  pr_number: integer('pr_number'),
  pr_url: text('pr_url'),
  
  // Agent relationships
  parent_instance_id: text('parent_instance_id'),
  
  // Timestamps
  created_at: integer('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`).notNull(),
  terminated_at: integer('terminated_at', { mode: 'timestamp' }),
  last_activity: integer('last_activity', { mode: 'timestamp' })
    .default(sql`(unixepoch())`).notNull(),
  
  // Configuration
  system_prompt: text('system_prompt'),
  agent_number: integer('agent_number').default(1).notNull(),
});

export const mcpEventsTable = sqliteTable('mcp_events', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  instance_id: text('instance_id').notNull(),
  tool_name: text('tool_name').notNull(),
  success: integer('success', { mode: 'boolean' }).notNull(),
  error_message: text('error_message'),
  metadata: text('metadata', { mode: 'json' }), // JSON type safety
  git_commit_hash: text('git_commit_hash'),
  status_change: text('status_change'),
  is_status_updating: integer('is_status_updating', { mode: 'boolean' }).default(false).notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' })
    .default(sql`(unixepoch())`).notNull(),
}, (table) => ({
  // Indexes defined inline with table
  instanceIdx: index('idx_mcp_events_instance_id').on(table.instance_id),
  timestampIdx: index('idx_mcp_events_timestamp').on(table.timestamp),
}));

export const relationshipsTable = sqliteTable('instance_relationships', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  parent_instance: text('parent_instance').notNull(),
  child_instance: text('child_instance').notNull(),
  relationship_type: text('relationship_type', { 
    enum: ['spawned_review', 'created_fork', 'planning_to_issue'] 
  }).notNull(),
  review_iteration: integer('review_iteration').default(1).notNull(),
  created_at: integer('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`).notNull(),
  metadata: text('metadata', { mode: 'json' }),
}, (table) => ({
  // Composite unique constraint
  uniqueRelationship: unique().on(table.parent_instance, table.child_instance, table.relationship_type),
  parentIdx: index('idx_relationships_parent').on(table.parent_instance),
  childIdx: index('idx_relationships_child').on(table.child_instance),
}));

export const githubIssuesTable = sqliteTable('github_issues', {
  number: integer('number').primaryKey(),
  title: text('title').notNull(),
  body: text('body'),
  state: text('state').notNull(),
  assignee: text('assignee'),
  labels: text('labels', { mode: 'json' }), // JSON array
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
  synced_at: integer('synced_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`).notNull(),
  repo_owner: text('repo_owner').notNull(),
  repo_name: text('repo_name').notNull(),
});

export const userConfigTable = sqliteTable('user_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  encrypted: integer('encrypted', { mode: 'boolean' }).default(false).notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`).notNull(),
});

// Type-safe relations
export const instancesRelations = relations(instancesTable, ({ many, one }) => ({
  mcpEvents: many(mcpEventsTable),
  parentRelationships: many(relationshipsTable, { 
    relationName: "parent" 
  }),
  childRelationships: many(relationshipsTable, { 
    relationName: "child" 
  }),
  parentInstance: one(instancesTable, {
    fields: [instancesTable.parent_instance_id],
    references: [instancesTable.id],
  }),
}));

export const mcpEventsRelations = relations(mcpEventsTable, ({ one }) => ({
  instance: one(instancesTable, {
    fields: [mcpEventsTable.instance_id],
    references: [instancesTable.id],
  }),
}));

// Type exports for use in application
export type Instance = typeof instancesTable.$inferSelect;
export type NewInstance = typeof instancesTable.$inferInsert;
export type MCPEvent = typeof mcpEventsTable.$inferSelect;
export type NewMCPEvent = typeof mcpEventsTable.$inferInsert;
export type Relationship = typeof relationshipsTable.$inferSelect;
export type NewRelationship = typeof relationshipsTable.$inferInsert;
```

### Drizzle Migration System
```typescript
// drizzle.config.ts - Migration configuration
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'file:./claude-codex.db',
  },
  verbose: true,
  strict: true,
});

// Migration commands
// Generate migration: npx drizzle-kit generate
// Apply migrations: npx drizzle-kit migrate
// Push schema directly: npx drizzle-kit push (for dev)
// View database: npx drizzle-kit studio

// src/db/migrate.ts - Runtime migration application
import { migrate } from 'drizzle-orm/libsql/migrator';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

export async function runMigrations(databaseUrl: string) {
  const client = createClient({ url: databaseUrl });
  const db = drizzle(client);
  
  await migrate(db, { migrationsFolder: './migrations' });
  console.log('✅ Database migrations completed');
  
  return db;
}
```

---

## Testing Considerations

### Unit Tests
- **Connection management**: Test local file and Turso connections
- **CRUD operations**: Test all database operations with mocked client
- **Error handling**: Test constraint violations and connection failures
- **Migration system**: Test schema upgrades and rollbacks

### Integration Tests
- **Real Turso operations**: Test against actual Turso dev server (`turso dev`)
- **Embedded replica sync**: Test local-remote synchronization
- **Concurrent access**: Test multiple database connections
- **Data integrity**: Test foreign key constraints and transactions

### Mocking Strategy
```typescript
// Mock Turso client for testing
class MockLibSQLClient implements DatabaseInterface {
  private instances = new Map<string, InstanceRecord>();
  private events: MCPEventRecord[] = [];
  private callLog: Array<{ method: string; args: unknown[] }> = [];
  
  // Test setup methods
  setInstances(instances: InstanceRecord[]): void {
    instances.forEach(i => this.instances.set(i.id, i));
  }
  
  getCallLog(): Array<{ method: string; args: unknown[] }> {
    return this.callLog;
  }
  
  // Implementation methods with call logging...
}
```

---

## Environment Setup

### Development Environment
```bash
# Install required packages
npm install drizzle-orm @libsql/client
npm install -D drizzle-kit

# Create initial schema file
mkdir -p src/db
touch src/db/schema.ts

# Initialize database with migrations
npx drizzle-kit generate
npx drizzle-kit migrate

# Optional: View database with Drizzle Studio
npx drizzle-kit studio
```

### Environment Variables (Local-First)
```bash
# Local database configuration
DATABASE_URL="file:./claude-codex.db"
DATABASE_WAL_MODE="true"
DATABASE_BUSY_TIMEOUT="5000"

# Development settings
NODE_ENV="development"
DATABASE_LOG_QUERIES="true"

# Optional: Future cloud sync (disabled by default)
# ENABLE_CLOUD_SYNC="false"
# TURSO_DATABASE_URL="libsql://your-database.turso.io"
# TURSO_AUTH_TOKEN="your-auth-token"
```

### Simple Local Development Setup
```typescript
// Pure local development - no external dependencies
import { drizzle } from 'drizzle-orm/libsql';

const db = drizzle({
  connection: { 
    url: 'file:./claude-codex.db' 
  }
});

// Start building immediately!
```

---

## Performance Considerations

- **Connection pooling**: Reuse database connections across operations
- **Prepared statements**: Cache frequently used queries  
- **Batch operations**: Group multiple inserts/updates into transactions
- **Index optimization**: Ensure proper indexing for common queries
- **Sync intervals**: Balance data freshness vs performance for embedded replicas

## Security Considerations

- **Encryption**: Support database encryption for sensitive data
- **Authentication**: Secure Turso token management
- **Input validation**: Prevent SQL injection through parameterized queries
- **Access control**: Implement proper database permissions

## Future Extensions

- **Read replicas**: Multiple read-only database connections for scaling
- **Partitioning**: Partition large tables by date or instance type
- **Analytics**: Built-in analytics queries for usage tracking
- **Backup automation**: Automated backup scheduling and rotation
- **Multi-tenant**: Support for multiple organizations/workspaces