# Workflow: Setup Project

← [Back to Index](../README.md) | [Previous: Review Task](./review-task.md) | [Next: Cleanup Review →](./cleanup-review.md)

## Purpose
Installs claude-swarm TypeScript workflows into an existing TypeScript project, configuring package.json scripts, directory structure, and Claude Code integration. Creates the foundation for AI-assisted development workflows.

## Dependencies
- `core/github.ts` - Repository detection and project integration
- `core/git.ts` - Repository validation and configuration
- `core/files.ts` - Directory creation and file management
- `shared/config.ts` - Configuration management
- Node.js `fs/promises` - File system operations
- Node.js `path` - Path manipulation

## Function Signatures

### Project Detection and Validation

#### detectProjectType
```typescript
async function detectProjectType(projectPath: string): Promise<ProjectTypeInfo>
```

**Parameters:**
- `projectPath: string` - Path to target project directory

**Returns:**
```typescript
interface ProjectTypeInfo {
  isTypeScript: boolean;           // Has TypeScript configuration
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun'; // Detected package manager
  hasPackageJson: boolean;         // Has package.json file
  hasGitRepo: boolean;             // Is git repository
  hasClaudeSetup: boolean;         // Already has .claude/ directory
  projectName: string;             // Project name from package.json
  compatibilityLevel: 'full' | 'partial' | 'none'; // Setup compatibility
}
```

**Behavior:**
- Scans project directory for TypeScript configuration files
- Detects package manager from lockfiles and configuration
- Validates git repository presence and status
- Checks for existing Claude Code setup
- Determines compatibility for claude-swarm installation

**Error Conditions:**
- `FileError('PROJECT_NOT_FOUND')` - Target directory doesn't exist
- `FileError('INVALID_PROJECT')` - Not a valid TypeScript project
- `GitError('NOT_GIT_REPO')` - Directory is not a git repository

---

#### validateProjectSetup
```typescript
async function validateProjectSetup(projectInfo: ProjectTypeInfo): Promise<SetupValidation>
```

**Parameters:**
- `projectInfo: ProjectTypeInfo` - Project detection results

**Returns:**
```typescript
interface SetupValidation {
  canInstall: boolean;             // Whether installation can proceed
  requirements: SetupRequirement[]; // Missing requirements
  warnings: SetupWarning[];       // Non-blocking issues
  recommendedActions: string[];    // Suggested pre-setup steps
}

interface SetupRequirement {
  type: 'typescript' | 'git' | 'packagejson' | 'permissions';
  description: string;             // Human-readable requirement
  fixCommand?: string;             // Command to resolve requirement
  critical: boolean;               // Blocks installation if missing
}

interface SetupWarning {
  type: 'existing_setup' | 'git_dirty' | 'deps_outdated';
  message: string;                 // Warning description
  canContinue: boolean;            // Whether setup can continue
  recommendation?: string;         // How to resolve warning
}
```

**Behavior:**
- Validates all prerequisites for claude-swarm installation
- Identifies blocking requirements vs. warnings
- Provides actionable fix commands for requirements
- Checks for conflicts with existing setup

**Error Conditions:**
- `ValidationError('REQUIREMENTS_NOT_MET')` - Critical requirements missing
- `ValidationError('EXISTING_SETUP_CONFLICT')` - Conflicting configuration exists

---

### Installation and Configuration

#### installClaudeSwarm
```typescript
async function installClaudeSwarm(options: InstallOptions): Promise<InstallResult>
```

**Parameters:**
```typescript
interface InstallOptions {
  projectPath: string;             // Target project directory
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun'; // Package manager to use
  includeWorkflows: string[];      // Workflows to install ('work-on-task', 'review-task', etc.)
  overwriteExisting: boolean;      // Replace existing files
  skipDependencies: boolean;       // Skip npm package installation
  gitignoreEntries?: string[];     // Additional .gitignore entries
}
```

**Returns:**
```typescript
interface InstallResult {
  success: boolean;                // Installation succeeded
  filesCreated: string[];          // Paths of created files
  scriptsAdded: string[];          // Package.json scripts added
  dependenciesInstalled: string[]; // NPM packages installed
  configurationPath: string;       // Path to configuration file
  nextSteps: string[];             // Recommended next actions
  errors: InstallError[];          // Any non-fatal errors
}

interface InstallError {
  file: string;                    // Affected file path
  error: string;                   // Error description
  fatal: boolean;                  // Whether error blocks usage
}
```

**Behavior:**
- Creates `.claude/workflows/` directory structure
- Installs TypeScript workflow files
- Updates package.json with workflow scripts
- Installs required npm dependencies
- Creates initial configuration files
- Updates .gitignore with appropriate entries

