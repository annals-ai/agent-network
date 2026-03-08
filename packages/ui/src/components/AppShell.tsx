import type { ReactNode } from 'react';
import { Activity, Globe2, RefreshCw, Server } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AppShellProps {
  uiBaseUrl: string | null;
  startedAt: string;
  refreshing: boolean;
  onRefresh(): void;
  children: ReactNode;
}

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'agents', label: 'Agents' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'transcript', label: 'Transcript' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'exposure', label: 'Exposure' },
  { id: 'logs', label: 'Logs' },
];

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

export function AppShell({ uiBaseUrl, startedAt, refreshing, onRefresh, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto grid w-full max-w-[1680px] gap-6 px-4 py-4 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:px-6 lg:py-6">
        <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
          <Card className="h-full overflow-hidden">
            <CardContent className="flex h-full flex-col gap-6 p-5">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  <Activity className="size-3.5" />
                  Local Console
                </div>

                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-tight">Agent Mesh</h1>
                  <p className="text-muted-foreground text-sm leading-6">
                    A local operations desk for daemon health, registered agents, session history, provider exposure,
                    and recent runtime activity.
                  </p>
                </div>
              </div>

              <nav aria-label="Sections" className="grid gap-1">
                {NAV_ITEMS.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors"
                  >
                    <span>{item.label}</span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">Jump</span>
                  </a>
                ))}
              </nav>

              <Button className="mt-auto w-full justify-center gap-2" onClick={onRefresh} disabled={refreshing}>
                <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
                {refreshing ? 'Refreshing snapshot...' : 'Refresh snapshot'}
              </Button>

              <div className="grid gap-3">
                <div className="rounded-xl border bg-muted/35 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    <Globe2 className="size-3.5" />
                    UI origin
                  </div>
                  <p className="break-all text-sm font-medium">{uiBaseUrl ?? 'offline'}</p>
                </div>

                <div className="rounded-xl border bg-muted/35 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    <Server className="size-3.5" />
                    Daemon start
                  </div>
                  <p className="text-sm font-medium">{formatTimestamp(startedAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        <main className="flex min-w-0 flex-col gap-6">{children}</main>
      </div>
    </div>
  );
}
