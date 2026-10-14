'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';

import { ClientSystemForm } from '@/components/console/ClientSystemForm';
import { ConsoleLoadError } from '@/components/console/ConsoleStatus';
import { Page } from '@/components/layout/Page';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, SkeletonTable } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/format';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import type { ClientSystemRow } from '@/lib/services/operations';
import { useOperationsStore } from '@/lib/stores/operationsStore';

export default function ClientSystemsPage() {
  const t = useTranslations('clientSystems');
  const { isAuthenticated } = useRequireAuth();
  const clients = useOperationsStore((s) => s.clientSystems);
  const status = useOperationsStore((s) => s.clientSystemsStatus);
  const loadClientSystems = useOperationsStore((s) => s.loadClientSystems);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isAuthenticated) void loadClientSystems();
  }, [isAuthenticated, loadClientSystems]);

  if (!isAuthenticated) return null;

  const newButton = (
    <Button icon={<Plus aria-hidden className="size-4" />} onClick={() => setCreating(true)} variant="primary">
      {t('new')}
    </Button>
  );

  return (
    <Page>
      <PageHeader actions={newButton} emoji="client-systems" subtitle={t('subtitle')} title={t('title')} />
      {status === 'error' ? (
        <ConsoleLoadError message={t('error')} onRetry={() => void loadClientSystems()} />
      ) : !clients ? (
        <SkeletonTable />
      ) : clients.length === 0 ? (
        <EmptyState action={newButton} body={t('emptyBody')} title={t('empty')} />
      ) : (
        <ClientTable clients={clients} />
      )}
      <Dialog description={t('newDescription')} onClose={() => setCreating(false)} open={creating} title={t('new')}>
        <ClientSystemForm
          onDone={(client) => {
            setCreating(false);
            toast(t('created', { name: client.name }));
            void loadClientSystems();
          }}
        />
      </Dialog>
    </Page>
  );
}

function ClientTable({ clients }: { clients: ClientSystemRow[] }) {
  const t = useTranslations('clientSystems');
  const locale = useLocale();

  return (
    <DataTable<ClientSystemRow>
      caption={t('tableCaption')}
      columns={[
        {
          key: 'name',
          header: t('columns.name'),
          mobile: 'body',
          cell: (client) => (
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink">{client.name}</span>
              {client.active ? null : (
                <Badge size="sm" tone="neutral">
                  {t('inactive')}
                </Badge>
              )}
            </span>
          ),
        },
        { key: 'key', header: t('columns.key'), mobile: 'title', cell: (client) => <span className="font-mono text-[13px] text-ink-2">{client.key_id}</span> },
        {
          key: 'webhook',
          header: t('columns.webhook'),
          className: 'max-w-64 break-all',
          cell: (client) =>
            client.webhook_url ? (
              <span className="font-mono text-[12px] text-ink-2">{client.webhook_url}</span>
            ) : (
              <Badge size="sm" tone="warning">
                {t('noWebhook')}
              </Badge>
            ),
        },
        {
          key: 'secrets',
          header: t('columns.secrets'),
          align: 'end',
          cell: (client) => <span className={client.valid_secrets ? 'tabular-nums' : 'font-semibold text-danger-fg'}>{client.valid_secrets}</span>,
        },
        { key: 'issuers', header: t('columns.issuers'), align: 'end', className: 'tabular-nums', cell: (client) => client.issuers },
        {
          key: 'notices',
          header: t('columns.notices'),
          mobile: 'badge',
          cell: (client) => (
            <Badge size="sm" tone={client.failed_notices ? 'danger' : client.pending_notices ? 'pending' : 'success'}>
              {t('noticesState', { pending: client.pending_notices, failed: client.failed_notices })}
            </Badge>
          ),
        },
        { key: 'lastDelivered', header: t('columns.lastDelivered'), className: 'whitespace-nowrap', cell: (client) => formatDateTime(client.last_delivered_at, locale) },
      ]}
      rowKey={(client) => client.id}
      rows={clients}
    />
  );
}
