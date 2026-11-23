'use client';

/**
 * Staff auth context (Slice BO, BO16; api-contracts §12.1).
 *
 * status: 'loading' (restoring the session from the refresh cookie) | 'authenticated' | 'anonymous'.
 * Sign-in is two steps: `login()` / `setupAccount()` return a TOTP challenge, then
 * `completeTotp()` turns a 6-digit code into a session. Permissions come from the API
 * (`staff.permissions`); the UI only uses them to hide what the API would refuse anyway.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearAccessToken,
  onSessionCleared,
  refreshSession,
  setAccessToken,
  staffAuth,
} from '@/lib/api';

export const STAFF_PERMISSIONS = Object.freeze({
  CUSTOMERS_READ: 'admin.customers.read',
  CUSTOMERS_VERIFY: 'admin.customers.verify',
  SUBSCRIPTIONS_WRITE: 'admin.subscriptions.write',
  CUSTOMERS_SUSPEND: 'admin.customers.suspend',
  AUDIT_READ: 'admin.audit.read',
  STAFF_MANAGE: 'admin.staff.manage',
  SETTINGS_MANAGE: 'admin.settings.manage',
});

export const ROLE_LABELS = Object.freeze({
  SUPER_ADMIN: 'Super admin',
  OPS: 'Operations',
  SUPPORT: 'Support',
});

const AuthContext = createContext(null);

// One restore per page load, shared by React strict mode's double effect run: two parallel
// refreshes would rotate the cookie twice and the second would look like a replay.
let restorePromise = null;

async function restoreSession() {
  await refreshSession();
  return staffAuth.me();
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [staff, setStaff] = useState(null);
  const [session, setSession] = useState(null);
  const mounted = useRef(true);

  const signOutLocally = useCallback(() => {
    clearAccessToken();
    setStaff(null);
    setSession(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    mounted.current = true;
    onSessionCleared(() => {
      if (mounted.current) signOutLocally();
    });
    if (!restorePromise) {
      restorePromise = restoreSession().finally(() => {
        // Later mounts (after logout + login) must not reuse this result.
        setTimeout(() => {
          restorePromise = null;
        }, 0);
      });
    }
    restorePromise
      .then((data) => {
        if (!mounted.current) return;
        setStaff(data?.staff ?? null);
        setSession(data?.session ?? null);
        setStatus(data?.staff ? 'authenticated' : 'anonymous');
      })
      .catch(() => {
        if (mounted.current) signOutLocally();
      });
    return () => {
      mounted.current = false;
      onSessionCleared(null);
    };
  }, [signOutLocally]);

  // Re-check the session when the tab comes back into focus (at most once a minute), so a
  // disabled account, a TOTP reset or the 12-hour limit sign the tab out without a page action.
  // An expired access token is refreshed on the way (api() retries once after /auth/refresh).
  useEffect(() => {
    if (status !== 'authenticated') return undefined;
    let lastCheck = Date.now();
    const recheck = () => {
      if (document.visibilityState === 'hidden' || Date.now() - lastCheck < 60_000) return;
      lastCheck = Date.now();
      staffAuth
        .me()
        .then((data) => {
          if (!mounted.current) return;
          setStaff(data.staff);
          setSession(data.session);
        })
        .catch(() => {
          // A failed refresh already signed out through onSessionCleared; network errors wait.
        });
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [status]);

  /** Password step → `{ stage, challengeToken, expiresIn }`. */
  const login = useCallback((email, password) => staffAuth.login(email.trim(), password), []);

  /** One-time setup link → `{ stage: 'totp_enrol', challengeToken, expiresIn }`. */
  const setupAccount = useCallback((token, password) => staffAuth.setup(token, password), []);

  /** TOTP step → starts the session (refresh cookie set by the API). */
  const completeTotp = useCallback(async (challengeToken, code) => {
    const data = await staffAuth.verify(challengeToken, code);
    setAccessToken(data.accessToken);
    setStaff(data.staff);
    setSession(data.session);
    setStatus('authenticated');
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await staffAuth.logout();
    } catch {
      // Logout is idempotent; the local session ends either way.
    }
    signOutLocally();
  }, [signOutLocally]);

  /** Re-reads `/auth/me` (e.g. after a role change). */
  const reload = useCallback(async () => {
    const data = await staffAuth.me();
    setStaff(data.staff);
    setSession(data.session);
    return data;
  }, []);

  const value = useMemo(() => {
    const permissions = staff?.permissions ?? [];
    return {
      status,
      me: staff,
      staff,
      session,
      role: staff?.role ?? null,
      permissions,
      can: (permission) => permissions.includes(permission),
      login,
      setupAccount,
      completeTotp,
      logout,
      reload,
    };
  }, [status, staff, session, login, setupAccount, completeTotp, logout, reload]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
