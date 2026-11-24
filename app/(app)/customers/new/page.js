import { RequirePermission } from '@/components/shell/page';
import { NewCustomerForm } from './new-customer-form';

export const metadata = { title: 'New customer' };

export default function Page() {
  return (
    <RequirePermission permission="admin.customers.verify">
      <NewCustomerForm />
    </RequirePermission>
  );
}
