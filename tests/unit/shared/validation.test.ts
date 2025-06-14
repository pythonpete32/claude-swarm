import { describe, expect, it } from "vitest";
import {
  CommonValidators,
  GitHubValidation,
  GitValidation,
  InputValidation,
  PathValidation,
  TmuxValidation,
  ValidationResultBuilder,
  Validator,
} from "../../../src/shared/validation";

describe("PathValidation", () => {
  describe("isValidDirectoryPath", () => {
    it("should accept valid paths", () => {
      expect(PathValidation.isValidDirectoryPath("./valid/path")).toBe(true);
      expect(PathValidation.isValidDirectoryPath("valid-path")).toBe(true);
      expect(PathValidation.isValidDirectoryPath("path/with/subdirs")).toBe(true);
    });

    it("should reject invalid paths", () => {
      expect(PathValidation.isValidDirectoryPath("")).toBe(false);
      expect(PathValidation.isValidDirectoryPath("path<>invalid")).toBe(false);
      expect(PathValidation.isValidDirectoryPath("path|invalid")).toBe(false);
      expect(PathValidation.isValidDirectoryPath("CON")).toBe(false); // Windows reserved
    });
  });

  describe("isValidWorktreePath", () => {
    it("should accept valid worktree paths", () => {
      expect(PathValidation.isValidWorktreePath("./worktrees/feature")).toBe(true);
      expect(PathValidation.isValidWorktreePath("worktrees/my-feature")).toBe(true);
    });

    it("should reject paths with parent traversal", () => {
      expect(PathValidation.isValidWorktreePath("../invalid")).toBe(false);
      expect(PathValidation.isValidWorktreePath("path/../traversal")).toBe(false);
    });
  });

  describe("sanitizePath", () => {
    it("should remove invalid characters", () => {
      const input = "path<>with|invalid*chars";
      const output = PathValidation.sanitizePath(input);
      expect(output).toBe("pathwithinvalidchars");
    });

    it("should remove parent traversal", () => {
      const input = "path/../traversal";
      const output = PathValidation.sanitizePath(input);
      expect(output).toBe("path/traversal");
    });
  });
});

describe("GitValidation", () => {
  describe("isValidBranchName", () => {
    it("should accept valid branch names", () => {
      expect(GitValidation.isValidBranchName("feature/new-feature")).toBe(true);
      expect(GitValidation.isValidBranchName("bugfix-123")).toBe(true);
      expect(GitValidation.isValidBranchName("main")).toBe(true);
    });

    it("should reject invalid branch names", () => {
      expect(GitValidation.isValidBranchName("")).toBe(false);
      expect(GitValidation.isValidBranchName(".hidden")).toBe(false);
      expect(GitValidation.isValidBranchName("branch..invalid")).toBe(false);
      expect(GitValidation.isValidBranchName("branch~invalid")).toBe(false);
      expect(GitValidation.isValidBranchName("branch.")).toBe(false);
      expect(GitValidation.isValidBranchName("branch/")).toBe(false);
    });
  });

  describe("isValidCommitSha", () => {
    it("should accept valid SHA formats", () => {
      expect(GitValidation.isValidCommitSha("abc123f")).toBe(true); // Short SHA
      expect(GitValidation.isValidCommitSha("abcdef1234567890abcdef1234567890abcdef12")).toBe(true); // Full SHA
    });

    it("should reject invalid SHAs", () => {
      expect(GitValidation.isValidCommitSha("")).toBe(false);
      expect(GitValidation.isValidCommitSha("xyz")).toBe(false); // Too short
      expect(GitValidation.isValidCommitSha("ghijkl")).toBe(false); // Invalid chars
    });
  });

  describe("isValidRemoteUrl", () => {
    it("should accept valid Git URLs", () => {
      expect(GitValidation.isValidRemoteUrl("https://github.com/user/repo.git")).toBe(true);
      expect(GitValidation.isValidRemoteUrl("git@github.com:user/repo.git")).toBe(true);
      expect(GitValidation.isValidRemoteUrl("ssh://git@example.com/repo.git")).toBe(true);
    });

    it("should reject invalid URLs", () => {
      expect(GitValidation.isValidRemoteUrl("")).toBe(false);
      expect(GitValidation.isValidRemoteUrl("invalid-url")).toBe(false);
      expect(GitValidation.isValidRemoteUrl("ftp://example.com/repo")).toBe(false);
    });
  });

  describe("sanitizeBranchName", () => {
    it("should sanitize invalid characters", () => {
      expect(GitValidation.sanitizeBranchName("feature~123")).toBe("feature-123");
      expect(GitValidation.sanitizeBranchName(".feature")).toBe("feature");
      expect(GitValidation.sanitizeBranchName("feature.")).toBe("feature");
    });

    it("should handle multiple consecutive invalid chars", () => {
      expect(GitValidation.sanitizeBranchName("feature~~123")).toBe("feature-123");
      expect(GitValidation.sanitizeBranchName("feature//branch")).toBe("feature/branch");
    });
  });
});

