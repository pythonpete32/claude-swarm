# Configuration Management

← [Back to Index](./README.md) | [Previous: Testing Strategy](./05-testing-strategy.md) | [Next: Error Handling →](./07-error-handling.md)

## Overview

Claude Swarm uses a hierarchical configuration system that allows flexible customization while providing sensible defaults. Configuration is managed through a combination of files, environment variables, and CLI arguments.

## Configuration Hierarchy

Configuration follows a clear precedence order (highest to lowest priority):

```
1. CLI Arguments           (--config-option=value)
2. Environment Variables   (CLAUDE_SWARM_OPTION=value)  
3. Project Configuration   (.claude/config.json)
4. User Configuration      (~/.claude/config.json)
5. Built-in Defaults       (DEFAULT_CONFIG in shared/types.ts)
```

### Example Configuration Resolution
```typescript
// If user provides: bun work-on-task 123 --agent-id=5 --force
// And environment has: CLAUDE_SWARM_NAMING_STRATEGY=timestamped
// And .claude/config.json has: { "worktree": { "basePath": "../custom" } }
// And ~/.claude/config.json has: { "worktree": { "basePath": "~/worktrees" } }

// Final resolved configuration:
{
  agentId: 5,                    // From CLI (highest priority)
  force: true,                   // From CLI
  namingStrategy: 'timestamped', // From environment variable
  basePath: '../custom',         // From project config (overrides user config)
  maxAge: 7                      // From built-in defaults
}
```

## Configuration Structure

### Complete Configuration Schema

```typescript
// Defined in shared/types.ts
interface SwarmConfig {
  // Core behavior settings
  worktree: WorktreeConfig;
  tmux: TmuxConfig;
  claude: ClaudeConfig;
  github: GitHubConfig;
  
  // Global settings
  logging: LoggingConfig;
  cleanup: CleanupConfig;
}
```

### Module-Specific Configuration

#### **WorktreeConfig**
```typescript
interface WorktreeConfig {
  basePath: string;                // Default base path for worktrees
  namingStrategy: 'simple' | 'timestamped'; // Default naming strategy
  autoCleanup: boolean;            // Automatic cleanup of old worktrees
  maxAge: number;                  // Days before considering worktree abandoned
}

// Default values
const DEFAULT_WORKTREE_CONFIG: WorktreeConfig = {
  basePath: '../',
  namingStrategy: 'simple',
  autoCleanup: true,
  maxAge: 7
};
```

#### **ClaudeConfig**
```typescript
interface ClaudeConfig {
  defaultModel?: string;           // Default Claude model
  skipPermissions: boolean;        // Use --dangerously-skip-permissions
  verboseOutput: boolean;          // Enable verbose logging
  maxTurns?: number;               // Default max turns for non-interactive
}

// Default values
const DEFAULT_CLAUDE_CONFIG: ClaudeConfig = {
  skipPermissions: true,
  verboseOutput: false,
  maxTurns: 10
};
```

#### **GitHubConfig**
```typescript
interface GitHubConfig {
  defaultProject?: number;         // Default project number
  autoCreateLabels: boolean;       // Automatically create missing labels
  rateLimitRetries: number;        // Number of rate limit retries
}

// Default values
const DEFAULT_GITHUB_CONFIG: GitHubConfig = {
  autoCreateLabels: true,
  rateLimitRetries: 3
};
```

#### **TmuxConfig**
```typescript
interface TmuxConfig {
  sessionPrefix: string;           // Session name prefix (default: 'swarm-')
  defaultShell: string;            // Default shell for sessions
  gracefulTimeout: number;         // Seconds to wait before force kill
}

// Default values
const DEFAULT_TMUX_CONFIG: TmuxConfig = {
  sessionPrefix: 'swarm-',
  defaultShell: '/bin/bash',
  gracefulTimeout: 10
};
```

#### **LoggingConfig**
```typescript
interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  enableFileLogging: boolean;
  logPath?: string;
}

// Default values
const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
  level: 'info',
  enableFileLogging: false
};
```

#### **CleanupConfig**
```typescript
interface CleanupConfig {
  autoCleanupAfterDays: number;    // Auto cleanup abandoned worktrees
  preserveFeedback: boolean;       // Keep feedback files during cleanup
  confirmBeforeCleanup: boolean;   // Prompt before cleanup operations
}

// Default values
const DEFAULT_CLEANUP_CONFIG: CleanupConfig = {
  autoCleanupAfterDays: 7,
  preserveFeedback: true,
  confirmBeforeCleanup: true
};
```

## Configuration Files

### Project Configuration (`.claude/config.json`)

