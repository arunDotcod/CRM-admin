import { ComingSoon, PageHeader, RequirePermission } from '@/components/shell/page';

export const metadata = { title: 'New customer' };

export default function Page() {
  return (
    <RequirePermission permission="admin.customers.verify">
      <PageHeader title="New customer" description="Create an organization, its owner and the first subscription." />
      <ComingSoon task="BO28">Organization, business profile, owner and subscription form. The owner gets a set-password email.</ComingSoon>
    </RequirePermission>
  );
}
