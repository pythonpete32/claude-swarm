# System Integration

This diagram shows the complete Claude Swarm system and its integration with external services, tools, and file systems.

```mermaid
graph LR
    subgraph "User Interface"
        U1[CLI Commands]
        U2[Claude Slash Commands]
        U3[Direct API Usage]
    end
    
    subgraph "Claude Swarm System"
        subgraph "Entry Layer"
            E1[work-on-task.ts]
            E2[review-task.ts]
            E3[setup-project.ts]
            E4[cleanup-review.ts]
        end
        
        subgraph "Workflow Layer"
            W1[Work Workflow]
            W2[Review Workflow]
            W3[Setup Workflow]
            W4[Cleanup Workflow]
        end
        
        subgraph "Core Modules"
            C1[worktree]
            C2[github]
            C3[claude]
            C4[tmux]
            C5[git]
            C6[files]
        end
        
        subgraph "Shared Infrastructure"
            S1[types]
            S2[config]
            S3[errors]
            S4[validation]
            S5[logger]
        end
    end
    
    subgraph "External Systems"
        subgraph "GitHub Services"
            G1[GitHub REST API]
            G2[GitHub GraphQL API]
            G3[GitHub Projects v2]
        end
        
        subgraph "Local Tools"
            L1[git CLI]
            L2[tmux CLI]
            L3[Claude Code CLI]
        end
        
        subgraph "File System"
            F1[Git Repository]
            F2[Worktree Directories]
            F3[Claude Config Files]
        end
    end
    
    %% User interactions
    U1 --> E1
    U1 --> E2
    U1 --> E3
    U1 --> E4
    U2 --> E1
    U2 --> E2
    U3 --> W1
    U3 --> W2
    
    %% Entry to workflow
    E1 --> W1
    E2 --> W2
    E3 --> W3
    E4 --> W4
    
    %% Workflow to core modules
    W1 --> C1
    W1 --> C2
    W1 --> C3
    W1 --> C4
    W2 --> C1
    W2 --> C2
    W2 --> C3
    W3 --> C2
    W3 --> C6
    W4 --> C1
    W4 --> C6
    
    %% Core modules to shared infrastructure
    C1 --> S1
    C1 --> S3
    C2 --> S1
    C2 --> S2
    C2 --> S3
    C3 --> S2
    C3 --> S3
    C4 --> S3
    C5 --> S3
    C6 --> S3
    
    %% Core modules to external systems
    C2 --> G1
    C2 --> G2
    C2 --> G3
    C4 --> L2
    C3 --> L3
    C5 --> L1
    C1 --> L1
    C6 --> F1
    C6 --> F2
    C6 --> F3
    
    style U1 fill:#E3F2FD,stroke:#1976D2,stroke-width:2px
    style U2 fill:#E3F2FD,stroke:#1976D2,stroke-width:2px
    style U3 fill:#E3F2FD,stroke:#1976D2,stroke-width:2px
    
    style E1 fill:#F3E5F5,stroke:#7B1FA2,stroke-width:2px
    style E2 fill:#F3E5F5,stroke:#7B1FA2,stroke-width:2px
    style E3 fill:#F3E5F5,stroke:#7B1FA2,stroke-width:2px
    style E4 fill:#F3E5F5,stroke:#7B1FA2,stroke-width:2px
    
    style W1 fill:#E8F5E8,stroke:#388E3C,stroke-width:2px
    style W2 fill:#E8F5E8,stroke:#388E3C,stroke-width:2px
    style W3 fill:#E8F5E8,stroke:#388E3C,stroke-width:2px
    style W4 fill:#E8F5E8,stroke:#388E3C,stroke-width:2px
    
    style C1 fill:#FFF3E0,stroke:#F57C00,stroke-width:2px
    style C2 fill:#FFF3E0,stroke:#F57C00,stroke-width:2px
    style C3 fill:#FFF3E0,stroke:#F57C00,stroke-width:2px
    style C4 fill:#FFF3E0,stroke:#F57C00,stroke-width:2px
    style C5 fill:#FFF3E0,stroke:#F57C00,stroke-width:2px
    style C6 fill:#FFF3E0,stroke:#F57C00,stroke-width:2px
    
    style S1 fill:#FFEBEE,stroke:#C62828,stroke-width:2px
    style S2 fill:#FFEBEE,stroke:#C62828,stroke-width:2px
    style S3 fill:#FFEBEE,stroke:#C62828,stroke-width:2px
    style S4 fill:#FFEBEE,stroke:#C62828,stroke-width:2px
    style S5 fill:#FFEBEE,stroke:#C62828,stroke-width:2px
    
    style G1 fill:#FCE4EC,stroke:#C2185B,stroke-width:2px
    style G2 fill:#FCE4EC,stroke:#C2185B,stroke-width:2px
    style G3 fill:#FCE4EC,stroke:#C2185B,stroke-width:2px
    
    style L1 fill:#F1F8E9,stroke:#689F38,stroke-width:2px
    style L2 fill:#F1F8E9,stroke:#689F38,stroke-width:2px
    style L3 fill:#F1F8E9,stroke:#689F38,stroke-width:2px
    
    style F1 fill:#E0F2F1,stroke:#00796B,stroke-width:2px
    style F2 fill:#E0F2F1,stroke:#00796B,stroke-width:2px
    style F3 fill:#E0F2F1,stroke:#00796B,stroke-width:2px
```

