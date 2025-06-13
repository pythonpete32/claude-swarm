# Decompose Planning Documents into Actionable Issues

Transform your planning artifacts into a comprehensive issue set. Initiated with: $DESIGN_PATH

## Phase 1: Document Ingestion & Analysis

### 1.1 Document Discovery
```bash
# Find all planning documents
find $DESIGN_PATH -name "*.md" -o -name "*.yaml" -o -name "*.json" | while read file; do
  echo "Found planning document: $file"
done

# Detect document types by content analysis
for doc in $DESIGN_PATH/*; do
  # Analyze headers, structure, keywords to categorize:
  # - PRD (contains user stories, requirements)
  # - Architecture (contains components, data flow)
  # - API Spec (contains endpoints, schemas)
  # - Database Design (contains tables, relationships)
done
```

### 1.2 Semantic Parsing & Knowledge Graph Construction

Build an internal representation of the entire system:

```javascript
const systemModel = {
  components: [],      // From architecture docs
  userStories: [],     // From PRD
  apiEndpoints: [],    // From API specs
  dataModels: [],      // From DB schemas
  dependencies: [],    // Inferred from all docs
  milestones: []       // From project planning
};
```

**Key Insight**: Don't just parse documents individually - build a **unified semantic model** that understands relationships across documents.

## Phase 2: Intelligent Decomposition

### 2.1 Work Breakdown Structure (WBS) Generation

Apply software engineering heuristics to decompose the design:

```markdown
FOR each major component in architecture:
  - Create "Implement [Component]" epic
  - For each interface of component:
    - Create "Define [Interface]" issue
    - Create "Implement [Interface]" issue
    - Create "Test [Interface]" issue
  
FOR each user story in PRD:
  - Map to implementing components
  - Create feature issue with acceptance criteria
  - Link to component implementation issues

FOR each API endpoint:
  - Create "Implement [Endpoint]" issue
  - Link to data model setup issues
  - Include contract testing requirements

FOR each database table:
  - Create "Design [Table] schema" issue
  - Create "Implement [Table] migrations" issue
  - Link to dependent API issues
```

### 2.2 Dependency Analysis & Ordering

**Critical Innovation**: Use topological sorting to determine optimal issue ordering:

```python
# Pseudo-code for dependency resolution
def analyze_dependencies(system_model):
    graph = build_dependency_graph(system_model)
    phases = topological_sort(graph)
    
    return {
        "phase_1": issues_with_no_dependencies,
        "phase_2": issues_depending_only_on_phase_1,
        # ... etc
    }
```

## Phase 3: Issue Generation Strategy

### 3.1 Issue Hierarchy Construction

```yaml
Epic: [Project Name] Implementation
├── Milestone: Foundation (Phase 1)
│   ├── Epic: Core Infrastructure
│   │   ├── Issue: Set up project structure
│   │   ├── Issue: Configure development environment
│   │   └── Issue: Implement logging framework
│   └── Epic: Data Layer
│       ├── Issue: Design database schema
│       └── Issue: Implement migration system
├── Milestone: Core Features (Phase 2)
│   ├── Epic: User Authentication
│   │   ├── Issue: Design auth architecture
│   │   ├── Issue: Implement user model
│   │   ├── Issue: Create auth endpoints
│   │   └── Issue: Add auth middleware
│   └── Epic: [Next Feature]
└── Milestone: Polish & Launch (Phase 3)
```

### 3.2 Smart Issue Sizing

Based on analysis of your repository's velocity:
```javascript
function determineIssueSize(workItem) {
  const historicalVelocity = analyzeCompletedIssues();
  
  if (workItem.estimatedHours > historicalVelocity.avgIssueSize * 2) {
    return splitIssue(workItem);
  }
  
  return workItem;
}
```

## Phase 4: Output Generation

### 4.1 Create Comprehensive Issue Plan

Generate `issue-plan.md` with:

