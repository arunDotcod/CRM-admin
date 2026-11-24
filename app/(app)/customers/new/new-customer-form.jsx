'use client';

/**
 * New customer (BO28; api-contracts §12.4 POST /admin/customers, plan D15): organization,
 * business profile, owner and the first subscription in one request. On 201 the page goes to the
 * new customer. An unknown owner email gets a set-password email; a known one is added as owner.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { customerApi, scopedErrors } from '@/lib/customer-detail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { InlineAlert, useSubmit } from '@/components/customers/detail/dialog-kit';
import { ProfileFields, isTimeZone, validateProfile } from '@/components/customers/detail/lifecycle-dialogs';
import { useSettings } from '@/components/customers/detail/lifecycle-dialogs';
import {
  FieldError,
  SubscriptionForm,
  localDay,
  subscriptionDefaults,
  toSubscriptionInput,
  validateSubscription,
} from '@/components/subscriptions/subscription-form';

const PROFILE_ONLY = [
  { key: 'website', label: 'Website', max: 240 },
  { key: 'industry', label: 'Industry', max: 80 },
  { key: 'size', label: 'Company size', max: 40 },
  { key: 'hoursPreset', label: 'Business days', max: 40, placeholder: 'Monday–Friday' },
  { key: 'hoursStart', label: 'Opens', max: 5, time: true },
  { key: 'hoursEnd', label: 'Closes', max: 5, time: true },
];
const ORG_FIELDS = [
  { key: 'name', label: 'Organization name', max: 160, required: true },
  { key: 'timezone', label: 'Time zone', max: 64, required: true },
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function defaultTimeZone() {
  try {
    const raw = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Some browsers still report the legacy alias.
    const tz = raw === 'Asia/Calcutta' ? 'Asia/Kolkata' : raw;
    return isTimeZone(tz) ? tz : 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

function Card({ title, description, children }) {
  return (
    <section className="rounded-xl border border-border bg-background">
      <div className="border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function NewCustomerForm() {
  const router = useRouter();
  const { loading, settings, error: settingsError } = useSettings(true);
  const [org, setOrg] = useState({ name: '', timezone: defaultTimeZone() });
  const [profile, setProfile] = useState({ website: '', industry: '', size: '', description: '', hoursPreset: '', hoursStart: '', hoursEnd: '' });
  const [owner, setOwner] = useState({ name: '', email: '' });
  const [sub, setSub] = useState(null);
  const [message, setMessage] = useState('');
  const [clientErrors, setClientErrors] = useState({});
  const submit = useSubmit();

  useEffect(() => {
    if (!loading && !sub) setSub(subscriptionDefaults(settings));
  }, [loading, settings, sub]);

  /** Setter that also drops the client errors of the fields that changed in `section`. */
  const ERROR_KEYS = { startDate: ['startsAt'], startMode: ['startsAt'], endDate: ['endsAt'], openEnded: ['endsAt'], channels: ['limits.channels'] };
  const edit = (section, setter, prev) => (next) => {
    const current = clientErrors[section];
    if (current && Object.keys(current).length) {
      const rest = { ...current };
      for (const key of Object.keys(next)) {
        if (next[key] === prev[key]) continue;
        for (const errKey of ERROR_KEYS[key] || [key, `limits.${key}`]) delete rest[errKey];
      }
      setClientErrors({ ...clientErrors, [section]: rest });
    }
    setter(next);
  };

  const api = submit.fieldErrors;
  const orgErrors = { ...scopedErrors(api, 'organization.'), ...clientErrors.org };
  const profileErrors = { ...scopedErrors(api, 'organization.profile.'), ...clientErrors.profile };
  const ownerErrors = { ...scopedErrors(api, 'owner.'), ...clientErrors.owner };
  const subErrors = { ...scopedErrors(api, 'subscription.'), ...clientErrors.sub };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (submit.busy || !sub) return;
    const errors = {
      org: validateProfile({ name: org.name, timezone: org.timezone }),
      profile: validateProfile({ ...profile }, { requireName: false }),
      owner: {},
      sub: validateSubscription(sub, { minStartDay: localDay(Date.now() - 86_400_000) }),
    };
    if (!owner.name.trim()) errors.owner.name = 'Required.';
    if (!EMAIL_RE.test(owner.email.trim())) errors.owner.email = 'Enter a valid email address.';
    setClientErrors(errors);
    if (Object.values(errors).some((e) => Object.keys(e).length)) {
      submit.setError('Check the highlighted fields.');
      return;
    }

    const profileBody = {};
    for (const [key, value] of Object.entries(profile)) if (value.trim()) profileBody[key] = value.trim();
    const body = {
      organization: { name: org.name.trim(), timezone: org.timezone.trim() },
      owner: { name: owner.name.trim(), email: owner.email.trim() },
      subscription: toSubscriptionInput(sub),
    };
    if (Object.keys(profileBody).length) body.organization.profile = profileBody;
    if (message.trim()) body.message = message.trim();

    const result = await submit.run(() => customerApi.create(body));
    if (!result) return;
    if (result.ownerWasExisting) {
      toast.success(`${result.name} created`, {
        description: `${owner.email.trim()} already had an account, so they were added as the owner and got an "added as owner" email.`,
        duration: 10000,
      });
    } else {
      toast.success(`${result.name} created`, {
        description: `The owner gets a set-password email (link valid 7 days).`,
        duration: 8000,
      });
    }
    router.push(`/customers/${encodeURIComponent(result.id)}`);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto max-w-3xl space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/customers">
          <ArrowLeft /> Customers
        </Link>
      </Button>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">New customer</h1>
        <p className="text-sm text-muted-foreground">
          Creates a verified organization, its owner and the first subscription. If the owner email already has an account,
          that person is added as the owner instead of getting a new account.
        </p>
      </div>

      <Card title="Organization">
        <ProfileFields idPrefix="new-org" values={org} onChange={edit('org', setOrg, org)} errors={orgErrors} disabled={submit.busy} fields={ORG_FIELDS} description={false} />
      </Card>

      <Card title="Business profile" description="Optional. The customer can change it later.">
        <ProfileFields idPrefix="new-profile" values={profile} onChange={edit('profile', setProfile, profile)} errors={profileErrors} disabled={submit.busy} fields={PROFILE_ONLY} />
      </Card>

      <Card title="Owner" description="Gets a set-password email, or an “added as owner” email if they already have an account.">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { key: 'name', label: 'Owner name', type: 'text', max: 160, auto: 'name' },
            { key: 'email', label: 'Owner email', type: 'email', max: 320, auto: 'email' },
          ].map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`new-owner-${f.key}`} className="text-xs">
                {f.label} <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`new-owner-${f.key}`}
                type={f.type}
                autoComplete="off"
                maxLength={f.max}
                value={owner[f.key]}
                disabled={submit.busy}
                aria-invalid={ownerErrors[f.key] ? true : undefined}
                aria-describedby={ownerErrors[f.key] ? `new-owner-${f.key}-error` : undefined}
                onChange={(e) => edit('owner', setOwner, owner)({ ...owner, [f.key]: e.target.value })}
              />
              <FieldError id={`new-owner-${f.key}-error`}>{ownerErrors[f.key]}</FieldError>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-message" className="text-xs">
            Message to the owner (optional)
          </Label>
          <Textarea
            id="new-message"
            rows={2}
            maxLength={1000}
            value={message}
            disabled={submit.busy}
            onChange={(e) => setMessage(e.target.value)}
          />
          <FieldError id="new-message-error">{api.message}</FieldError>
        </div>
      </Card>

      <Card title="Subscription" description="Limits are prefilled from the default limits in Settings.">
        {settingsError ? (
          <InlineAlert tone="warning">Couldn&apos;t load the default limits ({settingsError.message}). Fill them in by hand.</InlineAlert>
        ) : null}
        {sub ? (
          <SubscriptionForm idPrefix="new-sub" values={sub} onChange={edit('sub', setSub, sub)} errors={subErrors} disabled={submit.busy} />
        ) : (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-2/3" />
          </div>
        )}
      </Card>

      <InlineAlert>{submit.error}</InlineAlert>
      <div className="flex flex-col-reverse gap-2 pb-6 sm:flex-row sm:justify-end">
        <Button asChild variant="outline" type="button">
          <Link href="/customers">Cancel</Link>
        </Button>
        <Button type="submit" disabled={submit.busy || !sub} className="bg-brand text-brand-foreground hover:bg-brand/90">
          {submit.busy ? <Loader2 className="animate-spin" /> : null}
          Create customer
        </Button>
      </div>
    </form>
  );
}
