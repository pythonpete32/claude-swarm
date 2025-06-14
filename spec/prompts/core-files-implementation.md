# Core Files Module Implementation Prompt

<instructions>
Implement the core-files module for the Claude Swarm TypeScript migration project using Test-Driven Development (TDD) methodology. This module provides file system operations supporting context management, feedback extraction, and cleanup operations across all workflows.

Build a robust, testable, and well-documented file operations module that:
- Manages CLAUDE.md and .claude/ directory context across worktrees
- Creates and parses structured work reports and feedback documents
- Handles temporary file management and cleanup operations
- Validates project file structures for development workflows
- Follows the established error handling and configuration patterns
- Integrates seamlessly with the shared infrastructure and core-git module

Create the module at `src/core/files.ts` with comprehensive tests following TDD principles.
</instructions>

<requirements>
Functional Requirements:
- `ensureClaudeContext()` - Copy CLAUDE.md and .claude/ to target directories
- `copyClaudeContext()` - Detailed context file copying with options
- `createWorkReport()` - Generate structured work reports for completed tasks
- `readWorkReport()` - Parse and extract data from existing work reports
- `createFeedbackDocument()` - Generate review feedback documents
- `readFeedbackDocument()` - Parse review feedback documents
- `cleanupTempFiles()` - Clean up old temporary files with configurable retention
- `createTempDirectory()` - Create unique temporary directories
- `validateFileStructure()` - Validate project structure for workflows

Technical Requirements:
- TypeScript with strict type checking and 90%+ test coverage
- Use shared types from `@/shared/types`
- Use standardized error handling from `@/shared/errors`
- Use validation utilities from `@/shared/validation`
- Integrate with core-git for diff analysis functionality
- Support cross-platform file operations (macOS, Linux, Windows)
- Handle file permissions and access control properly
- Use streams for large file operations where appropriate

Interface Requirements:
- Export all functions as named exports
- Use ClaudeContextStatus, WorkReport, ReviewFeedback interfaces from shared types
- Accept configuration objects for customization behavior
- Return structured result objects with detailed status information
- Support dependency injection for testing (FileSystemInterface, PathInterface)
- Provide both synchronous validation and asynchronous file operations
</requirements>

<architecture>
Layer Position: Core Layer (src/core/)
- Used by: core-worktree, workflows/work-on-task, workflows/review-task
- Uses: shared/types, shared/errors, shared/validation, core/git, Node.js fs/promises, path
- Dependencies: core-git (for diff analysis), shared infrastructure

Design Patterns:
- Dependency injection for file system operations (enables testing)
- Factory pattern for creating file operation contexts
- Builder pattern for complex report generation
- Strategy pattern for different file structure validation approaches
- Template method pattern for report and feedback document generation

File Structure:
```
src/core/files.ts                    # Main implementation
tests/unit/core/files.test.ts         # Unit tests with mocked fs operations
tests/integration/files.test.ts       # Integration tests with real file system
tests/fixtures/files/                 # Test file structures and content
  ├── mock-claude-context/            # Sample CLAUDE.md and .claude/ directory
  ├── sample-work-reports/             # Example work report files
  ├── sample-feedback/                 # Example feedback documents
  └── project-structures/              # Various project layouts for validation
```
</architecture>

<error-handling>
Use Hierarchical Error System:
- Import ErrorFactory and ERROR_CODES from `@/shared/errors`
- Add new file-specific error codes to ERROR_CODES:
  - `FILE_NOT_FOUND` - File or directory doesn't exist
  - `FILE_COPY_FAILED` - File copy operation failed
  - `FILE_PERMISSION_DENIED` - Insufficient file system permissions
  - `FILE_INVALID_STRUCTURE` - Invalid project structure detected
  - `FILE_CLEANUP_FAILED` - Temporary file cleanup operation failed
  - `FILE_PARSE_FAILED` - Failed to parse report or feedback document
  - `FILE_CONTEXT_INCOMPLETE` - Claude context setup incomplete

