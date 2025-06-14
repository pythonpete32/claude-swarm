# Library Export Guide

← [Back to Index](./README.md) | [Previous: Error Handling](./07-error-handling.md)

## Overview

This guide covers how to package and export Claude Swarm as a reusable TypeScript library that can be easily installed and used in other projects. The library provides both programmatic APIs and CLI tools for AI development workflow automation.

## Package Structure

### Distribution Package Layout

```
claude-swarm/
├── dist/                         # Compiled JavaScript output
│   ├── index.js                  # Main library entry point
│   ├── index.d.ts                # TypeScript declarations
│   ├── core/                     # Core modules
│   │   ├── worktree.js
│   │   ├── worktree.d.ts
│   │   ├── github.js
│   │   ├── github.d.ts
│   │   ├── claude.js
│   │   ├── claude.d.ts
│   │   ├── tmux.js
│   │   ├── tmux.d.ts
│   │   ├── git.js
│   │   ├── git.d.ts
│   │   ├── files.js
│   │   └── files.d.ts
│   ├── workflows/                # Workflow orchestrations
│   │   ├── work-on-task.js
│   │   ├── work-on-task.d.ts
│   │   ├── review-task.js
│   │   ├── review-task.d.ts
│   │   └── setup-project.js
│   └── shared/                   # Shared infrastructure
│       ├── types.js
│       ├── types.d.ts
│       ├── errors.js
│       ├── errors.d.ts
│       ├── config.js
│       └── config.d.ts
├── bin/                          # CLI executables
│   ├── claude-swarm              # Main CLI entry point
│   ├── work-on-task              # Direct workflow commands
│   ├── review-task
│   └── setup-project
├── templates/                    # Project templates and examples
│   ├── .claude/
│   │   ├── config.json
│   │   └── commands/
│   └── examples/
│       ├── basic-usage.ts
│       ├── custom-workflow.ts
│       └── parallel-agents.ts
└── package.json
```

## Package Configuration

### package.json

```json
{
  "name": "claude-swarm",
  "version": "1.0.0",
  "description": "AI development workflow automation with Claude Code integration",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "claude-swarm": "./bin/claude-swarm",
    "work-on-task": "./bin/work-on-task",
    "review-task": "./bin/review-task",
    "setup-project": "./bin/setup-project"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./core": {
      "import": "./dist/core/index.js",
      "require": "./dist/core/index.js",
      "types": "./dist/core/index.d.ts"
    },
    "./workflows": {
      "import": "./dist/workflows/index.js",
      "require": "./dist/workflows/index.js", 
      "types": "./dist/workflows/index.d.ts"
    },
    "./shared": {
      "import": "./dist/shared/index.js",
      "require": "./dist/shared/index.js",
      "types": "./dist/shared/index.d.ts"
    }
  },
  "files": [
    "dist/**/*",
    "bin/**/*",
    "templates/**/*",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "bun run build:ts && bun run build:cli",
    "build:ts": "tsc --project tsconfig.build.json",
    "build:cli": "bun run generate-cli-binaries",
    "test": "bun test",
    "test:coverage": "bun test --coverage",
    "lint": "eslint src/**/*.ts",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "bun run build && bun run test",
    "postinstall": "node dist/postinstall.js"
  },
  "keywords": [
    "ai",
    "claude",
    "development",
    "workflow",
    "automation",
    "git",
    "worktree",
    "github",
    "tmux"
  ],
  "author": "Claude Swarm Team",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org/claude-swarm.git"
  },
  "bugs": {
    "url": "https://github.com/your-org/claude-swarm/issues"
  },
  "homepage": "https://github.com/your-org/claude-swarm#readme",
  "engines": {
    "node": ">=18.0.0",
    "bun": ">=1.0.0"
  },
  "peerDependencies": {
    "typescript": ">=5.0.0"
  },
  "dependencies": {
    "@octokit/rest": "^20.0.0",
    "@octokit/graphql": "^7.0.0",
    "@octokit/openapi-types": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0"
  },
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  }
}
```

