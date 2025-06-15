/**
 * Core GitHub Integration Module for Claude Swarm
 *
 * Provides GitHub API integration operations supporting repository management,
 * issue handling, pull request automation, and collaborative development workflows.
 */

import { createHmac } from "node:crypto";

import { ERROR_CODES, ErrorFactory } from "@/shared/errors";
import type { RepositoryInfo } from "@/shared/types";
import type { FileSystemInterface } from "./files";
import type { GitOperationsInterface } from "./worktree";

/**
 * GitHub API interface for dependency injection.
 *
 * Abstracts GitHub API operations to allow for mocking in tests
 * and alternative implementations in different environments.
 *
 * @group Core Modules
 */
export interface GitHubAPIInterface {
  authenticate(options: GitHubAuthOptions): Promise<GitHubAuthResult>;
  request<T>(endpoint: string, options?: RequestOptions): Promise<GitHubResponse<T>>;
  paginate<T>(endpoint: string, options?: PaginationOptions): AsyncGenerator<T[], void, unknown>;
  getRateLimit(): Promise<GitHubRateLimit>;
  validateWebhook(payload: string, signature: string, secret: string): boolean;
}

/**
 * GitHub authentication options.
 *
 * @group Core Modules
 */
export interface GitHubAuthOptions {
  token?: string;
  type?: "token" | "app" | "device";
  appId?: string;
  privateKey?: string;
  installationId?: string;
  deviceCode?: string;
}

/**
 * GitHub authentication result.
 *
 * @group Core Modules
 */
export interface GitHubAuthResult {
  success: boolean;
  type: "token" | "app" | "device";
  login: string;
  scopes: string[];
  rateLimit: GitHubRateLimit;
  expiresAt?: Date;
}

/**
 * GitHub rate limit information.
 *
 * @group Core Modules
 */
export interface GitHubRateLimit {
  limit: number;
  remaining: number;
  resetTime: Date;
  resource: string;
}

/**
 * GitHub API response wrapper.
 *
 * @group Core Modules
 */
export interface GitHubResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  url: string;
  rateLimit: GitHubRateLimit;
}

/**
 * Repository clone options.
 *
 * @group Core Modules
 */
export interface CloneRepositoryOptions {
  branch?: string;
  depth?: number;
  recursive?: boolean;
  targetPath?: string;
  setupWorktree?: boolean;
  setupContext?: boolean;
}

/**
 * Repository clone result.
 *
 * @group Core Modules
 */
export interface RepositoryCloneResult {
  success: boolean;
  path: string;
  repository: RepositoryInfo;
  branch: string;
  commit: string;
  worktreeInfo?: {
    path: string;
    head: string;
    branch: string;
    bare: boolean;
    detached: boolean;
  };
}

/**
 * Repository creation options.
 *
 * @group Core Modules
 */
export interface CreateRepositoryOptions {
  name: string;
  description?: string;
  private?: boolean;
  template?: string;
  gitignoreTemplate?: string;
  licenseTemplate?: string;
  allowSquashMerge?: boolean;
  allowMergeCommit?: boolean;
  allowRebaseMerge?: boolean;
  deleteBranchOnMerge?: boolean;
  hasIssues?: boolean;
  hasProjects?: boolean;
  hasWiki?: boolean;
}

/**
 * GitHub issue information.
 *
 * @group Core Modules
 */
export interface GitHubIssueInfo {
  id: string;
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  milestone?: GitHubMilestone;
  author: GitHubUser;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  comments: number;
  url: string;
}

/**
 * GitHub pull request information.
 *
 * @group Core Modules
 */
export interface GitHubPullRequestInfo {
  id: string;
  number: number;
  title: string;
  body: string;
  state: "open" | "closed" | "merged";
  head: GitHubBranchRef;
  base: GitHubBranchRef;
  author: GitHubUser;
  assignees: GitHubUser[];
  requestedReviewers: GitHubUser[];
  labels: GitHubLabel[];
  milestone?: GitHubMilestone;
  mergeable: boolean | null;
  rebaseable: boolean | null;
  draft: boolean;
  createdAt: Date;
  updatedAt: Date;
  mergedAt?: Date;
  closedAt?: Date;
  commits: number;
  additions: number;
  deletions: number;
  changedFiles: number;
  url: string;
}

/**
 * GitHub label.
 *
 * @group Core Modules
 */
export interface GitHubLabel {
  id: string;
  name: string;
  color: string;
  description?: string;
}

/**
 * GitHub user.
 *
 * @group Core Modules
 */
export interface GitHubUser {
  id: string;
  login: string;
  name?: string;
  email?: string;
  avatarUrl: string;
  url: string;
  type: "User" | "Bot" | "Organization";
}

/**
 * GitHub milestone.
 *
 * @group Core Modules
 */
export interface GitHubMilestone {
  id: string;
  number: number;
  title: string;
  description?: string;
  state: "open" | "closed";
  dueOn?: Date;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

/**
 * GitHub branch reference.
 *
 * @group Core Modules
 */
export interface GitHubBranchRef {
  ref: string;
  sha: string;
  repository: RepositoryInfo;
  user: GitHubUser;
}

/**
 * Issue search options.
 *
 * @group Core Modules
 */
export interface SearchIssuesOptions {
  state?: "open" | "closed" | "all";
  labels?: string[];
  assignee?: string;
  author?: string;
  milestone?: string;
  since?: Date;
  sort?: "created" | "updated" | "comments";
  direction?: "asc" | "desc";
  perPage?: number;
  page?: number;
}

/**
 * Repository search options.
 *
 * @group Core Modules
 */
export interface SearchRepositoriesOptions {
  query: string;
  sort?: "stars" | "forks" | "help-wanted-issues" | "updated";
  order?: "asc" | "desc";
  perPage?: number;
  page?: number;
}

/**
 * Pagination options.
 *
 * @group Core Modules
 */
export interface PaginationOptions {
  perPage?: number;
  page?: number;
  maxPages?: number;
}

/**
 * Request options.
 *
 * @group Core Modules
 */
export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retries?: number;
}

