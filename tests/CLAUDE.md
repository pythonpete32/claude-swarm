# Testing Patterns and Guidelines

This document provides comprehensive patterns and guidelines for writing tests in this codebase. The test suite uses **Vitest** as the testing framework with various specialized patterns for different types of testing.

## Test Framework Configuration

### Vitest Setup
- **Framework**: Vitest with Node environment
- **Configuration**: `vitest.config.ts` disables worker threads to avoid pool recursion issues
- **Environment**: Node.js environment (not jsdom)
- **Parallelization**: Disabled (`threads: false`) for sandbox compatibility

## Test File Organization and Naming

### File Naming Conventions

#### Unit Tests (`.test.ts`)
- **Pattern**: `{feature-name}.test.ts`
- **Examples**: `file-system-suggestions.test.ts`, `model-utils.test.ts`, `text-buffer.test.ts`
- **Purpose**: Testing individual functions, utilities, and business logic

#### Integration Tests (`.test.ts`)
- **Pattern**: `{system-name}-{interaction}.test.ts`
- **Examples**: `agent-cancel.test.ts`, `responses-chat-completions.test.ts`, `apply-patch.test.ts`
- **Purpose**: Testing interactions between components and external systems

#### UI/Component Tests (`.test.tsx`)
- **Pattern**: `{component-name}.test.tsx` or `{feature-description}.test.tsx`
- **Examples**: `terminal-chat-input-multiline.test.tsx`, `config.test.tsx`, `history-overlay.test.tsx`
- **Purpose**: Testing React components and user interactions

#### Special Test Types
- **Agent Tests**: `agent-{scenario}.test.ts` - Testing agent behavior and lifecycle
- **Multiline Tests**: `multiline-{feature}.test.tsx` - Testing text editor functionality
- **Network Tests**: `{module}-network-error.test.ts` - Testing error handling

### Directory Structure
```
tests/
├── __fixtures__/           # Test data and fixtures
├── __snapshots__/          # Vitest snapshot files
├── ui-test-helpers.tsx     # Shared UI testing utilities
├── *.test.ts              # Unit and integration tests
└── *.test.tsx             # UI/component tests
```

## Test Categories and Patterns

### 1. Unit Tests

#### Basic Structure
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("FunctionName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("describes the behavior being tested", () => {
    // Arrange
    const input = "test data";
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).toBe("expected output");
  });
});
```

#### Property-Based Testing Pattern
```typescript
it("handles multiple input cases", () => {
  const cases: Array<[input, expected]> = [
    [0, "xab"],
    [1, "axb"], 
    [2, "abx"],
  ];

  for (const [input, expected] of cases) {
    const result = functionUnderTest(input);
    expect(result).toBe(expected);
  }
});
```

#### Error Handling Pattern
```typescript
it("handles errors gracefully", () => {
  mockFunction.mockImplementation(() => {
    throw new Error("failed");
  });

  const result = functionUnderTest("some/path");
  expect(result).toEqual([]);
});
```

### 2. Integration Tests

#### Agent Testing Pattern
```typescript
import { describe, it, expect, vi } from "vitest";

// Mock dependencies first
vi.mock("openai", () => ({
  default: FakeOpenAI,
  APIConnectionTimeoutError: class extends Error {}
}));

vi.mock("../src/approvals.js", () => ({
  alwaysApprovedCommands: new Set(),
  canAutoApprove: () => ({ type: "auto-approve" }),
}));

describe("Agent functionality", () => {
  it("handles cancellation correctly", async () => {
    const received: Array<any> = [];
    
    const agent = new AgentLoop({
      model: "any",
      onItem: (item) => received.push(item),
      // ... other config
    });

    agent.run(userMessage);
    await new Promise(r => setTimeout(r, 10));
    agent.cancel();
    
    expect(received.some(i => i.type === "function_call_output")).toBe(false);
  });
});
```

#### Fake Timer Pattern
```typescript
describe("timing-sensitive functionality", () => {
  vi.useFakeTimers();

  it("handles delays correctly", async () => {
    const promise = functionWithDelay();
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;
    expect(result).toBe("expected");
  });
});
```

#### Streaming Response Pattern
```typescript
async function* fakeStream() {
  yield { type: "response.created", response: { id: "123" } };
  yield { type: "response.output_text.delta", delta: "Hello" };
  yield { type: "response.completed", response: { status: "completed" } };
}

it("handles streaming responses", async () => {
  const events: Array<ResponseEvent> = [];
  for await (const event of streamGenerator) {
    events.push(event);
  }
  
  expect(events).toHaveLength(3);
  expect(events[0]?.type).toBe("response.created");
});
```

### 3. UI/Component Tests

#### Basic Component Testing
```typescript
import React from "react";
import { renderTui } from "./ui-test-helpers.js";
import { describe, it, expect, vi } from "vitest";

