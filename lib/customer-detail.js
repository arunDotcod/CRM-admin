/**
 * Customer detail, lifecycle actions and subscriptions (BO18, BO28; api-contracts §12.3–§12.5,
 * §12.7). API wrappers, which action a staff member may see in which state, error copy for the
 * dialogs and the inbound-voice outcome text.
 */
import { api } from '@/lib/api';
import { STAFF_PERMISSIONS } from '@/lib/auth';

const enc = encodeURIComponent;

// ------------------------------------------------------------------ API

export const customerApi = {
  detail: (id) => api(`/customers/${enc(id)}`),
  workspace: (id) => api(`/customers/${enc(id)}/workspace`),
  usage: (id, months = 6) => api(`/customers/${enc(id)}/usage?months=${months}`),
  activity: (id, { actor, cursor, limit = 25 } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (actor && actor !== 'all') params.set('actor', actor);
    if (cursor) params.set('cursor', cursor);
    return api(`/customers/${enc(id)}/activity?${params}`);
  },
  settings: () => api('/settings'),

  create: (body) => api('/customers', { method: 'POST', body }),
  updateProfile: (id, body) => api(`/customers/${enc(id)}/profile`, { method: 'PUT', body }),
  verify: (id, body) => api(`/customers/${enc(id)}/verify`, { method: 'POST', body }),
  reject: (id, body) => api(`/customers/${enc(id)}/reject`, { method: 'POST', body }),
  reopen: (id, body) => api(`/customers/${enc(id)}/reopen`, { method: 'POST', body }),
  suspend: (id, body) => api(`/customers/${enc(id)}/suspend`, { method: 'POST', body }),
  reactivate: (id) => api(`/customers/${enc(id)}/reactivate`, { method: 'POST', body: {} }),
  resendLink: (id) => api(`/customers/${enc(id)}/resend-link`, { method: 'POST', body: {} }),
  markEmailConfirmed: (id, body) =>
    api(`/customers/${enc(id)}/mark-email-confirmed`, { method: 'POST', body }),

  createSubscription: (id, body) => api(`/customers/${enc(id)}/subscriptions`, { method: 'POST', body }),
  updateSubscription: (subId, body) => api(`/subscriptions/${enc(subId)}`, { method: 'PUT', body }),
  cancelSubscription: (subId, body) => api(`/subscriptions/${enc(subId)}/cancel`, { method: 'POST', body }),
};

// ------------------------------------------------------------------ what a staff member can do

/**
 * The lifecycle actions to show for this customer, by state and permission (the API enforces
 * the same). SUPPORT has none of these permissions, so it sees no actions.
 */
export function availableActions(detail, can) {
  if (!detail) return {};
  const verify = can(STAFF_PERMISSIONS.CUSTOMERS_VERIFY);
  const subs = can(STAFF_PERMISSIONS.SUBSCRIPTIONS_WRITE);
  const suspend = can(STAFF_PERMISSIONS.CUSTOMERS_SUSPEND);
  const owner = detail.owner;
  const unconfirmed = Boolean(owner && !owner.emailConfirmed);
  return {
    verify: verify && subs && detail.verification === 'PENDING',
    reject: verify && detail.verification === 'PENDING',
    reopen: verify && detail.verification === 'REJECTED',
    suspend: suspend && detail.status === 'ACTIVE',
    reactivate: suspend && detail.status === 'SUSPENDED',
    // No password yet (set-password link pending) or email not confirmed yet.
    resendLink: verify && Boolean(owner) && (unconfirmed || detail.pendingLink?.purpose === 'SET_PASSWORD'),
    markEmailConfirmed: verify && unconfirmed,
    editProfile: verify,
    subscriptions: subs,
  };
}

// ------------------------------------------------------------------ error copy

const INVALID_STATE_COPY = {
  not_pending: 'This signup is no longer pending. Someone may have just verified or rejected it.',
  not_rejected: 'This signup is not rejected any more.',
  not_verified: 'Subscriptions can only be added once the customer is verified.',
  already_suspended: 'This customer is already suspended.',
  not_suspended: 'This customer is not suspended.',
  email_already_confirmed: "The owner's email is already confirmed and their password is set. No link is needed.",
  subscription_canceled: 'This subscription is already canceled.',
  subscription_ended: 'This subscription has ended (period and grace are over), so it can no longer be edited.',
  no_owner: 'This customer has no active owner.',
};