### TypeScript Build Configuration

```json
// tsconfig.build.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "src/**/*.test.ts",
    "src/**/*.spec.ts",
    "tests/**/*",
    "dist/**/*"
  ]
}
```

## Library API Design

### Main Entry Point

```typescript
// src/index.ts - Main library export
export * from './core';
export * from './workflows';
export * from './shared';

// Default export for convenience
import * as core from './core';
import * as workflows from './workflows';
import * as shared from './shared';

export default {
  core,
  workflows,
  shared
};

// Version information
export const version = process.env.npm_package_version || '1.0.0';
```

### Core Module Exports

```typescript
// src/core/index.ts
export * from './worktree';
export * from './github'; 
export * from './claude';
export * from './tmux';
export * from './git';
export * from './files';

// Convenience re-exports
export {
  createWorktree,
  removeWorktree,
  findWorktrees,
  getActiveAgents
} from './worktree';

export {
  detectRepository,
  getIssueWithRelationships,
  createIssueWithProject,
  validateAuthentication
} from './github';

export {
  launchClaudeInteractive,
  generateWorkPrompt,
  validateClaudeAvailable
} from './claude';

export {
  createTmuxSession,
  killSession,
  listSessions
} from './tmux';

export {
  validateRepository,
  getCurrentBranch,
  getDiff
} from './git';

export {
  ensureClaudeContext,
  copyClaudeContext,
  validateStructure
} from './files';
```

### Workflow Exports

```typescript
// src/workflows/index.ts
export { workOnTask } from './work-on-task';
export { reviewTask } from './review-task';
export { setupProject } from './setup-project';
export { cleanupReview } from './cleanup-review';

// Workflow types
export type {
  WorkOnTaskOptions,
  WorkOnTaskResult,
  ReviewTaskOptions,
  ReviewTaskResult,
  SetupProjectOptions
} from '../shared/types';
```

### Shared Infrastructure Exports

```typescript
// src/shared/index.ts
export * from './types';
export * from './errors';
export * from './config';

// Convenience exports
export {
  SwarmError,
  WorktreeError,
  GitHubError,
  ClaudeError,
  TmuxError,
  GitError,
  FileError
} from './errors';

export {
  getConfig,
  updateConfig,
  validateConfig
} from './config';

export {
  ERROR_CODES,
  DEFAULT_CONFIG,
  NAMING_PATTERNS
} from './types';
```

## CLI Tool Generation

### CLI Binary Creation

```typescript
// scripts/generate-cli-binaries.ts
import { writeFileSync, chmodSync } from 'fs';
import { join } from 'path';

const CLI_TEMPLATE = (command: string, description: string) => `#!/usr/bin/env node
// Generated CLI binary for ${command}

const { execSync } = require('child_process');
const path = require('path');

// Get the path to the compiled workflow
const workflowPath = path.join(__dirname, '..', 'dist', 'workflows', '${command}.js');

