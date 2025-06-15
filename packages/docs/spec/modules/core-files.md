# Core Module: Files

← [Back to Index](../README.md) | [Previous: Claude Module](./core-claude.md) | [Next: Workflows →](../workflows/)

## Purpose
Provides file system operations supporting context management, feedback extraction, and cleanup operations across all workflows. Handles CLAUDE.md files, work reports, feedback documents, and temporary file management.

## Dependencies
- `shared/types.ts` - File operation interfaces
- `shared/errors.ts` - FileError class
- `shared/config.ts` - File operation configuration
- Node.js `fs/promises` - File system operations
- Node.js `path` - Path manipulation

## Function Signatures

### Context File Management

#### ensureClaudeContext
```typescript
async function ensureClaudeContext(targetPath: string, sourcePath?: string): Promise<ClaudeContextStatus>
```

**Parameters:**
- `targetPath: string` - Directory to ensure context files exist
- `sourcePath?: string` - Source directory to copy from (default: repository root)

**Returns:**
```typescript
interface ClaudeContextStatus {
  isComplete: boolean;             // Whether context is fully set up
  claudeMdExists: boolean;         // CLAUDE.md file present
  claudeDirExists: boolean;        // .claude/ directory present
  copiedFiles: string[];           // Files copied during operation
}
```

**Behavior:**
- Copies CLAUDE.md from source if missing in target
- Copies .claude/ directory from source if missing in target  
- Returns status information for workflow validation
- Defaults to repository root if sourcePath not provided

**Error Conditions:**
- `FileError('TARGET_NOT_FOUND')` - Target directory doesn't exist
- `FileError('SOURCE_NOT_FOUND')` - Source directory doesn't exist
- `FileError('COPY_FAILED')` - Failed to copy context files

---

#### copyClaudeContext
```typescript
async function copyClaudeContext(sourcePath: string, targetPath: string, options?: CopyContextOptions): Promise<string[]>
```

**Parameters:**
```typescript
interface CopyContextOptions {
  overwrite?: boolean;             // Overwrite existing files (default: false)
  preserveLocal?: boolean;         // Don't copy .local.json files (default: true)
  includeCommands?: boolean;       // Copy .claude/commands/ directory (default: true)
}
```

**Returns:** Array of copied file paths

**Behavior:**
- Copies CLAUDE.md from source to target
- Copies .claude/ directory structure
- Respects overwrite and preservation settings
- Maintains file permissions and timestamps

---

### Work Report Management

#### createWorkReport
```typescript
async function createWorkReport(options: CreateWorkReportOptions): Promise<string>
```

**Parameters:**
```typescript
interface CreateWorkReportOptions {
  issueNumber: number;             // Issue being worked on
  workTreePath: string;            // Worktree where work was done
  repositoryInfo: RepositoryInfo;  // Repository context
  branchInfo: GitBranchInfo;       // Branch information
  summary?: string;                // Work summary (auto-generated if not provided)
  includeGitDiff?: boolean;        // Include git diff in report (default: true)
  includeTesting?: boolean;        // Include testing section (default: true)
}
```

**Returns:** Path to created work report file

**Behavior:**
- Creates structured work report in `planning/temp/work-report/`
- Includes issue context, changes made, and validation steps
- Auto-generates git diff summary if not provided
- Creates testing checklist based on changes
- Formats report for easy review consumption

**Report Template:**
```markdown
# Work Report: Issue #123

## Issue Context
- **Issue**: #123 - Implement user authentication
- **Repository**: owner/repo
- **Branch**: feature-auth
- **Worktree**: ../claude-swarm-task-123

## Work Summary
{Auto-generated or provided summary}

## Changes Made
{Git diff analysis}

## Testing Completed
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual validation completed

## Review Notes
{Any specific notes for reviewer}

## Generated
- **Date**: 2024-12-14 14:30:22
- **Tool**: claude-swarm TypeScript migration
```

---

#### readWorkReport
```typescript
async function readWorkReport(issueNumber: number, reportPath?: string): Promise<WorkReport>
```

**Returns:**
```typescript
interface WorkReport {
  issueNumber: number;             // Associated issue number
  filePath: string;                // Report file path
  content: string;                 // Full report content
  metadata: WorkReportMetadata;    // Parsed metadata
  sections: WorkReportSections;    // Structured sections
}

interface WorkReportMetadata {
  created: Date;                   // Report creation time
  issueTitle?: string;             // Issue title
  repository?: string;             // Repository name
  branch?: string;                 // Work branch
  worktree?: string;               // Worktree path
}

interface WorkReportSections {
  summary?: string;                // Work summary
  changes?: string;                // Changes description
  testing?: string;                // Testing information
  notes?: string;                  // Review notes
}
```