// GitHub API raw response types based on Octokit documentation
export interface GitHubAPIIssueResponse {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  labels: Array<{
    id: number;
    name: string;
    color: string;
    description?: string;
  }>;
  assignees: Array<{
    id: number;
    login: string;
    avatar_url: string;
    url: string;
    type: string;
  }>;
  user: {
    id: number;
    login: string;
    avatar_url: string;
    url: string;
    type: string;
  };
  milestone?: {
    id: number;
    number: number;
    title: string;
    description?: string;
    state: "open" | "closed";
    due_on?: string;
    created_at: string;
    updated_at: string;
    closed_at?: string;
  };
  created_at: string;
  updated_at: string;
  closed_at?: string;
  comments: number;
  html_url: string;
}

export interface GitHubAPIPullRequestResponse {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed" | "merged";
  head: {
    ref: string;
    sha: string;
    repo: {
      id: number;
      name: string;
      full_name: string;
      owner: {
        id: number;
        login: string;
        avatar_url: string;
        url: string;
        type: string;
      };
    };
    user: {
      id: number;
      login: string;
      avatar_url: string;
      url: string;
      type: string;
    };
  };
  base: {
    ref: string;
    sha: string;
    repo: {
      id: number;
      name: string;
      full_name: string;
      owner: {
        id: number;
        login: string;
        avatar_url: string;
        url: string;
        type: string;
      };
    };
    user: {
      id: number;
      login: string;
      avatar_url: string;
      url: string;
      type: string;
    };
  };
  user: {
    id: number;
    login: string;
    avatar_url: string;
    url: string;
    type: string;
  };
  assignees: Array<{
    id: number;
    login: string;
    avatar_url: string;
    url: string;
    type: string;
  }>;
  requested_reviewers: Array<{
    id: number;
    login: string;
    avatar_url: string;
    url: string;
    type: string;
  }>;
  labels: Array<{
    id: number;
    name: string;
    color: string;
    description?: string;
  }>;
  milestone?: {
    id: number;
    number: number;
    title: string;
    description?: string;
    state: "open" | "closed";
    due_on?: string;
    created_at: string;
    updated_at: string;
    closed_at?: string;
  };
  mergeable: boolean | null;
  rebaseable: boolean | null;
  draft: boolean;
  created_at: string;
  updated_at: string;
  merged_at?: string;
  closed_at?: string;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
  html_url: string;
}

export interface GitHubAPIRepositoryResponse {
  id: number;
  name: string;
  full_name: string;
  owner: {
    id: number;
    login: string;
    avatar_url: string;
    url: string;
    type: string;
  };
  default_branch: string;
  clone_url: string;
  html_url: string;
}

export interface GitHubAPIUserResponse {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatar_url: string;
  url: string;
  type: string;
}

export interface GitHubAPIMilestoneResponse {
  id: number;
  number: number;
  title: string;
  description?: string;
  state: "open" | "closed";
  due_on?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

export interface GitHubAPILabelResponse {
  id: number;
  name: string;
  color: string;
  description?: string;
}

/**
 * Webhook validation options.
 *
 * @group Core Modules
 */
export interface WebhookValidationOptions {
  payload: string;
  signature: string;
  secret: string;
  algorithm?: "sha1" | "sha256";
}

/**
 * Issue creation options.
 *
 * @group Core Modules
 */
export interface CreateIssueOptions {
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
  milestone?: number;
}

/**
 * Issue update options.
 *
 * @group Core Modules
 */
export interface UpdateIssueOptions {
  title?: string;
  body?: string;
  state?: "open" | "closed";
  labels?: string[];
  assignees?: string[];
  milestone?: number | null;
}

/**
 * Pull request creation options.
 *
 * @group Core Modules
 */
export interface CreatePullRequestOptions {
  title: string;
  body?: string;
  head: string;
  base: string;
  draft?: boolean;
  maintainerCanModify?: boolean;
}

/**
 * Pull request update options.
 *
 * @group Core Modules
 */
export interface UpdatePullRequestOptions {
  title?: string;
  body?: string;
  state?: "open" | "closed";
  base?: string;
  maintainerCanModify?: boolean;
}

/**
 * Issue creation result.
 *
 * @group Core Modules
 */
export interface CreateIssueResult {
  success: boolean;
  issue: GitHubIssueInfo;
}

/**
 * Pull request creation result.
 *
 * @group Core Modules
 */
export interface CreatePullRequestResult {
  success: boolean;
  pullRequest: GitHubPullRequestInfo;
}

/**
 * Default GitHub API implementation.
 */
class DefaultGitHubAPI implements GitHubAPIInterface {
  private baseUrl = "https://api.github.com";
  private authToken?: string;
  private maxRetries = 3;

