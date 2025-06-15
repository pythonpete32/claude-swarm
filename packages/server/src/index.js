import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import pty from 'node-pty';

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

const port = process.env.PORT || 42070;

// Create HTTP server
const server = createServer();

// Create WebSocket server
const wss = new WebSocketServer({ 
  server,
  path: '/api/terminal'
});

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');
  
  let ptyProcess = null;
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    
    switch (msg.type) {
      case 'connect':
        try {
          // Always connect to "testing" session for now
          const sessionName = 'testing';
          
          ptyProcess = pty.spawn('tmux', ['attach', '-t', sessionName], {
            name: 'xterm-256color',
            cols: msg.cols || 80,
            rows: msg.rows || 24,
            cwd: process.cwd(),
            env: process.env,
          });
          
          // Set up data flow: pty -> websocket
          ptyProcess.onData((data) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: 'data', data }));
            }
          });
          
          // Handle pty exit
          ptyProcess.onExit(({ exitCode, signal }) => {
            console.log(`tmux session ${sessionName} exited:`, exitCode, signal);
            ws.send(JSON.stringify({ 
              type: 'exit', 
              exitCode, 
              signal,
              message: `Session ${sessionName} ended`
            }));
          });
          
          ws.send(JSON.stringify({ 
            type: 'connected', 
            session: sessionName,
            message: `Connected to tmux session: ${sessionName}`
          }));
          
          console.log(`PTY attached to tmux session: ${sessionName}`);
          
        } catch (error) {
          console.error('Failed to connect to tmux session:', error);
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: `Failed to connect to session "testing". Make sure it exists.`
          }));
        }
        break;
        
      case 'input':
        // Send input to pty
        if (ptyProcess) {
          ptyProcess.write(msg.data);
        }
        break;
        
      case 'resize':
        // Resize terminal
        if (ptyProcess) {
          ptyProcess.resize(msg.cols, msg.rows);
          console.log(`Terminal resized to ${msg.cols}x${msg.rows}`);
        }
        break;
        
      default:
        console.log('Unknown message type:', msg.type);
    }
  });
  
  // Handle WebSocket close
  ws.on('close', () => {
    console.log('WebSocket connection closed');
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