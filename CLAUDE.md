# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development & Building
bun dev                    # Start development server with source maps
bun build                  # Production build (minified)
bun build:dev             # Development build with source maps

# Code Quality
bun test                   # Run all tests with Vitest
bun test:watch            # Watch mode testing
bun typecheck             # TypeScript type checking
bun lint                  # ESLint code linting
bun lint:fix              # Auto-fix ESLint issues
bun format                # Check Prettier formatting
bun format:fix            # Auto-fix Prettier formatting
```

## Project Architecture

This is a terminal-based chat application built with React and Ink, designed as a foundation for multi-agent systems.

### Core Structure
- **src/cli.tsx** - CLI entry point with argument parsing
- **src/app.tsx** - Main React app with git detection and message routing
- **src/components/chat/** - Terminal UI components for chat interface
- **src/text-buffer.ts** - Unicode-aware text operations for terminal display
- **src/utils/terminal.ts** - Terminal management and cleanup utilities

### Key Patterns
- **Overlay System**: Modal overlays for help, history, and configuration (triggered by keyboard shortcuts)
- **Message Flow**: Echo-based message handling ready for API integration
- **Terminal State**: Custom hooks for responsive terminal sizing and cleanup
- **Slash Commands**: Built-in commands like `/help`, `/clear`, `/history`

### Build System
- **ESBuild** with custom configuration in `build.mjs`
- Development builds include inline source maps
- React DevTools stripped for ESM compatibility
- Uses Bun as primary package manager and runtime

### Testing
- **Vitest** with `ink-testing-library` for component testing
- Single-threaded execution to avoid pool recursion
- Comprehensive test coverage for UI components and utilities

### Type System
Core types in `src/types.ts`:
- `ChatMessage`: Message structure (id, content, role, timestamp)
- `ChatSession`: Session management
- `OverlayMode`: UI overlay states

## Git Conventions

This project uses **Conventional Commits** for commit messages. Follow the format:
```
type(scope): description

[optional body]

[optional footer(s)]
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`