'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  CircleSlash,
  Hourglass,
  MailQuestion,
  PauseCircle,
  RotateCw,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { tileLinks } from '@/lib/customers';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/states';
import { PendingQueueTable } from '@/components/customers/customer-table';

const ACCENTS = {
  amber: 'bg-amber-50 text-amber-700',
  slate: 'bg-slate-100 text-slate-600',
  sky: 'bg-sky-50 text-sky-700',
  orange: 'bg-orange-50 text-orange-700',
  red: 'bg-red-50 text-red-700',
};

function Tile({ label, value, sub, href, icon: Icon, accent = 'slate', highlight = false, loading }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-7 w-12" />
        <Skeleton className="mt-2 h-3 w-20" />
      </div>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        'group flex flex-col rounded-xl border bg-card p-4 transition-colors hover:border-brand/50 hover:bg-brand/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        highlight && value > 0 ? 'border-amber-300' : 'border-border',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', ACCENTS[accent])}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground">
        {typeof value === 'number' ? value.toLocaleString('en-IN') : '—'}
      </p>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
        {sub}
        <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
      </p>
    </Link>
  );
}

export function HomeDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api('/dashboard'));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !data) return <ErrorState message={error.message} onRetry={load} />;

  const links = tileLinks(data);
  const notice = data?.expiryNoticeDays ?? 7;
  const showSkeleton = loading && !data;
  const tiles = [
    {
      key: 'pending',
      label: 'Pending verification',
      value: data?.pendingVerification,
      sub: 'Email confirmed, waiting for staff',
      href: links.pendingVerification,
      icon: ShieldCheck,
      accent: 'amber',
      highlight: true,
    },
    {
      key: 'unconfirmed',
      label: 'Unconfirmed signups',
      value: data?.unconfirmedSignups,
      sub: 'Owner email not confirmed',
      href: links.unconfirmedSignups,
      icon: MailQuestion,
      accent: 'slate',
    },
    {
      key: 's7',
      label: 'Signups, last 7 days',
      value: data?.signups?.last7Days,
      sub: 'Self-serve',
      href: links.signups7,
      icon: UserPlus,
      accent: 'sky',
    },
    {
      key: 's30',
      label: 'Signups, last 30 days',
      value: data?.signups?.last30Days,
      sub: 'Self-serve',
      href: links.signups30,
      icon: UserPlus,
      accent: 'sky',
    },
    {
      key: 'expiring',
      label: 'Expiring soon',
      value: data?.expiringSoon,
      sub: `Active, period ends within ${notice} day${notice === 1 ? '' : 's'}`,
      href: links.expiringSoon,
      icon: CalendarClock,
      accent: 'amber',
    },
    {
      key: 'grace',
      label: 'In grace',
      value: data?.inGrace,
      sub: 'Period ended, AI still on',
      href: links.inGrace,
      icon: Hourglass,
      accent: 'orange',
    },
    {
      key: 'paused',
      label: 'Paused',
      value: data?.paused,
      sub: 'Expired, AI replies paused',
      href: links.paused,
      icon: PauseCircle,
      accent: 'slate',
    },
    {
      key: 'suspended',
      label: 'Suspended',
      value: data?.suspended,
      sub: 'Suspended by staff',
      href: links.suspended,
      icon: CircleSlash,
      accent: 'red',
    },
  ];

  const queue = data?.pendingQueue ?? [];

  return (
    <div className="space-y-8">
      <section aria-label="Counters">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tiles.map(({ key, ...tile }) => (
            <Tile key={key} {...tile} loading={showSkeleton} />
          ))}
        </div>
        {data ? (
          <p className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            Counters refresh every minute.
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground/70 hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCw className={cn('h-3 w-3', loading && 'animate-spin')} aria-hidden="true" /> Reload
            </button>
          </p>
        ) : null}
      </section>

      <section aria-labelledby="pending-queue-title" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="pending-queue-title" className="text-base font-semibold">
              Pending queue
            </h2>
            <p className="text-sm text-muted-foreground">
              Signups with a confirmed email waiting for verification, oldest first.
            </p>
          </div>
          {data?.pendingVerification > queue.length ? (
            <Button asChild variant="outline" size="sm">
              <Link href={links.pendingVerification}>
                View all {data.pendingVerification} <ArrowRight />
              </Link>
            </Button>
          ) : null}
        </div>
        {showSkeleton ? (
          <TableSkeleton rows={4} cols={5} />
        ) : queue.length ? (
          <PendingQueueTable items={queue} />
        ) : (
          <EmptyState
            icon={ShieldCheck}
            title="Nothing waiting"
            description="New signups appear here once the owner confirms their email."
          />
        )}
      </section>
    </div>
  );
}
