'use client';

/**
 * TOTP step of staff sign-in (api-contracts §12.1), shared by /login and /setup.
 *
 * - stage `totp_enrol`: asks the API for a new secret (POST /auth/totp/enrol) and shows the QR
 *   code and the base32 secret, then verifies the first code.
 * - stage `totp_verify`: asks for the current code.
 *
 * The challenge token is valid for 5 minutes and burns after 5 wrong codes; then the staff
 * member must start again (`onRestart`).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, KeyRound, Loader2, RotateCcw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Skeleton } from '@/components/ui/skeleton';
import { staffAuth } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/** Shows the base32 secret in groups of four so it can be typed by hand. */
function groupSecret(secret) {
  return (secret || '').replace(/(.{4})/g, '$1 ').trim();
}

function svgDataUri(svg) {
  // Rendered through <img>, so nothing in the SVG can run script in this page.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function TotpStep({ challenge, onSignedIn, onRestart }) {
  const { completeTotp } = useAuth();
  const enrolling = challenge.stage === 'totp_enrol';
  const [enrolment, setEnrolment] = useState(null);
  const [enrolError, setEnrolError] = useState(null);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [expired, setExpired] = useState(false);
  const [copied, setCopied] = useState(false);
  const requested = useRef(null);

  // Enrol once per challenge (strict mode runs effects twice; a second call would replace the
  // secret the QR code shows).
  useEffect(() => {
    if (!enrolling || requested.current === challenge.challengeToken) return;
    requested.current = challenge.challengeToken;
    staffAuth
      .enrol(challenge.challengeToken)
      .then(setEnrolment)
      .catch((err) => {
        setEnrolError(err.message);
        if (err.status === 401) setExpired(true);
      });
  }, [enrolling, challenge.challengeToken]);

  // The challenge dies after `expiresIn` seconds.
  useEffect(() => {
    const ms = Math.max(1, Number(challenge.expiresIn || 300)) * 1000;
    const timer = setTimeout(() => setExpired(true), ms);
    return () => clearTimeout(timer);
  }, [challenge.challengeToken, challenge.expiresIn]);

  const submit = useCallback(
    async (value) => {
      const digits = (value ?? code).trim();
      if (!/^[0-9]{6}$/.test(digits) || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const data = await completeTotp(challenge.challengeToken, digits);
        onSignedIn?.(data);
      } catch (err) {
        setCode('');
        setError(err.message);
        // A burned or expired challenge (no reason) or a lockout cannot be retried.
        if (err.status === 401 && err.reason !== 'totp_invalid') setExpired(true);
      } finally {
        setSubmitting(false);
      }
    },
    [code, submitting, completeTotp, challenge.challengeToken, onSignedIn],
  );

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(enrolment.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the secret stays visible to copy by hand.
    }
  };

  if (expired) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>{error || enrolError || 'This sign-in attempt has expired. Start again.'}</AlertDescription>
        </Alert>
        <Button type="button" className="w-full" onClick={onRestart}>
          <RotateCcw /> Start again
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {enrolling ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            <p className="text-muted-foreground">
              Scan this code with an authenticator app (Google Authenticator, 1Password, Authy…),
              then enter the 6-digit code it shows. Staff accounts always need a second factor.
            </p>
          </div>
          {enrolError ? (
            <Alert variant="destructive">
              <AlertDescription>{enrolError}</AlertDescription>
            </Alert>
          ) : !enrolment ? (
            <div className="flex flex-col items-center gap-3">
              <Skeleton className="h-44 w-44" />
              <Skeleton className="h-4 w-56" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <img
                src={svgDataUri(enrolment.qrSvg)}
                alt="QR code for your authenticator app"
                width={176}
                height={176}
                className="h-44 w-44 rounded-md border bg-white p-2"
              />
              <div className="w-full space-y-1.5 text-center">
                <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <KeyRound className="h-3.5 w-3.5" aria-hidden="true" /> Can't scan? Enter this key instead
                </p>
                <div className="flex items-center justify-center gap-2">
                  <code
                    className="rounded-md bg-muted px-2 py-1 font-mono text-xs tracking-wider"
                    data-testid="totp-secret"
                  >
                    {groupSecret(enrolment.secret)}
                  </code>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={copySecret}
                    aria-label="Copy key"
                  >
                    {copied ? <Check className="text-success" /> : <Copy />}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Open your authenticator app and enter the current 6-digit code for Dotcod Admin.
        </p>
      )}

      <div className="flex flex-col items-center gap-2">
        <label htmlFor="totp-code" className="sr-only">
          6-digit code
        </label>
        <InputOTP
          id="totp-code"
          maxLength={6}
          value={code}
          onChange={setCode}
          onComplete={submit}
          inputMode="numeric"
          pattern="^[0-9]*$"
          autoComplete="one-time-code"
          autoFocus={!enrolling}
          disabled={submitting || (enrolling && !enrolment)}
        >
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <InputOTPSlot key={index} index={index} className="h-11 w-11 text-base" />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Button
          type="submit"
          className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
          disabled={submitting || code.length !== 6}
        >
          {submitting ? <Loader2 className="animate-spin" /> : null}
          {enrolling ? 'Verify and finish setup' : 'Verify'}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={onRestart} disabled={submitting}>
          Use a different account
        </Button>
      </div>
    </form>
  );
}
