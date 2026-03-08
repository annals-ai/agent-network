import { useDeferredValue, useState } from 'react';
import { Archive, Search, SquareSplitHorizontal, StopCircle } from 'lucide-react';
import type { SessionMessage, SessionRecord } from '../api';

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageHeader, MessageResponse } from '@/components/ai-elements/message';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

interface TranscriptPanelProps {
  session: SessionRecord | null;
  messages: SessionMessage[];
  loading: boolean;
  error: string | null;
  actionState: 'stop' | 'archive' | 'fork' | null;
  forkTitle: string;
  onForkTitleChange(value: string): void;
  onStop(): void;
  onArchive(): void;
  onFork(): void;
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

function normalizeRole(role: string): 'assistant' | 'system' | 'tool' | 'user' | 'data' {
  switch (role) {
    case 'assistant':
      return 'assistant';
    case 'system':
      return 'system';
    case 'tool':
      return 'tool';
    case 'user':
      return 'user';
    default:
      return 'data';
  }
}

export function TranscriptPanel({
  session,
  messages,
  loading,
  error,
  actionState,
  forkTitle,
  onForkTitleChange,
  onStop,
  onArchive,
  onFork,
}: TranscriptPanelProps) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const visibleMessages = messages.filter((message) => {
    if (!deferredQuery) return true;
    return [
      message.role,
      message.kind,
      message.content,
      JSON.stringify(message.metadata),
    ].join(' ').toLowerCase().includes(deferredQuery);
  });

  return (
    <Card id="transcript" className="overflow-hidden">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">Transcript</p>
            <CardTitle>{session?.title ?? 'Select a session'}</CardTitle>
            <CardDescription>
              Inspect local user, assistant, system, and tool events without leaving the daemon console.
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onArchive} disabled={!session || actionState !== null}>
              <Archive className="size-4" />
              {actionState === 'archive' ? 'Archiving...' : 'Archive'}
            </Button>
            <Button type="button" variant="destructive" onClick={onStop} disabled={!session || actionState !== null}>
              <StopCircle className="size-4" />
              {actionState === 'stop' ? 'Stopping...' : 'Stop'}
            </Button>
          </div>
        </div>

        {session ? (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full">
              {session.agent?.name ?? session.agentId}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {session.origin}
            </Badge>
            <StatusBadge value={session.status} />
            <Badge variant="outline" className="rounded-full">
              {formatTimestamp(session.lastActiveAt)}
            </Badge>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)_auto]">
          <label className="grid gap-2">
            <span className="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em]">
              <Search className="size-3.5" />
              Search transcript
            </span>
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search content, roles, kinds, metadata..."
              disabled={!session}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">Fork title</span>
            <Input
              type="text"
              value={forkTitle}
              onChange={(event) => onForkTitleChange(event.target.value)}
              placeholder="Experiment"
              disabled={!session || actionState !== null}
            />
          </label>

          <div className="grid gap-2">
            <span className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">Action</span>
            <Button type="button" onClick={onFork} disabled={!session || actionState !== null}>
              <SquareSplitHorizontal className="size-4" />
              {actionState === 'fork' ? 'Forking...' : 'Fork session'}
            </Button>
          </div>
        </div>

        <div className="flex min-h-[34rem] flex-1 flex-col">
          <Conversation className="min-h-[34rem]">
            {!session ? (
              <ConversationEmptyState
                title="Pick a session from the desk"
                description="The transcript viewer shows every local message, including tool and system events."
              />
            ) : loading ? (
              <ConversationEmptyState
                title="Loading transcript..."
                description="Pulling local history from the daemon."
              />
            ) : error ? (
              <ConversationEmptyState title="Transcript load failed" description={error} />
            ) : visibleMessages.length === 0 ? (
              <ConversationEmptyState
                title="No messages match the current search"
                description="Clear the query to inspect the full session stream."
              />
            ) : (
              <>
                <ConversationContent>
                  {visibleMessages.map((message) => (
                    <Message key={message.id} from={normalizeRole(message.role)}>
                      <MessageHeader className={cn(normalizeRole(message.role) === 'user' && 'justify-end')}>
                        <Badge variant="outline" className="rounded-full capitalize">
                          {message.role}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full">
                          {message.kind}
                        </Badge>
                        <span>{formatTimestamp(message.createdAt)}</span>
                        <span>#{message.seq}</span>
                      </MessageHeader>

                      <MessageContent>
                        <MessageResponse>{message.content || '(No message content)'}</MessageResponse>

                        {Object.keys(message.metadata).length > 0 ? (
                          <details className="mt-3 rounded-xl border border-border/70 bg-background/60 p-3 text-xs text-foreground/80">
                            <summary className="cursor-pointer list-none font-medium">Metadata</summary>
                            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono leading-5">
                              {JSON.stringify(message.metadata, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                      </MessageContent>
                    </Message>
                  ))}
                </ConversationContent>

                <ConversationScrollButton />
              </>
            )}
          </Conversation>
        </div>

      </CardContent>
    </Card>
  );
}
