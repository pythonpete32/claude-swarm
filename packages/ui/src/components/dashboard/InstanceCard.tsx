import { Card, CardContent, CardHeader } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { ChevronDown, Play, Square, Eye, GitBranch as GitBranchIcon, Trash2, FileEdit, Copy, GitMerge, GitFork } from 'lucide-react';
import type { Instance, InstanceAction } from '@/types/instance';

interface InstanceCardProps {
  instance: Instance;
  isExpanded?: boolean;
  onToggleExpand: (instanceId: string) => void;
  onAction: (action: InstanceAction, instanceId: string) => void;
}

export function InstanceCard({ 
  instance, 
  isExpanded = false, 
  onToggleExpand, 
  onAction 
}: InstanceCardProps) {
  const isRunning = instance.status === 'running';
  
  const getStatusIcon = () => {
    return isRunning ? (
      <Play className="h-4 w-4 text-green-500" />
    ) : (
      <Square className="h-4 w-4 text-gray-400" />
    );
  };

  const getStatusColor = () => {
    return isRunning ? 'border-l-green-500' : 'border-l-gray-300';
  };

  const getTypeIcon = () => {
    switch (instance.type) {
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

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes}m ago`;
    } else {
      return 'just now';
    }
  };

  return (
    <Card className={`border-l-4 transition-all duration-200 ${getStatusColor()} ${isExpanded ? 'shadow-md' : ''}`}>
      <Collapsible open={isExpanded} onOpenChange={() => onToggleExpand(instance.id)}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                {getStatusIcon()}
                <span className="text-lg">{getTypeIcon()}</span>
                <div className="flex flex-col items-start">
                  <h3 className="font-semibold text-left">{instance.id}</h3>
                  {instance.issue_number && instance.issue_title && (
                    <p className="text-sm text-muted-foreground">
                      Issue #{instance.issue_number}: {instance.issue_title}
                    </p>
                  )}
                  {instance.prompt && !instance.issue_number && (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {instance.prompt}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={isRunning ? 'default' : 'secondary'}>
                  {isRunning ? 'Running' : 'Terminated'}
                </Badge>
                <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-4">
              {/* Instance Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <GitBranchIcon className="h-3 w-3" />
                    <span>Branch:</span>
                  </div>
                  <p className="font-mono">{instance.branch_name}</p>
                </div>
                <div>
                  <div className="text-muted-foreground">Started:</div>
                  <p>{formatTimeAgo(instance.created_at)}</p>
                </div>
                <div>
                  <div className="text-muted-foreground">Agent:</div>
                  <p>Agent {instance.agent_number}</p>
                </div>
                <div>
                  <div className="text-muted-foreground">Session:</div>
                  <p className="font-mono text-xs">{instance.tmux_session}</p>
                </div>
              </div>

              {/* Status Information */}
              {isRunning && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    ✅ Instance is running and ready for interaction
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Last activity: 5min ago
                  </p>
                </div>
              )}

              {instance.status === 'terminated' && instance.terminated_at && (
                <div className="p-3 bg-gray-50 dark:bg-gray-900/20 rounded-md">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    ⏹️ Instance terminated {formatTimeAgo(instance.terminated_at)}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <Button 
                  size="sm" 
                  variant="default"
                  onClick={() => onAction('view', instance.id)}
                >
                  <Eye className="h-3 w-3 mr-1" /> 
                  View
                </Button>
                
                {instance.type === 'work' && isRunning && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onAction('review', instance.id)}
                  >
                    🔬 Review
                  </Button>
                )}
                
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onAction('editor', instance.id)}
                >
                  <FileEdit className="h-3 w-3 mr-1" /> 
                  Editor
                </Button>
                
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onAction('copy', instance.id)}
                >
                  <Copy className="h-3 w-3 mr-1" /> 
                  Copy
                </Button>

                {instance.type === 'work' && isRunning && (
                  <>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onAction('fork', instance.id)}
                    >
                      <GitFork className="h-3 w-3 mr-1" /> 
                      Fork
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onAction('merge', instance.id)}
                    >
                      <GitMerge className="h-3 w-3 mr-1" /> 
                      Merge
                    </Button>
                  </>
                )}
                
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => onAction('kill', instance.id)}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> 
                  Kill
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}