import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { spawn } from 'child_process';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

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
  console.log('New WebSocket connection');
  
  // Always use "testing" session for now
  const sessionName = 'testing';
  
  // Send initial tmux capture
  const initialCapture = spawn('tmux', [
    'capture-pane', 
    '-t', sessionName,
    '-p',        // print to stdout
    '-S', '-'    // capture entire scrollback
  ]);
  
  initialCapture.stdout.on('data', (data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(data.toString());
    }
  });
  
  // Set up continuous monitoring of tmux session
  const monitor = setInterval(() => {
    const tmuxMonitor = spawn('tmux', [
      'capture-pane',
      '-t', sessionName,
      '-p',
      '-S', '-5'  // Last 5 lines to reduce noise
    ]);
    
    tmuxMonitor.stdout.on('data', (data) => {
      const output = data.toString();
      // Only send if there's actual content and WebSocket is open
      if (output.trim().length > 0 && ws.readyState === ws.OPEN) {
        ws.send(output);
      }
    });
    
    tmuxMonitor.on('error', (error) => {
      console.error('Tmux monitor error:', error.message);
    });
  }, 2000); // Check every 2 seconds
  
  // Handle incoming messages (terminal input)
  ws.on('message', (message) => {
    const messageStr = message.toString();
    console.log(`Received message: ${messageStr}`);
    
    // Handle terminal input - send to tmux session
    if (messageStr.startsWith('input:')) {
      const input = messageStr.slice(6); // Remove 'input:' prefix
      
      // Send input to the testing tmux session
      const tmuxInput = spawn('tmux', [
        'send-keys',
        '-t', sessionName,
        input,
        'Enter'
      ]);
      
      tmuxInput.on('error', (error) => {
        console.error('Tmux input error:', error.message);
        if (ws.readyState === ws.OPEN) {
          ws.send(`Error sending input: ${error.message}\n`);
        }
      });
    }
  });
  
  // Handle WebSocket close
  ws.on('close', () => {
    console.log('WebSocket connection closed');
    clearInterval(monitor);
  });
  
  // Handle WebSocket errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clearInterval(monitor);
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