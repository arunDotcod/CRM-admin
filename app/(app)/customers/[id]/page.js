import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ComingSoon, PageHeader, RequirePermission } from '@/components/shell/page';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Customer' };

export default async function CustomerDetailPage({ params }) {
  const { id } = await params;
  return (
    <RequirePermission permission="admin.customers.read">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link href="/customers">
          <ArrowLeft /> Customers
        </Link>
      </Button>
      <PageHeader title="Customer" description={`Organization ${id}`} />
      <ComingSoon task="BO18">
        Overview, Subscription, Usage, Workspace and Activity tabs, with Verify, Reject, Reopen and
        Suspend actions.
      </ComingSoon>
    </RequirePermission>
  );
}