Error Handling Patterns:
```typescript
// File operation with context
try {
  await fileSystem.copyFile(source, target);
  return { success: true, copiedFiles: [target] };
} catch (error) {
  if (error.code === 'ENOENT') {
    throw ErrorFactory.files(
      ERROR_CODES.FILE_NOT_FOUND,
      `Source file not found: ${source}`,
      { source, target, operation: 'copy' }
    );
  }
  throw ErrorFactory.files(
    ERROR_CODES.FILE_COPY_FAILED,
    `Failed to copy file: ${error.message}`,
    { source, target, originalError: error }
  );
}

// Validation with suggestions
const validation = await validateFileStructure(projectPath);
if (!validation.isValid) {
  throw ErrorFactory.files(
    ERROR_CODES.FILE_INVALID_STRUCTURE,
    `Invalid project structure: ${validation.issues.join(', ')}`,
    { 
      path: projectPath, 
      issues: validation.issues,
      suggestions: ['Ensure CLAUDE.md exists', 'Create .claude/ directory']
    }
  );
}
```

Include helpful suggestions in error messages and provide context data for debugging.
</error-handling>

<testing>
TDD Implementation Strategy (Test-Driven Development):

Red-Green-Refactor Cycles:
1. **Red Phase**: Write failing tests for each function before implementation
2. **Green Phase**: Write minimal code to make tests pass
3. **Refactor Phase**: Improve code quality while maintaining test coverage

Unit Testing Strategy (90% coverage minimum):
- Mock `fs/promises` and `path` modules using dependency injection
- Test each function with valid inputs and expected outputs
- Test error conditions: file not found, permission denied, invalid structures
- Test cross-platform path handling with different separators
- Use test fixtures for consistent file content and structures
- Mock core-git dependencies for diff analysis functions

Integration Testing Strategy:
- Test real file system operations in isolated temporary directories
- Test actual CLAUDE.md and .claude/ directory copying
- Test work report and feedback document creation/parsing with real files
- Test cleanup operations with actual temporary files
- Verify cross-platform file permissions and access control

Testing Structure:
```typescript
// Unit tests with mocks
describe('core-files unit tests', () => {
  let mockFileSystem: MockFileSystemInterface;
  let mockPath: MockPathInterface;
  
  beforeEach(() => {
    mockFileSystem = new MockFileSystem();
    mockPath = new MockPath();
  });
  
  describe('ensureClaudeContext', () => {
    it('should copy CLAUDE.md when missing in target');
    it('should copy .claude directory when missing in target');
    it('should handle source directory not found');
    it('should handle permission errors gracefully');
  });
});

// Integration tests with real files
describe('core-files integration tests', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    tempDir = await createTempTestDirectory();
  });
  
  afterEach(async () => {
    await cleanupTempTestDirectory(tempDir);
  });
});
```

Test Coverage Requirements:
- All public functions: 100% coverage
- Error paths: 90% coverage
- Cross-platform scenarios: Linux/macOS/Windows path handling
- Performance: File operations under 100ms for typical operations
</testing>

<implementation-order>
TDD Implementation Phases:

Phase 1: Dependency Injection Setup
1. Define FileSystemInterface and PathInterface for testability
2. Create default implementations and mock implementations
3. Set up test infrastructure and fixtures

Phase 2: Context Management (Test-First)
```typescript
// 1. Write failing tests first
describe('ensureClaudeContext', () => {
  it('should return complete status when context exists');
  it('should copy missing CLAUDE.md from source');
  it('should copy missing .claude directory from source');
});

// 2. Implement minimal functionality to pass tests
async function ensureClaudeContext(
  targetPath: string, 
  sourcePath?: string,
  fileSystem: FileSystemInterface = defaultFileSystem
): Promise<ClaudeContextStatus>

// 3. Refactor implementation for quality and performance
```

