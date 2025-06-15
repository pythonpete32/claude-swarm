# UI Component Architecture

This document defines the React component architecture for Claude Codex UI, including component hierarchy, data flow patterns, state management, and styling approach.

## Overview

The Claude Codex UI provides a web-based dashboard for managing multiple Claude Code agent instances. The frontend is built with React + TypeScript + Vite, emphasizing real-time updates, responsive design, and intuitive instance management.

## Architecture Principles

### Component Design Philosophy
- **Single Responsibility**: Each component has one clear purpose
- **Composition Over Inheritance**: Build complex UIs from simple, reusable components
- **Data Down, Events Up**: Props flow down, events bubble up
- **Container/Presentational Split**: Separate data logic from rendering logic

### State Management Strategy
- **Server State**: React Query for API data, caching, and real-time updates
- **UI State**: React useState for local component state
- **Global UI State**: Zustand for cross-component UI state (sidebar, modals, etc.)
- **Form State**: React Hook Form for complex forms

### Real-Time Update Pattern
```
WebSocket Connection → React Query Cache → Component Re-render
```

## Component Hierarchy

### Application Structure
```
App
├── Layout
│   ├── Header
│   │   ├── Logo
│   │   ├── Navigation
│   │   └── UserSettings
│   ├── Sidebar (collapsible)
│   │   ├── InstanceFilters
│   │   └── QuickActions
│   └── MainContent
│       ├── Dashboard (default route)
│       ├── KanbanBoard
│       ├── Settings
│       └── InstanceDetail
└── GlobalModals
    ├── CreateInstanceModal
    ├── ConfirmationModal
    └── SettingsModal
```

## Core Components

### 1. Dashboard Component

**Purpose**: Main instance management view with accordion-style instance cards

**Props Interface**:
```typescript
interface DashboardProps {
  filter: 'active' | 'inactive' | 'all';
  searchQuery?: string;
}
```

**Child Components**:
- `CreateInstanceForm` - Chat box for new instances
- `InstanceList` - Filtered and sorted instance cards
- `InstanceFilters` - Active/inactive/all toggles
- `InstanceStats` - Summary counts and metrics

**Data Dependencies**:
- `useInstances()` - All instance data from API
- `useGitHubIssues()` - Available issues for new instances
- `useWebSocket()` - Real-time instance updates

**State Management**:
- Local filter and search state
- Global sidebar collapse state (Zustand)

### 2. InstanceCard Component

**Purpose**: Accordion-style card displaying instance information and actions

**Props Interface**:
```typescript
interface InstanceCardProps {
  instance: Instance;
  isExpanded?: boolean;
  onToggleExpand: (instanceId: string) => void;
  onAction: (action: InstanceAction, instanceId: string) => void;
}

type InstanceAction = 'view' | 'review' | 'kill' | 'editor' | 'copy' | 'fork' | 'merge';
```

**Component Structure**:
```tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Play, Eye, Trash2 } from "lucide-react";

<Card className="border-l-4 border-l-green-500">
  <CardHeader>
    <Collapsible>
      <CollapsibleTrigger className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <Play className="h-4 w-4 text-green-500" />
          <h3 className="font-semibold">{instance.id}</h3>
          <Badge variant="default">Running</Badge>
        </div>
        <ChevronDown className="h-4 w-4" />
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <CardContent className="pt-4">
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Issue #{instance.issue_number}: {instance.issue_title}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="default">
                <Eye className="h-3 w-3 mr-1" /> View
              </Button>
              <Button size="sm" variant="outline">
                Review
              </Button>
              <Button size="sm" variant="destructive">
                <Trash2 className="h-3 w-3 mr-1" /> Kill
              </Button>
            </div>
          </div>
        </CardContent>
      </CollapsibleContent>
    </Collapsible>
  </CardHeader>
</Card>
```

**Data Dependencies**:
- Instance data (passed as prop)
- Related instances (for review chains)
- GitHub issue data (for context)

### 3. TerminalView Component

**Purpose**: Full-screen terminal interface with tmux session streaming

**Props Interface**:
```typescript
interface TerminalViewProps {
  instanceId: string;
  sessionName: string;
  onBack: () => void;
}
```