**Error Conditions:**
- `FileError('PERMISSION_DENIED')` - No write access to project
- `FileError('DISK_FULL')` - Insufficient disk space
- `PackageError('INSTALL_FAILED')` - NPM installation failed
- `GitError('GITIGNORE_UPDATE_FAILED')` - Cannot update .gitignore

---

#### setupPackageScripts
```typescript
async function setupPackageScripts(options: ScriptSetupOptions): Promise<ScriptSetupResult>
```

**Parameters:**
```typescript
interface ScriptSetupOptions {
  packageJsonPath: string;         // Path to package.json
  workflows: string[];             // Workflow names to create scripts for
  scriptPrefix: string;            // Prefix for script names (default: 'claude:')
  overwriteExisting: boolean;      // Replace existing scripts
}
```

**Returns:**
```typescript
interface ScriptSetupResult {
  scriptsAdded: ScriptEntry[];     // Scripts successfully added
  scriptsSkipped: ScriptEntry[];   // Scripts that already existed
  packageJsonBackup: string;       // Path to backup file
  totalScripts: number;            // Total scripts now in package.json
}

interface ScriptEntry {
  name: string;                    // Script name (e.g., 'claude:work-on-task')
  command: string;                 // Script command
  description: string;             // Human-readable description
}
```

**Behavior:**
- Reads and parses existing package.json
- Creates backup of original package.json
- Adds claude-swarm workflow scripts with consistent naming
- Preserves existing scripts unless overwrite specified
- Validates script commands for correctness

**Error Conditions:**
- `FileError('PACKAGEJSON_NOT_FOUND')` - package.json missing
- `FileError('PACKAGEJSON_INVALID')` - Malformed package.json
- `FileError('BACKUP_FAILED')` - Cannot create backup file

---

### Directory Structure Creation

#### createWorkflowStructure
```typescript
async function createWorkflowStructure(projectPath: string, options: StructureOptions): Promise<StructureResult>
```

**Parameters:**
```typescript
interface StructureOptions {
  workflowsToInclude: string[];    // Specific workflows to install
  createTempDirectories: boolean;   // Create planning/temp/ structure
  setupGitignore: boolean;         // Update .gitignore automatically
  preserveExisting: boolean;       // Don't overwrite existing files
}
```

**Returns:**
```typescript
interface StructureResult {
  directoriesCreated: string[];    // Paths of created directories
  filesCreated: string[];          // Paths of created files
  gitignoreUpdated: boolean;       // Whether .gitignore was modified
  structureComplete: boolean;      // All required structure created
  permissions: DirectoryPermissions; // Directory permission status
}

interface DirectoryPermissions {
  readable: boolean;               // Directories are readable
  writable: boolean;               // Directories are writable
  executable: boolean;             // Directories are executable
  issues: string[];                // Any permission issues found
}
```

**Behavior:**
- Creates `.claude/workflows/` directory
- Installs workflow TypeScript files
- Creates `planning/temp/` directory structure
- Sets appropriate directory permissions
- Creates initial configuration files

**Expected Directory Structure:**
```
project-root/
├── .claude/
│   ├── workflows/
│   │   ├── work-on-task.ts
│   │   ├── review-task.ts
│   │   ├── setup-project.ts
│   │   └── cleanup-review.ts
│   └── settings.local.json
├── planning/
│   └── temp/
│       ├── work-reports/
│       └── feedback/
└── package.json (updated)
```

**Error Conditions:**
- `FileError('DIRECTORY_CREATE_FAILED')` - Cannot create required directories
- `FileError('PERMISSION_DENIED')` - Insufficient permissions
- `GitError('GITIGNORE_INVALID')` - Cannot parse .gitignore file

---

### Configuration Management

#### createConfiguration
```typescript
async function createConfiguration(options: ConfigurationOptions): Promise<ConfigurationResult>
```

**Parameters:**
```typescript
interface ConfigurationOptions {
  projectPath: string;             // Target project path
  githubIntegration: boolean;      // Enable GitHub features
  defaultModel?: string;           // Default Claude model
  workflowDefaults: WorkflowDefaults; // Default workflow settings
  customCommands?: string[];       // Additional Claude commands to install
}

interface WorkflowDefaults {
  worktreeBasePath: string;        // Base path for worktrees (default: '../')
  defaultBranch: string;           // Default base branch (default: 'main')
  agentNaming: 'simple' | 'timestamped'; // Worktree naming strategy
  cleanupPolicy: 'manual' | 'automatic'; // Cleanup behavior
}
```

