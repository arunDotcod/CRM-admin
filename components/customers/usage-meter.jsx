import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/customers';

/** Bar colour for `used / limit`: amber from 80 %, red from 100 %. */
export function usageTone(used, limit) {
  if (typeof limit !== 'number' || limit <= 0) return typeof limit === 'number' && used > 0 ? 'red' : 'ok';
  const ratio = used / limit;
  if (ratio >= 1) return 'red';
  if (ratio >= 0.8) return 'amber';
  return 'ok';
}

const BAR = { ok: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500' };
const TEXT = { ok: 'text-foreground', amber: 'text-amber-700', red: 'text-red-600' };

/**
 * "used / limit" with a small bar. `limit` null = no subscription limit (shown as "—", no bar).
 * A limit of 0 with usage counts as over the limit.
 */
export function UsageMeter({ used, limit, unit, className }) {
  const value = typeof used === 'number' ? used : 0;
  const hasLimit = typeof limit === 'number';
  const tone = usageTone(value, limit);
  const percent = hasLimit ? (limit > 0 ? Math.min(100, (value / limit) * 100) : value > 0 ? 100 : 0) : 0;
  const label = `${formatNumber(value)} of ${hasLimit ? formatNumber(limit) : 'no limit'}${unit ? ` ${unit}` : ''}`;
  return (
    <div className={cn('min-w-[96px]', className)} title={label}>
      <p className={cn('text-xs tabular-nums', TEXT[tone])}>
        <span className="font-medium">{formatNumber(value)}</span>
        <span className="text-muted-foreground"> / {hasLimit ? formatNumber(limit) : '—'}</span>
      </p>
      {hasLimit ? (
        <div
          className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="meter"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={Math.max(limit, 1)}
          aria-valuenow={Math.min(value, Math.max(limit, 1))}
        >
          <div className={cn('h-full rounded-full', BAR[tone])} style={{ width: `${percent}%` }} />
        </div>
      ) : null}
    </div>
  );
}
