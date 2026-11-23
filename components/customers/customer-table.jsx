'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/customers/status-badge';
import { UsageMeter } from '@/components/customers/usage-meter';
import { CHANNEL_LABELS, daysUntil, formatDate, formatDateTime, formatRelative } from '@/lib/customers';

const OVER_LIMIT_LABELS = {
  max_ai_employees: 'More AI employees than the plan allows',
  max_seats: 'More seats than the plan allows',
  channel_not_in_plan: 'A connected channel is not in the plan',
  ai_monthly_replies: 'AI replies over the monthly limit',
  voice_monthly_minutes: 'Voice minutes over the monthly limit',
};

const th = 'whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-muted-foreground';
const td = 'px-3 py-3 align-top';

function Owner({ owner }) {
  if (!owner) return <span className="text-sm text-muted-foreground">No owner</span>;
  return (
    <div className="min-w-0 max-w-[220px]">
      <p className="truncate text-sm">{owner.name || '—'}</p>
      <p className="truncate text-xs text-muted-foreground" title={owner.email}>
        {owner.email}
      </p>
      {!owner.emailConfirmed ? <StatusBadge kind="email" value={false} size="xs" className="mt-1" /> : null}
    </div>
  );
}

function Organization({ item }) {
  return (
    <div className="min-w-0 max-w-[240px]">
      <Link
        href={`/customers/${encodeURIComponent(item.id)}`}
        className="block truncate text-sm font-medium text-foreground hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        onClick={(event) => event.stopPropagation()}
      >
        {item.name}
      </Link>
      <p className="truncate text-xs text-muted-foreground">{item.slug}</p>
      {item.overLimit?.length ? (
        <p
          className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-red-600"
          title={item.overLimit.map((key) => OVER_LIMIT_LABELS[key] || key).join('\n')}
        >
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          Over limit ({item.overLimit.length})
        </p>
      ) : null}
    </div>
  );
}

function Signup({ item }) {
  return (
    <div className="whitespace-nowrap">
      <p className="text-sm" title={formatDateTime(item.signupAt)}>
        {formatDate(item.signupAt)}
      </p>
      {item.source === 'staff' ? (
        <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <UserCog className="h-3 w-3" aria-hidden="true" /> Created by staff
        </p>
      ) : null}
    </div>
  );
}

function PeriodEnd({ entitlement }) {
  const state = entitlement?.state;
  const end = state === 'GRACE' ? entitlement?.graceEndsAt : entitlement?.periodEndsAt;
  if (!entitlement?.periodEndsAt) {
    return (
      <span className="text-sm text-muted-foreground">
        {entitlement?.subscriptionId && state === 'ACTIVE' ? 'Open-ended' : '—'}
      </span>
    );
  }
  const days = daysUntil(end);
  let note = null;
  if (state === 'ACTIVE' && days != null && days <= 14) note = `in ${Math.max(days, 0)} d`;
  if (state === 'GRACE' && days != null) note = `grace ends in ${Math.max(days, 0)} d`;
  return (
    <div className="whitespace-nowrap">
      <p className="text-sm">{formatDate(entitlement.periodEndsAt)}</p>
      {note ? (
        <p className={cn('text-[11px]', state === 'GRACE' ? 'text-orange-700' : 'text-amber-700')}>{note}</p>
      ) : null}
    </div>
  );
}

function Employees({ item }) {
  const max = item.entitlement?.limits?.maxAiEmployees;
  const over = typeof max === 'number' && item.aiEmployees > max;
  return (
    <span className={cn('text-sm tabular-nums', over && 'font-medium text-red-600')}>
      {item.aiEmployees ?? 0}
      {typeof max === 'number' ? <span className="text-muted-foreground"> / {max}</span> : null}
    </span>
  );
}

/** Full customer list table (Customers page). The table scrolls inside its container. */
export function CustomerTable({ items, footer }) {
  const router = useRouter();
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className={th}>Organization</th>
              <th className={th}>Owner</th>
              <th className={th}>Signed up</th>
              <th className={th}>Verification</th>
              <th className={th}>State</th>
              <th className={th}>Period end</th>
              <th className={th}>AI replies (month)</th>
              <th className={th}>Voice min (month)</th>
              <th className={th}>Employees</th>
              <th className={th}>Last activity</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40"
                onClick={() => router.push(`/customers/${encodeURIComponent(item.id)}`)}
              >
                <td className={td}>
                  <Organization item={item} />
                </td>
                <td className={td}>
                  <Owner owner={item.owner} />
                </td>
                <td className={td}>
                  <Signup item={item} />
                </td>
                <td className={td}>
                  <StatusBadge kind="verification" value={item.verification} />
                </td>
                <td className={td}>
                  <StatusBadge kind="state" value={item.entitlement?.state} />
                </td>
                <td className={td}>
                  <PeriodEnd entitlement={item.entitlement} />
                </td>
                <td className={td}>
                  <UsageMeter used={item.usage?.aiReplies} limit={item.entitlement?.limits?.aiMonthlyReplies} />
                </td>
                <td className={td}>
                  <UsageMeter used={item.usage?.voiceMinutes} limit={item.entitlement?.limits?.voiceMonthlyMinutes} />
                </td>
                <td className={td}>
                  <Employees item={item} />
                </td>
                <td className={cn(td, 'whitespace-nowrap text-sm text-muted-foreground')}>
                  <span title={formatDateTime(item.lastActivityAt)}>{formatRelative(item.lastActivityAt)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}

/** Compact table for the Home pending queue (oldest first). */
export function PendingQueueTable({ items }) {
  const router = useRouter();
  const now = Date.now();
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className={th}>Organization</th>
              <th className={th}>Owner</th>
              <th className={th}>Signed up</th>
              <th className={th}>Waiting</th>
              <th className={th}>Channels</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const waitingDays = Math.floor((now - new Date(item.signupAt).getTime()) / 86_400_000);
              return (
                <tr
                  key={item.id}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40"
                  onClick={() => router.push(`/customers/${encodeURIComponent(item.id)}`)}
                >
                  <td className={td}>
                    <Organization item={item} />
                  </td>
                  <td className={td}>
                    <Owner owner={item.owner} />
                  </td>
                  <td className={td}>
                    <Signup item={item} />
                  </td>
                  <td className={cn(td, 'whitespace-nowrap text-sm')}>
                    <span className={cn(waitingDays >= 2 ? 'font-medium text-amber-700' : 'text-muted-foreground')}>
                      {waitingDays < 1 ? 'Today' : `${waitingDays} d`}
                    </span>
                  </td>
                  <td className={cn(td, 'whitespace-nowrap text-sm text-muted-foreground')}>
                    {item.connectedChannels?.length ? item.connectedChannels.map((c) => CHANNEL_LABELS[c] || c).join(', ') : 'None yet'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
