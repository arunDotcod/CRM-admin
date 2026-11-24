'use client';

/**
 * Customer detail (BO18, BO28): header with state badges and the action bar, then the Overview,
 * Subscription, Usage, Workspace and Activity tabs (`?tab=` keeps the tab in the URL). Every
 * write refetches the detail; no optimistic UI.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Loader2,
  MailCheck,
  PlayCircle,
  RotateCcw,
  Send,
  ShieldOff,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { availableActions, customerApi, describeError, inboundVoiceOutcome } from '@/lib/customer-detail';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorState } from '@/components/common/states';
import { StatusBadge } from '@/components/customers/status-badge';
import { InlineAlert } from '@/components/customers/detail/dialog-kit';
import {
  ConfirmActionDialog,
  ProfileDialog,
  RejectDialog,
  SuspendDialog,
  VerifyDialog,
} from '@/components/customers/detail/lifecycle-dialogs';
import { OverviewTab } from '@/components/customers/detail/overview-tab';
import { SubscriptionTab } from '@/components/customers/detail/subscription-tab';
import { UsageTab } from '@/components/customers/detail/usage-tab';
import { WorkspaceTab } from '@/components/customers/detail/workspace-tab';
import { ActivityTab } from '@/components/customers/detail/activity-tab';
import {
  AddSubscriptionDialog,
  CancelSubscriptionDialog,
  EditSubscriptionDialog,
} from '@/components/subscriptions/subscription-dialogs';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'usage', label: 'Usage' },
  { value: 'workspace', label: 'Workspace' },
  { value: 'activity', label: 'Activity' },
];

function ActionBar({ actions, open, onResend, resendBusy }) {
  const buttons = [
    actions.verify && { key: 'verify', label: 'Verify', icon: BadgeCheck, primary: true },
    actions.reject && { key: 'reject', label: 'Reject', icon: XCircle, danger: true },
    actions.reopen && { key: 'reopen', label: 'Reopen', icon: RotateCcw },
    actions.suspend && { key: 'suspend', label: 'Suspend', icon: Ban, danger: true },
    actions.reactivate && { key: 'reactivate', label: 'Reactivate', icon: PlayCircle, primary: true },
    actions.resendLink && { key: 'resend', label: 'Resend link', icon: Send },
    actions.markEmailConfirmed && { key: 'markEmailConfirmed', label: 'Mark email confirmed', icon: MailCheck },
  ].filter(Boolean);
  if (!buttons.length) return null;
  return (
    <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Customer actions">
      {buttons.map(({ key, label, icon: Icon, primary, danger }) => (
        <Button
          key={key}
          size="sm"
          variant={primary ? 'default' : 'outline'}
          className={
            primary
              ? 'bg-brand text-brand-foreground hover:bg-brand/90'
              : danger
                ? 'text-destructive hover:text-destructive'
                : undefined
          }
          disabled={key === 'resend' && resendBusy}
          onClick={() => (key === 'resend' ? onResend() : open(key))}
        >
          {key === 'resend' && resendBusy ? <Loader2 className="animate-spin" /> : <Icon />}
          {label}
        </Button>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-9 w-full max-w-md" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

export function CustomerDetail({ id }) {
  const { can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab = TABS.some((t) => t.value === tabParam) ? tabParam : 'overview';

  const [customer, setCustomer] = useState(null);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialog, setDialog] = useState(null); // { kind, subscription? }
  const [voiceNotice, setVoiceNotice] = useState(null);
  const [resendBusy, setResendBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await customerApi.detail(id);
      setCustomer(data);
      setError(null);
    } catch (err) {
      setError(err);
    }
    setRefreshKey((n) => n + 1);
  }, [id]);

  useEffect(() => {
    setCustomer(null);
    refresh();
  }, [refresh]);

  const setTab = (value) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'overview') params.delete('tab');
    else params.set('tab', value);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  const onDone = useCallback(
    (result) => {
      const voice = inboundVoiceOutcome(result?.inboundVoice);
      setVoiceNotice(voice);
      refresh();
    },
    [refresh],
  );

  const onResend = async () => {
    setResendBusy(true);
    try {
      const result = await customerApi.resendLink(id);
      const purpose = result?.pendingLink?.purpose;
      toast.success(purpose === 'SET_PASSWORD' ? 'Set-password link sent' : 'Confirmation link sent', {
        description: result?.owner?.email ? `Sent to ${result.owner.email}. Earlier links no longer work.` : undefined,
      });
      refresh();
    } catch (err) {
      const described = describeError(err);
      toast.error("Couldn't resend the link", { description: described.message });
      if (described.refetch) refresh();
    } finally {
      setResendBusy(false);
    }
  };

  if (error && !customer) {
    return (
      <>
        <BackLink />
        <ErrorState
          message={error.code === 'NOT_FOUND' ? 'This customer does not exist or was deleted.' : error.message}
          onRetry={error.code === 'NOT_FOUND' ? undefined : refresh}
        />
      </>
    );
  }
  if (!customer) {
    return (
      <>
        <BackLink />
        <DetailSkeleton />
      </>
    );
  }

  const actions = availableActions(customer, can);
  const close = () => setDialog(null);
  const dialogProps = (kind) => ({
    open: dialog?.kind === kind,
    onOpenChange: (open) => (!open ? close() : null),
    customer,
    onDone,
    onStale: refresh,
  });

  return (
    <>
      <BackLink />
      <div className="mb-5 flex flex-col gap-4">
        <div className="min-w-0 space-y-1.5">
          <h1 className="break-words text-2xl font-semibold tracking-tight">{customer.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono text-xs">{customer.id}</span>
            <StatusBadge kind="state" value={customer.entitlement?.state} />
            {customer.verification !== customer.entitlement?.state ? (
              <StatusBadge kind="verification" value={customer.verification} />
            ) : null}
            {customer.owner ? <StatusBadge kind="email" value={customer.owner.emailConfirmed} /> : null}
            {customer.status === 'SUSPENDED' ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" /> Members are signed out
              </span>
            ) : null}
          </div>
        </div>
        <ActionBar actions={actions} open={(kind) => setDialog({ kind })} onResend={onResend} resendBusy={resendBusy} />
      </div>

      {voiceNotice ? (
        <InlineAlert tone={voiceNotice.tone === 'warning' ? 'warning' : 'info'} className="mb-4">
          <div className="flex items-start justify-between gap-3">
            <p>{voiceNotice.text}</p>
            <button type="button" className="text-xs underline" onClick={() => setVoiceNotice(null)}>
              Dismiss
            </button>
          </div>
        </InlineAlert>
      ) : null}
      {error ? (
        <InlineAlert tone="warning" className="mb-4">
          Couldn&apos;t refresh this customer: {error.message}
        </InlineAlert>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="overview" className="mt-4">
          <OverviewTab customer={customer} actions={actions} onEditProfile={() => setDialog({ kind: 'profile' })} />
        </TabsContent>
        <TabsContent value="subscription" className="mt-4">
          <SubscriptionTab
            customer={customer}
            actions={actions}
            onAdd={() => setDialog({ kind: 'addSubscription' })}
            onEdit={(subscription) => setDialog({ kind: 'editSubscription', subscription })}
            onCancel={(subscription) => setDialog({ kind: 'cancelSubscription', subscription })}
          />
        </TabsContent>
        <TabsContent value="usage" className="mt-4">
          {tab === 'usage' ? <UsageTab customerId={customer.id} key={refreshKey} /> : null}
        </TabsContent>
        <TabsContent value="workspace" className="mt-4">
          {tab === 'workspace' ? <WorkspaceTab customerId={customer.id} key={refreshKey} /> : null}
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          {tab === 'activity' ? <ActivityTab customerId={customer.id} refreshKey={refreshKey} /> : null}
        </TabsContent>
      </Tabs>

      <VerifyDialog {...dialogProps('verify')} />
      <RejectDialog {...dialogProps('reject')} />
      <SuspendDialog {...dialogProps('suspend')} />
      <ConfirmActionDialog kind="reopen" {...dialogProps('reopen')} />
      <ConfirmActionDialog kind="reactivate" {...dialogProps('reactivate')} />
      <ConfirmActionDialog kind="markEmailConfirmed" {...dialogProps('markEmailConfirmed')} />
      <ProfileDialog {...dialogProps('profile')} />
      <AddSubscriptionDialog {...dialogProps('addSubscription')} />
      <EditSubscriptionDialog {...dialogProps('editSubscription')} subscription={dialog?.subscription} />
      <CancelSubscriptionDialog {...dialogProps('cancelSubscription')} subscription={dialog?.subscription} />
    </>
  );
}

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
      <Link href="/customers">
        <ArrowLeft /> Customers
      </Link>
    </Button>
  );
}
