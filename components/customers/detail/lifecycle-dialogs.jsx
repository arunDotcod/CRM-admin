'use client';

/**
 * Lifecycle dialogs on Customer detail (BO18, BO28; api-contracts §12.4): Verify, Reject,
 * Reopen, Suspend, Reactivate, Mark email confirmed, Edit profile. Each calls the API, toasts
 * the result (with the inbound-voice outcome) and hands the response to `onDone`.
 */
import { useEffect, useState } from 'react';
import { customerApi, limitWarnings, scopedErrors } from '@/lib/customer-detail';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  SubscriptionForm,
  FieldError,
  localDay,
  subscriptionDefaults,
  toSubscriptionInput,
  validateSubscription,
  limitsFromValues,
} from '@/components/subscriptions/subscription-form';
import { FormDialog, InlineAlert, notifySuccess, useSubmit } from './dialog-kit';

function TextField({ id, label, hint, error, value, onChange, rows, maxLength, placeholder, required, disabled }) {
  const Comp = rows ? Textarea : Input;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Comp
        id={id}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

/** Loads `GET /admin/settings` once per open (for `defaultLimits` and the grace default). */
export function useSettings(open) {
  const [state, setState] = useState({ loading: false, settings: null, error: null });
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setState({ loading: true, settings: null, error: null });
    customerApi
      .settings()
      .then((settings) => alive && setState({ loading: false, settings, error: null }))
      .catch((error) => alive && setState({ loading: false, settings: null, error }));
    return () => {
      alive = false;
    };
  }, [open]);
  return state;
}

// ------------------------------------------------------------------ Verify

export function VerifyDialog({ open, onOpenChange, customer, onDone, onStale }) {
  const { loading, settings, error: settingsError } = useSettings(open);
  const [values, setValues] = useState(null);
  const [message, setMessage] = useState('');
  const [note, setNote] = useState('');
  const [clientErrors, setClientErrors] = useState({});
  const submit = useSubmit({ onStale });

  useEffect(() => {
    if (!open) {
      setValues(null);
      return;
    }
    if (!loading) {
      setValues(subscriptionDefaults(settings));
      setMessage('');
      setNote('');
      setClientErrors({});
      submit.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading, settings]);

  const subErrors = { ...scopedErrors(submit.fieldErrors, 'subscription.'), ...clientErrors };
  const warnings = values ? limitWarnings(limitsFromValues(values), customer) : [];

  const onSubmit = async () => {
    const errs = validateSubscription(values, { minStartDay: localDay(Date.now() - 86_400_000) });
    setClientErrors(errs);
    if (Object.keys(errs).length) return;
    const body = { subscription: toSubscriptionInput(values) };
    if (message.trim()) body.message = message.trim();
    if (note.trim()) body.note = note.trim();
    const result = await submit.run(() => customerApi.verify(customer.id, body));
    if (!result) return;
    notifySuccess(`${customer.name} verified`, result, 'The owner gets the "account verified" email.');
    onOpenChange(false);
    onDone(result);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title="Verify signup"
      description={`Verify ${customer.name} and assign its first subscription. AI and channels go live straight away.`}
      submitLabel="Verify and assign"
      busy={submit.busy}
      error={submit.error}
      submitDisabled={!values}
      onSubmit={onSubmit}
    >
      {!customer.owner?.emailConfirmed ? (
        <InlineAlert tone="warning">The owner hasn&apos;t confirmed their email yet. You can still verify.</InlineAlert>
      ) : null}
      {settingsError ? (
        <InlineAlert tone="warning">Couldn&apos;t load the default limits ({settingsError.message}). Fill in the limits by hand.</InlineAlert>
      ) : null}
      {!values ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-2/3" />
        </div>
      ) : (
        <SubscriptionForm idPrefix="verify" values={values} onChange={setValues} errors={subErrors} disabled={submit.busy} />
      )}
      {warnings.length ? (
        <InlineAlert tone="warning">
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </InlineAlert>
      ) : null}
      <TextField
        id="verify-message"
        label="Message to the customer (optional)"
        hint="Added to the account-verified email."
        rows={2}
        maxLength={1000}
        value={message}
        onChange={setMessage}
        error={submit.fieldErrors.message}
      />
      <TextField
        id="verify-note"
        label="Internal note (staff only)"
        rows={2}
        maxLength={2000}
        value={note}
        onChange={setNote}
        error={submit.fieldErrors.note}
      />
    </FormDialog>
  );
}

// ------------------------------------------------------------------ Reject

