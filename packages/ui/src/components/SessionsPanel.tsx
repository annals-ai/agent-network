import type { AgentRecord, SessionRecord, SessionStatus, TaskRecord } from '../api';
import { Funnel, History, Layers3 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

interface SessionFilters {
  agentId: string;
  taskGroupId: string;
  status: SessionStatus | 'all';
}

interface SessionsPanelProps {
  agents: AgentRecord[];
  tasks: TaskRecord[];
  sessions: SessionRecord[];
  filters: SessionFilters;
  selectedSessionId: string | null;
  onFiltersChange(filters: SessionFilters): void;
  onSelectSession(sessionId: string): void;
}

const STATUS_OPTIONS: Array<SessionStatus | 'all'> = [
  'all',
  'active',
  'idle',
  'paused',
  'queued',
  'completed',
  'failed',
  'archived',
];

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

export function SessionsPanel({
  agents,
  tasks,
  sessions,
  filters,
  selectedSessionId,
  onFiltersChange,
  onSelectSession,
}: SessionsPanelProps) {
  return (
    <Card id="sessions">
      <CardHeader>
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">Sessions</p>
        <CardTitle>Live desk</CardTitle>
        <CardDescription>Filter by agent, task group, or lifecycle state without losing your selected session.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-2">
            <span className="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em]">
              <Funnel className="size-3.5" />
              Agent
            </span>
            <Select value={filters.agentId} onValueChange={(agentId) => onFiltersChange({ ...filters, agentId })}>
              <SelectTrigger>
                <SelectValue placeholder="All agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="grid gap-2">
            <span className="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em]">
              <Layers3 className="size-3.5" />
              Task group
            </span>
            <Select
              value={filters.taskGroupId}
              onValueChange={(taskGroupId) => onFiltersChange({ ...filters, taskGroupId })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All task groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All task groups</SelectItem>
                {tasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="grid gap-2">
            <span className="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em]">
              <History className="size-3.5" />
              Status
            </span>
            <Select
              value={filters.status}
              onValueChange={(status) => onFiltersChange({ ...filters, status: status as SessionFilters['status'] })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        {sessions.length === 0 ? (
          <EmptyState
            title="No sessions match the current filters"
            description="Try another agent, task group, or lifecycle slice to reveal matching sessions."
          />
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const active = selectedSessionId === session.id;

              return (
                <button
                  key={session.id}
                  type="button"
                  className={cn(
                    'w-full rounded-xl border p-4 text-left transition-colors',
                    active ? 'border-primary bg-accent/40 shadow-sm' : 'bg-background hover:bg-accent/35',
                  )}
                  onClick={() => onSelectSession(session.id)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{session.title ?? 'Untitled session'}</p>
                      <p className="text-muted-foreground text-sm">{session.agent?.name ?? session.agentId}</p>
                    </div>
                    <StatusBadge value={session.status} />
                  </div>

                  <p className="mt-3 text-sm leading-6">{session.summary ?? `${session.origin} · ${session.principalType}`}</p>

                  <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-3 text-xs">
                    <span>{formatTimestamp(session.lastActiveAt)}</span>
                    <span>{session.taskGroupId ? 'Task linked' : 'Standalone'}</span>
                    <span>{session.tags.length} tags</span>
                  </div>

                  {session.tags.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {session.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="rounded-full font-normal">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
