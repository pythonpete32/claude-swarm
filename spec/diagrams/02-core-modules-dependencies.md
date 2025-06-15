# Core Modules & Dependencies

This diagram shows the six core modules and their interdependencies, along with their relationships to shared infrastructure and external systems.

```mermaid
graph TD
    subgraph "Core Modules"
        W[worktree]
        G[github]
        C[claude]
        T[tmux]
        GT[git]
        F[files]
    end
    
    subgraph "Shared Infrastructure"
        TY[types]
        CF[config]
        V[validation]
        L[logger]
        E[errors]
    end
    
    subgraph "External Systems"
        GH[GitHub API]
        TM[tmux CLI]
        CC[Claude Code]
    end
    
    %% Dependencies between core modules
    W --> GT
    W --> F
    C --> T
    G --> TY
    
    %% All modules depend on shared infrastructure
    W --> TY
    W --> E
    G --> CF
    G --> E
    C --> CF
    C --> E
    T --> E
    GT --> E
    F --> E
    
    %% External integrations
    G --> GH
    T --> TM
    C --> CC
    
    style W fill:#4CAF50,stroke:#388E3C,stroke-width:2px,color:#fff
    style G fill:#2196F3,stroke:#1976D2,stroke-width:2px,color:#fff
    style C fill:#FF9800,stroke:#F57C00,stroke-width:2px,color:#fff
    style T fill:#9C27B0,stroke:#7B1FA2,stroke-width:2px,color:#fff
    style GT fill:#795548,stroke:#5D4037,stroke-width:2px,color:#fff
    style F fill:#607D8B,stroke:#455A64,stroke-width:2px,color:#fff
    
    style TY fill:#FFC107,stroke:#FF8F00,stroke-width:2px,color:#000
    style CF fill:#FFC107,stroke:#FF8F00,stroke-width:2px,color:#000
    style V fill:#FFC107,stroke:#FF8F00,stroke-width:2px,color:#000
    style L fill:#FFC107,stroke:#FF8F00,stroke-width:2px,color:#000
    style E fill:#FFC107,stroke:#FF8F00,stroke-width:2px,color:#000
    
    style GH fill:#E91E63,stroke:#C2185B,stroke-width:2px,color:#fff
    style TM fill:#E91E63,stroke:#C2185B,stroke-width:2px,color:#fff
    style CC fill:#E91E63,stroke:#C2185B,stroke-width:2px,color:#fff
```

## Module Dependencies

### Core Module Relationships
- **worktree** depends on **git** and **files** for repository operations and file management
- **claude** depends on **tmux** for session management
- **github** uses **types** for structured data handling

### Shared Infrastructure Usage
All core modules depend on:
- **types** - TypeScript interfaces and type definitions
- **errors** - Standardized error handling
- **config** - Configuration management (where applicable)

### External System Integration
- **github** → GitHub API (REST/GraphQL via Octokit)
- **tmux** → tmux CLI for terminal session management
- **claude** → Claude Code CLI for AI interactions

## Implementation Order

Based on dependencies, implement in this order:
1. **Shared Infrastructure** (types, errors, config, validation, logger)
2. **git** - Foundation for repository operations
3. **files** - File system utilities
4. **tmux** - Independent session management
5. **worktree** - Builds on git and files
6. **github** - External API integration
7. **claude** - Builds on tmux integration 