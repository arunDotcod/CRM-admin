import { cn } from '@/lib/utils';

/**
 * One badge for verification and entitlement states (BO17), so every screen uses the same
 * colour per state. `kind` = 'state' (entitlement), 'verification', or 'email' (owner email).
 *
 * Tones: amber = waiting on Dotcod (PENDING), green = good (ACTIVE / VERIFIED), orange = grace,
 * slate = paused (EXPIRED), red = REJECTED / SUSPENDED, dashed grey = email unconfirmed.
 */
const TONES = {
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  orange: 'border-orange-200 bg-orange-50 text-orange-800',
  slate: 'border-slate-300 bg-slate-100 text-slate-700',
  red: 'border-red-200 bg-red-50 text-red-700',
  grey: 'border-dashed border-slate-300 bg-background text-slate-600',
  blue: 'border-sky-200 bg-sky-50 text-sky-800',
};

const DOTS = {
  amber: 'bg-amber-500',
  green: 'bg-emerald-500',
  orange: 'bg-orange-500',
  slate: 'bg-slate-400',
  red: 'bg-red-500',
  grey: 'bg-slate-300',
  blue: 'bg-sky-500',
};

const STATE_META = {
  PENDING: { label: 'Pending', tone: 'amber', hint: 'Waiting for verification' },
  REJECTED: { label: 'Rejected', tone: 'red', hint: 'Signup rejected' },
  ACTIVE: { label: 'Active', tone: 'green', hint: 'Subscription active' },
  GRACE: { label: 'Grace', tone: 'orange', hint: 'Period ended; AI still on until grace ends' },
  EXPIRED: { label: 'Paused', tone: 'slate', hint: 'Expired: AI replies are paused' },
  SUSPENDED: { label: 'Suspended', tone: 'red', hint: 'Suspended by Dotcod staff' },
};

const VERIFICATION_META = {
  PENDING: { label: 'Pending', tone: 'amber', hint: 'Not verified yet' },
  VERIFIED: { label: 'Verified', tone: 'green', hint: 'Verified by Dotcod staff' },
  REJECTED: { label: 'Rejected', tone: 'red', hint: 'Rejected by Dotcod staff' },
};

const EMAIL_META = {
  true: { label: 'Email confirmed', tone: 'green', hint: 'Owner confirmed their email' },
  false: { label: 'Unconfirmed', tone: 'grey', hint: 'Owner has not confirmed their email yet' },
};

export const STATE_LABELS = Object.fromEntries(
  Object.entries(STATE_META).map(([key, meta]) => [key, meta.label]),
);
export const VERIFICATION_LABELS = Object.fromEntries(
  Object.entries(VERIFICATION_META).map(([key, meta]) => [key, meta.label]),
);

export function statusMeta(kind, value) {
  if (kind === 'verification') return VERIFICATION_META[value];
  if (kind === 'email') return EMAIL_META[String(Boolean(value))];
  return STATE_META[value];
}

export function StatusBadge({ kind = 'state', value, className, size = 'sm' }) {
  const meta = statusMeta(kind, value) || { label: value ?? '—', tone: 'grey' };
  return (
    <span
      title={meta.hint}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-medium',
        size === 'xs' ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-xs',
        TONES[meta.tone],
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', DOTS[meta.tone])} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
