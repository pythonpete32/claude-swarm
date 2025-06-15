import { Bug, GitBranch as GitBranchIcon, Rocket } from "lucide-react";
import { useState } from "react";
import { MOCK_BRANCHES, MOCK_ISSUES } from "../../types/instance";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";

interface CreateInstanceFormProps {
  onInstanceCreated: (instanceId: string) => void;
}

export function CreateInstanceForm({ onInstanceCreated }: CreateInstanceFormProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("main");
  const [selectedIssue, setSelectedIssue] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const selectedIssueData = MOCK_ISSUES.find((issue) => issue.number === selectedIssue);

  const handleLaunch = async () => {
    if (!prompt.trim()) return;

    setIsCreating(true);

    // Mock creation delay
    setTimeout(() => {
      const instanceId = selectedIssue
        ? `work-${selectedIssue}-a1`
        : `adhoc-a${Math.floor(Math.random() * 10) + 1}`;

      onInstanceCreated(instanceId);

      // Reset form
      setPrompt("");
      setSelectedIssue(null);
      setIsCreating(false);
    }, 1500);
  };

  const getLabelBadgeColor = (label: string) => {
    if (label.includes("bug") || label.includes("priority-high")) return "destructive";
    if (label.includes("feature") || label.includes("priority-medium")) return "default";
    if (label.includes("enhancement") || label.includes("priority-low")) return "secondary";
    return "outline";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>💬</span>
          Launch New Instance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Prompt Input */}
        <div className="space-y-2">
          <label htmlFor="prompt-input" className="text-sm font-medium">What do you want to work on?</label>
          <Textarea
            id="prompt-input"
            placeholder="Implement authentication for the login page..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[100px] resize-none"
          />
        </div>

        {/* Form Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Branch Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1">
              <GitBranchIcon className="h-3 w-3" />
              Branch
            </label>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOCK_BRANCHES.map((branch) => (
                  <SelectItem key={branch.name} value={branch.name}>
                    <div className="flex items-center gap-2">
                      <span>{branch.name}</span>
                      {branch.current && (
                        <Badge variant="outline" className="text-xs">
                          current
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Issue Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1">
              <Bug className="h-3 w-3" />
              Issue (Optional)
            </label>
            <Select
              value={selectedIssue?.toString() || "none"}
              onValueChange={(value) =>
                setSelectedIssue(value === "none" ? null : Number.parseInt(value))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select issue..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No issue</SelectItem>
                {MOCK_ISSUES.map((issue) => (
                  <SelectItem key={issue.number} value={issue.number.toString()}>
                    <div className="flex flex-col items-start">
                      <span>
                        #{issue.number} - {issue.title}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Launch Button */}
          <div className="space-y-2">
            <label className="text-sm font-medium opacity-0">Launch</label>
            <Button
              onClick={handleLaunch}
              disabled={!prompt.trim() || isCreating}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  Start
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Selected Issue Info */}
        {selectedIssueData && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-100">
                  Issue #{selectedIssueData.number}: {selectedIssueData.title}
                </h4>
                {selectedIssueData.body && (
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    {selectedIssueData.body}
                  </p>
                )}
              </div>
            </div>
            {selectedIssueData.labels.length > 0 && (
              <div className="flex gap-1 mt-2">
                {selectedIssueData.labels.map((label) => (
                  <Badge key={label} variant={getLabelBadgeColor(label)} className="text-xs">
                    {label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Help Text */}
        <div className="text-xs text-muted-foreground">
          <p>
            This will create a new Git worktree, tmux session, and Claude agent.
            {selectedIssue
              ? " The agent will have context about the selected issue."
              : " Without an issue, this will be an adhoc session."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
