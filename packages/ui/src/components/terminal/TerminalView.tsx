import { useState, useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import 'xterm/css/xterm.css';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { 
  ArrowLeft, 
  PanelRightClose, 
  PanelRightOpen,
  GitBranch as GitBranchIcon,
  Clock,
  User,
  Terminal as TerminalIcon,
  Copy,
  ExternalLink,
  Trash2,
  GitFork,
  GitMerge
} from 'lucide-react';

interface TerminalViewProps {
  instanceId: string;
  sessionName: string;
  onBack: () => void;
}

export function TerminalView({ instanceId, sessionName, onBack }: TerminalViewProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Mock instance data based on instanceId
  const mockInstance = {
    id: instanceId,
    type: instanceId.startsWith('work') ? 'work' : instanceId.startsWith('review') ? 'review' : 'adhoc',
    status: 'running',
    branch_name: 'feat/auth-fix',
    issue_number: 123,
    issue_title: 'Fix authentication system',
    created_at: '2024-01-15T08:30:00Z',
    agent_number: 1,
    worktree_path: `/Users/user/worktrees/${instanceId}`,
  };

  // Initialize xterm.js terminal and WebSocket connection
  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance with that nice green-on-black theme
    const terminal = new Terminal({
      theme: {
        background: '#000000',
        foreground: '#00ff00',
        cursor: '#00ff00',
        cursorAccent: '#000000',
        selection: 'rgba(0, 255, 0, 0.3)',
        black: '#000000',
        red: '#ff0000',
        green: '#00ff00',
        yellow: '#ffff00',
        blue: '#0000ff',
        magenta: '#ff00ff',
        cyan: '#00ffff',
        white: '#ffffff',
        brightBlack: '#808080',
        brightRed: '#ff8080',
        brightGreen: '#80ff80',
        brightYellow: '#ffff80',
        brightBlue: '#8080ff',
        brightMagenta: '#ff80ff',
        brightCyan: '#80ffff',
        brightWhite: '#ffffff'
      },
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      allowTransparency: false
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    
    // Open terminal in the DOM
    terminal.open(terminalRef.current);
    
    // Store refs
    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;
    
    // Fit terminal to container
    fitAddon.fit();
    
    // Connect to WebSocket
    const ws = new WebSocket('ws://localhost:3002/api/terminal');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected to PTY');
      setIsConnected(true);
      
      // Send connect message to start PTY session
      ws.send(JSON.stringify({
        type: 'connect',
        session: 'testing',
        cols: terminal.cols,
        rows: terminal.rows
      }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      
      switch (msg.type) {
        case 'data':
          // Write PTY data to terminal
          terminal.write(msg.data);
          break;
          
        case 'connected':
          console.log('Connected to tmux session:', msg.message);
          break;
          
        case 'error':
          console.error('PTY error:', msg.message);
          terminal.write('\r\n❌ ' + msg.message + '\r\n');
          break;
          
        case 'exit':
          console.log('PTY session ended:', msg.message);
          terminal.write('\r\n💀 ' + msg.message + '\r\n');
          setIsConnected(false);
          break;
          
        default:
          console.log('Unknown message type:', msg.type);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      terminal.write('\r\n❌ Disconnected from tmux session\r\n');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      terminal.write('\r\n⚠️ WebSocket connection error\r\n');
    };

    // Handle terminal input - send to PTY
    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'input',
          data: data
        }));
      }
    });

    // Handle terminal resize
    terminal.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'resize',
          cols,
          rows
        }));
      }
    });

    // Handle window resize
    const handleResize = () => {
      if (fitAddon) {
        fitAddon.fit();
      }
    };
    
    window.addEventListener('resize', handleResize);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      terminal.dispose();
    };
  }, [sessionName]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ago`;
    }
    return '30m ago';
  };

  const getTypeIcon = () => {
    switch (mockInstance.type) {
      case 'work':
        return '🔨';
      case 'review':
        return '🔬';
      case 'adhoc':
        return '⚡';
      default:
        return '📝';
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <span className="text-lg">{getTypeIcon()}</span>
            <h1 className="font-semibold">{instanceId}</h1>
            <Badge variant="default">Running</Badge>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? (
            <PanelRightClose className="h-4 w-4" />
          ) : (
            <PanelRightOpen className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Terminal */}
        <div className="flex-1 flex flex-col">
          {/* Real xterm.js terminal container */}
          <div 
            ref={terminalRef}
            className="flex-1 bg-black"
            style={{ padding: 0 }}
          />
          
          {/* Connection Status Bar */}
          <div className="border-t bg-card p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {isConnected ? '🟢' : '🔴'} Session: {sessionName} | 
                {isConnected ? ' Connected to tmux via PTY' : ' Disconnected'}
              </span>
              <span className="text-xs text-muted-foreground">
                Click anywhere in terminal to interact
              </span>
            </div>
          </div>
        </div>

        {/* Collapsible Sidebar */}
        {sidebarOpen && (
          <div className="w-80 border-l bg-card flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-semibold mb-3">Instance Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  🔬 Launch Review
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <ExternalLink className="h-3 w-3 mr-2" />
                  Open Editor
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Copy className="h-3 w-3 mr-2" />
                  Copy Branch
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <GitFork className="h-3 w-3 mr-2" />
                  Fork Instance
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <GitMerge className="h-3 w-3 mr-2" />
                  Merge Back
                </Button>
                <Separator />
                <Button variant="destructive" size="sm" className="w-full justify-start">
                  <Trash2 className="h-3 w-3 mr-2" />
                  Kill Instance
                </Button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <h4 className="font-medium mb-2">Instance Info</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <GitBranchIcon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Branch:</span>
                    <code className="bg-muted px-1 rounded text-xs">{mockInstance.branch_name}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Started:</span>
                    <span>{formatTimeAgo(mockInstance.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Agent:</span>
                    <span>Agent {mockInstance.agent_number}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TerminalIcon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Session:</span>
                    <code className="bg-muted px-1 rounded text-xs">{sessionName}</code>
                  </div>
                </div>
              </div>

              {mockInstance.issue_number && (
                <div>
                  <h4 className="font-medium mb-2">Related Issue</h4>
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="text-sm">
                        <div className="font-medium">Issue #{mockInstance.issue_number}</div>
                        <div className="text-muted-foreground">{mockInstance.issue_title}</div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex gap-1">
                        <Badge variant="destructive" className="text-xs">bug</Badge>
                        <Badge variant="default" className="text-xs">priority-high</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div>
                <h4 className="font-medium mb-2">Connection Status</h4>
                <div className={`p-3 rounded-md ${
                  isConnected 
                    ? 'bg-green-50 dark:bg-green-900/20' 
                    : 'bg-red-50 dark:bg-red-900/20'
                }`}>
                  <p className={`text-sm ${
                    isConnected 
                      ? 'text-green-700 dark:text-green-300' 
                      : 'text-red-700 dark:text-red-300'
                  }`}>
                    {isConnected ? '🟢 Connected to tmux session' : '🔴 Disconnected from tmux session'}
                  </p>
                  <p className={`text-xs mt-1 ${
                    isConnected 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    Session: testing | WebSocket: {isConnected ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}