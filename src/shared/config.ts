/**
 * Configuration management system for Claude Swarm
 *
 * Handles environment variables, configuration files, and default values
 * with proper validation and type safety.
 */

import { ERROR_CODES, ErrorFactory } from "@/shared/errors";
import type { ClaudeOptions, Config, GitHubOptions } from "@/shared/types";

/**
 * Deep partial type for configuration updates
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Extended configuration interface with all module settings
 */
export interface SwarmConfig extends Config {
  // Core settings
  readonly workingDirectory: string;
  readonly debug: boolean;
  readonly logLevel: "error" | "warn" | "info" | "debug";

  // GitHub integration settings
  readonly github: {
    readonly token?: string;
    readonly baseUrl: string;
    readonly timeout: number;
    readonly retryCount: number;
  };

  // Claude Code settings
  readonly claude: {
    readonly model?: string;
    readonly timeout: number;
    readonly retryCount: number;
  };

  // Git settings
  readonly git: {
    readonly timeout: number;
    readonly defaultBranch: string;
  };

  // tmux settings
  readonly tmux: {
    readonly sessionPrefix: string;
    readonly defaultShell: string;
    readonly killTimeout: number;
  };

  // Worktree settings
  readonly worktree: {
    readonly basePath: string;
    readonly cleanupOnError: boolean;
    readonly maxWorktrees: number;
  };

  // File operation settings
  readonly files: {
    readonly backupOnOverwrite: boolean;
    readonly defaultPermissions: string;
  };
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: SwarmConfig = {
  // Core settings
  workingDirectory: process.cwd(),
  debug: process.env.NODE_ENV === "development",
  logLevel:
    process.env.SWARM_LOG_LEVEL === "debug"
      ? "debug"
      : process.env.SWARM_LOG_LEVEL === "info"
        ? "info"
        : process.env.SWARM_LOG_LEVEL === "warn"
          ? "warn"
          : process.env.SWARM_LOG_LEVEL === "error"
            ? "error"
            : "info",

  // GitHub settings
  github: {
    token: process.env.GITHUB_TOKEN,
    baseUrl: process.env.GITHUB_API_URL || "https://api.github.com",
    timeout: Number(process.env.GITHUB_TIMEOUT) || 30000,
    retryCount: Number(process.env.GITHUB_RETRY_COUNT) || 3,
  },

  // Claude settings
  claude: {
    model: process.env.CLAUDE_MODEL,
    timeout: Number(process.env.CLAUDE_TIMEOUT) || 60000,
    retryCount: Number(process.env.CLAUDE_RETRY_COUNT) || 2,
  },

  // Git settings
  git: {
    timeout: Number(process.env.GIT_TIMEOUT) || 30000,
    defaultBranch: process.env.GIT_DEFAULT_BRANCH || "main",
  },

  // tmux settings
  tmux: {
    sessionPrefix: process.env.TMUX_SESSION_PREFIX || "swarm",
    defaultShell: process.env.SHELL || "/bin/bash",
    killTimeout: Number(process.env.TMUX_KILL_TIMEOUT) || 5000,
  },

  // Worktree settings
  worktree: {
    basePath: process.env.SWARM_WORKTREE_PATH || "./worktrees",
    cleanupOnError: process.env.SWARM_CLEANUP_ON_ERROR !== "false",
    maxWorktrees: Number(process.env.SWARM_MAX_WORKTREES) || 10,
  },

  // File settings
  files: {
    backupOnOverwrite: process.env.SWARM_BACKUP_ON_OVERWRITE === "true",
    defaultPermissions: process.env.SWARM_DEFAULT_PERMISSIONS || "0644",
  },
};

/**
 * Configuration validation rules
 */
interface ConfigValidationRule {
  path: string;
  validator: (value: unknown) => boolean;
  message: string;
}

const VALIDATION_RULES: ConfigValidationRule[] = [
  {
    path: "logLevel",
    validator: (value) => ["error", "warn", "info", "debug"].includes(value as string),
    message: "logLevel must be one of: error, warn, info, debug",
  },
  {
    path: "github.timeout",
    validator: (value) => typeof value === "number" && value > 0,
    message: "github.timeout must be a positive number",
  },
  {
    path: "claude.timeout",
    validator: (value) => typeof value === "number" && value > 0,
    message: "claude.timeout must be a positive number",
  },
  {
    path: "git.timeout",
    validator: (value) => typeof value === "number" && value > 0,
    message: "git.timeout must be a positive number",
  },
  {
    path: "tmux.killTimeout",
    validator: (value) => typeof value === "number" && value > 0,
    message: "tmux.killTimeout must be a positive number",
  },
  {
    path: "worktree.maxWorktrees",
    validator: (value) => typeof value === "number" && value > 0 && value <= 50,
    message: "worktree.maxWorktrees must be between 1 and 50",
  },
];

/**
 * Configuration manager class
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: SwarmConfig;

  private constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Get current configuration
   */
  getConfig(): SwarmConfig {
    return { ...this.config };
  }

