'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';

import { AuthScreen } from '@/components/layout/AuthScreen';
import { Button } from '@/components/ui/Button';
import { Field, Input, PasswordInput } from '@/components/ui/Field';
import { ROUTES } from '@/lib/constants';
import { useQueryParam } from '@/lib/hooks/useQueryParams';
import { getApiErrorMessage } from '@/lib/services/errors';
import { useAuthStore } from '@/lib/stores/authStore';

const MIN_PASSWORD_LENGTH = 8;
const CODE_LENGTH = 6;

export default function ForgotPasswordPage() {
  const t = useTranslations('forgotPassword');
  const router = useRouter();
  const sendPasswordResetCode = useAuthStore((s) => s.sendPasswordResetCode);
  const resetPassword = useAuthStore((s) => s.resetPassword);

  // An invitation link (?invite=1&email=…) opens straight on the code step with the e-mail filled in.
  const invite = useQueryParam('invite') === '1';
  const invitedEmail = useQueryParam('email');
  const [chosenStep, setStep] = useState<'email' | 'code' | null>(null);
  const [typedEmail, setEmail] = useState<string | null>(null);
  const step = chosenStep ?? (invite && invitedEmail ? 'code' : 'email');
  const email = typedEmail ?? invitedEmail;
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
      setMessage(invite ? t('inviteSuccess') : t('resetSuccess'));
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
        <p className="rounded-sm bg-danger-bg px-4 py-2.5 text-[13px] font-semibold text-danger-fg" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-sm bg-success-bg px-4 py-2.5 text-[13px] font-semibold text-success-fg" role="status">
          {message}
        </p>
      ) : null}
    </>
  );

  return (
    <AuthScreen
      emoji={invite ? 'success' : 'mail'}
      subtitle={
        step === 'email'
          ? t('emailIntro')
          : t.rich(invite ? 'inviteIntro' : 'codeIntro', { email, strong: (chunks) => <strong className="text-ink">{chunks}</strong> })
      }
      title={invite ? t('inviteTitle') : t('title')}
    >
      {step === 'email' ? (
        <form className="flex flex-col gap-4" onSubmit={onSendCode}>
          <Field id="forgot-email" label={t('email')}>
            <Input
              autoComplete="email"
              id="forgot-email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('email')}
              required
              type="email"
              value={email}
            />
          </Field>

          {feedback}

          <Button className="w-full" loading={loading} loadingLabel={t('sendingCode')} size="lg" type="submit" variant="primary">
            {t('sendCode')}
          </Button>
        </form>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={onResetPassword}>
          <Field hint={t('codeHint')} id="forgot-code" label={t('code')}>
            <Input
              autoComplete="one-time-code"
              className="h-14 text-center font-mono text-[26px] tracking-[0.5em]"
              id="forgot-code"
              inputMode="numeric"
              maxLength={CODE_LENGTH}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
              placeholder="000000"
              required
              type="text"
              value={code}
            />
          </Field>

          <Field hint={t('newPasswordHint')} id="forgot-new-password" label={t('newPassword')}>
            <PasswordInput
              autoComplete="new-password"
              id="forgot-new-password"
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('newPassword')}
              required
              value={newPassword}
            />
          </Field>

          <Field id="forgot-confirm-password" label={t('confirmPassword')}>
            <PasswordInput
              autoComplete="new-password"
              id="forgot-confirm-password"
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('confirmPassword')}
              required
              value={confirmPassword}
            />
          </Field>

          {feedback}

          <Button className="w-full" loading={loading} loadingLabel={t('resetting')} size="lg" type="submit" variant="primary">
            {t('reset')}
          </Button>

          <Button className="w-full" onClick={() => setStep('email')} variant="ghost">
            {t('backToEmail')}
          </Button>
        </form>
      )}

      <div className="mt-5 text-center">
        <Link className="text-[13px] font-semibold text-primary-text hover:underline" href={ROUTES.SIGN_IN}>
          {t('backToSignIn')}
        </Link>
      </div>
    </AuthScreen>
  );
}
