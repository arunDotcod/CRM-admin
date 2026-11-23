import { Suspense } from 'react';
import { CustomersActions } from './customers-actions';
import { CustomersList } from './customers-list';
import { PageHeader, RequirePermission } from '@/components/shell/page';
import { TableSkeleton } from '@/components/common/states';

export const metadata = { title: 'Customers' };

export default function CustomersPage() {
  return (
    <RequirePermission permission="admin.customers.read">
      <PageHeader
        title="Customers"
        description="Every organization: verification, subscription state and usage."
        actions={<CustomersActions />}
      />
      <Suspense fallback={<TableSkeleton rows={8} cols={8} />}>
        <CustomersList />
      </Suspense>
    </RequirePermission>
  );
}
