# Core Database Integration Specification

This document defines the database module integration into the Claude Codex core package, providing SQLite-based state management that follows core's established architectural patterns.

## Overview

The database module is added to the core package as a foundational building block, providing state persistence for instance management, MCP event tracking, and agent coordination. It follows core's dependency injection patterns and error handling standards.

## Integration Location

**Package**: `@claude-codex/core`  
**Module**: `src/core/database.ts`  
**Export Path**: `@claude-codex/core/database`  
**Testing**: `tests/unit/database.test.ts`

## Architecture Principles

### Following Core Patterns

1. **Dependency Injection**: Database operations accept optional interface parameters
2. **Error Handling**: Uses core's `ErrorFactory` and standardized error codes
3. **Validation**: Uses `CommonValidators` for input validation
4. **Configuration**: Integrates with core's `ConfigManager`
5. **Testing**: Mock interfaces for comprehensive unit testing

### Core Package Integration

```typescript
// Added to core package exports
// packages/core/src/index.ts
export * from "./core/database.js";

// packages/core/src/core/index.ts  
export * from "./database.js";
```

## Database Interface

### Core Database Interface
```typescript
export interface DatabaseInterface {
  // Connection management
  connect(path?: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
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
  
  // Configuration
  getConfig(key: string): Promise<string | null>;
  setConfig(key: string, value: string, encrypted?: boolean): Promise<void>;
  deleteConfig(key: string): Promise<void>;
  
  // Maintenance
  vacuum(): Promise<void>;
  backup(path: string): Promise<void>;
  migrate(toVersion: number): Promise<void>;
}
```

### Type Definitions
```typescript
export interface InstanceRecord {
  id: string;
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

export type InstanceStatus = 
  | 'started' 
  | 'waiting_review' 
  | 'pr_created' 
  | 'pr_merged' 
  | 'pr_closed' 
  | 'terminated';

export interface MCPEventRecord {
  id?: number;
  instance_id: string;
  tool_name: string;
  success: boolean;
  error_message?: string;
  metadata?: string;  // JSON
  git_commit_hash?: string;
  status_change?: string;
  is_status_updating: boolean;
  timestamp: Date;
}

export interface RelationshipRecord {
  id?: number;
  parent_instance: string;
  child_instance: string;
  relationship_type: 'spawned_review' | 'created_fork' | 'planning_to_issue';
  review_iteration: number;
  created_at: Date;
  metadata?: string;  // JSON
}

export interface GitHubIssueRecord {
  number: number;
  title: string;
  body?: string;
  state: string;
  assignee?: string;
  labels?: string;  // JSON array
  created_at: Date;
  updated_at: Date;
  synced_at: Date;
  repo_owner: string;
  repo_name: string;
}

export interface InstanceFilter {
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

## Function-Based API

### Following Core's Function-Based Pattern
```typescript
// Core database functions (following core module patterns)

export async function createInstance(
  instance: InstanceRecord,
  db: DatabaseInterface = defaultDatabase
): Promise<string> {
  try {
    // Validate input using core validators
    CommonValidators.instanceId().validateOrThrow(instance.id, "Instance ID validation");
    CommonValidators.worktreePath().validateOrThrow(instance.worktree_path, "Worktree path validation");
    
    const instanceId = await db.createInstance(instance);
    
    return instanceId;
  } catch (error) {
    throw ErrorFactory.database(ERROR_CODES.DATABASE_CREATE_FAILED, 
      `Failed to create instance ${instance.id}`, { instance, error: error.message });
  }
}

export async function updateInstanceStatus(
  instanceId: string,
  status: InstanceStatus,
  db: DatabaseInterface = defaultDatabase
): Promise<void> {
  try {
    CommonValidators.instanceId().validateOrThrow(instanceId, "Instance ID validation");
    
    await db.updateInstanceStatus(instanceId, status);
  } catch (error) {
    throw ErrorFactory.database(ERROR_CODES.DATABASE_UPDATE_FAILED,
      `Failed to update instance status for ${instanceId}`, { instanceId, status, error: error.message });
  }
}

export async function logMCPEvent(
  event: MCPEventRecord,
  db: DatabaseInterface = defaultDatabase
): Promise<void> {
  try {
    CommonValidators.instanceId().validateOrThrow(event.instance_id, "Instance ID validation");
    
    await db.logMCPEvent(event);
  } catch (error) {
    throw ErrorFactory.database(ERROR_CODES.DATABASE_LOG_FAILED,
      `Failed to log MCP event for ${event.instance_id}`, { event, error: error.message });
  }
}