  /**
   * Update configuration with partial values
   */
  updateConfig(updates: DeepPartial<SwarmConfig>): void {
    const newConfig = this.mergeConfig(this.config, updates);
    this.validateConfig(newConfig);
    this.config = newConfig;
  }

  /**
   * Reset configuration to defaults
   */
  resetConfig(): void {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Load configuration from environment variables
   */
  loadFromEnvironment(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.validateConfig(this.config);
  }

  /**
   * Get GitHub-specific options
   */
  getGitHubOptions(): GitHubOptions {
    return {
      token: this.config.github.token,
      baseUrl: this.config.github.baseUrl,
      timeout: this.config.github.timeout,
    };
  }

  /**
   * Get Claude-specific options
   */
  getClaudeOptions(): ClaudeOptions {
    return {
      model: this.config.claude.model,
      timeout: this.config.claude.timeout,
    };
  }

  /**
   * Deep merge configuration objects
   */
  private mergeConfig(base: SwarmConfig, updates: DeepPartial<SwarmConfig>): SwarmConfig {
    const result = { ...base } as Record<string, unknown>;

    for (const [key, value] of Object.entries(updates)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        result[key] = {
          ...(result[key] as Record<string, unknown>),
          ...value,
        };
      } else {
        result[key] = value;
      }
    }

    return result as unknown as SwarmConfig;
  }

  /**
   * Validate configuration against rules
   */
  private validateConfig(config: SwarmConfig): void {
    const errors: string[] = [];

    for (const rule of VALIDATION_RULES) {
      const value = this.getValueByPath(config as unknown as Record<string, unknown>, rule.path);
      if (!rule.validator(value)) {
        errors.push(rule.message);
      }
    }

    if (errors.length > 0) {
      throw ErrorFactory.worktree(
        ERROR_CODES.CORE_INVALID_CONFIGURATION,
        `Configuration validation failed: ${errors.join(", ")}`,
        { errors },
      );
    }
  }

  /**
   * Get value from object by dot notation path
   */
  private getValueByPath(obj: Record<string, unknown>, path: string): unknown {
    return path
      .split(".")
      .reduce((current: unknown, key: string) => (current as Record<string, unknown>)?.[key], obj);
  }
}

/**
 * Configuration utilities
 */
export const ConfigUtils = {
  /**
   * Create configuration from environment variables
   */
  createFromEnvironment(): SwarmConfig {
    const manager = ConfigManager.getInstance();
    manager.loadFromEnvironment();
    return manager.getConfig();
  },

  /**
   * Create configuration with overrides
   */
  createWithOverrides(overrides: DeepPartial<SwarmConfig>): SwarmConfig {
    const manager = ConfigManager.getInstance();
    manager.updateConfig(overrides);
    return manager.getConfig();
  },

  /**
   * Validate configuration object
   */
  validateConfig(config: DeepPartial<SwarmConfig>): { isValid: boolean; errors: string[] } {
    try {
      // Simple validation without accessing private methods
      if (config.logLevel && !["error", "warn", "info", "debug"].includes(config.logLevel)) {
        return { isValid: false, errors: ["Invalid log level"] };
      }
      if (config.github?.timeout && config.github.timeout <= 0) {
        return { isValid: false, errors: ["GitHub timeout must be positive"] };
      }
      if (config.claude?.timeout && config.claude.timeout <= 0) {
        return { isValid: false, errors: ["Claude timeout must be positive"] };
      }
      if (
        config.worktree?.maxWorktrees &&
        (config.worktree.maxWorktrees < 1 || config.worktree.maxWorktrees > 50)
      ) {
        return { isValid: false, errors: ["Max worktrees must be between 1 and 50"] };
      }
      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof Error) {
        return { isValid: false, errors: [error.message] };
      }
      return { isValid: false, errors: ["Unknown validation error"] };
    }
  },

  /**
   * Get configuration summary for debugging
   */
  getConfigSummary(config: SwarmConfig): Record<string, unknown> {
    return {
      workingDirectory: config.workingDirectory,
      debug: config.debug,
      logLevel: config.logLevel,
      githubConfigured: !!config.github.token,
      claudeModel: config.claude.model || "default",
      worktreePath: config.worktree.basePath,
      tmuxPrefix: config.tmux.sessionPrefix,
    };
  },
};

/**
 * Global configuration instance
 */
export const config = ConfigManager.getInstance();

/**
 * Convenience functions for common configuration access
 */
export function getConfig(): SwarmConfig {
  return config.getConfig();
}

export function updateConfig(updates: DeepPartial<SwarmConfig>): void {
  config.updateConfig(updates);
}

export function isDebugMode(): boolean {
  return config.getConfig().debug;
}

export function getLogLevel(): SwarmConfig["logLevel"] {
  return config.getConfig().logLevel;
}
