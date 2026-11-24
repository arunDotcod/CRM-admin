import { PageHeader, RequirePermission } from '@/components/shell/page';
import { SettingsForm } from '@/components/settings/settings-form';

export const metadata = { title: 'Settings' };

export default function Page() {
  return (
    <RequirePermission permission="admin.settings.manage">
      <PageHeader title="Settings" description="Platform settings: signup alerts, default limits, grace days and seat caps." />
      <SettingsForm />
    </RequirePermission>
  );
}