export async function getInstance(
  instanceId: string,
  db: DatabaseInterface = defaultDatabase
): Promise<InstanceRecord | null> {
  try {
    CommonValidators.instanceId().validateOrThrow(instanceId, "Instance ID validation");
    
    return await db.getInstance(instanceId);
  } catch (error) {
    throw ErrorFactory.database(ERROR_CODES.DATABASE_QUERY_FAILED,
      `Failed to get instance ${instanceId}`, { instanceId, error: error.message });
  }
}

export async function listInstances(
  filter: InstanceFilter = {},
  db: DatabaseInterface = defaultDatabase
): Promise<InstanceRecord[]> {
  try {
    return await db.listInstances(filter);
  } catch (error) {
    throw ErrorFactory.database(ERROR_CODES.DATABASE_QUERY_FAILED,
      "Failed to list instances", { filter, error: error.message });
  }
}

export async function createRelationship(
  relationship: RelationshipRecord,
  db: DatabaseInterface = defaultDatabase
): Promise<void> {
  try {
    CommonValidators.instanceId().validateOrThrow(relationship.parent_instance, "Parent instance ID validation");
    CommonValidators.instanceId().validateOrThrow(relationship.child_instance, "Child instance ID validation");
    
    await db.createRelationship(relationship);
  } catch (error) {
    throw ErrorFactory.database(ERROR_CODES.DATABASE_RELATIONSHIP_FAILED,
      `Failed to create relationship ${relationship.parent_instance} → ${relationship.child_instance}`, 
      { relationship, error: error.message });
  }
}

export async function getInstanceRelationships(
  instanceId: string,
  db: DatabaseInterface = defaultDatabase
): Promise<RelationshipRecord[]> {
  try {
    CommonValidators.instanceId().validateOrThrow(instanceId, "Instance ID validation");
    
    return await db.getRelationships(instanceId);
  } catch (error) {
    throw ErrorFactory.database(ERROR_CODES.DATABASE_QUERY_FAILED,
      `Failed to get relationships for ${instanceId}`, { instanceId, error: error.message });
  }
}
```

## SQLite Implementation

### Default SQLite Implementation
```typescript
export class SQLiteDatabase implements DatabaseInterface {
  private db: Database | null = null;
  private config: DatabaseConfig;
  
  constructor(config: DatabaseConfig = getDefaultDatabaseConfig()) {
    this.config = config;
  }
  
  async connect(path?: string): Promise<void> {
    try {
      const dbPath = path || this.config.path;
      this.db = new Database(dbPath);
      
      // Enable foreign keys and WAL mode
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('journal_mode = WAL');
      
      // Initialize schema
      await this.initializeSchema();
      
    } catch (error) {
      throw ErrorFactory.database(ERROR_CODES.DATABASE_CONNECTION_FAILED,
        `Failed to connect to database: ${error.message}`, { path, error: error.message });
    }
  }
  
