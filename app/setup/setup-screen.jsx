'use client';

/**
 * One-time staff setup link (`/setup?token=…`, from `yarn admin:create-staff` or a staff invite;
 * api-contracts §12.1 POST /admin/auth/setup): set a password, then enrol TOTP.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuthCard } from '@/components/auth/auth-card';
import { TotpStep } from '@/components/auth/totp-step';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';

const MIN_PASSWORD = 12;
const MAX_PASSWORD = 200;

export function SetupScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { setupAccount } = useAuth();
  const [token, setToken] = useState(() => params.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [challenge, setChallenge] = useState(null);

  // Drop the token from the address bar (and history) once it is in memory.
  useEffect(() => {
    if (params.get('token')) window.history.replaceState(null, '', '/setup');
  }, [params]);

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const mismatch = confirm.length > 0 && confirm !== password;

  const onSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
      setError(`Use a password of ${MIN_PASSWORD} to ${MAX_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const next = await setupAccount(token, password);
      setPassword('');
      setConfirm('');
      // The link is single use: forget it now.
      setToken('');
      setChallenge(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!token && !challenge) {
    return (
      <AuthCard
        title="Setup link missing"
        description="Open the full setup link from your invitation email. It is valid for 72 hours and works once."
      >
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  if (challenge) {
    return (
      <AuthCard
        title="Set up two-step verification"
        description="Your password is saved. Finish by linking an authenticator app."
        footer="Dotcod staff only. Every action is audited."
      >
        <TotpStep
          challenge={challenge}
          onSignedIn={() => router.replace('/')}
          onRestart={() => router.replace('/login')}
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set up your staff account"
      description="Choose a password for Dotcod Admin. Next you will link an authenticator app."
      footer="Dotcod staff only. Every action is audited."
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby="password-hint"
            aria-invalid={tooShort || undefined}
            autoFocus
            required
          />
          <p id="password-hint" className={tooShort ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
            At least {MIN_PASSWORD} characters.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            aria-invalid={mismatch || undefined}
            required
          />
          {mismatch ? <p className="text-xs text-destructive">The passwords do not match.</p> : null}
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button
          type="submit"
          className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
          disabled={submitting || !password || !confirm}
        >
          {submitting ? <Loader2 className="animate-spin" /> : null}
          Save password and continue
        </Button>
      </form>
    </AuthCard>
  );
}
