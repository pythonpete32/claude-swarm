# Terminal UI Component Development Guide

> **Comprehensive Guide for Building Terminal Applications with Ink and React**
> 
> This guide documents patterns, best practices, and implementation strategies for building sophisticated terminal user interfaces using Ink (React for CLI). All examples are based on production patterns from the Claude Swarm codebase.

---

## Table of Contents

1. [Core Architecture Patterns](#1-core-architecture-patterns)
2. [Terminal-Specific UI Components](#2-terminal-specific-ui-components)
3. [Advanced Text Editing](#3-advanced-text-editing)
4. [Input Handling & Keyboard Shortcuts](#4-input-handling--keyboard-shortcuts)
5. [Layout & Styling Systems](#5-layout--styling-systems)
6. [State Management Patterns](#6-state-management-patterns)
7. [Modal & Overlay Systems](#7-modal--overlay-systems)
8. [Performance & Terminal Optimization](#8-performance--terminal-optimization)
9. [Testing Terminal Components](#9-testing-terminal-components)
10. [Common Patterns & Examples](#10-common-patterns--examples)

---

## 1. Core Architecture Patterns

### 1.1 Three-Layer Architecture

Terminal applications in Ink typically follow a three-layer pattern:

```
CLI Layer → App Layer → Terminal UI Layer
```

**CLI Layer (`cli.tsx`)**
- Handles Node.js setup and validation
- Manages terminal state and cleanup
- Provides entry point and argument parsing

```tsx
// CLI Layer Pattern
import { render } from 'ink';
import App from './app.js';
import { setInkRenderer, onExit } from './utils/terminal.js';

const instance = render(<App />);
setInkRenderer(instance);

// Essential: Terminal cleanup on exit
process.on('exit', onExit);
process.on('SIGINT', onExit);
process.on('SIGTERM', onExit);
```

**App Layer (`app.tsx`)**
- Core application logic and state
- Message/data management
- Environment validation (git repos, etc.)

```tsx
// App Layer Pattern
const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('none');
  
  const handleSendMessage = useCallback((content: string) => {
    // Core business logic
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      content,
      role: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  return (
    <TerminalChat
      messages={messages}
      onSendMessage={handleSendMessage}
      overlayMode={overlayMode}
      setOverlayMode={setOverlayMode}
    />
  );
};
```

**Terminal UI Layer**
- Pure presentation components
- Keyboard handling and terminal interactions
- Layout and styling management

### 1.2 Component Composition Pattern

Terminal UIs benefit from strict component separation:

```tsx
// Main container pattern
const TerminalChat: React.FC<Props> = ({ messages, overlayMode }) => {
  const terminalSize = useTerminalSize();
  
  return (
    <Box flexDirection="column" height={terminalSize.rows}>
      {/* Fixed header */}
      <TerminalHeader />
      
      {/* Flexible message area */}
      <Box flexGrow={1}>
        <TerminalMessageHistory messages={messages} />
      </Box>
      
      {/* Fixed input */}
      <TerminalChatInput onSendMessage={handleSendMessage} />
      
      {/* Conditional overlays */}
      {overlayMode === 'help' && (
        <HelpOverlay onClose={() => setOverlayMode('none')} />
      )}
    </Box>
  );
};
```

---

## 2. Terminal-Specific UI Components

### 2.1 Responsive Terminal Layout

Terminal applications must adapt to changing window sizes:

```tsx
// Responsive terminal size hook
export function useTerminalSize(): { columns: number; rows: number } {
  const [size, setSize] = useState({
    columns: (process.stdout.columns || 60) - 8, // Padding
    rows: process.stdout.rows || 20,
  });

  useEffect(() => {
    function updateSize() {
      setSize({
        columns: (process.stdout.columns || 60) - 8,
        rows: process.stdout.rows || 20,
      });
    }

    process.stdout.on("resize", updateSize);
    return () => process.stdout.off("resize", updateSize);
  }, []);

  return size;
}

// Responsive component usage
const MessageHistory: React.FC = () => {
  const { columns, rows } = useTerminalSize();
  
  return (
    <Box 
      width={Math.min(80, columns - 4)} // Max width with fallback
      height={rows - 5} // Account for header/input
    >
      {/* Content that adapts to terminal size */}
    </Box>
  );
};
```

### 2.2 Terminal-Optimized Header Component

Headers in terminal UIs serve as status bars:

```tsx
const TerminalHeader: React.FC = () => {
  const terminalSize = useTerminalSize();
  const currentDir = path.basename(process.cwd());
  
  return (
    <Box 
      flexDirection="row" 
      justifyContent="space-between"
      borderStyle="single"
      borderColor="cyan"
      paddingX={1}
    >
      {/* Left: App info */}
      <Box flexDirection="row" columnGap={1}>
        <Text bold color="cyan">💬 Claude Swarm</Text>
        <Text color="gray">v{version}</Text>
      </Box>
      
      {/* Center: Dynamic info */}
      <Box flexDirection="row" columnGap={2}>
        <Text color="yellow">📁 {currentDir}</Text>
        <Text color="green">🤖 gpt-4</Text>
      </Box>
      
      {/* Right: Status indicators */}
      <Box flexDirection="row">
        <Text color="cyan">✓ Ready</Text>
      </Box>
    </Box>
  );
};
```

### 2.3 Message Display with Role-Based Styling

Terminal chat interfaces need clear visual hierarchy:

```tsx
const TerminalMessageHistory: React.FC<{ messages: ChatMessage[] }> = ({ 
  messages 
}) => {
  const terminalSize = useTerminalSize();
  
  return (
    <Box flexDirection="column" paddingX={1}>
      {messages.length === 0 ? (
        <Box flexDirection="column" alignItems="center" paddingY={2}>
          <Text dimColor>No messages yet. Type something to get started!</Text>
          <Text dimColor>Use /help to see available commands.</Text>
        </Box>
      ) : (
        messages.map(message => (
          <Box key={message.id} flexDirection="column" marginBottom={1}>
            {/* Message header with role and timestamp */}
            <Box flexDirection="row" justifyContent="space-between">
              <Text 
                bold 
                color={message.role === 'user' ? 'green' : 'cyan'}
              >
                {message.role === 'user' ? '👤 You' : '🤖 Assistant'}
              </Text>
              <Text dimColor>
                {message.timestamp.toLocaleTimeString()}
              </Text>
            </Box>
            
            {/* Message content with word wrapping */}
            <Box paddingLeft={2}>
              <Text>
                {message.content}
              </Text>
            </Box>
          </Box>
        ))
      )}
    </Box>
  );
};
```

---

## 3. Advanced Text Editing

### 3.1 Unicode-Aware Text Buffer

Terminal text editing requires careful handling of Unicode characters:

```tsx
// Unicode-safe string operations
function toCodePoints(str: string): Array<string> {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter();
    return [...seg.segment(str)].map((seg) => seg.segment);
  }
  return Array.from(str); // Handles surrogate pairs correctly
}

function cpLen(str: string): number {
  return toCodePoints(str).length;
}

function cpSlice(str: string, start: number, end?: number): string {
  const arr = toCodePoints(str).slice(start, end);
  return arr.join("");
}

// Text buffer class with proper Unicode handling
export default class TextBuffer {
  private lines: Array<string>;
  private cursorRow = 0;
  private cursorCol = 0;
  private scrollRow = 0;
  private scrollCol = 0;
  
  insert(ch: string): void {
    const line = this.line(this.cursorRow);
    this.lines[this.cursorRow] = 
      cpSlice(line, 0, this.cursorCol) + 
      ch + 
      cpSlice(line, this.cursorCol);
    this.cursorCol += cpLen(ch); // Unicode-aware length
  }
  
  // More text buffer methods...
}
```

### 3.2 Advanced Multiline Text Editor

A production-grade terminal text editor component:

```tsx
interface MultilineTextEditorProps {
  initialText?: string;
  width?: number;
  height?: number;
  onSubmit?: (text: string) => void;
  focus?: boolean;
  onChange?: (text: string) => void;
  initialCursorOffset?: number;
}

const MultilineTextEditor = React.forwardRef<
  MultilineTextEditorHandle,
  MultilineTextEditorProps
>(({
  initialText = "",
  width,
  height = 10,
  onSubmit,
  focus = true,
  onChange,
  initialCursorOffset,
}, ref) => {
  const buffer = useRef(new TextBuffer(initialText, initialCursorOffset));
  const [version, setVersion] = useState(0);
  const terminalSize = useTerminalSize();
  
  const effectiveWidth = Math.max(20, width ?? terminalSize.columns);
  
  // Advanced keyboard handling
  useInput((input, key) => {
    if (!focus) return;
    
    // Handle CSI-u / modifyOtherKeys sequences
    if (input.startsWith("[") && input.endsWith("u")) {
      const m = input.match(/^\[([0-9]+);([0-9]+)u$/);
      if (m && m[1] === "13") { // Enter key
        const mod = Number(m[2]);
        const hasCtrl = Math.floor(mod / 4) % 2 === 1;
        
        if (hasCtrl) {
          onSubmit?.(buffer.current.getText());
        } else {
          buffer.current.newline();
        }
        setVersion(v => v + 1);
        return;
      }
    }
    
    // Standard key handling
    if (input === "\r") {
      onSubmit?.(buffer.current.getText());
    } else if (input === "\n") {
      buffer.current.newline();
      setVersion(v => v + 1);
    } else {
      const modified = buffer.current.handleInput(
        input,
        key as Record<string, boolean>,
        { height, width: effectiveWidth }
      );
      if (modified) {
        setVersion(v => v + 1);
        onChange?.(buffer.current.getText());
      }
    }
  }, { isActive: focus });
  
  // Block cursor rendering
  const visibleLines = buffer.current.getVisibleLines({
    height,
    width: effectiveWidth,
  });
  
  const [cursorRow, cursorCol] = buffer.current.getCursor();
  const scrollRow = buffer.current.scrollRow;
  const scrollCol = buffer.current.scrollCol;
  
  return (
    <Box flexDirection="column" key={version}>
      {visibleLines.map((lineText, idx) => {
        const absoluteRow = scrollRow + idx;
        let display = lineText.slice(scrollCol, scrollCol + effectiveWidth);
        display = display.padEnd(effectiveWidth, " ");
        
        // Render block cursor
        if (absoluteRow === cursorRow) {
          const relativeCol = cursorCol - scrollCol;
          const highlightCol = relativeCol;
          
          if (highlightCol >= 0 && highlightCol < effectiveWidth) {
            const charToHighlight = display[highlightCol] || " ";
            const highlighted = chalk.inverse(charToHighlight);
            display = 
              display.slice(0, highlightCol) +
              highlighted +
              display.slice(highlightCol + 1);
          }
        }
        
        return <Text key={idx}>{display}</Text>;
      })}
    </Box>
  );
});
```

### 3.3 Terminal Input Component

A complete input component that integrates advanced text editing:

```tsx
const TerminalChatInput: React.FC<{
  onSendMessage: (message: string) => void;
  terminalColumns: number;
}> = ({ onSendMessage, terminalColumns }) => {
  const [inputText, setInputText] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const editorRef = useRef<MultilineTextEditorHandle>(null);
  
  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (trimmed) {
      onSendMessage(trimmed);
      setInputText("");
      setEditorKey(prev => prev + 1); // Force remount
    }
  }, [inputText, onSendMessage]);
  
  // Global keyboard shortcuts
  useInput((input, key) => {
    if (isComposing) return;
    
    if (key.ctrl && input === "c") {
      process.exit(0);
    }
    
    if (key.return && !key.shift) {
      handleSend();
    }
  });
  
  return (
    <Box flexDirection="column">
      <Box 
        borderStyle="round" 
        borderColor="gray" 
        paddingX={1}
        minHeight={3}
      >
        <Box flexDirection="row" alignItems="flex-start">
          <Text color="gray">› </Text>
          <Box flexGrow={1}>
            <MultilineTextEditor
              key={editorKey}
              ref={editorRef}
              initialText={inputText}
              onChange={setInputText}
              onSubmit={handleSend}
              width={terminalColumns - 6}
            />
          </Box>
        </Box>
      </Box>
      
      <Box paddingX={1}>
        <Text dimColor>
          Enter to send • Shift+Enter for new line • /help for commands
        </Text>
      </Box>
    </Box>
  );
};
```

---

## 4. Input Handling & Keyboard Shortcuts

### 4.1 Multi-Level Input Handling

Terminal applications need layered input handling:

```tsx
// Level 1: Global application shortcuts
const App: React.FC = () => {
  useInput((input, key) => {
    // Global shortcuts that work everywhere
    if (key.ctrl && input === "c") {
      process.exit(0);
    }
    
    if (key.escape) {
      setOverlayMode('none'); // Close any open overlays
    }
  });
  
  return <TerminalChat />;
};

// Level 2: Component-specific shortcuts
const TerminalChat: React.FC = () => {
  useInput((input, key) => {
    // Only handle when no overlay is open
    if (overlayMode !== 'none') return;
    
    if (input === "/") {
      setShowCommandSuggestions(true);
    }
  });
  
  return (/* components */);
};

// Level 3: Widget-specific shortcuts
const HelpOverlay: React.FC = ({ onClose }) => {
  useInput((input, key) => {
    if (key.escape || input === "q") {
      onClose();
    }
  });
  
  return (/* overlay content */);
};
```

### 4.2 Advanced Keyboard Sequence Handling

Handle complex terminal key sequences:

```tsx
const handleAdvancedInput = (input: string, key: Record<string, boolean>) => {
  // CSI-u sequences (modern terminals)
  if (input.startsWith("[") && input.endsWith("u")) {
    const match = input.match(/^\[([0-9]+);([0-9]+)u$/);
    if (match) {
      const keyCode = Number(match[1]);
      const modifiers = Number(match[2]);
      
      const hasShift = Math.floor(modifiers / 2) % 2 === 1;
      const hasCtrl = Math.floor(modifiers / 4) % 2 === 1;
      const hasAlt = Math.floor(modifiers / 8) % 2 === 1;
      
      if (keyCode === 13) { // Enter
        if (hasCtrl) {
          onSubmit();
        } else if (hasShift) {
          insertNewline();
        } else {
          onSubmit();
        }
        return true;
      }
    }
  }
  
  // Legacy CSI sequences
  if (input.startsWith("[27;") && input.endsWith("~")) {
    const match = input.match(/^\[27;([0-9]+);13~$/);
    if (match) {
      const modifiers = Number(match[1]);
      const hasCtrl = Math.floor(modifiers / 4) % 2 === 1;
      
      if (hasCtrl) {
        onSubmit();
      } else {
        insertNewline();
      }
      return true;
    }
  }
  
  // Traditional shortcuts
  if (key.meta && (input === "b" || input === "B")) {
    moveWordLeft();
    return true;
  }
  
  if (key.meta && (input === "f" || input === "F")) {
    moveWordRight();
    return true;
  }
  
  return false;
};
```

### 4.3 Composition Event Handling

Support international input methods:

```tsx
const InternationalTextInput: React.FC = () => {
  const [isComposing, setIsComposing] = useState(false);
  const [compositionText, setCompositionText] = useState("");
  
  useInput((input, key) => {
    // Don't process shortcuts during composition
    if (isComposing) return;
    
    // Handle composition events
    if (input.startsWith("\x1b[200~")) { // Start composition
      setIsComposing(true);
      setCompositionText("");
      return;
    }
    
    if (input.endsWith("\x1b[201~")) { // End composition
      const text = input.slice(0, -6); // Remove end marker
      setIsComposing(false);
      insertText(compositionText + text);
      setCompositionText("");
      return;
    }
    
    if (isComposing) {
      setCompositionText(prev => prev + input);
      return;
    }
    
    // Normal input processing
    processInput(input, key);
  });
  
  return (
    <Box>
      <Text>{isComposing ? compositionText : normalText}</Text>
    </Box>
  );
};
```

---

## 5. Layout & Styling Systems

### 5.1 Responsive Flexbox Layouts

Terminal UIs use Ink's flexbox for responsive layouts:

```tsx
// Main application layout
const AppLayout: React.FC = () => {
  const terminalSize = useTerminalSize();
  
  return (
    <Box 
      flexDirection="column" 
      height={terminalSize.rows}
      width={terminalSize.columns}
    >
      {/* Fixed header */}
      <Box flexShrink={0}>
        <Header />
      </Box>
      
      {/* Flexible content area */}
      <Box flexGrow={1} flexShrink={1} overflow="hidden">
        <MainContent />
      </Box>
      
      {/* Fixed footer */}
      <Box flexShrink={0}>
        <Footer />
      </Box>
    </Box>
  );
};

// Responsive grid layouts
const ResponsiveGrid: React.FC = () => {
  const { columns } = useTerminalSize();
  const itemsPerRow = Math.floor(columns / 20); // 20 chars per item
  
  return (
    <Box flexDirection="column">
      {chunks(items, itemsPerRow).map((row, rowIdx) => (
        <Box key={rowIdx} flexDirection="row">
          {row.map((item, colIdx) => (
            <Box key={colIdx} width={20} marginRight={1}>
              <GridItem item={item} />
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
};
```

### 5.2 Color System for Terminal UI

Consistent color theming for terminal applications:

```tsx
// Color theme system
const colors = {
  primary: 'cyan',
  secondary: 'yellow', 
  success: 'green',
  warning: 'yellow',
  error: 'red',
  muted: 'gray',
  text: 'white',
  background: 'black',
} as const;

// Role-based coloring
const RoleText: React.FC<{ role: 'user' | 'assistant' | 'system' }> = ({ 
  role, 
  children 
}) => {
  const colorMap = {
    user: colors.success,
    assistant: colors.primary,
    system: colors.warning,
  };
  
  return <Text color={colorMap[role]}>{children}</Text>;
};

// Status indicators
const StatusIndicator: React.FC<{ status: 'online' | 'offline' | 'loading' }> = ({ 
  status 
}) => {
  const config = {
    online: { color: colors.success, icon: '●', text: 'Online' },
    offline: { color: colors.error, icon: '●', text: 'Offline' },
    loading: { color: colors.warning, icon: '◐', text: 'Loading' },
  };
  
  const { color, icon, text } = config[status];
  
  return (
    <Text color={color}>
      {icon} {text}
    </Text>
  );
};
```

### 5.3 Border and Spacing System

Consistent visual hierarchy with borders and spacing:

```tsx
// Border style system
const BorderBox: React.FC<{
  variant?: 'primary' | 'secondary' | 'muted';
  children: React.ReactNode;
}> = ({ variant = 'primary', children }) => {
  const borderConfig = {
    primary: { style: 'round', color: 'cyan' },
    secondary: { style: 'single', color: 'yellow' },
    muted: { style: 'single', color: 'gray' },
  } as const;
  
  const { style, color } = borderConfig[variant];
  
  return (
    <Box 
      borderStyle={style}
      borderColor={color}
      paddingX={1}
      paddingY={1}
    >
      {children}
    </Box>
  );
};

// Spacing utilities
const Spacer: React.FC<{ size?: number }> = ({ size = 1 }) => (
  <Box height={size} />
);

const Divider: React.FC<{ character?: string }> = ({ character = "─" }) => {
  const { columns } = useTerminalSize();
  return <Text color="gray">{character.repeat(columns - 4)}</Text>;
};

// Card component
const Card: React.FC<{
  title?: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <BorderBox variant="primary">
    {title && (
      <>
        <Text bold color="cyan">{title}</Text>
        <Spacer />
      </>
    )}
    {children}
  </BorderBox>
);
```

---

## 6. State Management Patterns

### 6.1 Message State Management

Efficient state management for chat applications:

```tsx
// Message state with optimistic updates
const useMessageState = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingMessages, setPendingMessages] = useState<Set<string>>(new Set());
  
  const addMessage = useCallback((content: string) => {
    const id = crypto.randomUUID();
    const message: ChatMessage = {
      id,
      content,
      role: 'user',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, message]);
    return id;
  }, []);
  
  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(msg => 
      msg.id === id ? { ...msg, ...updates } : msg
    ));
  }, []);
  
  const removeMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);
  
  const markPending = useCallback((id: string) => {
    setPendingMessages(prev => new Set(prev).add(id));
  }, []);
  
  const markComplete = useCallback((id: string) => {
    setPendingMessages(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);
  
  return {
    messages,
    pendingMessages,
    addMessage,
    updateMessage,
    removeMessage,
    markPending,
    markComplete,
  };
};
```

### 6.2 Overlay State Management

Modal/overlay state management pattern:

```tsx
// Overlay mode enum
type OverlayMode = 
  | 'none'
  | 'help'
  | 'history'
  | 'settings'
  | 'search';

// Overlay stack management
const useOverlayState = () => {
  const [overlayStack, setOverlayStack] = useState<OverlayMode[]>(['none']);
  
  const currentOverlay = overlayStack[overlayStack.length - 1];
  
  const pushOverlay = useCallback((mode: OverlayMode) => {
    setOverlayStack(prev => [...prev, mode]);
  }, []);
  
  const popOverlay = useCallback(() => {
    setOverlayStack(prev => 
      prev.length > 1 ? prev.slice(0, -1) : ['none']
    );
  }, []);
  
  const replaceOverlay = useCallback((mode: OverlayMode) => {
    setOverlayStack(prev => [...prev.slice(0, -1), mode]);
  }, []);
  
  const clearOverlays = useCallback(() => {
    setOverlayStack(['none']);
  }, []);
  
  return {
    currentOverlay,
    overlayStack,
    pushOverlay,
    popOverlay,
    replaceOverlay,
    clearOverlays,
  };
};

// Context provider pattern
const OverlayContext = createContext<{
  currentOverlay: OverlayMode;
  pushOverlay: (mode: OverlayMode) => void;
  popOverlay: () => void;
} | null>(null);

const OverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const overlayState = useOverlayState();
  
  return (
    <OverlayContext.Provider value={overlayState}>
      {children}
    </OverlayContext.Provider>
  );
};

const useOverlay = () => {
  const context = useContext(OverlayContext);
  if (!context) {
    throw new Error('useOverlay must be used within OverlayProvider');
  }
  return context;
};
```

### 6.3 Terminal State Management

Manage terminal-specific state and cleanup:

```tsx
// Terminal state hook
const useTerminalState = () => {
  const [isRawMode, setIsRawMode] = useState(false);
  const [isAlternateScreen, setIsAlternateScreen] = useState(false);
  const rendererRef = useRef<Instance | null>(null);
  
  const setRenderer = useCallback((renderer: Instance) => {
    rendererRef.current = renderer;
    setInkRenderer(renderer);
  }, []);
  
  const enableRawMode = useCallback(() => {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      setIsRawMode(true);
    }
  }, []);
  
  const disableRawMode = useCallback(() => {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      setIsRawMode(false);
    }
  }, []);
  
  const clearScreen = useCallback(() => {
    if (rendererRef.current) {
      rendererRef.current.clear();
    }
    process.stdout.write("\x1b[3J\x1b[H\x1b[2J");
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disableRawMode();
      onExit();
    };
  }, [disableRawMode]);
  
  return {
    isRawMode,
    isAlternateScreen,
    setRenderer,
    enableRawMode,
    disableRawMode,
    clearScreen,
  };
};
```

---

## 7. Modal & Overlay Systems

### 7.1 Base Overlay Component

A reusable overlay foundation:

```tsx
interface BaseOverlayProps {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
  maxHeight?: number;
}

const BaseOverlay: React.FC<BaseOverlayProps> = ({
  title,
  onClose,
  children,
  maxWidth = 80,
  maxHeight,
}) => {
  const terminalSize = useTerminalSize();
  
  // Handle escape key
  useInput((input, key) => {
    if (key.escape || input === "q") {
      onClose();
    }
  });
  
  const overlayWidth = Math.min(maxWidth, terminalSize.columns - 4);
  const overlayHeight = maxHeight 
    ? Math.min(maxHeight, terminalSize.rows - 4)
    : undefined;
  
  return (
    <Box
      position="absolute"
      top={2}
      left={Math.floor((terminalSize.columns - overlayWidth) / 2)}
      width={overlayWidth}
      height={overlayHeight}
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
      backgroundColor="black"
    >
      {/* Header */}
      {title && (
        <Box justifyContent="center" marginBottom={1}>
          <Text bold color="cyan">{title}</Text>
        </Box>
      )}
      
      {/* Content */}
      <Box flexDirection="column" flexGrow={1}>
        {children}
      </Box>
      
      {/* Footer */}
      <Box justifyContent="center" marginTop={1}>
        <Text dimColor>Press <Text bold>Esc</Text> or <Text bold>Q</Text> to close</Text>
      </Box>
    </Box>
  );
};
```

### 7.2 Help Overlay Pattern

Documentation and help overlays:

```tsx
const HelpOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <BaseOverlay title="💬 Help & Commands" onClose={onClose}>
    <Box flexDirection="column" gap={1}>
      {/* Commands section */}
      <Box flexDirection="column">
        <Text bold color="yellow">Slash Commands</Text>
        <HelpItem command="/help" description="Show this help overlay" />
        <HelpItem command="/clear" description="Clear the terminal screen" />
        <HelpItem command="/history" description="Show message history" />
        <HelpItem command="/settings" description="Open settings panel" />
      </Box>
      
      {/* Shortcuts section */}
      <Box flexDirection="column">
        <Text bold color="yellow">Keyboard Shortcuts</Text>
        <HelpItem shortcut="Enter" description="Send message" />
        <HelpItem shortcut="Shift+Enter" description="Insert newline" />
        <HelpItem shortcut="Ctrl+C" description="Quit application" />
        <HelpItem shortcut="Ctrl+L" description="Clear screen" />
      </Box>
      
      {/* Features section */}
      <Box flexDirection="column">
        <Text bold color="yellow">Features</Text>
        <Text>• Multi-line message support</Text>
        <Text>• Message history with timestamps</Text>
        <Text>• Unicode and emoji support</Text>
        <Text>• Responsive terminal layout</Text>
      </Box>
    </Box>
  </BaseOverlay>
);

const HelpItem: React.FC<{
  command?: string;
  shortcut?: string;
  description: string;
}> = ({ command, shortcut, description }) => (
  <Box flexDirection="row">
    <Box width={20}>
      <Text color="cyan">
        {command ? command : `${shortcut}`}
      </Text>
    </Box>
    <Text>{description}</Text>
  </Box>
);
```

### 7.3 Selection Overlay

Interactive selection overlays with keyboard navigation:

```tsx
interface SelectionOverlayProps<T> {
  title: string;
  items: T[];
  onSelect: (item: T) => void;
  onClose: () => void;
  renderItem: (item: T, isSelected: boolean) => React.ReactNode;
  filter?: string;
}

const SelectionOverlay = <T,>({
  title,
  items,
  onSelect,
  onClose,
  renderItem,
  filter = "",
}: SelectionOverlayProps<T>) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Filter items
  const filteredItems = useMemo(() => {
    if (!filter) return items;
    return items.filter(item => 
      String(item).toLowerCase().includes(filter.toLowerCase())
    );
  }, [items, filter]);
  
  // Keyboard navigation
  useInput((input, key) => {
    if (key.escape || input === "q") {
      onClose();
      return;
    }
    
    if (key.return) {
      const selected = filteredItems[selectedIndex];
      if (selected) {
        onSelect(selected);
      }
      return;
    }
    
    // Vim-style navigation
    if (input === "j" || key.downArrow) {
      setSelectedIndex(prev => 
        Math.min(prev + 1, filteredItems.length - 1)
      );
    } else if (input === "k" || key.upArrow) {
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    }
  });
  
  // Keep selection in bounds
  useEffect(() => {
    if (selectedIndex >= filteredItems.length) {
      setSelectedIndex(Math.max(0, filteredItems.length - 1));
    }
  }, [filteredItems.length, selectedIndex]);
  
  return (
    <BaseOverlay title={title} onClose={onClose}>
      <Box flexDirection="column">
        {/* Filter display */}
        {filter && (
          <Box marginBottom={1}>
            <Text color="yellow">Filter: {filter}</Text>
          </Box>
        )}
        
        {/* Items list */}
        <Box flexDirection="column" overflowY="auto">
          {filteredItems.map((item, index) => (
            <Box key={index} flexDirection="row">
              <Text color={index === selectedIndex ? "cyan" : "gray"}>
                {index === selectedIndex ? "▶ " : "  "}
              </Text>
              {renderItem(item, index === selectedIndex)}
            </Box>
          ))}
        </Box>
        
        {/* Navigation help */}
        <Box justifyContent="center" marginTop={1}>
          <Text dimColor>
            ↑↓ or j/k to navigate • Enter to select • Esc to cancel
          </Text>
        </Box>
      </Box>
    </BaseOverlay>
  );
};
```

---

## 8. Performance & Terminal Optimization

### 8.1 Render Performance Monitoring

Monitor and optimize terminal rendering performance:

```tsx
// FPS monitoring utility
const useFPSMonitor = () => {
  const lastFrameRef = useRef<number>(Date.now());
  const frameCountRef = useRef<number>(0);
  
  useEffect(() => {
    if (!process.env.CODEX_FPS_DEBUG) return;
    
    const logFrame = () => {
      const now = Date.now();
      const elapsed = now - lastFrameRef.current;
      frameCountRef.current++;
      
      console.error(`[fps] frame ${frameCountRef.current} in ${elapsed}ms`);
      lastFrameRef.current = now;
    };
    
    // Monitor render calls
    const interval = setInterval(logFrame, 16); // ~60fps
    return () => clearInterval(interval);
  }, []);
};

// Performance-optimized component
const OptimizedMessageList: React.FC<{ messages: ChatMessage[] }> = ({ 
  messages 
}) => {
  const terminalSize = useTerminalSize();
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  
  // Virtual scrolling for large message lists
  const visibleMessages = useMemo(() => {
    return messages.slice(visibleRange.start, visibleRange.end);
  }, [messages, visibleRange]);
  
  // Memoize message rendering
  const renderedMessages = useMemo(() => {
    return visibleMessages.map(message => (
      <MemoizedMessageItem key={message.id} message={message} />
    ));
  }, [visibleMessages]);
  
  return (
    <Box flexDirection="column">
      {renderedMessages}
    </Box>
  );
};

const MemoizedMessageItem = React.memo<{ message: ChatMessage }>(({ message }) => (
  <Box flexDirection="column" marginBottom={1}>
    <Text color={message.role === 'user' ? 'green' : 'cyan'}>
      {message.role}: {message.content}
    </Text>
  </Box>
));
```

### 8.2 Terminal State Optimization

Efficient terminal state management:

```tsx
// Debounced terminal resize handling
const useDebouncedTerminalSize = (delay: number = 100) => {
  const [size, setSize] = useState({
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
  });
  
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  useEffect(() => {
    const handleResize = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        setSize({
          columns: process.stdout.columns || 80,
          rows: process.stdout.rows || 24,
        });
      }, delay);
    };
    
    process.stdout.on('resize', handleResize);
    return () => {
      process.stdout.off('resize', handleResize);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [delay]);
  
  return size;
};

// Memory-efficient text buffer
class OptimizedTextBuffer {
  private static readonly MAX_HISTORY = 100;
  private static readonly MAX_LINE_LENGTH = 1000;
  
  private undoStack: Array<BufferState> = [];
  private redoStack: Array<BufferState> = [];
  
  private pushUndo() {
    // Limit history size to prevent memory leaks
    if (this.undoStack.length >= OptimizedTextBuffer.MAX_HISTORY) {
      this.undoStack.shift();
    }
    
    this.undoStack.push(this.snapshot());
    this.redoStack.length = 0; // Clear redo stack
  }
  
  insert(text: string): void {
    // Limit line length to prevent performance issues
    const currentLine = this.getCurrentLine();
    if (currentLine.length + text.length > OptimizedTextBuffer.MAX_LINE_LENGTH) {
      text = text.slice(0, OptimizedTextBuffer.MAX_LINE_LENGTH - currentLine.length);
    }
    
    this.pushUndo();
    // ... insert logic
  }
}
```

### 8.3 Memory Management

Prevent memory leaks in long-running terminal applications:

```tsx
// Message cleanup for long-running chats
const useMessageCleanup = (messages: ChatMessage[], maxMessages: number = 1000) => {
  return useMemo(() => {
    if (messages.length <= maxMessages) {
      return messages;
    }
    
    // Keep recent messages and preserve important ones
    const recent = messages.slice(-maxMessages * 0.8);
    const important = messages
      .slice(0, messages.length - maxMessages * 0.8)
      .filter(msg => msg.isStarred || msg.hasError);
    
    return [...important, ...recent];
  }, [messages, maxMessages]);
};

// Cleanup on component unmount
const useCleanupEffect = () => {
  useEffect(() => {
    return () => {
      // Clear any interval timers
      clearAllTimers();
      
      // Remove event listeners
      process.stdout.removeAllListeners('resize');
      process.stdin.removeAllListeners('data');
      
      // Clear renderer reference
      setInkRenderer(null);
    };
  }, []);
};

// Weak references for large objects
const useWeakRef = <T extends object>(obj: T): React.MutableRefObject<WeakRef<T> | null> => {
  const weakRef = useRef<WeakRef<T> | null>(null);
  
  useEffect(() => {
    weakRef.current = new WeakRef(obj);
    return () => {
      weakRef.current = null;
    };
  }, [obj]);
  
  return weakRef;
};
```

---

## 9. Testing Terminal Components

### 9.1 Setting Up Ink Testing

Configure testing environment for terminal components:

```tsx
// Test setup utilities
import { render, RenderOptions } from 'ink-testing-library';
import { ReactElement } from 'react';

// Mock stdin polyfills for Ink testing
const setupInkTestMocks = () => {
  const { EventEmitter } = require('events');
  const proto = EventEmitter.prototype;
  
  // Add missing ref/unref methods
  if (typeof proto.ref !== 'function') {
    proto.ref = function ref() {};
  }
  if (typeof proto.unref !== 'function') {
    proto.unref = function unref() {};
  }
  
  // Mock readable stream for stdin
  const originalEmit = proto.emit;
  proto.emit = function patchedEmit(event: string, ...args: any[]) {
    if (event === 'data') {
      const chunk = args[0] as string;
      
      // Mock stdin for tests
      if (this._inkIsStub) {
        this._inkBuffered = chunk;
        originalEmit.call(this, 'readable');
      }
    }
    
    return originalEmit.call(this, event, ...args);
  };
};

// Enhanced render function for terminal components
const renderTerminal = (
  ui: ReactElement,
  options?: RenderOptions & {
    terminalSize?: { columns: number; rows: number };
  }
) => {
  setupInkTestMocks();
  
  // Mock terminal size
  if (options?.terminalSize) {
    const originalColumns = process.stdout.columns;
    const originalRows = process.stdout.rows;
    
    Object.defineProperty(process.stdout, 'columns', {
      value: options.terminalSize.columns,
      configurable: true,
    });
    Object.defineProperty(process.stdout, 'rows', {
      value: options.terminalSize.rows,
      configurable: true,
    });
    
    const result = render(ui, options);
    
    // Restore original values
    Object.defineProperty(process.stdout, 'columns', {
      value: originalColumns,
      configurable: true,
    });
    Object.defineProperty(process.stdout, 'rows', {
      value: originalRows,
      configurable: true,
    });
    
    return result;
  }
  
  return render(ui, options);
};

export { renderTerminal as render };
```

### 9.2 Testing Input Handling

Test keyboard input and user interactions:

```tsx
import { render } from './test-utils';
import MultilineTextEditor from '../components/multiline-editor';

describe('MultilineTextEditor', () => {
  it('handles basic text input', async () => {
    let submittedText = '';
    const { stdin } = render(
      <MultilineTextEditor 
        onSubmit={(text) => { submittedText = text; }}
      />
    );
    
    // Type some text
    stdin.write('Hello world');
    expect(submittedText).toBe('');
    
    // Press Enter to submit
    stdin.write('\r');
    expect(submittedText).toBe('Hello world');
  });
  
  it('handles Shift+Enter for newlines', async () => {
    let currentText = '';
    const { stdin } = render(
      <MultilineTextEditor 
        onChange={(text) => { currentText = text; }}
      />
    );
    
    stdin.write('Line 1');
    stdin.write('\n'); // Shift+Enter (newline)
    stdin.write('Line 2');
    
    expect(currentText).toBe('Line 1\nLine 2');
  });
  
  it('handles CSI-u sequences', async () => {
    let submittedText = '';
    const { stdin } = render(
      <MultilineTextEditor 
        onSubmit={(text) => { submittedText = text; }}
      />
    );
    
    stdin.write('Test');
    // CSI-u sequence for Ctrl+Enter
    stdin.write('[13;5u'); 
    
    expect(submittedText).toBe('Test');
  });
  
  it('handles word navigation', async () => {
    const editorRef = { current: null };
    const { stdin } = render(
      <MultilineTextEditor 
        ref={editorRef}
        initialText="hello world test"
      />
    );
    
    // Move cursor to end
    stdin.write('\x05'); // Ctrl+E
    
    // Move one word left
    stdin.write('\x1bb'); // Alt+B (ESC-b)
    
    expect(editorRef.current?.getCol()).toBe(12); // Before "test"
  });
});
```

### 9.3 Testing Layout and Responsiveness

Test responsive terminal layouts:

```tsx
describe('Responsive Layout', () => {
  it('adapts to different terminal sizes', () => {
    const { rerender, lastFrame } = render(
      <TerminalChat messages={[]} />,
      { terminalSize: { columns: 80, rows: 24 } }
    );
    
    expect(lastFrame()).toContain('Terminal width: 80');
    
    // Simulate terminal resize
    rerender(
      <TerminalChat messages={[]} />,
      { terminalSize: { columns: 120, rows: 30 } }
    );
    
    expect(lastFrame()).toContain('Terminal width: 120');
  });
  
  it('handles minimum terminal size gracefully', () => {
    const { lastFrame } = render(
      <TerminalChat messages={[]} />,
      { terminalSize: { columns: 20, rows: 10 } }
    );
    
    // Should not crash with very small terminal
    expect(lastFrame()).toBeDefined();
  });
  
  it('wraps long messages correctly', () => {
    const longMessage = 'a'.repeat(100);
    const { lastFrame } = render(
      <MessageHistory messages={[{ 
        id: '1', 
        content: longMessage, 
        role: 'user',
        timestamp: new Date()
      }]} />,
      { terminalSize: { columns: 50, rows: 20 } }
    );
    
    const frame = lastFrame();
    const lines = frame.split('\n');
    expect(lines.some(line => line.includes('aaa'))).toBe(true);
  });
});
```

### 9.4 Testing Overlay Systems

Test modal and overlay interactions:

```tsx
describe('Overlay System', () => {
  it('opens and closes help overlay', () => {
    const { stdin, lastFrame } = render(<App />);
    
    // Open help overlay
    stdin.write('/help\r');
    expect(lastFrame()).toContain('Help & Commands');
    
    // Close with Escape
    stdin.write('\x1b'); // Escape key
    expect(lastFrame()).not.toContain('Help & Commands');
  });
  
  it('handles overlay stacking', () => {
    const { stdin, lastFrame } = render(<App />);
    
    // Open settings
    stdin.write('/settings\r');
    expect(lastFrame()).toContain('Settings');
    
    // Open help from settings
    stdin.write('h');
    expect(lastFrame()).toContain('Help');
    
    // Close help, should return to settings
    stdin.write('\x1b');
    expect(lastFrame()).toContain('Settings');
    expect(lastFrame()).not.toContain('Help');
  });
  
  it('closes all overlays with multiple escapes', () => {
    const { stdin, lastFrame } = render(<App />);
    
    stdin.write('/settings\r');
    stdin.write('h'); // Open help
    
    // Multiple escapes should close all
    stdin.write('\x1b\x1b');
    
    expect(lastFrame()).not.toContain('Settings');
    expect(lastFrame()).not.toContain('Help');
  });
});
```

---

## 10. Common Patterns & Examples

### 10.1 Slash Command System

Implement extensible slash commands:

```tsx
// Command registry
interface SlashCommand {
  name: string;
  description: string;
  aliases?: string[];
  execute: (args: string[]) => void | Promise<void>;
}

const useSlashCommands = () => {
  const [commands] = useState<Map<string, SlashCommand>>(() => {
    const commandMap = new Map();
    
    // Built-in commands
    commandMap.set('help', {
      name: 'help',
      description: 'Show available commands',
      execute: () => setOverlayMode('help'),
    });
    
    commandMap.set('clear', {
      name: 'clear',
      description: 'Clear the screen',
      aliases: ['cls'],
      execute: () => clearTerminal(),
    });
    
    commandMap.set('history', {
      name: 'history',
      description: 'Show message history',
      execute: () => setOverlayMode('history'),
    });
    
    return commandMap;
  });
  
  const executeCommand = useCallback((input: string) => {
    const [commandName, ...args] = input.slice(1).split(' ');
    const command = commands.get(commandName);
    
    if (command) {
      command.execute(args);
      return true;
    }
    
    // Check aliases
    for (const [name, cmd] of commands) {
      if (cmd.aliases?.includes(commandName)) {
        cmd.execute(args);
        return true;
      }
    }
    
    return false;
  }, [commands]);
  
  const addCommand = useCallback((command: SlashCommand) => {
    commands.set(command.name, command);
  }, [commands]);
  
  return {
    commands: Array.from(commands.values()),
    executeCommand,
    addCommand,
  };
};

// Command auto-completion
const useCommandCompletion = (input: string) => {
  const { commands } = useSlashCommands();
  
  return useMemo(() => {
    if (!input.startsWith('/')) return [];
    
    const partial = input.slice(1).toLowerCase();
    return commands
      .filter(cmd => 
        cmd.name.toLowerCase().startsWith(partial) ||
        cmd.aliases?.some(alias => alias.toLowerCase().startsWith(partial))
      )
      .slice(0, 5); // Limit suggestions
  }, [input, commands]);
};
```

### 10.2 File System Integration

File browser and path completion:

```tsx
// File system browser component
const FileBrowser: React.FC<{
  initialPath?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
}> = ({ initialPath = process.cwd(), onSelect, onClose }) => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [items, setItems] = useState<FileItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Load directory contents
  useEffect(() => {
    const loadDirectory = async () => {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        const fileItems: FileItem[] = [
          // Parent directory
          { name: '..', isDirectory: true, path: path.dirname(currentPath) },
          // Directory contents
          ...entries.map(entry => ({
            name: entry.name,
            isDirectory: entry.isDirectory(),
            path: path.join(currentPath, entry.name),
          }))
        ];
        setItems(fileItems);
        setSelectedIndex(0);
      } catch (error) {
        // Handle permission errors
        setItems([{ name: '..', isDirectory: true, path: path.dirname(currentPath) }]);
      }
    };
    
    loadDirectory();
  }, [currentPath]);
  
  // Navigation
  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    
    if (key.return) {
      const selected = items[selectedIndex];
      if (selected.isDirectory) {
        setCurrentPath(selected.path);
      } else {
        onSelect(selected.path);
      }
      return;
    }
    
    // List navigation
    if (key.downArrow || input === 'j') {
      setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
    } else if (key.upArrow || input === 'k') {
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    }
  });
  
  return (
    <BaseOverlay title={`📁 ${currentPath}`} onClose={onClose}>
      <Box flexDirection="column">
        {items.map((item, index) => (
          <Box key={item.name} flexDirection="row">
            <Text color={index === selectedIndex ? 'cyan' : 'gray'}>
              {index === selectedIndex ? '▶ ' : '  '}
            </Text>
            <Text color={item.isDirectory ? 'blue' : 'white'}>
              {item.isDirectory ? '📁' : '📄'} {item.name}
            </Text>
          </Box>
        ))}
      </Box>
    </BaseOverlay>
  );
};

// Path auto-completion
const usePathCompletion = (input: string) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  useEffect(() => {
    const getSuggestions = async () => {
      if (!input) {
        setSuggestions([]);
        return;
      }
      
      const dirPath = path.dirname(input);
      const baseName = path.basename(input);
      
      try {
        const entries = await fs.readdir(dirPath);
        const matches = entries
          .filter(entry => entry.startsWith(baseName))
          .map(entry => path.join(dirPath, entry))
          .slice(0, 10);
        
        setSuggestions(matches);
      } catch {
        setSuggestions([]);
      }
    };
    
    const debounced = setTimeout(getSuggestions, 150);
    return () => clearTimeout(debounced);
  }, [input]);
  
  return suggestions;
};
```

### 10.3 Progress Indicators

Various progress and loading indicators:

```tsx
// Animated spinner component
const Spinner: React.FC<{
  type?: 'dots' | 'line' | 'circle';
  text?: string;
}> = ({ type = 'dots', text }) => {
  const [frame, setFrame] = useState(0);
  
  const animations = {
    dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    line: ['|', '/', '-', '\\'],
    circle: ['◐', '◓', '◑', '◒'],
  };
  
  const frames = animations[type];
  
  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(prev => (prev + 1) % frames.length);
    }, 100);
    
    return () => clearInterval(interval);
  }, [frames.length]);
  
  return (
    <Box flexDirection="row" columnGap={1}>
      <Text color="cyan">{frames[frame]}</Text>
      {text && <Text>{text}</Text>}
    </Box>
  );
};

// Progress bar component
const ProgressBar: React.FC<{
  progress: number; // 0-100
  width?: number;
  showPercentage?: boolean;
}> = ({ progress, width = 40, showPercentage = true }) => {
  const filledWidth = Math.round((progress / 100) * width);
  const emptyWidth = width - filledWidth;
  
  return (
    <Box flexDirection="row" alignItems="center">
      <Text color="cyan">
        {'█'.repeat(filledWidth)}{'░'.repeat(emptyWidth)}
      </Text>
      {showPercentage && (
        <Text marginLeft={1}>{progress.toFixed(1)}%</Text>
      )}
    </Box>
  );
};

// Loading states component
const LoadingState: React.FC<{
  state: 'loading' | 'success' | 'error';
  message: string;
}> = ({ state, message }) => {
  const icons = {
    loading: <Spinner type="dots" />,
    success: <Text color="green">✓</Text>,
    error: <Text color="red">✗</Text>,
  };
  
  const colors = {
    loading: 'yellow',
    success: 'green',
    error: 'red',
  };
  
  return (
    <Box flexDirection="row" alignItems="center" columnGap={1}>
      {icons[state]}
      <Text color={colors[state]}>{message}</Text>
    </Box>
  );
};

// Multi-step progress
const StepProgress: React.FC<{
  steps: string[];
  currentStep: number;
  completedSteps: Set<number>;
}> = ({ steps, currentStep, completedSteps }) => {
  return (
    <Box flexDirection="column">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.has(index);
        const isCurrent = index === currentStep;
        const isPending = index > currentStep;
        
        let icon = '○';
        let color = 'gray';
        
        if (isCompleted) {
          icon = '●';
          color = 'green';
        } else if (isCurrent) {
          icon = '◐';
          color = 'yellow';
        }
        
        return (
          <Box key={index} flexDirection="row" alignItems="center">
            <Text color={color}>{icon}</Text>
            <Text marginLeft={1} color={isPending ? 'gray' : color}>
              {step}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};
```

### 10.4 Data Tables

Tabular data display for terminal:

```tsx
// Terminal table component
interface TableColumn<T> {
  key: keyof T;
  title: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

const Table = <T,>({
  data,
  columns,
  maxHeight,
  showHeader = true,
}: {
  data: T[];
  columns: TableColumn<T>[];
  maxHeight?: number;
  showHeader?: boolean;
}) => {
  const terminalSize = useTerminalSize();
  const [scrollOffset, setScrollOffset] = useState(0);
  
  // Calculate column widths
  const totalWidth = terminalSize.columns - 4;
  const calculatedColumns = useMemo(() => {
    const autoColumns = columns.filter(col => !col.width);
    const fixedWidth = columns
      .filter(col => col.width)
      .reduce((sum, col) => sum + (col.width || 0), 0);
    
    const autoWidth = Math.floor((totalWidth - fixedWidth) / autoColumns.length);
    
    return columns.map(col => ({
      ...col,
      width: col.width || autoWidth,
    }));
  }, [columns, totalWidth]);
  
  // Render cell with alignment
  const renderCell = (content: React.ReactNode, width: number, align: string) => {
    const text = String(content).slice(0, width - 1);
    
    if (align === 'center') {
      const padding = Math.max(0, width - text.length);
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
    } else if (align === 'right') {
      return text.padStart(width);
    } else {
      return text.padEnd(width);
    }
  };
  
  // Keyboard navigation
  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      setScrollOffset(prev => Math.max(0, prev - 1));
    } else if (key.downArrow || input === 'j') {
      const maxScroll = Math.max(0, data.length - (maxHeight || 10));
      setScrollOffset(prev => Math.min(maxScroll, prev + 1));
    }
  });
  
  const visibleData = maxHeight 
    ? data.slice(scrollOffset, scrollOffset + maxHeight)
    : data;
  
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray">
      {/* Header */}
      {showHeader && (
        <Box flexDirection="row" backgroundColor="gray">
          {calculatedColumns.map(col => (
            <Box key={String(col.key)} width={col.width}>
              <Text bold>
                {renderCell(col.title, col.width, col.align || 'left')}
              </Text>
            </Box>
          ))}
        </Box>
      )}
      
      {/* Data rows */}
      {visibleData.map((row, rowIndex) => (
        <Box key={rowIndex} flexDirection="row">
          {calculatedColumns.map(col => (
            <Box key={String(col.key)} width={col.width}>
              <Text>
                {renderCell(
                  col.render ? col.render(row[col.key], row) : String(row[col.key]),
                  col.width,
                  col.align || 'left'
                )}
              </Text>
            </Box>
          ))}
        </Box>
      ))}
      
      {/* Scroll indicator */}
      {maxHeight && data.length > maxHeight && (
        <Box justifyContent="center">
          <Text dimColor>
            Showing {scrollOffset + 1}-{Math.min(scrollOffset + maxHeight, data.length)} of {data.length}
          </Text>
        </Box>
      )}
    </Box>
  );
};

// Usage example
const FileTable: React.FC = () => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  
  const columns: TableColumn<FileInfo>[] = [
    { key: 'name', title: 'Name', width: 30 },
    { key: 'size', title: 'Size', width: 10, align: 'right', 
      render: (size) => formatBytes(size as number) },
    { key: 'modified', title: 'Modified', width: 20,
      render: (date) => (date as Date).toLocaleString() },
    { key: 'type', title: 'Type', width: 10 },
  ];
  
  return (
    <Table 
      data={files} 
      columns={columns} 
      maxHeight={15}
      showHeader={true}
    />
  );
};
```

---

## Conclusion

This comprehensive guide covers the essential patterns and practices for building sophisticated terminal user interfaces with Ink and React. The patterns demonstrated here are production-tested and provide a solid foundation for creating responsive, interactive, and performant terminal applications.

### Key Takeaways:

1. **Architecture**: Use layered architecture with clear separation between CLI, App, and UI layers
2. **Components**: Build reusable, composable components following terminal-specific patterns
3. **Input**: Implement robust keyboard handling with support for complex terminal sequences
4. **Layout**: Utilize responsive flexbox layouts that adapt to terminal size changes
5. **Performance**: Optimize for terminal rendering with proper state management and cleanup
6. **Testing**: Use comprehensive testing strategies with proper mocks and utilities

### Next Steps:

- Extend the component library with your own domain-specific components
- Implement advanced features like syntax highlighting, tables, and charts
- Add accessibility features for users with different terminal capabilities
- Create reusable hooks and utilities for common terminal operations

The patterns in this guide provide a robust foundation for any terminal application, from simple CLI tools to complex interactive development environments.