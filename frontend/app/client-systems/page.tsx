'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { ConsoleLoadError, ConsoleLoading } from '@/components/console/ConsoleStatus';
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

  useEffect(() => {
    if (isAuthenticated) void loadClientSystems();
  }, [isAuthenticated, loadClientSystems]);

  if (!isAuthenticated) return null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
      {status === 'error' ? (
        <ConsoleLoadError message={t('error')} onRetry={() => void loadClientSystems()} />
      ) : !clients ? (
        <ConsoleLoading />
      ) : clients.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm">{t('empty')}</p>
      ) : (
        <ClientTable clients={clients} />
      )}
    </main>
  );
}

function ClientTable({ clients }: { clients: ClientSystemRow[] }) {
  const t = useTranslations('clientSystems');
  const locale = useLocale();

  return (
    <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{t('tableCaption')}</caption>
        <thead className="border-b border-border text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.name')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.key')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.webhook')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.secrets')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.issuers')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.notices')}</th>
            <th className="px-4 py-3 font-medium" scope="col">{t('columns.lastDelivered')}</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr className="border-b border-border last:border-0" key={client.id}>
              <td className="px-4 py-3">
                <span className="block font-medium">{client.name}</span>
                {client.active ? null : <span className="block text-xs text-destructive">{t('inactive')}</span>}
              </td>
              <td className="px-4 py-3 font-mono text-xs">{client.key_id}</td>
              <td className="px-4 py-3 break-all">
                {client.webhook_url || <span className="text-destructive">{t('noWebhook')}</span>}
              </td>
              <td className={`px-4 py-3 tabular-nums ${client.valid_secrets ? '' : 'text-destructive'}`}>{client.valid_secrets}</td>
              <td className="px-4 py-3 tabular-nums">{client.issuers}</td>
              <td className={`px-4 py-3 ${client.failed_notices ? 'text-destructive' : ''}`}>
                {t('noticesState', { pending: client.pending_notices, failed: client.failed_notices })}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(client.last_delivered_at, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