**Behavior:**
- Locates work report file by issue number
- Parses structured content into sections
- Extracts metadata from report headers
- Validates report completeness

---

### Feedback Document Management

#### createFeedbackDocument
```typescript
async function createFeedbackDocument(options: CreateFeedbackOptions): Promise<string>
```

**Parameters:**
```typescript
interface CreateFeedbackOptions {
  issueNumber: number;             // Original issue number
  reviewResult: 'approved' | 'needs_work'; // Review outcome
  feedback: ReviewFeedback;        // Structured feedback
  reviewerInfo?: string;           // Reviewer identification
  workReportPath?: string;         // Path to original work report
}

interface ReviewFeedback {
  summary: string;                 // Overall feedback summary
  approvedAspects?: string[];      // What was done well
  requiredChanges?: FeedbackItem[]; // Required modifications
  suggestions?: FeedbackItem[];    // Optional improvements
  testingNotes?: string;           // Testing validation results
}

interface FeedbackItem {
  category: 'code' | 'tests' | 'documentation' | 'other';
  description: string;             // What needs to be changed
  location?: string;               // File/line reference
  priority: 'high' | 'medium' | 'low';
  suggestion?: string;             // How to fix it
}
```

**Returns:** Path to created feedback document

**Behavior:**
- Creates structured feedback document in `planning/temp/feedback/`
- Formats feedback for easy consumption by development workflow
- Includes actionable items with priorities
- Links back to original work report

**Feedback Template:**
```markdown
# Review Feedback: Issue #123

## Review Result: NEEDS_WORK

## Summary
{Overall feedback summary}

## Required Changes
### High Priority
- **Code**: Authentication middleware missing error handling
  - Location: `src/middleware/auth.ts:45`
  - Fix: Add try-catch block and proper error responses

### Medium Priority
- **Tests**: Missing integration tests for login flow
  - Suggestion: Add tests in `test/integration/auth.test.ts`

## Approved Aspects
- JWT implementation follows security best practices
- Code structure is clean and maintainable

## Testing Results
- ✅ Unit tests pass
- ❌ Integration tests incomplete
- ✅ Manual validation successful

## Next Steps
1. Address required changes above
2. Re-run full test suite
3. Request re-review when complete
```

---

#### readFeedbackDocument
```typescript
async function readFeedbackDocument(issueNumber: number, feedbackPath?: string): Promise<ReviewFeedbackDocument>
```

**Returns:**
```typescript
interface ReviewFeedbackDocument {
  issueNumber: number;             // Associated issue
  filePath: string;                // Document path
  result: 'approved' | 'needs_work'; // Review outcome
  feedback: ReviewFeedback;        // Parsed feedback
  created: Date;                   // Creation timestamp
  reviewer?: string;               // Reviewer info
}
```

---

### Temporary File Management

#### cleanupTempFiles
```typescript
async function cleanupTempFiles(options: CleanupOptions): Promise<CleanupResult>
```

**Parameters:**
```typescript
interface CleanupOptions {
  olderThan?: Date;                // Remove files older than date
  patterns?: string[];             // File patterns to remove
  dryRun?: boolean;                // Show what would be removed (default: false)
  preserveReports?: boolean;       // Keep work reports (default: true)
}
```

**Returns:**
```typescript
interface CleanupResult {
  filesRemoved: string[];          // Removed file paths
  spaceSaved: number;              // Bytes freed
  errors: CleanupError[];          // Any cleanup failures
}

interface CleanupError {
  path: string;                    // Failed file path
  error: string;                   // Error description
}
```

**Behavior:**
- Scans `planning/temp/` directory for cleanup targets
- Respects preservation settings for important files
- Provides dry-run capability for safe cleanup
- Returns detailed cleanup results

---

#### createTempDirectory
```typescript
async function createTempDirectory(prefix: string): Promise<string>
```

**Parameters:**
- `prefix: string` - Directory name prefix (e.g., 'swarm-task-123')

**Returns:** Path to created temporary directory

