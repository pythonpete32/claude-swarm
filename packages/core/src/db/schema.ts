import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

// Instances table - tracks all agent instances
export const instancesTable = sqliteTable(
  "instances",
  {
    id: text().primaryKey(),
    type: text({ enum: ["coding", "review", "planning"] }).notNull(),
    status: text({
      enum: ["started", "waiting_review", "pr_created", "pr_merged", "pr_closed", "terminated"],
    }).notNull(),

    // Git/Worktree information
    worktree_path: text().notNull(),
    branch_name: text().notNull(),
    base_branch: text(),

    // Session information
    tmux_session: text().notNull(),
    claude_pid: integer(),

    // GitHub integration
    issue_number: integer(),
    pr_number: integer(),
    pr_url: text(),

    // Agent relationships
    parent_instance_id: text(),

    // Timestamps
    created_at: integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
    terminated_at: integer({ mode: "timestamp" }),
    last_activity: integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),

    // Configuration (deprecated system_prompt, replaced by prompt_used)
    system_prompt: text(), // Legacy field - kept for backwards compatibility
    prompt_used: text(), // Full prompt string sent to Claude
    prompt_context: text(), // JSON string of prompt data
    agent_number: integer().default(1).notNull(),
  },
  (table) => ({
    statusIdx: index("idx_instances_status").on(table.status),
    lastActivityIdx: index("idx_instances_last_activity").on(table.last_activity),
    issueNumberIdx: index("idx_instances_issue_number").on(table.issue_number),
    typeIdx: index("idx_instances_type").on(table.type),
  }),
);

// MCP Events table - tracks all MCP tool executions
export const mcpEventsTable = sqliteTable(
  "mcp_events",
  {
    id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    instance_id: text().notNull(),
    tool_name: text().notNull(),
    success: integer({ mode: "boolean" }).notNull(),
    error_message: text(),
    metadata: text({ mode: "json" }), // JSON type safety
    git_commit_hash: text(),
    status_change: text(),
    is_status_updating: integer({ mode: "boolean" }).default(false).notNull(),
    timestamp: integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  },
  (table) => ({
    instanceIdx: index("idx_mcp_events_instance_id").on(table.instance_id),
    timestampIdx: index("idx_mcp_events_timestamp").on(table.timestamp),
    toolNameIdx: index("idx_mcp_events_tool_name").on(table.tool_name),
    successIdx: index("idx_mcp_events_success").on(table.success),
  }),
);

// Instance Relationships table - tracks parent-child relationships
export const relationshipsTable = sqliteTable(
  "instance_relationships",
  {
    id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    parent_instance: text().notNull(),
    child_instance: text().notNull(),
    relationship_type: text({
      enum: ["spawned_review", "created_fork", "planning_to_issue"],
    }).notNull(),
    review_iteration: integer().default(1).notNull(),
    created_at: integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
    metadata: text({ mode: "json" }),
  },
  (table) => ({
    // Composite unique constraint
    uniqueRelationship: unique().on(
      table.parent_instance,
      table.child_instance,
      table.relationship_type,
    ),
    parentIdx: index("idx_relationships_parent").on(table.parent_instance),
    childIdx: index("idx_relationships_child").on(table.child_instance),
    typeIdx: index("idx_relationships_type").on(table.relationship_type),
  }),
);

// GitHub Issues table - cache for GitHub issue data
export const githubIssuesTable = sqliteTable(
  "github_issues",
  {
    number: integer().primaryKey(),
    title: text().notNull(),
    body: text(),
    state: text().notNull(),
    assignee: text(),
    labels: text({ mode: "json" }), // JSON array
    created_at: integer({ mode: "timestamp" }).notNull(),
    updated_at: integer({ mode: "timestamp" }).notNull(),
    synced_at: integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
    repo_owner: text().notNull(),
    repo_name: text().notNull(),
  },
  (table) => ({
    stateIdx: index("idx_github_issues_state").on(table.state),
    syncedAtIdx: index("idx_github_issues_synced_at").on(table.synced_at),
    repoIdx: index("idx_github_issues_repo").on(table.repo_owner, table.repo_name),
  }),
);

// User Config table - stores user configuration
export const userConfigTable = sqliteTable("user_config", {
  key: text().primaryKey(),
  value: text().notNull(),
  encrypted: integer({ mode: "boolean" }).default(false).notNull(),
  updated_at: integer({ mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

// Type-safe relations
export const instancesRelations = relations(instancesTable, ({ many, one }) => ({
  mcpEvents: many(mcpEventsTable),
  parentRelationships: many(relationshipsTable, {
    relationName: "parent",
  }),
  childRelationships: many(relationshipsTable, {
    relationName: "child",
  }),
  parentInstance: one(instancesTable, {
    fields: [instancesTable.parent_instance_id],
    references: [instancesTable.id],
    relationName: "parentChild",
  }),
  childInstances: many(instancesTable, {
    relationName: "parentChild",
  }),
}));

export const mcpEventsRelations = relations(mcpEventsTable, ({ one }) => ({
  instance: one(instancesTable, {
    fields: [mcpEventsTable.instance_id],
    references: [instancesTable.id],
  }),
}));

export const relationshipsRelations = relations(relationshipsTable, ({ one }) => ({
  parentInstance: one(instancesTable, {
    fields: [relationshipsTable.parent_instance],
    references: [instancesTable.id],
    relationName: "parent",
  }),
  childInstance: one(instancesTable, {
    fields: [relationshipsTable.child_instance],
    references: [instancesTable.id],
    relationName: "child",
  }),
}));

// Type exports for use in application
export type Instance = typeof instancesTable.$inferSelect;
export type NewInstance = typeof instancesTable.$inferInsert;
export type MCPEvent = typeof mcpEventsTable.$inferSelect;
export type NewMCPEvent = typeof mcpEventsTable.$inferInsert;
export type Relationship = typeof relationshipsTable.$inferSelect;
export type NewRelationship = typeof relationshipsTable.$inferInsert;
export type GitHubIssue = typeof githubIssuesTable.$inferSelect;
export type NewGitHubIssue = typeof githubIssuesTable.$inferInsert;
export type UserConfig = typeof userConfigTable.$inferSelect;
export type NewUserConfig = typeof userConfigTable.$inferInsert;

// Status types
export type InstanceStatus =
  | "started"
  | "waiting_review"
  | "pr_created"
  | "pr_merged"
  | "pr_closed"
  | "terminated";
export type InstanceType = "coding" | "review" | "planning";
export type RelationshipType = "spawned_review" | "created_fork" | "planning_to_issue";

// Filter types for queries
export interface InstanceFilter {
  types?: InstanceType[];
  statuses?: InstanceStatus[];
  issueNumber?: number;
  parentInstance?: string;
  limit?: number;
  offset?: number;
  orderBy?: "created_at" | "last_activity" | "terminated_at";
  orderDirection?: "ASC" | "DESC";
}

// Complete schema export
export const schema = {
  instancesTable,
  mcpEventsTable,
  relationshipsTable,
  githubIssuesTable,
  userConfigTable,
  instancesRelations,
  mcpEventsRelations,
  relationshipsRelations,
} as const;