const FIELD_REASON_COPY = {
  ends_before_starts: 'The end date must be after the start date.',
  start_too_old: 'The start can be at most 24 hours in the past.',
  channels_invalid: 'Pick each channel at most once.',
  invalid_email: 'Enter a valid email address.',
};

function waitCopy(seconds) {
  const s = Math.max(1, Number(seconds) || 60);
  return s >= 90 ? `${Math.ceil(s / 60)} minutes` : `${s} seconds`;
}

function fieldMessage(detail) {
  if (detail.reason && FIELD_REASON_COPY[detail.reason]) return FIELD_REASON_COPY[detail.reason];
  const text = String(detail.message || '');
  const tail = text.includes(': ') ? text.slice(text.indexOf(': ') + 2) : text;
  if (tail === 'Value is too short') return 'Required.';
  if (tail === 'Value is too long') return 'Too long.';
  if (tail === 'Invalid type') return 'Enter a valid value.';
  if (tail === 'Invalid format') return 'Invalid format.';
  if (tail === 'Unexpected field') return 'Not accepted here.';
  return tail || 'Invalid value.';
}

/**
 * ApiError → `{ message, fieldErrors }` for a dialog. `fieldErrors` is keyed by the API's
 * field path (`subscription.endsAt`, `owner.email`, `limits.maxSeats`, …).
 */
export function describeError(error) {
  const details = error?.details || [];
  const first = details[0] || {};
  const fieldErrors = {};
  switch (error?.code) {
    case 'INVALID_STATE':
      return {
        message: INVALID_STATE_COPY[first.reason] || 'That action is not allowed in the current state.',
        fieldErrors,
        refetch: true,
      };
    case 'CONFLICT':
      if (first.reason === 'subscription_overlap')
        return {
          message: `These dates overlap another subscription${first.subscriptionId ? ` (${first.subscriptionId})` : ''}. Start after it ends, or cancel it first.`,
          fieldErrors,
        };
      if (first.reason === 'owner_email_unavailable')
        return { message: 'That email belongs to a deleted account and cannot be used as the owner.', fieldErrors: { 'owner.email': 'Use another email.' } };
      return { message: 'That conflicts with existing data.', fieldErrors };
    case 'VALIDATION_ERROR': {
      for (const item of details) if (item?.field) fieldErrors[item.field] ??= fieldMessage(item);
      const count = Object.keys(fieldErrors).length;
      return {
        message: count ? 'Check the highlighted fields.' : error.message || 'Check the form and try again.',
        fieldErrors,
      };
    }
    case 'RATE_LIMITED':
      if (first.reason === 'link_resend')
        return {
          message: `Links can be resent 5 times an hour per customer. Try again in ${waitCopy(first.retryAfterSeconds)}.`,
          fieldErrors,
        };
      if (first.reason === 'admin_writes')
        return { message: `Too many changes in a minute. Wait ${waitCopy(first.retryAfterSeconds)} and try again.`, fieldErrors };
      return {
        message: first.retryAfterSeconds
          ? `Too many requests. Wait ${waitCopy(first.retryAfterSeconds)} and try again.`
          : 'Too many requests right now. Wait a minute and try again.',
        fieldErrors,
      };
    case 'FORBIDDEN':
      return { message: "You don't have permission to do that.", fieldErrors };
    case 'NOT_FOUND':
      return { message: 'This customer (or subscription) no longer exists.', fieldErrors };
    default:
      return { message: error?.message || 'Something went wrong. Try again.', fieldErrors };
  }
}

/** Field errors under `prefix` with the prefix stripped (`subscription.endsAt` → `endsAt`). */
export function scopedErrors(fieldErrors, prefix) {
  const out = {};
  for (const [key, value] of Object.entries(fieldErrors || {})) {
    if (key.startsWith(prefix)) out[key.slice(prefix.length)] = value;
  }
  return out;
}

// ------------------------------------------------------------------ inbound voice

/**
 * The `inboundVoice` outcome of a lifecycle / subscription write → `{ tone, text }` or null
 * when there is nothing worth telling (no voice numbers, voice not configured).
 */
