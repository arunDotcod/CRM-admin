'use client';

/**
 * Shows a one-time staff setup link (invite / resend-setup answer `setupUrl` + `setupExpiresAt`).
 *
 * Delivery is an open decision (api-contracts §12.6): today the API returns the link to the
 * inviting SUPER_ADMIN instead of emailing it. This is the only component that knows that. If
 * the link is emailed later, swap this for a "Setup email sent to …" message and drop the copy UI.
 * The link is never stored: it lives in React state only until the dialog closes.
 */
import { useRef, useState } from 'react';
import { Check, Copy, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/customers';

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Permission denied (embedded browsers, insecure origins): try the legacy path.
    }
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('copy failed');
}

export function SetupLinkPanel({ name, email, setupUrl, setupExpiresAt }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const inputRef = useRef(null);

  const copy = async () => {
    try {
      await copyText(setupUrl);
      setCopied(true);
      setCopyFailed(false);
      toast.success('Setup link copied');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyFailed(true);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">
        <p className="flex items-center gap-1.5 font-medium">
          <Link2 className="h-4 w-4 text-brand" aria-hidden="true" />
          One-time setup link
        </p>
        <p className="mt-1 text-muted-foreground">
          No email is sent. Copy this link and send it to {name || 'the new staff member'}
          {email ? ` (${email})` : ''} yourself, for example over chat. It works once and is shown only now.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          readOnly
          value={setupUrl}
          aria-label="Setup link"
          onFocus={(event) => event.target.select()}
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-muted/40 px-3 font-mono text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button type="button" onClick={copy} className="shrink-0">
          {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>
      {copyFailed ? (
        <p role="status" className="text-xs font-medium text-amber-800">
          This browser blocked copying. The link is selected: press Ctrl+C (⌘C on a Mac) to copy it.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Expires {formatDateTime(setupExpiresAt)}. After that, use <span className="font-medium">Resend setup link</span>{' '}
        for a fresh one (the old link stops working).
      </p>
    </div>
  );
}
