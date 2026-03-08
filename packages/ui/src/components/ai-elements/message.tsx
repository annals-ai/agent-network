import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type MessageRole = 'user' | 'assistant' | 'system' | 'tool' | 'data';

export interface MessageProps extends HTMLAttributes<HTMLDivElement> {
  from: MessageRole;
}

export function Message({ className, from, ...props }: MessageProps) {
  return (
    <div
      className={cn(
        'group flex w-full max-w-[94%] flex-col gap-2',
        from === 'user' ? 'ml-auto items-end' : 'items-start',
        className,
      )}
      data-role={from}
      {...props}
    />
  );
}

export function MessageContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'w-full min-w-0 overflow-hidden rounded-2xl border px-4 py-3 shadow-sm',
        'group-data-[role=user]:max-w-xl group-data-[role=user]:border-primary group-data-[role=user]:bg-primary group-data-[role=user]:text-primary-foreground',
        'group-data-[role=assistant]:bg-card group-data-[role=assistant]:text-card-foreground',
        'group-data-[role=system]:border-amber-200 group-data-[role=system]:bg-amber-50 group-data-[role=system]:text-amber-950',
        'group-data-[role=tool]:border-sky-200 group-data-[role=tool]:bg-sky-50 group-data-[role=tool]:text-sky-950',
        'group-data-[role=data]:bg-muted group-data-[role=data]:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function MessageHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-muted-foreground flex flex-wrap items-center gap-2 text-xs', className)} {...props} />;
}

export function MessageResponse({ className, ...props }: HTMLAttributes<HTMLPreElement>) {
  return (
    <pre
      className={cn('font-sans text-sm leading-6 whitespace-pre-wrap break-words', className)}
      {...props}
    />
  );
}
