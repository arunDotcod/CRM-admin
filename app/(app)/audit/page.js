import { Suspense } from 'react';
import { PageHeader, RequirePermission } from '@/components/shell/page';
import { TableSkeleton } from '@/components/common/states';
import { AuditLog } from './audit-log';

export const metadata = { title: 'Audit log' };

export default function Page() {
  return (
    <RequirePermission permission="admin.audit.read">
      <PageHeader
        title="Audit log"
        description="Every staff action and staff sign-in, newest first. Expand a row for before / after values."
      />
      <Suspense fallback={<TableSkeleton rows={8} cols={6} />}>
        <AuditLog />
      </Suspense>
    </RequirePermission>
  );
}
