import { RequirePermission } from '@/components/shell/page';
import { StaffManager } from './staff-manager';

export const metadata = { title: 'Staff' };

export default function Page() {
  return (
    <RequirePermission permission="admin.staff.manage">
      <StaffManager />
    </RequirePermission>
  );
}