**Behavior:**
- Creates unique temporary directory in `planning/temp/`
- Ensures directory name uniqueness with timestamps if needed
- Sets appropriate permissions

---

### File Structure Validation

#### validateFileStructure
```typescript
async function validateFileStructure(path: string): Promise<StructureValidation>
```

**Returns:**
```typescript
interface StructureValidation {
  isValid: boolean;                // Structure is correct
  hasClaudeContext: boolean;       // CLAUDE.md and .claude/ present
  hasGitRepo: boolean;             // Valid git repository
  hasPackageConfig: boolean;       // package.json or similar
  issues: string[];                // Validation problems
}
```

**Behavior:**
- Validates directory structure for development workflows
- Checks for required context files
- Verifies project configuration presence
- Provides actionable recommendations

## Usage Examples

### Context Management
```typescript
// Ensure Claude context in review worktree
const contextStatus = await ensureClaudeContext(
  '/path/to/review-worktree',
  '/path/to/main-repo'
);

if (!contextStatus.isComplete) {
  console.log('Context incomplete, missing:', 
    contextStatus.claudeMdExists ? '' : 'CLAUDE.md',
    contextStatus.claudeDirExists ? '' : '.claude/'
  );
}
```

### Work Report Creation
```typescript
// Create work report after task completion
const reportPath = await createWorkReport({
  issueNumber: 123,
  workTreePath: '/path/to/task-worktree',
  repositoryInfo: repoInfo,
  branchInfo: branchInfo,
  summary: 'Implemented JWT authentication with middleware',
  includeGitDiff: true,
  includeTesting: true
});

console.log(`Work report created: ${reportPath}`);
```

### Review Feedback Creation
```typescript
// Create feedback document after review
const feedbackPath = await createFeedbackDocument({
  issueNumber: 123,
  reviewResult: 'needs_work',
  feedback: {
    summary: 'Good implementation but needs error handling improvements',
    requiredChanges: [
      {
        category: 'code',
        description: 'Add error handling to auth middleware',
        location: 'src/middleware/auth.ts:45',
        priority: 'high',
        suggestion: 'Wrap in try-catch and return proper error responses'
      }
    ],
    approvedAspects: ['Clean code structure', 'Good JWT implementation']
  }
});
```

### Cleanup Operations
```typescript
// Clean up old temporary files
const cleanupResult = await cleanupTempFiles({
  olderThan: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
  preserveReports: true,
  dryRun: false
});

console.log(`Cleanup complete: ${cleanupResult.filesRemoved.length} files removed`);
console.log(`Space saved: ${cleanupResult.spaceSaved} bytes`);
```

### File Analysis
```typescript
// Analyze changes for review preparation
const gitDiff = await getDiff({ from: 'main', to: 'HEAD' });
const analysis = await analyzeChangedFiles(gitDiff);

console.log(`Risk level: ${analysis.summary.riskProfile}`);
console.log(`Test coverage: ${analysis.summary.testCoverage}`);
console.log(`Code files changed: ${analysis.codeFiles.length}`);
```

## Testing Considerations

### Unit Tests
- **Path generation**: Test temporary directory creation
- **Content parsing**: Test work report and feedback parsing
- **File analysis**: Test change categorization logic

### Integration Tests
- **File operations**: Test real file creation and cleanup
- **Context copying**: Test Claude context management
- **Structure validation**: Test against real project structures

### Mocking Strategy
- Mock `fs/promises` for file system operations
- Mock `path` utilities for cross-platform testing
- Provide test file structures and content

## Configuration Requirements

### Environment Dependencies
- Node.js fs permissions for file operations
- Write access to planning/temp/ directory
- Git repository for diff analysis

### Configurable Behavior
- Temporary file retention period
- Default report templates
- File analysis rules and thresholds

## Performance Considerations

- **File caching**: Cache file analysis results
- **Batch operations**: Group multiple file operations
- **Streaming**: Use streams for large file operations
- **Async operations**: Parallel file processing where safe

## Security Considerations

- **Path validation**: Prevent directory traversal attacks
- **File permissions**: Respect system file permissions
- **Content sanitization**: Sanitize file content in reports
- **Cleanup safety**: Validate paths before deletion

## Future Extensions

- **Template system**: Configurable report and feedback templates
- **File watching**: Monitor file changes for real-time updates
- **Compression**: Archive old work reports and feedback
- **Backup integration**: Backup important temporary files
- **Rich formatting**: Support for enhanced markdown and media files