# Core Module: Claude

← [Back to Index](../README.md) | [Previous: Git Module](./core-git.md) | [Next: Files Module →](./core-files.md)

## Purpose
Provides Claude Code integration for launching interactive sessions, generating context-aware prompts, and managing Claude Code processes within tmux sessions. Central to the workflow orchestration system.

## Dependencies
- `shared/types.ts` - ClaudeSession, ClaudeValidation, RepositoryInfo, GitBranchInfo interfaces
- `shared/errors.ts` - ClaudeError class and error codes
- `shared/config.ts` - ClaudeConfig for default behavior
- `core/tmux.ts` - TmuxSession management for Claude processes
- Node.js `child_process` - For Claude CLI execution

## External Documentation References
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Claude Code CLI Usage](https://docs.anthropic.com/en/docs/claude-code/cli-usage)
- [Claude Code Settings](https://docs.anthropic.com/en/docs/claude-code/settings)

## Function Signatures

### Claude CLI Operations

#### validateClaudeAvailable
```typescript
async function validateClaudeAvailable(): Promise<ClaudeValidation>
```

**Returns:**
```typescript
// Uses shared ClaudeValidation interface from shared/types.ts
// Extends ValidationResult with Claude-specific fields:
// - version?: string
// - isAuthenticated?: boolean
// - hasRequiredPermissions: boolean
// See shared/types.ts for complete interface definition
```

**Behavior:**
- Checks if `claude` command is available in PATH using `which claude`
- Attempts to get version using `claude update` (shows current version)
- Locates `.claude` directory in user home or current project
- Does NOT check authentication (no direct CLI command for this)
- Returns basic availability information

**Error Conditions:**
- `ClaudeError('CLAUDE_NOT_FOUND')` - Claude CLI not installed or in PATH

*Error codes follow shared ERROR_CODES pattern: MODULE_ERROR_TYPE*

**Note:** Authentication status cannot be checked directly via CLI - only available through `/status` slash command in interactive mode.

---

#### getClaudeConfig
```typescript
async function getClaudeConfig(projectPath?: string): Promise<ClaudeConfig>
```

**Returns:**
```typescript
interface ClaudeConfig {
  userSettings?: ClaudeSettings;     // ~/.claude/settings.json
  projectSettings?: ClaudeSettings;  // .claude/settings.json
  localSettings?: ClaudeSettings;    // .claude/settings.local.json
  commandsPath?: string;             // Path to .claude/commands directory
  availableCommands: string[];       // List of .md files in commands directory
}

// Based on actual Claude Code settings.json structure
interface ClaudeSettings {
  permissions?: {
    allow?: string[];                // Permission allow rules
    deny?: string[];                 // Permission deny rules
  };
  env?: Record<string, string>;      // Environment variables
  apiKeyHelper?: string;             // Script to generate auth values
  cleanupPeriodDays?: number;        // Chat transcript retention
  includeCoAuthoredBy?: boolean;     // Include co-authored-by in commits
}
```

**Behavior:**
- Reads hierarchical settings files:
  - `~/.claude/settings.json` (user settings)
  - `.claude/settings.json` (project settings, shared)
  - `.claude/settings.local.json` (project settings, local only)
- Scans `.claude/commands/` directory for available command files
- Returns structured configuration with proper precedence

**Note:** Settings precedence: Enterprise policies > CLI args > Local project > Shared project > User settings

---

### Prompt Generation

#### generateWorkPrompt
```typescript
async function generateWorkPrompt(options: WorkPromptOptions): Promise<string>
```

**Parameters:**
```typescript
interface WorkPromptOptions {
  issueNumber: number;             // GitHub issue number to work on
  mode: 'direct' | 'review';       // Work mode
  repositoryInfo: RepositoryInfo;  // Repository context
  branchInfo: GitBranchInfo;       // Current branch information
  additionalContext?: string;      // Extra context or instructions
}
```

**Returns:** Formatted prompt string for Claude Code

**Behavior:**
- Generates context-aware prompts for development work
- Includes issue information, repository context, and work mode
- Formats prompt for optimal Claude Code interaction

**Example Output:**
```
Execute development work for issue #123:

## Context
- Repository: owner/repo
- Branch: feature-auth
- Issue: #123 - Implement user authentication
- Mode: direct (create PR when complete)

## Instructions
Use the /project:work-on-issue command with the following process:

1. **Get Context**
   - Fetch issue details: `gh issue view 123`
   - Understand requirements and acceptance criteria

2. **Implement**
   - Write code following CLAUDE.md conventions
   - Create appropriate tests
   - Update relevant documentation

3. **Complete Work**
   - Run all tests and ensure they pass
   - Commit with clear message referencing issue
   - Create PR with validation instructions

Begin implementation now using: /project:work-on-issue $ISSUE_NUMBER=123 $MODE=direct
```

---

#### generateReviewPrompt
```typescript
async function generateReviewPrompt(options: ReviewPromptOptions): Promise<string>
```

**Parameters:**
```typescript
interface ReviewPromptOptions {
  issueNumber: number;             // Original issue number being reviewed
  repositoryInfo: RepositoryInfo;  // Repository context
  workBranch: string;              // Branch being reviewed
  workTreePath: string;            // Review worktree path
  baseBranch: string;              // Base branch (usually main)
  trackingIssueNumber?: number;    // Review tracking issue number
}
```

**Returns:** Formatted review prompt string

**Behavior:**
- Generates comprehensive review prompts
- Includes context about original work and review environment
- Provides clear decision tree for review outcomes

**Example Output:**
```
Execute code review for issue #123:

## Context
- Review worktree: ../review-issue-123-20241214-143022
- Original issue: #123
- Branch: feature-auth
- Review tracking: #124
- Changes: 5 files, +120 -15 lines

## Instructions
Use the /project:review-issue command with the following process:

1. **Understand Requirements**
   - Fetch issue #123 details: `gh issue view 123`
   - Extract original requirements and acceptance criteria

2. **Review Implementation**
   - Look for work reports in planning/temp/work-reports/ directory
   - Analyze changes: `git diff main..feature-auth`
   - Validate implementation completeness

3. **Run Validation**
   - Execute automated tests
   - Perform manual smoke tests based on requirements
   - Check for regressions

4. **Make Decision**
   - **APPROVED**: Create PR immediately
   - **NEEDS_WORK**: Create detailed feedback document

## Decision Required
After thorough review, take appropriate action and cleanup this review worktree.

Begin review process now using: /project:review-issue 123
```

---

### Claude Process Management

#### launchClaudeInteractive
```typescript
async function launchClaudeInteractive(options: ClaudeLaunchOptions): Promise<ClaudeSession>
```

**Parameters:**
```typescript
interface ClaudeLaunchOptions {
  workingDirectory: string;        // Directory to launch Claude in
  prompt?: string;                 // Initial prompt to send
  sessionName?: string;            // tmux session name (if using tmux)
  useTmux?: boolean;               // Whether to launch in tmux session (default: true)
  skipPermissions?: boolean;       // Use --dangerously-skip-permissions (default: true)
  additionalDirs?: string[];       // Additional directories via --add-dir
  model?: string;                  // Model to use via --model
  verbose?: boolean;               // Enable verbose logging
  detached?: boolean;              // Run detached process (default: true)
}
```

**Returns:**
```typescript
// Uses shared ClaudeSession interface from shared/types.ts
// See shared/types.ts for complete interface definition
// Includes model tracking and session metadata
```

**Behavior:**
- Constructs Claude CLI command with proper flags:
  - `claude` for interactive mode
  - `claude "prompt"` if initial prompt provided
  - `--dangerously-skip-permissions` if skipPermissions=true
  - `--add-dir path1 path2` for additional directories
  - `--model model-name` if model specified
  - `--verbose` if verbose=true
- Launches in tmux session if useTmux=true
- Changes to working directory before launching
- Returns session information for tracking

**Command Examples:**
```bash
# Basic interactive launch
claude --dangerously-skip-permissions

# With initial prompt
claude "Review implementation of issue #123" --dangerously-skip-permissions

# With additional directories and model
claude --add-dir ../lib --model claude-sonnet-4 --dangerously-skip-permissions
```

**Error Conditions:**
- `ClaudeError('CLAUDE_LAUNCH_FAILED')` - Failed to start Claude process
- `ClaudeError('CLAUDE_DIRECTORY_NOT_FOUND')` - Working directory doesn't exist
- `ClaudeError('CLAUDE_TMUX_SESSION_FAILED')` - Failed to create tmux session

*Error codes follow shared ERROR_CODES pattern: MODULE_ERROR_TYPE*

---

#### sendPromptToSession
```typescript
async function sendPromptToSession(sessionName: string, prompt: string): Promise<void>
```

**Parameters:**
- `sessionName: string` - tmux session name containing Claude
- `prompt: string` - Prompt to send to Claude

**Behavior:**
- Sends prompt to existing Claude session via tmux
- Handles prompt formatting and transmission
- Escapes special characters for tmux send-keys
- Adds newline to submit prompt
- Useful for sending additional instructions to running sessions

**Error Conditions:**
- `ClaudeError('SESSION_NOT_FOUND')` - tmux session doesn't exist
- `ClaudeError('SEND_FAILED')` - Failed to send prompt to session

---

#### getClaudeSessions
```typescript
async function getClaudeSessions(): Promise<ClaudeSession[]>
```

**Returns:** Array of active Claude sessions

**Behavior:**
- Lists all running Claude processes
- Includes both tmux and standalone sessions
- Returns session information for monitoring

---

#### terminateClaudeSession
```typescript
async function terminateClaudeSession(sessionIdentifier: string, options?: TerminateOptions): Promise<void>
```

**Parameters:**
```typescript
interface TerminateOptions {
  graceful?: boolean;              // Attempt graceful shutdown (default: true)
  timeout?: number;                // Timeout for graceful shutdown (seconds)
  force?: boolean;                 // Force termination if graceful fails
}
```

**Behavior:**
- Terminates Claude session gracefully or forcefully
- Cleans up tmux session if applicable
- Handles process cleanup and resource release

---

### Command Integration

**Note:** Claude Code commands (like `/project:work-on-issue`) are slash commands that work within interactive sessions. They cannot be executed directly via CLI. The workflow approach is to:

1. Launch Claude in interactive mode with initial prompt
2. The prompt instructs Claude to use specific slash commands
3. Claude executes the commands within its interactive session

#### runClaudeNonInteractive
```typescript
async function runClaudeNonInteractive(options: NonInteractiveOptions): Promise<ClaudeNonInteractiveResult>
```

**Parameters:**
```typescript
interface NonInteractiveOptions {
  prompt: string;                  // Prompt to send to Claude
  workingDirectory: string;        // Directory to run in
  timeout?: number;                // Timeout in seconds
  maxTurns?: number;               // Limit agentic turns
  model?: string;                  // Model to use
  additionalDirs?: string[];       // Additional directories
  outputFormat?: 'text' | 'json' | 'stream-json'; // Output format
}
```

**Returns:**
```typescript
interface ClaudeNonInteractiveResult {
  output: string;                  // Claude's response
  success: boolean;                // Whether execution succeeded
  duration: number;                // Execution time in milliseconds
  turnsUsed?: number;              // Number of agentic turns used
}
```

**Behavior:**
- Uses `claude -p "prompt"` for non-interactive execution
- Suitable for simple queries or commands that don't require interaction
- Returns structured results from Claude's response

**Command Example:**
```bash
claude -p "Analyze this codebase and suggest improvements" --output-format json --max-turns 3
```

---

### Configuration Management

#### detectClaudeCommands
```typescript
async function detectClaudeCommands(claudeDir?: string): Promise<ClaudeCommandInfo[]>
```

**Returns:**
```typescript
interface ClaudeCommandInfo {
  name: string;                    // Command name (e.g., 'work-on-issue')
  path: string;                    // Full path to command file
  description: string;             // Command description from file
  usage: string;                   // Usage instructions
  parameters: ClaudeCommandParam[]; // Command parameters
}

interface ClaudeCommandParam {
  name: string;                    // Parameter name (e.g., '$ISSUE_NUMBER')
  type: string;                    // Parameter type
  required: boolean;               // Whether parameter is required
  description: string;             // Parameter description
}
```

**Behavior:**
- Scans .claude/commands/ directory for available commands
- Parses command files to extract metadata
- Returns structured information about available commands

---

#### updateClaudeSettings
```typescript
async function updateClaudeSettings(settings: Partial<ClaudeProjectSettings>, settingsPath?: string): Promise<void>
```

**Parameters:**
- `settings: Partial<ClaudeProjectSettings>` - Settings to update
- `settingsPath?: string` - Path to settings file (default: .claude/settings.local.json)

**Behavior:**
- Updates Claude project settings
- Merges with existing settings
- Validates setting values

## Usage Examples

### Development Workflow
```typescript
// Validate Claude is ready
const validation = await validateClaudeAvailable();
if (!validation.isValid) {
  throw new ClaudeError('Claude CLI not available', 'CLAUDE_NOT_FOUND');
}

// Generate work prompt
const workPrompt = await generateWorkPrompt({
  issueNumber: 123,
  mode: 'direct',
  repositoryInfo: repoInfo,
  branchInfo: branchInfo
});

// Launch Claude in worktree with tmux
const session = await launchClaudeInteractive({
  workingDirectory: worktreePath,
  prompt: workPrompt,
  sessionName: 'swarm-task-123',
  useTmux: true,
  skipPermissions: true
});

console.log(`Claude session started: ${session.sessionName}`);
console.log(`Monitor with: tmux attach-session -t ${session.sessionName}`);
```

### Review Workflow
```typescript
// Ensure context files in review worktree
const contextInfo = await ensureClaudeContext(reviewWorktreePath);
if (!contextInfo.contextComplete) {
  throw new ClaudeError('Context files missing in review worktree');
}

// Generate review prompt
const reviewPrompt = await generateReviewPrompt({
  issueNumber: 123,
  repositoryInfo: repoInfo,
  branchInfo: branchInfo,
  workTreePath: reviewWorktreePath,
  trackingIssueNumber: 124
});

// Launch Claude for review
const reviewSession = await launchClaudeInteractive({
  workingDirectory: reviewWorktreePath,
  prompt: reviewPrompt,
  sessionName: 'swarm-review-123',
  useTmux: true
});
```

### Session Management
```typescript
// List active Claude sessions
const sessions = await getClaudeSessions();
console.log(`Active sessions: ${sessions.length}`);

// Send additional prompt to running session
await sendPromptToSession('swarm-task-123', 'Please run the tests now');

// Terminate session when complete
await terminateClaudeSession('swarm-task-123', {
  graceful: true,
  timeout: 30
});
```

### Non-Interactive Execution
```typescript
// Execute simple analysis via non-interactive mode
const result = await runClaudeNonInteractive({
  prompt: "Review the changes in this branch and provide a summary",
  workingDirectory: worktreePath,
  timeout: 300, // 5 minutes
  outputFormat: 'json',
  maxTurns: 3
});

if (result.success) {
  console.log(`Analysis completed in ${result.duration}ms`);
  console.log(`Response: ${result.output}`);
} else {
  console.error(`Analysis failed`);
}

// Note: For complex workflows like /project:work-on-issue,
// use launchClaudeInteractive with detailed prompts instead
```

## Testing Considerations

### Unit Tests
- **Prompt generation**: Test prompt formatting with various inputs
- **Command parsing**: Test Claude command detection and parsing
- **Configuration handling**: Test settings loading and updating

### Integration Tests
- **Claude CLI integration**: Test against actual Claude installation
- **Session management**: Test tmux session creation and interaction
- **Context file handling**: Test context file copying and validation

### Mocking Strategy
- Mock `child_process` for Claude CLI execution
- Mock file system operations for context file management
- Provide test Claude configurations and commands

## Configuration Requirements

### Configurable Behavior (via shared/config.ts)
```typescript
// Uses ClaudeConfig from shared infrastructure
interface ClaudeConfig {
  defaultModel?: string;           // Default Claude model
  skipPermissions: boolean;        // Use --dangerously-skip-permissions
  verboseOutput: boolean;          // Enable verbose logging
  maxTurns?: number;               // Default max turns for non-interactive
}
```

**Default Values** (from DEFAULT_CONFIG):
- `skipPermissions: true`
- `verboseOutput: false`
- `maxTurns: 10`

### Environment Dependencies
- Claude CLI installed and authenticated
- tmux installed (for session management)
- Proper file permissions for context file operations

### Required Claude Configuration
- Authenticated Claude account
- Proper permissions for dangerous operations
- Project-specific .claude/ directory setup

## Performance Considerations

- **Session caching**: Reuse existing sessions where possible
- **Prompt optimization**: Generate efficient prompts to reduce token usage
- **Context file caching**: Cache context file validation results
- **Process monitoring**: Efficient monitoring of Claude process status

## Error Recovery Patterns

### Session Failure Recovery
```typescript
// Automatic retry for failed session creation
try {
  const session = await launchClaudeInteractive(options);
} catch (error) {
  if (error instanceof ClaudeError && error.code === 'CLAUDE_LAUNCH_FAILED') {
    // Clean up any partial session state
    await cleanupFailedSession(options.sessionName);
    // Retry once
    return await launchClaudeInteractive(options);
  }
  throw error;
}
```

### Context Validation
```typescript
// Ensure context is always available
const contextInfo = await ensureClaudeContext(targetDirectory);
if (!contextInfo.contextComplete) {
  // Attempt to restore from main repository
  await ensureClaudeContext(targetDirectory, mainRepoPath);
}
```

## Future Extensions

- **Claude model selection**: Support for different Claude models per workflow
- **Advanced prompt templating**: Template system for complex prompt generation
- **Session persistence**: Save and restore Claude session state
- **Performance monitoring**: Track Claude usage and performance metrics
- **Batch operations**: Execute multiple Claude commands in sequence
- **Custom command creation**: Dynamic generation of Claude commands