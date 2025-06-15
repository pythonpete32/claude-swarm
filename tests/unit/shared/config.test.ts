import { beforeEach, describe, expect, it } from "vitest";
import {
  ConfigManager,
  ConfigUtils,
  getConfig,
  isDebugMode,
  updateConfig,
} from "../../../src/shared/config";

describe("ConfigManager", () => {
  let manager: ConfigManager;

  beforeEach(() => {
    // Get a fresh instance for each test
    manager = ConfigManager.getInstance();
    manager.resetConfig();
  });

  it("should provide singleton instance", () => {
    const instance1 = ConfigManager.getInstance();
    const instance2 = ConfigManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  it("should return default configuration", () => {
    const config = manager.getConfig();

    expect(config).toHaveProperty("workingDirectory");
    expect(config).toHaveProperty("debug");
    expect(config).toHaveProperty("logLevel");
    expect(config).toHaveProperty("github");
    expect(config).toHaveProperty("claude");
    expect(config).toHaveProperty("git");
    expect(config).toHaveProperty("tmux");
    expect(config).toHaveProperty("worktree");
    expect(config).toHaveProperty("files");
  });

  it("should update configuration", () => {
    const originalConfig = manager.getConfig();

    manager.updateConfig({
      debug: !originalConfig.debug,
      logLevel: "error",
    });

    const updatedConfig = manager.getConfig();
    expect(updatedConfig.debug).toBe(!originalConfig.debug);
    expect(updatedConfig.logLevel).toBe("error");
  });

  it("should update nested configuration", () => {
    manager.updateConfig({
      github: {
        timeout: 45000,
        retryCount: 5,
      },
    });

    const config = manager.getConfig();
    expect(config.github.timeout).toBe(45000);
    expect(config.github.retryCount).toBe(5);
    // Other github properties should remain unchanged
    expect(config.github.baseUrl).toBe("https://api.github.com");
  });

  it("should reset to defaults", () => {
    manager.updateConfig({ debug: true, logLevel: "error" });
    manager.resetConfig();

    const config = manager.getConfig();
    expect(config.debug).toBe(process.env.NODE_ENV === "development");
    expect(config.logLevel).toBe("info");
  });

  it("should provide GitHub options", () => {
    const options = manager.getGitHubOptions();

    expect(options).toHaveProperty("baseUrl");
    expect(options).toHaveProperty("timeout");
    expect(options.baseUrl).toBe("https://api.github.com");
  });

  it("should provide Claude options", () => {
    const options = manager.getClaudeOptions();

    expect(options).toHaveProperty("timeout");
    expect(typeof options.timeout).toBe("number");
  });
});

describe("ConfigUtils", () => {
  beforeEach(() => {
    ConfigManager.getInstance().resetConfig();
  });

  it("should create config from environment", () => {
    const config = ConfigUtils.createFromEnvironment();
    expect(config).toHaveProperty("workingDirectory");
    expect(config).toHaveProperty("debug");
  });

  it("should create config with overrides", () => {
    const config = ConfigUtils.createWithOverrides({
      debug: true,
      logLevel: "debug",
    });

    expect(config.debug).toBe(true);
    expect(config.logLevel).toBe("debug");
  });

  it("should validate configuration", () => {
    const validConfig = { logLevel: "info" as const };
    const invalidConfig = { logLevel: "invalid" as "error" | "warn" | "info" | "debug" };

    const validResult = ConfigUtils.validateConfig(validConfig);
    expect(validResult.isValid).toBe(true);
    expect(validResult.errors).toHaveLength(0);

    const invalidResult = ConfigUtils.validateConfig(invalidConfig);
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
  });

  it("should provide config summary", () => {
    const config = ConfigManager.getInstance().getConfig();
    const summary = ConfigUtils.getConfigSummary(config);

    expect(summary).toHaveProperty("workingDirectory");
    expect(summary).toHaveProperty("debug");
    expect(summary).toHaveProperty("logLevel");
    expect(summary).toHaveProperty("githubConfigured");
    expect(summary).toHaveProperty("claudeModel");
  });
});

describe("Global configuration functions", () => {
  beforeEach(() => {
    ConfigManager.getInstance().resetConfig();
  });

  it("should get global config", () => {
    const config = getConfig();
    expect(config).toHaveProperty("workingDirectory");
  });

  it("should update global config", () => {
    updateConfig({ debug: true });
    const config = getConfig();
    expect(config.debug).toBe(true);
  });

  it("should check debug mode", () => {
    updateConfig({ debug: true });
    expect(isDebugMode()).toBe(true);

    updateConfig({ debug: false });
    expect(isDebugMode()).toBe(false);
  });
});

describe("Configuration validation", () => {
  let manager: ConfigManager;

  beforeEach(() => {
    manager = ConfigManager.getInstance();
    manager.resetConfig();
  });

  it("should validate log level", () => {
    expect(() => {
      manager.updateConfig({ logLevel: "invalid" as "error" | "warn" | "info" | "debug" });
    }).toThrow();
  });

  it("should validate timeout values", () => {
    expect(() => {
      manager.updateConfig({
        github: { timeout: -1 },
      });
    }).toThrow();

    expect(() => {
      manager.updateConfig({
        claude: { timeout: 0 },
      });
    }).toThrow();
  });

  it("should validate worktree limits", () => {
    expect(() => {
      manager.updateConfig({
        worktree: { maxWorktrees: 0 },
      });
    }).toThrow();

    expect(() => {
      manager.updateConfig({
        worktree: { maxWorktrees: 100 },
      });
    }).toThrow();
  });

  it("should accept valid configurations", () => {
    expect(() => {
      manager.updateConfig({
        logLevel: "debug",
        github: { timeout: 30000 },
        worktree: { maxWorktrees: 5 },
      });
    }).not.toThrow();
  });
});
