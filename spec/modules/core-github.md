# Core Module: GitHub

← [Back to Index](../README.md) | [Previous: tmux Module](./core-tmux.md) | [Next: Git Module →](./core-git.md)

## Purpose
Provides comprehensive GitHub API integration using Octokit, replacing all `gh` CLI usage. Handles issues, pull requests, projects, repository management, and project field detection.

## Dependencies
- `@octokit/rest` - GitHub REST API client
- `@octokit/graphql` - GitHub GraphQL API client
- `@octokit/openapi-types` - TypeScript types for GitHub API responses
- `shared/types.ts` - RepositoryInfo, GitHubIssue, GitHubProject interfaces
- `shared/errors.ts` - GitHubError, GitHubAPIError, GitHubRateLimitError classes
- `shared/config.ts` - GitHubConfig and authentication management

## External Documentation References
- [GitHub REST API - Issues](https://docs.github.com/en/rest/issues/issues)
- [GitHub GraphQL API - ProjectV2](https://docs.github.com/en/graphql/reference/objects#projectv2)
- [GitHub Projects v2 API Guide](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects)
- [Octokit TypeScript Types](https://www.npmjs.com/package/@octokit/openapi-types)
- [Issue Linking Documentation](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue)

## Function Signatures

### Repository Operations

#### detectRepository
```typescript
async function detectRepository(): Promise<RepositoryInfo>
```

**Returns:**
```typescript
// Uses shared RepositoryInfo interface from shared/types.ts
// See shared/types.ts for complete interface definition
// Includes GitHub-specific extensions under the `github` property
```

**Behavior:**
- Extracts repository info from git remote origin
- Validates repository exists on GitHub
- Handles both SSH and HTTPS remote URLs
- Detects fork relationships

**Error Conditions:**
- `GitHubError('GITHUB_NO_REMOTE_ORIGIN')` - No git remote origin configured
- `GitHubError('GITHUB_INVALID_REMOTE_URL')` - Remote URL not a GitHub repository
- `GitHubError('GITHUB_REPOSITORY_NOT_FOUND')` - Repository doesn't exist or no access
- `GitHubError('GITHUB_AUTH_FAILED')` - Invalid or missing GitHub token

*Error codes follow shared ERROR_CODES pattern: MODULE_ERROR_TYPE*

---

### Issue Operations

#### getIssue
```typescript
async function getIssue(repoInfo: RepositoryInfo, issueNumber: number): Promise<GitHubIssue>
```

**Returns:**
```typescript
// Uses shared GitHubIssue interface from shared/types.ts
// Based on @octokit/openapi-types for maximum compatibility
// See shared/types.ts for complete interface definition
```

**Error Conditions:**
- `GitHubError('GITHUB_ISSUE_NOT_FOUND')` - Issue doesn't exist
- `GitHubError('GITHUB_ACCESS_DENIED')` - No permission to read issue

*Error codes follow shared ERROR_CODES pattern: MODULE_ERROR_TYPE*

---

#### getIssueWithRelationships
```typescript
async function getIssueWithRelationships(repoInfo: RepositoryInfo, issueNumber: number): Promise<GitHubIssueComplete>
```

**Returns:**
```typescript
// Uses shared GitHubIssueComplete interface from shared/types.ts
// Includes relationships and project associations
// See shared/types.ts for complete interface definition
```

interface GitHubIssueRelationships {
  // These come from GitHub Projects v2 custom fields via GraphQL
  parentIssue?: {
    number: number;
    title: string;
    url: string;
    node_id: string;
  };
  childIssues: Array<{
    number: number;
    title: string;
    url: string;
    node_id: string;
  }>;
  trackedBy: Array<{              // Issues that track this one
    number: number;
    title: string;
    url: string;
    node_id: string;
  }>;
  tracks: Array<{                 // Issues tracked by this one
    number: number;
    title: string;
    url: string;
    node_id: string;
  }>;
}

interface GitHubIssueProjectInfo {
  project: {
    id: string;                   // Project node ID
    number: number;               // Project number
    title: string;                // Project title
    url: string;                  // Project URL
  };
  itemId: string;                 // ProjectV2Item ID
  fieldValues: Record<string, any>; // All custom field values
  status?: string;                // Status field value if detected
}
```

**Behavior:**
- Gets basic issue via REST API
- Queries relationships via GraphQL using `node_id`
- Queries project associations via GraphQL
- Combines all data into complete issue object

**GraphQL Query Reference:**
```graphql
query GetIssueRelationships($nodeId: ID!) {
  node(id: $nodeId) {
    ... on Issue {
      projectItems(first: 10) {
        nodes {
          id
          project {
            id
            number
            title
            url
          }
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldTextValue {
                field {
                  ... on ProjectV2FieldCommon {
                    name
                  }
                }
                text
              }
              ... on ProjectV2ItemFieldSingleSelectValue {
                field {
                  ... on ProjectV2FieldCommon {
                    name
                  }
                }
                name
              }
            }
          }
        }
      }
    }
  }
}
```

---

#### createIssue
```typescript
async function createIssue(repoInfo: RepositoryInfo, params: CreateIssueParams): Promise<GitHubIssue>
```

**Parameters:**
```typescript
interface CreateIssueParams {
  title: string;                   // Issue title
  body?: string;                   // Issue description
  labels?: string[];               // Label names to apply
  assignees?: string[];            // Usernames to assign
  milestone?: number;              // Milestone number
}
```

**Behavior:**
- Creates new issue with specified parameters
- Applies labels, assignees, and milestone if provided
- Returns complete issue information

**Error Conditions:**
- `GitHubError('CREATION_FAILED')` - Failed to create issue
- `GitHubError('INVALID_LABELS')` - One or more labels don't exist
- `GitHubError('INVALID_ASSIGNEES')` - One or more assignees invalid

---

#### createIssueWithProject
```typescript
async function createIssueWithProject(repoInfo: RepositoryInfo, params: CreateIssueWithProjectParams): Promise<GitHubIssueComplete>
```

**Parameters:**
```typescript
interface CreateIssueWithProjectParams extends CreateIssueParams {
  projectId?: string;              // Project node ID to add issue to
  projectNumber?: number;          // Alternative: project number (will resolve to ID)
  projectFieldValues?: Array<{     // Set custom field values immediately
    fieldId: string;               // Field node ID
    value: string | number;        // Field value
    optionId?: string;             // For single select fields
  }>;
  parentIssueNodeId?: string;      // Set parent relationship if supported
}
```

**Behavior:**
- Creates issue via REST API
- Immediately adds to project via GraphQL if specified
- Sets initial field values (status, parent, etc.)
- Returns complete issue with project associations

**GraphQL Mutation Reference:**
```graphql
mutation AddIssueToProject($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: {
    projectId: $projectId
    contentId: $contentId
  }) {
    item {
      id
      content {
        ... on Issue {
          number
          title
        }
      }
    }
  }
}

