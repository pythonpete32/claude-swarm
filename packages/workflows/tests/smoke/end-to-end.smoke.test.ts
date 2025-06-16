/**
 * End-to-End Smoke Test
 * 
 * This test creates a real bun project, executes the complete coding → review workflow,
 * and verifies all database operations and state transitions work correctly.
 */

import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readdir, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CodingAgentWorkflow } from "../../src/workflows/coding-agent-workflow.js";
import { ReviewAgentWorkflow } from "../../src/workflows/review-agent-workflow.js";
import { createDatabase } from "@claude-codex/core";
import type { CodingAgentConfig, ReviewAgentConfig } from "../../src/types/workflow-config.js";

describe.skip("End-to-End Smoke Test", () => {
  let testProjectPath: string;
  let database: Awaited<ReturnType<typeof createDatabase>>;
  let codingWorkflow: CodingAgentWorkflow;
  let reviewWorkflow: ReviewAgentWorkflow;

  beforeAll(async () => {
    // Create temporary test project
    testProjectPath = join(tmpdir(), `claude-codex-smoke-test-${Date.now()}`);
    await mkdir(testProjectPath, { recursive: true });

    // Initialize a real Bun project
    await writeFile(join(testProjectPath, "package.json"), JSON.stringify({
      name: "smoke-test-project",
      version: "1.0.0",
      type: "module",
      scripts: {
        start: "bun run src/index.ts",
        test: "echo 'Tests pass!'"
      },
      dependencies: {},
      devDependencies: {
        "@types/bun": "latest"
      }
    }, null, 2));

    // Create basic project structure
    await mkdir(join(testProjectPath, "src"), { recursive: true });
    await writeFile(join(testProjectPath, "src/index.ts"), `// Smoke test project
console.log("Hello from Claude Codex smoke test!");

export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

export function add(a: number, b: number): number {
  return a + b;
}
`);

    // Create a simple README
    await writeFile(join(testProjectPath, "README.md"), `# Smoke Test Project

This is a simple TypeScript project created for testing Claude Codex workflows.

## Task

Add a new utility function called \`multiply\` that takes two numbers and returns their product.

## Requirements

1. Function should be exported from src/index.ts
2. Function should have proper TypeScript types
3. Function should handle edge cases (zero, negative numbers)
4. Add console.log to demonstrate the function works
`);

    // Initialize Git repository
    const { execSync } = await import("node:child_process");
    execSync("git init", { cwd: testProjectPath });
    execSync("git config user.name 'Smoke Test'", { cwd: testProjectPath });
    execSync("git config user.email 'test@example.com'", { cwd: testProjectPath });
    execSync("git add .", { cwd: testProjectPath });
    execSync("git commit -m 'Initial commit'", { cwd: testProjectPath });

    // Create real database
    database = await createDatabase({
      local: {
        file: join(testProjectPath, "test.db"),
        enableWAL: true,
        busyTimeout: 5000,
        autoMigrate: true,
        logQueries: false,
      },
      cloud: { enabled: false },
      connection: { maxRetries: 3, retryDelay: 1000, queryTimeout: 30000 },
      maintenance: { vacuumInterval: 86400, backupRetention: 7, logRetention: 30, autoBackup: false },
      drizzle: { logger: false, casing: "snake_case" }
    });

    // Create workflows with real core functions
    const {
      createWorktree,
      removeWorktree,
      createTmuxSession,
      killSession,
      launchClaudeSession,
      terminateClaudeSession,
      sendKeys,
      createPullRequest,
    } = await import("@claude-codex/core");

    codingWorkflow = new CodingAgentWorkflow(
      database,
      createWorktree,
      removeWorktree,
      createTmuxSession,
      killSession,
      launchClaudeSession,
      terminateClaudeSession,
      sendKeys
    );

    reviewWorkflow = new ReviewAgentWorkflow(
      database,
      createWorktree,
      removeWorktree,
      createTmuxSession,
      killSession,
      launchClaudeSession,
      terminateClaudeSession,
      createPullRequest,
      sendKeys
    );
  }, 30000);

  afterAll(async () => {
    // Cleanup
    try {
      if (database) {
        await database.disconnect();
      }
      if (testProjectPath) {
        await rm(testProjectPath, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn("Cleanup error:", error);
    }
  });

  it("should execute complete coding workflow", async () => {
    const config: CodingAgentConfig = {
      repository: {
        owner: "smoke-test",
        name: "test-project",
        path: testProjectPath,
        defaultBranch: "main",
        remoteUrl: "https://github.com/smoke-test/test-project.git"
      },
      baseBranch: "main",
      targetBranch: "feature/add-multiply-function",
      issue: {
        id: "123",
        number: 1,
        title: "Add multiply function",
        body: "Add a new utility function called `multiply` that takes two numbers and returns their product. Should handle edge cases and have proper TypeScript types.",
        state: "open",
        url: "https://github.com/smoke-test/test-project/issues/1",
        user: {
          login: "test-user",
          id: "456",
          avatar_url: "https://github.com/test-user.png"
        },
        labels: ["enhancement"],
        assignees: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      systemPrompt: `You are a TypeScript developer. Add a multiply function to src/index.ts that:
1. Takes two numbers as parameters  
2. Returns their product
3. Has proper TypeScript types
4. Add a console.log to demonstrate it works
5. Export the function

When done, request a review.`,
      requireReview: true,
      maxReviews: 2,
      executionTimeout: 60000 // 1 minute for smoke test
    };

    // Execute coding workflow
    const execution = await codingWorkflow.execute(config);

    // Verify execution result
    expect(execution.type).toBe("coding");
    expect(execution.status).toBe("started");
    expect(execution.currentState.phase).toBe("working");
    expect(execution.resources.worktreePath).toBeTruthy();
    expect(execution.resources.sessionName).toBeTruthy();
    expect(execution.resources.branch).toBe("feature/add-multiply-function");

    // Verify database state
    const instance = await database.getInstance(execution.id);
    expect(instance).toBeTruthy();
    expect(instance?.type).toBe("coding");
    expect(instance?.status).toBe("started");
    expect(instance?.worktree_path).toBe(execution.resources.worktreePath);
    expect(instance?.branch_name).toBe("feature/add-multiply-function");
    expect(instance?.prompt_used).toContain("TypeScript developer");
    expect(instance?.prompt_context).toBeTruthy();

    const promptContext = JSON.parse(instance?.prompt_context || "{}");
    expect(promptContext.issue?.title).toBe("Add multiply function");
    expect(promptContext.baseInstructions).toContain("TypeScript developer");
  }, 60000);

  it("should request review and create review workflow", async () => {
    // First get an active coding instance
    const instances = await database.listInstances({ limit: 10 });
    const codingInstance = instances.find(i => i.type === "coding" && i.status === "started");
    
    if (!codingInstance) {
      throw new Error("No active coding instance found for review test");
    }

    // Request review
    const reviewInstanceId = await codingWorkflow.requestReview(codingInstance.id, 2);

    // Verify review instance ID format
    expect(reviewInstanceId).toMatch(/^review-.*-1$/);

    // Verify parent instance state changed
    const updatedParent = await database.getInstance(codingInstance.id);
    expect(updatedParent?.status).toBe("waiting_review");

    // Create review workflow
    const reviewConfig: ReviewAgentConfig = {
      parentInstanceId: codingInstance.id,
      parentTmuxSession: codingInstance.tmux_session,
      reviewBranch: `review/${reviewInstanceId}`,
      issueNumber: 1,
      codingDescription: "Added multiply function as requested",
      preserveChanges: false,
      timeoutMinutes: 10,
      reviewPrompt: "Review the multiply function implementation for correctness, type safety, and adherence to requirements."
    };

    const reviewExecution = await reviewWorkflow.execute(reviewConfig);

    // Verify review execution
    expect(reviewExecution.type).toBe("review");
    expect(reviewExecution.status).toBe("started");
    expect(reviewExecution.currentState.phase).toBe("working");
    expect(reviewExecution.currentState.parentInstanceId).toBe(codingInstance.id);

    // Verify database state
    const reviewInstance = await database.getInstance(reviewExecution.id);
    expect(reviewInstance).toBeTruthy();
    expect(reviewInstance?.type).toBe("review");
    expect(reviewInstance?.status).toBe("started");
    expect(reviewInstance?.parent_instance_id).toBe(codingInstance.id);
    expect(reviewInstance?.prompt_used).toContain("Review the multiply function");

    // Verify relationship was created
    const relationships = await database.getRelationships(codingInstance.id);
    const reviewRelationship = relationships.find(r => 
      r.parent_instance === codingInstance.id && 
      r.child_instance === reviewExecution.id
    );
    expect(reviewRelationship).toBeTruthy();
    expect(reviewRelationship?.relationship_type).toBe("spawned_review");
  }, 30000);

  it("should complete review workflow with feedback", async () => {
    // Get an active review instance
    const instances = await database.listInstances({ limit: 10 });
    const reviewInstance = instances.find(i => i.type === "review" && i.status === "started");
    
    if (!reviewInstance) {
      throw new Error("No active review instance found for feedback test");
    }

    // Save review with changes requested
    await reviewWorkflow.saveReview(
      reviewInstance.id,
      "The multiply function implementation looks good! The TypeScript types are correct and the function handles edge cases properly. However, please add a few more test cases in the console.log to demonstrate it works with negative numbers and zero.",
      "request_changes"
    );

    // Verify review instance was terminated
    const updatedReview = await database.getInstance(reviewInstance.id);
    expect(updatedReview?.status).toBe("terminated");

    // Verify parent instance status was updated
    const parentInstance = await database.getInstance(reviewInstance.parent_instance_id!);
    expect(parentInstance?.status).toBe("started"); // Back to working

    // Verify relationship metadata was updated
    const relationships = await database.getRelationships(reviewInstance.parent_instance_id!);
    const reviewRelationship = relationships.find(r => r.child_instance === reviewInstance.id);
    expect(reviewRelationship?.metadata).toBeTruthy();
    
    const metadata = JSON.parse(reviewRelationship?.metadata || "{}");
    expect(metadata.decision).toBe("request_changes");
    expect(metadata.review).toContain("multiply function implementation looks good");
  }, 30000);

  it("should handle workflow state correctly", async () => {
    // Verify complete workflow state
    const allInstances = await database.listInstances({ limit: 10 });
    
    // Should have both coding and review instances
    const codingInstances = allInstances.filter(i => i.type === "coding");
    const reviewInstances = allInstances.filter(i => i.type === "review");
    
    expect(codingInstances.length).toBeGreaterThan(0);
    expect(reviewInstances.length).toBeGreaterThan(0);

    // Verify database integrity
    for (const instance of allInstances) {
      expect(instance.id).toBeTruthy();
      expect(instance.type).toMatch(/^(coding|review)$/);
      expect(instance.status).toMatch(/^(started|waiting_review|terminated)$/);
      expect(instance.created_at).toBeInstanceOf(Date);
      expect(instance.last_activity).toBeInstanceOf(Date);
      
      if (instance.prompt_used) {
        expect(instance.prompt_used.length).toBeGreaterThan(0);
      }
      
      if (instance.prompt_context) {
        expect(() => JSON.parse(instance.prompt_context!)).not.toThrow();
      }
    }

    // Verify relationships exist and are valid
    const allRelationships = await Promise.all(
      allInstances.map(i => database.getRelationships(i.id))
    );
    
    const relationships = allRelationships.flat();
    expect(relationships.length).toBeGreaterThan(0);
    
    for (const rel of relationships) {
      expect(rel.parent_instance).toBeTruthy();
      expect(rel.child_instance).toBeTruthy();
      expect(rel.relationship_type).toBe("spawned_review");
      expect(rel.created_at).toBeInstanceOf(Date);
    }
  }, 15000);
});