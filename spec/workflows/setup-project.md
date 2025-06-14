# Workflow: Setup Project

← [Back to Index](../README.md) | [Previous: Review Task](./review-task.md) | [Next: Cleanup Worktree →](./cleanup-worktree.md)

## Purpose
Sets up the GitHub infrastructure backbone for claude-swarm development workflows. Orchestrates core modules to create GitHub projects, manage labels, validate authentication, and establish the foundation for all other workflows.

## Dependencies
- `core/github.ts` - GitHub API operations via Octokit
- `core/git.ts` - Git repository operations
- `core/files.ts` - File operations

## Function Signatures

### Setup Orchestration

#### runSetupWorkflow
```typescript
async function runSetupWorkflow(options?: SetupWorkflowOptions): Promise<SetupWorkflowResult>
```

**Parameters:**
```typescript
interface SetupWorkflowOptions {
  skipAuthentication?: boolean;    // Skip GitHub authentication check
  skipProjectCreation?: boolean;   // Skip project creation/linking  
  skipLabelCreation?: boolean;     // Skip label creation
  dryRun?: boolean;                // Show what would be done
}
```

**Returns:**
```typescript
interface SetupWorkflowResult {
  success: boolean;                // Overall setup success
  repositoryInfo: RepositoryInfo;  // Repository information from detectRepository
  projectInfo: GitHubProject;      // Created/found project information
  labelsCreated: GitHubLabel[];    // Labels that were created
  authenticationValid: boolean;    // GitHub authentication status
  projectURL: string;              // GitHub project URL
  nextSteps: string[];             // Recommended next actions
}
```

**Behavior:**
- Validates GitHub authentication using validateAuthentication
- Detects repository information using detectRepository  
- Creates or finds GitHub project using findOrCreateProject
- Creates standard claude-swarm labels using createLabels
- Links project to repository using linkProjectToRepository
- Provides setup completion status and next steps

**Error Conditions:**
- `GitHubError('AUTHENTICATION_FAILED')` - GitHub authentication invalid
- `GitError('NOT_GIT_REPOSITORY')` - Not running from git repository
- `GitHubError('PROJECT_CREATE_FAILED')` - Cannot create GitHub project
- `GitHubError('LABEL_CREATE_FAILED')` - Cannot create repository labels

---

### Validation Functions

#### validateSetupEnvironment
```typescript
async function validateSetupEnvironment(): Promise<SetupEnvironmentValidation>
```

**Returns:**
```typescript
interface SetupEnvironmentValidation {
  isValid: boolean;                // All requirements met
  gitRepository: boolean;          // Is git repository
  githubAuthentication: boolean;   // GitHub authentication valid
  repositoryDetectable: boolean;   // Repository info can be detected
  requiredScopes: string[];        // Required GitHub token scopes
  issues: ValidationIssue[];       // Any validation problems
}

interface ValidationIssue {
  component: string;               // What failed validation
  issue: string;                   // Description of the issue
  resolution: string;              // How to fix the issue
}
```

**Behavior:**
- Validates git repository using getRepositoryRoot
- Checks GitHub authentication using validateAuthentication
- Verifies repository can be detected using detectRepository
- Provides specific guidance for fixing validation issues

**Error Conditions:**
- `GitError('NOT_GIT_REPOSITORY')` - Not running from git repository
- `GitHubError('AUTHENTICATION_FAILED')` - GitHub authentication problems

---

### Project Management Functions  

#### ensureProjectExists
```typescript
async function ensureProjectExists(repositoryInfo: RepositoryInfo): Promise<GitHubProject>
```

**Parameters:**
- `repositoryInfo: RepositoryInfo` - Repository information from detectRepository

**Behavior:**
- Uses findOrCreateProject from core/github to get project
- Creates project with repository name if none exists
- Returns project information for further operations

**Error Conditions:**
- `GitHubError('PROJECT_CREATE_FAILED')` - Cannot create GitHub project
- `GitHubError('INVALID_REPOSITORY')` - Repository information invalid

---

#### setupStandardLabels
```typescript
async function setupStandardLabels(repositoryInfo: RepositoryInfo): Promise<GitHubLabel[]>
```

**Parameters:**
- `repositoryInfo: RepositoryInfo` - Repository information

**Returns:** Array of created/existing labels

**Behavior:**
- Uses createLabels from core/github with standard claude-swarm label set
- Creates labels: scripts, commands, testing, validation, user-experience, template, high-priority
- Skips labels that already exist
- Returns information about all processed labels

