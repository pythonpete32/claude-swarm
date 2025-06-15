# Core Module: tmux

← [Back to Index](../README.md) | [Previous: Worktree Module](./core-worktree.md) | [Next: GitHub Module →](./core-github.md)

## Purpose
Provides tmux session management for isolated AI agent environments. Handles session creation, process launching, and cleanup for both development and review workflows.

## Dependencies
- `shared/types.ts` - TmuxSession, TmuxSessionOptions interfaces
- `shared/errors.ts` - TmuxError class
- `shared/config.ts` - Session configuration
- Node.js `child_process` - For tmux command execution

## Function Signatures

### Primary Operations

#### createTmuxSession
```typescript
async function createTmuxSession(options: CreateTmuxSessionOptions): Promise<TmuxSession>
```

**Parameters:**
```typescript
interface CreateTmuxSessionOptions {
  name: string;                    // Session name (e.g., 'swarm-task-123')
  workingDirectory: string;        // Initial working directory
  detached?: boolean;              // Start detached (default: true)
  shellCommand?: string;           // Initial shell command to run
  environment?: Record<string, string>; // Environment variables
}
```

**Returns:**
```typescript
interface TmuxSession {
  name: string;                    // Session name
  workingDirectory: string;        // Working directory
  pid: number;                     // tmux session process ID
  created: Date;                   // Creation timestamp
  isActive: boolean;               // Whether session is running
  windowCount: number;             // Number of windows in session
}
```

**Behavior:**
- Validates tmux is installed and available
- Checks for existing session with same name
- Creates detached session in specified directory
- Optionally runs initial shell command
- Sets environment variables if provided

**Error Conditions:**
- `TmuxError('TMUX_NOT_AVAILABLE')` - tmux not installed or in PATH
- `TmuxError('SESSION_EXISTS')` - Session with name already exists
- `TmuxError('INVALID_DIRECTORY')` - Working directory doesn't exist
- `TmuxError('CREATION_FAILED')` - tmux command failed

---

#### launchProcessInSession
```typescript
async function launchProcessInSession(sessionName: string, options: LaunchProcessOptions): Promise<void>
```

**Parameters:**
```typescript
interface LaunchProcessOptions {
  command: string;                 // Command to execute
  args?: string[];                 // Command arguments
  windowName?: string;             // Optional window name
  newWindow?: boolean;             // Create new window (default: false)
  detached?: boolean;              // Run detached (default: true)
}
```

**Behavior:**
- Validates session exists and is active
- Optionally creates new window for the process
- Sends command to session using `tmux send-keys`
- Handles both interactive and non-interactive commands

**Error Conditions:**
- `TmuxError('SESSION_NOT_FOUND')` - Session doesn't exist
- `TmuxError('SESSION_INACTIVE')` - Session exists but not running
- `TmuxError('COMMAND_FAILED')` - Failed to send command to session

---

#### attachToSession
```typescript
async function attachToSession(sessionName: string, options?: AttachOptions): Promise<void>
```

**Parameters:**
```typescript
interface AttachOptions {
  readOnly?: boolean;              // Attach in read-only mode
  targetWindow?: string;           // Specific window to attach to
}
```

**Behavior:**
- Validates session exists and is active
- Attempts to attach to session (requires TTY)
- Handles both full and read-only attachment

**Error Conditions:**
- `TmuxError('SESSION_NOT_FOUND')` - Session doesn't exist
- `TmuxError('NO_TTY')` - Not running in terminal environment
- `TmuxError('ATTACH_FAILED')` - tmux attach command failed

---

#### killSession
```typescript
async function killSession(sessionName: string, options?: KillSessionOptions): Promise<void>
```

**Parameters:**
```typescript
interface KillSessionOptions {
  force?: boolean;                 // Force kill even with active processes
  gracefulTimeout?: number;        // Seconds to wait before force kill (default: 10)
}
```

**Behavior:**
- Validates session exists
- Attempts graceful shutdown first
- Force kills if graceful fails or force=true
- Cleans up session references

**Error Conditions:**
- `TmuxError('SESSION_NOT_FOUND')` - Session doesn't exist
- `TmuxError('KILL_FAILED')` - Failed to terminate session

---

### Utility Operations

#### listSessions
```typescript
async function listSessions(pattern?: string): Promise<TmuxSession[]>
```

**Parameters:**
- `pattern?: string` - Optional pattern to filter sessions (e.g., 'swarm-*')

**Returns:** Array of TmuxSession objects for active sessions

**Behavior:**
- Lists all tmux sessions using `tmux list-sessions`
- Optionally filters by pattern
- Returns structured information for each session

---

