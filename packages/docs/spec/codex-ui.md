# Technical Specification: Terminal Interface for Claude Codex

## Architecture Overview

**Stack:**
- **Frontend**: Vite + React + TypeScript + Tailwind + shadcn/ui
- **Backend**: Hono + Bun + WebSocket + node-pty
- **Communication**: WebSocket for terminal I/O
- **Development**: Hot reload, ESM modules, modern tooling

**Ports:**
- Frontend: `http://localhost:42069` (Vite default)
- Backend: `http://localhost:42070` (Hono server + WebSocket)

---

## Frontend Architecture (Vite + React)

### **Project Structure**
```
terminal-interface/
├── src/
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   ├── terminal/
│   │   │   ├── TerminalView.tsx   # xterm.js wrapper
│   │   │   ├── ControlsSidebar.tsx
│   │   │   └── TerminalLayout.tsx
│   │   └── dashboard/
│   │       ├── SessionList.tsx    # Future: session management
│   │       └── CreateSession.tsx  # Future: new session form
│   ├── lib/
│   │   ├── websocket-client.ts    # WebSocket abstraction
│   │   ├── terminal-manager.ts    # Terminal state management
│   │   └── utils.ts
│   ├── types/
│   │   └── terminal.ts            # TypeScript definitions
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

### **Key Dependencies**
```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "@xterm/xterm": "^5.5.0",
    "@xterm/addon-fit": "^0.10.0",
    "sonner": "^2.0.5",
    "lucide-react": "^0.400.0"
  },
  "devDependencies": {
    "vite": "^5",
    "typescript": "^5",
    "tailwindcss": "^3",
    "@types/react": "^18"
  }
}
```

---

## Backend Architecture (Hono + WebSocket)

### **Project Structure**
```
terminal-server/
├── src/
│   ├── server.ts              # Main Hono app
│   ├── websocket/
│   │   ├── terminal-handler.ts # WebSocket terminal logic
│   │   └── session-manager.ts  # tmux session management
│   ├── routes/
│   │   ├── sessions.ts         # REST API for session management
│   │   └── health.ts           # Health check endpoint
│   ├── types/
│   │   └── websocket.ts        # Message type definitions
│   └── utils/
│       └── tmux.ts             # tmux helper functions
├── package.json
└── tsconfig.json
```

### **Dependencies**
```json
{
  "dependencies": {
    "hono": "^4.0.0",
    "ws": "^8.18.0",
    "node-pty": "^1.0.0"
  },
  "devDependencies": {
    "bun-types": "latest",
    "@types/ws": "^8.18.0"
  }
}
```

---

## WebSocket API Specification

### **Connection**
```
ws://localhost:3001/ws/terminal?session={sessionName}
```

### **Message Protocol**

**Client → Server Messages:**
```typescript
type ClientMessage = 
  | { type: 'connect'; session: string; cols: number; rows: number }
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'ping' }
```

**Server → Client Messages:**
```typescript
type ServerMessage = 
  | { type: 'connected'; session: string; message: string }
  | { type: 'data'; data: string }
  | { type: 'error'; code: string; message: string }
  | { type: 'exit'; exitCode: number; signal?: number }
  | { type: 'pong' }
```

### **Error Codes**
```typescript
enum ErrorCode {
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_CREATION_FAILED = 'SESSION_CREATION_FAILED',
  PTY_SPAWN_FAILED = 'PTY_SPAWN_FAILED',
  INVALID_MESSAGE = 'INVALID_MESSAGE'
}
```

### **Connection Flow**
1. **Connect**: `ws://localhost:3001/ws/terminal?session=mysession`
2. **Authentication**: None for MVP
3. **Session Binding**: Server attempts `tmux attach -t mysession`
4. **Success**: `{ type: 'connected', session: 'mysession', message: '...' }`
5. **Data Flow**: Bidirectional terminal I/O
6. **Cleanup**: Auto-cleanup on disconnect

---

## REST API Specification

### **Base URL**: `http://localhost:3001/api`

### **Endpoints**

#### **GET /sessions**
List all available tmux sessions
```typescript
Response: {
  sessions: Array<{
    name: string;
    created: string;
    lastActivity: string;
    windows: number;
    attached: boolean;
  }>
}
```

#### **POST /sessions**
Create new tmux session
```typescript
Request: {
  name: string;
  command?: string;
  workingDir?: string;
}

Response: {
  session: {
    name: string;
    created: string;
  }
}
```

#### **DELETE /sessions/:name**
Kill tmux session
```typescript
Response: {
  success: boolean;
  message: string;
}
```

#### **GET /health**
Health check
```typescript
Response: {
  status: 'ok';
  uptime: number;
  sessions: number;
}
```

---

## Implementation Details

### **Terminal Sizing & Resize Handling**
```typescript
// Proper resize implementation
const handleResize = useCallback(() => {
  if (!fitAddon.current || !terminal.current) return;
  
  // Use ResizeObserver for container size changes
  const dims = fitAddon.current.proposeDimensions();
  if (dims) {
    terminal.current.resize(dims.cols, dims.rows);
    // Send resize to server
    websocket.send({
      type: 'resize',
      cols: dims.cols,
      rows: dims.rows
    });
  }
}, []);
```

### **WebSocket Reconnection Logic**
```typescript
class TerminalWebSocket {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  
  private async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      throw new Error('Max reconnection attempts reached');
    }
    
    await new Promise(resolve => 
      setTimeout(resolve, this.reconnectDelay * Math.pow(2, this.reconnectAttempts))
    );
    
    this.reconnectAttempts++;
    return this.connect();
  }
}
```

### **Session State Management**
```typescript
// Frontend state management
interface SessionState {
  sessions: Map<string, {
    name: string;
    status: 'connected' | 'connecting' | 'disconnected' | 'error';
    terminal?: Terminal;
    websocket?: TerminalWebSocket;
  }>;
  activeSession: string | null;
}
```

---

## Development Setup

### **Frontend (Vite)**
```bash
npm create vite@latest terminal-interface -- --template react-ts
cd terminal-interface
npm install
npm install @xterm/xterm @xterm/addon-fit sonner lucide-react
npm run dev  # http://localhost:5173
```

### **Backend (Hono + Bun)**
```bash
mkdir terminal-server && cd terminal-server
bun init
bun add hono ws node-pty
bun add -d @types/ws bun-types
bun run dev  # http://localhost:3001
```

### **Development Scripts**
```json
// terminal-interface/package.json
{
  "scripts": {
    "dev": "vite --port 5173",
    "build": "vite build",
    "preview": "vite preview"
  }
}

// terminal-server/package.json  
{
  "scripts": {
    "dev": "bun run --watch src/server.ts",
    "start": "bun run src/server.ts"
  }
}
```

---

## Future Extensibility

### **Session Management Integration**
- REST API ready for session CRUD operations
- WebSocket protocol supports session metadata
- Frontend architecture supports multiple terminal tabs

### **GitHub Integration Points**
- Session creation can accept GitHub issue ID
- REST API can be extended for GitHub webhook handling
- Frontend can display session metadata (issue, branch, etc.)

This specification provides a **robust, production-ready foundation** while keeping the current scope focused on the terminal interface. The architecture is designed to scale when you add dashboard and GitHub integration features.