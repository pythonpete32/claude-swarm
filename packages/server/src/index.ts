import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import * as pty from 'node-pty';

const app = new Hono();

// Enable CORS for development
app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (c.req.method === 'OPTIONS') {
    return c.text('', 200);
  }
  
  await next();
});

// Basic health check
app.get('/', (c) => {
  return c.json({ 
    message: 'Claude Codex Server',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Mock instance API endpoints
app.get('/api/instances', (c) => {
  return c.json([
    {
      id: 'work-123-a1',
      type: 'work',
      status: 'running',
      session_name: 'testing', // Always use testing session for now
      worktree_path: '/mock/path',
      branch_name: 'feat/auth-fix',
      issue_number: 123,
      created_at: new Date().toISOString()
    }
  ]);
});

app.post('/api/instances', async (c) => {
  const body = await c.req.json();
  
  // Mock instance creation - always return testing session
  return c.json({
    id: `work-${Date.now()}-a1`,
    type: 'work',
    status: 'running',
    session_name: 'testing',
    worktree_path: '/mock/path',
    branch_name: 'main',
    created_at: new Date().toISOString(),
    prompt: body.prompt || ''
  }, 201);
});

const port = process.env.PORT || 3001;

// Create HTTP server
const server = createServer();

// Create WebSocket server
const wss = new WebSocketServer({ 
  server,
  path: '/api/terminal'
});

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection - creating PTY session');
  
  // Create a PTY that attaches to the existing "testing" tmux session
  // This will give us a real terminal interface
  const sessionName = 'testing';
  
  let ptyProcess;
  
  try {
    // Attach to existing tmux session using PTY
    ptyProcess = pty.spawn('tmux', ['attach-session', '-t', sessionName], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env
    });
    
    console.log(`PTY attached to tmux session: ${sessionName}`);
    
    // Send PTY output directly to WebSocket
    ptyProcess.onData((data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    });
    
    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`PTY exited with code ${exitCode} and signal ${signal}`);
      if (ws.readyState === ws.OPEN) {
        ws.close();
      }
    });
    
  } catch (error) {
    console.error('Error creating PTY:', error);
    if (ws.readyState === ws.OPEN) {
      ws.send(`Error: Could not attach to tmux session "${sessionName}"\r\n`);
      ws.close();
    }
    return;
  }
  
  // Handle incoming messages (terminal input and control messages from browser)
  ws.on('message', (message) => {
    const data = message.toString();
    
    // Try to parse as JSON first (for control messages like resize)
    try {
      const json = JSON.parse(data);
      if (json.type === 'resize' && ptyProcess) {
        ptyProcess.resize(json.cols, json.rows);
        console.log(`Terminal resized to ${json.cols}x${json.rows}`);
        return;
      }
    } catch (e) {
      // Not JSON, treat as regular terminal input
    }
    
    // Send all other input directly to the PTY (real terminal behavior)
    if (ptyProcess) {
      ptyProcess.write(data);
    }
  });
  
  // Handle WebSocket close
  ws.on('close', () => {
    console.log('WebSocket connection closed - cleaning up PTY');
    if (ptyProcess) {
      ptyProcess.kill();
    }
  });
  
  // Handle WebSocket errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    if (ptyProcess) {
      ptyProcess.kill();
    }
  });
});

// Start Hono HTTP server
serve({
  fetch: app.fetch,
  port: Number(port)
}, (info) => {
  console.log(`🚀 HTTP Server running at http://localhost:${info.port}`);
});

// Start WebSocket server on different port
const wsPort = Number(port) + 1;
server.listen(wsPort, () => {
  console.log(`📡 WebSocket server running at ws://localhost:${wsPort}/api/terminal`);
  console.log(`🔧 Using tmux session: testing`);
});

export default app;