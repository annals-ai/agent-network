import type { AgentRecord } from '../api';
import { Bot, FolderTree, Lock, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

interface AgentsPanelProps {
  agents: AgentRecord[];
  selectedAgentId: string;
  onSelectAgent(agentId: string): void;
}

export function AgentsPanel({ agents, selectedAgentId, onSelectAgent }: AgentsPanelProps) {
  return (
    <Card id="agents" className="h-full">
      <CardHeader>
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">Agents</p>
        <CardTitle>Runtime roster</CardTitle>
        <CardDescription>Click any agent to filter the session desk without losing the current dashboard snapshot.</CardDescription>
      </CardHeader>

      <CardContent>
        {agents.length === 0 ? (
          <EmptyState
            title="No local agents registered"
            description="Once a local agent is registered with the daemon, it will appear here with visibility and runtime details."
            icon={<Bot className="size-5" />}
          />
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => {
              const active = selectedAgentId === agent.id;

              return (
                <button
                  key={agent.id}
                  type="button"
                  className={cn(
                    'w-full rounded-xl border p-4 text-left transition-colors',
                    active ? 'border-primary bg-accent/40 shadow-sm' : 'bg-background hover:bg-accent/35',
                  )}
                  onClick={() => onSelectAgent(active ? 'all' : agent.id)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{agent.name}</p>
                        <StatusBadge value={agent.visibility} />
                      </div>
                      <p className="text-muted-foreground text-sm">@{agent.slug}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="rounded-full">
                        {agent.runtimeType}
                      </Badge>
                      <Badge variant="outline" className="rounded-full">
                        {agent.sessionCount} sessions
                      </Badge>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-6">{agent.description ?? agent.projectPath}</p>

                  <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5" />
                      {agent.sandbox ? 'Sandbox on' : 'Sandbox off'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <FolderTree className="size-3.5" />
                      {agent.projectPath}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Lock className="size-3.5" />
                      {agent.bindings.length} provider bindings
                    </span>
                  </div>

                  {agent.capabilities.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {agent.capabilities.slice(0, 6).map((capability) => (
                        <Badge key={capability} variant="outline" className="rounded-full font-normal">
                          {capability}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  <p className="text-muted-foreground mt-4 text-xs">
                    {agent.bindings.length > 0
                      ? agent.bindings.map((binding) => `${binding.provider}:${binding.status}`).join(' · ')
                      : 'No provider exposure configured yet.'}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