Phase 3: Work Report Management (Test-First)
```typescript
// Tests for createWorkReport and readWorkReport
// Implementation following same TDD cycle
```

Phase 4: Feedback Document Management (Test-First)
```typescript
// Tests for createFeedbackDocument and readFeedbackDocument
// Implementation following same TDD cycle
```

Phase 5: Utility Functions (Test-First)
```typescript
// Tests for cleanupTempFiles, createTempDirectory, validateFileStructure
// Implementation following same TDD cycle
```

Function Implementation Priority:
1. `validateFileStructure()` - Foundation for other operations
2. `ensureClaudeContext()` - Core context management
3. `copyClaudeContext()` - Detailed copying functionality
4. `createTempDirectory()` - Utility for temp operations
5. `createWorkReport()` - Work reporting functionality
6. `readWorkReport()` - Work report parsing
7. `createFeedbackDocument()` - Review feedback creation
8. `readFeedbackDocument()` - Feedback parsing
9. `cleanupTempFiles()` - Cleanup and maintenance
</implementation-order>

<interfaces>
TypeScript Interfaces (extends shared types):

```typescript
// Context Management
export interface FileSystemInterface {
  access(path: string): Promise<void>;
  copyFile(source: string, target: string): Promise<void>;
  readFile(path: string, encoding: string): Promise<string>;
  writeFile(path: string, content: string, encoding: string): Promise<void>;
  mkdir(path: string, options: { recursive: boolean }): Promise<void>;
  readdir(path: string): Promise<string[]>;
  stat(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean }>;
  unlink(path: string): Promise<void>;
}

export interface PathInterface {
  join(...paths: string[]): string;
  resolve(...paths: string[]): string;
  dirname(path: string): string;
  basename(path: string): string;
  extname(path: string): string;
}

// File Operation Results
export interface ClaudeContextStatus {
  isComplete: boolean;                 // Whether context is fully set up
  claudeMdExists: boolean;             // CLAUDE.md file present
  claudeDirExists: boolean;            // .claude/ directory present
  copiedFiles: string[];               // Files copied during operation
}

export interface CopyContextOptions {
  overwrite?: boolean;                 // Overwrite existing files
  preserveLocal?: boolean;             // Don't copy .local.json files
  includeCommands?: boolean;           // Copy .claude/commands/ directory
}

// Work Report Management
export interface CreateWorkReportOptions {
  issueNumber: number;                 // Issue being worked on
  workTreePath: string;                // Worktree where work was done
  repositoryInfo: RepositoryInfo;      // Repository context
  branchInfo: GitBranchInfo;           // Branch information
  summary?: string;                    // Work summary
  includeGitDiff?: boolean;            // Include git diff in report
  includeTesting?: boolean;            // Include testing section
}

export interface WorkReport {
  issueNumber: number;                 // Associated issue number
  filePath: string;                    // Report file path
  content: string;                     // Full report content
  metadata: WorkReportMetadata;        // Parsed metadata
  sections: WorkReportSections;        // Structured sections
}

export interface WorkReportMetadata {
  created: Date;                       // Report creation time
  issueTitle?: string;                 // Issue title
  repository?: string;                 // Repository name
  branch?: string;                     // Work branch
  worktree?: string;                   // Worktree path
}

export interface WorkReportSections {
  summary?: string;                    // Work summary
  changes?: string;                    // Changes description
  testing?: string;                    // Testing information
  notes?: string;                      // Review notes
}

// Review Feedback Management
export interface CreateFeedbackOptions {
  issueNumber: number;                 // Original issue number
  reviewResult: 'approved' | 'needs_work'; // Review outcome
  feedback: ReviewFeedback;            // Structured feedback
  reviewerInfo?: string;               // Reviewer identification
  workReportPath?: string;             // Path to original work report
}

export interface ReviewFeedback {
  summary: string;                     // Overall feedback summary
  approvedAspects?: string[];          // What was done well
  requiredChanges?: FeedbackItem[];    // Required modifications
  suggestions?: FeedbackItem[];        // Optional improvements
  testingNotes?: string;               // Testing validation results
}

export interface FeedbackItem {
  category: 'code' | 'tests' | 'documentation' | 'other';
  description: string;                 // What needs to be changed
  location?: string;                   // File/line reference
  priority: 'high' | 'medium' | 'low';
  suggestion?: string;                 // How to fix it
}

export interface ReviewFeedbackDocument {
  issueNumber: number;                 // Associated issue
  filePath: string;                    // Document path
  result: 'approved' | 'needs_work';   // Review outcome
  feedback: ReviewFeedback;            // Parsed feedback
  created: Date;                       // Creation timestamp
  reviewer?: string;                   // Reviewer info
}

// Cleanup Management
export interface CleanupOptions {
  olderThan?: Date;                    // Remove files older than date
  patterns?: string[];                 // File patterns to remove
  dryRun?: boolean;                    // Show what would be removed
  preserveReports?: boolean;           // Keep work reports
}

export interface CleanupResult {
  filesRemoved: string[];              // Removed file paths
  spaceSaved: number;                  // Bytes freed
  errors: CleanupError[];              // Any cleanup failures
}

export interface CleanupError {
  path: string;                        // Failed file path
  error: string;                       // Error description
}

// Structure Validation
export interface StructureValidation {
  isValid: boolean;                    // Structure is correct
  hasClaudeContext: boolean;           // CLAUDE.md and .claude/ present
  hasGitRepo: boolean;                 // Valid git repository
  hasPackageConfig: boolean;           // package.json or similar
  issues: string[];                    // Validation problems
}
```
</interfaces>

