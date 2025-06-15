# High-Level System Architecture

This diagram shows the layered architecture of the Claude Swarm system, from user entry points down to shared infrastructure.

```mermaid
graph TD
    A["Command Entry Points<br/>(CLI, Slash Commands)"] --> B["Workflows<br/>(Orchestration Layer)"]
    B --> C["Core Operations<br/>• worktree<br/>• github<br/>• claude<br/>• tmux<br/>• git<br/>• files"]
    C --> D["Shared Infrastructure<br/>• types<br/>• config<br/>• validation<br/>• logger<br/>• errors"]
    C --> E["External Integrations<br/>• GitHub API<br/>• tmux<br/>• Claude Code"]
    
    style A fill:#2196F3,stroke:#1976D2,stroke-width:2px,color:#fff
    style B fill:#9C27B0,stroke:#7B1FA2,stroke-width:2px,color:#fff
    style C fill:#4CAF50,stroke:#388E3C,stroke-width:2px,color:#fff
    style D fill:#FF9800,stroke:#F57C00,stroke-width:2px,color:#fff
    style E fill:#E91E63,stroke:#C2185B,stroke-width:2px,color:#fff
```

## Architecture Flow

1. **Command Entry Points** - Users interact via CLI commands or Claude slash commands
2. **Workflows** - Orchestrate multiple core operations to complete business processes
3. **Core Operations** - Six specialized modules that handle specific domains
4. **Shared Infrastructure** - Common utilities and types used by all modules
5. **External Integrations** - Third-party systems that core modules connect to

## Key Design Principles

- **Layered Architecture**: Clear separation of concerns across layers
- **Dependency Flow**: Higher layers depend on lower layers, not vice versa
- **Shared Foundation**: All modules built on common infrastructure
- **External Isolation**: External integrations accessed only through core modules 