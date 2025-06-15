import { useState } from "react";
import { MOCK_INSTANCES } from "../../types/instance";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { CreateInstanceForm } from "./CreateInstanceForm";
import { InstanceCard } from "./InstanceCard";
// import type { Instance } from '@/types/instance';

interface DashboardProps {
  filter?: "active" | "inactive" | "all";
  searchQuery?: string;
  onInstanceAction?: (action: string, instanceId: string) => void;
}

export function Dashboard({ filter = "all", searchQuery = "", onInstanceAction }: DashboardProps) {
  const [activeFilter, setActiveFilter] = useState<"active" | "inactive" | "all">(filter);
  const [expandedInstances, setExpandedInstances] = useState<Set<string>>(new Set());

  // Filter instances based on status and search
  const filteredInstances = MOCK_INSTANCES.filter((instance) => {
    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "active" && instance.status === "running") ||
      (activeFilter === "inactive" && instance.status === "terminated");

    const matchesSearch =
      searchQuery === "" ||
      instance.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      instance.issue_title?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const activeCounts = {
    active: MOCK_INSTANCES.filter((i) => i.status === "running").length,
    inactive: MOCK_INSTANCES.filter((i) => i.status === "terminated").length,
    all: MOCK_INSTANCES.length,
  };

  const handleToggleExpand = (instanceId: string) => {
    setExpandedInstances((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(instanceId)) {
        newSet.delete(instanceId);
      } else {
        newSet.add(instanceId);
      }
      return newSet;
    });
  };

  const handleInstanceAction = (action: string, instanceId: string) => {
    if (onInstanceAction) {
      onInstanceAction(action, instanceId);
    } else {
      console.log(`Action ${action} on instance ${instanceId}`);
    }
  };

  const handleInstanceCreated = (instanceId: string) => {
    console.log(`New instance created: ${instanceId}`);
    // Mock creation - just log for now
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Claude Codex</h1>
          <p className="text-muted-foreground">Manage your Claude Code agent instances</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            📋 Kanban
          </Button>
          <Button variant="outline" size="sm">
            ⚙️ Settings
          </Button>
        </div>
      </div>

      {/* Create Instance Form */}
      <CreateInstanceForm onInstanceCreated={handleInstanceCreated} />

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          <Button
            variant={activeFilter === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter("active")}
          >
            Active ({activeCounts.active})
          </Button>
          <Button
            variant={activeFilter === "inactive" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter("inactive")}
          >
            Inactive ({activeCounts.inactive})
          </Button>
          <Button
            variant={activeFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter("all")}
          >
            All ({activeCounts.all})
          </Button>
        </div>
      </div>

      {/* Instance List */}
      <div className="space-y-3">
        {filteredInstances.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <div className="text-center text-muted-foreground">
                <p>No instances found</p>
                <p className="text-sm">Create a new instance to get started</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredInstances.map((instance) => (
            <InstanceCard
              key={instance.id}
              instance={instance}
              isExpanded={expandedInstances.has(instance.id)}
              onToggleExpand={handleToggleExpand}
              onAction={handleInstanceAction}
            />
          ))
        )}
      </div>
    </div>
  );
}
