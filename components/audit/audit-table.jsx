'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatDateTime } from '@/lib/customers';
import { actionLabel, actionTone, formatValue, hasDetails, splitMetadata, summarize } from '@/lib/audit';
import { cn } from '@/lib/utils';

const th = 'whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-muted-foreground';
const td = 'px-3 py-3 align-top';

const TONES = {
  red: 'border-red-200 bg-red-50 text-red-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
};

function Details({ metadata }) {
  const { changes, other } = splitMetadata(metadata);
  const otherKeys = Object.keys(other);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      {changes.length ? (
        <div className="min-w-0">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Changes</p>
          <div className="overflow-x-auto rounded-md border bg-background">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-2.5 py-1.5 text-left text-xs font-medium text-muted-foreground">Field</th>
                  <th className="px-2.5 py-1.5 text-left text-xs font-medium text-muted-foreground">Before</th>
                  <th className="px-2.5 py-1.5 text-left text-xs font-medium text-muted-foreground">After</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((change) => (
                  <tr key={change.field} className="border-b last:border-0">
                    <td className="px-2.5 py-1.5 font-mono text-xs">{change.field}</td>
                    <td className="[overflow-wrap:anywhere] px-2.5 py-1.5 text-red-700">
                      {change.hasBefore ? formatValue(change.before) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="[overflow-wrap:anywhere] px-2.5 py-1.5 text-emerald-700">
                      {change.hasAfter ? formatValue(change.after) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {otherKeys.length ? (
        <div className="min-w-0">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Details</p>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-md border bg-background p-2.5 text-sm">
            {otherKeys.map((key) => (
              <Fragment key={key}>
                <dt className="font-mono text-xs text-muted-foreground">{key}</dt>
                <dd className="[overflow-wrap:anywhere]">{formatValue(other[key])}</dd>
              </Fragment>
            ))}
          </dl>
        </div>
      ) : null}
      {!changes.length && !otherKeys.length ? <p className="text-sm text-muted-foreground">No details recorded.</p> : null}
    </div>
  );
}

function ActionPill({ action }) {
  return (
    <span
      className={cn('inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', TONES[actionTone(action)])}
      title={action}
    >
      {actionLabel(action)}
    </span>
  );
}

/** Staff name; clicking it filters the log to that person. */
function StaffName({ item, onFilter }) {
  if (!item.staff) return <span className="text-muted-foreground">Unknown (sign-in)</span>;
  return (
    <button
      type="button"
      className="max-w-[180px] truncate rounded-sm text-left align-bottom hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={`Show only ${item.staff.name}`}
      onClick={() => onFilter({ staff: item.staff.id }, item.staff)}
    >
      {item.staff.name}
    </button>
  );
}

export function AuditTable({ items, onFilter }) {
  const [open, setOpen] = useState(() => new Set());
  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <ul className="space-y-2 md:hidden">
        {items.map((item) => {
          const expandable = hasDetails(item.metadata);
          const expanded = open.has(item.id);
          const summary = summarize(item);
          return (
            <li key={item.id} className="rounded-xl border bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <ActionPill action={item.action} />
                <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span>
              </div>
              {summary ? <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{summary}</p> : null}
              <p className="mt-2 text-sm">
                <StaffName item={item} onFilter={onFilter} />
                {item.organization ? (
                  <>
                    <span className="text-muted-foreground"> · </span>
                    <Link
                      href={`/customers/${encodeURIComponent(item.organization.id)}`}
                      className="font-medium hover:text-brand hover:underline"
                    >
                      {item.organization.name}
                    </Link>
                  </>
                ) : null}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {item.resourceType}
                {item.resourceId ? <span className="font-mono"> {item.resourceId}</span> : null}
              </p>
              {expandable ? (
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  aria-expanded={expanded}
                  className="mt-2 inline-flex items-center gap-1 rounded text-xs font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  {expanded ? 'Hide details' : 'Show details'}
                </button>
              ) : null}
              {expanded ? (
                <div className="mt-2">
                  <Details metadata={item.metadata} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="relative hidden overflow-x-auto rounded-xl border bg-background md:block">
      <table className="w-full min-w-[780px] border-collapse">
        <thead className="border-b bg-muted/40">
          <tr>
            <th className={cn(th, 'w-8')}>
              <span className="sr-only">Expand</span>
            </th>
            <th className={th}>Time</th>
            <th className={th}>Staff</th>
            <th className={th}>Action</th>
            <th className={th}>Organization</th>
            <th className={th}>Resource</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const expandable = hasDetails(item.metadata);
            const expanded = open.has(item.id);
            const summary = summarize(item);
            return (
              <Fragment key={item.id}>
                <tr className={cn('border-b', expanded && 'border-b-0 bg-muted/20')}>
                  <td className={cn(td, 'pr-0')}>
                    {expandable ? (
                      <button
                        type="button"
                        onClick={() => toggle(item.id)}
                        aria-expanded={expanded}
                        aria-label={expanded ? 'Hide details' : 'Show details'}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    ) : null}
                  </td>
                  <td className={cn(td, 'whitespace-nowrap text-sm')}>{formatDateTime(item.createdAt)}</td>
                  <td className={cn(td, 'text-sm')}>
                    <StaffName item={item} onFilter={onFilter} />
                  </td>
                  <td className={td}>
                    <ActionPill action={item.action} />
                    {summary ? (
                      <p className="mt-1 max-w-[280px] truncate text-xs text-muted-foreground" title={summary}>
                        {summary}
                      </p>
                    ) : null}
                  </td>
                  <td className={cn(td, 'text-sm')}>
                    {item.organization ? (
                      <Link
                        href={`/customers/${encodeURIComponent(item.organization.id)}`}
                        className="block max-w-[180px] truncate font-medium hover:text-brand hover:underline"
                      >
                        {item.organization.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={cn(td, 'text-sm')}>
                    <p className="whitespace-nowrap">{item.resourceType}</p>
                    {item.resourceId ? (
                      <p className="max-w-[160px] truncate font-mono text-xs text-muted-foreground" title={item.resourceId}>
                        {item.resourceId}
                      </p>
                    ) : null}
                  </td>
                </tr>
                {expanded ? (
                  <tr className="border-b bg-muted/20">
                    <td />
                    <td colSpan={5} className="px-3 pb-4 pt-1">
                      <Details metadata={item.metadata} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      </div>
    </>
  );
}
