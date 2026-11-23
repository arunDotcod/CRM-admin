'use client';

import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/lib/auth';

export function Providers({ children }) {
  return (
    <AuthProvider>
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </AuthProvider>
  );
}
