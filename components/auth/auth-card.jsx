import { AdminBadge } from '@/components/shell/admin-badge';

/** Centered card on a dark backdrop, shared by /login and /setup. */
export function AuthCard({ title, description, children, footer }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-sidebar px-4 py-10">
      <div className="w-full max-w-md">
        <AdminBadge className="mb-6 justify-center" />
        <div className="rounded-xl border border-sidebar-border bg-card p-6 shadow-xl sm:p-8">
          <div className="mb-6 space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {children}
        </div>
        {footer ? <div className="mt-6 text-center text-xs text-sidebar-foreground">{footer}</div> : null}
      </div>
    </main>
  );
}
