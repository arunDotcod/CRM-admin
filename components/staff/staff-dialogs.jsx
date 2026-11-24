'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SetupLinkPanel } from '@/components/staff/setup-link-panel';
import { ROLE_DESCRIPTIONS, ROLES, inviteFieldErrors, roleLabel, staffErrorMessage } from '@/lib/staff';
import { cn } from '@/lib/utils';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} className="text-xs font-medium text-destructive">
      {children}
    </p>
  );
}

function FormError({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  );
}

/** Radio cards for the three roles (used by invite and change role). */
function RolePicker({ value, onChange, name, error }) {
  return (
    <fieldset className="space-y-2" aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="mb-1 text-sm font-medium">Role</legend>
      {ROLES.map((role) => (
        <label
          key={role}
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors',
            value === role ? 'border-brand bg-brand/5' : 'hover:bg-muted/50',
          )}
        >
          <input
            type="radio"
            name={name}
            value={role}
            checked={value === role}
            onChange={() => onChange(role)}
            className="mt-0.5 accent-[hsl(var(--brand))]"
          />
          <span>
            <span className="block font-medium">{roleLabel(role)}</span>
            <span className="block text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</span>
          </span>
        </label>
      ))}
      <FieldError id={`${name}-error`}>{error}</FieldError>
    </fieldset>
  );
}

/**
 * Invite: name, email, role → POST /staff. On success the dialog switches to the setup link
 * (SetupLinkPanel) and calls `onInvited(staff)` so the list updates behind it.
 */
export function InviteDialog({ open, onOpenChange, onInvited, invite }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'OPS' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (open) {
      setForm({ name: '', email: '', role: 'OPS' });
      setErrors({});
      setFormError(null);
      setResult(null);
    }
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    const name = form.name.trim();
    const email = form.email.trim();
    if (!name) next.name = 'Enter their name.';
    else if (name.length > 160) next.name = 'Use 160 characters or fewer.';
    if (!EMAIL_RE.test(email)) next.email = 'Enter a valid email address.';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const data = await invite({ name, email, role: form.role });
      setResult(data);
      onInvited?.(data);
    } catch (error) {
      const fields = inviteFieldErrors(error);
      if (error?.code === 'CONFLICT') fields.email = staffErrorMessage('invite', error);
      if (Object.keys(fields).length) setErrors(fields);
      else setFormError(staffErrorMessage('invite', error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !saving && onOpenChange(value)}>
      <DialogContent>
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>{result.name} is invited</DialogTitle>
              <DialogDescription>
                {roleLabel(result.role)} · {result.email}. They set a password and an authenticator app from the link.
              </DialogDescription>
            </DialogHeader>
            <SetupLinkPanel
              name={result.name}
              email={result.email}
              setupUrl={result.setupUrl}
              setupExpiresAt={result.setupExpiresAt}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="grid gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>Invite staff member</DialogTitle>
              <DialogDescription>
                You get a one-time setup link to send them. They choose a password and set up two-step verification.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="invite-name">Name</Label>
              <Input
                id="invite-name"
                autoComplete="off"
                value={form.name}
                maxLength={160}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'invite-name-error' : undefined}
              />
              <FieldError id="invite-name-error">{errors.name}</FieldError>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="invite-email">Work email</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="off"
                value={form.email}
                maxLength={320}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'invite-email-error' : undefined}
              />
              <FieldError id="invite-email-error">{errors.email}</FieldError>
            </div>
            <RolePicker
              name="invite-role"
              value={form.role}
              onChange={(role) => setForm((prev) => ({ ...prev, role }))}
              error={errors.role}
            />
            <FormError>{formError}</FormError>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : null} Invite
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Edit name and role → PUT /staff/:id { name?, role? } (only the changed fields). */
export function EditStaffDialog({ target, onOpenChange, onSave }) {
  const [name, setName] = useState(target?.name || '');
  const [role, setRole] = useState(target?.role || 'OPS');
  const [nameError, setNameError] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(target?.name || '');
    setRole(target?.role || 'OPS');
    setNameError(null);
    setError(null);
  }, [target]);

  const trimmed = name.trim();
  const changes = {};
  if (target && trimmed !== target.name) changes.name = trimmed;
  if (target && role !== target.role) changes.role = role;
  const changed = Object.keys(changes).length > 0;

  const submit = async (event) => {
    event.preventDefault();
    if (!changed) {
      onOpenChange(false);
      return;
    }
    if (!trimmed || trimmed.length > 160) {
      setNameError(trimmed ? 'Use 160 characters or fewer.' : 'Enter a name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(target, changes);
      onOpenChange(false);
    } catch (err) {
      setError(staffErrorMessage(changes.role ? 'role' : 'edit', err, target));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(target)} onOpenChange={(value) => !saving && onOpenChange(value)}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Edit staff member</DialogTitle>
            <DialogDescription>
              {target?.email}. A new role applies on their next page load.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-staff-name">Name</Label>
            <Input
              id="edit-staff-name"
              autoComplete="off"
              value={name}
              maxLength={160}
              onChange={(event) => {
                setName(event.target.value);
                setNameError(null);
              }}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? 'edit-staff-name-error' : undefined}
            />
            <FieldError id="edit-staff-name-error">{nameError}</FieldError>
          </div>
          <RolePicker name="edit-staff-role" value={role} onChange={setRole} />
          <FormError>{error}</FormError>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !changed}>
              {saving ? <Loader2 className="animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Confirmation for disable / enable / reset TOTP / resend setup. `action` = { kind, target,
 * title, description, confirmLabel, destructive, run }. `run()` may return a setup link result,
 * which is then shown in the same dialog.
 */
export function ConfirmActionDialog({ action, onOpenChange }) {
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    setError(null);
    setResult(null);
  }, [action]);

  const confirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await action.run();
      if (data?.setupUrl) setResult(data);
      else onOpenChange(false);
    } catch (err) {
      setError(staffErrorMessage(action.kind, err, action.target));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(action)} onOpenChange={(value) => !saving && onOpenChange(value)}>
      <DialogContent>
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>New setup link for {result.name}</DialogTitle>
              <DialogDescription>The previous link no longer works.</DialogDescription>
            </DialogHeader>
            <SetupLinkPanel
              name={result.name}
              email={result.email}
              setupUrl={result.setupUrl}
              setupExpiresAt={result.setupExpiresAt}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{action?.title}</DialogTitle>
              <DialogDescription>{action?.description}</DialogDescription>
            </DialogHeader>
            <FormError>{error}</FormError>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button variant={action?.destructive ? 'destructive' : 'default'} onClick={confirm} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : null} {action?.confirmLabel}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
