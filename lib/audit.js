/**
 * Admin audit log helpers (Slice BO, BO19; api-contracts §12.8): URL ↔ filters, action labels and
 * the metadata split into before / after / other.
 *
 * URL: `staff=staff-…`, `organization=org-…` (+ `orgName` for the chip label only), `action`
 * (prefix), `from` / `to` (YYYY-MM-DD, local days; sent as ISO instants).
 */

export const AUDIT_PAGE_SIZE = 50;

/** Action filter: prefixes first, then single actions. The API filters by prefix. */
export const ACTION_GROUPS = [
  {
    label: 'Groups',
    options: [
      { value: 'admin.customer', label: 'All customer actions' },
      { value: 'admin.subscription', label: 'All subscription actions' },
      { value: 'staff.', label: 'All staff account and sign-in events' },
      { value: 'admin.', label: 'All admin actions' },
    ],
  },
  {
    label: 'Customers',
    options: [
      'admin.customer_verified',
      'admin.customer_rejected',
      'admin.customer_reopened',
      'admin.customer_suspended',
      'admin.customer_reactivated',
      'admin.customer_created',
      'admin.customer_profile_updated',
      'admin.customer_email_marked_confirmed',
      'admin.customer_link_resent',
      'admin.customer_voice_paused',
      'admin.customer_voice_resumed',
      'admin.customers_exported',
    ].map((value) => ({ value })),
  },
  {
    label: 'Subscriptions',
    options: ['admin.subscription_created', 'admin.subscription_updated', 'admin.subscription_canceled'].map(
      (value) => ({ value }),
    ),
  },
  {
    label: 'Staff',
    options: [
      'staff.invited',
      'staff.updated',
      'staff.disabled',
      'staff.enabled',
      'staff.totp_reset',
      'staff.setup_resent',
      'staff.setup_completed',
      'staff.totp_enrolled',
      'staff.login',
      'staff.login_failed',
      'staff.locked',
      'staff.refresh_replay',
    ].map((value) => ({ value })),
  },
  { label: 'Settings', options: [{ value: 'admin.settings_updated' }] },
];

const ACTION_LABELS = {
  'admin.customer_verified': 'Customer verified',
  'admin.customer_rejected': 'Customer rejected',
  'admin.customer_reopened': 'Customer reopened',
  'admin.customer_suspended': 'Customer suspended',
  'admin.customer_reactivated': 'Customer reactivated',
  'admin.customer_created': 'Customer created',
  'admin.customer_profile_updated': 'Profile edited',
  'admin.customer_email_marked_confirmed': 'Email marked confirmed',
  'admin.customer_link_resent': 'Link resent',
  'admin.customer_voice_paused': 'Inbound voice paused',
  'admin.customer_voice_resumed': 'Inbound voice resumed',
  'admin.customers_exported': 'Customers exported (CSV)',
  'admin.subscription_created': 'Subscription created',
  'admin.subscription_updated': 'Subscription edited',
  'admin.subscription_canceled': 'Subscription canceled',
  'admin.settings_updated': 'Settings changed',
  'admin.email_failed': 'Email failed',
  'admin.owner_email_failed': 'Owner email failed',
  'admin.realtime_failed': 'Realtime notify failed',
  'admin.confirmation_followup_failed': 'Confirmation follow-up failed',
  'staff.invited': 'Staff invited',
  'staff.updated': 'Staff edited',
  'staff.disabled': 'Staff disabled',
  'staff.enabled': 'Staff enabled',
  'staff.totp_reset': 'Two-step reset',
  'staff.setup_resent': 'Setup link resent',
  'staff.setup_completed': 'Setup completed',
  'staff.totp_enrolled': 'Two-step enrolled',
  'staff.login': 'Signed in',
  'staff.logout': 'Signed out',
  'staff.login_failed': 'Sign-in failed',
  'staff.locked': 'Account locked',
  'staff.refresh_replay': 'Session replay blocked',
};

export function actionLabel(action) {
  return ACTION_LABELS[action] || action;
}

export function actionOptionLabel(option) {
  return option.label || actionLabel(option.value);
}