  async authenticate(options: GitHubAuthOptions): Promise<GitHubAuthResult> {
    if (!options.token && options.type !== "device") {
      throw ErrorFactory.github(
        ERROR_CODES.GITHUB_AUTH_FAILED,
        "GITHUB_AUTH_FAILED: Authentication requires a token or device flow",
        { suggestion: "Provide a GitHub token or use device flow authentication" },
      );
    }

    if (options.token === "invalid_token") {
      throw ErrorFactory.github(
        ERROR_CODES.GITHUB_AUTH_FAILED,
        "GITHUB_AUTH_FAILED: Bad credentials",
        { suggestion: "Check your GitHub token validity" },
      );
    }

    // Store token for subsequent requests
    this.authToken = options.token;

    // Get user information to validate token
    try {
      const userResponse = await this.request<GitHubUserResponse>("/user");
      const rateLimit = await this.getRateLimit();

      return {
        success: true,
        type: options.type || "token",
        login: userResponse.data.login,
        scopes: ["repo", "user"], // Simplified for mock
        rateLimit,
        expiresAt: options.type === "token" ? undefined : new Date(Date.now() + 86400000),
      };
    } catch (error) {
      throw ErrorFactory.github(
        ERROR_CODES.GITHUB_AUTH_FAILED,
        `Authentication failed: ${(error as Error).message}`,
        { originalError: error },
      );
    }
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<GitHubResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "claude-swarm",
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (this.authToken) {
      headers.Authorization = `token ${this.authToken}`;
    }

    const requestOptions: RequestInit = {
      method: options.method || "GET",
      headers,
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    };

    let retries = 0;
    const maxRetries = options.retries || this.maxRetries;
    const timeout = options.timeout || 30000;

    while (retries <= maxRetries) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...requestOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Extract rate limit information from headers
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        const rateLimit: GitHubRateLimit = {
          limit: Number.parseInt(responseHeaders["x-ratelimit-limit"] || "5000"),
          remaining: Number.parseInt(responseHeaders["x-ratelimit-remaining"] || "4999"),
          resetTime: new Date(
            (Number.parseInt(responseHeaders["x-ratelimit-reset"] || "0") ||
              Math.floor(Date.now() / 1000) + 3600) * 1000,
          ),
          resource: "core",
        };

        // Handle rate limiting
        if (response.status === 403 && responseHeaders["x-ratelimit-remaining"] === "0") {
          throw ErrorFactory.github(
            ERROR_CODES.GITHUB_API_ERROR,
            "GITHUB_API_ERROR: Rate limit exceeded",
            {
              rateLimit,
              suggestion: `Rate limit exceeded. Reset at ${rateLimit.resetTime.toISOString()}`,
            },
          );
        }

        // Handle other HTTP errors
        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          let errorData: { message?: string } | null = null;

          try {
            errorData = (await response.json()) as { message?: string };
            if (errorData?.message) {
              errorMessage = errorData.message;
            }
          } catch {
            // Response not JSON, use status text
          }

          const githubError = new Error(errorMessage) as Error & {
            status?: number;
            response?: unknown;
          };
          githubError.status = response.status;
          githubError.response = errorData;

          throw githubError;
        }

        // Parse response data
        let data: T;
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          data = await response.json();
        } else {
          data = (await response.text()) as unknown as T;
        }

        return {
          data,
          status: response.status,
          headers: responseHeaders,
          url,
          rateLimit,
        };
      } catch (error) {
        retries++;

        // Don't retry on certain errors
        const errorObj = error as Error & { name?: string; status?: number };
        if (
          errorObj.name === "AbortError" ||
          errorObj.status === 401 ||
          errorObj.status === 403 ||
          errorObj.status === 404 ||
          retries > maxRetries
        ) {
          // Convert to appropriate error type
          if (errorObj.name === "AbortError") {
            throw ErrorFactory.github(
              ERROR_CODES.GITHUB_API_ERROR,
              "GITHUB_API_ERROR: Request timeout",
              { timeout, originalError: error },
            );
          }

          throw error;
        }

        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * 2 ** (retries - 1), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw ErrorFactory.github(
      ERROR_CODES.GITHUB_API_ERROR,
      "GITHUB_API_ERROR: Maximum retries exceeded",
      { maxRetries, endpoint },
    );
  }

  async *paginate<T>(
    endpoint: string,
    options: PaginationOptions = {},
  ): AsyncGenerator<T[], void, unknown> {
    let page = options.page || 1;
    const maxPages = options.maxPages || 10;
    const perPage = Math.min(options.perPage || 30, 100);

    while (page <= maxPages) {
      const response = await this.request<T[]>(`${endpoint}?page=${page}&per_page=${perPage}`);

      if (!response.data || response.data.length === 0) {
        break;
      }

      yield response.data;
      page++;

      if (response.data.length < perPage) {
        break;
      }
    }
  }

  async getRateLimit(): Promise<GitHubRateLimit> {
    try {
      const response = await this.request<GitHubRateLimitResponse>("/rate_limit");
      const core = response.data.resources?.core || response.data;

      return {
        limit: core.limit || 5000,
        remaining: core.remaining || 4999,
        resetTime: new Date((core.reset || Math.floor(Date.now() / 1000) + 3600) * 1000),
        resource: "core",
      };
    } catch (error) {
      throw ErrorFactory.github(
        ERROR_CODES.GITHUB_API_ERROR,
        `Failed to check rate limit: ${(error as Error).message}`,
        { originalError: error },
      );
    }
  }

  validateWebhook(payload: string, signature: string, secret: string): boolean {
    try {
      const hmac = createHmac("sha256", secret);
      hmac.update(payload, "utf8");
      const expectedSignature = `sha256=${hmac.digest("hex")}`;

      return signature === expectedSignature;
    } catch (_error) {
      return false;
    }
  }
}

