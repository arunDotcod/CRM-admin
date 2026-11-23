import { ComingSoon, PageHeader, RequirePermission } from '@/components/shell/page';

export const metadata = { title: 'Staff' };

export default function Page() {
  return (
    <RequirePermission permission="admin.staff.manage">
      <PageHeader title="Staff" description="Invite staff, change roles, disable accounts and reset two-step verification." />
      <ComingSoon task="BO19">Staff list with invite, role change, disable and TOTP reset.</ComingSoon>
    </RequirePermission>
  );
}