mutation UpdateProjectItemField($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $projectId
    itemId: $itemId
    fieldId: $fieldId
    value: $value
  }) {
    projectV2Item {
      id
    }
  }
}
```

**Error Conditions:**
- All from `createIssue()` plus:
- `GitHubError('GITHUB_PROJECT_NOT_FOUND')` - Project doesn't exist
- `GitHubError('GITHUB_PROJECT_ADD_FAILED')` - Failed to add issue to project
- `GitHubError('GITHUB_FIELD_UPDATE_FAILED')` - Failed to set field values

*Error codes follow shared ERROR_CODES pattern: MODULE_ERROR_TYPE*

---

### Pull Request Operations

#### createPullRequest
```typescript
async function createPullRequest(repoInfo: RepositoryInfo, params: CreatePullRequestParams): Promise<GitHubPullRequest>
```

**Parameters:**
```typescript
interface CreatePullRequestParams {
  title: string;                   // PR title
  body: string;                    // PR description
  head: string;                    // Source branch
  base: string;                    // Target branch (usually main/master)
  draft?: boolean;                 // Create as draft (default: false)
  maintainerCanModify?: boolean;   // Allow maintainer modifications
}
```

**Returns:**
```typescript
interface GitHubPullRequest {
  number: number;                  // PR number
  id: string;                      // GitHub PR ID
  nodeId: string;                  // GraphQL node ID
  title: string;                   // PR title
  body: string;                    // PR description
  state: 'open' | 'closed' | 'merged'; // PR state
  head: GitHubBranchRef;           // Source branch info
  base: GitHubBranchRef;           // Target branch info
  url: string;                     // GitHub URL
  createdAt: Date;                 // Creation timestamp
  author: GitHubUser;              // PR creator
}
```

**Error Conditions:**
- `GitHubError('CREATION_FAILED')` - Failed to create PR
- `GitHubError('BRANCH_NOT_FOUND')` - Head or base branch doesn't exist
- `GitHubError('NO_CHANGES')` - No differences between branches

---

### GitHub Projects v2 Operations

#### getProject
```typescript
async function getProject(owner: string, projectNumber: number): Promise<GitHubProject>
```

**Returns:**
```typescript
// Uses shared GitHubProject interface from shared/types.ts
// See shared/types.ts for complete interface definition
```

---

#### createProject
```typescript
async function createProject(owner: string, params: CreateProjectParams): Promise<GitHubProject>
```

**Parameters:**
```typescript
interface CreateProjectParams {
  title: string;                   // Project title
  description?: string;            // Project description
  visibility: 'public' | 'private'; // Project visibility
  templateId?: string;             // Template to use
}
```

**Behavior:**
- Creates new GitHub project using GraphQL API
- Returns complete project information including node ID and number
- Handles both user and organization project creation

**GraphQL Mutation Reference:**
```graphql
mutation CreateProject($ownerId: ID!, $title: String!, $description: String) {
  createProjectV2(input: {
    ownerId: $ownerId
    title: $title
    description: $description
  }) {
    projectV2 {
      id
      number
      title
      url
      createdAt
    }
  }
}
```

**Error Conditions:**
- `GitHubError('GITHUB_PROJECT_CREATE_FAILED')` - Failed to create project
- `GitHubError('GITHUB_INVALID_OWNER')` - Owner doesn't exist or no permissions
- `GitHubError('GITHUB_PROJECT_EXISTS')` - Project with same title already exists

*Error codes follow shared ERROR_CODES pattern: MODULE_ERROR_TYPE*

---

#### findOrCreateProject
```typescript
async function findOrCreateProject(owner: string, title: string): Promise<GitHubProject>
```

**Parameters:**
- `owner: string` - Repository owner/organization
- `title: string` - Project title to find or create

**Behavior:**
- Searches for existing project with matching title
- Creates new project if none found
- Returns project information

**Error Conditions:**
- All from `createProject()` plus:
- `GitHubError('PROJECT_LIST_FAILED')` - Cannot list existing projects

---

#### detectProjectFields
```typescript
async function detectProjectFields(projectId: string): Promise<ProjectFieldDetection>
```

**Returns:**
```typescript
interface ProjectFieldDetection {
  statusField?: ProjectField;      // Status field if found
  parentField?: ProjectField;      // Parent/Epic field if found
  statusOptions: ProjectFieldOption[]; // Available status options
  detectedMappings: {
    todoOption?: ProjectFieldOption;     // "Todo"/"Backlog" option
    inProgressOption?: ProjectFieldOption; // "In Progress" option
    doneOption?: ProjectFieldOption;     // "Done"/"Completed" option
  };
}