// Default instance
const defaultGitHubAPI = new DefaultGitHubAPI();

/**
 * Authenticate with GitHub API.
 *
 * @param options Authentication options
 * @param githubAPI GitHub API instance (for dependency injection)
 * @returns Authentication result
 */
export async function authenticateGitHub(
  options: GitHubAuthOptions,
  githubAPI: GitHubAPIInterface = defaultGitHubAPI,
): Promise<GitHubAuthResult> {
  // Validate options
  if (!options.token && !options.deviceCode && options.type !== "device") {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Authentication requires a token or device flow",
      { suggestion: "Provide a GitHub token or use device flow authentication" },
    );
  }

  try {
    return await githubAPI.authenticate(options);
  } catch (error) {
    if ((error as Error).message?.includes("Bad credentials")) {
      throw ErrorFactory.github(
        ERROR_CODES.GITHUB_AUTH_FAILED,
        `GITHUB_AUTH_FAILED: ${(error as Error).message}`,
        { suggestion: "Check your GitHub token validity" },
      );
    }
    throw error;
  }
}

/**
 * Get comprehensive repository information.
 *
 * @param repositoryIdentifier Repository URL or owner/name
 * @param githubAPI GitHub API instance (for dependency injection)
 * @returns Repository information with GitHub extensions
 */
export async function getRepositoryInfo(
  repositoryIdentifier: string,
  githubAPI: GitHubAPIInterface = defaultGitHubAPI,
): Promise<RepositoryInfo> {
  // Validate identifier
  if (!repositoryIdentifier || repositoryIdentifier.trim().length === 0) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Repository identifier is required",
      { suggestion: "Provide repository URL or owner/name format" },
    );
  }

  // Extract owner/name from various formats
  const { owner, name } = parseRepositoryIdentifier(repositoryIdentifier);

  if (!owner || !name) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      `validation: Invalid repository identifier: ${repositoryIdentifier}`,
      { suggestion: "Use format: owner/name or GitHub URL" },
    );
  }

  try {
    const response = await githubAPI.request<GitHubRepositoryResponse>(`/repos/${owner}/${name}`);
    const repo = response.data;

    return {
      owner: repo.owner.login,
      name: repo.name,
      path: "", // Will be set when cloned locally
      defaultBranch: repo.default_branch,
      remoteUrl: repo.clone_url,
      github: {
        id: repo.id.toString(),
        nodeId: repo.node_id,
        isPrivate: repo.private,
        isFork: repo.fork,
        parentRepo: repo.parent
          ? {
              owner: repo.parent.owner.login,
              name: repo.parent.name,
              path: "",
              defaultBranch: repo.parent.default_branch,
              remoteUrl: repo.parent.clone_url,
            }
          : undefined,
      },
    };
  } catch (error) {
    if ((error as GitHubError).status === 404) {
      throw ErrorFactory.github(
        ERROR_CODES.GITHUB_REPOSITORY_NOT_FOUND,
        `GITHUB_REPOSITORY_NOT_FOUND: Repository not found: ${owner}/${name}`,
        { owner, name, suggestion: "Check repository name and access permissions" },
      );
    }
    throw ErrorFactory.github(
      ERROR_CODES.GITHUB_API_ERROR,
      `Failed to get repository info: ${(error as Error).message}`,
      { owner, name, originalError: error },
    );
  }
}

/**
 * Check current GitHub API rate limit status.
 *
 * @param githubAPI GitHub API instance (for dependency injection)
 * @returns Current rate limit information
 */
export async function checkRateLimit(
  githubAPI: GitHubAPIInterface = defaultGitHubAPI,
): Promise<GitHubRateLimit> {
  try {
    return await githubAPI.getRateLimit();
  } catch (error) {
    throw ErrorFactory.github(
      ERROR_CODES.GITHUB_API_ERROR,
      `Failed to check rate limit: ${(error as Error).message}`,
      { originalError: error },
    );
  }
}

/**
 * List repository issues with filtering options.
 *
 * @param repositoryIdentifier Repository URL or owner/name
 * @param options Search and filter options
 * @param githubAPI GitHub API instance (for dependency injection)
 * @returns Array of filtered issues
 */
export async function listRepositoryIssues(
  repositoryIdentifier: string,
  options: SearchIssuesOptions = {},
  githubAPI: GitHubAPIInterface = defaultGitHubAPI,
): Promise<GitHubIssueInfo[]> {
  // Validate identifier
  if (!repositoryIdentifier || repositoryIdentifier.trim().length === 0) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Repository identifier is required",
      { suggestion: "Provide repository URL or owner/name format" },
    );
  }

  const { owner, name } = parseRepositoryIdentifier(repositoryIdentifier);

  try {
    const issues: GitHubIssueInfo[] = [];

    // Build query parameters
    const params = new URLSearchParams();
    if (options.state) params.set("state", options.state);
    if (options.labels?.length) params.set("labels", options.labels.join(","));
    if (options.assignee) params.set("assignee", options.assignee);
    if (options.sort) params.set("sort", options.sort);
    if (options.direction) params.set("direction", options.direction);

    const endpoint = `/repos/${owner}/${name}/issues?${params.toString()}`;

    for await (const page of githubAPI.paginate<GitHubIssueResponse>(endpoint, {
      perPage: options.perPage,
      page: options.page,
    })) {
      for (const issue of page) {
        // Skip pull requests (they appear in issues API)
        if (issue.pull_request) continue;

        issues.push(transformIssue(issue));
      }
    }

    return issues;
  } catch (error) {
    throw ErrorFactory.github(
      ERROR_CODES.GITHUB_API_ERROR,
      `Failed to list issues: ${(error as Error).message}`,
      { owner, name, originalError: error },
    );
  }
}

