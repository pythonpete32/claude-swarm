-- Add prompt columns to instances table
-- Migration: 0002_add_prompt_columns.sql

ALTER TABLE instances ADD COLUMN prompt_used TEXT;
ALTER TABLE instances ADD COLUMN prompt_context TEXT; -- JSON string of PromptData