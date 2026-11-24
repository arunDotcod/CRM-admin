import { Suspense } from 'react';
import { RequirePermission } from '@/components/shell/page';
import { CustomerDetail } from './customer-detail';

export const metadata = { title: 'Customer' };

export default async function CustomerDetailPage({ params }) {
  const { id } = await params;
  return (
    <RequirePermission permission="admin.customers.read">
      <Suspense fallback={null}>
        <CustomerDetail id={decodeURIComponent(id)} />
      </Suspense>
    </RequirePermission>
  );
}
