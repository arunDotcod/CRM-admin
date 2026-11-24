'use client';

/**
 * SubscriptionInput form (api-contracts §12.4), shared by Verify, New customer and Add/Renew.
 * Dates are calendar days in the staff member's local time: a period "ends on" a day means it
 * ends at 00:00 that day. Limits are prefilled from `GET /admin/settings` `defaultLimits`.
 */
import { cn } from '@/lib/utils';
import { CHANNELS, CHANNEL_LABELS } from '@/lib/customers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export const LIMIT_FIELDS = [
  { key: 'aiMonthlyReplies', label: 'AI replies / month', min: 0, max: 10_000_000 },
  { key: 'voiceMonthlyMinutes', label: 'Voice minutes / month', min: 0, max: 1_000_000 },
  { key: 'maxAiEmployees', label: 'AI employees', min: 0, max: 1000 },
  { key: 'maxSeats', label: 'Seats', min: 1, max: 10_000 },
];

const FALLBACK_LIMITS = {
  aiMonthlyReplies: 1000,
  voiceMonthlyMinutes: 0,
  maxAiEmployees: 1,
  maxSeats: 3,
  channels: ['WEBCHAT'],
  periodDays: 30,
  openEnded: false,
};

/** yyyy-mm-dd of a Date in local time. */
export function localDay(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(day, days) {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + Number(days || 0));
  return localDay(d);
}

/** Local yyyy-mm-dd → ISO instant at 00:00 local. */
export function dayToIso(day) {
  return new Date(`${day}T00:00:00`).toISOString();
}

/** Form values from the settings (and an optional start day for a renewal). */
export function subscriptionDefaults(settings, { startMode = 'now', startDay } = {}) {
  const d = { ...FALLBACK_LIMITS, ...(settings?.defaultLimits || {}) };
  const today = localDay(new Date());
  const start = startDay || today;
  return {
    startMode,
    startDate: start,
    openEnded: Boolean(d.openEnded),
    endDate: addDays(start, d.periodDays || 30),
    graceDays: String(settings?.graceDaysDefault ?? 7),
    aiMonthlyReplies: String(d.aiMonthlyReplies),
    voiceMonthlyMinutes: String(d.voiceMonthlyMinutes),
    maxAiEmployees: String(d.maxAiEmployees),
    maxSeats: String(d.maxSeats),
    channels: [...(d.channels || [])],
    note: '',
  };
}

export function limitsFromValues(values) {
  return {
    aiMonthlyReplies: Number(values.aiMonthlyReplies),
    voiceMonthlyMinutes: Number(values.voiceMonthlyMinutes),
    maxAiEmployees: Number(values.maxAiEmployees),
    maxSeats: Number(values.maxSeats),
    channels: CHANNELS.filter((c) => values.channels.includes(c)),
  };
}

function intError(raw, min, max) {
  if (raw === '' || raw == null) return 'Required.';
  const n = Number(raw);
  if (!Number.isInteger(n)) return 'Whole numbers only.';
  if (n < min || n > max) return `Between ${min.toLocaleString('en-IN')} and ${max.toLocaleString('en-IN')}.`;
  return null;
}

/** Client-side checks with the API's rules; keys match the API field paths. */
export function validateSubscription(values, { requireEnd = true, minStartDay } = {}) {
  const errors = {};
  for (const f of LIMIT_FIELDS) {
    const e = intError(values[f.key], f.min, f.max);
    if (e) errors[`limits.${f.key}`] = e;
  }
  const g = intError(values.graceDays, 0, 90);
  if (g) errors.graceDays = g;
  if (values.startMode === 'date') {
    if (!values.startDate) errors.startsAt = 'Pick a start date.';
    else if (minStartDay && values.startDate < minStartDay) errors.startsAt = 'The start can be at most 24 hours in the past.';
  }
  if (requireEnd && !values.openEnded) {
    const start = values.startMode === 'date' ? values.startDate : localDay(new Date());
    if (!values.endDate) errors.endsAt = 'Pick an end date, or make it open-ended.';
    else if (values.startMode !== 'renew' && values.endDate <= start) errors.endsAt = 'The end date must be after the start date.';
  }
  if ((values.note || '').length > 500) errors.note = 'At most 500 characters.';
  return errors;
}

/** Form values → SubscriptionInput (plus `renew` for the renew mode). */
export function toSubscriptionInput(values) {
  const body = {
    endsAt: values.openEnded ? null : dayToIso(values.endDate),
    graceDays: Number(values.graceDays),
    limits: limitsFromValues(values),
  };
  if (values.startMode === 'date') body.startsAt = dayToIso(values.startDate);
  if (values.startMode === 'renew') body.renew = true;
  if (values.note?.trim()) body.note = values.note.trim();
  return body;
}