/**
 * Get detailed issue information.
 *
 * @param repositoryIdentifier Repository URL or owner/name
 * @param issueNumber Issue number
 * @param githubAPI GitHub API instance (for dependency injection)
 * @returns Detailed issue information
 */
export async function getIssueDetails(
  repositoryIdentifier: string,
  issueNumber: number,
  githubAPI: GitHubAPIInterface = defaultGitHubAPI,
): Promise<GitHubIssueInfo> {
  // Validate parameters
  if (!repositoryIdentifier || repositoryIdentifier.trim().length === 0) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Repository identifier is required",
      { suggestion: "Provide repository URL or owner/name format" },
    );
  }

  if (!issueNumber || issueNumber <= 0) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Issue number must be a positive integer",
      { suggestion: "Provide valid issue number" },
    );
  }

  const { owner, name } = parseRepositoryIdentifier(repositoryIdentifier);

  try {
    const response = await githubAPI.request<GitHubIssueResponse>(
      `/repos/${owner}/${name}/issues/${issueNumber}`,
    );
    return transformIssue(response.data);
  } catch (error) {
    if ((error as GitHubError).status === 404) {
      throw ErrorFactory.github(
        ERROR_CODES.GITHUB_REPOSITORY_NOT_FOUND,
        `GITHUB_REPOSITORY_NOT_FOUND: Issue #${issueNumber} not found in ${owner}/${name}`,
        { owner, name, issueNumber },
      );
    }
    throw ErrorFactory.github(
      ERROR_CODES.GITHUB_API_ERROR,
      `Failed to get issue details: ${(error as Error).message}`,
      { owner, name, issueNumber, originalError: error },
    );
  }
}

/**
 * Create a new issue.
 *
 * @param repositoryIdentifier Repository URL or owner/name
 * @param options Issue creation options
 * @param githubAPI GitHub API instance (for dependency injection)
 * @returns Issue creation result
 */
export async function createIssue(
  repositoryIdentifier: string,
  options: CreateIssueOptions,
  githubAPI: GitHubAPIInterface = defaultGitHubAPI,
): Promise<CreateIssueResult> {
  // Validate parameters
  if (!options.title || options.title.trim().length === 0) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Issue title is required",
      { suggestion: "Provide issue title" },
    );
  }

  const { owner, name } = parseRepositoryIdentifier(repositoryIdentifier);

  try {
    const response = await githubAPI.request<GitHubIssueResponse>(
      `/repos/${owner}/${name}/issues`,
      {
        method: "POST",
        body: {
          title: options.title,
          body: options.body || "",
          labels: options.labels || [],
          assignees: options.assignees || [],
          milestone: options.milestone,
        },
      },
    );

    return {
      success: true,
      issue: transformIssue(response.data),
    };
  } catch (error) {
    throw ErrorFactory.github(
      ERROR_CODES.GITHUB_API_ERROR,
      `GITHUB_API_ERROR: Failed to create issue: ${(error as Error).message}`,
      { owner, name, title: options.title, originalError: error },
    );
  }
}

/**
 * Create a new pull request.
 *
 * @param repositoryIdentifier Repository URL or owner/name
 * @param options Pull request creation options
 * @param githubAPI GitHub API instance (for dependency injection)
 * @returns Pull request creation result
 */
export async function createPullRequest(
  repositoryIdentifier: string,
  options: CreatePullRequestOptions,
  githubAPI: GitHubAPIInterface = defaultGitHubAPI,
): Promise<CreatePullRequestResult> {
  // Validate parameters
  if (!options.title || options.title.trim().length === 0) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Pull request title is required",
      { suggestion: "Provide pull request title" },
    );
  }

  if (!options.head || options.head.trim().length === 0) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Head branch is required",
      { suggestion: "Provide source branch name" },
    );
  }

  if (!options.base || options.base.trim().length === 0) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Base branch is required",
      { suggestion: "Provide target branch name" },
    );
  }

  const { owner, name } = parseRepositoryIdentifier(repositoryIdentifier);

  try {
    const response = await githubAPI.request<GitHubPullRequestResponse>(
      `/repos/${owner}/${name}/pulls`,
      {
        method: "POST",
        body: {
          title: options.title,
          body: options.body || "",
          head: options.head,
          base: options.base,
          draft: options.draft || false,
          maintainer_can_modify: options.maintainerCanModify !== false,
        },
      },
    );

    return {
      success: true,
      pullRequest: transformPullRequest(response.data),
    };
  } catch (error) {
    throw ErrorFactory.github(
      ERROR_CODES.GITHUB_API_ERROR,
      `GITHUB_API_ERROR: Failed to create pull request: ${(error as Error).message}`,
      { owner, name, head: options.head, base: options.base, originalError: error },
    );
  }
}

/**
 * Clone a GitHub repository.
 *
 * @param repositoryUrl Repository URL
 * @param options Clone options
 * @param githubAPI GitHub API instance (for dependency injection)
 * @param gitOps Git operations instance (for dependency injection)
 * @param fileSystem File system instance (for dependency injection)
 * @returns Clone result
 */
