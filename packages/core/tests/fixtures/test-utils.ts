import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import {
  type DatabaseInterface,
  SQLiteDatabase,
  getDefaultDatabaseConfig,
} from "../../src/core/database.js";
import { schema } from "../../src/db/schema.js";
import type {
  NewGitHubIssue,
  NewInstance,
  NewMCPEvent,
  NewRelationship,
} from "../../src/db/schema.js";

/**
 * Create an in-memory test database for isolated unit testing
 */
export async function createInMemoryTestDb(): Promise<DatabaseInterface> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });

  // Run migrations
  await migrate(db, { migrationsFolder: "./migrations" });

  const config = {
    ...getDefaultDatabaseConfig(),
    local: {
      ...getDefaultDatabaseConfig().local,
      file: ":memory:",
      logQueries: false, // Reduce noise in tests
    },
  };

  return new SQLiteDatabase(db, client, config);
}

/**
 * Create a temporary file-based test database for integration testing
 */
export async function createTempFileTestDb(): Promise<{
  db: DatabaseInterface;
  cleanup: () => Promise<void>;
}> {
  const tempPath = `/tmp/test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.db`;
  const client = createClient({ url: `file:${tempPath}` });
  const db = drizzle(client, { schema });

  // Run migrations
  await migrate(db, { migrationsFolder: "./migrations" });

  const config = {
    ...getDefaultDatabaseConfig(),
    local: {
      ...getDefaultDatabaseConfig().local,
      file: `file:${tempPath}`,
      logQueries: false,
    },
  };

  const database = new SQLiteDatabase(db, client, config);

  const cleanup = async () => {
    await database.disconnect();
    // Note: File cleanup would happen automatically on process exit for temp files
  };

  return { db: database, cleanup };
}

/**
 * Generate test instance data with optional overrides
 */
export function generateTestInstance(overrides?: Partial<NewInstance>): NewInstance {
  const timestamp = new Date();
  const id = `test-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  return {
    id,
    type: "coding",
    status: "started",
    worktree_path: `/tmp/test-worktree-${id}`,
    branch_name: `test-branch-${id}`,
    base_branch: "main",
    tmux_session: `test-session-${id}`,
    claude_pid: Math.floor(Math.random() * 10000) + 1000,
    issue_number: Math.floor(Math.random() * 1000) + 1,
    pr_number: null,
    pr_url: null,
    parent_instance_id: null,
    created_at: timestamp,
    terminated_at: null,
    last_activity: timestamp,
    system_prompt: "Test system prompt for development",
    agent_number: 1,
    ...overrides,
  };
}

/**
 * Generate test MCP event data with optional overrides
 */
export function generateTestMCPEvent(overrides?: Partial<NewMCPEvent>): NewMCPEvent {
  const timestamp = new Date();

  return {
    instance_id: `test-instance-${Date.now()}`,
    tool_name: "test_tool",
    success: true,
    error_message: null,
    metadata: JSON.stringify({ test: true }),
    git_commit_hash: null,
    status_change: null,
    is_status_updating: false,
    timestamp,
    ...overrides,
  };
}

/**
 * Generate test relationship data with optional overrides
 */
export function generateTestRelationship(overrides?: Partial<NewRelationship>): NewRelationship {
  const timestamp = new Date();

  return {
    parent_instance: `test-parent-${Date.now()}`,
    child_instance: `test-child-${Date.now()}`,
    relationship_type: "spawned_review",
    review_iteration: 1,
    created_at: timestamp,
    metadata: JSON.stringify({ test: true }),
    ...overrides,
  };
}

/**
 * Generate test GitHub issue data with optional overrides
 */
export function generateTestGitHubIssue(overrides?: Partial<NewGitHubIssue>): NewGitHubIssue {
  const timestamp = new Date();
  const number = Math.floor(Math.random() * 1000) + 1;

  return {
    number,
    title: `Test Issue #${number}`,
    body: "This is a test issue description",
    state: "open",
    assignee: "test-user",
    labels: JSON.stringify(["bug", "test"]),
    created_at: timestamp,
    updated_at: timestamp,
    synced_at: timestamp,
    repo_owner: "test-org",
    repo_name: "test-repo",
    ...overrides,
  };
}

/**
 * Create multiple test instances for batch testing
 */
export function generateTestInstances(
  count: number,
  baseOverrides?: Partial<NewInstance>,
): NewInstance[] {
  return Array.from({ length: count }, (_, i) =>
    generateTestInstance({
      ...baseOverrides,
      id: `batch-test-${Date.now()}-${i}`,
      agent_number: i + 1,
    }),
  );
}

/**
 * Wait for a specified amount of time (useful for timestamp testing)
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validate that an instance matches expected properties
 */
export function validateInstance(instance: NewInstance, expected: Partial<NewInstance>): void {
  for (const [key, value] of Object.entries(expected)) {
    if (instance[key as keyof NewInstance] !== value) {
      throw new Error(
        `Instance validation failed: expected ${key} to be ${value}, got ${instance[key as keyof NewInstance]}`,
      );
    }
  }
}

/**
 * Clean up test resources (for manual cleanup in integration tests)
 */
export async function cleanupTestResources(): Promise<void> {
  // This would be used for cleaning up any persistent test resources
  // For now, it's a no-op since we use in-memory and temp files
}

/**
 * Assert that a database operation throws a specific error
 */
export async function expectDatabaseError(
  operation: () => Promise<unknown>,
  expectedErrorCode: string,
): Promise<void> {
  try {
    await operation();
    throw new Error(`Expected operation to throw error with code: ${expectedErrorCode}`);
  } catch (error: unknown) {
    const errorWithCode = error as { code?: string; message?: string };
    if (errorWithCode.code !== expectedErrorCode) {
      throw new Error(
        `Expected error code ${expectedErrorCode}, but got ${errorWithCode.code}: ${errorWithCode.message}`,
      );
    }
  }
}

/**
 * Create a test database with pre-populated data
 */
export async function createTestDatabaseWithData(): Promise<{
  db: DatabaseInterface;
  instances: NewInstance[];
  events: NewMCPEvent[];
  relationships: NewRelationship[];
}> {
  const db = await createInMemoryTestDb();

  // Create test instances
  const instances = generateTestInstances(3);
  for (const instance of instances) {
    await db.createInstance(instance);
  }

  // Create test events
  const events = instances.flatMap((instance) =>
    Array.from({ length: 2 }, () => generateTestMCPEvent({ instance_id: instance.id })),
  );
  for (const event of events) {
    await db.logMCPEvent(event);
  }

  // Create test relationships
  const relationships = [
    generateTestRelationship({
      parent_instance: instances[0].id,
      child_instance: instances[1].id,
      relationship_type: "spawned_review",
    }),
    generateTestRelationship({
      parent_instance: instances[1].id,
      child_instance: instances[2].id,
      relationship_type: "created_fork",
    }),
  ];
  for (const relationship of relationships) {
    await db.createRelationship(relationship);
  }

  return { db, instances, events, relationships };
}