**Standard Label Set:**
- scripts (green) - Scripts and automation tools
- commands (blue) - Claude command development  
- testing (yellow) - Testing and validation
- validation (pink) - Validation and verification
- user-experience (light green) - User experience improvements
- template (purple) - Template and boilerplate code
- high-priority (red) - High priority tasks

**Error Conditions:**
- `GitHubError('LABEL_CREATE_FAILED')` - Cannot create repository labels

---

#### linkProjectToRepo
```typescript
async function linkProjectToRepo(projectInfo: GitHubProject, repositoryInfo: RepositoryInfo): Promise<void>
```

**Parameters:**
- `projectInfo: GitHubProject` - Project to link
- `repositoryInfo: RepositoryInfo` - Repository to link to

**Behavior:**
- Uses linkProjectToRepository from core/github
- Makes project visible in repository interface
- Enables project functionality for repository issues

**Error Conditions:**
- `GitHubError('PROJECT_LINK_FAILED')` - Cannot link project to repository

## Workflow Integration

### Command Line Interface

#### CLI Entry Point
```typescript
// .claude/workflows/setup-project.ts
async function main(args: string[]): Promise<void>
```

**Usage Examples:**
```bash
# Complete GitHub infrastructure setup
bun .claude/workflows/setup-project.ts

# Dry run to see what would be done
bun .claude/workflows/setup-project.ts --dry-run

# Skip environment validation
bun .claude/workflows/setup-project.ts --skip-environment-check

# Interactive mode with confirmations
bun .claude/workflows/setup-project.ts --interactive
```

**Command Line Options:**
```typescript
interface SetupProjectOptions {
  skipEnvironmentCheck?: boolean;  // Skip environment validation
  skipProjectCreation?: boolean;   // Skip project creation/linking
  skipLabelCreation?: boolean;     // Skip label creation
  interactive?: boolean;           // Prompt for confirmations
  dryRun?: boolean;                // Show what would be done
}
```

### Setup Process Overview

**What this workflow actually does:**
1. **Environment Validation**
   - Validates git repository
   - Checks GitHub CLI installation and authentication
   - Verifies required tools (jq)
   - Ensures proper GitHub scopes

2. **GitHub Project Setup**
   - Creates GitHub project with repository name
   - Links project to repository
   - Verifies project linking works

3. **Label Management**
   - Creates standard claude-swarm labels
   - Handles existing labels gracefully
   - Sets up issue organization system

4. **Verification and Reporting**
   - Verifies complete setup
   - Generates setup report
   - Provides next steps guidance

## Error Handling

### Common Error Scenarios

**Project Validation Errors:**
- Not a TypeScript project
- Missing package.json
- Not a git repository
- Insufficient permissions

**Installation Errors:**
- Dependency installation failures
- File creation permission errors
- Existing setup conflicts
- Network connectivity issues

**Configuration Errors:**
- Invalid configuration values
- Missing external dependencies
- GitHub authentication failures
- tmux not available

### Error Recovery Strategies

**Partial Installation Recovery:**
- Resume installation from last successful step
- Rollback partially completed installation
- Repair corrupted configuration files
- Re-validate and fix permissions

**Dependency Resolution:**
- Automatic retry with different package managers
- Fallback to manual dependency installation
- Alternative tool detection and configuration
- Graceful degradation for missing optional tools

## Testing Considerations

### Unit Tests
- Project type detection accuracy
- Configuration file generation
- Package.json script insertion
- Directory structure creation
- Permission validation

### Integration Tests
- Full installation workflow
- Package manager integration
- GitHub CLI integration
- tmux availability checking
- Configuration validation

### Test Scenarios
- Fresh TypeScript project setup
- Existing claude-swarm installation upgrade
- Projects with existing .claude/ directory
- Projects with permission restrictions
- Network connectivity issues during installation

## Configuration Options

### Installation Modes

**Minimal Installation:**
- Core workflows only
- No GitHub integration
- Default configuration

**Full Installation:**
- All available workflows
- GitHub integration enabled
- Custom configuration options
- Additional Claude commands

**Custom Installation:**
- User-selected workflows
- Configurable tool integration
- Project-specific settings
- Advanced configuration options

### Project Compatibility

**Supported Project Types:**
- Pure TypeScript projects
- Next.js applications
- Node.js libraries
- React applications
- Express servers
- Full-stack applications

**Requirements:**
- TypeScript configuration present
- Git repository initialized
- package.json with valid structure
- Write permissions in project directory