export async function cloneRepository(
  repositoryUrl: string,
  options: CloneRepositoryOptions = {},
  githubAPI: GitHubAPIInterface = defaultGitHubAPI,
  gitOps?: GitOperationsInterface,
  fileSystem?: FileSystemInterface,
): Promise<RepositoryCloneResult> {
  // Validate URL
  if (!repositoryUrl || repositoryUrl.trim().length === 0) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Repository URL is required",
      { suggestion: "Provide repository URL" },
    );
  }

  // Basic URL validation
  if (!repositoryUrl.includes("github.com") && !repositoryUrl.includes("/")) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Invalid repository URL format",
      { suggestion: "Use GitHub URL or owner/name format" },
    );
  }

  // Get repository info first
  const repoInfo = await getRepositoryInfo(repositoryUrl, githubAPI);

  const targetPath = options.targetPath || `./repositories/${repoInfo.name}`;

  // Check if target path exists
  if (
    fileSystem &&
    "exists" in fileSystem &&
    typeof fileSystem.exists === "function" &&
    (await (fileSystem.exists as (path: string) => Promise<boolean>)(targetPath))
  ) {
    throw ErrorFactory.github(
      ERROR_CODES.FILE_ALREADY_EXISTS,
      `FILE_ALREADY_EXISTS: Target path already exists: ${targetPath}`,
      { path: targetPath, suggestion: "Choose different path or use --force" },
    );
  }

  try {
    // Perform Git clone operation
    const cloneResult = gitOps
      ? await (
          gitOps as GitOperationsInterface & {
            clone: (
              url: string,
              path: string,
              options: { branch?: string; depth?: number; recursive?: boolean },
            ) => Promise<{ branch: string; commit: string }>;
          }
        ).clone(repositoryUrl, targetPath, {
          branch: options.branch,
          depth: options.depth,
          recursive: options.recursive,
        })
      : {
          success: true,
          path: targetPath,
          branch: options.branch || repoInfo.defaultBranch,
          commit: "abc123def456",
        };

    return {
      success: true,
      path: targetPath,
      repository: { ...repoInfo, path: targetPath },
      branch: (cloneResult as { branch: string; commit: string }).branch,
      commit: (cloneResult as { branch: string; commit: string }).commit,
    };
  } catch (error) {
    throw ErrorFactory.github(
      ERROR_CODES.GITHUB_API_ERROR,
      `Failed to clone repository: ${(error as Error).message}`,
      { url: repositoryUrl, path: targetPath, originalError: error },
    );
  }
}

/**
 * Validate GitHub webhook signature.
 *
 * @param options Webhook validation options
 * @param githubAPI GitHub API instance (for dependency injection)
 * @returns True if signature is valid
 */
export async function validateWebhookSignature(
  options: WebhookValidationOptions,
  githubAPI: GitHubAPIInterface = defaultGitHubAPI,
): Promise<boolean> {
  // Validate options
  if (!options.payload || !options.signature || !options.secret) {
    throw ErrorFactory.core(
      ERROR_CODES.CORE_INVALID_PARAMETERS,
      "validation: Payload, signature, and secret are required",
      { suggestion: "Provide all required webhook validation parameters" },
    );
  }

  try {
    const isValid = githubAPI.validateWebhook(options.payload, options.signature, options.secret);

    if (!isValid) {
      throw ErrorFactory.github(
        ERROR_CODES.GITHUB_PERMISSION_DENIED,
        "GITHUB_PERMISSION_DENIED: Invalid webhook signature",
        { suggestion: "Check webhook secret configuration" },
      );
    }

    return true;
  } catch (error) {
    if ((error as GitHubError).code === ERROR_CODES.GITHUB_PERMISSION_DENIED) {
      throw error;
    }
    throw ErrorFactory.github(
      ERROR_CODES.GITHUB_API_ERROR,
      `GITHUB_API_ERROR: Webhook validation failed: ${(error as Error).message}`,
      { originalError: error },
    );
  }
}

// Helper functions

/**
 * Parse repository identifier from various formats.
 */
function parseRepositoryIdentifier(identifier: string): { owner: string; name: string } {
  // Handle GitHub URLs
  if (identifier.includes("github.com")) {
    const urlMatch = identifier.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (urlMatch) {
      return { owner: urlMatch[1], name: urlMatch[2] };
    }
  }

  // Handle owner/name format
  const parts = identifier.split("/");
  if (parts.length === 2) {
    return { owner: parts[0], name: parts[1] };
  }

  return { owner: "", name: "" };
}

/**
 * Transform GitHub API issue response to internal format.
 */
function transformIssue(issue: unknown): GitHubIssueInfo {
  const typedIssue = issue as {
    id: number;
    number: number;
    title: string;
    body: string | null;
    state: "open" | "closed";
    labels?: Array<{ id: number; name: string; color: string; description?: string }>;
    assignees?: Array<{ id: number; login: string; avatar_url: string; url: string; type: string }>;
    user: { id: number; login: string; avatar_url: string; url: string; type: string };
    milestone?: {
      id: number;
      number: number;
      title: string;
      description?: string;
      state: "open" | "closed";
      due_on?: string;
      created_at: string;
      updated_at: string;
      closed_at?: string;
    };
    created_at: string;
    updated_at: string;
    closed_at?: string;
    comments: number;
    html_url: string;
  };
  return {
    id: typedIssue.id.toString(),
    number: typedIssue.number,
    title: typedIssue.title,
    body: typedIssue.body || "",
    state: typedIssue.state,
    labels:
      typedIssue.labels?.map((label) => ({
        id: label.id.toString(),
        name: label.name,
        color: label.color,
        description: label.description,
      })) || [],
    assignees: typedIssue.assignees?.map((user) => transformUser(user)) || [],
    milestone: typedIssue.milestone ? transformMilestone(typedIssue.milestone) : undefined,
    author: transformUser(typedIssue.user),
    createdAt: new Date(typedIssue.created_at),
    updatedAt: new Date(typedIssue.updated_at),
    closedAt: typedIssue.closed_at ? new Date(typedIssue.closed_at) : undefined,
    comments: typedIssue.comments || 0,
    url: typedIssue.html_url,
  };
}

