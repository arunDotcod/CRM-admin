'use client';

import { KeyRound, Mail, MoreHorizontal, ShieldCheck, ShieldOff, UserCheck, UserCog, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDateTime, formatRelative } from '@/lib/customers';
import { STATUS_LABELS, roleLabel } from '@/lib/staff';
import { cn } from '@/lib/utils';

const th = 'whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-muted-foreground';
const td = 'px-3 py-3 align-top';

const STATUS_TONES = {
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  INVITED: 'border-amber-200 bg-amber-50 text-amber-800',
  DISABLED: 'border-slate-300 bg-slate-100 text-slate-600',
};

const ROLE_TONES = {
  SUPER_ADMIN: 'border-brand/40 bg-brand/10 text-foreground',
  OPS: 'border-sky-200 bg-sky-50 text-sky-800',
  SUPPORT: 'border-slate-200 bg-slate-50 text-slate-700',
};

function Pill({ tone, children, title }) {
  return (
    <span
      title={title}
      className={cn('inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', tone)}
    >
      {children}
    </span>
  );
}

/** Setup link state under the status pill (INVITED only). */
function SetupNote({ member, knownExpiry }) {
  if (member.status !== 'INVITED') return null;
  if (knownExpiry) {
    const expired = new Date(knownExpiry).getTime() < Date.now();
    return (
      <p className={cn('mt-1 whitespace-nowrap text-xs', expired ? 'text-red-700' : 'text-muted-foreground')}>
        {expired ? 'Link expired' : 'Link expires'} {formatDateTime(knownExpiry)}
      </p>
    );
  }
  return (
    <p className="mt-1 whitespace-nowrap text-xs text-muted-foreground" title="Setup links last 72 hours. The staff list does not include the expiry.">
      Link valid 72 h from sending
    </p>
  );
}

function RowActions({ member, isSelf, onAction }) {
  const disabled = member.status === 'DISABLED';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${member.name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{member.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onAction('role', member)}>
          <UserCog /> Edit name or role
        </DropdownMenuItem>
        {member.status === 'INVITED' ? (
          <DropdownMenuItem onSelect={() => onAction('resend-setup', member)}>
            <Mail /> Resend setup link
          </DropdownMenuItem>
        ) : null}
        {member.totpEnrolled ? (
          <DropdownMenuItem onSelect={() => onAction('reset-totp', member)}>
            <KeyRound /> Reset two-step verification
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        {disabled ? (
          <DropdownMenuItem onSelect={() => onAction('enable', member)}>
            <UserCheck /> Enable
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            disabled={isSelf}
            onSelect={() => onAction('disable', member)}
            className="text-destructive focus:text-destructive"
          >
            <UserX /> {isSelf ? "Disable (can't disable yourself)" : 'Disable'}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TwoStep({ enrolled }) {
  return enrolled ? (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-emerald-700">
      <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Enrolled
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-muted-foreground">
      <ShieldOff className="h-4 w-4" aria-hidden="true" /> Not set up
    </span>
  );
}

function Identity({ member, isSelf }) {
  return (
    <div className="min-w-0 max-w-[240px]">
      <p className="truncate text-sm font-medium">
        {member.name}
        {isSelf ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span> : null}
      </p>
      <p className="truncate text-xs text-muted-foreground" title={member.email}>
        {member.email}
      </p>
    </div>
  );
}

function LastLogin({ value }) {
  return (
    <span className="whitespace-nowrap text-sm" title={value ? formatDateTime(value) : undefined}>
      {formatRelative(value)}
    </span>
  );
}

/**
 * Staff list (GET /staff): a table from `md` up, cards on phones so the row menu stays in reach.
 * `setupExpiry` maps staff id → expiry known from this tab's invites / resends.
 */
export function StaffTable({ items, meId, setupExpiry, onAction }) {
  return (
    <>
      <ul className="space-y-2 md:hidden">
        {items.map((member) => {
          const isSelf = member.id === meId;
          return (
            <li
              key={member.id}
              className={cn('rounded-xl border bg-background p-3', member.status === 'DISABLED' && 'bg-muted/30')}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <Identity member={member} isSelf={isSelf} />
                </div>
                <RowActions member={member} isSelf={isSelf} onAction={onAction} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Pill tone={ROLE_TONES[member.role]}>{roleLabel(member.role)}</Pill>
                <Pill tone={STATUS_TONES[member.status]}>{STATUS_LABELS[member.status] || member.status}</Pill>
              </div>
              <SetupNote member={member} knownExpiry={setupExpiry[member.id]} />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <TwoStep enrolled={member.totpEnrolled} />
                <span>
                  Last login <LastLogin value={member.lastLoginAt} />
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="relative hidden overflow-x-auto rounded-xl border bg-background md:block">
        <table className="w-full min-w-[680px] border-collapse">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Role</th>
              <th className={th}>Status</th>
              <th className={th}>Two-step</th>
              <th className={th}>Last login</th>
              <th className={cn(th, 'w-12')}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((member) => {
              const isSelf = member.id === meId;
              return (
                <tr key={member.id} className={cn('border-b last:border-0', member.status === 'DISABLED' && 'bg-muted/30')}>
                  <td className={td}>
                    <Identity member={member} isSelf={isSelf} />
                  </td>
                  <td className={td}>
                    <Pill tone={ROLE_TONES[member.role]}>{roleLabel(member.role)}</Pill>
                  </td>
                  <td className={td}>
                    <Pill tone={STATUS_TONES[member.status]}>{STATUS_LABELS[member.status] || member.status}</Pill>
                    <SetupNote member={member} knownExpiry={setupExpiry[member.id]} />
                  </td>
                  <td className={td}>
                    <TwoStep enrolled={member.totpEnrolled} />
                  </td>
                  <td className={td}>
                    <LastLogin value={member.lastLoginAt} />
                  </td>
                  <td className={cn(td, 'py-2 text-right')}>
                    <RowActions member={member} isSelf={isSelf} onAction={onAction} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
