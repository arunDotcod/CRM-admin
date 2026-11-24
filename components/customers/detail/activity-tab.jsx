'use client';

/** Activity tab: the org's audit trail with staff names, cursor "Load more" (api-contracts §12.3). */
import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime, formatRelative } from '@/lib/customers';
import { actionLabel, customerApi } from '@/lib/customer-detail';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/states';

const ACTORS = [
  { value: 'all', label: 'Everyone' },
  { value: 'staff', label: 'Dotcod staff' },
  { value: 'customer', label: 'Customer' },
];

function short(value) {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '[]';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Metadata as a few readable lines: before → after per field, then the other keys. */
function MetadataLines({ metadata }) {
  if (!metadata || typeof metadata !== 'object' || !Object.keys(metadata).length) return null;
  const { before, after, ...rest } = metadata;
  const lines = [];
  if (before || after) {
    const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])];
    for (const key of keys) lines.push(`${key}: ${short(before?.[key])} → ${short(after?.[key])}`);
  }
  for (const [key, value] of Object.entries(rest)) lines.push(`${key}: ${short(value)}`);
  if (!lines.length) return null;
  return (
    <ul className="mt-1 space-y-0.5 break-all font-mono text-[11px] text-muted-foreground">
      {lines.slice(0, 8).map((line) => (
        <li key={line}>{line}</li>
      ))}
      {lines.length > 8 ? <li>… {lines.length - 8} more</li> : null}
    </ul>
  );
}

function Actor({ actor }) {
  if (!actor || actor.kind === 'system') return <span className="text-muted-foreground">System</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span>{actor.name || actor.id}</span>
      <span
        className={cn(
          'rounded-full border px-1.5 py-px text-[10px] font-medium',
          actor.kind === 'staff' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-300 bg-slate-50 text-slate-700',
        )}
      >
        {actor.kind === 'staff' ? 'Staff' : 'Customer'}
      </span>
    </span>
  );
}

export function ActivityTab({ customerId, refreshKey }) {
  const [actor, setActor] = useState('all');
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [moreBusy, setMoreBusy] = useState(false);

  const load = useCallback(
    async (next) => {
      try {
        const page = await customerApi.activity(customerId, { actor, cursor: next });
        setItems((prev) => (next ? [...prev, ...page.items] : page.items));
        setCursor(page.nextCursor || null);
        setStatus('ready');
      } catch (err) {
        setError(err);
        if (!next) setStatus('error');
        else setStatus('ready');
      }
    },
    [customerId, actor],
  );

  useEffect(() => {
    setStatus('loading');
    setError(null);
    load(null);
  }, [load, refreshKey]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by who did it">
        {ACTORS.map((a) => (
          <Button
            key={a.value}
            size="sm"
            variant={actor === a.value ? 'default' : 'outline'}
            aria-pressed={actor === a.value}
            onClick={() => setActor(a.value)}
          >
            {a.label}
          </Button>
        ))}
      </div>

      {status === 'loading' ? (
        <TableSkeleton rows={6} cols={3} />
      ) : status === 'error' ? (
        <ErrorState message={error?.message} onRetry={() => load(null)} />
      ) : !items.length ? (
        <EmptyState title="No activity" description="Nothing has been recorded for this filter yet." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <ol className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[160px_1fr_200px] sm:gap-4">
                <time className="text-xs text-muted-foreground" dateTime={item.createdAt} title={formatDateTime(item.createdAt)}>
                  {formatDateTime(item.createdAt)}
                  <span className="block">{formatRelative(item.createdAt)}</span>
                </time>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{actionLabel(item.action)}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {item.action}
                    {item.resourceId ? ` · ${item.resourceId}` : ''}
                  </p>
                  <MetadataLines metadata={item.metadata} />
                </div>
                <div className="text-sm">
                  <Actor actor={item.actor} />
                </div>
              </li>
            ))}
          </ol>
          {cursor ? (
            <div className="border-t border-border p-3 text-center">
              <Button
                variant="outline"
                size="sm"
                disabled={moreBusy}
                onClick={async () => {
                  setMoreBusy(true);
                  await load(cursor);
                  setMoreBusy(false);
                }}
              >
                {moreBusy ? <Loader2 className="animate-spin" /> : null}
                Load more
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