```json
{
  "worktree": {
    "basePath": "../worktrees",
    "namingStrategy": "timestamped",
    "autoCleanup": true,
    "maxAge": 14
  },
  "claude": {
    "defaultModel": "claude-sonnet-4",
    "skipPermissions": true,
    "verboseOutput": true
  },
  "github": {
    "defaultProject": 1,
    "autoCreateLabels": true,
    "rateLimitRetries": 5
  },
  "tmux": {
    "sessionPrefix": "project-swarm-",
    "gracefulTimeout": 15
  },
  "logging": {
    "level": "debug",
    "enableFileLogging": true,
    "logPath": "./logs/swarm.log"
  },
  "cleanup": {
    "autoCleanupAfterDays": 14,
    "preserveFeedback": true,
    "confirmBeforeCleanup": false
  }
}
```

### User Configuration (`~/.claude/config.json`)

```json
{
  "worktree": {
    "basePath": "~/Development/worktrees"
  },
  "claude": {
    "defaultModel": "claude-haiku-3",
    "verboseOutput": false
  },
  "logging": {
    "level": "warn",
    "enableFileLogging": true,
    "logPath": "~/.claude/logs/swarm.log"
  }
}
```

## Environment Variables

All configuration options can be overridden using environment variables with the `CLAUDE_SWARM_` prefix:

### Environment Variable Naming Convention
- **Format**: `CLAUDE_SWARM_{MODULE}_{OPTION}`
- **Case**: UPPER_SNAKE_CASE
- **Nesting**: Use underscores for nested properties

### Environment Variable Examples

```bash
# Worktree configuration
export CLAUDE_SWARM_WORKTREE_BASE_PATH="/tmp/swarm-worktrees"
export CLAUDE_SWARM_WORKTREE_NAMING_STRATEGY="timestamped"
export CLAUDE_SWARM_WORKTREE_AUTO_CLEANUP="false"
export CLAUDE_SWARM_WORKTREE_MAX_AGE="14"

# Claude configuration  
export CLAUDE_SWARM_CLAUDE_DEFAULT_MODEL="claude-opus-3"
export CLAUDE_SWARM_CLAUDE_SKIP_PERMISSIONS="true"
export CLAUDE_SWARM_CLAUDE_VERBOSE_OUTPUT="true"
export CLAUDE_SWARM_CLAUDE_MAX_TURNS="15"

# GitHub configuration
export CLAUDE_SWARM_GITHUB_DEFAULT_PROJECT="2"
export CLAUDE_SWARM_GITHUB_AUTO_CREATE_LABELS="false"
export CLAUDE_SWARM_GITHUB_RATE_LIMIT_RETRIES="5"

# tmux configuration
export CLAUDE_SWARM_TMUX_SESSION_PREFIX="dev-swarm-"
export CLAUDE_SWARM_TMUX_DEFAULT_SHELL="/bin/zsh"
export CLAUDE_SWARM_TMUX_GRACEFUL_TIMEOUT="20"

# Logging configuration
export CLAUDE_SWARM_LOGGING_LEVEL="debug"
export CLAUDE_SWARM_LOGGING_ENABLE_FILE_LOGGING="true"
export CLAUDE_SWARM_LOGGING_LOG_PATH="/var/log/claude-swarm.log"

# Cleanup configuration
export CLAUDE_SWARM_CLEANUP_AUTO_CLEANUP_AFTER_DAYS="21"
export CLAUDE_SWARM_CLEANUP_PRESERVE_FEEDBACK="false"
export CLAUDE_SWARM_CLEANUP_CONFIRM_BEFORE_CLEANUP="true"
```

## CLI Argument Configuration

CLI arguments provide the highest priority configuration override:

### CLI Argument Examples

```bash
# Override worktree settings
bun work-on-task 123 \
  --base-path="/tmp/custom" \
  --naming-strategy="timestamped" \
  --agent-id="dev-1"

# Override Claude settings
bun work-on-task 123 \
  --claude-model="claude-sonnet-4" \
  --verbose \
  --max-turns=20

# Override workflow behavior
bun work-on-task 123 \
  --force \
  --skip-context \
  --no-interactive

# Override cleanup settings
bun cleanup-review 123 \
  --preserve-feedback \
  --no-confirm
```

### CLI Argument Mapping