**Component Structure**:
```tsx
<TerminalView>
  <TerminalHeader>
    <BackButton onClick={onBack} />
    <InstanceBreadcrumb instanceId={instanceId} />
    <SidebarToggle />
  </TerminalHeader>
  
  <TerminalContainer>
    <TerminalOutput 
      websocketUrl={`/api/terminal/${sessionName}`}
      onInput={handleTerminalInput}
    />
    <CollapsibleSidebar>
      <InstanceActions instanceId={instanceId} />
      <InstanceMeta instanceId={instanceId} />
    </CollapsibleSidebar>
  </TerminalContainer>
</TerminalView>
```

**Data Dependencies**:
- WebSocket connection for terminal I/O
- Instance metadata for sidebar
- Real-time session status

### 4. CreateInstanceForm Component

**Purpose**: Chat box interface for launching new instances

**Props Interface**:
```typescript
interface CreateInstanceFormProps {
  onInstanceCreated: (instanceId: string) => void;
}
```

**Component Structure**:
```tsx
<CreateInstanceForm>
  <FormHeader>
    <Title>What do you want to work on?</Title>
  </FormHeader>
  
  <PromptInput>
    <TextArea 
      placeholder="Implement authentication for the login page..."
      value={prompt}
      onChange={setPrompt}
    />
  </PromptInput>
  
  <FormControls>
    <BranchSelector 
      branches={availableBranches}
      selected={selectedBranch}
      onChange={setSelectedBranch}
    />
    <IssueSelector 
      issues={availableIssues}
      selected={selectedIssue}
      onChange={setSelectedIssue}
    />
    <LaunchButton 
      onClick={handleLaunch}
      disabled={!prompt.trim()}
    />
  </FormControls>
</CreateInstanceForm>
```

**Data Dependencies**:
- `useGitHubIssues()` - Available issues
- `useGitBranches()` - Available branches
- `useCreateInstance()` - Mutation for instance creation

### 5. KanbanBoard Component

**Purpose**: GitHub Projects integration with drag-and-drop

**Props Interface**:
```typescript
interface KanbanBoardProps {
  projectId?: string;
}
```

**Component Structure**:
```tsx
<KanbanBoard>
  <BoardHeader>
    <ProjectSelector />
    <BoardFilters />
    <BoardSettings />
  </BoardHeader>
  
  <BoardColumns>
    {columns.map(column => (
      <KanbanColumn key={column.id}>
        <ColumnHeader title={column.name} count={column.items.length} />
        <DroppableArea columnId={column.id}>
          {column.items.map(item => (
            <IssueCard 
              key={item.id}
              issue={item}
              instances={getInstancesForIssue(item.number)}
            />
          ))}
        </DroppableArea>
      </KanbanColumn>
    ))}
  </BoardColumns>
</KanbanBoard>
```

**Data Dependencies**:
- `useGitHubProjects()` - Project data and structure
- `useInstances()` - Instance data for issue correlation
- Drag-and-drop state management

## Data Flow Architecture

### API Integration Pattern
```typescript
// Custom hooks for API integration
function useInstances() {
  return useQuery({
    queryKey: ['instances'],
    queryFn: () => api.getInstances(),
    refetchInterval: 5000, // Polling fallback
  });
}

function useInstanceWebSocket() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const ws = new WebSocket('/api/ws/instances');
    
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      queryClient.setQueryData(['instances'], (old) => 
        updateInstanceInList(old, update)
      );
    };
    
    return () => ws.close();
  }, [queryClient]);
}
```

### State Management Layers

**1. Server State (React Query)**:
```typescript
// Instance data, GitHub data, real-time updates
const instances = useInstances();
const issues = useGitHubIssues();
const createInstance = useCreateInstance();
```

**2. Global UI State (Zustand)**:
```typescript
interface UIStore {
  sidebarCollapsed: boolean;
  activeFilter: 'active' | 'inactive' | 'all';
  expandedInstances: Set<string>;
  toggleSidebar: () => void;
  setFilter: (filter: string) => void;
  toggleInstanceExpanded: (id: string) => void;
}
```

**3. Local Component State (useState)**:
```typescript
// Form inputs, temporary UI state, component-specific state
const [prompt, setPrompt] = useState('');
const [selectedIssue, setSelectedIssue] = useState<number | null>(null);
```

### Event Flow Patterns

**Instance Action Flow**:
```
User Click → Component Handler → API Call → Optimistic Update → Server Response → Cache Update → UI Re-render
```

