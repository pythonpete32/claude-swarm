# TypeScript Migration Guide

Complete architectural design and implementation guide for migrating bash scripts to TypeScript with Bun runtime.

:::warning[⚠️ Documentation Status]
**Important:** Large portions of workflow documentation are currently deprecated due to architecture changes. The project has moved from CLI workflows to MCP-based agent orchestration. 

- ❌ **Deprecated**: Old CLI workflow concepts and bash script replacements
- ✅ **Current**: Three-agent system (Planning, Coding, Review) via [Workflows Orchestration](./09-workflows-orchestration.md)
- 🚧 **Cleanup Needed**: Navigation links and cross-references throughout these docs need updating

This cleanup will be addressed after core implementation is complete.
:::

## Table of Contents

### 📋 Planning & Architecture
- [**Architecture Overview**](./01-architecture-overview.md) - High-level system design and principles
- [**Core Modules Design**](./02-core-modules.md) - Building blocks and reusable operations
- [**Workflows Orchestration**](./09-workflows-orchestration.md) - Agent lifecycle management for three-agent system
- [**Shared Infrastructure**](./04-shared-infrastructure.md) - Common utilities and types

### 🔧 Implementation Guides
- [**Core Module: Worktree**](./modules/core-worktree.md) - Git worktree management operations
- [**Core Module: tmux**](./modules/core-tmux.md) - Terminal session management
- [**Core Module: GitHub**](./modules/core-github.md) - GitHub API integration
- [**Core Module: Git**](./modules/core-git.md) - Git operations
- [**Core Module: Claude**](./modules/core-claude.md) - Claude Code integration
- [**Core Module: Files**](./modules/core-files.md) - File system operations

### 🚀 Agent Orchestration
- [**Workflows Orchestration**](./09-workflows-orchestration.md) - Agent lifecycle management for Planning, Coding, and Review agents

### 📚 Developer Resources
- [**Testing Strategy**](./05-testing-strategy.md) - Comprehensive testing approach
- [**Configuration Guide**](./06-configuration.md) - Configuration management
- [**Error Handling**](./07-error-handling.md) - Error types and handling patterns
- [**Library Export Guide**](./08-library-export.md) - How to package as a library

## Quick Start

1. **Start Here**: [Architecture Overview](./01-architecture-overview.md)
2. **Understand Core**: [Core Modules Design](./02-core-modules.md)
3. **See Workflows**: [Workflows Orchestration](./09-workflows-orchestration.md)
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

### Phase 3: Agent Orchestration
8. [Workflows Orchestration](./09-workflows-orchestration.md) - Three-agent lifecycle management

### Phase 4: Packaging & Distribution
9. [Testing Strategy](./05-testing-strategy.md) - Comprehensive testing
10. [Library Export](./08-library-export.md) - Package for distribution

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