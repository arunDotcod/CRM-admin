'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Clock, Loader2, Mail, Plus, X } from 'lucide-react';
import { CHANNEL_LABELS, CHANNELS, formatDateTime } from '@/lib/customers';
import {
  LIMIT_FIELDS,
  MAX_ALERT_EMAILS,
  POLICY_FIELDS,
  apiFieldErrors,
  isEmail,
  settingsApi,
  toForm,
  validateForm,
} from '@/lib/settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/common/states';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1 text-xs font-medium text-destructive">
      {children}
    </p>
  );
}

function NumberField({ field, value, error, onChange }) {
  const id = `setting-${field.key}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {field.label}
      </label>
      <Input
        id={id}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, ''))}
        aria-invalid={Boolean(error)}
        aria-describedby={[field.help ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined}
        className={cn(error && 'border-destructive')}
      />
      {field.help ? (
        <p id={`${id}-help`} className="mt-1 text-xs text-muted-foreground">
          {field.help}
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          {field.min.toLocaleString('en-IN')}–{field.max.toLocaleString('en-IN')}
        </p>
      )}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

function AlertEmails({ emails, error, badEmail, onChange }) {
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState(null);

  const add = () => {
    const value = draft.trim().toLowerCase();
    if (!value) return;
    if (!isEmail(value)) {
      setDraftError('Enter a valid email address, like ops@dotcod.in.');
      return;
    }
    if (emails.includes(value)) {
      setDraftError('That address is already on the list.');
      return;
    }
    if (emails.length >= MAX_ALERT_EMAILS) {
      setDraftError(`Up to ${MAX_ALERT_EMAILS} addresses.`);
      return;
    }
    onChange([...emails, value]);
    setDraft('');
    setDraftError(null);
  };

  return (
    <div className="space-y-3">
      {emails.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Signup alert recipients">
          {emails.map((email) => (
            <li
              key={email}
              className={cn(
                'inline-flex max-w-full items-center gap-1.5 rounded-full border bg-muted/40 py-1 pl-3 pr-1 text-sm',
                email === badEmail && 'border-destructive bg-destructive/5 text-destructive',
              )}
            >
              <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{email}</span>
              <button
                type="button"
                onClick={() => onChange(emails.filter((item) => item !== email))}
                className="rounded-full p-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Remove ${email}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No recipients: nobody is emailed about new signups.
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          placeholder="name@dotcod.in"
          aria-label="Add a signup alert recipient"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setDraftError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
          aria-invalid={Boolean(draftError)}
          aria-describedby={draftError ? 'alert-draft-error' : undefined}
          className="sm:max-w-sm"
        />
        <Button type="button" variant="outline" onClick={add} disabled={!draft.trim()}>
          <Plus /> Add
        </Button>
      </div>
      <FieldError id="alert-draft-error">{draftError}</FieldError>
      <FieldError id="alert-emails-error">{error}</FieldError>
      <p className="text-xs text-muted-foreground">
        {emails.length} of {MAX_ALERT_EMAILS}. They get an email when a new signup confirms its address.
      </p>
    </div>
  );
}

/** BO28 Settings form (GET / PUT `/admin/settings`). */
export function SettingsForm() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await settingsApi.get();
      setSettings(data);
      setForm(toForm(data));
      setErrors({});
      setFormError(null);
      setStatus('ready');
    } catch (err) {
      setLoadError(err);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(
    () => Boolean(form && settings && JSON.stringify(form) !== JSON.stringify(toForm(settings))),
    [form, settings],
  );

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key] && !(key === 'signupAlertEmails' && prev.badEmail)) return prev;
      const next = { ...prev };
      delete next[key];
      if (key === 'signupAlertEmails') delete next.badEmail;
      return next;
    });
  };

  const toggleChannel = (channel) =>
    set(
      'channels',
      form.channels.includes(channel)
        ? form.channels.filter((item) => item !== channel)
        : CHANNELS.filter((item) => item === channel || form.channels.includes(item)),
    );

  const save = async (event) => {
    event.preventDefault();
    setFormError(null);
    const { errors: clientErrors, body } = validateForm(form);
    if (!body) {
      setErrors(clientErrors);
      setFormError('Fix the highlighted fields.');
      return;
    }
    setSaving(true);
    try {
      const data = await settingsApi.update(body);
      setSettings(data);
      setForm(toForm(data));
      setErrors({});
      toast.success('Settings saved. Customers see the change within about a minute.');
    } catch (err) {
      const fieldErrors = err?.code === 'VALIDATION_ERROR' ? apiFieldErrors(err, form) : {};
      setErrors(fieldErrors);
      setFormError(
        Object.keys(fieldErrors).length
          ? 'Not saved. Fix the highlighted fields.'
          : err?.code === 'FORBIDDEN'
            ? 'Only super admins can change settings.'
            : err?.message || 'Not saved. Try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading')
    return (
      <div className="space-y-4" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  if (status === 'error') return <ErrorState message={loadError?.message} onRetry={load} />;

  return (
    <form onSubmit={save} className="space-y-5 pb-24" noValidate>
      <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          Changes reach customers within about 60 seconds (settings are cached for a minute). Default limits only prefill
          new subscriptions; existing ones keep their limits.
          {settings?.updatedAt ? (
            <>
              {' '}
              Last changed {formatDateTime(settings.updatedAt)}
              {settings.updatedBy?.name ? ` by ${settings.updatedBy.name}` : ''}.
            </>
          ) : null}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Signup alerts</CardTitle>
          <CardDescription>Who is emailed when a new customer signs up and confirms their email.</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertEmails
            emails={form.signupAlertEmails}
            error={errors.signupAlertEmails}
            badEmail={errors.badEmail}
            onChange={(value) => set('signupAlertEmails', value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default limits</CardTitle>
          <CardDescription>Prefilled in the Verify and New customer forms. Staff can change them per customer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 lg:grid-cols-3">
            {LIMIT_FIELDS.map((field) => (
              <NumberField
                key={field.key}
                field={field}
                value={form[field.key]}
                error={errors[field.key]}
                onChange={(value) => set(field.key, value)}
              />
            ))}
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Channels</legend>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((channel) => {
                const on = form.channels.includes(channel);
                return (
                  <label
                    key={channel}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                      on ? 'border-brand bg-brand/5' : 'hover:bg-muted/50',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleChannel(channel)}
                      className="h-4 w-4 accent-[hsl(var(--brand))]"
                    />
                    {CHANNEL_LABELS[channel] || channel}
                  </label>
                );
              })}
            </div>
            {!form.channels.length ? (
              <p className="mt-1 text-xs text-amber-800">No channels: new customers could not connect any channel.</p>
            ) : null}
            <FieldError id="channels-error">{errors.channels}</FieldError>
          </fieldset>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.openEnded}
              onChange={(event) => set('openEnded', event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[hsl(var(--brand))]"
            />
            <span>
              <span className="block font-medium">Open-ended by default</span>
              <span className="block text-xs text-muted-foreground">
                New subscriptions start with no end date. The period length still sets the monthly usage window.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Policies</CardTitle>
          <CardDescription>Grace period, the seat cap before verification, and the expiry reminder.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {POLICY_FIELDS.map((field) => (
              <NumberField
                key={field.key}
                field={field}
                value={form[field.key]}
                error={errors[field.key]}
                onChange={(value) => set(field.key, value)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        {formError ? (
          <p role="alert" className="basis-full text-sm text-destructive sm:mr-auto sm:basis-auto">
            {formError}
          </p>
        ) : dirty ? (
          <p className="basis-full text-sm text-muted-foreground sm:mr-auto sm:basis-auto">Unsaved changes</p>
        ) : null}
        <Button type="button" variant="outline" className="flex-1 sm:flex-none" disabled={!dirty || saving} onClick={() => load()}>
          Discard
        </Button>
        <Button type="submit" className="flex-1 sm:flex-none" disabled={!dirty || saving}>
          {saving ? <Loader2 className="animate-spin" /> : null} Save settings
        </Button>
      </div>
    </form>
  );
}