**Real-Time Update Flow**:
```
MCP Tool Call → Database Update → WebSocket Event → React Query Cache → Component Re-render
```

## Styling Architecture

### Design System Approach
- **ShadCN/UI**: Pre-built component library using "new-york" style
- **Tailwind CSS**: Utility-first CSS framework for custom styling
- **CSS Variables**: ShadCN's built-in theme system with CSS custom properties
- **Dark/Light Mode**: Built-in theme switching via `next-themes`

### Existing ShadCN Configuration
```json
{
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/App.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide"
}
```

### Component Styling Pattern
```typescript
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const InstanceCard = ({ instance, isExpanded, className, ...props }) => {
  return (
    <Card 
      className={cn(
        "border-l-4 transition-all duration-200",
        instance.status === 'running' 
          ? "border-l-green-500" 
          : "border-l-gray-300",
        isExpanded && "shadow-md",
        className
      )}
      {...props}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{instance.id}</h3>
          <Badge variant={instance.status === 'running' ? 'default' : 'secondary'}>
            {instance.status}
          </Badge>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          {/* Instance details */}
        </CardContent>
      )}
    </Card>
  );
};
```

## Responsive Design Strategy

### Breakpoint Strategy
- **Mobile First**: Base styles for mobile, enhance for larger screens
- **Breakpoints**: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px)
- **Component Adaptation**: Components adapt layout and functionality by screen size

### Mobile Adaptations
- **Dashboard**: Single column layout, simplified instance cards
- **Terminal**: Full-screen only, swipe gestures for sidebar
- **Kanban**: Horizontal scroll, touch-friendly drag-and-drop
- **Forms**: Stack controls vertically, larger touch targets

## Performance Considerations

### Optimization Strategies
- **Code Splitting**: Route-based and component-based lazy loading
- **Virtualization**: Large lists (instance lists, terminal output)
- **Memoization**: React.memo for expensive renders, useMemo for calculations
- **Debouncing**: Search inputs and filter changes

### Bundle Optimization
```typescript
// Route-based code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const KanbanBoard = lazy(() => import('./pages/KanbanBoard'));

// Component lazy loading for modals
const CreateInstanceModal = lazy(() => import('./modals/CreateInstanceModal'));
```

## Testing Strategy

### Component Testing Approach
- **Unit Tests**: Individual component logic and rendering
- **Integration Tests**: Component interactions and data flow
- **Visual Tests**: Component appearance and responsive behavior
- **User Experience Tests**: Complete user workflows

### Testing Tools
- **Vitest**: Test runner and assertions
- **React Testing Library**: Component testing utilities
- **MSW**: API mocking for isolated tests
- **Playwright**: End-to-end testing

### Test Patterns
```typescript
// Component unit test example
test('InstanceCard displays correct status', () => {
  const instance = createMockInstance({ status: 'running' });
  render(<InstanceCard instance={instance} />);
  
  expect(screen.getByText('Running')).toBeInTheDocument();
  expect(screen.getByTestId('status-indicator')).toHaveClass('status-running');
});

// Integration test example
test('Dashboard filters instances correctly', async () => {
  const instances = [
    createMockInstance({ status: 'running' }),
    createMockInstance({ status: 'terminated' })
  ];
  
  mockApiResponse('/api/instances', instances);
  render(<Dashboard />);
  
  fireEvent.click(screen.getByText('Active'));
  expect(screen.getAllByTestId('instance-card')).toHaveLength(1);
});
```

## Development Workflow

### File Organization
```
src/
├── components/
│   ├── common/          # Reusable UI components
│   ├── dashboard/       # Dashboard-specific components
│   ├── terminal/        # Terminal-specific components
│   └── kanban/          # Kanban-specific components
├── pages/               # Route components
├── hooks/               # Custom React hooks
├── stores/              # Zustand stores
├── api/                 # API client and React Query setup
├── styles/              # Theme and global styles
├── types/               # TypeScript type definitions
└── utils/               # Helper functions
```

### Component Development Guidelines
- **TypeScript First**: All components fully typed
- **Props Interface**: Explicit interface for all props
- **Default Props**: Use defaultProps for optional props
- **Error Boundaries**: Wrap route components in error boundaries
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support

---

*This UI Component Architecture provides the foundation for building a responsive, real-time dashboard that effectively manages Claude Code agent instances while maintaining excellent user experience and code quality.*