describe("ComponentName", () => {
  it("renders initial content correctly", async () => {
    const { lastFrameStripped, cleanup } = renderTui(
      <ComponentName prop="value" />
    );

    const frame = lastFrameStripped();
    expect(frame).toContain("expected text");
    
    cleanup();
  });
});
```

#### Interactive Testing Pattern
```typescript
async function type(
  stdin: NodeJS.WritableStream,
  text: string,
  flush: () => Promise<void>
) {
  stdin.write(text);
  await flush();
}

it("handles user input", async () => {
  const submitInput = vi.fn();
  const { stdin, lastFrameStripped, flush, cleanup } = renderTui(
    <TerminalChatInput submitInput={submitInput} {...props} />
  );

  await type(stdin, "hello", flush);
  await type(stdin, "\r", flush); // Enter key

  expect(submitInput).toHaveBeenCalledTimes(1);
  cleanup();
});
```

#### Keyboard Input Patterns
```typescript
// Enter key
await type(stdin, "\r", flush);

// Escape key  
await type(stdin, "\x1b", flush);

// Backspace (DEL)
await type(stdin, "\x7f", flush);

// Shift+Enter (CSI-u format)
await type(stdin, "\u001B[13;2u", flush);

// Shift+Enter (modifyOtherKeys=1 format)
await type(stdin, "\u001B[27;2;13~", flush);

// Arrow keys
await type(stdin, "\x1b[D", flush); // Left arrow
```

## Testing Utilities and Helpers

### Core UI Testing Utility

#### `renderTui()` Function
```typescript
// Location: tests/ui-test-helpers.tsx
export function renderTui(ui: React.ReactElement) {
  const utils = render(ui);
  
  return {
    ...utils,
    lastFrameStripped: () => stripAnsi(utils.lastFrame() || ""),
    flush: async () => new Promise<void>(resolve => setTimeout(resolve, 0))
  };
}
```

**Usage Pattern:**
```typescript
const { stdin, lastFrameStripped, flush, cleanup } = renderTui(<Component />);
// Test interactions
cleanup(); // Always cleanup at end
```

### Common Test Helpers

#### In-Memory File System
```typescript
function createInMemoryFS(initialFiles: Record<string, string>) {
  const files = { ...initialFiles };
  const writes: Record<string, string> = {};
  const removals: Array<string> = [];

  return {
    openFn: (path: string) => files[path] || throw new Error("File not found"),
    writeFn: (path: string, content: string) => { files[path] = content; },
    removeFn: (path: string) => { delete files[path]; },
    writes,
    removals,
    files
  };
}
```

#### Mock Creation Patterns
```typescript
// Input utilities mock
vi.mock("../src/utils/input-utils.js", () => ({
  createInputItem: vi.fn(async (text: string) => ({
    role: "user",
    type: "message", 
    content: [{ type: "input_text", text }],
  })),
}));

// File system mock
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));
```

## Mocking Patterns and Strategies

### 1. Module Mocking

#### OpenAI SDK Mock
```typescript
vi.mock("openai", () => {
  class FakeOpenAI {
    public responses = {
      create: async () => new FakeStream()
    };
  }
  return { __esModule: true, default: FakeOpenAI };
});
```

#### File System Mock with State
```typescript
let memfs: Record<string, string> = {};

vi.mock("fs", async () => {
  const real = await vi.importActual("fs");
  return {
    ...real,
    existsSync: (path: string) => memfs[path] !== undefined,
    readFileSync: (path: string) => memfs[path] || throw new Error("ENOENT"),
    writeFileSync: (path: string, data: string) => { memfs[path] = data; }
  };
});
```

### 2. Function Mocking

#### Spy with Implementation
```typescript
vi.spyOn(handleExec, "handleExecCommand").mockImplementation(async () => {
  await new Promise(r => setTimeout(r, 50));
  return { outputText: "hello", metadata: {} };
});
```

#### Mock with State Tracking
```typescript
const openAiState = {
  createSpy: undefined,
  createStreamSpy: undefined  
};

vi.mock("openai", () => ({
  default: class {
    public chat = {
      completions: {
        create: (...args) => args[0]?.stream 
          ? openAiState.createStreamSpy(...args)
          : openAiState.createSpy(...args)
      }
    };
  }
}));
```

### 3. Async Iterator Mocking

```typescript
class FakeStream {
  async *[Symbol.asyncIterator]() {
    yield { type: "response.created", response: { id: "123" } };
    yield { type: "response.output_text.delta", delta: "Hello" };
    yield { type: "response.completed", response: { status: "completed" } };
  }
}
```

## Specialized Testing Patterns

### 1. Snapshot Testing

```typescript
import { test, expect } from "vitest";

