import type { DaemonStatusResponse } from '../api';
import { Activity, Boxes, Cable, Clock3, Gauge, Globe2, Link2, Radar } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface OverviewPanelProps {
  status: DaemonStatusResponse;
}

const RUNTIME_METRICS: Array<{
  label: string;
  value: (status: DaemonStatusResponse) => number;
  detail: (status: DaemonStatusResponse) => string;
}> = [
  {
    label: 'Agents',
    value: (status) => status.counts.agents,
    detail: () => 'Tracked in the local daemon registry',
  },
  {
    label: 'Sessions',
    value: (status) => status.counts.sessions,
    detail: () => 'Full transcript history stays local',
  },
  {
    label: 'Task groups',
    value: (status) => status.counts.taskGroups,
    detail: () => 'Cross-agent bundles and workstreams',
  },
  {
    label: 'Provider bindings',
    value: (status) => status.counts.providerBindings,
    detail: () => 'Exposure points and gateway sync state',
  },
];

function formatDuration(milliseconds: number): string {
  const minutes = Math.round(milliseconds / 60_000);
  if (minutes < 60) {
    return `${minutes} min queue window`;
  }
  const hours = Math.round(minutes / 60);
  return `${hours} hr queue window`;
}

export function OverviewPanel({ status }: OverviewPanelProps) {
  return (
    <Card id="overview">
      <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">Overview</p>
          <CardTitle className="text-2xl">Daemon pressure and local history at a glance</CardTitle>
          <CardDescription>
            Keep the UI endpoint, queue pressure, and runtime activity visible while you inspect the local registry.
          </CardDescription>
        </div>

        <div className="grid min-w-0 gap-3 md:min-w-64">
          <div className="rounded-xl border bg-muted/35 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              <Globe2 className="size-3.5" />
              UI endpoint
            </div>
            <p className="text-sm font-medium">Port {status.daemon.uiPort ?? 'n/a'}</p>
            <p className="text-muted-foreground break-all text-xs">{status.daemon.uiBaseUrl ?? 'offline'}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {RUNTIME_METRICS.map((metric) => (
            <article key={metric.label} className="rounded-xl border bg-muted/25 p-4">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">{metric.label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">{metric.value(status)}</p>
              <p className="text-muted-foreground mt-2 text-sm leading-6">{metric.detail(status)}</p>
            </article>
          ))}
        </div>

        <Separator />

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border bg-background p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Gauge className="text-muted-foreground size-4" />
              Queue load
            </div>
            <p className="text-2xl font-semibold tracking-tight">{status.runtime.queue.active} active</p>
            <p className="text-muted-foreground mt-1 text-sm">{status.runtime.queue.queued} queued</p>
          </article>

          <article className="rounded-xl border bg-background p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Radar className="text-muted-foreground size-4" />
              Managed sessions
            </div>
            <p className="text-2xl font-semibold tracking-tight">{status.runtime.managedSessions}</p>
            <p className="text-muted-foreground mt-1 text-sm">{status.runtime.activeExecutions} currently streaming</p>
          </article>

          <article className="rounded-xl border bg-background p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Clock3 className="text-muted-foreground size-4" />
              Concurrency budget
            </div>
            <p className="text-2xl font-semibold tracking-tight">{status.runtime.queue.config.maxActiveRequests}</p>
            <p className="text-muted-foreground mt-1 text-sm">{formatDuration(status.runtime.queue.config.queueWaitTimeoutMs)}</p>
          </article>
        </div>

        <div className="grid gap-3 rounded-xl border bg-muted/25 p-4 md:grid-cols-4">
          <div className="flex items-center gap-2 text-sm">
            <Boxes className="text-muted-foreground size-4" />
            <span>{status.counts.agents} tracked agents</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Cable className="text-muted-foreground size-4" />
            <span>{status.counts.providerBindings} provider bindings</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Activity className="text-muted-foreground size-4" />
            <span>{status.runtime.activeExecutions} active executions</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link2 className="text-muted-foreground size-4" />
            <span>{status.counts.taskGroups} task groups</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
