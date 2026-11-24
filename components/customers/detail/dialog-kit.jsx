'use client';

/** Shared pieces for the customer action dialogs (BO18): form dialog shell, submit state, toasts. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { describeError, inboundVoiceOutcome } from '@/lib/customer-detail';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** Toast for a successful write, with the inbound-voice outcome when the API returned one. */
export function notifySuccess(title, response, description) {
  const voice = inboundVoiceOutcome(response?.inboundVoice);
  const unconfirmedOwner = response?.warnings?.includes('owner_email_unconfirmed');
  const extra = [description, unconfirmedOwner ? "The owner hasn't confirmed their email yet." : null]
    .filter(Boolean)
    .join(' ');
  toast.success(title, { description: extra || (voice?.tone === 'info' ? voice.text : undefined) });
  if (voice?.tone === 'warning') toast.warning('Inbound voice', { description: voice.text, duration: 12000 });
  return voice;
}

/**
 * Submit state for a dialog: `run(fn)` clears errors, awaits `fn()`, and on an ApiError keeps
 * `{ message, fieldErrors }`. Returns the result or `undefined` on failure. `onStale` is called
 * for INVALID_STATE answers (the page refetches so the buttons match the real state).
 */
export function useSubmit({ onStale } = {}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setFieldErrors({});
  }, []);

  const run = useCallback(
    async (fn) => {
      setBusy(true);
      setError(null);
      setFieldErrors({});
      try {
        return await fn();
      } catch (err) {
        const described = describeError(err);
        if (mounted.current) {
          setError(described.message);
          setFieldErrors(described.fieldErrors);
        }
        if (described.refetch) onStale?.();
        return undefined;
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [onStale],
  );

  return { busy, error, fieldErrors, setFieldErrors, setError, reset, run };
}

export function InlineAlert({ tone = 'error', children, className }) {
  if (!children) return null;
  const styles = {
    error: 'border-destructive/40 bg-destructive/5 text-destructive',
    warning: 'border-amber-300 bg-amber-50 text-amber-900',
    info: 'border-sky-200 bg-sky-50 text-sky-900',
  };
  const Icon = tone === 'info' ? Info : AlertTriangle;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-2 rounded-md border px-3 py-2 text-sm', styles[tone], className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  );
}

/** Dialog with a form: title, description, body, error, Cancel + submit. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  error,
  busy,
  submitLabel = 'Save',
  destructive = false,
  onSubmit,
  wide = false,
  submitDisabled = false,
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (!busy ? onOpenChange(next) : null)}>
      <DialogContent className={cn(wide ? 'max-w-2xl' : 'max-w-lg')}>
        <form
          className="space-y-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy) onSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          {children}
          <InlineAlert>{error}</InlineAlert>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={destructive ? 'destructive' : 'default'}
              disabled={busy || submitDisabled}
              className={destructive ? undefined : 'bg-brand text-brand-foreground hover:bg-brand/90'}
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
