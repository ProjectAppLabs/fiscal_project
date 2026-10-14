'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormEvent, useEffect, useRef, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';

import { AuthScreen } from '@/components/layout/AuthScreen';
import { Button } from '@/components/ui/Button';
import { Field, Input, PasswordInput } from '@/components/ui/Field';
import { API_ENDPOINTS, ROUTES } from '@/lib/constants';
import { getApiErrorMessage } from '@/lib/services/errors';
import { api } from '@/lib/services/http';
import { useAuthStore } from '@/lib/stores/authStore';

export default function SignInPage() {
  const t = useTranslations('signIn');
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [siteKey, setSiteKey] = useState('');
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  useEffect(() => {
    api
      .get(API_ENDPOINTS.CAPTCHA_SITE_KEY)
      .then((res) => setSiteKey(res.data.site_key || ''))
      .catch(() => {});
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (siteKey && !captchaToken) {
      setError(t('captchaRequired'));
      return;
    }

    setLoading(true);

    try {
      await signIn({ email, password, captcha_token: captchaToken ?? undefined });
      router.replace(ROUTES.DASHBOARD);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t('invalidCredentials')));
      recaptchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen emoji="sign-in" subtitle={t('subtitle')} title={t('title')}>
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <Field id="sign-in-email" label={t('email')}>
          <Input
            aria-invalid={error ? true : undefined}
            autoComplete="email"
            id="sign-in-email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')}
            required
            type="email"
            value={email}
          />
        </Field>

        <Field
          id="sign-in-password"
          label={t('password')}
          labelAction={
            <Link className="text-[13px] font-semibold text-primary-text hover:underline" href={ROUTES.FORGOT_PASSWORD}>
              {t('forgotPassword')}
            </Link>
          }
        >
          <PasswordInput
            aria-invalid={error ? true : undefined}
            autoComplete="current-password"
            id="sign-in-password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('passwordPlaceholder')}
            required
            value={password}
          />
        </Field>

        {siteKey ? (
          <div className="flex justify-center">
            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey={siteKey}
              onChange={(token) => setCaptchaToken(token)}
              onExpired={() => setCaptchaToken(null)}
            />
          </div>
        ) : null}

        {error ? (
          <p className="rounded-sm bg-danger-bg px-4 py-2.5 text-[13px] font-semibold text-danger-fg" role="alert">
            {error}
          </p>
        ) : null}

        <Button className="mt-1 w-full" loading={loading} loadingLabel={t('submitting')} size="lg" type="submit" variant="primary">
          {t('submit')}
        </Button>
      </form>
    </AuthScreen>
  );
}