## Integration Points

### User Interface Layer (Blue)
Multiple ways users can interact with the system:
- **CLI Commands**: Direct execution of workflow scripts via Bun
- **Claude Slash Commands**: Integration with Claude Code for seamless AI workflow
- **Direct API Usage**: Programmatic access for other tools and integrations

### System Architecture Flow
1. **Entry Layer** (Purple): Command scripts that parse arguments and invoke workflows
2. **Workflow Layer** (Green): Business logic orchestration of core modules
3. **Core Modules** (Orange): Specialized functionality for specific domains
4. **Shared Infrastructure** (Red): Common utilities and cross-cutting concerns

### External System Dependencies

#### GitHub Services (Pink)
- **REST API**: Issue management, repository operations, PR creation
- **GraphQL API**: Complex queries for project relationships and metadata
- **Projects v2**: Advanced project management and custom field handling

#### Local Tools (Light Green)
- **git CLI**: Repository operations, branch management, worktree creation
- **tmux CLI**: Terminal session management and process isolation
- **Claude Code CLI**: AI-powered development sessions

#### File System (Teal)
- **Git Repository**: Source code and version control
- **Worktree Directories**: Isolated development environments
- **Claude Config Files**: AI context and command configurations

## Key Integration Patterns

### Authentication & Authorization
- **GitHub Token**: Required for all GitHub API operations
- **Local Permissions**: File system access for worktree and config management
- **Tool Availability**: Runtime checks for required CLI tools

### Data Flow
- **Configuration Cascade**: User → Project → System → Defaults
- **Error Propagation**: Structured errors bubble up through layers
- **State Management**: Consistent state across worktrees and sessions

### Resource Management
- **Cleanup Patterns**: Automatic cleanup of temporary resources
- **Conflict Resolution**: Handle concurrent operations and resource conflicts
- **Health Monitoring**: Validate external dependencies and system state

## Deployment Considerations

### Prerequisites
- Node.js/Bun runtime environment
- Git CLI with repository access
- tmux for session management
- Claude Code CLI for AI integration
- GitHub token with appropriate permissions

### Installation Modes
- **Global Installation**: `bunx claude-swarm` for system-wide access
- **Project Installation**: Local installation in specific repositories
- **Development Mode**: Direct execution from source for development

### Configuration Management
- **Environment Variables**: Runtime configuration overrides
- **Config Files**: Persistent settings at user and project levels
- **Auto-Detection**: Intelligent defaults based on environment analysis 