try {
  // Execute the workflow with bun
  execSync(\`bun \${workflowPath} \${process.argv.slice(2).join(' ')}\`, {
    stdio: 'inherit',
    cwd: process.cwd()
  });
} catch (error) {
  process.exit(error.status || 1);
}
`;

const MAIN_CLI_TEMPLATE = `#!/usr/bin/env node
// Main Claude Swarm CLI

const { program } = require('commander');
const path = require('path');
const { execSync } = require('child_process');

program
  .name('claude-swarm')
  .description('AI development workflow automation')
  .version(require('../package.json').version);

program
  .command('work-on-task <issue-number>')
  .description('Start working on a GitHub issue')
  .option('--agent-id <id>', 'Agent identifier for parallel development')
  .option('--force', 'Force recreate worktree if exists')
  .option('--skip-context', 'Skip Claude context setup')
  .action((issueNumber, options) => {
    const workflowPath = path.join(__dirname, '..', 'dist', 'workflows', 'work-on-task.js');
    const args = [issueNumber, ...Object.entries(options).map(([k, v]) => v === true ? \`--\${k}\` : \`--\${k}=\${v}\`)];
    execSync(\`bun \${workflowPath} \${args.join(' ')}\`, { stdio: 'inherit' });
  });

program
  .command('review-task <issue-number>')
  .description('Review implementation of a GitHub issue')
  .option('--auto-decision', 'Enable automatic decision making')
  .action((issueNumber, options) => {
    const workflowPath = path.join(__dirname, '..', 'dist', 'workflows', 'review-task.js');
    const args = [issueNumber, ...Object.entries(options).map(([k, v]) => v === true ? \`--\${k}\` : \`--\${k}=\${v}\`)];
    execSync(\`bun \${workflowPath} \${args.join(' ')}\`, { stdio: 'inherit' });
  });

program
  .command('setup')
  .description('Initialize Claude Swarm in current repository')
  .option('--project-name <name>', 'GitHub project name override')
  .action((options) => {
    const workflowPath = path.join(__dirname, '..', 'dist', 'workflows', 'setup-project.js');
    const args = Object.entries(options).map(([k, v]) => v === true ? \`--\${k}\` : \`--\${k}=\${v}\`);
    execSync(\`bun \${workflowPath} \${args.join(' ')}\`, { stdio: 'inherit' });
  });

program.parse();
`;

// Generate CLI binaries
function generateCliBinaries() {
  const binDir = join(process.cwd(), 'bin');
  
  // Main CLI
  writeFileSync(join(binDir, 'claude-swarm'), MAIN_CLI_TEMPLATE);
  chmodSync(join(binDir, 'claude-swarm'), 0o755);
  
  // Individual workflow CLIs
  const workflows = [
    { name: 'work-on-task', description: 'Start working on a GitHub issue' },
    { name: 'review-task', description: 'Review implementation of a GitHub issue' },
    { name: 'setup-project', description: 'Initialize Claude Swarm in repository' }
  ];
  
  workflows.forEach(({ name, description }) => {
    const content = CLI_TEMPLATE(name, description);
    writeFileSync(join(binDir, name), content);
    chmodSync(join(binDir, name), 0o755);
  });
  
  console.log('✅ CLI binaries generated');
}

if (import.meta.main) {
  generateCliBinaries();
}
```

## Usage Examples and Documentation

### Basic Usage Examples

```typescript
// templates/examples/basic-usage.ts
import { workOnTask, reviewTask, setupProject } from 'claude-swarm';

// Example 1: Basic work on task
async function basicWorkflow() {
  const result = await workOnTask({
    issueNumber: 123,
    mode: 'direct'
  });
  
  console.log(`Worktree created at: ${result.worktree.path}`);
  console.log(`Claude session: ${result.claudeSession.sessionName}`);
}

// Example 2: Parallel agents
async function parallelAgents() {
  const agent1Promise = workOnTask({
    issueNumber: 456,
    agentId: 1
  });
  
  const agent2Promise = workOnTask({
    issueNumber: 456,
    agentId: 2
  });
  
  const [result1, result2] = await Promise.all([agent1Promise, agent2Promise]);
  
  console.log('Both agents working in parallel');
  console.log(`Agent 1: ${result1.worktree.path}`);
  console.log(`Agent 2: ${result2.worktree.path}`);
}

// Example 3: Review workflow
async function reviewWorkflow() {
  const result = await reviewTask({
    issueNumber: 789,
    autoDecision: false
  });
  
  if (result.decision === 'approved') {
    console.log(`PR created: ${result.pullRequest?.url}`);
  } else {
    console.log(`Feedback created: ${result.feedbackFile}`);
  }
}
```

### Custom Workflow Example

```typescript
// templates/examples/custom-workflow.ts
import { 
  detectRepository, 
  createWorktree, 
  launchClaudeInteractive,
  createTmuxSession 
} from 'claude-swarm/core';
import { getConfig } from 'claude-swarm/shared';

// Custom workflow: Create multiple worktrees for feature branch work
async function createFeatureBranches(baseBranch: string, features: string[]) {
  const repo = await detectRepository();
  const config = getConfig();
  
  const worktrees = [];
  
  for (const feature of features) {
    // Create worktree for each feature
    const worktree = await createWorktree({
      name: `feature-${feature}`,
      sourceBranch: baseBranch,
      namingStrategy: config.worktree.namingStrategy
    });
    
    // Create tmux session
    const session = await createTmuxSession({
      name: `feature-${feature}`,
      workingDirectory: worktree.path
    });
    
    // Launch Claude with feature-specific prompt
    await launchClaudeInteractive({
      workingDirectory: worktree.path,
      sessionName: session.name,
      prompt: `Implement feature: ${feature}. 
        
Please:
1. Create necessary files and structure
2. Implement the feature according to requirements
3. Add appropriate tests
4. Update documentation
        
Feature: ${feature}`
    });
    
    worktrees.push({ feature, worktree, session });
  }
  
  return worktrees;
}

// Usage
await createFeatureBranches('main', [
  'user-authentication',
  'email-notifications', 
  'data-export'
]);
```

### Library Integration Example

```typescript
// templates/examples/library-integration.ts
import ClaudeSwarm from 'claude-swarm';

// Example: Integrate Claude Swarm into existing project
class ProjectManager {
  private swarm = ClaudeSwarm;
  
  async startDevelopment(issueNumber: number) {
    // Setup development environment
    const result = await this.swarm.workflows.workOnTask({
      issueNumber,
      mode: 'direct'
    });
    
    // Store environment info for later cleanup
    this.activeEnvironments.set(issueNumber, result);
    
    return result;
  }
  
  async reviewChanges(issueNumber: number) {
    const result = await this.swarm.workflows.reviewTask({
      issueNumber,
      autoDecision: false
    });
    
    // Handle review results
    if (result.decision === 'approved') {
      await this.handleApproval(result);
    } else {
      await this.handleFeedback(result);
    }
    
    return result;
  }
  
  async cleanup(issueNumber: number) {
    const environment = this.activeEnvironments.get(issueNumber);
    if (environment) {
      // Cleanup using core functions
      await this.swarm.core.removeWorktree(environment.worktree.path);
      await this.swarm.core.killSession(environment.session.name);
      this.activeEnvironments.delete(issueNumber);
    }
  }
}
```

## Installation and Setup

### Post-Install Script

```javascript
// src/postinstall.js
const fs = require('fs');
const path = require('path');
const os = require('os');

function postInstall() {
  console.log('🚀 Claude Swarm installed successfully!');
  
  // Check for required dependencies
  const dependencies = [
    { name: 'git', command: 'git --version', required: true },
    { name: 'tmux', command: 'tmux -V', required: true },
    { name: 'claude', command: 'claude --help', required: false }
  ];
  
  console.log('\n📋 Checking dependencies...');
  
  dependencies.forEach(({ name, command, required }) => {
    try {
      require('child_process').execSync(command, { stdio: 'ignore' });
      console.log(`✅ ${name} is available`);
    } catch (error) {
      if (required) {
        console.log(`❌ ${name} is required but not found`);
        console.log(`   Please install ${name} and ensure it's in your PATH`);
      } else {
        console.log(`⚠️  ${name} is recommended but not found`);
        console.log(`   Install ${name} for full functionality`);
      }
    }
  });
  
  // Create user config directory if it doesn't exist
  const userConfigDir = path.join(os.homedir(), '.claude');
  if (!fs.existsSync(userConfigDir)) {
    fs.mkdirSync(userConfigDir, { recursive: true });
    console.log(`\n📁 Created user config directory: ${userConfigDir}`);
  }
  
  // Provide quick start information
  console.log('\n🎯 Quick Start:');
  console.log('   Initialize in repository: npx claude-swarm setup');
  console.log('   Work on issue: npx claude-swarm work-on-task 123');
  console.log('   Review task: npx claude-swarm review-task 123');
  console.log('');
  console.log('📚 Documentation: https://github.com/your-org/claude-swarm#readme');
}

postInstall();
```

### README Template

```markdown
# Claude Swarm

AI development workflow automation with Claude Code integration.

## Installation

```bash
npm install claude-swarm
# or
bun add claude-swarm
# or
yarn add claude-swarm
```

## Quick Start

### CLI Usage

```bash
# Initialize in your repository
npx claude-swarm setup

# Start working on an issue
npx claude-swarm work-on-task 123

# Review completed work
npx claude-swarm review-task 123
```

### Programmatic Usage

```typescript
import { workOnTask, reviewTask } from 'claude-swarm';

// Start development workflow
const result = await workOnTask({
  issueNumber: 123,
  agentId: 1
});

// Review implementation
const review = await reviewTask({
  issueNumber: 123
});
```

## Requirements

- Node.js 18+
- Git 2.5+
- tmux
- Claude CLI (recommended)
- GitHub CLI with project scope (for setup)

## Documentation

- [API Reference](./docs/api.md)
- [Configuration Guide](./docs/configuration.md)
- [Workflow Examples](./docs/examples.md)
- [Troubleshooting](./docs/troubleshooting.md)

## License

MIT
```

## Distribution and Publishing

### Build Pipeline

```bash
# scripts/build.sh
#!/bin/bash
set -e

echo "🔧 Building Claude Swarm..."

# Clean previous builds
rm -rf dist/
rm -rf bin/

# Create directories
mkdir -p bin/

# Build TypeScript
echo "📦 Compiling TypeScript..."
bun run build:ts

# Generate CLI binaries
echo "🛠️  Generating CLI binaries..."
bun run build:cli

# Run tests
echo "🧪 Running tests..."
bun run test

# Validate package
echo "📋 Validating package..."
npm pack --dry-run

echo "✅ Build complete!"
```

### Publishing Workflow

```yaml
# .github/workflows/publish.yml
name: Publish Package

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - uses: oven-sh/setup-bun@v1
      with:
        bun-version: latest
        
    - run: bun install
    
    - name: Build package
      run: bun run build
      
    - name: Run tests
      run: bun run test
      
    - name: Publish to npm
      run: npm publish
      env:
        NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Version Management

```json
// scripts/version.js
{
  "scripts": {
    "version:patch": "npm version patch && git push --tags",
    "version:minor": "npm version minor && git push --tags", 
    "version:major": "npm version major && git push --tags",
    "preversion": "bun run test",
    "postversion": "git push && git push --tags"
  }
}
```

## Library Testing

### Package Testing

```typescript
// tests/integration/package.test.ts
import { execSync } from 'child_process';
import { join } from 'path';

describe('Package Integration', () => {
  const packageDir = join(__dirname, '../../');
  
  it('should install globally without errors', () => {
    expect(() => {
      execSync('npm pack', { cwd: packageDir, stdio: 'pipe' });
    }).not.toThrow();
  });
  
  it('should provide all expected CLI commands', () => {
    const commands = ['claude-swarm', 'work-on-task', 'review-task'];
    
    commands.forEach(command => {
      const binPath = join(packageDir, 'bin', command);
      expect(() => {
        execSync(`node ${binPath} --help`, { stdio: 'pipe' });
      }).not.toThrow();
    });
  });
  
  it('should export all expected library functions', async () => {
    const { workOnTask, reviewTask, setupProject } = await import('../../dist/index.js');
    
    expect(typeof workOnTask).toBe('function');
    expect(typeof reviewTask).toBe('function');
    expect(typeof setupProject).toBe('function');
  });
});
```

This comprehensive library export guide ensures Claude Swarm can be easily packaged, distributed, and consumed as both a CLI tool and programmatic library, with proper TypeScript support and clear usage examples.