export function inboundVoiceOutcome(outcome) {
  if (!outcome) return null;
  const n = (count) => `${count} number${count === 1 ? '' : 's'}`;
  switch (outcome.action) {
    case 'paused':
      if (outcome.unconfirmed > 0)
        return {
          tone: 'warning',
          text: `Inbound voice paused on ${n(outcome.detached)}, but couldn't confirm ${n(outcome.unconfirmed)}. Check the voice provider.`,
        };
      return { tone: 'info', text: `Inbound voice paused on ${n(outcome.detached)}.` };
    case 'resumed':
      if (outcome.restored < outcome.requested)
        return {
          tone: 'warning',
          text: `Inbound voice resumed on ${outcome.restored} of ${n(outcome.requested)}. The rest couldn't be restored.`,
        };
      return { tone: 'info', text: `Inbound voice resumed on ${n(outcome.restored)}.` };
    case 'kept_paused':
      return { tone: 'info', text: `Inbound voice stays paused: the customer is ${String(outcome.state || '').toLowerCase()} and the plan doesn't allow inbound calls now.` };
    case 'failed':
      return { tone: 'warning', text: `Couldn't confirm the inbound voice change (${outcome.code || 'provider error'}). Check the voice provider.` };
    default:
      return null;
  }
}

// ------------------------------------------------------------------ labels

export const OVER_LIMIT_COPY = {
  max_ai_employees: 'More AI employees than the plan allows',
  max_seats: 'More seats in use than the plan allows',
  channel_not_in_plan: 'A connected channel is not in the plan',
  ai_monthly_replies: 'AI replies are over the monthly limit',
  voice_monthly_minutes: 'Voice minutes are over the monthly limit',
};

export const SUBSCRIPTION_STATUS_META = {
  SCHEDULED: { label: 'Scheduled', className: 'border-sky-200 bg-sky-50 text-sky-800' },
  CURRENT: { label: 'Current', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  GRACE: { label: 'Grace', className: 'border-orange-200 bg-orange-50 text-orange-800' },
  ENDED: { label: 'Ended', className: 'border-slate-300 bg-slate-100 text-slate-700' },
  CANCELED: { label: 'Canceled', className: 'border-red-200 bg-red-50 text-red-700' },
};

/** Limits below what the customer already uses (Edit / Add dialogs warn before saving). */
export function limitWarnings(limits, detail) {
  if (!limits || !detail) return [];
  const out = [];
  if (Number(limits.maxAiEmployees) < (detail.aiEmployees ?? 0))
    out.push(`The customer has ${detail.aiEmployees} AI employees; the limit here is ${limits.maxAiEmployees}. Existing employees keep working, but they can't create more.`);
  if (Number(limits.maxSeats) < (detail.seatsUsed ?? 0))
    out.push(`${detail.seatsUsed} seats are in use; the limit here is ${limits.maxSeats}. Nobody is removed, but no new invites until they're under it.`);
  const missing = (detail.connectedChannels || []).filter((c) => !(limits.channels || []).includes(c));
  if (missing.length)
    out.push(`Connected channel${missing.length === 1 ? '' : 's'} not in the plan: ${missing.join(', ')}. AI replies on ${missing.length === 1 ? 'it' : 'them'} will stop.`);
  return out;
}

const ACTION_LABELS = {
  'admin.customer_created': 'Customer created by staff',
  'admin.customer_verified': 'Verified',
  'admin.customer_rejected': 'Rejected',
  'admin.customer_reopened': 'Reopened',
  'admin.customer_suspended': 'Suspended',
  'admin.customer_reactivated': 'Reactivated',
  'admin.customer_profile_updated': 'Profile edited',
  'admin.customer_link_resent': 'Owner link resent',
  'admin.customer_email_marked_confirmed': 'Email marked confirmed',
  'admin.customer_voice_paused': 'Inbound voice paused',
  'admin.customer_voice_resumed': 'Inbound voice resumed',
  'admin.subscription_created': 'Subscription added',
  'admin.subscription_updated': 'Subscription edited',
  'admin.subscription_canceled': 'Subscription canceled',
};

export function actionLabel(action) {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const text = String(action || '').replace(/^admin\./, '').replace(/[._]/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Micro-units (1e-6) of USD → "$1.23". */
export function formatMicros(micros) {
  if (typeof micros !== 'number') return '—';
  const value = micros / 1_000_000;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: value < 1 ? 4 : 2 })}`;
}

export function formatMonth(month) {
  if (!/^\d{4}-\d{2}$/.test(month || '')) return month || '—';
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