/** Tone for the action pill: red for failures / locks, amber for destructive staff moves. */
export function actionTone(action = '') {
  if (/failed|locked|replay/.test(action)) return 'red';
  if (/rejected|suspended|disabled|canceled|totp_reset|voice_paused/.test(action)) return 'amber';
  if (/verified|reactivated|enabled|created|completed|enrolled|voice_resumed/.test(action)) return 'green';
  return 'slate';
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const STAFF_RE = /^staff-[A-Za-z0-9_-]{1,80}$/;
const ORG_RE = /^org-[A-Za-z0-9_-]{1,80}$/;

function validDay(value) {
  if (!DAY_RE.test(value || '')) return '';
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? value : '';
}

export function readAuditFilters(params) {
  const staff = params.get('staff') || '';
  const organization = params.get('organization') || '';
  return {
    staff: STAFF_RE.test(staff) ? staff : '',
    organization: ORG_RE.test(organization) ? organization : '',
    orgName: organization ? (params.get('orgName') || '').slice(0, 160) : '',
    action: (params.get('action') || '').trim().slice(0, 100),
    from: validDay(params.get('from')),
    to: validDay(params.get('to')),
  };
}

/** The page's own URL query (keeps `orgName` for the chip). */
export function auditFiltersToUrl(filters) {
  const params = new URLSearchParams();
  for (const key of ['staff', 'organization', 'orgName', 'action', 'from', 'to']) {
    if (key === 'orgName' && !filters.organization) continue;
    if (filters[key]) params.set(key, filters[key]);
  }
  return params.toString();
}

function localDayStart(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** The API query: local days → ISO instants (`to` covers the whole day). */
export function auditFiltersToApi(filters, extra = {}) {
  const params = new URLSearchParams();
  if (filters.staff) params.set('staff', filters.staff);
  if (filters.organization) params.set('organization', filters.organization);
  if (filters.action) params.set('action', filters.action);
  if (filters.from) params.set('from', localDayStart(filters.from).toISOString());
  if (filters.to) {
    const end = localDayStart(filters.to);
    end.setDate(end.getDate() + 1);
    params.set('to', new Date(end.getTime() - 1).toISOString());
  }
  for (const [key, value] of Object.entries(extra)) if (value !== undefined && value !== null) params.set(key, String(value));
  return params.toString();
}

export function activeAuditFilterCount(filters) {
  return ['staff', 'organization', 'action', 'from', 'to'].filter((key) => filters[key]).length;
}

/**
 * Splits row metadata (§12.8, BO5): `{ before, after, fields }` of changed fields, the rest are
 * free-form codes. Returns `{ changes: [{ field, before, after, hasBefore, hasAfter }], other }`.
 */
export function splitMetadata(metadata) {
  const meta = metadata && typeof metadata === 'object' ? metadata : {};
  const { before, after, fields, ...other } = meta;
  const b = before && typeof before === 'object' ? before : {};
  const a = after && typeof after === 'object' ? after : {};
  const names = [];
  for (const name of [...(Array.isArray(fields) ? fields : []), ...Object.keys(b), ...Object.keys(a)]) {
    if (!names.includes(name)) names.push(name);
  }
  const changes = names.map((field) => ({
    field,
    before: b[field],
    after: a[field],
    hasBefore: Object.prototype.hasOwnProperty.call(b, field),
    hasAfter: Object.prototype.hasOwnProperty.call(a, field),
  }));
  return { changes, other };
}

export function hasDetails(metadata) {
  const { changes, other } = splitMetadata(metadata);
  return changes.length > 0 || Object.keys(other).length > 0;
}

export function formatValue(value) {
  if (value === undefined) return '—';
  if (value === null) return 'none';
  if (Array.isArray(value)) return value.length ? value.map(formatValue).join(', ') : '(empty)';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** A one-line summary for the table, from the metadata codes. */
export function summarize(item) {
  const { changes, other } = splitMetadata(item.metadata);
  if (changes.length) {
    const names = changes.map((change) => change.field);
    return `Changed ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3}` : ''}`;
  }
  const keys = Object.keys(other);
  if (!keys.length) return '';
  return keys
    .slice(0, 2)
    .map((key) => `${key}: ${formatValue(other[key])}`)
    .join(' · ');
}