  async createInstance(instance: InstanceRecord): Promise<string> {
    if (!this.db) throw new Error("Database not connected");
    
    try {
      const stmt = this.db.prepare(`
        INSERT INTO instances (
          id, type, status, worktree_path, branch_name, base_branch,
          tmux_session, claude_pid, issue_number, pr_number, pr_url,
          parent_instance_id, created_at, last_activity, system_prompt, agent_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        instance.id,
        instance.type,
        instance.status,
        instance.worktree_path,
        instance.branch_name,
        instance.base_branch || null,
        instance.tmux_session,
        instance.claude_pid || null,
        instance.issue_number || null,
        instance.pr_number || null,
        instance.pr_url || null,
        instance.parent_instance_id || null,
        instance.created_at.toISOString(),
        instance.last_activity.toISOString(),
        instance.system_prompt || null,
        instance.agent_number
      );
      
      return instance.id;
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw ErrorFactory.database(ERROR_CODES.DATABASE_INSTANCE_EXISTS,
          `Instance ${instance.id} already exists`, { instanceId: instance.id });
      }
      throw error;
    }
  }
  
  async updateInstanceStatus(id: string, status: InstanceStatus): Promise<void> {
    if (!this.db) throw new Error("Database not connected");
    
    const stmt = this.db.prepare(`
      UPDATE instances 
      SET status = ?, last_activity = ? 
      WHERE id = ?
    `);
    
    const result = stmt.run(status, new Date().toISOString(), id);
    
    if (result.changes === 0) {
      throw ErrorFactory.database(ERROR_CODES.DATABASE_INSTANCE_NOT_FOUND,
        `Instance ${id} not found for status update`, { instanceId: id, status });
    }
  }
  
  async logMCPEvent(event: MCPEventRecord): Promise<void> {
    if (!this.db) throw new Error("Database not connected");
    
    const stmt = this.db.prepare(`
      INSERT INTO mcp_events (
        instance_id, tool_name, success, error_message, metadata,
        git_commit_hash, status_change, is_status_updating, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      event.instance_id,
      event.tool_name,
      event.success,
      event.error_message || null,
      event.metadata || null,
      event.git_commit_hash || null,
      event.status_change || null,
      event.is_status_updating,
      event.timestamp.toISOString()
    );
  }
  
  // ... additional implementation methods
}
```

## Error Handling

### Database Error Codes
```typescript
export const DATABASE_ERROR_CODES = {
  DATABASE_CONNECTION_FAILED: "DATABASE_CONNECTION_FAILED",
  DATABASE_CREATE_FAILED: "DATABASE_CREATE_FAILED",
  DATABASE_UPDATE_FAILED: "DATABASE_UPDATE_FAILED",
  DATABASE_QUERY_FAILED: "DATABASE_QUERY_FAILED",
  DATABASE_DELETE_FAILED: "DATABASE_DELETE_FAILED",
  DATABASE_INSTANCE_EXISTS: "DATABASE_INSTANCE_EXISTS",
  DATABASE_INSTANCE_NOT_FOUND: "DATABASE_INSTANCE_NOT_FOUND",
  DATABASE_RELATIONSHIP_FAILED: "DATABASE_RELATIONSHIP_FAILED",
  DATABASE_MIGRATION_FAILED: "DATABASE_MIGRATION_FAILED",
  DATABASE_LOG_FAILED: "DATABASE_LOG_FAILED"
} as const;

// Add to core ERROR_CODES
export const ERROR_CODES = {
  ...existingErrorCodes,
  ...DATABASE_ERROR_CODES
} as const;
```

### Database Error Class
```typescript
export class DatabaseError extends SwarmError {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(code, "database", message, details);
  }
  
  protected getSuggestion(): string | null {
    switch (this.code) {
      case ERROR_CODES.DATABASE_CONNECTION_FAILED:
        return "Check database file path and permissions";
      case ERROR_CODES.DATABASE_INSTANCE_EXISTS:
        return "Use a different instance ID or update existing instance";
      case ERROR_CODES.DATABASE_INSTANCE_NOT_FOUND:
        return "Verify instance ID and ensure instance was created";
      default:
        return null;
    }
  }
}

// Add to ErrorFactory
export const ErrorFactory = {
  ...existingFactories,
  database: (code: string, message: string, details?: Record<string, unknown>) => 
    new DatabaseError(code, message, details)
};
```

## Configuration Integration

### Database Configuration
```typescript
export interface DatabaseConfig {
  path: string;
  maxConnections: number;
  queryTimeout: number;
  pragmas: Record<string, string>;
  migrations: {
    enabled: boolean;
    autoMigrate: boolean;
  };
}

// Add to core SwarmConfig
declare module './config' {
  interface SwarmConfig {
    database: DatabaseConfig;
  }
}

export function getDefaultDatabaseConfig(): DatabaseConfig {
  return {
    path: process.env.DATABASE_PATH || './claude-codex.db',
    maxConnections: 10,
    queryTimeout: 30000,
    pragmas: {
      'foreign_keys': 'ON',
      'journal_mode': 'WAL',
      'synchronous': 'NORMAL'
    },
    migrations: {
      enabled: true,
      autoMigrate: true
    }
  };
}
```

## Testing Strategy

### Mock Database Interface
```typescript
export class MockDatabase implements DatabaseInterface {
  private instances = new Map<string, InstanceRecord>();
  private mcpEvents: MCPEventRecord[] = [];
  private relationships: RelationshipRecord[] = [];
  private callLog: Array<{ method: string; args: unknown[] }> = [];
  
  // Test setup methods
  setInstance(id: string, instance: InstanceRecord): void {
    this.instances.set(id, instance);
  }
  
  setError(method: string, error: Error): void {
    // Error injection for testing
  }
  
