'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RotateCw, UserPlus, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { roleLabel, staffApi } from '@/lib/staff';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shell/page';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/states';
import { StaffTable } from '@/components/staff/staff-table';
import { ConfirmActionDialog, EditStaffDialog, InviteDialog } from '@/components/staff/staff-dialogs';

/** BO19 Staff page (SUPER_ADMIN; api-contracts §12.6). */
export function StaffManager() {
  const { me, reload: reloadMe } = useAuth();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState(null);
  const [confirm, setConfirm] = useState(null);
  // Setup link expiry for invites / resends made in this tab (the list does not carry it).
  const [setupExpiry, setSetupExpiry] = useState({});

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setStatus('loading');
    try {
      const data = await staffApi.list();
      setItems(data?.items ?? []);
      setStatus('ready');
    } catch (err) {
      if (quiet) {
        toast.error(err.message);
        return;
      }
      setError(err);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const replace = useCallback((row) => {
    setItems((prev) => {
      const { setupUrl, setupExpiresAt, ...staff } = row;
      const exists = prev.some((item) => item.id === staff.id);
      const next = exists ? prev.map((item) => (item.id === staff.id ? { ...item, ...staff } : item)) : [...prev, staff];
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
    if (row.setupExpiresAt) setSetupExpiry((prev) => ({ ...prev, [row.id]: row.setupExpiresAt }));
  }, []);

  const onAction = (kind, member) => {
    if (kind === 'role') {
      setRoleTarget(member);
      return;
    }
    const isSelf = member.id === me?.id;
    const configs = {
      disable: {
        title: `Disable ${member.name}?`,
        description: `They are signed out everywhere and cannot sign in until enabled again. Their audit history stays.`,
        confirmLabel: 'Disable',
        destructive: true,
        run: async () => {
          const row = await staffApi.disable(member.id);
          replace(row);
          toast.success(`${member.name} is disabled`);
        },
      },
      enable: {
        title: `Enable ${member.name}?`,
        description: member.totpEnrolled
          ? 'They can sign in again with their password and authenticator app.'
          : 'They have not finished setup, so they go back to "Setup pending". Resend a setup link if theirs expired.',
        confirmLabel: 'Enable',
        run: async () => {
          const row = await staffApi.enable(member.id);
          replace(row);
          toast.success(`${member.name} is enabled`);
        },
      },
      'reset-totp': {
        title: `Reset two-step verification for ${member.name}?`,
        description: isSelf
          ? 'Your authenticator app is unlinked and you are signed out now. You set up a new one at your next sign-in.'
          : 'Their authenticator app is unlinked and they are signed out. At their next sign-in they scan a new QR code.',
        confirmLabel: 'Reset',
        destructive: true,
        run: async () => {
          const row = await staffApi.resetTotp(member.id);
          replace(row);
          toast.success(`Two-step verification reset for ${member.name}`);
          if (isSelf) await reloadMe().catch(() => {});
        },
      },
      'resend-setup': {
        title: `New setup link for ${member.name}?`,
        description: 'A fresh one-time link replaces the old one, which stops working.',
        confirmLabel: 'Create new link',
        run: async () => {
          const row = await staffApi.resendSetup(member.id);
          replace(row);
          return row;
        },
      },
    };
    setConfirm({ kind, target: member, ...configs[kind] });
  };

  const saveEdit = async (member, changes) => {
    const row = await staffApi.update(member.id, changes);
    replace(row);
    toast.success(changes.role ? `${row.name} is now ${roleLabel(row.role)}` : `Saved ${row.name}`);
    if (member.id === me?.id) await reloadMe().catch(() => {});
  };

  const counts = items.reduce(
    (acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }),
    {},
  );

  return (
    <>
      <PageHeader
        title="Staff"
        description="Invite staff, change roles, disable accounts and reset two-step verification."
        actions={
          <>
            <Button variant="outline" size="icon" onClick={() => load({ quiet: status === 'ready' })} aria-label="Refresh">
              <RotateCw />
            </Button>
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus /> Invite staff
            </Button>
          </>
        }
      />

      {status === 'loading' ? <TableSkeleton rows={4} cols={6} /> : null}
      {status === 'error' ? <ErrorState message={error?.message} onRetry={() => load()} /> : null}
      {status === 'ready' && items.length === 0 ? (
        <EmptyState icon={Users} title="No staff yet" description="Invite your first colleague." />
      ) : null}
      {status === 'ready' && items.length > 0 ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {items.length} staff · {counts.ACTIVE || 0} active
            {counts.INVITED ? ` · ${counts.INVITED} setup pending` : ''}
            {counts.DISABLED ? ` · ${counts.DISABLED} disabled` : ''}
          </p>
          <StaffTable items={items} meId={me?.id} setupExpiry={setupExpiry} onAction={onAction} />
        </>
      ) : null}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} invite={staffApi.invite} onInvited={replace} />
      <EditStaffDialog target={roleTarget} onOpenChange={(open) => !open && setRoleTarget(null)} onSave={saveEdit} />
      <ConfirmActionDialog action={confirm} onOpenChange={(open) => !open && setConfirm(null)} />
    </>
  );
}