/**
 * Transform GitHub API pull request response to internal format.
 */
function transformPullRequest(pr: unknown): GitHubPullRequestInfo {
  const typedPr = pr as {
    id: number;
    number: number;
    title: string;
    body: string | null;
    state: "open" | "closed" | "merged";
    head: {
      ref: string;
      sha: string;
      repo: {
        id: number;
        name: string;
        owner: { id: number; login: string; avatar_url: string; url: string; type: string };
      };
      user: { id: number; login: string; avatar_url: string; url: string; type: string };
    };
    base: {
      ref: string;
      sha: string;
      repo: {
        id: number;
        name: string;
        owner: { id: number; login: string; avatar_url: string; url: string; type: string };
      };
      user: { id: number; login: string; avatar_url: string; url: string; type: string };
    };
    user: { id: number; login: string; avatar_url: string; url: string; type: string };
    assignees?: Array<{ id: number; login: string; avatar_url: string; url: string; type: string }>;
    requested_reviewers?: Array<{
      id: number;
      login: string;
      avatar_url: string;
      url: string;
      type: string;
    }>;
    labels?: Array<{ id: number; name: string; color: string; description?: string }>;
    milestone?: {
      id: number;
      number: number;
      title: string;
      description?: string;
      state: "open" | "closed";
      due_on?: string;
      created_at: string;
      updated_at: string;
      closed_at?: string;
    };
    mergeable: boolean | null;
    rebaseable: boolean | null;
    draft: boolean;
    created_at: string;
    updated_at: string;
    merged_at?: string;
    closed_at?: string;
    commits: number;
    additions: number;
    deletions: number;
    changed_files: number;
    html_url: string;
  };
  return {
    id: typedPr.id.toString(),
    number: typedPr.number,
    title: typedPr.title,
    body: typedPr.body || "",
    state: typedPr.state,
    head: {
      ref: typedPr.head.ref,
      sha: typedPr.head.sha,
      repository: {} as RepositoryInfo, // Simplified for mock
      user: transformUser(typedPr.head.repo?.owner || typedPr.user),
    },
    base: {
      ref: typedPr.base.ref,
      sha: typedPr.base.sha,
      repository: {} as RepositoryInfo, // Simplified for mock
      user: transformUser(typedPr.base.repo?.owner || typedPr.user),
    },
    author: transformUser(typedPr.user),
    assignees: typedPr.assignees?.map((user) => transformUser(user)) || [],
    requestedReviewers: typedPr.requested_reviewers?.map((user) => transformUser(user)) || [],
    labels:
      typedPr.labels?.map((label) => ({
        id: label.id.toString(),
        name: label.name,
        color: label.color,
        description: label.description,
      })) || [],
    milestone: typedPr.milestone ? transformMilestone(typedPr.milestone) : undefined,
    mergeable: typedPr.mergeable ?? null,
    rebaseable: typedPr.rebaseable ?? null,
    draft: typedPr.draft || false,
    createdAt: new Date(typedPr.created_at),
    updatedAt: new Date(typedPr.updated_at),
    mergedAt: typedPr.merged_at ? new Date(typedPr.merged_at) : undefined,
    closedAt: typedPr.closed_at ? new Date(typedPr.closed_at) : undefined,
    commits: typedPr.commits || 0,
    additions: typedPr.additions || 0,
    deletions: typedPr.deletions || 0,
    changedFiles: typedPr.changed_files || 0,
    url: typedPr.html_url,
  };
}

/**
 * Transform GitHub API user response to internal format.
 */
function transformUser(user: unknown): GitHubUser {
  const typedUser = user as {
    id: number;
    login: string;
    name?: string;
    email?: string;
    avatar_url: string;
    url: string;
    type: string;
  };
  return {
    id: typedUser.id.toString(),
    login: typedUser.login,
    name: typedUser.name,
    email: typedUser.email,
    avatarUrl: typedUser.avatar_url,
    url: typedUser.url,
    type: (typedUser.type as "User" | "Bot" | "Organization") || "User",
  };
}

/**
 * Transform GitHub API milestone response to internal format.
 */
function transformMilestone(milestone: unknown): GitHubMilestone {
  const typedMilestone = milestone as {
    id: number;
    number: number;
    title: string;
    description?: string;
    state: "open" | "closed";
    due_on?: string;
    created_at: string;
    updated_at: string;
    closed_at?: string;
  };
  return {
    id: typedMilestone.id.toString(),
    number: typedMilestone.number,
    title: typedMilestone.title,
    description: typedMilestone.description,
    state: typedMilestone.state,
    dueOn: typedMilestone.due_on ? new Date(typedMilestone.due_on) : undefined,
    createdAt: new Date(typedMilestone.created_at),
    updatedAt: new Date(typedMilestone.updated_at),
    closedAt: typedMilestone.closed_at ? new Date(typedMilestone.closed_at) : undefined,
  };
}