export function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} className="text-xs text-destructive">
      {children}
    </p>
  );
}

function Field({ id, label, error, hint, className, children }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

/**
 * `startModes`: which start options to offer, from 'now' | 'date' | 'renew'.
 * `renewLabel`: text for the renew option (e.g. "When the current period ends (12 Dec 2026)").
 */
export function SubscriptionForm({
  idPrefix = 'sub',
  values,
  onChange,
  errors = {},
  disabled,
  startModes = ['now', 'date'],
  renewLabel = 'When the current period ends',
  showNote = true,
  showStart = true,
}) {
  const set = (patch) => onChange({ ...values, ...patch });
  const id = (name) => `${idPrefix}-${name}`;
  const invalid = (key) => (errors[key] ? { 'aria-invalid': true, 'aria-describedby': `${id(key)}-error` } : {});
  const startLabels = { now: 'Now', date: 'On a date', renew: renewLabel };

  return (
    <div className="space-y-4">
      {showStart ? (
        <fieldset className="space-y-2" disabled={disabled}>
          <legend className="text-xs font-medium">Start</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {startModes.map((mode) => (
              <label key={mode} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={id('start-mode')}
                  value={mode}
                  checked={values.startMode === mode}
                  onChange={() => set({ startMode: mode })}
                  className="h-4 w-4 accent-[hsl(var(--brand))]"
                />
                {startLabels[mode]}
              </label>
            ))}
          </div>
          {values.startMode === 'date' ? (
            <div className="max-w-[200px] space-y-1.5">
              <Input
                id={id('startsAt')}
                type="date"
                aria-label="Start date"
                value={values.startDate}
                onChange={(e) => set({ startDate: e.target.value })}
                {...invalid('startsAt')}
              />
            </div>
          ) : null}
          <FieldError id={`${id('startsAt')}-error`}>{errors.startsAt}</FieldError>
        </fieldset>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id('endsAt')} label="End date" error={errors.endsAt} hint={values.openEnded ? 'Runs until canceled.' : 'The period ends at 00:00 on this day.'}>
          <div className="space-y-2">
            <Input
              id={id('endsAt')}
              type="date"
              value={values.openEnded ? '' : values.endDate}
              disabled={disabled || values.openEnded}
              onChange={(e) => set({ endDate: e.target.value })}
              {...invalid('endsAt')}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[hsl(var(--brand))]"
                checked={values.openEnded}
                disabled={disabled}
                onChange={(e) => set({ openEnded: e.target.checked })}
              />
              Open-ended
            </label>
          </div>
        </Field>
        <Field id={id('graceDays')} label="Grace days" error={errors.graceDays} hint="AI keeps working this long after the end.">
          <Input
            id={id('graceDays')}
            type="number"
            inputMode="numeric"
            min={0}
            max={90}
            value={values.graceDays}
            disabled={disabled}
            onChange={(e) => set({ graceDays: e.target.value })}
            {...invalid('graceDays')}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {LIMIT_FIELDS.map((f) => (
          <Field key={f.key} id={id(f.key)} label={f.label} error={errors[`limits.${f.key}`]}>
            <Input
              id={id(f.key)}
              type="number"
              inputMode="numeric"
              min={f.min}
              max={f.max}
              value={values[f.key]}
              disabled={disabled}
              onChange={(e) => set({ [f.key]: e.target.value })}
              {...(errors[`limits.${f.key}`] ? { 'aria-invalid': true, 'aria-describedby': `${id(f.key)}-error` } : {})}
            />
          </Field>
        ))}
      </div>

      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-xs font-medium">Channels in the plan</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CHANNELS.map((channel) => (
            <label key={channel} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[hsl(var(--brand))]"
                checked={values.channels.includes(channel)}
                onChange={(e) =>
                  set({
                    channels: e.target.checked
                      ? [...values.channels, channel]
                      : values.channels.filter((c) => c !== channel),
                  })
                }
              />
              {CHANNEL_LABELS[channel]}
            </label>
          ))}
        </div>
        <FieldError id={`${id('channels')}-error`}>{errors['limits.channels']}</FieldError>
      </fieldset>

      {showNote ? (
        <Field id={id('note')} label="Subscription note (staff only)" error={errors.note}>
          <Textarea
            id={id('note')}
            rows={2}
            maxLength={500}
            value={values.note}
            disabled={disabled}
            placeholder="E.g. pilot pricing agreed on the call"
            onChange={(e) => set({ note: e.target.value })}
          />
        </Field>
      ) : null}
    </div>
  );
}
