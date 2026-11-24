'use client';

import { Ban, CalendarPlus, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHANNEL_LABELS, daysUntil, formatDate, formatDateTime, formatNumber } from '@/lib/customers';
import { SUBSCRIPTION_STATUS_META } from '@/lib/customer-detail';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/states';
import { StatusBadge } from '@/components/customers/status-badge';
import { Facts, OverLimitBanner, Section } from './overview-tab';

export function SubscriptionStatus({ status }) {
  const meta = SUBSCRIPTION_STATUS_META[status] || { label: status, className: 'border-slate-300 bg-background' };
  return (
    <span className={cn('inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', meta.className)}>
      {meta.label}
    </span>
  );
}

const editable = (s) => ['SCHEDULED', 'CURRENT', 'GRACE'].includes(s.status);
const cancelable = (s) => ['SCHEDULED', 'CURRENT', 'GRACE'].includes(s.status);

function period(s) {
  return `${formatDate(s.startsAt)} – ${s.endsAt ? formatDate(s.endsAt) : 'open-ended'}`;
}

function Over({ used, limit }) {
  const over = typeof limit === 'number' && used > limit;
  return (
    <span className={cn('tabular-nums', over && 'font-medium text-red-600')}>
      {formatNumber(used ?? 0)} / {formatNumber(limit)}
      {over ? <span className="ml-1 text-xs">(over)</span> : null}
    </span>
  );
}

function LimitFacts({ subscription, customer }) {
  const l = subscription.limits;
  const missing = (customer.connectedChannels || []).filter((c) => !l.channels.includes(c));
  return (
    <Facts
      items={[
        { label: 'AI replies / month', value: formatNumber(l.aiMonthlyReplies) },
        { label: 'Voice minutes / month', value: formatNumber(l.voiceMonthlyMinutes) },
        { label: 'AI employees (in use / limit)', value: <Over used={customer.aiEmployees} limit={l.maxAiEmployees} /> },
        { label: 'Seats (in use / limit)', value: <Over used={customer.seatsUsed} limit={l.maxSeats} /> },
        {
          label: 'Channels',
          wide: true,
          value: (
            <span>
              {l.channels.length ? l.channels.map((c) => CHANNEL_LABELS[c] || c).join(', ') : 'None'}
              {missing.length ? (
                <span className="ml-2 text-xs font-medium text-red-600">
                  Connected but not in plan: {missing.map((c) => CHANNEL_LABELS[c] || c).join(', ')}
                </span>
              ) : null}
            </span>
          ),
        },
      ]}
    />
  );
}

export function SubscriptionTab({ customer, actions, onAdd, onEdit, onCancel }) {
  const current = customer.currentSubscription;
  const subs = customer.subscriptions || [];
  const canWrite = actions.subscriptions;
  const verified = customer.verification === 'VERIFIED';
  const ent = customer.entitlement || {};
  const endDays = current?.endsAt ? daysUntil(current.endsAt) : null;

  return (
    <div className="space-y-4">
      <OverLimitBanner customer={customer} />
      <Section
        title="Current period"
        action={
          canWrite && verified ? (
            <Button size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90" onClick={onAdd}>
              <CalendarPlus /> Add / renew
            </Button>
          ) : null
        }
      >
        {current ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <SubscriptionStatus status={current.status} />
              <StatusBadge kind="state" value={ent.state} />
              <span className="text-sm">{period(current)}</span>
              {current.status === 'CURRENT' && endDays != null && endDays <= 14 ? (
                <span className="text-xs font-medium text-amber-700">ends in {Math.max(0, endDays)} d</span>
              ) : null}
              {current.graceEndsAt && ['GRACE', 'CURRENT'].includes(current.status) ? (
                <span className="text-xs text-muted-foreground">
                  grace ({current.graceDays} d) until {formatDate(current.graceEndsAt)}
                </span>
              ) : null}
            </div>
            <LimitFacts subscription={current} customer={customer} />
            {current.note ? (
              <p className="rounded-md bg-muted/60 px-3 py-2 text-sm">
                <span className="text-xs text-muted-foreground">Note: </span>
                {current.note}
              </p>
            ) : null}
            {canWrite && (editable(current) || cancelable(current)) ? (
              <div className="flex flex-wrap gap-2">
                {editable(current) ? (
                  <Button size="sm" variant="outline" onClick={() => onEdit(current)}>
                    <Pencil /> Edit end date / limits
                  </Button>
                ) : null}
                {cancelable(current) ? (
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => onCancel(current)}>
                    <Ban /> Cancel
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {verified
              ? 'No subscription yet. AI replies are paused until one is added.'
              : 'Subscriptions start when the signup is verified.'}
          </p>
        )}
      </Section>

      <Section title={`History (${subs.length})`}>
        {subs.length ? (
          <div className="relative -m-4 overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Limits</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="px-3 py-2 font-medium">Canceled</th>
                  <th className="px-3 py-2 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b border-border align-top last:border-0">
                    <td className="px-4 py-3">
                      <p className="whitespace-nowrap">{period(s)}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{s.id}</p>
                      {s.note ? <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">{s.note}</p> : null}
                    </td>
                    <td className="px-3 py-3">
                      <SubscriptionStatus status={s.status} />
                      <p className="mt-1 text-[11px] text-muted-foreground">grace {s.graceDays} d</p>
                    </td>
                    <td className="px-3 py-3 text-xs tabular-nums">
                      <p>{formatNumber(s.limits.aiMonthlyReplies)} AI replies · {formatNumber(s.limits.voiceMonthlyMinutes)} voice min</p>
                      <p className="text-muted-foreground">
                        {s.limits.maxAiEmployees} employees · {s.limits.maxSeats} seats ·{' '}
                        {s.limits.channels.map((c) => CHANNEL_LABELS[c] || c).join(', ') || 'no channels'}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs">
                      <p>{formatDate(s.createdAt)}</p>
                      <p className="text-muted-foreground">{s.createdBy?.name || 'System'}</p>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {s.canceledAt ? (
                        <>
                          <p className="whitespace-nowrap" title={formatDateTime(s.canceledAt)}>
                            {formatDate(s.canceledAt)}
                            {s.canceledBy ? ` · ${s.canceledBy.name}` : ''}
                          </p>
                          {s.cancelReason ? <p className="max-w-[200px] text-muted-foreground">{s.cancelReason}</p> : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {canWrite ? (
                        <div className="flex justify-end gap-1">
                          {editable(s) ? (
                            <Button size="sm" variant="ghost" onClick={() => onEdit(s)} aria-label={`Edit ${s.id}`}>
                              <Pencil /> Edit
                            </Button>
                          ) : null}
                          {cancelable(s) ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => onCancel(s)}
                              aria-label={`Cancel ${s.id}`}
                            >
                              <Ban /> Cancel
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No subscriptions" description="Added subscriptions and renewals appear here." className="border-0 py-8" />
        )}
      </Section>
    </div>
  );
}
