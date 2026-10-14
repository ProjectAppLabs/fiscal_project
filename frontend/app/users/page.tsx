'use client';

import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useEffect, useState } from 'react';
import { MailPlus, UserPlus } from 'lucide-react';

import { StepErrors } from '@/components/console/ClientSystemForm';
import { ConsoleLoadError } from '@/components/console/ConsoleStatus';
import { Page } from '@/components/layout/Page';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Choice, Field, Input } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, SkeletonTable } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { formatRelative } from '@/lib/format';
import { useIsAdmin } from '@/lib/hooks/useIsAdmin';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { stepErrors } from '@/lib/services/onboarding';
import { fetchUsers, inviteUser, resendInvitation, updateUser, type ConsoleRole, type ConsoleUser } from '@/lib/services/users';
import { useAuthStore } from '@/lib/stores/authStore';
import { HelpTip } from '@/components/console/HelpTip';

/**
 * The people who use the console (H-03), for administrators: invite by e-mail (the invitation carries a code to set
 * the password), change the role, switch someone off. Nobody sees or sets another person's password.
 */
export default function UsersPage() {
  const t = useTranslations('users');
  const { isAuthenticated } = useRequireAuth();
  const isAdmin = useIsAdmin();
  const [users, setUsers] = useState<ConsoleUser[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    let active = true;
    fetchUsers()
      .then((rows) => {
        if (!active) return;
        setUsers(rows);
        setFailed(false);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [isAuthenticated, isAdmin, version]);

  if (!isAuthenticated) return null;
  const reload = () => setVersion((current) => current + 1);

  const inviteButton = (
    <Button icon={<UserPlus aria-hidden className="size-4" />} onClick={() => setInviting(true)} variant="primary">
      {t('invite')}
    </Button>
  );
  return (
    <Page>
      <PageHeader actions={isAdmin ? inviteButton : null} emoji="user" subtitle={t('subtitle')} title={t('title')} />
      {!isAdmin ? <Notice tone="info">{t('adminOnly')}</Notice> : null}
      {isAdmin && failed ? <ConsoleLoadError message={t('error')} onRetry={reload} /> : null}
      {isAdmin && !failed && !users ? <SkeletonTable /> : null}
      {isAdmin && users && users.length === 0 ? <EmptyState action={inviteButton} body={t('emptyBody')} title={t('empty')} /> : null}
      {isAdmin && users && users.length ? <UserTable onChange={reload} users={users} /> : null}
      <Dialog description={t('inviteBody')} onClose={() => setInviting(false)} open={inviting} title={t('invite')}>
        <InviteForm
          onInvited={(user, sent) => {
            setInviting(false);
            toast(sent ? t('invited', { email: user.email }) : t('invitedNoMail', { email: user.email }), sent ? 'success' : 'error');
            reload();
          }}
        />
      </Dialog>
    </Page>
  );
}

function InviteForm({ onInvited }: { onInvited: (user: ConsoleUser, sent: boolean) => void }) {
  const t = useTranslations('users');
  const [form, setForm] = useState({ email: '', first_name: '', last_name: '', role: 'operator' as ConsoleRole });
  const [errors, setErrors] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors(null);
    try {
      const user = await inviteUser({ ...form, email: form.email.trim() });
      onInvited(user, user.invitation_sent);
    } catch (error) {
      setErrors(stepErrors(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => void onSubmit(e)}>
      <Field id="invite-first-name" label={t('firstName')}>
        <Input autoComplete="off" id="invite-first-name" onChange={(e) => set('first_name')(e.target.value)} required value={form.first_name} />
      </Field>
      <Field id="invite-last-name" label={t('lastName')}>
        <Input autoComplete="off" id="invite-last-name" onChange={(e) => set('last_name')(e.target.value)} value={form.last_name} />
      </Field>
      <Field className="sm:col-span-2" hint={t('emailHint')} id="invite-email" label={t('email')}>
        <Input autoComplete="off" id="invite-email" onChange={(e) => set('email')(e.target.value)} required type="email" value={form.email} />
      </Field>
      <fieldset aria-labelledby="invite-role-legend" className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-2 flex items-center gap-1 text-[13px] font-semibold text-ink">
          <span id="invite-role-legend">{t('role')}</span>
          <HelpTip label={t('role')} topic="users.role" />
        </legend>
        {(['operator', 'admin'] as const).map((role) => (
          <Choice
            checked={form.role === role}
            description={t(`roleHints.${role}`)}
            key={role}
            label={t(`roles.${role}`)}
            name="invite-role"
            onChange={() => set('role')(role)}
            type="radio"
          />
        ))}
      </fieldset>
      <div className="flex flex-col gap-3 sm:col-span-2">
        {errors ? <StepErrors errors={errors} /> : null}
        <div>
          <Button icon={<MailPlus aria-hidden className="size-4" />} loading={saving} type="submit" variant="primary">
            {t('sendInvitation')}
          </Button>
        </div>
      </div>
    </form>
  );
}

function UserTable({ users, onChange }: { users: ConsoleUser[]; onChange: () => void }) {
  const t = useTranslations('users');
  const locale = useLocale();
  const me = useAuthStore((s) => s.user?.id);
  const [pending, setPending] = useState<{ user: ConsoleUser; change: 'role' | 'active' } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const apply = async () => {
    if (!pending) return;
    const { user, change } = pending;
    setBusy(user.id);
    try {
      await updateUser(user.id, change === 'role' ? { role: user.role === 'admin' ? 'operator' : 'admin' } : { is_active: !user.is_active });
      toast(t('saved'));
      setPending(null);
      onChange();
    } catch (error) {
      toast(stepErrors(error)[0] ?? t('failed'), 'error');
    } finally {
      setBusy(null);
    }
  };
  const resend = async (user: ConsoleUser) => {
    setBusy(user.id);
    try {
      const result = await resendInvitation(user.id);
      toast(result.invitation_sent ? t('invited', { email: user.email }) : t('invitedNoMail', { email: user.email }), result.invitation_sent ? 'success' : 'error');
    } catch (error) {
      toast(stepErrors(error)[0] ?? t('failed'), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <DataTable<ConsoleUser>
        caption={t('tableCaption')}
        columns={[
          {
            key: 'name',
            header: t('columns.name'),
            mobile: 'body',
            cell: (user) => (
              <>
                <span className="block font-semibold text-ink">
                  {[user.first_name, user.last_name].filter(Boolean).join(' ') || '—'}
                  {user.id === me ? <span className="ml-2 text-[12px] font-medium text-ink-3">{t('you')}</span> : null}
                </span>
                <span className="block text-[13px] text-ink-3">{user.email}</span>
              </>
            ),
          },
          {
            key: 'role',
            header: t('columns.role'),
            mobile: 'title',
            cell: (user) => (
              <Badge size="sm" tone={user.role === 'admin' ? 'primary' : 'neutral'}>
                {t(`roles.${user.role}`)}
              </Badge>
            ),
          },
          {
            key: 'state',
            header: t('columns.state'),
            mobile: 'badge',
            cell: (user) => (
              <Badge size="sm" tone={!user.is_active ? 'neutral' : user.invited ? 'pending' : 'success'}>
                {!user.is_active ? t('states.inactive') : user.invited ? t('states.invited') : t('states.active')}
              </Badge>
            ),
          },
          {
            key: 'lastLogin',
            header: t('columns.lastLogin'),
            className: 'whitespace-nowrap text-[13px] text-ink-2',
            cell: (user) => (user.last_login ? formatRelative(user.last_login, locale) : t('never')),
          },
          {
            key: 'actions',
            header: t('columns.actions'),
            mobile: 'action',
            align: 'end',
            cell: (user) =>
              user.id === me ? null : (
                <span className="inline-flex flex-wrap justify-end gap-2">
                  {user.invited && user.is_active ? (
                    <Button loading={busy === user.id} onClick={() => void resend(user)} size="sm" variant="soft">
                      {t('resend')}
                    </Button>
                  ) : null}
                  <Button onClick={() => setPending({ user, change: 'role' })} size="sm" variant="ghost">
                    {user.role === 'admin' ? t('makeOperator') : t('makeAdmin')}
                  </Button>
                  <Button onClick={() => setPending({ user, change: 'active' })} size="sm" variant="ghost">
                    {user.is_active ? t('deactivate') : t('activate')}
                  </Button>
                </span>
              ),
          },
        ]}
        rowKey={(user) => user.id}
        rows={users}
      />
      <ConfirmDialog
        busy={busy !== null}
        confirmLabel={pending ? confirmLabel(pending, t) : ''}
        danger={pending?.change === 'active' && pending.user.is_active}
        description={pending ? confirmBody(pending, t) : undefined}
        onClose={() => setPending(null)}
        onConfirm={() => void apply()}
        open={pending !== null}
        title={pending ? t('confirmTitle', { name: pending.user.first_name || pending.user.email }) : ''}
      />
    </>
  );
}

function confirmLabel({ user, change }: { user: ConsoleUser; change: 'role' | 'active' }, t: ReturnType<typeof useTranslations<'users'>>) {
  if (change === 'role') return user.role === 'admin' ? t('makeOperator') : t('makeAdmin');
  return user.is_active ? t('deactivate') : t('activate');
}

function confirmBody({ user, change }: { user: ConsoleUser; change: 'role' | 'active' }, t: ReturnType<typeof useTranslations<'users'>>) {
  if (change === 'role') return user.role === 'admin' ? t('makeOperatorBody') : t('makeAdminBody');
  return user.is_active ? t('deactivateBody') : t('activateBody');
}