```typescript
// CLI arguments are mapped to configuration keys
const CLI_ARG_MAPPING = {
  // Worktree options
  '--base-path': 'worktree.basePath',
  '--naming-strategy': 'worktree.namingStrategy',
  '--auto-cleanup': 'worktree.autoCleanup',
  '--max-age': 'worktree.maxAge',
  
  // Claude options
  '--claude-model': 'claude.defaultModel',
  '--skip-permissions': 'claude.skipPermissions',
  '--verbose': 'claude.verboseOutput',
  '--max-turns': 'claude.maxTurns',
  
  // GitHub options
  '--default-project': 'github.defaultProject',
  '--auto-create-labels': 'github.autoCreateLabels',
  '--rate-limit-retries': 'github.rateLimitRetries',
  
  // Logging options
  '--log-level': 'logging.level',
  '--enable-file-logging': 'logging.enableFileLogging',
  '--log-path': 'logging.logPath'
};
```

## Configuration Loading Implementation

### Configuration Loader

```typescript
// shared/config.ts
export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private config: SwarmConfig;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  getConfig(): SwarmConfig {
    return this.config;
  }

  private loadConfiguration(): SwarmConfig {
    // Start with built-in defaults
    let config = { ...DEFAULT_CONFIG };

    // Layer 1: User configuration (~/.claude/config.json)
    const userConfig = this.loadUserConfig();
    if (userConfig) {
      config = this.mergeConfigs(config, userConfig);
    }

    // Layer 2: Project configuration (.claude/config.json)
    const projectConfig = this.loadProjectConfig();
    if (projectConfig) {
      config = this.mergeConfigs(config, projectConfig);
    }

    // Layer 3: Environment variables
    const envConfig = this.loadEnvironmentConfig();
    config = this.mergeConfigs(config, envConfig);

    // Layer 4: CLI arguments (handled separately in CLI parsing)
    
    return config;
  }

  private loadUserConfig(): Partial<SwarmConfig> | null {
    const userConfigPath = path.join(os.homedir(), '.claude', 'config.json');
    return this.loadConfigFile(userConfigPath);
  }

  private loadProjectConfig(): Partial<SwarmConfig> | null {
    const projectConfigPath = path.join(process.cwd(), '.claude', 'config.json');
    return this.loadConfigFile(projectConfigPath);
  }

  private loadConfigFile(filePath: string): Partial<SwarmConfig> | null {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn(`Failed to load config file ${filePath}:`, error.message);
    }
    return null;
  }

  private loadEnvironmentConfig(): Partial<SwarmConfig> {
    const envConfig: any = {};
    
    // Parse all CLAUDE_SWARM_* environment variables
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith('CLAUDE_SWARM_')) {
        const configPath = this.parseEnvVarName(key);
        this.setNestedValue(envConfig, configPath, this.parseEnvValue(value));
      }
    }
    
    return envConfig;
  }

  private parseEnvVarName(envVar: string): string[] {
    // Convert CLAUDE_SWARM_WORKTREE_BASE_PATH to ['worktree', 'basePath']
    const parts = envVar.replace('CLAUDE_SWARM_', '').toLowerCase().split('_');
    
    // Convert snake_case to camelCase for nested properties
    return parts.map((part, index) => {
      if (index === 0) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    });
  }

  private parseEnvValue(value: string): any {
    // Try to parse as JSON first (for booleans, numbers, etc.)
    try {
      return JSON.parse(value);
    } catch {
      return value; // Return as string if not valid JSON
    }
  }

  private setNestedValue(obj: any, path: string[], value: any): void {
    const [head, ...tail] = path;
    if (tail.length === 0) {
      obj[head] = value;
    } else {
      if (!obj[head]) obj[head] = {};
      this.setNestedValue(obj[head], tail, value);
    }
  }

  private mergeConfigs(base: SwarmConfig, override: Partial<SwarmConfig>): SwarmConfig {
    return {
      worktree: { ...base.worktree, ...override.worktree },
      tmux: { ...base.tmux, ...override.tmux },
      claude: { ...base.claude, ...override.claude },
      github: { ...base.github, ...override.github },
      logging: { ...base.logging, ...override.logging },
      cleanup: { ...base.cleanup, ...override.cleanup }
    };
  }
}

// Export convenience function
export function getConfig(): SwarmConfig {
  return ConfigurationManager.getInstance().getConfig();
}
```

### CLI Configuration Integration

```typescript
// CLI command integration
export function parseCliOptions(argv: string[]): Partial<SwarmConfig> {
  const parser = new ArgumentParser();
  
  // Add all configuration options
  parser.add_argument('--base-path', { dest: 'worktree.basePath' });
  parser.add_argument('--naming-strategy', { dest: 'worktree.namingStrategy' });
  parser.add_argument('--claude-model', { dest: 'claude.defaultModel' });
  parser.add_argument('--verbose', { dest: 'claude.verboseOutput', action: 'store_true' });
  // ... add all CLI options
  
  const parsed = parser.parse_args(argv);
  
  // Convert flat parsed args to nested config structure
  return convertToNestedConfig(parsed);
}

export function mergeCliConfig(baseConfig: SwarmConfig, cliConfig: Partial<SwarmConfig>): SwarmConfig {
  return ConfigurationManager.prototype.mergeConfigs(baseConfig, cliConfig);
}
```