<examples>
Usage Examples and Integration Patterns:

```typescript
// Example 1: Context Management in Worktree Creation
import { ensureClaudeContext, validateFileStructure } from '@/core/files';
import { createWorktree } from '@/core/worktree';

async function setupTaskWorktree(taskNumber: number) {
  // Create worktree for task
  const worktree = await createWorktree({
    name: `task-${taskNumber}`,
    sourceBranch: 'main'
  });
  
  // Ensure Claude context is available
  const contextStatus = await ensureClaudeContext(
    worktree.path,
    worktree.repositoryPath
  );
  
  if (!contextStatus.isComplete) {
    console.log('Context setup incomplete:', {
      claudeMd: contextStatus.claudeMdExists,
      claudeDir: contextStatus.claudeDirExists,
      copied: contextStatus.copiedFiles
    });
  }
  
  // Validate final structure
  const validation = await validateFileStructure(worktree.path);
  if (!validation.isValid) {
    throw new Error(`Invalid worktree structure: ${validation.issues.join(', ')}`);
  }
  
  return worktree;
}

// Example 2: Work Report Creation After Task Completion
import { createWorkReport, getDiff } from '@/core/files';
import { getCurrentBranch } from '@/core/git';

async function completeTaskWork(issueNumber: number, worktreePath: string) {
  // Get current branch and repository info
  const branchInfo = await getCurrentBranch(worktreePath);
  const repositoryInfo = await getRepositoryInfo(worktreePath);
  
  // Generate work summary from git diff
  const diff = await getDiff(worktreePath, 'main', 'HEAD');
  const summary = `Modified ${diff.changedFiles.length} files with ${diff.insertions} additions and ${diff.deletions} deletions`;
  
  // Create comprehensive work report
  const reportPath = await createWorkReport({
    issueNumber,
    workTreePath: worktreePath,
    repositoryInfo,
    branchInfo,
    summary,
    includeGitDiff: true,
    includeTesting: true
  });
  
  console.log(`Work report created: ${reportPath}`);
  return reportPath;
}

// Example 3: Review Feedback Document Creation
import { createFeedbackDocument, readWorkReport } from '@/core/files';

async function createReviewFeedback(issueNumber: number, reviewOutcome: 'approved' | 'needs_work') {
  // Read the original work report
  const workReport = await readWorkReport(issueNumber);
  
  // Create structured feedback
  const feedback: ReviewFeedback = {
    summary: reviewOutcome === 'approved' 
      ? 'Implementation meets requirements and follows best practices'
      : 'Implementation needs improvements before approval',
    approvedAspects: [
      'Clean code structure',
      'Good error handling',
      'Comprehensive test coverage'
    ],
    requiredChanges: reviewOutcome === 'needs_work' ? [
      {
        category: 'code',
        description: 'Add input validation for edge cases',
        location: 'src/core/files.ts:150-160',
        priority: 'high',
        suggestion: 'Use CommonValidators from shared/validation'
      }
    ] : [],
    testingNotes: 'All tests pass, coverage is above 90%'
  };
  
  // Create feedback document
  const feedbackPath = await createFeedbackDocument({
    issueNumber,
    reviewResult: reviewOutcome,
    feedback,
    reviewerInfo: 'Claude Code Review System',
    workReportPath: workReport.filePath
  });
  
  return feedbackPath;
}

// Example 4: Temporary File Cleanup
import { cleanupTempFiles, createTempDirectory } from '@/core/files';

async function maintainTempFiles() {
  // Create working directory for current session
  const tempDir = await createTempDirectory('swarm-session');
  
  // Cleanup files older than 7 days, preserve work reports
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const cleanupResult = await cleanupTempFiles({
    olderThan: oneWeekAgo,
    preserveReports: true,
    dryRun: false
  });
  
  console.log(`Cleanup completed: ${cleanupResult.filesRemoved.length} files removed`);
  console.log(`Space saved: ${Math.round(cleanupResult.spaceSaved / 1024)}KB`);
  
  if (cleanupResult.errors.length > 0) {
    console.warn('Cleanup errors:', cleanupResult.errors);
  }
  
  return tempDir;
}

// Example 5: Error Handling Patterns
import { ErrorFactory, ERROR_CODES } from '@/shared/errors';

async function safeFileOperation(sourcePath: string, targetPath: string) {
  try {
    const result = await copyClaudeContext(sourcePath, targetPath, {
      overwrite: true,
      preserveLocal: true
    });
    return { success: true, copiedFiles: result };
  } catch (error) {
    if (error.code === ERROR_CODES.FILE_NOT_FOUND) {
      // Handle missing source gracefully
      console.warn(`Source context not found: ${sourcePath}`);
      return { success: false, reason: 'source_missing' };
    }
    
    if (error.code === ERROR_CODES.FILE_PERMISSION_DENIED) {
      // Provide helpful suggestion
      throw ErrorFactory.files(
        ERROR_CODES.FILE_PERMISSION_DENIED,
        `Insufficient permissions to copy context files. Try: chmod +r ${sourcePath}`,
        { sourcePath, targetPath, suggestion: 'Check file permissions' }
      );
    }
    
    // Re-throw other errors
    throw error;
  }
}
```

Integration with Other Core Modules:
```typescript
// Integration with core-git for diff analysis
import { getDiff } from '@/core/git';

// Integration with shared validation
import { CommonValidators } from '@/shared/validation';

// Integration with shared configuration
import { getConfig } from '@/shared/config';

// Integration pattern for worktree workflows
async function workflowFileOperations(worktreePath: string) {
  // Validate inputs using shared validators
  CommonValidators.worktreePath().validateOrThrow(worktreePath);
  
  // Use configuration for default behaviors
  const config = await getConfig();
  
  // Integrate with git operations
  const diff = await getDiff(worktreePath, config.defaultBranch, 'HEAD');
  
  // Perform file operations with context
  return await createWorkReport({
    // ... options including diff analysis
  });
}
```
</examples>