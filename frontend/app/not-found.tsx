import { useTranslations } from 'next-intl';

import { Page } from '@/components/layout/Page';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { ROUTES } from '@/lib/constants';

/** H-04: a route that does not exist. */
export default function NotFound() {
  const t = useTranslations('notFound');

  return (
    <Page narrow className="pt-16">
      <EmptyState
        action={
          <ButtonLink href={ROUTES.DASHBOARD} variant="primary">
            {t('action')}
          </ButtonLink>
        }
        body={t('body')}
        emoji="search"
        title={t('title')}
      />
    </Page>
  );
}