## Configuration Validation

### Configuration Schema Validation

```typescript
// shared/config-validation.ts
export function validateConfig(config: SwarmConfig): ValidationResult {
  const issues: string[] = [];

  // Validate worktree config
  if (!config.worktree.basePath) {
    issues.push('worktree.basePath is required');
  }
  
  if (!['simple', 'timestamped'].includes(config.worktree.namingStrategy)) {
    issues.push('worktree.namingStrategy must be "simple" or "timestamped"');
  }
  
  if (config.worktree.maxAge < 1) {
    issues.push('worktree.maxAge must be at least 1 day');
  }

  // Validate Claude config
  if (config.claude.maxTurns && config.claude.maxTurns < 1) {
    issues.push('claude.maxTurns must be at least 1');
  }

  // Validate GitHub config
  if (config.github.rateLimitRetries < 0) {
    issues.push('github.rateLimitRetries must be non-negative');
  }

  // Validate logging config
  if (!['debug', 'info', 'warn', 'error'].includes(config.logging.level)) {
    issues.push('logging.level must be debug, info, warn, or error');
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings: []
  };
}
```

## Configuration Usage Examples

### Using Configuration in Modules

```typescript
// core/worktree.ts
import { getConfig } from '../shared/config';

export async function createWorktree(options: CreateWorktreeOptions): Promise<WorktreeInfo> {
  const config = getConfig();
  
  // Use configuration defaults if not provided in options
  const basePath = options.basePath ?? config.worktree.basePath;
  const namingStrategy = options.namingStrategy ?? config.worktree.namingStrategy;
  
  // Generate worktree path using configuration
  const worktreePath = generateWorktreePath({
    name: options.name,
    basePath,
    namingStrategy,
    repoName: getRepositoryName(),
    agentId: options.agentId
  });
  
  // Continue with worktree creation...
}
```

### Dynamic Configuration Updates

```typescript
// For testing or runtime configuration changes
export function updateConfig(updates: Partial<SwarmConfig>): void {
  const manager = ConfigurationManager.getInstance();
  const currentConfig = manager.getConfig();
  const newConfig = manager.mergeConfigs(currentConfig, updates);
  
  // Update internal configuration
  manager['config'] = newConfig;
}

// Example usage in tests
updateConfig({
  worktree: {
    basePath: '/tmp/test-worktrees'
  },
  logging: {
    level: 'debug'
  }
});
```

## Configuration Best Practices

### 1. **Use Appropriate Configuration Level**
- **Built-in defaults**: For sensible defaults that work for most users
- **User config**: For personal preferences (editor, paths, logging)
- **Project config**: For project-specific settings (naming conventions, cleanup policies)
- **Environment variables**: For deployment-specific settings (paths, credentials)
- **CLI arguments**: For one-off overrides and testing

### 2. **Configuration Security**
- Never commit sensitive configuration (API keys, tokens) to project config
- Use environment variables for sensitive values
- Provide clear documentation for required environment variables

### 3. **Configuration Documentation**
- Document all configuration options with examples
- Explain the precedence order clearly
- Provide migration guides for configuration changes

### 4. **Configuration Testing**
```typescript
// Test configuration loading and merging
describe('Configuration Management', () => {
  it('should load configuration in correct precedence order', () => {
    // Test with mock files and environment variables
  });
  
  it('should validate configuration correctly', () => {
    // Test with invalid configuration values
  });
});
```

## Migration and Versioning

### Configuration Schema Versioning

```typescript
interface SwarmConfigV1 {
  version: '1.0';
  // ... configuration structure
}

interface SwarmConfigV2 {
  version: '2.0';
  // ... updated configuration structure
}

// Configuration migration logic
export function migrateConfig(config: any): SwarmConfig {
  if (!config.version || config.version === '1.0') {
    return migrateFromV1(config);
  }
  return config;
}
```

### Backwards Compatibility

- Maintain backwards compatibility for at least 2 major versions
- Provide clear migration documentation
- Warn users about deprecated configuration options
- Auto-migrate configuration files when possible

This comprehensive configuration system provides flexibility while maintaining simplicity and follows industry best practices for configuration management.