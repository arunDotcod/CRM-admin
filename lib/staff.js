/**
 * Staff management helpers (Slice BO, BO19; api-contracts §12.6): labels, role descriptions and
 * the error copy for the staff writes. The API enforces every rule; this only explains them.
 */
import { api } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/auth';

export const ROLES = ['SUPER_ADMIN', 'OPS', 'SUPPORT'];

export const ROLE_DESCRIPTIONS = Object.freeze({
  SUPER_ADMIN: 'Everything, plus staff and platform settings.',
  OPS: 'Verify and reject signups, create customers, manage subscriptions and suspend accounts.',
  SUPPORT: 'Read-only: customers, usage and subscriptions.',
});

export const STATUS_LABELS = Object.freeze({
  ACTIVE: 'Active',
  INVITED: 'Setup pending',
  DISABLED: 'Disabled',
});

export function roleLabel(role) {
  return ROLE_LABELS[role] || role || '—';
}

/** Calls for §12.6. Invite and resend-setup answer `Staff + { setupUrl, setupExpiresAt }`. */
export const staffApi = {
  list: () => api('/staff'),
  invite: (body) => api('/staff', { method: 'POST', body }),
  update: (id, body) => api(`/staff/${encodeURIComponent(id)}`, { method: 'PUT', body }),
  disable: (id) => api(`/staff/${encodeURIComponent(id)}/disable`, { method: 'POST', body: {} }),
  enable: (id) => api(`/staff/${encodeURIComponent(id)}/enable`, { method: 'POST', body: {} }),
  resetTotp: (id) => api(`/staff/${encodeURIComponent(id)}/reset-totp`, { method: 'POST', body: {} }),
  resendSetup: (id) => api(`/staff/${encodeURIComponent(id)}/resend-setup`, { method: 'POST', body: {} }),
};

/**
 * Human copy for a failed staff write. `action` is one of invite | role | disable | enable |
 * reset-totp | resend-setup; `target` is the staff row (for names in the message).
 */
export function staffErrorMessage(action, error, target) {
  const who = target?.name || 'This person';
  if (error?.code === 'FORBIDDEN' && error.reason === 'self_action') {
    if (action === 'role')
      return "You can't remove your own super admin role. Ask another super admin to change it.";
    if (action === 'disable') return "You can't disable your own account. Ask another super admin to do it.";
    return "You can't do that to your own account.";
  }
  if (error?.code === 'INVALID_STATE') {
    if (error.reason === 'last_super_admin')
      return `${who} is the only active super admin. Make someone else a super admin first, then try again.`;
    if (error.reason === 'not_invited')
      return `${who} has already finished setup, so there is no setup link to resend. Use "Reset two-step verification" if they lost their authenticator.`;
  }
  if (error?.code === 'CONFLICT' && error.reason === 'staff_email_taken')
    return 'A staff member with this email already exists.';
  if (error?.code === 'NOT_FOUND') return 'This staff member no longer exists. Refresh the list.';
  if (error?.code === 'RATE_LIMITED') return 'Too many changes in a minute. Wait a moment and try again.';
  return error?.message || 'Something went wrong. Try again.';
}

/** `{ field: message }` from a VALIDATION_ERROR on the invite form. */
export function inviteFieldErrors(error) {
  if (error?.code !== 'VALIDATION_ERROR') return {};
  const out = {};
  for (const item of error.details || []) {
    const field = String(item?.field || '').split('.')[0];
    if (field === 'email') out.email = 'Enter a valid email address.';
    else if (field === 'name') out.name = 'Enter a name (one line, up to 160 characters).';
    else if (field === 'role') out.role = 'Choose a role.';
  }
  return out;
}
