'use client';

// Empty / error / skeleton states, modelled on CRM-Dotcod-AI/components/common/states.jsx.

import { AlertTriangle, Inbox, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background px-6 py-14 text-center',
        className,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-destructive/40 bg-background px-6 py-14 text-center',
        className,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-semibold text-foreground">Couldn&apos;t load this</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message || 'Something went wrong. Try again.'}</p>
      {onRetry ? (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          <RotateCw /> Try again
        </Button>
      ) : null}
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 6, className }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-background', className)} aria-busy="true">
      <div className="border-b border-border bg-muted/40 px-4 py-3">
        <Skeleton className="h-3 w-1/3" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-0">
          {Array.from({ length: cols }).map((__, j) => (
            <Skeleton key={j} className={cn('h-4', j === 0 ? 'w-40' : 'w-16')} />
          ))}
        </div>
      ))}
    </div>
  );
}
