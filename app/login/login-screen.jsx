'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuthCard } from '@/components/auth/auth-card';
import { TotpStep } from '@/components/auth/totp-step';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { safeNext } from '@/lib/safe-next';

export function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const { status, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [challenge, setChallenge] = useState(null);

  // Already signed in (refresh cookie still valid): go straight in.
  useEffect(() => {
    if (status === 'authenticated' && !challenge) router.replace(next);
  }, [status, challenge, next, router]);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      setChallenge(await login(email, password));
      setPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (challenge) {
    const enrolling = challenge.stage === 'totp_enrol';
    return (
      <AuthCard
        title={enrolling ? 'Set up two-step verification' : 'Two-step verification'}
        description={enrolling ? 'One more step before your first sign-in.' : email}
        footer="Dotcod staff only. Every action is audited."
      >
        <TotpStep
          challenge={challenge}
          onSignedIn={() => router.replace(next)}
          onRestart={() => {
            setChallenge(null);
            setError(null);
          }}
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Sign in to Dotcod Admin"
      description="Back office for Dotcod staff. Customers sign in at the Dotcod portal."
      footer="Dotcod staff only. Every action is audited."
    >
      {status === 'loading' ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
        </div>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button
            type="submit"
            className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
            disabled={submitting || !email.trim() || !password}
          >
            {submitting ? <Loader2 className="animate-spin" /> : null}
            Continue
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            New staff member? Use the setup link a super admin sent you.
          </p>
        </form>
      )}
    </AuthCard>
  );
}
