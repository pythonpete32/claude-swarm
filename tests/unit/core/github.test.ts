/**
 * Unit tests for core GitHub module
 *
 * Tests all GitHub API operations with mocked API execution
 * to ensure isolation and deterministic results.
 * Uses Test-Driven Development (TDD) methodology.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODES } from "../../../src/shared/errors";
import type { GitBranchInfo, RepositoryInfo } from "../../../src/shared/types";

// Import interfaces that will be defined in the implementation
import type {
  CloneRepositoryOptions,
  CreateIssueOptions,
  CreatePullRequestOptions,
  CreateRepositoryOptions,
  GitHubAPIInterface,
  GitHubAuthOptions,
  GitHubAuthResult,
  GitHubIssueInfo,
  GitHubLabel,
  GitHubPullRequestInfo,
  GitHubRateLimit,
  GitHubResponse,
  GitHubUser,
  PaginationOptions,
  RepositoryCloneResult,
  RequestOptions,
  SearchIssuesOptions,
  SearchRepositoriesOptions,
  UpdateIssueOptions,
  UpdatePullRequestOptions,
  WebhookValidationOptions,
} from "../../../src/core/github";

// Import functions to be implemented
import {
  authenticateGitHub,
  checkRateLimit,
  cloneRepository,
  createIssue,
  createPullRequest,
  createRepository,
  getIssueDetails,
  getPullRequestDetails,
  getRepositoryInfo,
  listRepositoryIssues,
  searchRepositories,
  updateIssueStatus,
  updatePullRequestStatus,
  validateWebhookSignature,
} from "../../../src/core/github";

// Mock GitHub API for testing
class MockGitHubAPI implements GitHubAPIInterface {
  private authState: GitHubAuthResult | null = null;
  private repositories = new Map<string, any>();
  private issues = new Map<string, any>();
  private pullRequests = new Map<string, any>();
  private rateLimit: GitHubRateLimit = {
    limit: 5000,
    remaining: 4999,
    resetTime: new Date(Date.now() + 3600000),
    resource: "core",
  };
  private shouldThrow = new Map<string, Error>();
  private callLog: Array<{ method: string; args: unknown[] }> = [];

  constructor() {
    this.reset();
  }

  // Mock data setup methods
  setAuth(authResult: GitHubAuthResult): void {
    this.authState = authResult;
  }

  setRepository(identifier: string, repository: any): void {
    this.repositories.set(identifier, repository);
  }

  setIssue(repoIdentifier: string, issueNumber: number, issue: any): void {
    this.issues.set(`${repoIdentifier}:${issueNumber}`, issue);
  }

  setPullRequest(repoIdentifier: string, prNumber: number, pr: any): void {
    this.pullRequests.set(`${repoIdentifier}:${prNumber}`, pr);
  }

  setRateLimit(rateLimit: Partial<GitHubRateLimit>): void {
    this.rateLimit = { ...this.rateLimit, ...rateLimit };
  }

  setError(method: string, identifier: string, error: Error): void {
    this.shouldThrow.set(`${method}:${identifier}`, error);
  }

  getCallLog(): Array<{ method: string; args: unknown[] }> {
    return [...this.callLog];
  }

  getRepository(identifier: string): any {
    return this.repositories.get(identifier);
  }

  reset(): void {
    this.authState = null;
    this.repositories.clear();
    this.issues.clear();
    this.pullRequests.clear();
    this.shouldThrow.clear();
    this.callLog = [];
    this.rateLimit = {
      limit: 5000,
      remaining: 4999,
      resetTime: new Date(Date.now() + 3600000),
      resource: "core",
    };

    // Set up default test data
    this.setRepository("octocat/Hello-World", {
      id: "1296269",
      node_id: "MDEwOlJlcG9zaXRvcnkxMjk2MjY5",
      name: "Hello-World",
      full_name: "octocat/Hello-World",
      private: false,
      owner: {
        login: "octocat",
        id: "1",
        avatar_url: "https://github.com/images/error/octocat_happy.gif",
        html_url: "https://github.com/octocat",
        type: "User",
      },
      html_url: "https://github.com/octocat/Hello-World",
      description: "This your first repo!",
      fork: false,
      default_branch: "main",
      clone_url: "https://github.com/octocat/Hello-World.git",
      ssh_url: "git@github.com:octocat/Hello-World.git",
      stargazers_count: 80,
      forks_count: 9,
      language: "JavaScript",
      topics: ["javascript", "nodejs"],
    });

    // Set up default issue data
    this.setIssue("octocat/Hello-World", 1, {
      id: "1",
      number: 1,
      title: "Found a bug",
      body: "I'm having a problem with this.",
      state: "open",
      labels: [{ id: "1", name: "bug", color: "d73a4a" }],
      assignees: [
        {
          login: "octocat",
          id: "1",
          avatar_url: "https://github.com/images/error/octocat_happy.gif",
          html_url: "https://github.com/octocat",
        },
      ],
      milestone: null,
      user: {
        login: "octocat",
        id: "1",
        avatar_url: "https://github.com/images/error/octocat_happy.gif",
        html_url: "https://github.com/octocat",
      },
      created_at: "2023-01-01T00:00:00Z",
      updated_at: "2023-01-01T00:00:00Z",
      closed_at: null,
      comments: 5,
      html_url: "https://github.com/octocat/Hello-World/issues/1",
    });
  }

  // GitHubAPIInterface implementation
  async authenticate(options: GitHubAuthOptions): Promise<GitHubAuthResult> {
    this.callLog.push({ method: "authenticate", args: [options] });

    const error = this.shouldThrow.get(`authenticate:${options.token || "default"}`);
    if (error) throw error;

    if (!options.token && options.type !== "device") {
      throw new Error("Authentication failed: No token provided");
    }

    if (options.token === "invalid_token") {
      throw new Error("Bad credentials");
    }

    const authResult: GitHubAuthResult = {
      success: true,
      type: options.type || "token",
      login: "test-user",
      scopes: ["repo", "user"],
      rateLimit: this.rateLimit,
      expiresAt: options.type === "token" ? undefined : new Date(Date.now() + 86400000),
    };

    this.authState = authResult;
    return authResult;
  }

  async request<T>(endpoint: string, options?: RequestOptions): Promise<GitHubResponse<T>> {
    this.callLog.push({ method: "request", args: [endpoint, options] });

    const error = this.shouldThrow.get(`request:${endpoint}`);
    if (error) throw error;

    // Simulate rate limit headers
    const headers = {
      "x-ratelimit-limit": this.rateLimit.limit.toString(),
      "x-ratelimit-remaining": this.rateLimit.remaining.toString(),
      "x-ratelimit-reset": Math.floor(this.rateLimit.resetTime.getTime() / 1000).toString(),
    };

    // Handle different endpoints
    if (endpoint.includes("/repos/")) {
      const repoMatch = endpoint.match(/\/repos\/([^\/]+\/[^\/]+)/);
      if (repoMatch) {
        const repoIdentifier = repoMatch[1];

        // Handle issue endpoints
        const issueMatch = endpoint.match(/\/repos\/([^\/]+\/[^\/]+)\/issues\/(\d+)/);
        if (issueMatch) {
          const issueNumber = Number.parseInt(issueMatch[2]);
          const issueData = this.issues.get(`${repoIdentifier}:${issueNumber}`);

          if (!issueData) {
            const notFoundError = new Error("Not Found");
            (notFoundError as any).status = 404;
            throw notFoundError;
          }

          return {
            data: issueData as T,
            status: 200,
            headers,
            url: endpoint,
            rateLimit: this.rateLimit,
          };
        }

        // Handle create issue/PR endpoints
        if (endpoint.includes("/issues") && options?.method === "POST") {
          const newIssue = {
            id: "999",
            number: 999,
            title: (options.body as any)?.title || "New Issue",
            body: (options.body as any)?.body || "",
            state: "open",
            labels:
              (options.body as any)?.labels?.map((name: string) => ({
                id: "999",
                name,
                color: "d73a4a",
              })) || [],
            assignees:
              (options.body as any)?.assignees?.map((login: string) => ({
                login,
                id: "999",
                avatar_url: "https://github.com/images/error/octocat_happy.gif",
                html_url: `https://github.com/${login}`,
              })) || [],
            user: {
              login: "octocat",
              id: "1",
              avatar_url: "https://github.com/images/error/octocat_happy.gif",
              html_url: "https://github.com/octocat",
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            comments: 0,
            html_url: `https://github.com/${repoIdentifier}/issues/999`,
          };

          return {
            data: newIssue as T,
            status: 201,
            headers,
            url: endpoint,
            rateLimit: this.rateLimit,
          };
        }

        if (endpoint.includes("/pulls") && options?.method === "POST") {
          const newPR = {
            id: "999",
            number: 999,
            title: (options.body as any)?.title || "New PR",
            body: (options.body as any)?.body || "",
            state: "open",
            head: {
              ref: (options.body as any)?.head || "feature/test",
              sha: "abc123",
              user: {
                login: "octocat",
                id: "1",
                avatar_url: "https://github.com/images/error/octocat_happy.gif",
                html_url: "https://github.com/octocat",
              },
            },
            base: {
              ref: (options.body as any)?.base || "main",
              sha: "def456",
              user: {
                login: "octocat",
                id: "1",
                avatar_url: "https://github.com/images/error/octocat_happy.gif",
                html_url: "https://github.com/octocat",
              },
            },
            user: {
              login: "octocat",
              id: "1",
              avatar_url: "https://github.com/images/error/octocat_happy.gif",
              html_url: "https://github.com/octocat",
            },
            assignees: [],
            requested_reviewers: [],
            labels: [],
            draft: (options.body as any)?.draft || false,
            mergeable: true,
            rebaseable: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            commits: 1,
            additions: 10,
            deletions: 5,
            changed_files: 2,
            html_url: `https://github.com/${repoIdentifier}/pull/999`,
          };

          return {
            data: newPR as T,
            status: 201,
            headers,
            url: endpoint,
            rateLimit: this.rateLimit,
          };
        }

        const repoData = this.repositories.get(repoIdentifier);

        if (!repoData) {
          const notFoundError = new Error("Not Found");
          (notFoundError as any).status = 404;
          throw notFoundError;
        }

        return {
          data: repoData as T,
          status: 200,
          headers,
          url: endpoint,
          rateLimit: this.rateLimit,
        };
      }
    }

    if (endpoint.includes("/rate_limit")) {
      return {
        data: {
          resources: {
            core: this.rateLimit,
          },
        } as T,
        status: 200,
        headers,
        url: endpoint,
        rateLimit: this.rateLimit,
      };
    }

    // Default mock response
    return {
      data: {} as T,
      status: 200,
      headers,
      url: endpoint,
      rateLimit: this.rateLimit,
    };
  }

  async *paginate<T>(
    endpoint: string,
    options?: PaginationOptions,
  ): AsyncGenerator<T[], void, unknown> {
    this.callLog.push({ method: "paginate", args: [endpoint, options] });

    const error = this.shouldThrow.get(`paginate:${endpoint}`);
    if (error) throw error;

    // Mock pagination - return mock issues data
    if (endpoint.includes("/issues")) {
      // Check for state filter in the endpoint
      const isClosedState = endpoint.includes("state=closed");

      if (isClosedState) {
        // Return empty for closed issues
        yield [] as T[];
      } else {
        const mockIssues = [
          {
            id: "1",
            number: 1,
            title: "Found a bug",
            body: "I'm having a problem with this.",
            state: "open",
            labels: [{ id: "1", name: "bug", color: "d73a4a" }],
            assignees: [],
            user: {
              login: "octocat",
              id: "1",
              avatar_url: "https://github.com/images/error/octocat_happy.gif",
              html_url: "https://github.com/octocat",
            },
            created_at: "2023-01-01T00:00:00Z",
            updated_at: "2023-01-01T00:00:00Z",
            comments: 0,
            html_url: "https://github.com/octocat/Hello-World/issues/1",
          },
        ];
        yield mockIssues as T[];
      }
    } else {
      // Default empty page
      yield [] as T[];
    }
  }

  async getRateLimit(): Promise<GitHubRateLimit> {
    this.callLog.push({ method: "getRateLimit", args: [] });

    const error = this.shouldThrow.get("getRateLimit:");
    if (error) throw error;

    return this.rateLimit;
  }

  validateWebhook(payload: string, signature: string, secret: string): boolean {
    this.callLog.push({ method: "validateWebhook", args: [payload, signature, secret] });

    const error = this.shouldThrow.get(`validateWebhook:${secret}`);
    if (error) throw error;

    // Simple validation - return false for wrong_secret to trigger error
    if (secret === "wrong_secret") {
      return false;
    }

    // Simple validation - check if signature contains expected hash
    return signature.includes("sha256=") && secret.length > 0;
  }
}

// Mock Git Operations for integration testing
class MockGitOperations {
  private callLog: Array<{ method: string; args: unknown[] }> = [];
  private shouldThrow = new Map<string, Error>();

  setError(method: string, path: string, error: Error): void {
    this.shouldThrow.set(`${method}:${path}`, error);
  }

  getCallLog(): Array<{ method: string; args: unknown[] }> {
    return [...this.callLog];
  }

  reset(): void {
    this.callLog = [];
    this.shouldThrow.clear();
  }

  async clone(url: string, path: string, options?: any): Promise<any> {
    this.callLog.push({ method: "clone", args: [url, path, options] });

    const error = this.shouldThrow.get(`clone:${path}`);
    if (error) throw error;

    return {
      success: true,
      path,
      branch: options?.branch || "main",
      commit: "abc123def456",
    };
  }
}

// Mock File System for testing
class MockFileSystem {
  private files = new Set<string>();
  private callLog: Array<{ method: string; args: unknown[] }> = [];

  setFileExists(path: string, exists: boolean): void {
    if (exists) {
      this.files.add(path);
    } else {
      this.files.delete(path);
    }
  }

  getCallLog(): Array<{ method: string; args: unknown[] }> {
    return [...this.callLog];
  }

  reset(): void {
    this.files.clear();
    this.callLog = [];
  }

  async exists(path: string): Promise<boolean> {
    this.callLog.push({ method: "exists", args: [path] });
    return this.files.has(path);
  }

  async mkdir(path: string): Promise<void> {
    this.callLog.push({ method: "mkdir", args: [path] });
    this.files.add(path);
  }
}

describe("core-github", () => {
  let mockGitHubAPI: MockGitHubAPI;
  let mockGitOps: MockGitOperations;
  let mockFileSystem: MockFileSystem;

  beforeEach(() => {
    mockGitHubAPI = new MockGitHubAPI();
    mockGitOps = new MockGitOperations();
    mockFileSystem = new MockFileSystem();
  });

  describe("authenticateGitHub (TDD Phase 2)", () => {
    it("should authenticate with valid token", async () => {
      // Arrange
      const authOptions: GitHubAuthOptions = {
        token: "ghp_test_token",
        type: "token",
      };

      // Act
      const result = await authenticateGitHub(authOptions, mockGitHubAPI);

      // Assert
      expect(result.success).toBe(true);
      expect(result.type).toBe("token");
      expect(result.login).toBe("test-user");
      expect(result.scopes).toContain("repo");
      expect(result.rateLimit).toBeDefined();

      // Verify API was called
      const apiCalls = mockGitHubAPI.getCallLog();
      expect(apiCalls).toContainEqual(expect.objectContaining({ method: "authenticate" }));
    });

    it("should handle invalid token gracefully", async () => {
      // Arrange
      const authOptions: GitHubAuthOptions = {
        token: "invalid_token",
        type: "token",
      };

      // Act & Assert
      await expect(authenticateGitHub(authOptions, mockGitHubAPI)).rejects.toThrow(
        "GITHUB_AUTH_FAILED",
      );
    });

    it("should support device flow authentication", async () => {
      // Arrange
      const authOptions: GitHubAuthOptions = {
        type: "device",
        deviceCode: "device_code_123",
      };

      // Act
      const result = await authenticateGitHub(authOptions, mockGitHubAPI);

      // Assert
      expect(result.success).toBe(true);
      expect(result.type).toBe("device");
      expect(result.expiresAt).toBeDefined();
    });

    it("should cache authentication state", async () => {
      // Arrange
      const authOptions: GitHubAuthOptions = {
        token: "ghp_test_token",
        type: "token",
      };

      // Act
      const result1 = await authenticateGitHub(authOptions, mockGitHubAPI);
      const result2 = await authenticateGitHub(authOptions, mockGitHubAPI);

      // Assert
      expect(result1.login).toBe(result2.login);
      expect(result1.scopes).toEqual(result2.scopes);
    });

    it("should validate authentication options", async () => {
      // Act & Assert
      await expect(authenticateGitHub({}, mockGitHubAPI)).rejects.toThrow("validation");
    });
  });

  describe("getRepositoryInfo (TDD Phase 2)", () => {
    it("should retrieve repository information with GitHub extensions", async () => {
      // Arrange
      const repoIdentifier = "octocat/Hello-World";

      // Act
      const result = await getRepositoryInfo(repoIdentifier, mockGitHubAPI);

      // Assert
      expect(result.owner).toBe("octocat");
      expect(result.name).toBe("Hello-World");
      expect(result.defaultBranch).toBe("main");
      expect(result.remoteUrl).toBe("https://github.com/octocat/Hello-World.git");
      expect(result.github).toBeDefined();
      expect(result.github?.isPrivate).toBe(false);
      expect(result.github?.isFork).toBe(false);
    });

    it("should handle private repository access", async () => {
      // Arrange
      const privateRepo = {
        ...mockGitHubAPI.getRepository("octocat/Hello-World"),
        private: true,
      };
      mockGitHubAPI.setRepository("octocat/private-repo", privateRepo);

      // Act
      const result = await getRepositoryInfo("octocat/private-repo", mockGitHubAPI);

      // Assert
      expect(result.github?.isPrivate).toBe(true);
    });

    it("should handle repository not found errors", async () => {
      // Act & Assert
      await expect(getRepositoryInfo("nonexistent/repo", mockGitHubAPI)).rejects.toThrow(
        "GITHUB_REPOSITORY_NOT_FOUND",
      );
    });

    it("should extract owner and name from various URL formats", async () => {
      // Test cases for different URL formats
      const testCases = [
        "https://github.com/octocat/Hello-World",
        "https://github.com/octocat/Hello-World.git",
        "git@github.com:octocat/Hello-World.git",
        "octocat/Hello-World",
      ];

      for (const url of testCases) {
        // Act
        const result = await getRepositoryInfo(url, mockGitHubAPI);

        // Assert
        expect(result.owner).toBe("octocat");
        expect(result.name).toBe("Hello-World");
      }
    });

    it("should validate repository identifier format", async () => {
      // Act & Assert
      await expect(getRepositoryInfo("", mockGitHubAPI)).rejects.toThrow("validation");
      await expect(getRepositoryInfo("invalid", mockGitHubAPI)).rejects.toThrow("validation");
    });
  });

  describe("checkRateLimit (TDD Phase 2)", () => {
    it("should return current rate limit status", async () => {
      // Act
      const result = await checkRateLimit(mockGitHubAPI);

      // Assert
      expect(result.limit).toBe(5000);
      expect(result.remaining).toBe(4999);
      expect(result.resetTime).toBeInstanceOf(Date);
      expect(result.resource).toBe("core");
    });

    it("should handle rate limit API errors", async () => {
      // Arrange
      mockGitHubAPI.setError("getRateLimit", "", new Error("API Error"));

      // Act & Assert
      await expect(checkRateLimit(mockGitHubAPI)).rejects.toThrow("Failed to check rate limit");
    });

    it("should return rate limit from different resources", async () => {
      // Arrange
      mockGitHubAPI.setRateLimit({
        resource: "search",
        limit: 30,
        remaining: 25,
      });

      // Act
      const result = await checkRateLimit(mockGitHubAPI);

      // Assert
      expect(result.resource).toBe("search");
      expect(result.limit).toBe(30);
      expect(result.remaining).toBe(25);
    });
  });

  describe("listRepositoryIssues (TDD Phase 3)", () => {
    beforeEach(() => {
      // Set up test issues
      mockGitHubAPI.setIssue("octocat/Hello-World", 1, {
        id: "1",
        number: 1,
        title: "Found a bug",
        body: "I'm having a problem with this.",
        state: "open",
        labels: [{ id: "1", name: "bug", color: "d73a4a" }],
        assignees: [],
        user: { login: "octocat", id: "1" },
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-01-01T00:00:00Z",
        comments: 0,
        html_url: "https://github.com/octocat/Hello-World/issues/1",
      });
    });

    it("should list repository issues with default options", async () => {
      // Act
      const issues = await listRepositoryIssues("octocat/Hello-World", {}, mockGitHubAPI);

      // Assert
      expect(issues).toHaveLength(1);
      expect(issues[0].title).toBe("Found a bug");
      expect(issues[0].state).toBe("open");
    });

    it("should filter issues by state", async () => {
      // Arrange
      const options: SearchIssuesOptions = { state: "closed" };

      // Act
      const issues = await listRepositoryIssues("octocat/Hello-World", options, mockGitHubAPI);

      // Assert - should return empty for closed issues
      expect(issues).toHaveLength(0);
    });

    it("should filter issues by labels", async () => {
      // Arrange
      const options: SearchIssuesOptions = { labels: ["bug"] };

      // Act
      const issues = await listRepositoryIssues("octocat/Hello-World", options, mockGitHubAPI);

      // Assert
      expect(issues).toHaveLength(1);
      expect(issues[0].labels).toContainEqual(expect.objectContaining({ name: "bug" }));
    });

    it("should handle pagination", async () => {
      // Arrange
      const options: SearchIssuesOptions = { perPage: 50, page: 1 };

      // Act
      const issues = await listRepositoryIssues("octocat/Hello-World", options, mockGitHubAPI);

      // Assert
      expect(issues).toBeDefined();
      const apiCalls = mockGitHubAPI.getCallLog();
      expect(apiCalls).toContainEqual(expect.objectContaining({ method: "paginate" }));
    });

    it("should validate repository identifier", async () => {
      // Act & Assert
      await expect(listRepositoryIssues("", {}, mockGitHubAPI)).rejects.toThrow("validation");
    });
  });

  describe("getIssueDetails (TDD Phase 3)", () => {
    beforeEach(() => {
      mockGitHubAPI.setIssue("octocat/Hello-World", 1, {
        id: "1",
        number: 1,
        title: "Found a bug",
        body: "I'm having a problem with this.",
        state: "open",
        labels: [{ id: "1", name: "bug", color: "d73a4a" }],
        assignees: [{ login: "octocat", id: "1" }],
        milestone: null,
        user: { login: "octocat", id: "1" },
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-01-01T00:00:00Z",
        closed_at: null,
        comments: 5,
        html_url: "https://github.com/octocat/Hello-World/issues/1",
      });
    });

    it("should retrieve detailed issue information", async () => {
      // Act
      const issue = await getIssueDetails("octocat/Hello-World", 1, mockGitHubAPI);

      // Assert
      expect(issue.id).toBe("1");
      expect(issue.number).toBe(1);
      expect(issue.title).toBe("Found a bug");
      expect(issue.state).toBe("open");
      expect(issue.comments).toBe(5);
      expect(issue.assignees).toHaveLength(1);
      expect(issue.labels).toHaveLength(1);
    });

    it("should handle non-existent issue", async () => {
      // Act & Assert
      await expect(getIssueDetails("octocat/Hello-World", 999, mockGitHubAPI)).rejects.toThrow(
        "GITHUB_REPOSITORY_NOT_FOUND",
      );
    });

    it("should validate issue number", async () => {
      // Act & Assert
      await expect(getIssueDetails("octocat/Hello-World", 0, mockGitHubAPI)).rejects.toThrow(
        "validation",
      );
      await expect(getIssueDetails("octocat/Hello-World", -1, mockGitHubAPI)).rejects.toThrow(
        "validation",
      );
    });
  });

  describe("createIssue (TDD Phase 3)", () => {
    it("should create issue with required fields", async () => {
      // Arrange
      const options: CreateIssueOptions = {
        title: "New bug report",
        body: "Description of the bug",
        labels: ["bug"],
        assignees: ["octocat"],
      };

      // Act
      const result = await createIssue("octocat/Hello-World", options, mockGitHubAPI);

      // Assert
      expect(result.success).toBe(true);
      expect(result.issue.title).toBe("New bug report");
      expect(result.issue.state).toBe("open");
    });

    it("should handle issue creation errors", async () => {
      // Arrange
      mockGitHubAPI.setError(
        "request",
        "/repos/octocat/Hello-World/issues",
        new Error("API Error"),
      );

      const options: CreateIssueOptions = {
        title: "Test issue",
      };

      // Act & Assert
      await expect(createIssue("octocat/Hello-World", options, mockGitHubAPI)).rejects.toThrow(
        "GITHUB_API_ERROR",
      );
    });

    it("should validate issue creation options", async () => {
      // Act & Assert
      await expect(
        createIssue("octocat/Hello-World", { title: "" }, mockGitHubAPI),
      ).rejects.toThrow("validation");
    });
  });

  describe("createPullRequest (TDD Phase 4)", () => {
    it("should create PR with proper branch validation", async () => {
      // Arrange
      const options: CreatePullRequestOptions = {
        title: "Fix bug in authentication",
        body: "This PR fixes the authentication bug",
        head: "feature/fix-auth",
        base: "main",
        draft: false,
      };

      // Act
      const result = await createPullRequest("octocat/Hello-World", options, mockGitHubAPI);

      // Assert
      expect(result.success).toBe(true);
      expect(result.pullRequest.title).toBe("Fix bug in authentication");
      expect(result.pullRequest.state).toBe("open");
      expect(result.pullRequest.draft).toBe(false);
    });

    it("should handle duplicate PR creation", async () => {
      // Arrange
      const options: CreatePullRequestOptions = {
        title: "Duplicate PR",
        head: "feature/duplicate",
        base: "main",
      };

      // Mock existing PR error
      const duplicateError = new Error("A pull request already exists");
      (duplicateError as any).status = 422;
      mockGitHubAPI.setError("request", "/repos/octocat/Hello-World/pulls", duplicateError);

      // Act & Assert
      await expect(
        createPullRequest("octocat/Hello-World", options, mockGitHubAPI),
      ).rejects.toThrow("GITHUB_API_ERROR");
    });

    it("should validate branch relationships", async () => {
      // Act & Assert
      await expect(
        createPullRequest(
          "octocat/Hello-World",
          { title: "Test", head: "", base: "main" },
          mockGitHubAPI,
        ),
      ).rejects.toThrow("validation");

      await expect(
        createPullRequest(
          "octocat/Hello-World",
          { title: "Test", head: "feature", base: "" },
          mockGitHubAPI,
        ),
      ).rejects.toThrow("validation");
    });
  });

  describe("cloneRepository (TDD Phase 5)", () => {
    it("should clone repository with authentication", async () => {
      // Arrange
      const options: CloneRepositoryOptions = {
        targetPath: "/test/clone/path",
        branch: "main",
        depth: 1,
      };

      // Act
      const result = await cloneRepository(
        "https://github.com/octocat/Hello-World.git",
        options,
        mockGitHubAPI,
        mockGitOps,
        mockFileSystem,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.path).toBe("/test/clone/path");
      expect(result.repository.name).toBe("Hello-World");
      expect(result.branch).toBe("main");

      // Verify Git operations were called
      const gitCalls = mockGitOps.getCallLog();
      expect(gitCalls).toContainEqual(expect.objectContaining({ method: "clone" }));
    });

    it("should handle existing path conflicts", async () => {
      // Arrange
      mockFileSystem.setFileExists("/existing/path", true);
      const options: CloneRepositoryOptions = {
        targetPath: "/existing/path",
      };

      // Act & Assert
      await expect(
        cloneRepository(
          "https://github.com/octocat/Hello-World.git",
          options,
          mockGitHubAPI,
          mockGitOps,
          mockFileSystem,
        ),
      ).rejects.toThrow("FILE_ALREADY_EXISTS");
    });

    it("should validate repository URL", async () => {
      // Act & Assert
      await expect(
        cloneRepository("", {}, mockGitHubAPI, mockGitOps, mockFileSystem),
      ).rejects.toThrow("validation");

      await expect(
        cloneRepository("invalid-url", {}, mockGitHubAPI, mockGitOps, mockFileSystem),
      ).rejects.toThrow("validation");
    });
  });

  describe("validateWebhookSignature (TDD Phase 6)", () => {
    it("should validate correct webhook signature", async () => {
      // Arrange
      const options: WebhookValidationOptions = {
        payload: '{"action":"opened","number":1}',
        signature: "sha256=abc123def456",
        secret: "webhook_secret",
      };

      // Act
      const result = await validateWebhookSignature(options, mockGitHubAPI);

      // Assert
      expect(result).toBe(true);
    });

    it("should reject invalid webhook signature", async () => {
      // Arrange
      const options: WebhookValidationOptions = {
        payload: '{"action":"opened","number":1}',
        signature: "sha256=invalid",
        secret: "wrong_secret",
      };

      // Act & Assert
      await expect(validateWebhookSignature(options, mockGitHubAPI)).rejects.toThrow(
        "GITHUB_PERMISSION_DENIED",
      );
    });

    it("should validate webhook options", async () => {
      // Act & Assert
      await expect(
        validateWebhookSignature({ payload: "", signature: "", secret: "" }, mockGitHubAPI),
      ).rejects.toThrow("validation");
    });
  });
});
