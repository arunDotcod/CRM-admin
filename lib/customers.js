/**
 * Customer list helpers (BO17): the filters that live in the URL query string, the matching
 * `/admin/customers` query (api-contracts §12.2), Home tile links and display formatting.
 */

export const VERIFICATIONS = ['PENDING', 'VERIFIED', 'REJECTED'];
export const STATES = ['PENDING', 'REJECTED', 'ACTIVE', 'GRACE', 'EXPIRED', 'SUSPENDED'];
export const CHANNELS = ['WHATSAPP', 'WEBCHAT', 'INSTAGRAM', 'VOICE'];
export const CHANNEL_LABELS = {
  WHATSAPP: 'WhatsApp',
  WEBCHAT: 'Web chat',
  INSTAGRAM: 'Instagram',
  VOICE: 'Voice',
};

export const SORTS = [
  { value: '-signupAt', label: 'Newest signups' },
  { value: 'signupAt', label: 'Oldest signups' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'periodEndsAt', label: 'Period ends soonest' },
  { value: '-aiRepliesUsed', label: 'Most AI replies' },
];
export const DEFAULT_SORT = '-signupAt';

export const PAGE_SIZE = 25;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** URLSearchParams (or a plain object) → normalised filter object. Unknown values are dropped. */
export function readFilters(params) {
  const get = (key) => (typeof params.get === 'function' ? params.get(key) : params[key]) ?? '';
  const getAll = (key) => {
    if (typeof params.getAll === 'function') return params.getAll(key);
    const value = params[key];
    return Array.isArray(value) ? value : value ? [value] : [];
  };
  const pick = (values, allowed) => [...new Set(values.filter((v) => allowed.includes(v)))];
  // A real calendar day only (the API's regex lets `2026-13-45` through and then fails with 500).
  const date = (value) => {
    if (!DATE_RE.test(value)) return '';
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : '';
  };
  const queue = ['pending', 'unconfirmed'].includes(get('queue')) ? get('queue') : '';
  const sort = SORTS.some((s) => s.value === get('sort')) ? get('sort') : '';
  const periodEndsBefore = get('periodEndsBefore');
  return {
    q: get('q').slice(0, 120),
    verification: pick(getAll('verification'), VERIFICATIONS),
    state: pick(getAll('state'), STATES),
    emailConfirmed: ['true', 'false'].includes(get('emailConfirmed')) ? get('emailConfirmed') : '',
    source: ['self_serve', 'staff'].includes(get('source')) ? get('source') : '',
    channel: CHANNELS.includes(get('channel')) ? get('channel') : '',
    signupFrom: date(get('signupFrom')),
    signupTo: date(get('signupTo')),
    periodEndsBefore:
      periodEndsBefore && !Number.isNaN(Date.parse(periodEndsBefore)) ? periodEndsBefore : '',
    queue,
    sort,
  };
}

/** Filter object → query string (no leading `?`), in a stable order. Empty values are left out. */
export function filtersToQuery(filters, extra = {}) {
  const params = new URLSearchParams();
  const add = (key, value) => {
    if (value === '' || value == null) return;
    params.append(key, String(value));
  };
  add('q', filters.q?.trim());
  add('queue', filters.queue);
  for (const v of filters.verification || []) add('verification', v);
  for (const v of filters.state || []) add('state', v);
  add('emailConfirmed', filters.emailConfirmed);
  add('source', filters.source);
  add('channel', filters.channel);
  add('signupFrom', filters.signupFrom);
  add('signupTo', filters.signupTo);
  add('periodEndsBefore', filters.periodEndsBefore);
  add('sort', filters.sort);
  for (const [key, value] of Object.entries(extra)) add(key, value);
  return params.toString();
}

/** How many filters (not search or sort) are on, for the "Filters (n)" label and clear button. */
export function activeFilterCount(filters) {
  return (
    (filters.queue ? 1 : 0) +
    filters.verification.length +
    filters.state.length +
    (filters.emailConfirmed ? 1 : 0) +
    (filters.source ? 1 : 0) +
    (filters.channel ? 1 : 0) +
    (filters.signupFrom ? 1 : 0) +
    (filters.signupTo ? 1 : 0) +
    (filters.periodEndsBefore ? 1 : 0)
  );
}

function utcDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * `/customers?…` links for the Home tiles. They mirror the dashboard counters (BO11) as closely
 * as the list filters allow: "signups last N days" uses whole UTC days (the counter is a rolling
 * N × 24 h window) and "expiring soon" rounds the window end up to the next minute.
 */
export function tileLinks(dashboard, now = new Date()) {
  const days = (n) => new Date(now.getTime() - n * 86_400_000);
  const notice = Number(dashboard?.expiryNoticeDays) || 7;
  const soon = new Date(now.getTime() + notice * 86_400_000 + 60_000);
  soon.setUTCSeconds(0, 0);
  const href = (query) => `/customers?${query}`;
  return {
    pendingVerification: href('queue=pending'),
    unconfirmedSignups: href('queue=unconfirmed'),
    signups7: href(`source=self_serve&signupFrom=${utcDate(days(7))}`),
    signups30: href(`source=self_serve&signupFrom=${utcDate(days(30))}`),
    expiringSoon: href(
      `state=ACTIVE&periodEndsBefore=${encodeURIComponent(soon.toISOString())}&sort=periodEndsAt`,
    ),
    inGrace: href('state=GRACE&sort=periodEndsAt'),
    paused: href('state=EXPIRED'),
    suspended: href('state=SUSPENDED'),
  };
}

// ------------------------------------------------------------------ formatting

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : dateFmt.format(date);
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFmt.format(date);
}

/** "3 min ago", "5 h ago", "2 d ago", else the date. */
export function formatRelative(iso, now = Date.now()) {
  if (!iso) return 'Never';
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '—';
  const diff = Math.max(0, now - time);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'Just now';
  if (diff < hour) return `${Math.floor(diff / minute)} min ago`;
  if (diff < day) return `${Math.floor(diff / hour)} h ago`;
  if (diff < 30 * day) return `${Math.floor(diff / day)} d ago`;
  return formatDate(iso);
}

/** Whole days from now until `iso` (negative when past). */
export function daysUntil(iso, now = Date.now()) {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  return Math.ceil((time - now) / 86_400_000);
}

export function formatNumber(value) {
  return typeof value === 'number' ? value.toLocaleString('en-IN') : '—';
}