#### getSessionInfo
```typescript
async function getSessionInfo(sessionName: string): Promise<TmuxSession>
```

**Parameters:**
- `sessionName: string` - Name of session to inspect

**Returns:** TmuxSession object with current session state

**Error Conditions:**
- `TmuxError('SESSION_NOT_FOUND')` - Session doesn't exist

---

#### validateTmuxAvailable
```typescript
async function validateTmuxAvailable(): Promise<TmuxValidation>
```

**Returns:**
```typescript
interface TmuxValidation {
  isValid: boolean;                // Whether tmux is available and working
  version?: string;                // tmux version if available
  issues: string[];                // Any configuration problems
}
```

---

### Claude Code Integration

#### launchClaudeInSession
```typescript
async function launchClaudeInSession(sessionName: string, options: ClaudeLaunchOptions): Promise<void>
```

**Parameters:**
```typescript
interface ClaudeLaunchOptions {
  prompt?: string;                 // Initial prompt to send to Claude
  workingDirectory?: string;       // Override working directory
  claudeArgs?: string[];           // Additional Claude CLI arguments
  autoStart?: boolean;             // Automatically start Claude (default: true)
}
```

**Behavior:**
- Validates session exists and Claude CLI is available
- Sends Claude launch command to session
- Optionally sends initial prompt after launch
- Handles common Claude CLI arguments (--dangerously-skip-permissions, etc.)

**Error Conditions:**
- `TmuxError('SESSION_NOT_FOUND')` - Session doesn't exist
- `TmuxError('CLAUDE_NOT_AVAILABLE')` - Claude CLI not found
- `TmuxError('LAUNCH_FAILED')` - Failed to start Claude

## Usage Examples

### Development Workflow Session
```typescript
// Create session for task work
const session = await createTmuxSession({
  name: 'swarm-task-123',
  workingDirectory: '/path/to/worktree',
  detached: true
});

// Launch Claude with work prompt
await launchClaudeInSession(session.name, {
  prompt: 'Implement GitHub issue #123...',
  claudeArgs: ['--dangerously-skip-permissions']
});

// User can attach to monitor
console.log(`Connect with: tmux attach-session -t ${session.name}`);
```

### Review Workflow Session
```typescript
// Create session for review
const reviewSession = await createTmuxSession({
  name: 'swarm-review-45',
  workingDirectory: '/path/to/review-worktree',
  detached: true
});

// Launch Claude with review prompt
await launchClaudeInSession(reviewSession.name, {
  prompt: 'Review implementation of issue #45 against requirements...',
  autoStart: true
});
```

### Session Cleanup
```typescript
// List all swarm sessions
const swarmSessions = await listSessions('swarm-*');

// Clean up completed sessions
for (const session of swarmSessions) {
  await killSession(session.name, { 
    gracefulTimeout: 5,
    force: false 
  });
}
```

### Session Monitoring
```typescript
// Check session status
const sessionInfo = await getSessionInfo('swarm-task-123');
console.log(`Session active: ${sessionInfo.isActive}`);
console.log(`Windows: ${sessionInfo.windowCount}`);

// Attach for monitoring (if in terminal)
if (process.stdout.isTTY) {
  await attachToSession('swarm-task-123', { readOnly: true });
}
```

## Testing Considerations

### Unit Tests
- **Session name generation**: Test naming conventions and uniqueness
- **Command construction**: Test tmux command building
- **Error handling**: Test all error conditions with mocked tmux commands

### Integration Tests
- **Real tmux operations**: Test against actual tmux installation
- **Session lifecycle**: Create → launch processes → attach → kill
- **Claude integration**: Test Claude CLI launching in sessions

### Mocking Strategy
- Mock `child_process.exec` for tmux command execution
- Mock process.stdout.isTTY for terminal detection
- Provide test tmux sessions for integration tests

## Configuration Requirements

### Environment Dependencies
- tmux installed and in PATH
- Terminal environment for attachment operations
- Claude CLI available for Claude integration

### Configurable Behavior
- Session name prefix (default: 'swarm-')
- Default graceful shutdown timeout
- Claude CLI path and default arguments

## Performance Considerations

- **Session caching**: Cache active session list to reduce tmux calls
- **Command batching**: Batch multiple tmux commands when possible
- **Background operations**: Most operations should be non-blocking

## Security Considerations

- **Command injection**: Properly escape session names and commands
- **Environment isolation**: Ensure sessions don't leak sensitive data
- **Process limits**: Prevent session creation from consuming too many resources

## Future Extensions

- **Session templates**: Pre-configured session layouts
- **Multi-window workflows**: Complex session setups with multiple windows
- **Session persistence**: Save and restore session state
- **Remote sessions**: Support for remote tmux servers