'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AppShell } from '@/components/shell/app-shell';
import { useAuth } from '@/lib/auth';

/** Every route in this group needs a full staff session (password + TOTP). */
export default function ProtectedLayout({ children }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'anonymous') {
      const next = pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${next}`);
    }
  }, [status, pathname, router]);

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sidebar">
        <Loader2 className="h-6 w-6 animate-spin text-sidebar-foreground" aria-label="Loading" />
      </div>
    );
  }
  return <AppShell>{children}</AppShell>;
}
