import { PageHeader, RequirePermission } from '@/components/shell/page';
import { HomeDashboard } from './home-dashboard';

export const metadata = { title: 'Home' };

export default function Page() {
  return (
    <RequirePermission permission="admin.customers.read">
      <PageHeader title="Home" description="Pending verifications, recent signups and subscriptions that need attention." />
      <HomeDashboard />
    </RequirePermission>
  );
}