test("renders correct UI output", () => {
  const { lastFrame } = renderTui(<UpdateNotification />);
  expect(lastFrame()).toMatchSnapshot();
});
```

**Snapshot files**: Located in `tests/__snapshots__/`

### 2. Regression Testing with `.fails()`

```typescript
// Mark tests that expose known bugs
it.fails("reports correct per-task thinking time", async () => {
  // Test that will pass when bug is fixed
  // Vitest will error when this starts passing, reminding to remove .fails()
});
```

### 3. Unicode and Character Handling

```typescript
it("handles multi-code-unit emoji correctly", () => {
  const buf = new TextBuffer("🐶a");
  buf.move("right");
  buf.insert("x");
  
  expect(buf.getLines()).toEqual(["🐶xa"]);
  expect(buf.getCursor()).toEqual([0, 2]);
});
```

### 4. Configuration Testing Pattern

```typescript
beforeEach(() => {
  memfs = {}; // Reset in-memory filesystem
  testDir = tmpdir();
  testConfigPath = join(testDir, "config.json");
});

test("loads and saves config correctly", () => {
  const testConfig = { model: "test-model" };
  saveConfig(testConfig, testConfigPath, testInstructionsPath);
  
  const loadedConfig = loadConfig(testConfigPath, testInstructionsPath);
  expect(loadedConfig.model).toBe(testConfig.model);
});
```

## Error Handling and Edge Cases

### 1. Network Error Testing

```typescript
vi.mock("openai", () => ({
  default: class {
    responses = {
      create: () => Promise.reject(new Error("Network error"))
    };
  }
}));
```

### 2. Timeout and Cancellation

```typescript
it("handles cancellation during execution", async () => {
  const agent = new AgentLoop(config);
  agent.run(userMessage);
  
  // Cancel while running
  setTimeout(() => agent.cancel(), 10);
  
  await new Promise(r => setTimeout(r, 100));
  expect(hasBeenCancelled).toBe(true);
});
```

### 3. Type Guard Testing

```typescript
function isFunctionCall(content: any): content is ResponseFunctionToolCall {
  return content?.type === "function_call";
}

it("identifies function calls correctly", () => {
  const content = { type: "function_call", name: "test" };
  expect(isFunctionCall(content)).toBe(true);
});
```

## Best Practices

### 1. Test Structure
- **Arrange, Act, Assert**: Clear separation of test phases
- **Descriptive names**: Test names should describe the behavior being tested
- **Single responsibility**: Each test should verify one specific behavior

### 2. Mock Management
- **Mock early**: Set up mocks before importing modules under test
- **Clean up**: Use `vi.clearAllMocks()` in `beforeEach`
- **Reset modules**: Use `vi.resetModules()` when needed for isolation

### 3. Async Testing
- **Proper awaiting**: Always await async operations
- **Timeout handling**: Use fake timers for time-sensitive tests
- **Cleanup**: Always call `cleanup()` for UI tests

### 4. Error Testing
- **Expected errors**: Test both success and failure paths
- **Error boundaries**: Use `expect().toThrow()` for error testing
- **Custom errors**: Test specific error types and messages

### 5. UI Testing Specific
- **Frame checking**: Use `lastFrameStripped()` for ANSI-free assertions
- **Input simulation**: Use helper functions for consistent input simulation
- **State verification**: Check both visual output and internal state

## Running Tests

### Commands
```bash
# Run all tests
pnpm test

# Run tests in watch mode  
pnpm test:watch

# Run specific test file
vitest run path/to/test.ts

# Run tests with UI
vitest --ui
```

### Common Issues
1. **Pool recursion**: Solved by `threads: false` in config
2. **ANSI codes**: Use `lastFrameStripped()` instead of `lastFrame()`
3. **Async timing**: Use `flush()` helper after input simulation
4. **Module isolation**: Use `vi.resetModules()` when tests interfere

## Writing New Tests

### 1. Choose the Right Pattern
- **Pure functions**: Unit test pattern
- **Components**: UI test pattern with `renderTui()`
- **System integration**: Integration test with mocks
- **Agent behavior**: Agent test pattern with fake streams

### 2. Follow Naming Conventions
- Unit tests: `{module-name}.test.ts`
- Component tests: `{component-name}.test.tsx`  
- Integration tests: `{system}-{interaction}.test.ts`

### 3. Set Up Proper Mocks
- Mock external dependencies
- Use in-memory implementations for file system
- Create fake streams for async iterators

### 4. Include Edge Cases
- Empty inputs
- Error conditions
- Boundary values
- Unicode/special characters

This documentation should serve as a comprehensive guide for understanding and extending the test suite. Focus on patterns rather than specific implementation details, as the codebase will evolve but these patterns provide a solid foundation for maintainable tests.