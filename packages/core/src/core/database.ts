import { createClient } from "@libsql/client";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { runMigrationsWithDatabase } from "../db/migrate.js";
import {
  type GitHubIssue,
  type Instance,
  type InstanceFilter,
  type InstanceStatus,
  type InstanceType,
  type MCPEvent,
  type NewGitHubIssue,
  type NewInstance,
  type NewMCPEvent,
  type NewRelationship,
  type NewUserConfig,
  type Relationship,
  type RelationshipType,
  type UserConfig,
  githubIssuesTable,
  instancesTable,
  mcpEventsTable,
  relationshipsTable,
  schema,
  userConfigTable,
} from "../db/schema.js";
import { ERROR_CODES, ErrorFactory } from "../shared/errors.js";

// Database configuration interface
export interface DatabaseConfig {
  // Local-first configuration
  local: {
    file: string; // Path to local .db file (default: 'file:claude-codex.db')
    enableWAL: boolean; // Enable WAL mode for better concurrency (default: true)
    busyTimeout: number; // SQLite busy timeout in ms (default: 5000)
    autoMigrate: boolean; // Apply migrations automatically (default: true)
    logQueries: boolean; // Log queries (default: true in dev, false in prod)
  };

  // Optional cloud features (disabled by default)
  cloud: {
    enabled: boolean; // Enable embedded replica features (default: false)
    syncUrl?: string; // Turso cloud database URL (if enabled)
    authToken?: string; // Turso authentication token (if enabled)
    syncInterval: number; // Sync interval in seconds (default: 300)
    readYourWrites: boolean; // Ensure read-after-write consistency (default: true)
  };

  // Connection settings
  connection: {
    maxRetries: number; // 3
    retryDelay: number; // 1000ms
    queryTimeout: number; // 30000ms
  };

  // Maintenance
  maintenance: {
    vacuumInterval: number; // 86400 seconds (daily)
    backupRetention: number; // 7 days
    logRetention: number; // 30 days
    autoBackup: boolean; // true
  };

  // Drizzle-specific settings
  drizzle: {
    logger: boolean; // true in dev
    casing: "snake_case" | "camelCase"; // 'snake_case' for consistency
  };
}

// Database interface
export interface DatabaseInterface {
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  sync(): Promise<void>; // Manual sync for embedded replicas

  // Instance management
  createInstance(instance: NewInstance): Promise<string>;
  updateInstance(id: string, updates: Partial<NewInstance>): Promise<void>;
  updateInstanceStatus(id: string, status: InstanceStatus): Promise<void>;
  getInstance(id: string): Promise<Instance | null>;
  listInstances(filter?: InstanceFilter): Promise<Instance[]>;
  deleteInstance(id: string): Promise<void>;

  // MCP event tracking
  logMCPEvent(event: NewMCPEvent): Promise<void>;
  getMCPEvents(instanceId: string, limit?: number): Promise<MCPEvent[]>;
  getRecentMCPEvents(sinceDate: Date): Promise<MCPEvent[]>;

  // Instance relationships
  createRelationship(relationship: NewRelationship): Promise<void>;
  getRelationships(instanceId: string): Promise<Relationship[]>;
  updateRelationship(id: number, updates: Partial<NewRelationship>): Promise<void>;

  // GitHub integration
  upsertGitHubIssue(issue: NewGitHubIssue): Promise<void>;
  getGitHubIssue(number: number): Promise<GitHubIssue | null>;
  syncGitHubIssues(issues: NewGitHubIssue[]): Promise<void>;

  // Configuration and maintenance
  getConfig(key: string): Promise<string | null>;
  setConfig(key: string, value: string, encrypted?: boolean): Promise<void>;
  deleteConfig(key: string): Promise<void>;
  vacuum(): Promise<void>;
  backup(path: string): Promise<void>;
}