interface ProjectField {
  id: string;                      // Field ID
  name: string;                    // Field name
  type: 'text' | 'number' | 'date' | 'singleSelect' | 'multiSelect';
  options?: ProjectFieldOption[];  // For select fields
}

interface ProjectFieldOption {
  id: string;                      // Option ID
  name: string;                    // Option display name
  color?: string;                  // Option color
}
```

**Behavior:**
- Uses GraphQL to query project fields
- Attempts to detect common field patterns:
  - Status fields (single select with workflow states)
  - Parent/Epic fields (for issue relationships)
- Maps common status names to option IDs
- Returns structured field information

**Error Conditions:**
- `GitHubError('PROJECT_NOT_FOUND')` - Project doesn't exist or no access
- `GitHubError('FIELD_DETECTION_FAILED')` - GraphQL query failed

---

#### addIssueToProject
```typescript
async function addIssueToProject(projectId: string, issueNodeId: string): Promise<ProjectItem>
```

**Returns:**
```typescript
interface ProjectItem {
  id: string;                      // Project item ID
  issueNodeId: string;             // Associated issue node ID
  projectId: string;               // Parent project ID
  fieldValues: Record<string, any>; // Current field values
}
```

**Behavior:**
- Uses GraphQL mutation to add issue to project
- Returns project item information for further updates

---

#### updateProjectItemField
```typescript
async function updateProjectItemField(params: UpdateProjectItemFieldParams): Promise<void>
```

**Parameters:**
```typescript
interface UpdateProjectItemFieldParams {
  projectId: string;               // Project node ID
  itemId: string;                  // Project item ID
  fieldId: string;                 // Field to update
  value: string | number | Date;   // New field value
  optionId?: string;               // For single select fields
}
```

**Behavior:**
- Updates specific field on project item
- Handles different field types (text, number, date, select)
- Uses appropriate GraphQL mutation based on field type

---

### Repository Management

#### createLabels
```typescript
async function createLabels(repoInfo: RepositoryInfo, labels: CreateLabelParams[]): Promise<GitHubLabel[]>
```

**Parameters:**
```typescript
interface CreateLabelParams {
  name: string;                    // Label name
  color: string;                   // Hex color code (without #)
  description?: string;            // Label description
}
```

**Behavior:**
- Creates multiple labels in batch
- Skips labels that already exist
- Returns information about created/existing labels

---

#### linkProjectToRepository
```typescript
async function linkProjectToRepository(projectId: string, repoInfo: RepositoryInfo): Promise<void>
```

**Behavior:**
- Links GitHub project to repository
- Enables project visibility in repository interface

---

### Authentication and Configuration

#### validateAuthentication
```typescript
async function validateAuthentication(): Promise<GitHubAuth>
```

**Returns:**
```typescript
// Uses shared validation pattern from shared/types.ts
// Follows ValidationResult pattern with GitHub-specific auth data
// See shared/types.ts for GitHubAuth interface definition
```

**Error Conditions:**
- `GitHubError('GITHUB_INVALID_TOKEN')` - Token invalid or expired
- `GitHubError('GITHUB_INSUFFICIENT_SCOPES')` - Token missing required scopes

*Error codes follow shared ERROR_CODES pattern: MODULE_ERROR_TYPE*

## Usage Examples

### Repository Detection
```typescript
// Auto-detect repository from git remote
const repoInfo = await detectRepository();
console.log(`Working with: ${repoInfo.owner}/${repoInfo.name}`);
```

### Issue Operations with Full Context
```typescript
// Get complete issue with relationships and projects
const completeIssue = await getIssueWithRelationships(repoInfo, 123);
console.log(`Reviewing: ${completeIssue.title}`);
console.log(`Parent issue: ${completeIssue.relationships.parentIssue?.number}`);
console.log(`In projects: ${completeIssue.projectAssociations.map(p => p.project.title)}`);

