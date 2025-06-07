# 🤖 Claude Swarm

A multi-agent Claude swarm system built with [Ink](https://github.com/vadimdemedes/ink) for terminal interfaces.

## ✨ Features

- **Multi-Agent System** - Coordinate multiple Claude instances
- **Swarm Intelligence** - Collaborative problem solving
- **Terminal Interface** - Real-time agent communication display
- **Task Distribution** - Intelligent workload allocation
- **Agent Monitoring** - Track individual agent performance
- **TypeScript** - Full type safety
- **Responsive** - Adapts to terminal size

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/your-username/claude-swarm
cd claude-swarm

# Install dependencies
bun install

# Start the swarm
bun dev
```

## 🎮 Usage

Once running, you can:
- Submit tasks to the swarm and press **Enter**
- Use **Shift+Enter** for multi-line task descriptions
- Type `/help` to see available commands
- Type `/agents` to view active agents
- Type `/clear` to clear the terminal
- Press **Ctrl+C** to exit

## 🏗️ Architecture

```
src/
├── app.tsx              # Main app with swarm coordination
├── cli.tsx              # CLI entry point
├── types.ts             # Type definitions
├── components/
│   ├── chat/
│   │   ├── terminal-chat.tsx           # Main swarm interface
│   │   ├── terminal-header.tsx         # App header
│   │   ├── terminal-message-history.tsx # Agent communication display
│   │   ├── terminal-chat-input.tsx     # Task input component
│   │   └── multiline-editor.tsx        # Text editor
│   ├── help-overlay.tsx               # Help modal
│   └── ...
└── utils/
    ├── terminal.ts      # Terminal management
    ├── text-buffer.ts   # Text editing logic
    └── ...
```

## 🔧 Customization

### Adding New Agent Types

```typescript
// Update src/types.ts
export interface SwarmMessage {
  id: string;
  content: string;
  role: 'user' | 'agent' | 'system'; // Add new agent types
  agentId?: string; // Track which agent sent the message
  timestamp: Date;
  metadata?: any; // Add custom fields
}
```

### Adding Swarm Commands

```typescript
// In TerminalChat component
const handleSlashCommand = (command: string) => {
  switch (command) {
    case "/spawn-agent":
      // Spawn new agent logic
    case "/kill-agent":
      // Remove agent logic
      return true;
    // ...
  }
};
```

### Integrating Claude APIs

Replace the echo logic in `app.tsx` with Claude API calls:

```typescript
const handleSendMessage = async (content: string) => {
  const userMessage = { /* ... */ };
  setMessages(prev => [...prev, userMessage]);
  
  // Distribute task to available agents
  const response = await distributeTaskToSwarm(content);
  
  const assistantMessage = { /* ... */ };
  setMessages(prev => [...prev, assistantMessage]);
};
```

## 📦 Scripts

```bash
bun dev          # Start swarm development server
bun build        # Build for production  
bun test         # Run tests
bun lint         # Lint code
bun typecheck    # Type checking
```

## 🎨 Components

### Core Components
- `TerminalChat` - Main swarm interface layout
- `TerminalHeader` - Status and app info
- `TerminalChatInput` - Task input with shortcuts
- `MultilineTextEditor` - Advanced text editing
- `HelpOverlay` - Modal overlay pattern

### Utilities
- `text-buffer.ts` - Unicode-aware text operations
- `terminal.ts` - Terminal state management
- `useTerminalSize` - Responsive terminal hook

## 🔍 Key Patterns

1. **Agent Communication** - Multi-agent message coordination
2. **Overlay System** - Conditional rendering for modals
3. **Keyboard Handling** - Input composition and shortcuts
4. **Terminal Cleanup** - Prevents frozen terminal on exit
5. **Type Safety** - Full TypeScript coverage

## 🛠️ Development Tips

- Set `CODEX_FPS_DEBUG=1` to monitor rendering performance
- Components automatically handle terminal resizing
- Keyboard composition is supported for international input
- Use existing overlay patterns for consistent UX

## 📄 License

Apache-2.0

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Add tests if needed
5. Submit a pull request

---

Built with ❤️ using [Ink](https://github.com/vadimdemedes/ink) and Claude AI