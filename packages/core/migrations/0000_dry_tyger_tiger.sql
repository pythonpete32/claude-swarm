CREATE TABLE `github_issues` (
	`number` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`state` text NOT NULL,
	`assignee` text,
	`labels` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`synced_at` integer DEFAULT (unixepoch()) NOT NULL,
	`repo_owner` text NOT NULL,
	`repo_name` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_github_issues_state` ON `github_issues` (`state`);--> statement-breakpoint
CREATE INDEX `idx_github_issues_synced_at` ON `github_issues` (`synced_at`);--> statement-breakpoint
CREATE INDEX `idx_github_issues_repo` ON `github_issues` (`repo_owner`,`repo_name`);--> statement-breakpoint
CREATE TABLE `instances` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`worktree_path` text NOT NULL,
	`branch_name` text NOT NULL,
	`base_branch` text,
	`tmux_session` text NOT NULL,
	`claude_pid` integer,
	`issue_number` integer,
	`pr_number` integer,
	`pr_url` text,
	`parent_instance_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`terminated_at` integer,
	`last_activity` integer DEFAULT (unixepoch()) NOT NULL,
	`system_prompt` text,
	`agent_number` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_instances_status` ON `instances` (`status`);--> statement-breakpoint
CREATE INDEX `idx_instances_last_activity` ON `instances` (`last_activity`);--> statement-breakpoint
CREATE INDEX `idx_instances_issue_number` ON `instances` (`issue_number`);--> statement-breakpoint
CREATE INDEX `idx_instances_type` ON `instances` (`type`);--> statement-breakpoint
CREATE TABLE `mcp_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`instance_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`success` integer NOT NULL,
	`error_message` text,
	`metadata` text,
	`git_commit_hash` text,
	`status_change` text,
	`is_status_updating` integer DEFAULT false NOT NULL,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_mcp_events_instance_id` ON `mcp_events` (`instance_id`);--> statement-breakpoint
CREATE INDEX `idx_mcp_events_timestamp` ON `mcp_events` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_mcp_events_tool_name` ON `mcp_events` (`tool_name`);--> statement-breakpoint
CREATE INDEX `idx_mcp_events_success` ON `mcp_events` (`success`);--> statement-breakpoint
CREATE TABLE `instance_relationships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`parent_instance` text NOT NULL,
	`child_instance` text NOT NULL,
	`relationship_type` text NOT NULL,
	`review_iteration` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `idx_relationships_parent` ON `instance_relationships` (`parent_instance`);--> statement-breakpoint
CREATE INDEX `idx_relationships_child` ON `instance_relationships` (`child_instance`);--> statement-breakpoint
CREATE INDEX `idx_relationships_type` ON `instance_relationships` (`relationship_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `instance_relationships_parent_instance_child_instance_relationship_type_unique` ON `instance_relationships` (`parent_instance`,`child_instance`,`relationship_type`);--> statement-breakpoint
CREATE TABLE `user_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`encrypted` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
