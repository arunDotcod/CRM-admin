/**
 * Admin API client (Slice BO, BO16). Modelled on CRM-Dotcod-AI/lib/api.js, but it only talks to
 * `/api/v1/admin/*` with a staff token (api-contracts §12). Paths passed in are relative to
 * `/api/v1/admin`, e.g. `api('/auth/me')`.
 *
 * - The access token (15 min) lives in memory only; the refresh token is the HttpOnly
 *   `dotcod_admin_rt` cookie, so every call sends credentials.
 * - A 401 on a session route triggers one refresh through `/auth/refresh` and one retry.
 *   Concurrent 401s share one refresh (rotation would otherwise trip the replay cascade).
 * - Errors become `ApiError { status, code, message, details, reason }` with human copy.
 */
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_ORIGIN || '').replace(/\/$/, '');
const API_BASE = `${API_ORIGIN}/api/v1/admin`;
export const REQUEST_TIMEOUT_MS = 10000;

/** Routes that never refresh-and-retry on 401: the sign-in steps themselves. */
const NO_REFRESH_PATHS = new Set([
  '/auth/login',
  '/auth/setup',
  '/auth/totp/enrol',
  '/auth/totp/verify',
  '/auth/refresh',
  '/auth/logout',
]);

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

export class ApiError extends Error {
  constructor({ status, code, message, details } = {}) {
    super(message || 'Request failed');
    this.name = 'ApiError';
    this.status = status ?? 0;
    this.code = code || 'INTERNAL_ERROR';
    this.details = Array.isArray(details) ? details : [];
    /** `details[0].reason` of UNAUTHORIZED / FORBIDDEN / INVALID_STATE answers, when present. */
    this.reason = this.details[0]?.reason ?? null;
  }
}

let accessToken = null;
let refreshInFlight = null;
let sessionClearedHandler = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token || null;
}

export function clearAccessToken() {
  accessToken = null;
}

/** Called once when a refresh fails and the session is gone (auth context signs out). */
export function onSessionCleared(handler) {
  sessionClearedHandler = handler;
}

function clearSession() {
  accessToken = null;
  sessionClearedHandler?.();
}

function minutes(seconds) {
  const value = Math.max(1, Math.ceil(Number(seconds || 0) / 60));
  return `${value} minute${value === 1 ? '' : 's'}`;
}

/** Human copy for the errors staff can actually hit (api-contracts §12 error table). */
export function humanMessage(path, error) {
  const first = error.details[0] || {};
  switch (error.code) {
    case 'NETWORK_ERROR':
      return 'Unable to reach the server. Try again.';
    case 'RATE_LIMITED':
      if (path.startsWith('/customers.csv'))
        return 'Exports are limited to 5 a minute. Wait a minute and try again.';
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'ORIGIN_NOT_ALLOWED':
      return 'This admin portal address is not allowed by the API (check ADMIN_PORTAL_ORIGIN).';
    case 'INVITE_INVALID':
      return 'This setup link is invalid, already used or has expired. Ask a super admin for a new one.';
    case 'STAFF_TOTP_REQUIRED':
      return first.stage === 'totp_enrol'
        ? 'Set up your authenticator app to continue.'
        : 'Enter the code from your authenticator app to continue.';
    case 'NOT_FOUND':
      if (path.startsWith('/auth/')) return 'The admin API is not enabled on this server.';
      return 'Not found.';
    case 'UNAUTHORIZED':
      switch (first.reason) {
        case 'invalid_credentials':
          return 'Invalid email or password.';
        case 'account_locked':
          return `Too many failed attempts. This account is locked for ${minutes(first.retryAfterSeconds)}.`;
        case 'staff_disabled':
          return 'This staff account has been disabled.';
        case 'session_expired':
          return 'Your session has ended (12-hour limit). Sign in again.';
        case 'totp_invalid':
          return 'That code is not valid. Check your authenticator app and try again.';
        default:
          if (path === '/auth/totp/enrol' || path === '/auth/totp/verify')
            return 'This sign-in attempt has expired. Start again.';
          return 'Your session has ended. Sign in again.';
      }
    case 'FORBIDDEN':
      if (first.reason === 'self_action') return 'You cannot do that to your own account.';
      return "You don't have permission to do that.";
    case 'VALIDATION_ERROR': {
      if (path === '/auth/setup') return 'Use a password of 12 to 200 characters.';
      if (path === '/auth/totp/verify') return 'Enter the 6-digit code.';
      const specifics = error.details
        .map((item) => item?.message)
        .filter((message) => typeof message === 'string' && message.length > 0);
      return specifics.length ? specifics.join('; ') : 'Check the highlighted fields.';
    }
    case 'INTERNAL_ERROR':
    case 'SERVICE_UNAVAILABLE':
      return 'Something went wrong on the server. Try again.';
    default:
      return error.message || 'Request failed';
  }
}