// Default configuration
export function getDefaultDatabaseConfig(): DatabaseConfig {
  return {
    local: {
      file: "file:claude-codex.db",
      enableWAL: true,
      busyTimeout: 5000,
      autoMigrate: true,
      logQueries: process.env.NODE_ENV === "development",
    },
    cloud: {
      enabled: false, // Local-first!
      syncInterval: 300,
      readYourWrites: true,
    },
    connection: {
      maxRetries: 3,
      retryDelay: 1000,
      queryTimeout: 30000,
    },
    maintenance: {
      vacuumInterval: 86400,
      backupRetention: 7,
      logRetention: 30,
      autoBackup: true,
    },
    drizzle: {
      logger: process.env.NODE_ENV === "development",
      casing: "snake_case",
    },
  };
}

// SQLite Database implementation
export class SQLiteDatabase implements DatabaseInterface {
  private db: LibSQLDatabase<typeof schema>;
  private client: ReturnType<typeof createClient>;
  private config: DatabaseConfig;
  private connected = false;

  constructor(
    db: LibSQLDatabase<typeof schema>,
    client: ReturnType<typeof createClient>,
    config: DatabaseConfig,
  ) {
    this.db = db;
    this.client = client;
    this.config = config;
    this.connected = true;
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      // Test connection
      await this.db.run("SELECT 1");
      this.connected = true;
    } catch (error) {
      throw ErrorFactory.database(
        ERROR_CODES.DATABASE_CONNECTION_FAILED,
        "Failed to connect to database",
        { error: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;

    try {
      await this.client.close();
      this.connected = false;
    } catch (error) {
      throw ErrorFactory.database(
        ERROR_CODES.DATABASE_OPERATION_FAILED,
        "Failed to disconnect from database",
        { error: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async sync(): Promise<void> {
    if (!this.config.cloud.enabled) {
      throw ErrorFactory.database(
        ERROR_CODES.DATABASE_OPERATION_FAILED,
        "Cloud sync is not enabled",
        { cloudEnabled: this.config.cloud.enabled },
      );
    }

    try {
      // Manual sync would be implemented here for embedded replicas
      // For now, this is a no-op since we're local-first
      this.db.run("SELECT 1");
    } catch (error) {
      throw ErrorFactory.database(
        ERROR_CODES.DATABASE_OPERATION_FAILED,
        "Failed to sync database",
        { error: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  // Instance management
  async createInstance(instance: NewInstance): Promise<string> {
    try {
      // Set timestamps if not provided
      const now = new Date();
      const instanceWithTimestamps: NewInstance = {
        ...instance,
        created_at: instance.created_at || now,
        last_activity: instance.last_activity || now,
      };

      await this.db.insert(instancesTable).values(instanceWithTimestamps);
      return instance.id;
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        throw ErrorFactory.database(
          ERROR_CODES.DATABASE_INSTANCE_EXISTS,
          `Instance with ID '${instance.id}' already exists`,
          { instanceId: instance.id },
        );
      }

      throw ErrorFactory.database(ERROR_CODES.DATABASE_INSERT_FAILED, "Failed to create instance", {
        instanceId: instance.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async updateInstance(id: string, updates: Partial<NewInstance>): Promise<void> {
    try {
      // Always update last_activity when modifying an instance
      const updatesWithActivity = {
        ...updates,
        last_activity: new Date(),
      };

      const result = await this.db
        .update(instancesTable)
        .set(updatesWithActivity)
        .where(eq(instancesTable.id, id));

      // Check if instance was found and updated
      if (result.rowsAffected === 0) {
        throw ErrorFactory.database(
          ERROR_CODES.DATABASE_INSTANCE_NOT_FOUND,
          `Instance with ID '${id}' not found`,
          { instanceId: id },
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("DATABASE_INSTANCE_NOT_FOUND")) {
        throw error; // Re-throw our custom error
      }

      throw ErrorFactory.database(ERROR_CODES.DATABASE_UPDATE_FAILED, "Failed to update instance", {
        instanceId: id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async updateInstanceStatus(id: string, status: InstanceStatus): Promise<void> {
    try {
      const now = new Date();
      const updates: Partial<NewInstance> = {
        status,
        last_activity: now,
      };

      // Set terminated_at for terminal statuses
      if (status === "terminated" || status === "pr_closed" || status === "pr_merged") {
        updates.terminated_at = now;
      }

      await this.updateInstance(id, updates);

      // Log status change as MCP event
      await this.logMCPEvent({
        instance_id: id,
        tool_name: "update_instance_status",
        success: true,
        is_status_updating: true,
        status_change: status,
        timestamp: now,
      });
    } catch (error) {
      throw ErrorFactory.database(
        ERROR_CODES.DATABASE_UPDATE_FAILED,
        "Failed to update instance status",
        { instanceId: id, status, error: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  async getInstance(id: string): Promise<Instance | null> {
    try {
      const result = await this.db
        .select()
        .from(instancesTable)
        .where(eq(instancesTable.id, id))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      throw ErrorFactory.database(ERROR_CODES.DATABASE_QUERY_FAILED, "Failed to get instance", {
        instanceId: id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async listInstances(filter?: InstanceFilter): Promise<Instance[]> {
    try {
      let query = this.db.select().from(instancesTable);

      // Apply filters
      if (filter) {
        const conditions = [];

        if (filter.types?.length) {
          conditions.push(inArray(instancesTable.type, filter.types));
        }

        if (filter.statuses?.length) {
          conditions.push(inArray(instancesTable.status, filter.statuses));
        }

        if (filter.issueNumber) {
          conditions.push(eq(instancesTable.issue_number, filter.issueNumber));
        }

        if (filter.parentInstance) {
          conditions.push(eq(instancesTable.parent_instance_id, filter.parentInstance));
        }

        if (conditions.length > 0) {
          query = query.where(and(...conditions)) as typeof query;
        }

        // Apply ordering
        const orderBy = filter.orderBy || "last_activity";
        const direction = filter.orderDirection || "DESC";

        if (orderBy === "created_at") {
          query = query.orderBy(
            direction === "ASC" ? asc(instancesTable.created_at) : desc(instancesTable.created_at),
          ) as typeof query;
        } else if (orderBy === "last_activity") {
          query = query.orderBy(
            direction === "ASC"
              ? asc(instancesTable.last_activity)
              : desc(instancesTable.last_activity),
          ) as typeof query;
        } else if (orderBy === "terminated_at") {
          query = query.orderBy(
            direction === "ASC"
              ? asc(instancesTable.terminated_at)
              : desc(instancesTable.terminated_at),
          ) as typeof query;
        }

        // Apply pagination
        if (filter.limit) {
          query = query.limit(filter.limit) as typeof query;
        }

        if (filter.offset) {
          // SQLite requires LIMIT when using OFFSET
          if (!filter.limit) {
            query = query.limit(1000000) as typeof query; // Large default limit
          }
          query = query.offset(filter.offset) as typeof query;
        }
      } else {
        // Default ordering
        query = query.orderBy(desc(instancesTable.last_activity)) as typeof query;
      }

      return await query;
    } catch (error) {
      throw ErrorFactory.database(ERROR_CODES.DATABASE_QUERY_FAILED, "Failed to list instances", {
        filter,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async deleteInstance(id: string): Promise<void> {
    try {
      const result = await this.db.delete(instancesTable).where(eq(instancesTable.id, id));

      if (result.rowsAffected === 0) {
        throw ErrorFactory.database(
          ERROR_CODES.DATABASE_INSTANCE_NOT_FOUND,
          `Instance with ID '${id}' not found`,
          { instanceId: id },
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("DATABASE_INSTANCE_NOT_FOUND")) {
        throw error; // Re-throw our custom error
      }

      throw ErrorFactory.database(ERROR_CODES.DATABASE_DELETE_FAILED, "Failed to delete instance", {
        instanceId: id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // MCP event tracking
  async logMCPEvent(event: NewMCPEvent): Promise<void> {
    try {
      // Set timestamp if not provided
      const eventWithTimestamp = {
        ...event,
        timestamp: event.timestamp || new Date(),
      };

      await this.db.insert(mcpEventsTable).values(eventWithTimestamp);
    } catch (error) {
      throw ErrorFactory.database(ERROR_CODES.DATABASE_LOG_FAILED, "Failed to log MCP event", {
        event,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getMCPEvents(instanceId: string, limit = 100): Promise<MCPEvent[]> {
    try {
      return await this.db
        .select()
        .from(mcpEventsTable)
        .where(eq(mcpEventsTable.instance_id, instanceId))
        .orderBy(desc(mcpEventsTable.timestamp))
        .limit(limit);
    } catch (error) {
      throw ErrorFactory.database(ERROR_CODES.DATABASE_QUERY_FAILED, "Failed to get MCP events", {
        instanceId,
        limit,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getRecentMCPEvents(sinceDate: Date): Promise<MCPEvent[]> {
    try {
      return await this.db
        .select()
        .from(mcpEventsTable)
        .where(gte(mcpEventsTable.timestamp, sinceDate))
        .orderBy(desc(mcpEventsTable.timestamp));
    } catch (error) {
      throw ErrorFactory.database(
        ERROR_CODES.DATABASE_QUERY_FAILED,
        "Failed to get recent MCP events",
        { sinceDate, error: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  // Instance relationships
  async createRelationship(relationship: NewRelationship): Promise<void> {
    try {
      // Set timestamp if not provided
      const relationshipWithTimestamp: NewRelationship = {
        ...relationship,
        created_at: relationship.created_at || new Date(),
      };

      await this.db.insert(relationshipsTable).values(relationshipWithTimestamp);
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
        throw ErrorFactory.database(
          ERROR_CODES.DATABASE_RELATIONSHIP_EXISTS,
          "Relationship already exists",
          { relationship },
        );
      }

      throw ErrorFactory.database(
        ERROR_CODES.DATABASE_INSERT_FAILED,
        "Failed to create relationship",
        { relationship, error: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  async getRelationships(instanceId: string): Promise<Relationship[]> {
    try {
      // Get relationships where instanceId is either parent or child
      const [parentRelationships, childRelationships] = await Promise.all([
        this.db
          .select()
          .from(relationshipsTable)
          .where(eq(relationshipsTable.parent_instance, instanceId)),
        this.db
          .select()
          .from(relationshipsTable)
          .where(eq(relationshipsTable.child_instance, instanceId)),
      ]);

      return [...parentRelationships, ...childRelationships].sort(
        (a, b) => b.created_at.getTime() - a.created_at.getTime(),
      );
    } catch (error) {
      throw ErrorFactory.database(
        ERROR_CODES.DATABASE_QUERY_FAILED,
        "Failed to get relationships",
        { instanceId, error: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  async updateRelationship(id: number, updates: Partial<NewRelationship>): Promise<void> {
    try {
      const result = await this.db
        .update(relationshipsTable)
        .set(updates)
        .where(eq(relationshipsTable.id, id));

      if (result.rowsAffected === 0) {
        throw ErrorFactory.database(
          ERROR_CODES.DATABASE_INSTANCE_NOT_FOUND,
          `Relationship with ID '${id}' not found`,
          { relationshipId: id },
        );
      }
    } catch (error) {
      throw ErrorFactory.database(
        ERROR_CODES.DATABASE_UPDATE_FAILED,
        "Failed to update relationship",
        { relationshipId: id, error: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  // GitHub integration
  async upsertGitHubIssue(issue: NewGitHubIssue): Promise<void> {
    try {
      // Set synced_at timestamp
      const issueWithTimestamp = {
        ...issue,
        synced_at: new Date(),
      };

      await this.db.insert(githubIssuesTable).values(issueWithTimestamp).onConflictDoUpdate({
        target: githubIssuesTable.number,
        set: issueWithTimestamp,
      });
    } catch (error) {
      throw ErrorFactory.database(
        ERROR_CODES.DATABASE_OPERATION_FAILED,
        "Failed to upsert GitHub issue",
        { issue, error: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  async getGitHubIssue(number: number): Promise<GitHubIssue | null> {
    try {
      const result = await this.db
        .select()
        .from(githubIssuesTable)
        .where(eq(githubIssuesTable.number, number))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      throw ErrorFactory.database(ERROR_CODES.DATABASE_QUERY_FAILED, "Failed to get GitHub issue", {
        issueNumber: number,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async syncGitHubIssues(issues: NewGitHubIssue[]): Promise<void> {
    try {
      // Batch upsert all issues
      for (const issue of issues) {
        await this.upsertGitHubIssue(issue);
      }
    } catch (error) {
      throw ErrorFactory.database(
        ERROR_CODES.DATABASE_OPERATION_FAILED,
        "Failed to sync GitHub issues",
        {
          issueCount: issues.length,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  // Configuration and maintenance
  async getConfig(key: string): Promise<string | null> {
    try {
      const result = await this.db
        .select()
        .from(userConfigTable)
        .where(eq(userConfigTable.key, key))
        .limit(1);

      return result[0]?.value || null;
    } catch (error) {
      throw ErrorFactory.database(ERROR_CODES.DATABASE_QUERY_FAILED, "Failed to get config", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async setConfig(key: string, value: string, encrypted = false): Promise<void> {
    try {
      const config = {
        key,
        value,
        encrypted,
        updated_at: new Date(),
      };

      await this.db
        .insert(userConfigTable)
        .values(config)
        .onConflictDoUpdate({
          target: userConfigTable.key,
          set: {
            value: config.value,
            encrypted: config.encrypted,
            updated_at: config.updated_at,
          },
        });
    } catch (error) {
      throw ErrorFactory.database(ERROR_CODES.DATABASE_OPERATION_FAILED, "Failed to set config", {
        key,
        encrypted,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async deleteConfig(key: string): Promise<void> {
    try {
      await this.db.delete(userConfigTable).where(eq(userConfigTable.key, key));
    } catch (error) {
      throw ErrorFactory.database(ERROR_CODES.DATABASE_DELETE_FAILED, "Failed to delete config", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async vacuum(): Promise<void> {
    try {
      await this.db.run("VACUUM");
    } catch (error) {
      throw ErrorFactory.database(
        ERROR_CODES.DATABASE_OPERATION_FAILED,
        "Failed to vacuum database",
        { error: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  async backup(path: string): Promise<void> {
    try {
      // For SQLite, we can use VACUUM INTO for creating backups
      await this.db.run(`VACUUM INTO '${path}'`);
    } catch (error) {
      throw ErrorFactory.database(
        ERROR_CODES.DATABASE_OPERATION_FAILED,
        "Failed to backup database",
        { path, error: error instanceof Error ? error.message : String(error) },
      );
    }
  }
}

// Main initialization function
export async function initializeDatabase(
  config?: Partial<DatabaseConfig>,
): Promise<DatabaseInterface> {
  const dbConfig = { ...getDefaultDatabaseConfig(), ...config };

  try {
    // Create client
    const client = createClient({
      url: dbConfig.local.file,
      // Additional options for future cloud support
      ...(dbConfig.cloud.enabled && dbConfig.cloud.authToken
        ? {
            authToken: dbConfig.cloud.authToken,
          }
        : {}),
    });

    // Create Drizzle instance
    const db = drizzle(client, {
      schema,
      logger: dbConfig.drizzle.logger,
    });

    // Run migrations if needed
    if (dbConfig.local.autoMigrate) {
      await runMigrationsWithDatabase(db);
    }

    return new SQLiteDatabase(db, client, dbConfig);
  } catch (error) {
    throw ErrorFactory.database(
      ERROR_CODES.DATABASE_INITIALIZATION_FAILED,
      "Failed to initialize database",
      {
        config: { ...dbConfig, cloud: { ...dbConfig.cloud, authToken: "[REDACTED]" } },
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

// Default database instance for convenience
let defaultDatabase: DatabaseInterface | null = null;

/**
 * Get or create the default database instance
 */
export async function getDatabase(): Promise<DatabaseInterface> {
  if (!defaultDatabase) {
    defaultDatabase = await initializeDatabase();
  }
  return defaultDatabase;
}

// Export types for external use
export type {
  Instance,
  NewInstance,
  MCPEvent,
  NewMCPEvent,
  Relationship,
  NewRelationship,
  GitHubIssue,
  NewGitHubIssue,
  UserConfig,
  NewUserConfig,
  InstanceStatus,
  InstanceType,
  RelationshipType,
  InstanceFilter,
};