// Create tracking issue and add to project with status
const project = await getProject(repoInfo.owner, 1);
const fieldDetection = await detectProjectFields(project.id);

const trackingIssue = await createIssueWithProject(repoInfo, {
  title: 'Review Request: Issue #123',
  body: 'Automated review tracking...',
  labels: ['review', 'enhancement'],
  projectId: project.id,
  projectFieldValues: [
    {
      fieldId: fieldDetection.statusField!.id,
      optionId: fieldDetection.detectedMappings.todoOption!.id
    }
  ],
  parentIssueNodeId: completeIssue.node_id  // Set as child of original issue
});
```

### Project Integration
```typescript
// Detect project configuration
const project = await getProject(repoInfo.owner, 1);
const fieldDetection = await detectProjectFields(project.id);

// Add issue to project with status
const projectItem = await addIssueToProject(project.id, issue.nodeId);

if (fieldDetection.statusField && fieldDetection.detectedMappings.todoOption) {
  await updateProjectItemField({
    projectId: project.id,
    itemId: projectItem.id,
    fieldId: fieldDetection.statusField.id,
    optionId: fieldDetection.detectedMappings.todoOption.id
  });
}
```

### Pull Request Creation
```typescript
// Create PR after successful review
const pr = await createPullRequest(repoInfo, {
  title: 'feat(auth): implement user authentication (#123)',
  body: `
## Summary
Implements #123 - User authentication system

## Changes Made
- Added JWT authentication
- Created user login/logout endpoints
- Added middleware for protected routes

## Testing Completed
- ✅ All automated tests pass
- ✅ Manual validation completed

Closes #123
  `,
  head: 'feature-auth',
  base: repoInfo.defaultBranch
});
```

## Testing Considerations

### Unit Tests
- **URL parsing**: Test repository detection from various remote URL formats
- **GraphQL queries**: Test query construction and response parsing
- **Field detection**: Test status field mapping logic

### Integration Tests
- **Real GitHub API**: Test against actual repositories (using test org)
- **Project operations**: Full project lifecycle testing
- **Rate limiting**: Test rate limit handling and retries

### Mocking Strategy
- Mock Octokit REST and GraphQL clients
- Provide test repository and project structures
- Mock authentication for unit tests

## Configuration Requirements

### Configurable Behavior (via shared/config.ts)
```typescript
// Uses GitHubConfig from shared infrastructure
interface GitHubConfig {
  defaultProject?: number;         // Default project number
  autoCreateLabels: boolean;       // Automatically create missing labels
  rateLimitRetries: number;        // Number of rate limit retries
}
```

**Default Values** (from DEFAULT_CONFIG):
- `autoCreateLabels: true`
- `rateLimitRetries: 3`

### Environment Dependencies
- GitHub personal access token with appropriate scopes:
  - `repo` - Repository access
  - `project` - Project management
  - `admin:org` - Organization-level projects

### Required Scopes by Operation
- **Repository operations**: `repo`
- **Issue/PR operations**: `repo`
- **Project operations**: `project`
- **Organization projects**: `admin:org`

## Performance Considerations

- **Rate limiting**: Implement exponential backoff for rate limit handling
- **Caching**: Cache repository info and project field detection
- **Batch operations**: Group multiple API calls where possible
- **GraphQL efficiency**: Use GraphQL for complex queries vs multiple REST calls

## Error Recovery Patterns

### Rate Limiting
```typescript
// Automatic retry with exponential backoff
await retryWithBackoff(async () => {
  return await octokit.rest.issues.get({ owner, repo, issue_number });
}, { maxRetries: 3, baseDelay: 1000 });
```

### Field Detection Fallback
```typescript
// Graceful degradation if field detection fails
try {
  const fields = await detectProjectFields(projectId);
  // Use detected fields
} catch (error) {
  // Fall back to basic project integration
  console.warn('Field detection failed, using basic project integration');
}
```

## Implementation Notes

### Critical Technical Details

#### Using Octokit Types
```typescript
import { components } from "@octokit/openapi-types";

