import { useState } from 'react';
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
  Terminal,
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

  // Mock terminal output
  const mockTerminalLines = [
    'claude@work-123-a1:~/worktrees/work-123-a1$ ls',
    'README.md  package.json  src/  tests/',
    'claude@work-123-a1:~/worktrees/work-123-a1$ cd src/',
    'claude@work-123-a1:~/worktrees/work-123-a1/src$ cat auth.ts',
    '// Authentication service implementation',
    'export class AuthService {',
    '  private token: string | null = null;',
    '',
    '  async login(username: string, password: string): Promise<boolean> {',
    '    // TODO: Implement proper authentication',
    '    const response = await fetch("/api/login", {',
    '      method: "POST",',
    '      headers: { "Content-Type": "application/json" },',
    '      body: JSON.stringify({ username, password })',
    '    });',
    '',
    '    if (response.ok) {',
    '      const data = await response.json();',
    '      this.token = data.token;',
    '      return true;',
    '    }',
    '    return false;',
    '  }',
    '}',
    '',
    'claude@work-123-a1:~/worktrees/work-123-a1/src$ npm test',
    '> Running test suite...',
    '',
    'PASS  src/auth.test.ts',
    '  ✓ should authenticate valid user (45ms)',
    '  ✓ should reject invalid credentials (12ms)',
    '  ✓ should handle network errors (8ms)',
    '',
    'Test Suites: 1 passed, 1 total',
    'Tests:       3 passed, 3 total',
    'Snapshots:   0 total',
    'Time:        2.451s',
    '',
    '✅ All tests passing! The authentication implementation looks good.',
    '',
    'I\'ve implemented the basic authentication service with proper error handling',
    'and comprehensive test coverage. The login flow now supports:',
    '',
    '1. Secure credential validation',
    '2. JWT token management', 
    '3. Network error handling',
    '4. Comprehensive test suite',
    '',
    'What would you like me to work on next? I could:',
    '- Add password reset functionality',
    '- Implement role-based permissions',
    '- Add two-factor authentication',
    '- Set up session management',
    '',
    'claude@work-123-a1:~/worktrees/work-123-a1/src$ █'
  ];

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
          <div className="flex-1 bg-black text-green-400 font-mono text-sm p-4 overflow-auto">
            {mockTerminalLines.map((line, index) => (
              <div key={index} className="min-h-[1.2em]">
                {line.includes('claude@') ? (
                  <span className="text-blue-400">{line}</span>
                ) : line.includes('✓') ? (
                  <span className="text-green-300">{line}</span>
                ) : line.includes('✅') ? (
                  <span className="text-green-300">{line}</span>
                ) : line.includes('PASS') ? (
                  <span className="text-green-300">{line}</span>
                ) : line.includes('█') ? (
                  <span>
                    {line.replace('█', '')}
                    <span className="animate-pulse bg-green-400 text-green-400">█</span>
                  </span>
                ) : (
                  line
                )}
              </div>
            ))}
          </div>
          
          {/* Terminal Input Area */}
          <div className="border-t bg-card p-2">
            <div className="text-xs text-muted-foreground text-center">
              Terminal session: {sessionName} | Click in terminal area to interact with Claude
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
                    <Terminal className="h-3 w-3 text-muted-foreground" />
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
                <h4 className="font-medium mb-2">Status</h4>
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    ✅ Claude is active and responding
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Last response: just now
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