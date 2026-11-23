import { ComingSoon, PageHeader, RequirePermission } from '@/components/shell/page';

export const metadata = { title: 'Settings' };

export default function Page() {
  return (
    <RequirePermission permission="admin.settings.manage">
      <PageHeader title="Settings" description="Platform settings: signup alerts, default limits, grace days and seat caps." />
      <ComingSoon task="BO28">Signup-alert recipients, default limits, default grace days, pending seat cap and expiry notice days.</ComingSoon>
    </RequirePermission>
  );
}