```markdown
# Issue Decomposition Plan

Generated from: [list of input documents]
Total issues: [count]
Estimated timeline: [based on velocity]

## Validation Checklist
- [ ] All PRD requirements mapped to issues
- [ ] All API endpoints have implementation issues
- [ ] Database schema fully covered
- [ ] Test coverage issues included
- [ ] Documentation issues created

## Issue Hierarchy

[Visual tree representation]

## Detailed Issue List

### Phase 1: Foundation (Week 1-2)

#### ISSUE-001: Set up project structure
**Type**: Infrastructure
**Estimate**: 4 hours
**Dependencies**: None
**Description**: 
Create the initial project structure based on the folder structure defined in `planning/project-structure.md`

**Acceptance Criteria**:
- Given the project structure document
- When running the setup script
- Then all directories and base files are created

**Links to Design**: 
- `planning/project-structure.md#folder-layout`
- `planning/tech-stack.md#framework-choice`

[... continue for all issues ...]
```

### 4.2 Interactive Review

Before creating issues:
```
SUMMARY:
- Total issues to create: 47
- Broken into 3 milestones
- 8 epics identified
- Estimated 6-8 weeks total effort

WARNINGS:
- Large epic detected: "User Management" (15 issues) - consider splitting?
- Circular dependency found between Auth and User modules
- No issues created for monitoring/observability (intentional?)

Would you like to:
1. Review the full plan (opens in editor)
2. Adjust any specific issues
3. Proceed with batch creation
4. Generate visual dependency graph
```

## Phase 5: Batch Execution

### 5.1 Issue Creation with Progress Tracking

```bash
echo "Creating 47 issues..."
for issue in issue_list; do
  gh issue create \
    --title "$issue.title" \
    --body "$issue.body" \
    --label "$issue.labels" \
    --milestone "$issue.milestone"
  
  # Update references in related issues
  update_issue_references($issue.id)
  
  echo "Created issue #$issue.number: $issue.title"
done

# Create meta-issue with links to all created issues
create_tracking_issue(all_created_issues)
```

### 5.2 Post-Creation Actions

1. **Generate Project Board**:
   ```bash
   gh project create --title "[Project] Implementation Board"
   # Automatically populate with created issues
   ```

2. **Create Dependency Visualization**:
   Generate a Mermaid diagram showing issue relationships

3. **Set Up Automation**:
   Create GitHub Actions to update parent issues when children complete

## Advanced Features

### Design-to-Issue Traceability

**Innovation**: Maintain bidirectional links between design docs and issues:

```markdown
In your PRD:
<!-- issue-trace: #123, #124, #125 -->
### User Authentication
Users should be able to log in with email/password

In the generated issue:
**Source**: [PRD - User Authentication](../planning/PRD.md#user-authentication)
**Implements**: User Story US-001
```

### Living Documentation

The command also generates:
- `ISSUE_MAP.md`: Maps every requirement to its implementing issue(s)
- `DEPENDENCY_GRAPH.md`: Visual representation of issue relationships
- `PROGRESS_TRACKER.md`: Auto-updated as issues close

## Configuration & Customization

### Team-Specific Patterns

In CLAUDE.md:
```yaml
decomposition_rules:
  max_issue_size: 8_hours
  require_tests: true
  epic_threshold: 5_issues
  
  patterns:
    - if: "API endpoint"
      then: 
        - "Implementation issue"
        - "Test issue"
        - "Documentation issue"
    
    - if: "Database table"
      then:
        - "Schema design issue"
        - "Migration issue"
        - "Seed data issue"
```

## Error Handling & Recovery

If batch creation fails partway:
```bash
# The command maintains state
/project:decompose-design --resume-from="issue-plan.md.checkpoint"
```

## Usage Examples

### Standard Usage
```bash
/project:decompose-design planning/
```

### With Options
```bash
/project:decompose-design \
  $DESIGN_PATH="planning/" \
  $CREATE_MILESTONES=true \
  $AUTO_ASSIGN=true \
  $START_DATE="2025-07-01"
```

### Pipeline Mode
```bash
# Generate plan only
/project:decompose-design planning/ --plan-only

# Review and edit issue-plan.md

# Execute plan
/project:execute-issue-plan issue-plan.md
```