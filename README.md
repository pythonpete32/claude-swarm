# Claude Codex

A modern TypeScript toolkit for automating git worktree workflows and task management.

## Quick Start

```bash
# Install dependencies
bun install

# Run development mode
bun run dev

# Build the project
bun run build

# Run tests
bun run test

# Lint and format code
bun run lint:fix

# Type check
bun run typecheck

# Generate documentation
bun run docs
```

## Development

This project uses:
- **Bun** - Fast JavaScript runtime and package manager
- **TypeScript** - Type-safe JavaScript
- **Biome** - Fast linter and formatter
- **Vitest** - Testing framework
- **Lefthook** - Git hooks management
- **TypeDoc** - API documentation generation

## Project Structure

```
src/
├── main.ts          # Application entry point
├── core/            # Core functionality modules
├── workflows/       # High-level workflow orchestration
├── shared/          # Shared utilities and types
└── commands/        # CLI command handlers
```