export function RejectDialog({ open, onOpenChange, customer, onDone, onStale }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [missing, setMissing] = useState(false);
  const submit = useSubmit({ onStale });
  useEffect(() => {
    if (open) {
      setReason('');
      setNote('');
      setMissing(false);
      submit.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = async () => {
    if (!reason.trim()) {
      setMissing(true);
      return;
    }
    const body = { reason: reason.trim() };
    if (note.trim()) body.note = note.trim();
    const result = await submit.run(() => customerApi.reject(customer.id, body));
    if (!result) return;
    notifySuccess(`${customer.name} rejected`, result, 'The owner gets the reason by email.');
    onOpenChange(false);
    onDone(result);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reject signup"
      description="Members can still sign in, but only see the rejected screen. You can reopen it later."
      submitLabel="Reject signup"
      destructive
      busy={submit.busy}
      error={submit.error}
      onSubmit={onSubmit}
    >
      <TextField
        id="reject-reason"
        label="Reason (sent to the owner)"
        required
        rows={3}
        maxLength={1000}
        value={reason}
        onChange={(v) => {
          setReason(v);
          setMissing(false);
        }}
        error={missing ? 'Give the owner a reason.' : submit.fieldErrors.reason}
        placeholder="E.g. We couldn't confirm the business from the website you gave."
      />
      <TextField
        id="reject-note"
        label="Internal note (staff only)"
        rows={2}
        maxLength={2000}
        value={note}
        onChange={setNote}
        error={submit.fieldErrors.note}
      />
    </FormDialog>
  );
}

// ------------------------------------------------------------------ Suspend

export function SuspendDialog({ open, onOpenChange, customer, onDone, onStale }) {
  const [reason, setReason] = useState('');
  const [missing, setMissing] = useState(false);
  const submit = useSubmit({ onStale });
  useEffect(() => {
    if (open) {
      setReason('');
      setMissing(false);
      submit.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = async () => {
    if (!reason.trim()) {
      setMissing(true);
      return;
    }
    const result = await submit.run(() => customerApi.suspend(customer.id, { reason: reason.trim() }));
    if (!result) return;
    notifySuccess(`${customer.name} suspended`, result);
    onOpenChange(false);
    onDone(result);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Suspend customer"
      submitLabel="Suspend"
      destructive
      busy={submit.busy}
      error={submit.error}
      onSubmit={onSubmit}
    >
      <InlineAlert tone="warning">
        <p className="font-medium">This signs everyone in {customer.name} out.</p>
        <p>AI replies, channels and voice stop, and inbound voice is paused on their numbers. Nobody can sign in until you reactivate.</p>
      </InlineAlert>
      <TextField
        id="suspend-reason"
        label="Reason (staff only)"
        required
        rows={3}
        maxLength={1000}
        value={reason}
        onChange={(v) => {
          setReason(v);
          setMissing(false);
        }}
        error={missing ? 'Add a reason.' : submit.fieldErrors.reason}
        placeholder="E.g. Payment overdue since 1 Nov"
      />
    </FormDialog>
  );
}

// ------------------------------------------------------------------ simple confirms

const CONFIRMS = {
  reopen: {
    title: 'Reopen signup',
    description: 'Moves the signup back to Pending so it can be verified. No email is sent.',
    submit: 'Reopen',
    note: { label: 'Internal note (optional)', max: 2000 },
    call: (id, note) => customerApi.reopen(id, note ? { note } : {}),
    toast: (name) => `${name} reopened`,
  },
  reactivate: {
    title: 'Reactivate customer',
    description:
      'Members can sign in again. AI and channels come back if the subscription allows it; otherwise the customer stays paused.',
    submit: 'Reactivate',
    call: (id) => customerApi.reactivate(id),
    toast: (name) => `${name} reactivated`,
  },
  markEmailConfirmed: {
    title: "Mark owner's email confirmed",
    description:
      'Use this only when you have confirmed the address another way. It works like a real confirmation: the signup enters the pending queue and the signup alert is sent.',
    submit: 'Mark confirmed',
    note: { label: 'How was it confirmed? (staff only)', max: 500 },
    call: (id, note) => customerApi.markEmailConfirmed(id, note ? { note } : {}),
    toast: () => 'Email marked confirmed',
  },
};

export function ConfirmActionDialog({ kind, open, onOpenChange, customer, onDone, onStale }) {
  const config = CONFIRMS[kind];
  const [note, setNote] = useState('');
  const submit = useSubmit({ onStale });
  useEffect(() => {
    if (open) {
      setNote('');
      submit.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!config) return null;

  const onSubmit = async () => {
    const result = await submit.run(() => config.call(customer.id, note.trim()));
    if (!result) return;
    notifySuccess(config.toast(customer.name), result);
    onOpenChange(false);
    onDone(result);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={config.title}
      description={config.description}
      submitLabel={config.submit}
      busy={submit.busy}
      error={submit.error}
      onSubmit={onSubmit}
    >
      {config.note ? (
        <TextField
          id={`${kind}-note`}
          label={config.note.label}
          rows={2}
          maxLength={config.note.max}
          value={note}
          onChange={setNote}
          error={submit.fieldErrors.note}
        />
      ) : null}
    </FormDialog>
  );
}

// ------------------------------------------------------------------ Edit profile

const PROFILE_FIELDS = [
  { key: 'name', label: 'Organization name', max: 160, required: true },
  { key: 'timezone', label: 'Time zone', max: 64, required: true },
  { key: 'website', label: 'Website', max: 240 },
  { key: 'industry', label: 'Industry', max: 80 },
  { key: 'size', label: 'Company size', max: 40 },
  { key: 'hoursPreset', label: 'Business days', max: 40, placeholder: 'Monday–Friday' },
  { key: 'hoursStart', label: 'Opens', max: 5, placeholder: '09:00', time: true },
  { key: 'hoursEnd', label: 'Closes', max: 5, placeholder: '18:00', time: true },
];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function timeZones() {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['Asia/Kolkata', 'UTC'];
  }
}

export function isTimeZone(value) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return Boolean(value);
  } catch {
    return false;
  }
}

/** Client checks shared by Edit profile and New customer (keys = profile field names). */
export function validateProfile(values, { requireName = true } = {}) {
  const errors = {};
  if (requireName && !values.name?.trim()) errors.name = 'Required.';
  if (values.timezone !== undefined && !isTimeZone(values.timezone)) errors.timezone = 'Pick an IANA time zone, e.g. Asia/Kolkata.';
  for (const key of ['hoursStart', 'hoursEnd'])
    if (values[key] && !HHMM.test(values[key])) errors[key] = 'Use HH:MM (24 h).';
  if (/[\u0000-\u001f\u007f]/.test(`${values.name || ''}${values.website || ''}${values.industry || ''}${values.size || ''}${values.hoursPreset || ''}`))
    errors.website = errors.website || 'Line breaks are not allowed.';
  return errors;
}

/** The profile inputs (no name / timezone), shared with New customer. */
export function ProfileFields({ idPrefix, values, onChange, errors = {}, disabled, fields = PROFILE_FIELDS, description = true }) {
  const set = (key, value) => onChange({ ...values, [key]: value });
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-${f.key}`} className="text-xs">
              {f.label}
              {f.required ? <span className="text-destructive"> *</span> : null}
            </Label>
            <Input
              id={`${idPrefix}-${f.key}`}
              type={f.time ? 'time' : 'text'}
              list={f.key === 'timezone' ? `${idPrefix}-tz-list` : undefined}
              maxLength={f.max}
              placeholder={f.placeholder}
              value={values[f.key] ?? ''}
              disabled={disabled}
              aria-invalid={errors[f.key] ? true : undefined}
              aria-describedby={errors[f.key] ? `${idPrefix}-${f.key}-error` : undefined}
              onChange={(e) => set(f.key, e.target.value)}
            />
            <FieldError id={`${idPrefix}-${f.key}-error`}>{errors[f.key]}</FieldError>
          </div>
        ))}
      </div>
      <datalist id={`${idPrefix}-tz-list`}>
        {timeZones().map((tz) => (
          <option key={tz} value={tz} />
        ))}
      </datalist>
      {description ? (<div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-description`} className="text-xs">
          Business description
        </Label>
        <Textarea
          id={`${idPrefix}-description`}
          rows={4}
          maxLength={2000}
          value={values.description ?? ''}
          disabled={disabled}
          onChange={(e) => set('description', e.target.value)}
        />
        <FieldError id={`${idPrefix}-description-error`}>{errors.description}</FieldError>
      </div>) : null}
    </>
  );
}

export function ProfileDialog({ open, onOpenChange, customer, onDone, onStale }) {
  const initial = () => {
    const p = customer.profile || {};
    return Object.fromEntries(
      [...PROFILE_FIELDS.map((f) => f.key), 'description'].map((key) => [key, p[key] ?? '']),
    );
  };
  const [values, setValues] = useState(initial);
  const [clientErrors, setClientErrors] = useState({});
  const submit = useSubmit({ onStale });
  useEffect(() => {
    if (open) {
      setValues(initial());
      setClientErrors({});
      submit.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = async () => {
    const errs = validateProfile(values);
    setClientErrors(errs);
    if (Object.keys(errs).length) return;
    const before = initial();
    const body = {};
    for (const [key, value] of Object.entries(values)) {
      const next = key === 'description' ? value.trim() : value.trim();
      if (next === String(before[key] ?? '').trim()) continue;
      // HH:MM cannot be cleared through the API (it must match the pattern), so skip empty times.
      if ((key === 'hoursStart' || key === 'hoursEnd') && !next) continue;
      body[key] = next;
    }
    if (!Object.keys(body).length) {
      onOpenChange(false);
      return;
    }
    const result = await submit.run(() => customerApi.updateProfile(customer.id, body));
    if (!result) return;
    notifySuccess('Profile saved', result);
    onOpenChange(false);
    onDone(result);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title="Edit business profile"
      description="The slug, owner and members can't be changed here. The customer sees the new profile at once."
      submitLabel="Save profile"
      busy={submit.busy}
      error={submit.error}
      onSubmit={onSubmit}
    >
      <ProfileFields
        idPrefix="profile"
        values={values}
        onChange={setValues}
        errors={{ ...submit.fieldErrors, ...clientErrors }}
        disabled={submit.busy}
      />
    </FormDialog>
  );
}