// Use official GitHub API types
type GitHubIssue = components["schemas"]["issue"];
type GitHubUser = components["schemas"]["simple-user"];
type GitHubLabel = components["schemas"]["label"];
type GitHubMilestone = components["schemas"]["milestone"];
```

#### GraphQL Schema References
The relationship and project queries use GitHub's GraphQL v4 API:
- **ProjectV2 Object**: https://docs.github.com/en/graphql/reference/objects#projectv2
- **ProjectV2Item Object**: https://docs.github.com/en/graphql/reference/objects#projectv2item
- **Issue Object**: https://docs.github.com/en/graphql/reference/objects#issue

#### Relationship Field Detection Strategy
GitHub Projects v2 doesn't have standardized relationship fields. Common patterns:
- **Parent Field Names**: "Parent issue", "Parent", "Epic", "Blocks"
- **Child Field Names**: "Child issues", "Sub-tasks", "Depends on"
- **Status Field Names**: "Status", "State", "Column"

The field detection should use fuzzy matching and allow configuration.

#### Authentication Requirements
Required GitHub token scopes:
```bash
# For basic operations
repo                    # Repository access
issues:write           # Issue creation and editing

# For project operations  
project                # Projects v2 read/write
admin:org              # Organization-level projects (if needed)

# Token creation example
gh auth login --scopes "repo,issues:write,project,admin:org"
```

#### Rate Limiting Strategy
GitHub API rate limits:
- **REST API**: 5,000 requests/hour (authenticated)
- **GraphQL API**: 5,000 points/hour (varies by query complexity)

Implement exponential backoff:
```typescript
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  // Implementation handles rate limiting automatically
}
```

#### Error Handling Patterns
```typescript
// Specific error types for different failure modes
class GitHubAPIError extends GitHubError {
  constructor(message: string, public status: number, public response?: any) {
    super(message, 'GITHUB_API_ERROR');
  }
}

class GitHubRateLimitError extends GitHubError {
  constructor(public resetTime: Date) {
    super('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
  }
}
```

### Required External Libraries
```json
{
  "dependencies": {
    "@octokit/rest": "^19.0.0",
    "@octokit/graphql": "^5.0.0", 
    "@octokit/openapi-types": "^18.0.0",
    "@octokit/auth-token": "^3.0.0"
  }
}
```

### GraphQL Query Optimization
- **Use fragments** for reusable field sets
- **Batch operations** where possible
- **Limit field queries** to reduce complexity points
- **Cache project field detection** to avoid repeated queries

## Future Extensions

- **Webhook support**: Handle GitHub webhook events
- **Advanced project queries**: Complex project item filtering and search
- **Repository templates**: Support for repository template creation
- **Advanced PR operations**: Review requests, status checks integration
- **Bulk operations**: Batch issue creation and project updates