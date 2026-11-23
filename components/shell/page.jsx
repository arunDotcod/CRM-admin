'use client';

import { Construction, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Empty state for screens a later task builds (`task` names it, e.g. "BO17"). */
export function ComingSoon({ task, children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-background px-6 py-16 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
        <Construction className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium">Not built yet{task ? ` (${task})` : ''}</p>
      {children ? <div className="max-w-md text-sm text-muted-foreground">{children}</div> : null}
    </div>
  );
}

/** Renders children only for staff with `permission`; otherwise a "no access" panel. */
export function RequirePermission({ permission, children }) {
  const { can } = useAuth();
  if (can(permission)) return children;
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-background px-6 py-16 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Lock className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium">You don't have access to this page</p>
      <p className="max-w-md text-sm text-muted-foreground">Ask a super admin if you need it.</p>
    </div>
  );
}