describe("GitHubValidation", () => {
  describe("isValidRepositoryName", () => {
    it("should accept valid repository names", () => {
      expect(GitHubValidation.isValidRepositoryName("my-repo")).toBe(true);
      expect(GitHubValidation.isValidRepositoryName("repo_name")).toBe(true);
      expect(GitHubValidation.isValidRepositoryName("repo.name")).toBe(true);
    });

    it("should reject invalid repository names", () => {
      expect(GitHubValidation.isValidRepositoryName("")).toBe(false);
      expect(GitHubValidation.isValidRepositoryName(".repo")).toBe(false);
      expect(GitHubValidation.isValidRepositoryName("repo.")).toBe(false);
      expect(GitHubValidation.isValidRepositoryName("repo@name")).toBe(false);
    });
  });

  describe("isValidUsername", () => {
    it("should accept valid usernames", () => {
      expect(GitHubValidation.isValidUsername("user")).toBe(true);
      expect(GitHubValidation.isValidUsername("user123")).toBe(true);
      expect(GitHubValidation.isValidUsername("user-name")).toBe(true);
    });

    it("should reject invalid usernames", () => {
      expect(GitHubValidation.isValidUsername("")).toBe(false);
      expect(GitHubValidation.isValidUsername("-user")).toBe(false);
      expect(GitHubValidation.isValidUsername("user-")).toBe(false);
      expect(GitHubValidation.isValidUsername("user@name")).toBe(false);
    });
  });

  describe("isValidToken", () => {
    it("should accept valid GitHub token formats", () => {
      // Use actual valid token formats with correct lengths
      expect(GitHubValidation.isValidToken("ghp_1234567890abcdef1234567890abcdef1234")).toBe(true);
      expect(GitHubValidation.isValidToken("ghs_1234567890abcdef1234567890abcdef1234")).toBe(true);
    });

    it("should reject invalid token formats", () => {
      expect(GitHubValidation.isValidToken("")).toBe(false);
      expect(GitHubValidation.isValidToken("invalid-token")).toBe(false);
      expect(GitHubValidation.isValidToken("ghp_short")).toBe(false);
    });
  });

  describe("isValidIssueNumber", () => {
    it("should accept valid issue numbers", () => {
      expect(GitHubValidation.isValidIssueNumber(1)).toBe(true);
      expect(GitHubValidation.isValidIssueNumber(123)).toBe(true);
      expect(GitHubValidation.isValidIssueNumber("456")).toBe(true);
    });

    it("should reject invalid issue numbers", () => {
      expect(GitHubValidation.isValidIssueNumber(0)).toBe(false);
      expect(GitHubValidation.isValidIssueNumber(-1)).toBe(false);
      expect(GitHubValidation.isValidIssueNumber(1000000000)).toBe(false);
      expect(GitHubValidation.isValidIssueNumber("invalid")).toBe(false);
    });
  });
});

describe("TmuxValidation", () => {
  describe("isValidSessionName", () => {
    it("should accept valid session names", () => {
      expect(TmuxValidation.isValidSessionName("session")).toBe(true);
      expect(TmuxValidation.isValidSessionName("session-123")).toBe(true);
      expect(TmuxValidation.isValidSessionName("session_name")).toBe(true);
    });

    it("should reject invalid session names", () => {
      expect(TmuxValidation.isValidSessionName("")).toBe(false);
      expect(TmuxValidation.isValidSessionName("session with spaces")).toBe(false);
      expect(TmuxValidation.isValidSessionName("session@invalid")).toBe(false);
    });
  });

  describe("sanitizeSessionName", () => {
    it("should sanitize invalid characters", () => {
      expect(TmuxValidation.sanitizeSessionName("session with spaces")).toBe("session-with-spaces");
      expect(TmuxValidation.sanitizeSessionName("session@name")).toBe("session-name");
    });

    it("should collapse multiple dashes", () => {
      expect(TmuxValidation.sanitizeSessionName("session--name")).toBe("session-name");
    });
  });
});