function requestSignal(timeoutMs = REQUEST_TIMEOUT_MS) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

async function readBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Calls the admin API and returns the envelope's `data`.
 * `token` overrides the bearer (a TOTP challenge token); `auth: false` sends none.
 */
export async function api(
  path,
  { method = 'GET', body, auth = true, token, retry = true, timeoutMs } = {},
) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const bearer = token ?? (auth ? accessToken : null);
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  let response;
  try {
    response = await fetch(apiUrl(path), {
      method,
      headers,
      credentials: 'include',
      cache: 'no-store',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: requestSignal(timeoutMs),
    });
  } catch {
    const error = new ApiError({ status: 0, code: 'NETWORK_ERROR' });
    error.message = humanMessage(path, error);
    throw error;
  }

  const payload = await readBody(response);
  const failed = !response.ok || payload?.success === false;
  if (!failed) return payload?.data ?? null;

  const err = payload?.error || {};
  const unreachable = !payload?.error;
  const apiError = new ApiError({
    status: response.status,
    code:
      err.code ||
      (response.status === 429 ? 'RATE_LIMITED' : unreachable ? 'NETWORK_ERROR' : 'INTERNAL_ERROR'),
    message: err.message,
    details: err.details,
  });
  apiError.message = humanMessage(path, apiError);

  const canRefresh =
    retry && auth && !token && response.status === 401 && !NO_REFRESH_PATHS.has(path);
  if (canRefresh) {
    try {
      await refreshSession();
    } catch {
      clearSession();
      throw apiError;
    }
    return api(path, { method, body, auth, retry: false, timeoutMs });
  }

  throw apiError;
}

/** Rotates the refresh cookie and stores the new access token. Concurrent callers share one call. */
export async function refreshSession() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const data = await api('/auth/refresh', { method: 'POST', body: {}, auth: false, retry: false });
    if (!data?.accessToken) throw new ApiError({ status: 401, code: 'UNAUTHORIZED' });
    setAccessToken(data.accessToken);
    return data;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

// ------------------------------------------------------------------ staff auth (§12.1)

export const staffAuth = {
  /** → { stage: 'totp_verify' | 'totp_enrol', challengeToken, expiresIn } */
  login: (email, password) =>
    api('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  /** One-time setup link → { stage: 'totp_enrol', challengeToken, expiresIn } */
  setup: (token, password) =>
    api('/auth/setup', { method: 'POST', body: { token, password }, auth: false }),
  /** → { otpauthUrl, secret, qrSvg } */
  enrol: (challengeToken) =>
    api('/auth/totp/enrol', { method: 'POST', body: {}, token: challengeToken }),
  /** → { accessToken, expiresIn, session, staff } and sets the refresh cookie */
  verify: (challengeToken, code) =>
    api('/auth/totp/verify', { method: 'POST', body: { code }, token: challengeToken }),
  logout: () => api('/auth/logout', { method: 'POST', body: {}, auth: false }),
  /** → { staff: { …Staff, permissions }, session: { id, absoluteExpiresAt } } */
  me: () => api('/auth/me'),
};

/**
 * Downloads a file route (e.g. `/customers.csv?…`) with the staff token and saves it in the
 * browser. Same refresh-and-retry rule as `api()`; JSON error bodies become `ApiError`.
 * Returns the saved file name.
 */
export async function apiDownload(path, { fallbackName = 'download', retry = true, timeoutMs = 60000 } = {}) {
  const headers = { Accept: 'text/csv, application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let response;
  try {
    response = await fetch(apiUrl(path), {
      headers,
      credentials: 'include',
      cache: 'no-store',
      signal: requestSignal(timeoutMs),
    });
  } catch {
    const error = new ApiError({ status: 0, code: 'NETWORK_ERROR' });
    error.message = humanMessage(path, error);
    throw error;
  }

  if (!response.ok) {
    const payload = await readBody(response);
    const err = payload?.error || {};
    const apiError = new ApiError({
      status: response.status,
      code: err.code || (response.status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR'),
      message: err.message,
      details: err.details,
    });
    apiError.message = humanMessage(path, apiError);
    if (retry && response.status === 401) {
      try {
        await refreshSession();
      } catch {
        clearSession();
        throw apiError;
      }
      return apiDownload(path, { fallbackName, retry: false, timeoutMs });
    }
    throw apiError;
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const name = match?.[1] || fallbackName;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}
