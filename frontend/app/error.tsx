'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

import { Page } from '@/components/layout/Page';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { ROUTES } from '@/lib/constants';

/** H-04: an unexpected error in a page; «Reintentar» renders it again, the rest of the console keeps working. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations('errorPage');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Page narrow className="pt-16">
      <EmptyState
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => retry()} variant="primary">
              {t('retry')}
            </Button>
            <ButtonLink href={ROUTES.DASHBOARD} variant="secondary">
              {t('home')}
            </ButtonLink>
          </div>
        }
        body={t('body')}
        emoji="warning"
        title={t('title')}
      />
    </Page>
  );
}
