'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormEvent, useEffect, useRef, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';

import { API_ENDPOINTS, ROUTES } from '@/lib/constants';
import { getApiErrorMessage } from '@/lib/services/errors';
import { api } from '@/lib/services/http';
import { useAuthStore } from '@/lib/stores/authStore';

const INPUT_CLASS =
  'w-full rounded-xl border border-border bg-card px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

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
    <main className="flex min-h-[calc(100vh-72px)] items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="sr-only" htmlFor="sign-in-email">
              {t('email')}
            </label>
            <input
              id="sign-in-email"
              className={INPUT_CLASS}
              placeholder={t('email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="sr-only" htmlFor="sign-in-password">
              {t('password')}
            </label>
            <input
              id="sign-in-password"
              className={INPUT_CLASS}
              placeholder={t('password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

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

          <button
            className="w-full rounded-full bg-primary px-5 py-3 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            type="submit"
            disabled={loading}
          >
            {loading ? t('submitting') : t('submit')}
          </button>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </form>

        <div className="mt-4 text-center">
          <Link href={ROUTES.FORGOT_PASSWORD} className="text-sm text-foreground hover:underline">
            {t('forgotPassword')}
          </Link>
        </div>
      </div>
    </main>
  );
}
