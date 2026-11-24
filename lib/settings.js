/**
 * Platform settings (Slice BO, BO28 Settings; api-contracts §12.7, plan decision 17). Ranges mirror
 * `PLATFORM_SETTING_SCHEMAS` in the backend; the API is the authority.
 */
import { api } from '@/lib/api';

export const settingsApi = {
  get: () => api('/settings'),
  update: (body) => api('/settings', { method: 'PUT', body }),
};

export const MAX_ALERT_EMAILS = 20;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Number fields: form key → { label, min, max, path (API field), help }. */
export const LIMIT_FIELDS = [
  { key: 'aiMonthlyReplies', label: 'AI replies / month', min: 0, max: 10_000_000 },
  { key: 'voiceMonthlyMinutes', label: 'Voice minutes / month', min: 0, max: 1_000_000 },
  { key: 'maxAiEmployees', label: 'AI employees', min: 0, max: 1000 },
  { key: 'maxSeats', label: 'Seats', min: 1, max: 10_000 },
  { key: 'periodDays', label: 'Period length (days)', min: 1, max: 3660 },
];

export const POLICY_FIELDS = [
  {
    key: 'graceDaysDefault',
    label: 'Default grace days',
    min: 0,
    max: 90,
    help: 'Days the AI keeps working after a period ends, unless a subscription sets its own.',
  },
  {
    key: 'pendingMaxSeats',
    label: 'Seats while pending',
    min: 1,
    max: 50,
    help: 'Team members an unverified organization may have.',
  },
  {
    key: 'expiryNoticeDays',
    label: 'Expiry notice (days before)',
    min: 1,
    max: 60,
    help: 'When the owner gets the "subscription ending soon" email.',
  },
];

export function isEmail(value) {
  return value.length <= 320 && EMAIL_RE.test(value);
}

/** API settings → form state (numbers as strings so fields can be empty while typing). */
export function toForm(settings) {
  const limits = settings?.defaultLimits || {};
  const form = {
    signupAlertEmails: [...(settings?.signupAlertEmails || [])],
    channels: [...(limits.channels || [])],
    openEnded: Boolean(limits.openEnded),
  };
  for (const field of LIMIT_FIELDS) form[field.key] = String(limits[field.key] ?? '');
  for (const field of POLICY_FIELDS) form[field.key] = String(settings?.[field.key] ?? '');
  return form;
}

function intOrNull(value) {
  if (!/^\d+$/.test(String(value).trim())) return null;
  return Number(value);
}

/** Client-side check; returns `{ errors, body }` (body only when there are no errors). */
export function validateForm(form) {
  const errors = {};
  const check = (field) => {
    const value = intOrNull(form[field.key]);
    if (value === null || value < field.min || value > field.max)
      errors[field.key] = `Enter a whole number from ${field.min.toLocaleString('en-IN')} to ${field.max.toLocaleString('en-IN')}.`;
    return value;
  };
  const limits = {};
  for (const field of LIMIT_FIELDS) limits[field.key] = check(field);
  const policy = {};
  for (const field of POLICY_FIELDS) policy[field.key] = check(field);
  if (form.signupAlertEmails.length > MAX_ALERT_EMAILS)
    errors.signupAlertEmails = `Up to ${MAX_ALERT_EMAILS} addresses.`;
  if (Object.keys(errors).length) return { errors, body: null };
  const { periodDays, ...rest } = limits;
  return {
    errors,
    body: {
      signupAlertEmails: form.signupAlertEmails,
      defaultLimits: { ...rest, channels: form.channels, periodDays, openEnded: form.openEnded },
      ...policy,
    },
  };
}

/**
 * VALIDATION_ERROR details → form errors. API fields: `signupAlertEmails.2`, `defaultLimits.maxSeats`,
 * `graceDaysDefault`, … (reason `invalid_email` / `unknown_setting`, or "Invalid value").
 */
export function apiFieldErrors(error, form) {
  const errors = {};
  for (const item of error?.details || []) {
    const field = String(item?.field || '');
    const [top, sub] = field.split('.');
    if (top === 'signupAlertEmails') {
      const index = Number(sub);
      const address = Number.isInteger(index) ? form.signupAlertEmails[index] : null;
      errors.signupAlertEmails =
        item.reason === 'invalid_email' || address
          ? `${address ? `“${address}” is` : 'An address is'} not a valid email address. Remove it and try again.`
          : 'Check the alert addresses.';
      if (address) errors.badEmail = address;
    } else if (top === 'defaultLimits') {
      const key = sub === 'channels' ? 'channels' : sub;
      errors[key || 'defaultLimits'] = sub === 'channels' ? 'Pick channels from the list (no duplicates).' : 'The server rejected this value.';
    } else if (top) {
      errors[top] = item.reason === 'unknown_setting' ? 'Unknown setting.' : 'The server rejected this value.';
    }
  }
  return errors;
}
