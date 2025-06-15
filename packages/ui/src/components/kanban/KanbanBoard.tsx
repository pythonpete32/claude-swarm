import type { GitHubIssue, Instance } from "@/types/instance";
import { Calendar, Filter, Play, Plus, Search, Settings, Square } from "lucide-react";
import { useState } from "react";
import { MOCK_INSTANCES, MOCK_ISSUES } from "../../types/instance";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

interface KanbanBoardProps {
  projectId?: string;
}

interface KanbanColumn {
  id: string;
  name: string;
  items: GitHubIssue[];
}

export function KanbanBoard({ projectId }: KanbanBoardProps) {
  const [selectedProject, setSelectedProject] = useState(projectId || "main-project");
  const [searchQuery, setSearchQuery] = useState("");

  // Mock project data
  const mockProjects = [
    { id: "main-project", name: "Main Project Board" },
    { id: "feature-board", name: "Feature Development" },
    { id: "bug-fixes", name: "Bug Fixes & Maintenance" },
  ];

  // Mock columns with issues
  const mockColumns: KanbanColumn[] = [
    {
      id: "todo",
      name: "To Do",
      items: [
        {
          ...MOCK_ISSUES[2],
          number: 789,
          title: "Improve mobile responsiveness",
          labels: ["enhancement", "priority-low"],
        },
        {
          number: 101,
          title: "Add user profile page",
          body: "Users need a dedicated profile page to manage their account settings",
          state: "open",
          labels: ["feature", "priority-medium"],
          created_at: "2024-01-14T15:30:00Z",
          updated_at: "2024-01-14T15:30:00Z",
        },
      ],
    },
    {
      id: "in-progress",
      name: "In Progress",
      items: [
        MOCK_ISSUES[0], // Issue #123 - Fix authentication system
        MOCK_ISSUES[1], // Issue #456 - Add dark mode toggle
      ],
    },
    {
      id: "review",
      name: "In Review",
      items: [
        {
          number: 98,
          title: "Optimize database queries",
          body: "Several queries are slow and need optimization",
          state: "open",
          labels: ["performance", "priority-high"],
          created_at: "2024-01-13T11:20:00Z",
          updated_at: "2024-01-15T09:45:00Z",
        },
      ],
    },
    {
      id: "done",
      name: "Done",
      items: [
        {
          number: 87,
          title: "Fix header navigation bug",
          body: "Navigation links not working on mobile",
          state: "closed",
          labels: ["bug", "priority-medium"],
          created_at: "2024-01-12T14:15:00Z",
          updated_at: "2024-01-15T10:30:00Z",
        },
      ],
    },
  ];

  const getInstancesForIssue = (issueNumber: number): Instance[] => {
    return MOCK_INSTANCES.filter((instance) => instance.issue_number === issueNumber);
  };

  const getLabelBadgeColor = (label: string) => {
    if (label.includes("bug") || label.includes("priority-high")) return "destructive";
    if (label.includes("feature") || label.includes("priority-medium")) return "default";
    if (label.includes("enhancement") || label.includes("priority-low")) return "secondary";
    return "outline";
  };

  const getColumnColor = (columnId: string) => {
    switch (columnId) {
      case "todo":
        return "border-t-gray-400";
      case "in-progress":
        return "border-t-blue-400";
      case "review":
        return "border-t-orange-400";
      case "done":
        return "border-t-green-400";
      default:
        return "border-t-gray-400";
    }
  };

  const IssueCard = ({ issue }: { issue: GitHubIssue }) => {
    const instances = getInstancesForIssue(issue.number);
    const runningInstances = instances.filter((i) => i.status === "running");

    return (
      <Card className="cursor-pointer hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="text-sm font-medium">#{issue.number}</div>
              <h4 className="text-sm font-medium leading-tight mt-1">{issue.title}</h4>
            </div>
            {instances.length > 0 && (
              <div className="flex items-center gap-1 ml-2">
                {runningInstances.length > 0 ? (
                  <Play className="h-3 w-3 text-green-500" />
                ) : (
                  <Square className="h-3 w-3 text-gray-400" />
                )}
                <span className="text-xs text-muted-foreground">{instances.length}</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {issue.body && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{issue.body}</p>
          )}

          {/* Labels */}
          {issue.labels.length > 0 && (
            <div className="flex gap-1 flex-wrap mb-3">
              {issue.labels.map((label) => (
                <Badge key={label} variant={getLabelBadgeColor(label)} className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          )}

          {/* Instances */}
          {instances.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Active Instances:</div>
              {instances.map((instance) => (
                <div key={instance.id} className="flex items-center gap-2 text-xs">
                  {instance.status === "running" ? (
                    <Play className="h-2 w-2 text-green-500" />
                  ) : (
                    <Square className="h-2 w-2 text-gray-400" />
                  )}
                  <span className="font-mono">{instance.id}</span>
                  <Badge
                    variant={instance.status === "running" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {instance.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{new Date(issue.updated_at).toLocaleDateString()}</span>
            </div>
            {instances.length === 0 && (
              <Button size="sm" variant="outline" className="h-6 text-xs">
                <Plus className="h-2 w-2 mr-1" />
                Start
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Project Board</h1>
          <p className="text-muted-foreground">GitHub Projects integration</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search issues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {mockProjects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {mockColumns.map((column) => (
          <div key={column.id} className="space-y-4">
            {/* Column Header */}
            <Card className={`border-t-4 ${getColumnColor(column.id)}`}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>{column.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {column.items.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
            </Card>

            {/* Column Items */}
            <div className="space-y-3">
              {column.items
                .filter(
                  (item) =>
                    searchQuery === "" ||
                    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.number.toString().includes(searchQuery),
                )
                .map((issue) => (
                  <IssueCard key={issue.number} issue={issue} />
                ))}
            </div>

            {/* Add Item Button */}
            <Card className="border-dashed border-2 hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="flex items-center justify-center py-4">
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <Plus className="h-4 w-4 mr-2" />
                  Add issue
                </Button>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
