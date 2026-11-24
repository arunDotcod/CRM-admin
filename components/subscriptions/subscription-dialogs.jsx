'use client';

/** Add / renew, edit and cancel a subscription (BO18; api-contracts §12.5, plan D6). */
import { useEffect, useState } from 'react';
import { customerApi, limitWarnings } from '@/lib/customer-detail';
import { formatDate } from '@/lib/customers';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { FormDialog, InlineAlert, notifySuccess, useSubmit } from '@/components/customers/detail/dialog-kit';
import { useSettings } from '@/components/customers/detail/lifecycle-dialogs';
import {
  FieldError,
  SubscriptionForm,
  addDays,
  dayToIso,
  limitsFromValues,
  localDay,
  subscriptionDefaults,
  toSubscriptionInput,
  validateSubscription,
} from './subscription-form';

function Warnings({ items }) {
  if (!items.length) return null;
  return (
    <InlineAlert tone="warning">
      {items.map((w) => (
        <p key={w}>{w}</p>
      ))}
    </InlineAlert>
  );
}

/**
 * The row a renewal follows: the non-canceled row that ends last (a scheduled renewal counts).
 * An open-ended live row can't be renewed (any new period would overlap it) → null.
 */
function renewBase(customer) {
  const subs = (customer.subscriptions || []).filter((s) => s.status !== 'CANCELED');
  if (subs.some((s) => !s.endsAt && s.status !== 'ENDED')) return null;
  return [...subs].sort((a, b) => new Date(b.endsAt || 0) - new Date(a.endsAt || 0))[0] || null;
}

export function AddSubscriptionDialog({ open, onOpenChange, customer, onDone, onStale }) {
  const { loading, settings, error: settingsError } = useSettings(open);
  const [values, setValues] = useState(null);
  const [clientErrors, setClientErrors] = useState({});
  const submit = useSubmit({ onStale });
  const base = renewBase(customer);
  // Renewing follows a dated row that ends in the future; otherwise a renewal starts now.
  const canRenew = Boolean(base && base.endsAt);
  const renewStart =
    base?.endsAt && new Date(base.endsAt).getTime() > Date.now() ? localDay(base.endsAt) : localDay(new Date());

  useEffect(() => {
    if (!open) {
      setValues(null);
      return;
    }
    if (loading) return;
    const v = subscriptionDefaults(settings, {
      startMode: canRenew ? 'renew' : 'now',
      startDay: canRenew ? renewStart : undefined,
    });
    if (base?.limits) {
      // A renewal keeps the current limits by default.
      Object.assign(v, {
        aiMonthlyReplies: String(base.limits.aiMonthlyReplies),
        voiceMonthlyMinutes: String(base.limits.voiceMonthlyMinutes),
        maxAiEmployees: String(base.limits.maxAiEmployees),
        maxSeats: String(base.limits.maxSeats),
        channels: [...base.limits.channels],
        graceDays: String(base.graceDays ?? v.graceDays),
      });
    }
    setValues(v);
    setClientErrors({});
    submit.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading, settings]);

  // Keep the default end one period after the chosen start.
  const onChange = (next) => {
    if (values && next.startMode !== values.startMode && !next.openEnded) {
      const period = settings?.defaultLimits?.periodDays || 30;
      const start = next.startMode === 'renew' ? renewStart : next.startMode === 'date' ? next.startDate : localDay(new Date());
      next = { ...next, endDate: addDays(start, period) };
    }
    setValues(next);
  };

  const onSubmit = async () => {
    const errs = validateSubscription(values, { minStartDay: localDay(Date.now() - 86_400_000) });
    if (values.startMode === 'renew' && !values.openEnded && values.endDate <= renewStart)
      errs.endsAt = `The end date must be after ${formatDate(dayToIso(renewStart))}.`;
    setClientErrors(errs);
    if (Object.keys(errs).length) return;
    const input = toSubscriptionInput(values);
    // The API's `renew` follows the *current* row; after a scheduled renewal, start exactly
    // where the last row ends instead.
    if (values.startMode === 'renew' && base?.endsAt && new Date(base.endsAt).getTime() > Date.now())
      input.startsAt = base.endsAt;
    const result = await submit.run(() => customerApi.createSubscription(customer.id, input));
    if (!result) return;
    notifySuccess(values.startMode === 'renew' ? 'Subscription renewed' : 'Subscription added', result);
    onOpenChange(false);
    onDone(result);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={canRenew ? 'Add or renew subscription' : 'Add subscription'}
      description="Periods can't overlap. To change the current period's limits or end date, use Edit instead."
      submitLabel={values?.startMode === 'renew' ? 'Renew' : 'Add subscription'}
      busy={submit.busy}
      error={submit.error}
      submitDisabled={!values}
      onSubmit={onSubmit}
    >
      {settingsError ? (
        <InlineAlert tone="warning">Couldn&apos;t load the default limits ({settingsError.message}).</InlineAlert>
      ) : null}
      {!values ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-2/3" />
        </div>
      ) : (
        <>
          <SubscriptionForm
            idPrefix="add-sub"
            values={values}
            onChange={onChange}
            errors={{ ...submit.fieldErrors, ...clientErrors }}
            disabled={submit.busy}
            startModes={canRenew ? ['renew', 'now', 'date'] : ['now', 'date']}
            renewLabel={`When the current period ends (${formatDate(dayToIso(renewStart))})`}
          />
          <Warnings items={limitWarnings(limitsFromValues(values), customer)} />
        </>
      )}
    </FormDialog>
  );
}

