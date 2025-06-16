# Claude Codex

AI-powered development workflows with intelligent agent orchestration.

## Quick Start

```bash
# Install dependencies
bun install

# Run all tests
bun run test:all

# Run quality checks (tests + typecheck + lint)
bun run quality

# Build all packages
bun run build
```

## Testing

### Available Test Commands

```bash
# Run all available tests across packages
bun run test:all         # Fast - runs only core tests (524 tests)
bun run test:summary     # Detailed - shows test coverage per package
bun run test:verbose     # Full - attempts to run tests in all packages

# Run specific test suites
bun run test:core        # Core package only (524 tests)

# Quality gates
bun run quality          # Tests + typecheck + lint
bun run ci               # Same as quality (for CI/CD)
```

### Test Coverage

- **Core Package**: 524 tests ✅ (Unit + Integration)
  - Database operations with real SQLite
  - Git operations with real repositories  
  - TMUX session management
  - GitHub API integration
  - File system operations
  
- **Workflows Package**: No tests yet ⏳
- **MCP Packages**: No tests yet ⏳

## Architecture

```
┌─────────────────┐    launches    ┌─────────────────┐
│ CodingWorkflow  │ ──────────────▶│ MCP-Coding      │
│                 │                │ Server          │
└─────────────────┘                └─────────────────┘
         │                                   │
         │ spawns                           │ tools:
         ▼                                   │ • request_review
┌─────────────────┐    launches    ┌─────────────────┐
│ ReviewWorkflow  │ ──────────────▶│ MCP-Review      │
│                 │                │ Server          │
└─────────────────┘                └─────────────────┘
         │                                   │
         │ saves review &                   │ tools:
         │ injects TMUX                     │ • save_review
         ▼                                   │ • create_pr
┌─────────────────┐                ┌─────────────────┐
│ Database +      │◀──────────────▶│ Claude Code     │
│ TMUX Sessions   │                │ (with MCP)      │
└─────────────────┘                └─────────────────┘
```

## Development

```bash
# Development with watch mode
bun run dev

# Type checking
bun run typecheck

# Linting
bun run lint:fix
```