describe("InputValidation", () => {
  describe("isNonEmptyString", () => {
    it("should accept non-empty strings", () => {
      expect(InputValidation.isNonEmptyString("hello")).toBe(true);
      expect(InputValidation.isNonEmptyString("  world  ")).toBe(true);
    });

    it("should reject empty or non-string values", () => {
      expect(InputValidation.isNonEmptyString("")).toBe(false);
      expect(InputValidation.isNonEmptyString("   ")).toBe(false);
      expect(InputValidation.isNonEmptyString(null)).toBe(false);
      expect(InputValidation.isNonEmptyString(123)).toBe(false);
    });
  });

  describe("isPositiveInteger", () => {
    it("should accept positive integers", () => {
      expect(InputValidation.isPositiveInteger(1)).toBe(true);
      expect(InputValidation.isPositiveInteger(100)).toBe(true);
    });

    it("should reject non-positive or non-integer values", () => {
      expect(InputValidation.isPositiveInteger(0)).toBe(false);
      expect(InputValidation.isPositiveInteger(-1)).toBe(false);
      expect(InputValidation.isPositiveInteger(1.5)).toBe(false);
      expect(InputValidation.isPositiveInteger("1")).toBe(false);
    });
  });

  describe("isValidTimeout", () => {
    it("should accept valid timeout values", () => {
      expect(InputValidation.isValidTimeout(0)).toBe(true);
      expect(InputValidation.isValidTimeout(5000)).toBe(true);
      expect(InputValidation.isValidTimeout(300000)).toBe(true); // Max 5 minutes
    });

    it("should reject invalid timeout values", () => {
      expect(InputValidation.isValidTimeout(-1)).toBe(false);
      expect(InputValidation.isValidTimeout(300001)).toBe(false); // Over 5 minutes
      expect(InputValidation.isValidTimeout("5000")).toBe(false);
    });
  });
});

describe("ValidationResultBuilder", () => {
  it("should build validation results", () => {
    const builder = new ValidationResultBuilder();

    const result = builder.addError("Error 1").addError("Error 2").addWarning("Warning 1").build();

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(["Error 1", "Error 2"]);
    expect(result.warnings).toEqual(["Warning 1"]);
  });

  it("should handle conditional errors and warnings", () => {
    const builder = new ValidationResultBuilder();

    const result = builder
      .addErrorIf(true, "Conditional error")
      .addErrorIf(false, "Should not appear")
      .addWarningIf(true, "Conditional warning")
      .addWarningIf(false, "Should not appear")
      .build();

    expect(result.errors).toEqual(["Conditional error"]);
    expect(result.warnings).toEqual(["Conditional warning"]);
  });

  it("should reset builder state", () => {
    const builder = new ValidationResultBuilder();

    builder.addError("Error").addWarning("Warning");
    builder.reset();

    const result = builder.build();
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});

describe("Validator", () => {
  it("should validate with custom rules", () => {
    const validator = new Validator<string>()
      .addCustomRule("non-empty", (value) => value.length > 0, "Value cannot be empty")
      .addCustomRule("max-length", (value) => value.length <= 10, "Value too long");

    const validResult = validator.validate("hello");
    expect(validResult.isValid).toBe(true);

    const emptyResult = validator.validate("");
    expect(emptyResult.isValid).toBe(false);
    expect(emptyResult.errors).toContain("Value cannot be empty");

    const longResult = validator.validate("this is too long");
    expect(longResult.isValid).toBe(false);
    expect(longResult.errors).toContain("Value too long");
  });

  it("should validate and throw on error", () => {
    const validator = new Validator<string>().addCustomRule(
      "non-empty",
      (value) => value.length > 0,
      "Value cannot be empty",
    );

    expect(() => validator.validateOrThrow("hello")).not.toThrow();
    expect(() => validator.validateOrThrow("")).toThrow();
  });
});

describe("CommonValidators", () => {
  it("should validate worktree paths", () => {
    const validator = CommonValidators.worktreePath();

    const validResult = validator.validate("./worktrees/feature");
    expect(validResult.isValid).toBe(true);
    expect(validResult.errors).toEqual([]);

    const invalidResult = validator.validate("");
    expect(invalidResult.isValid).toBe(false);
  });

  it("should validate branch names", () => {
    const validator = CommonValidators.branchName();

    const validResult = validator.validate("feature/new-feature");
    expect(validResult.isValid).toBe(true);

    const invalidResult = validator.validate(".invalid");
    expect(invalidResult.isValid).toBe(false);
  });

  it("should validate GitHub repositories", () => {
    const validator = CommonValidators.githubRepository();

    const validResult = validator.validate({ owner: "user", name: "repo" });
    expect(validResult.isValid).toBe(true);

    const invalidResult = validator.validate({ owner: "-invalid", name: "repo" });
    expect(invalidResult.isValid).toBe(false);
  });

  it("should validate tmux sessions", () => {
    const validator = CommonValidators.tmuxSession();

    const validResult = validator.validate("session-name");
    expect(validResult.isValid).toBe(true);

    const invalidResult = validator.validate("session with spaces");
    expect(invalidResult.isValid).toBe(false);
  });
});