export function EditSubscriptionDialog({ open, onOpenChange, customer, subscription, onDone, onStale }) {
  const [values, setValues] = useState(null);
  const [clientErrors, setClientErrors] = useState({});
  const submit = useSubmit({ onStale });

  const initial = () => {
    const s = subscription;
    return {
      startMode: 'none',
      startDate: localDay(s.startsAt),
      openEnded: !s.endsAt,
      endDate: s.endsAt ? localDay(s.endsAt) : addDays(localDay(new Date()), 30),
      graceDays: String(s.graceDays),
      aiMonthlyReplies: String(s.limits.aiMonthlyReplies),
      voiceMonthlyMinutes: String(s.limits.voiceMonthlyMinutes),
      maxAiEmployees: String(s.limits.maxAiEmployees),
      maxSeats: String(s.limits.maxSeats),
      channels: [...s.limits.channels],
      note: s.note || '',
    };
  };

  useEffect(() => {
    if (open && subscription) {
      setValues(initial());
      setClientErrors({});
      submit.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, subscription?.id]);

  if (!subscription) return null;

  const onSubmit = async () => {
    const errs = validateSubscription(values, { requireEnd: false });
    if (!values.openEnded && !values.endDate) errs.endsAt = 'Pick an end date, or make it open-ended.';
    else if (!values.openEnded && values.endDate <= localDay(subscription.startsAt))
      errs.endsAt = 'The end date must be after the start date.';
    delete errs.startsAt;
    setClientErrors(errs);
    if (Object.keys(errs).length) return;

    // Send only what changed: a new endsAt re-runs the overlap check and resets the notices.
    const before = initial();
    const body = {};
    if (values.openEnded !== before.openEnded || (!values.openEnded && values.endDate !== before.endDate))
      body.endsAt = values.openEnded ? null : dayToIso(values.endDate);
    if (values.graceDays !== before.graceDays) body.graceDays = Number(values.graceDays);
    const limits = limitsFromValues(values);
    if (JSON.stringify(limits) !== JSON.stringify(limitsFromValues(before))) body.limits = limits;
    if (values.note.trim() !== before.note.trim()) body.note = values.note.trim() || null;
    if (!Object.keys(body).length) {
      onOpenChange(false);
      return;
    }
    const result = await submit.run(() => customerApi.updateSubscription(subscription.id, body));
    if (!result) return;
    notifySuccess('Subscription saved', result);
    onOpenChange(false);
    onDone(result);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title="Edit subscription"
      description={`Started ${formatDate(subscription.startsAt)}. The start can't change: cancel and add a new one instead.`}
      submitLabel="Save changes"
      busy={submit.busy}
      error={submit.error}
      submitDisabled={!values}
      onSubmit={onSubmit}
    >
      {values ? (
        <>
          <SubscriptionForm
            idPrefix="edit-sub"
            values={values}
            onChange={setValues}
            errors={{ ...submit.fieldErrors, ...clientErrors }}
            disabled={submit.busy}
            showStart={false}
          />
          <Warnings items={limitWarnings(limitsFromValues(values), customer)} />
        </>
      ) : null}
    </FormDialog>
  );
}

export function CancelSubscriptionDialog({ open, onOpenChange, subscription, onDone, onStale }) {
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
  if (!subscription) return null;

  const onSubmit = async () => {
    if (!reason.trim()) {
      setMissing(true);
      return;
    }
    const result = await submit.run(() => customerApi.cancelSubscription(subscription.id, { reason: reason.trim() }));
    if (!result) return;
    notifySuccess('Subscription canceled', result);
    onOpenChange(false);
    onDone(result);
  };

  const scheduled = subscription.status === 'SCHEDULED';
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Cancel subscription"
      description={`${subscription.id} · ${formatDate(subscription.startsAt)} – ${subscription.endsAt ? formatDate(subscription.endsAt) : 'open-ended'}`}
      submitLabel="Cancel subscription"
      destructive
      busy={submit.busy}
      error={submit.error}
      onSubmit={onSubmit}
    >
      <InlineAlert tone="warning">
        {scheduled ? (
          <p>This scheduled period will not start.</p>
        ) : (
          <p>
            The period ends now. The {subscription.graceDays}-day grace still runs from today, then AI replies pause unless
            another subscription starts.
          </p>
        )}
      </InlineAlert>
      <div className="space-y-1.5">
        <Label htmlFor="cancel-reason" className="text-xs">
          Reason (staff only) <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="cancel-reason"
          rows={3}
          maxLength={500}
          value={reason}
          aria-invalid={missing ? true : undefined}
          onChange={(e) => {
            setReason(e.target.value);
            setMissing(false);
          }}
        />
        <FieldError id="cancel-reason-error">{missing ? 'Add a reason.' : submit.fieldErrors.reason}</FieldError>
      </div>
    </FormDialog>
  );
}
