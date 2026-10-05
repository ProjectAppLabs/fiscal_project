'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';

import { ROUTES } from '@/lib/constants';
import { getApiErrorMessage } from '@/lib/services/errors';
import { useAuthStore } from '@/lib/stores/authStore';

const MIN_PASSWORD_LENGTH = 8;
const CODE_LENGTH = 6;
const INPUT_CLASS = 'w-full rounded border border-border bg-card px-3 py-2';
const SUBMIT_CLASS =
  'w-full rounded bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50';

export default function ForgotPasswordPage() {
  const t = useTranslations('forgotPassword');
  const router = useRouter();
  const sendPasswordResetCode = useAuthStore((s) => s.sendPasswordResetCode);
  const resetPassword = useAuthStore((s) => s.resetPassword);

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const onSendCode = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await sendPasswordResetCode(email);
      setMessage(t('codeSent'));
      setStep('code');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t('sendCodeFailed')));
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword !== confirmPassword) {
      setError(t('passwordsMismatch'));
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(t('passwordTooShort'));
      return;
    }

    setLoading(true);

    try {
      await resetPassword({ email, code, new_password: newPassword });
      setMessage(t('resetSuccess'));
      router.replace(ROUTES.SIGN_IN);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t('resetFailed')));
    } finally {
      setLoading(false);
    }
  };

  const feedback = (
    <>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-success" role="status">
          {message}
        </p>
      ) : null}
    </>
  );

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>

      {step === 'email' ? (
        <form className="mt-6 space-y-4" onSubmit={onSendCode}>
          <p className="text-sm text-muted-foreground">{t('emailIntro')}</p>

          <div>
            <label className="sr-only" htmlFor="forgot-email">
              {t('email')}
            </label>
            <input
              id="forgot-email"
              className={INPUT_CLASS}
              placeholder={t('email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <button className={SUBMIT_CLASS} type="submit" disabled={loading}>
            {loading ? t('sendingCode') : t('sendCode')}
          </button>

          {feedback}
        </form>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={onResetPassword}>
          <p className="text-sm text-muted-foreground">
            {t.rich('codeIntro', { email, strong: (chunks) => <strong>{chunks}</strong> })}
          </p>

          <div>
            <label className="sr-only" htmlFor="forgot-code">
              {t('code')}
            </label>
            <input
              id="forgot-code"
              className={`${INPUT_CLASS} text-center text-2xl tracking-widest`}
              placeholder="000000"
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
              maxLength={CODE_LENGTH}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">{t('codeHint')}</p>
          </div>

          <div>
            <label className="sr-only" htmlFor="forgot-new-password">
              {t('newPassword')}
            </label>
            <input
              id="forgot-new-password"
              className={INPUT_CLASS}
              placeholder={t('newPassword')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">{t('newPasswordHint')}</p>
          </div>

          <div>
            <label className="sr-only" htmlFor="forgot-confirm-password">
              {t('confirmPassword')}
            </label>
            <input
              id="forgot-confirm-password"
              className={INPUT_CLASS}
              placeholder={t('confirmPassword')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              required
            />
          </div>

          <button className={SUBMIT_CLASS} type="submit" disabled={loading}>
            {loading ? t('resetting') : t('reset')}
          </button>

          {feedback}

          <button
            type="button"
            onClick={() => setStep('email')}
            className="w-full text-center text-sm text-info hover:underline"
          >
            {t('backToEmail')}
          </button>
        </form>
      )}

      <div className="mt-6 text-center text-sm">
        <Link href={ROUTES.SIGN_IN} className="text-info hover:underline">
          {t('backToSignIn')}
        </Link>
      </div>
    </main>
  );
}
