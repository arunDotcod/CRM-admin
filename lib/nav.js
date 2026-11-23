import { Building2, Home, ScrollText, Settings, Users } from 'lucide-react';
import { STAFF_PERMISSIONS } from '@/lib/auth';

/**
 * Sidebar items. `permission` hides the item for staff who lack it (the API enforces the same
 * permission on every route; this only keeps the UI honest). api-contracts §12 role table.
 */
export const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home, permission: STAFF_PERMISSIONS.CUSTOMERS_READ, exact: true },
  { href: '/customers', label: 'Customers', icon: Building2, permission: STAFF_PERMISSIONS.CUSTOMERS_READ },
  { href: '/staff', label: 'Staff', icon: Users, permission: STAFF_PERMISSIONS.STAFF_MANAGE },
  { href: '/audit', label: 'Audit log', icon: ScrollText, permission: STAFF_PERMISSIONS.AUDIT_READ },
  { href: '/settings', label: 'Settings', icon: Settings, permission: STAFF_PERMISSIONS.SETTINGS_MANAGE },
];

export function isActive(item, pathname) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
