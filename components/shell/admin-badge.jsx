import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/** "Dotcod Admin" mark, shown on every screen so staff never confuse it with the customer app. */
export function AdminBadge({ className, tone = 'dark' }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-sm">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-tight">
        <span
          className={cn(
            'text-sm font-semibold',
            tone === 'dark' ? 'text-sidebar-accent-foreground' : 'text-foreground',
          )}
        >
          Dotcod
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
          Admin · Staff only
        </span>
      </span>
    </div>
  );
}
