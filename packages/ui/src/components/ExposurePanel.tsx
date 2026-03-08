import type { ProviderRecord } from '../api';
import { ExternalLink, Globe2, PlugZap } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';

function visibleUrls(config: Record<string, unknown>): Array<{ key: string; value: string }> {
  return Object.entries(config)
    .filter(([, value]) => typeof value === 'string')
    .filter(([key, value]) => key.toLowerCase().includes('url') || String(value).startsWith('http'))
    .map(([key, value]) => ({ key, value: String(value) }));
}

export function ExposurePanel({ providers }: { providers: ProviderRecord[] }) {
  return (
    <Card id="exposure">
      <CardHeader>
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">Exposure</p>
        <CardTitle>Provider bindings</CardTitle>
        <CardDescription>Gateway reachability, remote ids, and advertised endpoints stay visible alongside local history.</CardDescription>
      </CardHeader>

      <CardContent>
        {providers.length === 0 ? (
          <EmptyState
            title="No providers exposed"
            description="Bindings such as Agents Hot and generic A2A will appear here after registration."
            icon={<Globe2 className="size-5" />}
          />
        ) : (
          <div className="space-y-3">
            {providers.map((provider) => {
              const urls = visibleUrls(provider.config);

              return (
                <article key={provider.id} className="rounded-xl border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{provider.provider}</p>
                      <p className="text-muted-foreground text-sm">{provider.agent?.name ?? provider.agentId}</p>
                    </div>
                    <StatusBadge value={provider.status} />
                  </div>

                  <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <PlugZap className="size-3.5" />
                      {provider.remoteSlug ?? provider.remoteAgentId ?? 'Local only'}
                    </span>
                    <span>
                      {provider.lastSyncedAt ? new Date(provider.lastSyncedAt).toLocaleString() : 'Never synced'}
                    </span>
                  </div>

                  {urls.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {urls.map((entry) => (
                        <div
                          key={entry.key}
                          className="flex flex-col gap-1 rounded-lg border bg-muted/25 px-3 py-2 text-sm md:flex-row md:items-center md:justify-between"
                        >
                          <span className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">
                            {entry.key}
                          </span>
                          <a
                            href={entry.value}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 break-all hover:underline"
                          >
                            {entry.value}
                            <ExternalLink className="size-3.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground mt-4 text-sm">No URL endpoints advertised in this binding config.</p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
