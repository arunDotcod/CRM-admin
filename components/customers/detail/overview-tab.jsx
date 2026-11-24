'use client';

import { AlertTriangle, Mail, Pencil, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHANNEL_LABELS, formatDate, formatDateTime, formatNumber } from '@/lib/customers';
import { OVER_LIMIT_COPY } from '@/lib/customer-detail';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/customers/status-badge';
import { UsageMeter } from '@/components/customers/usage-meter';

export function Section({ title, action, children, className }) {
  return (
    <section className={cn('rounded-xl border border-border bg-background', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Facts({ items }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items
        .filter(Boolean)
        .map(({ label, value, wide }) => (
          <div key={label} className={cn('min-w-0', wide && 'sm:col-span-2')}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 break-words text-sm">{value ?? '—'}</dd>
          </div>
        ))}
    </dl>
  );
}

const blank = (v) => (v === null || v === undefined || v === '' ? null : v);

function hours(profile) {
  if (!profile.hoursPreset && !profile.hoursStart) return null;
  const times = profile.hoursStart && profile.hoursEnd ? `${profile.hoursStart}–${profile.hoursEnd}` : null;
  return [profile.hoursPreset, times].filter(Boolean).join(', ');
}

function Website({ url }) {
  if (!url) return null;
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-brand underline-offset-2 hover:underline">
      {url}
    </a>
  );
}

export function OverLimitBanner({ customer, className }) {
  if (!customer.overLimit?.length) return null;
  return (
    <div role="status" className={cn('flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800', className)}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-medium">Over the plan limits</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {customer.overLimit.map((key) => (
            <li key={key}>{OVER_LIMIT_COPY[key] || key}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function OverviewTab({ customer, actions, onEditProfile }) {
  const profile = customer.profile || {};
  const owner = customer.owner;
  const v = customer.verificationDetail || {};
  const limits = customer.entitlement?.limits;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <OverLimitBanner customer={customer} />
        <Section
          title="Business profile"
          action={
            actions.editProfile ? (
              <Button size="sm" variant="outline" onClick={onEditProfile}>
                <Pencil /> Edit
              </Button>
            ) : null
          }
        >
          <Facts
            items={[
              { label: 'Name', value: profile.name },
              { label: 'Website', value: <Website url={blank(profile.website)} /> },
              { label: 'Industry', value: blank(profile.industry) },
              { label: 'Size', value: blank(profile.size) },
              { label: 'Hours', value: hours(profile) },
              { label: 'Time zone', value: blank(profile.timezone) },
              {
                label: 'Description',
                wide: true,
                value: profile.description ? <span className="whitespace-pre-line">{profile.description}</span> : null,
              },
            ]}
          />
        </Section>

        <Section title="Verification">
          <Facts
            items={[
              { label: 'Status', value: <StatusBadge kind="verification" value={customer.verification} /> },
              v.verifiedAt && {
                label: 'Verified',
                value: `${formatDateTime(v.verifiedAt)}${v.verifiedBy ? ` by ${v.verifiedBy.name}` : ''}`,
              },
              v.rejectedAt && { label: 'Rejected', value: formatDateTime(v.rejectedAt) },
              v.rejectionReason && {
                label: 'Rejection reason (sent to the owner)',
                wide: true,
                value: <span className="whitespace-pre-line">{v.rejectionReason}</span>,
              },
              v.note && {
                label: 'Internal note',
                wide: true,
                value: <span className="whitespace-pre-line">{v.note}</span>,
              },
              customer.suspension && {
                label: 'Suspended',
                wide: true,
                value: (
                  <span className="whitespace-pre-line">
                    {formatDateTime(customer.suspension.at)}
                    {customer.suspension.reason ? ` — ${customer.suspension.reason}` : ''}
                  </span>
                ),
              },
            ]}
          />
        </Section>
      </div>

      <div className="space-y-4">
        <Section title="Owner">
          {owner ? (
            <Facts
              items={[
                { label: 'Name', value: owner.name },
                {
                  label: 'Email',
                  wide: true,
                  value: (
                    <a href={`mailto:${owner.email}`} className="inline-flex items-center gap-1 break-all text-brand hover:underline">
                      <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {owner.email}
                    </a>
                  ),
                },
                { label: 'Email status', value: <StatusBadge kind="email" value={owner.emailConfirmed} /> },
                customer.pendingLink && {
                  label: customer.pendingLink.purpose === 'SET_PASSWORD' ? 'Set-password link' : 'Confirmation link',
                  value: `Sent ${formatDate(customer.pendingLink.sentAt)}, expires ${formatDateTime(customer.pendingLink.expiresAt)}`,
                },
              ]}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No active owner.</p>
          )}
        </Section>

        <Section title="Account">
          <Facts
            items={[
              { label: 'Signed up', value: formatDateTime(customer.signupAt) },
              {
                label: 'Source',
                value:
                  customer.source === 'staff' ? (
                    <span className="inline-flex items-center gap-1">
                      <UserCog className="h-3.5 w-3.5" aria-hidden="true" />
                      Created by {customer.createdBy?.name || 'staff'}
                    </span>
                  ) : (
                    'Self-serve signup'
                  ),
              },
              { label: 'State', value: <StatusBadge kind="state" value={customer.entitlement?.state} /> },
              { label: 'Slug', value: <span className="font-mono text-xs">{customer.slug}</span> },
            ]}
          />
        </Section>

        <Section title="This month">
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">AI replies</p>
              <UsageMeter used={customer.usage?.aiReplies} limit={limits?.aiMonthlyReplies} />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Voice minutes</p>
              <UsageMeter used={customer.usage?.voiceMinutes} limit={limits?.voiceMonthlyMinutes} />
            </div>
            <Facts
              items={[
                {
                  label: 'AI employees',
                  value: `${formatNumber(customer.aiEmployees ?? 0)}${limits ? ` / ${formatNumber(limits.maxAiEmployees)}` : ''}`,
                },
                {
                  label: 'Seats',
                  value: `${formatNumber(customer.seatsUsed ?? 0)}${limits ? ` / ${formatNumber(limits.maxSeats)}` : ''}`,
                },
                {
                  label: 'Connected channels',
                  wide: true,
                  value: customer.connectedChannels?.length
                    ? customer.connectedChannels.map((c) => CHANNEL_LABELS[c] || c).join(', ')
                    : 'None yet',
                },
              ]}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}