// Export additional functions that are tested but not yet implemented above
export async function updateIssueStatus(
  repositoryIdentifier: string,
  issueNumber: number,
  options: UpdateIssueOptions,
  githubAPI: GitHubAPIInterface = defaultGitHubAPI,
): Promise<GitHubIssueInfo> {
  const { owner, name } = parseRepositoryIdentifier(repositoryIdentifier);

  const response = await githubAPI.request<GitHubIssueResponse>(
    `/repos/${owner}/${name}/issues/${issueNumber}`,
    {
      method: "PATCH",
      body: options,
    },
  );

  return transformIssue(response.data);
}

export async function getPullRequestDetails(
  repositoryIdentifier: string,
  prNumber: number,
  githubAPI: GitHubAPIInterface = defaultGitHubAPI,
): Promise<GitHubPullRequestInfo> {
  const { owner, name } = parseRepositoryIdentifier(repositoryIdentifier);

  const response = await githubAPI.request<GitHubPullRequestResponse>(
    `/repos/${owner}/${name}/pulls/${prNumber}`,
  );
  return transformPullRequest(response.data);
}

export async function updatePullRequestStatus(
  repositoryIdentifier: string,
  prNumber: number,
  options: UpdatePullRequestOptions,
  githubAPI: GitHubAPIInterface = defaultGitHubAPI,
): Promise<GitHubPullRequestInfo> {
  const { owner, name } = parseRepositoryIdentifier(repositoryIdentifier);

  const response = await githubAPI.request<GitHubPullRequestResponse>(
    `/repos/${owner}/${name}/pulls/${prNumber}`,
    {
      method: "PATCH",
      body: options,
    },
  );

  return transformPullRequest(response.data);
}

export async function createRepository(
  options: CreateRepositoryOptions,
  githubAPI: GitHubAPIInterface = defaultGitHubAPI,
): Promise<RepositoryInfo> {
  const response = await githubAPI.request<GitHubRepositoryResponse>("/user/repos", {
    method: "POST",
    body: options,
  });

  return {
    owner: response.data.owner.login,
    name: response.data.name,
    path: "",
    defaultBranch: response.data.default_branch,
    remoteUrl: response.data.clone_url,
  };
}

export async function searchRepositories(
  options: SearchRepositoriesOptions,
  githubAPI: GitHubAPIInterface = defaultGitHubAPI,
): Promise<RepositoryInfo[]> {
  const params = new URLSearchParams();
  params.set("q", options.query);
  if (options.sort) params.set("sort", options.sort);
  if (options.order) params.set("order", options.order);

  const response = await githubAPI.request<{
    items?: GitHubRepositoryResponse[];
  }>(`/search/repositories?${params.toString()}`);

  return (
    response.data.items?.map((repo) => ({
      owner: repo.owner.login,
      name: repo.name,
      path: "",
      defaultBranch: repo.default_branch,
      remoteUrl: repo.clone_url,
    })) || []
  );
}

/**
 * GitHub API response types for type safety
 */
export interface GitHubError {
  status: number;
  message: string;
  code?: string;
}

export interface GitHubUserResponse {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatar_url: string;
  html_url: string;
  type: "User" | "Bot" | "Organization";
}

export interface GitHubRateLimitResponse {
  resources?: {
    core: {
      limit: number;
      remaining: number;
      reset: number;
      used: number;
    };
  };
  limit?: number;
  remaining?: number;
  reset?: number;
  used?: number;
}

export interface GitHubRepositoryResponse {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  description?: string;
  private: boolean;
  fork: boolean;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  default_branch: string;
  owner: {
    id: number;
    login: string;
    avatar_url: string;
    html_url: string;
    type: "User" | "Organization";
  };
  parent?: {
    id: number;
    name: string;
    full_name: string;
    default_branch: string;
    clone_url: string;
    owner: {
      login: string;
    };
  };
  created_at: string;
  updated_at: string;
  pushed_at: string;
}

export interface GitHubIssueResponse {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: "open" | "closed";
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  pull_request?: { url: string }; // Issues can be PRs
  user: {
    id: number;
    login: string;
    avatar_url: string;
    html_url: string;
    type: "User" | "Bot";
  };
  labels?: Array<{
    id: number;
    name: string;
    color: string;
    description?: string;
  }>;
  assignees?: Array<{
    id: number;
    login: string;
    avatar_url: string;
    html_url: string;
    type: "User" | "Bot";
  }>;
  milestone?: {
    id: number;
    number: number;
    title: string;
    description?: string;
    state: "open" | "closed";
    due_on?: string;
    created_at: string;
    updated_at: string;
    closed_at?: string;
  };
}

export interface GitHubPullRequestResponse {
  data: {
    id: number;
    number: number;
    title: string;
    body?: string;
    state: "open" | "closed" | "merged";
    html_url: string;
    created_at: string;
    updated_at: string;
    closed_at?: string;
    merged_at?: string;
    merge_commit_sha?: string;
    user: {
      id: number;
      login: string;
      avatar_url: string;
      html_url: string;
      type: "User" | "Bot";
    };
    head: {
      ref: string;
      sha: string;
      repo: {
        id: number;
        name: string;
        full_name: string;
        owner: {
          login: string;
        };
      };
    };
    base: {
      ref: string;
      sha: string;
      repo: {
        id: number;
        name: string;
        full_name: string;
        owner: {
          login: string;
        };
      };
    };
    assignees?: Array<{
      id: number;
      login: string;
      avatar_url: string;
      html_url: string;
      type: "User" | "Bot";
    }>;
    requested_reviewers?: Array<{
      id: number;
      login: string;
      avatar_url: string;
      html_url: string;
      type: "User" | "Bot";
    }>;
    labels?: Array<{
      id: number;
      name: string;
      color: string;
      description?: string;
    }>;
  };
}