  getCallLog(): Array<{ method: string; args: unknown[] }> {
    return this.callLog;
  }
  
  // Implementation methods...
  async createInstance(instance: InstanceRecord): Promise<string> {
    this.callLog.push({ method: 'createInstance', args: [instance] });
    this.instances.set(instance.id, instance);
    return instance.id;
  }
  
  // ... other mock implementations
}
```

### Test Patterns
```typescript
describe('Database Module', () => {
  let mockDb: MockDatabase;
  
  beforeEach(() => {
    mockDb = new MockDatabase();
  });
  
  it('should create instance with proper validation', async () => {
    const instance: InstanceRecord = {
      id: 'work-123-a1',
      type: 'coding',
      status: 'started',
      worktree_path: '/path/to/worktree',
      branch_name: 'work-123',
      tmux_session: 'work-123-a1',
      created_at: new Date(),
      last_activity: new Date(),
      agent_number: 1
    };
    
    const result = await createInstance(instance, mockDb);
    
    expect(result).toBe('work-123-a1');
    expect(mockDb.getCallLog()).toHaveLength(1);
  });
  
  it('should handle validation errors properly', async () => {
    const invalidInstance = {
      id: '', // Invalid empty ID
      type: 'coding',
      // ... missing required fields
    } as InstanceRecord;
    
    await expect(createInstance(invalidInstance, mockDb))
      .rejects.toThrow('Instance ID validation');
  });
});
```

## Migration System

### Schema Migrations
```typescript
export interface Migration {
  version: number;
  description: string;
  up: (db: Database) => void;
  down: (db: Database) => void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    description: "Initial schema",
    up: (db) => {
      // Create initial tables
      db.exec(initialSchemaSQL);
    },
    down: (db) => {
      // Drop all tables
      db.exec(dropAllTablesSQL);
    }
  },
  // Additional migrations...
];

export async function runMigrations(db: DatabaseInterface): Promise<void> {
  const currentVersion = await getCurrentSchemaVersion(db);
  const targetVersion = Math.max(...migrations.map(m => m.version));
  
  if (currentVersion < targetVersion) {
    await db.migrate(targetVersion);
  }
}
```

## Usage Examples

### Workflows Package Usage
```typescript
// In workflows package
import { createInstance, updateInstanceStatus, logMCPEvent } from '@claude-codex/core/database';

export class CodingAgentWorkflow {
  async execute(config: CodingConfig): Promise<WorkflowExecution> {
    const instanceId = this.generateInstanceId(config);
    
    // Create instance record
    await createInstance({
      id: instanceId,
      type: 'coding',
      status: 'started',
      worktree_path: worktreePath,
      tmux_session: sessionName,
      branch_name: branch,
      created_at: new Date(),
      last_activity: new Date(),
      agent_number: 1
    });
    
    // Update status after setup
    await updateInstanceStatus(instanceId, 'running');
    
    return { id: instanceId, /* ... */ };
  }
}
```

### MCP Server Usage
```typescript
// In MCP server package
import { logMCPEvent, createRelationship, updateInstanceStatus } from '@claude-codex/core/database';

export async function requestReviewTool(params: RequestReviewParams): Promise<ReviewResult> {
  const { instanceId } = getAgentContext();
  
  // Log MCP event
  await logMCPEvent({
    instance_id: instanceId,
    tool_name: 'request_review',
    success: true,
    is_status_updating: true,
    timestamp: new Date()
  });
  
  // Create relationship
  await createRelationship({
    parent_instance: instanceId,
    child_instance: reviewInstanceId,
    relationship_type: 'spawned_review',
    review_iteration: 1,
    created_at: new Date()
  });
  
  // Update status
  await updateInstanceStatus(instanceId, 'waiting_review');
  
  return { reviewInstanceId, /* ... */ };
}
```

### UI Server Usage
```typescript
// In UI server package
import { listInstances, getInstance } from '@claude-codex/core/database';

export async function getInstancesHandler(req: Request): Promise<Response> {
  const filter: InstanceFilter = {
    statuses: ['started', 'running', 'waiting_review'],
    orderBy: 'last_activity',
    orderDirection: 'DESC',
    limit: 50
  };
  
  const instances = await listInstances(filter);
  
  return new Response(JSON.stringify(instances), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

---

*This Core Database Integration Specification provides SQLite-based state management that seamlessly integrates with the existing core package patterns while enabling multi-package coordination for workflows, MCP server, and UI server.*