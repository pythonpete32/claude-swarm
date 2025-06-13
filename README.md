<div align="center">

# 🤖 Claude Swarm

**Orchestrate a swarm of AI agents to build quality software at scale.**

<video width="600" controls>
  <source src="banner.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>


[🚀 Getting Started](#getting-started) •
[📋 Commands](#commands) • 
[🔧 Scripts](#scripts) •
[🔄 Review Loop](#the-autonomous-review-loop) •
[🏗️ Project Structure](#project-structure)

</div>

## Purpose

This template enables **AI-native development** - running multiple Claude Code instances in parallel while maintaining code quality and architectural coherence. 

Traditional AI coding tools often produce **"AI slop"** - repetitive, inconsistent code that degrades with each generation. Claude Swarm prevents this through:

- **Structured planning** that maintains architectural vision
- **Isolated work environments** preventing context collision  
- **Quality gates** ensuring each piece meets standards
- **Intelligent orchestration** coordinating multiple agents

You're not just using AI to write code - you're **conducting a symphony** of specialized agents, each working on focused tasks within a coherent whole.

## Requirements

- **Claude Code** (`npm install -g @anthropic-ai/claude-code`)
- **GitHub CLI** (`brew install gh`) with **project scope**
- **tmux** (recommended for parallel sessions)
- **Git** with worktree support (Git 2.5+)

### Authentication Setup

**GitHub CLI requires special permissions** for project management:

```bash
# Initial authentication with project scope
gh auth login --scopes "project"

# Or refresh existing auth to add project scope
gh auth refresh -s project

# Verify you have the required permissions
gh auth status
```

⚠️ **Important**: The default `gh auth login` does **NOT** include the `project` scope needed for GitHub Projects automation. You must explicitly add it.

## Getting Started

[![Use this template](https://img.shields.io/badge/Use%20this%20template-2ea44f?style=for-the-badge)](https://github.com/pythonpete32/claude-swarm/generate)

1. Click **"Use this template"** button above
2. Name your new repository
3. Clone and set up authentication:
   ```bash
   git clone https://github.com/YOU/your-new-repo
   cd your-new-repo
   
   # Authenticate with GitHub CLI (with project scope)
   gh auth login --scopes "project"
   
   # Run setup script
   ./scripts/setup.sh
   ```

## Project Structure

```
my-project/
├── CLAUDE.md            # 🤖 AI context & project knowledge
├── .claude/              
│   └── commands/        # Custom slash commands
│       ├── create-plans.md
│       ├── create-task.md
│       ├── create-task-batch.md
│       └── work-on-task.md
│
├── planning/            # 📝 Design documents
│   ├── PRD.md          # Product requirements
│   ├── architecture.md # Technical design
│   ├── api-spec.yaml   # API contracts
│   └── issues/         # Generated task files
│
├── scripts/             # 🔧 Automation scripts
│   ├── setup.sh        # Initial project setup
│   ├── worktree-task.sh # Create worktree + tmux session
│   └── review-task.sh  # Autonomous code review
│
└── src/                # 💻 Your code
```

## Commands

Claude Swarm provides specialized commands for each phase of development:

| Command | Purpose | Usage |
|---------|---------|-------|
| `/project:create-plans` | Collaborative planning with AI | `create-plans $IDEA="build a task manager"` |
| `/project:create-task` | Create a single GitHub issue | `create-task $DESCRIPTION="add auth"` |
| `/project:create-task-batch` | Decompose plans into tasks | `create-task-batch` |
| `/project:work-on-task` | Implement a specific task | `work-on-task $ISSUE_NUMBER=123` |

### Workflow Example

```bash
# 1. Design your system
claude /project:create-plans $IDEA="SaaS metrics dashboard"

# 2. Decompose into tasks  
claude /project:create-task-batch

# 3. Start building in parallel
./scripts/worktree-task.sh feature-auth
claude /project:work-on-task $ISSUE_NUMBER=1
```

## Scripts

### `setup.sh`
Initializes your project with proper structure and GitHub configuration.

### `worktree-task.sh [branch-name]`
Creates an **isolated cognitive environment** for each AI agent:
```bash
./scripts/worktree-task.sh feature-payments
# Creates: worktrees/feature-payments/
# Launches: tmux session with Claude Code
```

### `review-task.sh [task-number]`
Implements **autonomous quality control**:
```bash
./scripts/review-task.sh 123
# Launches headless Claude to review changes
# Either approves → PR, or requests fixes → review doc
```

## The CLAUDE.md File

The `CLAUDE.md` file in your root directory serves as **persistent context** for all AI agents:

```markdown
# Project Context for Claude

## Tech Stack
- Node.js with TypeScript
- PostgreSQL database  
- REST API with Express

## Conventions
- Use functional components
- Prefer composition over inheritance
- All endpoints must have tests

## Architecture Decisions
- Modular monolith structure
- Repository pattern for data access
```

This ensures **consistency across all agents** - they all follow the same patterns and conventions.

## The Autonomous Review Loop

When an AI agent completes work, you run the `review-task.sh` script to automatically check the code quality:

```bash
# After AI completes work on a branch
./scripts/review-task.sh feature-auth

# The script either:
# ✅ Creates a PR if code passes review
# ❌ Generates feedback in planning/temp/review-feature-auth.md
```

The review script uses headless Claude Code to analyze the changes and decide if they're ready to merge. If there are issues, it generates specific feedback for the AI to address. If the code passes review, it automatically creates a pull request.

This prevents bad code from getting merged while allowing continuous improvement through iteration.

## Working with Multiple AI Instances

The **worktree + tmux** pattern enables true parallel development:

```bash
# Terminal 1: Authentication
./scripts/worktree-task.sh auth-system

# Terminal 2: Payment processing  
./scripts/worktree-task.sh payments

# Terminal 3: Admin dashboard
./scripts/worktree-task.sh admin-ui
```

Each agent works in **complete isolation**:
- Separate filesystem (git worktree)
- Separate branch (no conflicts)
- Separate context (no confusion)

## GitHub Projects Integration (Optional)

For teams wanting visual project management:

```bash
./scripts/setup.sh

# Creates a board with columns:
# PLANNING → READY → BUILDING → REVIEW → SHIPPED
```

This reflects the **cognitive handoffs** between human planning and AI execution.

## Contributing

Claude Swarm evolves through use. To contribute:

1. **Use the template** for a real project
2. **Document patterns** that work well
3. **Submit improvements** via PR
4. **Share your experience** in discussions

We're building the **future of software development** together.

## License

MIT - Because AI-augmented development should be accessible to all.

---

> **Remember**: You're the conductor, not the code monkey. Direct the swarm wisely.