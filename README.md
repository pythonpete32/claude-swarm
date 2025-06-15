# Claude Codex

A modern multi-agent development environment that helps you manage git worktrees, tmux sessions, and development workflows. Built with TypeScript and designed as a library-first toolkit.

## 🏗️ Monorepo Structure

```
claude-codex/
├── packages/
│   ├── core/           # @claude-codex/core - Core functionality library
│   ├── cli/            # @claude-codex/cli - Command-line interface
│   ├── ui/             # @claude-codex/ui - Web terminal interface
│   └── docs/           # @claude-codex/docs - Documentation site
└── scripts/            # Development and deployment scripts
```

## 🚀 Quick Start

### Development Setup

```bash
# Install dependencies for all packages
bun install

# Run all packages in development mode
bun run dev

# Build all packages
bun run build

# Run tests across all packages
bun run test:run

# Type check all packages
bun run typecheck

# Run quality checks (tests + typecheck + linting)
bun run quality
```

### Working with Individual Packages

```bash
# Work on core library
bun run --filter='@claude-codex/core' dev
bun run --filter='@claude-codex/core' test
bun run --filter='@claude-codex/core' build

# Work on CLI
bun run --filter='@claude-codex/cli' dev
bun run --filter='@claude-codex/cli' build

# Work on UI
bun run --filter='@claude-codex/ui' dev
bun run --filter='@claude-codex/ui' build

# Work on docs
bun run --filter='@claude-codex/docs' dev
```

## 📦 Packages

### @claude-codex/core

The heart of Claude Codex - a TypeScript library providing:

- **Git Worktree Management**: Create and manage isolated development environments
- **Tmux Integration**: Handle terminal sessions and automation
- **GitHub Integration**: Connect with GitHub issues and repositories
- **File Operations**: Project structure validation and management
- **Claude Integration**: AI-assisted development workflows

**Architecture**: 4-layer design following `commands/ → workflows/ → core/ → shared/`

### @claude-codex/cli

Command-line interface consuming the core library.

```bash
# Install globally (when published)
npm install -g @claude-codex/cli

# Use locally
bun run --filter='@claude-codex/cli' dev
```

### @claude-codex/ui

Modern web-based terminal interface built with:
- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui components
- Real-time terminal emulation via xterm.js

### @claude-codex/docs

Documentation site built with [Vocs](https://vocs.dev/) - a minimal React-based documentation framework.

## 🛠️ Development

### Tech Stack

- **Runtime**: Bun - Fast JavaScript runtime and package manager
- **Language**: TypeScript - Type-safe JavaScript with strict configuration
- **Linting**: 
  - Core package: Biome (fast, modern linting and formatting)
  - UI package: ESLint (React-specific rules and validation)
- **Testing**: Vitest - Fast testing framework with 421 passing tests
- **Git Hooks**: Lefthook - Manages pre-commit and pre-push validation
- **Build**: TypeScript compiler with declaration generation
- **Documentation**: Vocs + TypeDoc for comprehensive API docs

### Package Scripts

Each package has standardized scripts:

```bash
# Development
dev          # Start development mode with hot reload
build        # Build for production with type declarations
test         # Run tests in watch mode
test:run     # Run tests once and exit
typecheck    # Type checking without emit
lint         # Check code style and issues
lint:fix     # Auto-fix linting issues
```

### Git Workflow

We use [Lefthook](https://github.com/evilmartians/lefthook) for git hooks:

- **Pre-commit**: Runs linting and formatting on staged files
- **Pre-push**: Runs tests and builds to ensure quality
- **Commit message**: Basic validation

```bash
# Setup git hooks
bun run setup
```

### Code Quality

The project maintains high code quality standards:

- **421 passing tests** across unit, integration, and e2e test suites
- **100% TypeScript** with strict configuration and no `any` types
- **Comprehensive linting** with both Biome and ESLint where appropriate
- **4-layer architecture** enforcing separation of concerns
- **Library-first design** for maximum reusability

### Testing Strategy

```
tests/
├── unit/          # 60% - Isolated module testing  
├── integration/   # 30% - Module interaction testing
├── e2e/           # 10% - End-to-end workflow testing
├── fixtures/      # Test data and mock repositories
└── helpers/       # Test utilities and mocks
```

Run specific test suites:

```bash
# Core library tests (421 tests)
bun run --filter='@claude-codex/core' test:run

# Watch mode for development
bun run --filter='@claude-codex/core' test
```

## 🚢 Publishing

The packages are designed for publishing to both NPM and JSR:

- `@claude-codex/core` - Core library for integration
- `@claude-codex/cli` - Command-line tool for end users

## 📚 Documentation

- **API Documentation**: Generated with TypeDoc from source code
- **User Guide**: Available in the docs package
- **Development Guide**: This README and CLAUDE.md files

Start the documentation site:

```bash
bun run docs
```

## 🤝 Contributing

1. **Setup**: `bun install && bun run setup`
2. **Development**: `bun run dev` 
3. **Testing**: `bun run test:run`
4. **Quality**: `bun run quality`
5. **Commit**: Git hooks will validate your changes

## 📄 License

[MIT License](LICENSE) - See LICENSE file for details.

---

**Built with ❤️ using modern TypeScript tooling and designed for the future of AI-assisted development.**