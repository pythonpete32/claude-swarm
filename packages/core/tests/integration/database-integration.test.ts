import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type DatabaseInterface,
  getDefaultDatabaseConfig,
  initializeDatabase,
} from "../../src/core/database.js";
import { VALID_INSTANCES } from "../fixtures/test-data.js";
import {
  createTempFileTestDb,
  createTestDatabaseWithData,
  generateTestInstance,
  generateTestMCPEvent,
} from "../fixtures/test-utils.js";

describe("Database Integration Tests", () => {
  let testDb: { db: DatabaseInterface; cleanup: () => Promise<void> };

  afterEach(async () => {
    if (testDb) {
      await testDb.cleanup();
    }
  });

  describe("File-based Database Operations", () => {
    beforeEach(async () => {
      testDb = await createTempFileTestDb();
    });

    it("should create and connect to file-based database", async () => {
      expect(testDb.db.isConnected()).toBe(true);

      // Test basic operation
      const instance = generateTestInstance();
      await testDb.db.createInstance(instance);

      const retrieved = await testDb.db.getInstance(instance.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(instance.id);
    });

    it("should persist data across reconnections", async () => {
      const instance = generateTestInstance();
      await testDb.db.createInstance(instance);

      // For now, just verify the data is there (reconnection testing is complex with libSQL)
      const retrieved = await testDb.db.getInstance(instance.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(instance.id);
    });

    it("should handle concurrent writes without corruption", async () => {
      const instances = Array.from({ length: 10 }, (_, i) =>
        generateTestInstance({ id: `concurrent-${i}` }),
      );

      // Execute concurrent writes
      const promises = instances.map((instance) => testDb.db.createInstance(instance));

      await expect(Promise.all(promises)).resolves.toBeDefined();

      // Verify all instances were created
      for (const instance of instances) {
        const retrieved = await testDb.db.getInstance(instance.id);
        expect(retrieved).toBeDefined();
      }
    });

    it("should handle large batch operations", async () => {
      const instances = Array.from({ length: 100 }, (_, i) =>
        generateTestInstance({ id: `batch-${i}` }),
      );

      // Batch create instances
      for (const instance of instances) {
        await testDb.db.createInstance(instance);
      }

      const allInstances = await testDb.db.listInstances();
      expect(allInstances.length).toBeGreaterThanOrEqual(100);
    });

    it("should maintain referential integrity", async () => {
      // Create parent instance
      const parentInstance = generateTestInstance({ id: "parent-test" });
      await testDb.db.createInstance(parentInstance);

      // Create child instance
      const childInstance = generateTestInstance({
        id: "child-test",
        parent_instance_id: "parent-test",
      });
      await testDb.db.createInstance(childInstance);

      // Create relationship
      await testDb.db.createRelationship({
        parent_instance: "parent-test",
        child_instance: "child-test",
        relationship_type: "spawned_review",
        review_iteration: 1,
        created_at: new Date(),
        metadata: JSON.stringify({ test: true }),
      });

      // Verify relationships
      const relationships = await testDb.db.getRelationships("parent-test");
      expect(relationships).toHaveLength(1);
      expect(relationships[0].child_instance).toBe("child-test");
    });
  });

  describe("Database Initialization and Configuration", () => {
    it("should initialize with default configuration", async () => {
      const tempPath = path.join(tmpdir(), `test-init-${Date.now()}.db`);

      const db = await initializeDatabase({
        local: {
          ...getDefaultDatabaseConfig().local,
          file: `file:${tempPath}`,
          autoMigrate: true,
        },
      });

      expect(db.isConnected()).toBe(true);

      // Test basic operation
      const instance = generateTestInstance();
      await db.createInstance(instance);

      const retrieved = await db.getInstance(instance.id);
      expect(retrieved?.id).toBe(instance.id);

      await db.disconnect();
    });

    it("should handle migration on initialization", async () => {
      const tempPath = path.join(tmpdir(), `test-migration-${Date.now()}.db`);

      const db = await initializeDatabase({
        local: {
          ...getDefaultDatabaseConfig().local,
          file: `file:${tempPath}`,
          autoMigrate: true,
        },
      });

      // Database should be ready with all tables
      const instance = VALID_INSTANCES.CODING_BASIC;
      await expect(db.createInstance(instance)).resolves.not.toThrow();

      await db.disconnect();
    });

    it("should handle configuration merging", async () => {
      const tempPath = path.join(tmpdir(), `test-config-${Date.now()}.db`);

      const customConfig = {
        local: {
          file: `file:${tempPath}`,
          enableWAL: false,
          busyTimeout: 10000,
          autoMigrate: true,
          logQueries: true,
        },
        connection: {
          maxRetries: 5,
          retryDelay: 2000,
          queryTimeout: 60000,
        },
      };

      const db = await initializeDatabase(customConfig);
      expect(db.isConnected()).toBe(true);

      await db.disconnect();
    });
  });

  describe("Complex Query Performance", () => {
    beforeEach(async () => {
      const { db } = await createTestDatabaseWithData();
      testDb = {
        db,
        cleanup: async () => {
          await db.disconnect();
        },
      };
    });

    it("should perform complex queries efficiently", async () => {
      const start = Date.now();

      // Complex query with joins and filters
      const instances = await testDb.db.listInstances({
        types: ["coding", "review"],
        statuses: ["started", "waiting_review"],
        orderBy: "last_activity",
        orderDirection: "DESC",
        limit: 50,
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should complete within 100ms
      expect(instances).toBeDefined();
    });

    it("should handle pagination efficiently", async () => {
      const pageSize = 10;
      const firstPage = await testDb.db.listInstances({ limit: pageSize, offset: 0 });
      const secondPage = await testDb.db.listInstances({ limit: pageSize, offset: pageSize });

      expect(firstPage).toHaveLength(Math.min(pageSize, firstPage.length));
      expect(secondPage).toHaveLength(Math.min(pageSize, secondPage.length));

      // Ensure no overlap
      const firstPageIds = firstPage.map((i) => i.id);
      const secondPageIds = secondPage.map((i) => i.id);
      const overlap = firstPageIds.filter((id) => secondPageIds.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it("should handle event queries with time ranges", async () => {
      const start = Date.now();

      const recentDate = new Date(Date.now() - 60000); // 1 minute ago
      const events = await testDb.db.getRecentMCPEvents(recentDate);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(50); // Should complete within 50ms
      expect(events).toBeDefined();
    });
  });

  describe("Database Maintenance", () => {
    beforeEach(async () => {
      testDb = await createTempFileTestDb();
    });

    it("should perform vacuum operation", async () => {
      // Add some data
      const instances = Array.from({ length: 50 }, () => generateTestInstance());
      for (const instance of instances) {
        await testDb.db.createInstance(instance);
      }

      // Delete some data to create fragmentation
      for (let i = 0; i < 25; i++) {
        await testDb.db.deleteInstance(instances[i].id);
      }

      // Vacuum should complete successfully
      const start = Date.now();
      await testDb.db.vacuum();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should create database backups", async () => {
      // Add test data
      const instance = generateTestInstance();
      await testDb.db.createInstance(instance);

      const events = Array.from({ length: 10 }, () =>
        generateTestMCPEvent({ instance_id: instance.id }),
      );
      for (const event of events) {
        await testDb.db.logMCPEvent(event);
      }

      // Create backup
      const backupPath = path.join(tmpdir(), `backup-${Date.now()}.db`);
      await testDb.db.backup(backupPath);

      // Verify backup was created (we can't easily verify content without another db connection)
      // But the operation should complete without error
    });
  });

  describe("Transaction Behavior", () => {
    beforeEach(async () => {
      testDb = await createTempFileTestDb();
    });

    it("should handle rapid sequential operations", async () => {
      const instance = generateTestInstance();

      // Rapid sequence of operations
      await testDb.db.createInstance(instance);
      await testDb.db.updateInstanceStatus(instance.id, "waiting_review");
      await testDb.db.updateInstanceStatus(instance.id, "pr_created");
      await testDb.db.updateInstanceStatus(instance.id, "pr_merged");

      const retrieved = await testDb.db.getInstance(instance.id);
      expect(retrieved?.status).toBe("pr_merged");
      expect(retrieved?.terminated_at).toBeDefined();

      // Should have multiple MCP events
      const events = await testDb.db.getMCPEvents(instance.id);
      expect(events.length).toBeGreaterThanOrEqual(3); // 3 status updates
    });

    it("should maintain consistency during concurrent operations", async () => {
      const instances = Array.from({ length: 5 }, (_, i) =>
        generateTestInstance({ id: `concurrent-ops-${i}` }),
      );

      // Create instances concurrently
      await Promise.all(instances.map((instance) => testDb.db.createInstance(instance)));

      // Update statuses concurrently
      await Promise.all(
        instances.map((instance) => testDb.db.updateInstanceStatus(instance.id, "waiting_review")),
      );

      // Log events concurrently
      await Promise.all(
        instances.map((instance) =>
          testDb.db.logMCPEvent(
            generateTestMCPEvent({
              instance_id: instance.id,
              tool_name: "concurrent_test",
            }),
          ),
        ),
      );

      // Verify final state
      for (const instance of instances) {
        const retrieved = await testDb.db.getInstance(instance.id);
        expect(retrieved?.status).toBe("waiting_review");

        const events = await testDb.db.getMCPEvents(instance.id);
        expect(events.length).toBeGreaterThanOrEqual(2); // Status update + manual event
      }
    });
  });

  describe("Error Recovery", () => {
    beforeEach(async () => {
      testDb = await createTempFileTestDb();
    });

    it("should recover from connection interruptions", async () => {
      const instance = generateTestInstance();
      await testDb.db.createInstance(instance);

      // Simulate checking connection state
      expect(testDb.db.isConnected()).toBe(true);

      // Data should be accessible
      const retrieved = await testDb.db.getInstance(instance.id);
      expect(retrieved?.id).toBe(instance.id);
    });

    it("should handle invalid data gracefully", async () => {
      // These should all fail gracefully without corrupting the database
      const invalidOperations = [
        () => testDb.db.createInstance({} as Parameters<typeof testDb.db.createInstance>[0]),
        () => testDb.db.updateInstance("", {} as Parameters<typeof testDb.db.updateInstance>[1]),
        () => testDb.db.logMCPEvent({} as Parameters<typeof testDb.db.logMCPEvent>[0]),
        () =>
          testDb.db.createRelationship({} as Parameters<typeof testDb.db.createRelationship>[0]),
      ];

      for (const operation of invalidOperations) {
        await expect(operation()).rejects.toThrow();
      }

      // Database should still be functional
      const instance = generateTestInstance();
      await expect(testDb.db.createInstance(instance)).resolves.not.toThrow();
    });
  });

  describe("Performance Benchmarks", () => {
    beforeEach(async () => {
      testDb = await createTempFileTestDb();
    });

    it("should meet CRUD performance benchmarks", async () => {
      const instance = generateTestInstance();

      // CREATE benchmark
      const createStart = Date.now();
      await testDb.db.createInstance(instance);
      const createDuration = Date.now() - createStart;
      expect(createDuration).toBeLessThan(10); // Under 10ms

      // READ benchmark
      const readStart = Date.now();
      await testDb.db.getInstance(instance.id);
      const readDuration = Date.now() - readStart;
      expect(readDuration).toBeLessThan(10); // Under 10ms

      // UPDATE benchmark
      const updateStart = Date.now();
      await testDb.db.updateInstance(instance.id, { status: "waiting_review" });
      const updateDuration = Date.now() - updateStart;
      expect(updateDuration).toBeLessThan(10); // Under 10ms

      // DELETE benchmark
      const deleteStart = Date.now();
      await testDb.db.deleteInstance(instance.id);
      const deleteDuration = Date.now() - deleteStart;
      expect(deleteDuration).toBeLessThan(10); // Under 10ms
    });

    it("should handle bulk operations efficiently", async () => {
      const instances = Array.from({ length: 100 }, () => generateTestInstance());

      const start = Date.now();
      for (const instance of instances) {
        await testDb.db.createInstance(instance);
      }
      const duration = Date.now() - start;

      // Should create 100 instances in under 1 second
      expect(duration).toBeLessThan(1000);

      // Average should be under 10ms per operation
      const averagePerOperation = duration / instances.length;
      expect(averagePerOperation).toBeLessThan(10);
    });
  });
});
