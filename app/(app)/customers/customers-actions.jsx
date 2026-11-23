'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { STAFF_PERMISSIONS, useAuth } from '@/lib/auth';

export function CustomersActions() {
  const { can } = useAuth();
  if (!can(STAFF_PERMISSIONS.CUSTOMERS_VERIFY)) return null;
  return (
    <Button asChild className="bg-brand text-brand-foreground hover:bg-brand/90">
      <Link href="/customers/new">
        <Plus /> New customer
      </Link>
    </Button>
  );
}
