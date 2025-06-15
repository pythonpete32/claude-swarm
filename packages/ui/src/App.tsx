import { Kanban, LayoutDashboard, Moon, Settings as SettingsIcon, Sun } from "lucide-react";
import { useState } from "react";
import { Dashboard } from "./components/dashboard/Dashboard";
import { KanbanBoard } from "./components/kanban/KanbanBoard";
import { TerminalView } from "./components/terminal/TerminalView";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";

type AppView = "dashboard" | "terminal" | "kanban" | "settings";

interface TerminalViewState {
  instanceId: string;
  sessionName: string;
}

function App() {
  const [currentView, setCurrentView] = useState<AppView>("dashboard");
  const [terminalState, setTerminalState] = useState<TerminalViewState | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const handleViewInstance = (instanceId: string) => {
    setTerminalState({
      instanceId,
      sessionName: instanceId, // Mock: using instanceId as session name
    });
    setCurrentView("terminal");
  };

  const handleBackToDashboard = () => {
    setCurrentView("dashboard");
    setTerminalState(null);
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle("dark");
  };

  const renderNavigation = () => (
    <nav className="border-b bg-card">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-1">
            <Button
              variant={currentView === "dashboard" ? "default" : "ghost"}
              size="sm"
              onClick={() => setCurrentView("dashboard")}
              className="gap-2"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
            <Button
              variant={currentView === "kanban" ? "default" : "ghost"}
              size="sm"
              onClick={() => setCurrentView("kanban")}
              className="gap-2"
            >
              <Kanban className="h-4 w-4" />
              Kanban
            </Button>
            <Button
              variant={currentView === "settings" ? "default" : "ghost"}
              size="sm"
              onClick={() => setCurrentView("settings")}
              className="gap-2"
            >
              <SettingsIcon className="h-4 w-4" />
              Settings
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleTheme}>
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );

  const renderSettings = () => (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your Claude Codex preferences</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>GitHub Integration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">GitHub Token</label>
              <input
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                className="w-full mt-1 px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Default Repository</label>
              <input
                type="text"
                placeholder="owner/repository"
                className="w-full mt-1 px-3 py-2 border rounded-md"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Editor Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Default Editor</label>
              <select className="w-full mt-1 px-3 py-2 border rounded-md">
                <option>VS Code</option>
                <option>Cursor</option>
                <option>Vim</option>
                <option>Emacs</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Terminal Theme</label>
              <select className="w-full mt-1 px-3 py-2 border rounded-md">
                <option>Dark</option>
                <option>Light</option>
                <option>High Contrast</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instance Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Cleanup Policy</label>
              <select className="w-full mt-1 px-3 py-2 border rounded-md">
                <option>Manual</option>
                <option>Auto (7 days)</option>
                <option>Auto (30 days)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Worktree Base Path</label>
              <input
                type="text"
                placeholder="./worktrees"
                className="w-full mt-1 px-3 py-2 border rounded-md"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Instance Status Updates</label>
              <input type="checkbox" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">MCP Tool Notifications</label>
              <input type="checkbox" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">GitHub Sync Alerts</label>
              <input type="checkbox" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderCurrentView = () => {
    if (currentView === "terminal" && terminalState) {
      return (
        <TerminalView
          instanceId={terminalState.instanceId}
          sessionName={terminalState.sessionName}
          onBack={handleBackToDashboard}
        />
      );
    }

    return (
      <>
        {renderNavigation()}
        <main className="flex-1">
          {currentView === "dashboard" && (
            <Dashboard
              onInstanceAction={(action, instanceId) => {
                if (action === "view") {
                  handleViewInstance(instanceId);
                } else {
                  console.log(`Action ${action} on instance ${instanceId}`);
                }
              }}
            />
          )}
          {currentView === "kanban" && <KanbanBoard />}
          {currentView === "settings" && renderSettings()}
        </main>
      </>
    );
  };

  return (
    <div className={`min-h-screen bg-background text-foreground ${isDarkMode ? "dark" : ""}`}>
      <div className="flex flex-col min-h-screen">{renderCurrentView()}</div>
    </div>
  );
}

export default App;
