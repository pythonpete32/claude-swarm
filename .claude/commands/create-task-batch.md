# Create Multiple Issues from Design Documents

Transform the planning documents into GitHub issues that Claude Code can implement.

## Your Task

Read all documents in the `planning/` directory and create a set of issues that can each be completed in a single Claude Code session.

## Step 1: Understand the System

Read and build a mental model from:
- `planning/PRD.md` - what we're building and why
- `planning/architecture.md` - how it's structured
- `planning/api-spec.yaml` - contracts and interfaces
- Any other planning documents

## Step 2: Create Issue Plan

Generate `planning/temp/issue-plan.md` that shows:

### Visual Map
Create a Mermaid diagram showing how the work breaks down:
- Group related issues into logical phases
- Show dependencies between issues
- Make it easy to see the build order

### Issue List
For each issue, provide:
- **Title**: Clear action, under 60 characters
- **Size**: Can Claude Code complete this in one session?
- **Dependencies**: What must be done first?
- **Description**: Enough context to start working

Remember: Each issue should be something Claude Code can **one-shot** - implement, test, and complete in a single session. Think in terms of:
- Single endpoints
- Individual components
- Specific features
- Isolated modules

## Step 3: Human Review

Show the plan and ask:
"Here's how I've broken down the work. Each issue is sized for a single Claude Code session. Does this look right?"

Make adjustments based on feedback.

## Step 4: Generate Issue Files

For each approved issue:
1. Read the create-issue command at `.claude/commands/create-issue.md`
2. Call it with:
   - `$MODE="batch"` 
   - `$OUTPUT_DIR=".claude/artifacts/issues/"`
   - The specific context for that issue

Each issue gets saved as a separate file in `.claude/artifacts/issues/`.

## Step 5: Create Summary

Generate `planning/temp/batch-summary.md`:
- List of all generated issue files
- Command to create them on GitHub
- Suggested work order based on dependencies

## Important Notes

- **Issue Sizing**: If something feels too big for one session, split it
- **Dependencies**: Be explicit about what blocks what
- **Context**: Each issue should be self-contained with enough context to start working
- **Reuse**: Use the existing create-issue command - don't duplicate its logic