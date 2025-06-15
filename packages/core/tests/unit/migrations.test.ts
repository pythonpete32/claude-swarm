import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrationsWithDatabase } from "../../src/db/migrate.js";
import { type NewInstance, schema } from "../../src/db/schema.js";

describe("Migration System Tests", () => {
  let testDbPath: string;
  let client: ReturnType<typeof createClient>;
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    testDbPath = path.join(tmpdir(), `migration-test-${Date.now()}.db`);
    client = createClient({ url: `file:${testDbPath}` });
    db = drizzle(client, { schema });
  });

  afterEach(async () => {
    await client.close();
  });

  describe("Migration Application", () => {
    it("should apply migrations successfully on empty database", async () => {
      await expect(runMigrationsWithDatabase(db)).resolves.not.toThrow();
    });

    it("should create all required tables", async () => {
      await runMigrationsWithDatabase(db);

      // Test that all tables exist by trying to query them
      const tableTests = [
        () => db.select().from(schema.instancesTable).limit(0),
        () => db.select().from(schema.mcpEventsTable).limit(0),
        () => db.select().from(schema.relationshipsTable).limit(0),
        () => db.select().from(schema.githubIssuesTable).limit(0),
        () => db.select().from(schema.userConfigTable).limit(0),
      ];

      for (const test of tableTests) {
        await expect(test()).resolves.not.toThrow();
      }
    });

    it("should create proper indexes", async () => {
      await runMigrationsWithDatabase(db);

      // Query SQLite's index information
      const indexes = (await db.all(`
        SELECT name, tbl_name 
        FROM sqlite_master 
        WHERE type = 'index' 
        AND name NOT LIKE 'sqlite_%'
      `)) as Array<{ name: string; tbl_name: string }>;

      // Check for some key indexes
      const indexNames = indexes.map((idx) => idx.name);
      expect(indexNames).toContain("idx_instances_status");
      expect(indexNames).toContain("idx_instances_last_activity");
      expect(indexNames).toContain("idx_mcp_events_instance_id");
      expect(indexNames).toContain("idx_mcp_events_timestamp");
      expect(indexNames).toContain("idx_relationships_parent");
      expect(indexNames).toContain("idx_relationships_child");
      expect(indexNames).toContain("idx_github_issues_state");
    });

    it("should handle multiple migration runs without error", async () => {
      // First migration
      await runMigrationsWithDatabase(db);

      // Second migration (should be idempotent)
      await expect(runMigrationsWithDatabase(db)).resolves.not.toThrow();

      // Tables should still work
      await expect(db.select().from(schema.instancesTable).limit(0)).resolves.not.toThrow();
    });

    it("should preserve data across migration re-runs", async () => {
      // Apply initial migration
      await runMigrationsWithDatabase(db);

      // Insert test data
      const testInstance = {
        id: "migration-test",
        type: "coding" as const,
        status: "started" as const,
        worktree_path: "/test/path",
        branch_name: "test-branch",
        base_branch: "main",
        tmux_session: "test-session",
        claude_pid: 12345,
        issue_number: 123,
        pr_number: null,
        pr_url: null,
        parent_instance_id: null,
        created_at: new Date(),
        terminated_at: null,
        last_activity: new Date(),
        system_prompt: "Test prompt",
        agent_number: 1,
      };

      await db.insert(schema.instancesTable).values(testInstance);

      // Re-run migrations
      await runMigrationsWithDatabase(db);

      // Data should still be there
      const instances = await db
        .select()
        .from(schema.instancesTable)
        .where(eq(schema.instancesTable.id, "migration-test"));

      expect(instances).toHaveLength(1);
      expect(instances[0].id).toBe("migration-test");
    });
  });

  describe("Schema Validation", () => {
    beforeEach(async () => {
      await runMigrationsWithDatabase(db);
    });

    it("should enforce primary key constraints", async () => {
      const instance = {
        id: "pk-test",
        type: "coding" as const,
        status: "started" as const,
        worktree_path: "/test",
        branch_name: "test",
        tmux_session: "test",
        agent_number: 1,
      };

      await db.insert(schema.instancesTable).values(instance);

      // Duplicate ID should fail
      await expect(db.insert(schema.instancesTable).values(instance)).rejects.toThrow();
    });

    it("should enforce unique constraints", async () => {
      const relationship = {
        parent_instance: "parent-1",
        child_instance: "child-1",
        relationship_type: "spawned_review" as const,
        review_iteration: 1,
        created_at: new Date(),
      };

      await db.insert(schema.relationshipsTable).values(relationship);

      // Duplicate relationship should fail
      await expect(db.insert(schema.relationshipsTable).values(relationship)).rejects.toThrow();
    });

    it("should enforce NOT NULL constraints", async () => {
      // Missing required fields should fail
      await expect(
        db.insert(schema.instancesTable).values({
          id: "null-test",
          // Missing required fields like type, status, etc.
        } as NewInstance),
      ).rejects.toThrow();
    });

    it("should enforce foreign key-like constraints through unique indexes", async () => {
      const issue1 = {
        number: 123,
        title: "Test Issue",
        body: "Test body",
        state: "open" as const,
        created_at: new Date(),
        updated_at: new Date(),
        repo_owner: "test",
        repo_name: "repo",
      };

      await db.insert(schema.githubIssuesTable).values(issue1);

      // Duplicate issue number should fail
      const issue2 = { ...issue1, title: "Different title" };
      await expect(db.insert(schema.githubIssuesTable).values(issue2)).rejects.toThrow();
    });
  });

  describe("Data Type Validation", () => {
    beforeEach(async () => {
      await runMigrationsWithDatabase(db);
    });

    it("should handle date/timestamp fields correctly", async () => {
      const now = new Date();
      const instance = {
        id: "date-test",
        type: "coding" as const,
        status: "started" as const,
        worktree_path: "/test",
        branch_name: "test",
        tmux_session: "test",
        agent_number: 1,
        created_at: now,
        last_activity: now,
      };

      await db.insert(schema.instancesTable).values(instance);

      const retrieved = await db
        .select()
        .from(schema.instancesTable)
        .where(eq(schema.instancesTable.id, "date-test"));

      expect(retrieved[0].created_at).toBeInstanceOf(Date);
      expect(retrieved[0].last_activity).toBeInstanceOf(Date);
      // SQLite may store with second precision, so check within 1 second
      expect(Math.abs(retrieved[0].created_at.getTime() - now.getTime())).toBeLessThan(1000);
    });

    it("should handle JSON fields correctly", async () => {
      const metadata = { test: true, number: 42, nested: { value: "test" } };
      const event = {
        instance_id: "json-test",
        tool_name: "test_tool",
        success: true,
        metadata: JSON.stringify(metadata),
        timestamp: new Date(),
      };

      await db.insert(schema.mcpEventsTable).values(event);

      const retrieved = await db
        .select()
        .from(schema.mcpEventsTable)
        .where(eq(schema.mcpEventsTable.instance_id, "json-test"));

      expect(retrieved[0].metadata).toBe(JSON.stringify(metadata));
      const metadataStr = (retrieved[0].metadata ?? "{}") as string;
      const parsed = JSON.parse(metadataStr);
      expect(parsed).toEqual(metadata);
    });

    it("should handle boolean fields correctly", async () => {
      const event = {
        instance_id: "bool-test",
        tool_name: "test_tool",
        success: true,
        is_status_updating: false,
        timestamp: new Date(),
      };

      await db.insert(schema.mcpEventsTable).values(event);

      const retrieved = await db
        .select()
        .from(schema.mcpEventsTable)
        .where(eq(schema.mcpEventsTable.instance_id, "bool-test"));

      expect(retrieved[0].success).toBe(true);
      expect(retrieved[0].is_status_updating).toBe(false);
    });

    it("should handle integer fields correctly", async () => {
      const instance = {
        id: "int-test",
        type: "coding" as const,
        status: "started" as const,
        worktree_path: "/test",
        branch_name: "test",
        tmux_session: "test",
        claude_pid: 12345,
        issue_number: 999,
        agent_number: 1,
      };

      await db.insert(schema.instancesTable).values(instance);

      const retrieved = await db
        .select()
        .from(schema.instancesTable)
        .where(eq(schema.instancesTable.id, "int-test"));

      expect(retrieved[0].claude_pid).toBe(12345);
      expect(retrieved[0].issue_number).toBe(999);
      expect(retrieved[0].agent_number).toBe(1);
    });
  });

  describe("Default Values", () => {
    beforeEach(async () => {
      await runMigrationsWithDatabase(db);
    });

    it("should apply default values for timestamps", async () => {
      const instance = {
        id: "default-test",
        type: "coding" as const,
        status: "started" as const,
        worktree_path: "/test",
        branch_name: "test",
        tmux_session: "test",
        agent_number: 1,
        // Not providing created_at or last_activity
      };

      await db.insert(schema.instancesTable).values(instance);

      const retrieved = await db
        .select()
        .from(schema.instancesTable)
        .where(eq(schema.instancesTable.id, "default-test"));

      expect(retrieved[0].created_at).toBeDefined();
      expect(retrieved[0].last_activity).toBeDefined();
    });

    it("should apply default values for agent_number", async () => {
      const instance = {
        id: "agent-default-test",
        type: "coding" as const,
        status: "started" as const,
        worktree_path: "/test",
        branch_name: "test",
        tmux_session: "test",
        // Not providing agent_number
      };

      await db.insert(schema.instancesTable).values(instance);

      const retrieved = await db
        .select()
        .from(schema.instancesTable)
        .where(eq(schema.instancesTable.id, "agent-default-test"));

      expect(retrieved[0].agent_number).toBe(1);
    });

    it("should apply default values for boolean fields", async () => {
      const event = {
        instance_id: "bool-default-test",
        tool_name: "test_tool",
        success: true,
        // Not providing is_status_updating
      };

      await db.insert(schema.mcpEventsTable).values(event);

      const retrieved = await db
        .select()
        .from(schema.mcpEventsTable)
        .where(eq(schema.mcpEventsTable.instance_id, "bool-default-test"));

      expect(retrieved[0].is_status_updating).toBe(false);
    });
  });
});

// Add eq import that was missing
import { eq } from "drizzle-orm";