**Returns:**
```typescript
interface ConfigurationResult {
  configPath: string;              // Path to created config file
  settingsCreated: boolean;        // Settings file created successfully
  commandsInstalled: string[];     // Claude commands installed
  integrationStatus: IntegrationStatus; // External integration status
}

interface IntegrationStatus {
  github: boolean;                 // GitHub CLI available and authenticated
  tmux: boolean;                   // tmux available
  claude: boolean;                 // Claude CLI available
  missingDependencies: string[];   // Commands/tools not found
}
```

**Behavior:**
- Creates initial claude-swarm configuration
- Validates external tool availability
- Sets up GitHub integration if requested
- Creates Claude command files
- Establishes default workflow settings

**Error Conditions:**
- `ConfigError('INVALID_SETTINGS')` - Configuration values invalid
- `ConfigError('DEPENDENCY_MISSING')` - Required external tool missing
- `FileError('CONFIG_WRITE_FAILED')` - Cannot write configuration file

---

### Post-Installation Setup

#### verifyInstallation
```typescript
async function verifyInstallation(projectPath: string): Promise<VerificationResult>
```

**Parameters:**
- `projectPath: string` - Path to installed project

**Returns:**
```typescript
interface VerificationResult {
  installationValid: boolean;      // Installation appears correct
  workflowsAccessible: string[];   // Workflows that can be executed
  dependenciesResolved: boolean;   // All dependencies installed
  configurationValid: boolean;     // Configuration file is valid
  issues: VerificationIssue[];     // Any problems found
  recommendedNextSteps: string[];  // What user should do next
}

interface VerificationIssue {
  severity: 'error' | 'warning' | 'info';
  component: string;               // Affected component
  description: string;             // Issue description
  resolution?: string;             // How to fix the issue
}
```

**Behavior:**
- Tests that workflows can be executed
- Validates configuration file syntax
- Checks npm dependencies are installed
- Verifies external tool availability
- Provides guidance for any issues found

**Error Conditions:**
- `VerificationError('INSTALLATION_CORRUPT')` - Installation appears broken
- `VerificationError('DEPENDENCIES_MISSING')` - Required packages not installed

---

#### generateSetupReport
```typescript
async function generateSetupReport(installResult: InstallResult, verificationResult: VerificationResult): Promise<string>
```

**Parameters:**
- `installResult: InstallResult` - Results from installation process
- `verificationResult: VerificationResult` - Results from verification

**Returns:** Formatted setup report as markdown string

**Behavior:**
- Creates comprehensive installation summary
- Lists all files and scripts created
- Provides usage instructions for workflows
- Includes troubleshooting information
- Documents next steps for getting started

**Report Template:**
```markdown
# Claude Swarm Setup Complete

## Installation Summary
- ✅ Workflows installed: work-on-task, review-task
- ✅ Package scripts added: claude:work-on-task, claude:review-task
- ✅ Dependencies installed: 5 packages
- ✅ Configuration created: .claude/settings.local.json

## Getting Started
1. Start working on an issue: `npm run claude:work-on-task 123`
2. Review completed work: `npm run claude:review-task 123`
3. Check configuration: `.claude/settings.local.json`

## Troubleshooting
- GitHub integration: Run `gh auth login` if needed
- tmux sessions: Use `tmux list-sessions` to see active work
```

**Error Conditions:**
- `ReportError('GENERATION_FAILED')` - Cannot generate report

---

## Workflow Integration

### Command Line Interface

#### CLI Entry Point
```typescript
// .claude/workflows/setup-project.ts
async function main(args: string[]): Promise<void>
```

**Usage Examples:**
```bash
# Basic setup
bun .claude/workflows/setup-project.ts

# Setup with specific workflows
bun .claude/workflows/setup-project.ts --workflows work-on-task,review-task

# Setup with GitHub integration
bun .claude/workflows/setup-project.ts --github

# Force overwrite existing setup
bun .claude/workflows/setup-project.ts --force
```

**Command Line Options:**
```typescript
interface SetupProjectOptions {
  workflows?: string[];            // Workflows to install
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun';
  github?: boolean;                // Enable GitHub integration
  force?: boolean;                 // Overwrite existing files
  interactive?: boolean;           // Prompt for configuration
  dryRun?: boolean;                // Show what would be done
}
```

### Integration with Package Managers

**NPM Integration:**
```bash
# After setup, these commands become available:
npm run claude:work-on-task 123
npm run claude:review-task 123
npm run claude:setup-project
npm run claude:cleanup-review
```

**Configuration in package.json:**
```json
{
  "scripts": {
    "claude:work-on-task": "bun .claude/workflows/work-on-task.ts",
    "claude:review-task": "bun .claude/workflows/review-task.ts",
    "claude:setup-project": "bun .claude/workflows/setup-project.ts",
    "claude:cleanup-review": "bun .claude/workflows/cleanup-review.ts"
  },
  "devDependencies": {
    "claude-swarm": "^1.0.0"
  }
}
```

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