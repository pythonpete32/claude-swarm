# TypeScript Migration Guide

Complete architectural design and implementation guide for migrating bash scripts to TypeScript with Bun runtime.

## Table of Contents

### 📋 Planning & Architecture
- [**Architecture Overview**](./01-architecture-overview.md) - High-level system design and principles
- [**Core Modules Design**](./02-core-modules.md) - Building blocks and reusable operations
- [**Workflows Design**](./03-workflows.md) - Orchestration sequences and business processes
- [**Shared Infrastructure**](./04-shared-infrastructure.md) - Common utilities and types

### 🔧 Implementation Guides
- [**Core Module: Worktree**](./modules/core-worktree.md) - Git worktree management operations
- [**Core Module: tmux**](./modules/core-tmux.md) - Terminal session management
- [**Core Module: GitHub**](./modules/core-github.md) - GitHub API integration
- [**Core Module: Git**](./modules/core-git.md) - Git operations
- [**Core Module: Claude**](./modules/core-claude.md) - Claude Code integration
- [**Core Module: Files**](./modules/core-files.md) - File system operations

### 🚀 Workflow Implementations
- [**Workflow: Work on Task**](./workflows/work-on-task.md) - Development workflow implementation
- [**Workflow: Review Task**](./workflows/review-task.md) - Review workflow implementation
- [**Workflow: Setup Project**](./workflows/setup-project.md) - Project setup workflow

### 📚 Developer Resources
- [**Testing Strategy**](./05-testing-strategy.md) - Comprehensive testing approach
- [**Configuration Guide**](./06-configuration.md) - Configuration management
- [**Error Handling**](./07-error-handling.md) - Error types and handling patterns
- [**Library Export Guide**](./08-library-export.md) - How to package as a library

## Quick Start

1. **Start Here**: [Architecture Overview](./01-architecture-overview.md)
2. **Understand Core**: [Core Modules Design](./02-core-modules.md)
3. **See Workflows**: [Workflows Design](./03-workflows.md)
4. **Pick a Module**: Start with [Worktree Module](./modules/core-worktree.md)

## Implementation Order

### Phase 1: Core Infrastructure
1. [Shared Infrastructure](./04-shared-infrastructure.md) - Types, errors, config
2. [Core: Worktree](./modules/core-worktree.md) - Foundation for all workflows
3. [Core: Git](./modules/core-git.md) - Git operations
4. [Core: Files](./modules/core-files.md) - File system utilities

### Phase 2: External Integrations  
5. [Core: GitHub](./modules/core-github.md) - GitHub API integration
6. [Core: tmux](./modules/core-tmux.md) - Session management
7. [Core: Claude](./modules/core-claude.md) - Claude Code integration

### Phase 3: Workflow Orchestration
8. [Workflow: Work on Task](./workflows/work-on-task.md) - Development workflow
9. [Workflow: Review Task](./workflows/review-task.md) - Review workflow  
10. [Workflow: Setup Project](./workflows/setup-project.md) - Setup workflow

### Phase 4: Packaging & Distribution
11. [Testing Strategy](./05-testing-strategy.md) - Comprehensive testing
12. [Library Export](./08-library-export.md) - Package for distribution

## Goals

- **Complete Bash Replacement**: All existing functionality preserved
- **Improved Maintainability**: Clear separation of concerns
- **Enhanced Testability**: Comprehensive test coverage possible
- **Library Ready**: Easy installation in other projects
- **Cost Optimization**: Maintains interactive vs headless cost benefits

## Success Criteria

✅ **Functionality**: All bash script features work in TypeScript  
✅ **Performance**: Operations complete within acceptable timeframes  
✅ **Reliability**: Comprehensive error handling and recovery  
✅ **Usability**: Same or better developer experience  
✅ **Extensibility**: Easy to add new workflows and operations