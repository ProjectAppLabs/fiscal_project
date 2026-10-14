'use client';

import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';

import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, DataItem, DataList } from '@/components/ui/Card';
import { Field, PasswordInput } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { toast } from '@/components/ui/Toast';
import { API_ENDPOINTS } from '@/lib/constants';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { getApiErrorMessage } from '@/lib/services/errors';
import { api } from '@/lib/services/http';
import { useAuthStore } from '@/lib/stores/authStore';

const MIN_PASSWORD_LENGTH = 8;

/** The operator's account (H-02): who is signed in and how to change the password without signing out. */
export default function AccountPage() {
  const t = useTranslations('account');
  const tHeader = useTranslations('header');
  const { isAuthenticated } = useRequireAuth();
  const user = useAuthStore((s) => s.user);

  if (!isAuthenticated) return null;

  return (
    <Page narrow>
      <PageHeader emoji="user" subtitle={t('subtitle')} title={t('title')} />
      <div className="flex flex-col gap-4">
        <Card aria-labelledby="account-data">
          <CardHeader id="account-data" title={t('dataTitle')} />
          <DataList>
            <DataItem label={t('name')}>{[user?.first_name, user?.last_name].filter(Boolean).join(' ') || '—'}</DataItem>
            <DataItem label={t('email')}>{user?.email}</DataItem>
            <DataItem label={t('role')}>{user?.role ? tHeader(`roles.${user.role === 'admin' ? 'admin' : 'operator'}`) : '—'}</DataItem>
          </DataList>
        </Card>
        <ChangePassword />
      </div>
    </Page>
  );
}

function ChangePassword() {
  const t = useTranslations('account');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (next.length < MIN_PASSWORD_LENGTH) return setError(t('tooShort'));
    if (next !== confirm) return setError(t('mismatch'));

    setSaving(true);
    try {
      await api.post(API_ENDPOINTS.UPDATE_PASSWORD, { current_password: current, new_password: next });
      setCurrent('');
      setNext('');
      setConfirm('');
      toast(t('changed'));
    } catch (err) {
      setError(getApiErrorMessage(err, t('failed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card aria-labelledby="account-password">
      <CardHeader id="account-password" subtitle={t('passwordSubtitle')} title={t('passwordTitle')} />
      <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
        <Field id="account-current" label={t('current')}>
          <PasswordInput autoComplete="current-password" id="account-current" onChange={(e) => setCurrent(e.target.value)} required value={current} />
        </Field>
        <Field hint={t('newHint')} id="account-new" label={t('new')}>
          <PasswordInput autoComplete="new-password" id="account-new" onChange={(e) => setNext(e.target.value)} required value={next} />
        </Field>
        <Field id="account-confirm" label={t('confirm')}>
          <PasswordInput autoComplete="new-password" id="account-confirm" onChange={(e) => setConfirm(e.target.value)} required value={confirm} />
        </Field>
        {error ? (
          <p className="rounded-lg bg-danger-bg px-4 py-2.5 text-[13px] font-semibold text-danger-fg" role="alert">
            {error}
          </p>
        ) : null}
        <div>
          <Button loading={saving} loadingLabel={t('saving')} type="submit" variant="primary">
            {t('save')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
