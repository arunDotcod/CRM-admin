import { ComingSoon, PageHeader, RequirePermission } from '@/components/shell/page';

export const metadata = { title: 'Audit log' };

export default function Page() {
  return (
    <RequirePermission permission="admin.audit.read">
      <PageHeader title="Audit log" description="Every staff action, filterable by staff member, customer and action." />
      <ComingSoon task="BO19">All staff actions with filters by staff, organization and action.</ComingSoon>
    </RequirePermission>
  );
}
