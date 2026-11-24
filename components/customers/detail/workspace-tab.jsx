'use client';

/** Workspace tab (read-only; api-contracts §12.3 workspace): members, AI employees, channels. */
import { useEffect, useState } from 'react';
import { CHANNEL_LABELS, formatDate, formatRelative } from '@/lib/customers';
import { customerApi } from '@/lib/customer-detail';
import { ErrorState } from '@/components/common/states';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/customers/status-badge';
import { Section } from './overview-tab';

function Pill({ children, tone = 'slate' }) {
  const tones = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    slate: 'border-slate-300 bg-slate-50 text-slate-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
  };
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>{children}</span>;
}

const toneFor = (status) =>
  ['ACTIVE', 'CONNECTED', 'ASSIGNED'].includes(status) ? 'green' : ['PENDING', 'INVITED'].includes(status) ? 'amber' : 'slate';
const title = (s) => String(s || '—').charAt(0) + String(s || '').slice(1).toLowerCase().replace(/_/g, ' ');

function Table({ head, rows, empty, minWidth = 560 }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="relative -m-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {cells.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WorkspaceTab({ customerId }) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    customerApi
      .workspace(customerId)
      .then((data) => alive && setState({ loading: false, data, error: null }))
      .catch((error) => alive && setState({ loading: false, data: null, error }));
    return () => {
      alive = false;
    };
  }, [customerId, attempt]);

  if (state.error) return <ErrorState message={state.error.message} onRetry={() => setAttempt((n) => n + 1)} />;
  if (!state.data)
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );

  const { members = [], invites = [], aiEmployees = [], channels = {} } = state.data;
  const channelRows = [
    ...(channels.whatsapp || []).map((c) => ['WhatsApp', c.displayPhoneNumber || c.id, <Pill key="s" tone={toneFor(c.status)}>{title(c.status)}</Pill>, c.connectedAt ? formatDate(c.connectedAt) : '—']),
    ...(channels.widgetSites || []).map((c) => ['Web chat', c.name || c.id, <Pill key="s" tone={toneFor(c.status)}>{title(c.status)}</Pill>, c.installedAt ? `Installed ${formatDate(c.installedAt)}` : 'Not installed']),
    ...(channels.instagram || []).map((c) => ['Instagram', c.username ? `@${c.username}` : c.id, <Pill key="s" tone={toneFor(c.status)}>{title(c.status)}</Pill>, '—']),
    ...(channels.voice || []).map((c) => ['Voice', c.e164 || c.id, <Pill key="s" tone={toneFor(c.status)}>{title(c.status)}</Pill>, c.agent ? `Agent: ${c.agent.name}` : 'No agent']),
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Read-only view of the customer&apos;s workspace. Conversation content is never shown here.</p>
      <Section title={`Members (${members.length})`}>
        <Table
          head={['Name', 'Role', 'Status', 'Email', 'Last login', 'Joined']}
          minWidth={720}
          empty="No members."
          rows={members.map((m) => [
            <div key="n" className="min-w-0">
              <p>{m.name || '—'}</p>
              <p className="break-all text-xs text-muted-foreground">{m.email}</p>
            </div>,
            title(m.role),
            <Pill key="s" tone={toneFor(m.status)}>{title(m.status)}</Pill>,
            <StatusBadge key="e" kind="email" value={m.emailConfirmed} size="xs" />,
            <span key="l" className="whitespace-nowrap">{formatRelative(m.lastLoginAt)}</span>,
            <span key="j" className="whitespace-nowrap">{formatDate(m.joinedAt)}</span>,
          ])}
        />
        {invites.length ? (
          <div className="mt-6 border-t pt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Pending invites ({invites.length})</p>
            <ul className="space-y-1 text-sm">
              {invites.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center gap-2">
                  <span className="break-all">{inv.email}</span>
                  <span className="text-xs text-muted-foreground">
                    {title(inv.role)} · {title(inv.status)} · expires {formatDate(inv.expiresAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>
      <Section title={`AI employees (${aiEmployees.length})`}>
        <Table
          head={['Name', 'Status', 'Channels', 'Created']}
          empty="No AI employees yet."
          rows={aiEmployees.map((e) => [
            e.name,
            <Pill key="s" tone={toneFor(e.status)}>{title(e.status)}</Pill>,
            e.channels?.length ? e.channels.map((c) => CHANNEL_LABELS[c] || c).join(', ') : '—',
            formatDate(e.createdAt),
          ])}
        />
      </Section>
      <Section title={`Channels (${channelRows.length})`}>
        <Table head={['Type', 'Account', 'Status', 'Details']} empty="No channels connected." rows={channelRows} />
      </Section>
    </div>
  );
}
