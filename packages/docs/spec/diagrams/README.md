# Claude Swarm Architectural Diagrams

This directory contains comprehensive architectural diagrams for the Claude Swarm system, created to visualize the system design and relationships between components.

## Diagram Overview

### [01. High-Level System Architecture](./01-high-level-architecture.md)
**Purpose**: Shows the layered architecture from user entry points to shared infrastructure  
**Key Insights**: 
- Clear separation of concerns across 4 main layers
- Command entry points trigger workflows that orchestrate core operations
- All components built on shared infrastructure foundation
- External integrations isolated through core modules

### [02. Core Modules & Dependencies](./02-core-modules-dependencies.md)
**Purpose**: Details the six core modules and their interdependencies  
**Key Insights**:
- Dependency hierarchy guides implementation order
- Shared infrastructure used by all modules
- Clear separation between internal dependencies and external integrations
- Modular design enables independent testing and development

### [03. Workflow Orchestration](./03-workflow-orchestration.md)
**Purpose**: Sequence diagram showing how workflows coordinate core modules  
**Key Insights**:
- Step-by-step orchestration of the "Work on Task" workflow
- Clear phases: validation → environment creation → session launch → user handoff
- Error handling and cleanup at each phase
- User experience flow from command to ready environment

### [04. Shared Infrastructure](./04-shared-infrastructure.md)
**Purpose**: Shows how shared infrastructure supports all core modules  
**Key Insights**:
- Type system ensures consistency across modules
- Hierarchical error handling with module-specific errors
- Configuration cascade from user to system defaults
- Cross-cutting concerns (validation, logging) used throughout

### [05. System Integration](./05-system-integration.md)
**Purpose**: Complete system view including all external dependencies  
**Key Insights**:
- Multiple user interface options (CLI, Claude, API)
- External system dependencies clearly identified
- Integration patterns for authentication, data flow, and resource management
- Deployment and configuration considerations

## Diagram Usage

### For Developers
- **Implementation Order**: Use dependency diagrams to plan development sequence
- **Module Boundaries**: Understand what each module is responsible for
- **Error Handling**: See how errors flow through the system
- **Testing Strategy**: Identify integration points that need testing

### For Architects
- **System Design**: Validate architectural decisions and patterns
- **Scalability**: Identify potential bottlenecks and scaling points
- **Maintainability**: Understand how changes propagate through the system
- **Integration**: Plan external system integrations and dependencies

### For Product Managers
- **User Flows**: Understand how users interact with the system
- **Feature Dependencies**: See how new features would fit into the architecture
- **External Dependencies**: Understand third-party service requirements
- **Deployment Requirements**: Plan infrastructure and tooling needs

## Diagram Formats

All diagrams are created using **Mermaid** syntax, which provides:
- **Version Control Friendly**: Text-based diagrams that diff well
- **Maintainable**: Easy to update as the system evolves
- **Portable**: Render in GitHub, documentation sites, and development tools
- **Accessible**: Clear visual representation with good contrast

## Keeping Diagrams Updated

These diagrams should be updated when:
- **New modules are added** → Update dependency and integration diagrams
- **Workflows change** → Update orchestration sequences
- **External integrations change** → Update system integration diagram
- **Shared infrastructure evolves** → Update infrastructure diagram
- **Architecture layers change** → Update high-level architecture

## Related Documentation

- [Architecture Overview](../01-architecture-overview.md) - Written specification
- [Core Modules](../02-core-modules.md) - Detailed module specifications
- [Workflows](../03-workflows.md) - Workflow implementation details
- [Shared Infrastructure](../04-shared-infrastructure.md) - Infrastructure specifications

---

*These diagrams complement the written specifications and provide visual clarity for system understanding and implementation planning.* 