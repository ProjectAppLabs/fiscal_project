'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Globe, KeyRound, Pencil, Power, Send } from 'lucide-react';

import { StepErrors } from '@/components/console/ClientSystemForm';
import { ConsoleLoadError } from '@/components/console/ConsoleStatus';
import { Page } from '@/components/layout/Page';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { CodeValue } from '@/components/ui/Copy';
import { DataTable } from '@/components/ui/DataTable';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Choice, Field, Input, Select, Textarea } from '@/components/ui/Field';
import { JsonViewer } from '@/components/ui/JsonViewer';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { NotFoundState, SkeletonCard } from '@/components/ui/States';
import { RequirementList } from '@/components/ui/Steps';
import { Tabs } from '@/components/ui/Tabs';
import { toast } from '@/components/ui/Toast';
import { ROUTES, documentDetailRoute, issuerDetailRoute } from '@/lib/constants';
import { formatDate, formatDateTime, formatRelative } from '@/lib/format';
import { useIsAdmin } from '@/lib/hooks/useIsAdmin';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import {
  DELIVERY_STATES,
  fetchClientSystem,
  fetchDeliveries,
  pingClientSystem,
  retryDelivery,
  retryFailedDeliveries,
  rotateClientSecret,
  updateClientSystem,
  type ClientSystemDetail,
  type Delivery,
  type DeliveryPage,
  type DeliveryState,
} from '@/lib/services/clientSystems';
import { isNotFoundError } from '@/lib/services/console';
import { stepErrors } from '@/lib/services/onboarding';
import { isAlertKind } from '@/lib/services/operations';
import { HandoffCard } from '@/components/console/HandoffCard';
import { HelpTip } from '@/components/console/HelpTip';

const STATE_TONE: Record<DeliveryState, BadgeTone> = { pending: 'pending', failed: 'danger', delivered: 'success' };
const GRACE_OPTIONS = [0, 12, 24, 48, 72];

/**
 * Everything about a client system without the server console (H-31, H-33, H-34, H-35): a guided connection
 * checklist, the notice URL, the secrets, its issuers and every notice with its result.
 */
export default function ClientSystemPage() {
  const t = useTranslations('clientSystem');
  const { clientId } = useParams<{ clientId: string }>();
  const { isAuthenticated } = useRequireAuth();
  const [client, setClient] = useState<ClientSystemDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'not-found'>('loading');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    fetchClientSystem(clientId)
      .then((data) => {
        if (!active) return;
        setClient(data);
        setStatus('ready');
      })
      .catch((error: unknown) => active && setStatus(isNotFoundError(error) ? 'not-found' : 'error'));
    return () => {
      active = false;
    };
  }, [isAuthenticated, clientId, version]);

  if (!isAuthenticated) return null;

  const reload = () => setVersion((current) => current + 1);
  return (
    <Page>
      <Link className="mb-4 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-2 hover:text-primary-text" href={ROUTES.CLIENT_SYSTEMS}>
        ← {t('back')}
      </Link>
      {status === 'not-found' ? <NotFoundState body={t('notFoundBody')} title={t('notFoundTitle')} /> : null}
      {status === 'error' ? <ConsoleLoadError message={t('error')} onRetry={reload} /> : null}
      {status === 'loading' && !client ? <SkeletonCard lines={6} /> : null}
      {client && status === 'ready' ? <ClientView client={client} onChange={reload} /> : null}
    </Page>
  );
}

function ClientView({ client, onChange }: { client: ClientSystemDetail; onChange: () => void }) {
  const t = useTranslations('clientSystem');
  const locale = useLocale();
  const isAdmin = useIsAdmin();
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deliveriesVersion, setDeliveriesVersion] = useState(0);

  const toggleActive = async () => {
    setBusy(true);
    try {
      await updateClientSystem(client.id, { active: !client.active });
      toast(client.active ? t('deactivated') : t('activated'));
      setToggling(false);
      onChange();
    } catch (error) {
      toast(stepErrors(error)[0] ?? t('actionFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="appear">
      <PageHeader
        actions={
          isAdmin ? (
            <Button icon={<Power aria-hidden className="size-4" />} onClick={() => setToggling(true)} variant={client.active ? 'ghost' : 'secondary'}>
              {client.active ? t('deactivate') : t('activate')}
            </Button>
          ) : null
        }
        badge={
          <Badge size="lg" tone={client.active ? 'success' : 'neutral'}>
            {client.active ? t('active') : t('inactive')}
          </Badge>
        }
        breadcrumb={[{ label: t('breadcrumb'), href: ROUTES.CLIENT_SYSTEMS }, { label: t('breadcrumbDetail') }]}
        emoji="client-systems"
        subtitle={t('subtitle', { date: formatDate(client.created_at, locale) })}
        title={client.name}
      />
      {!client.active ? (
        <Notice className="mb-4" tone="neutral">
          {t('inactiveNotice')}
        </Notice>
      ) : null}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <ConnectionGuide client={client} onEdit={() => setEditing(true)} onPinged={() => setDeliveriesVersion((current) => current + 1)} />
        <div className="flex flex-col gap-4">
          <Access client={client} onChange={onChange} />
          <Secrets client={client} onChange={onChange} />
          <Issuers client={client} />
        </div>
      </div>
      <Deliveries client={client} key={deliveriesVersion} onChange={onChange} />

      <Dialog description={t('webhookDialogBody')} onClose={() => setEditing(false)} open={editing} title={t('editWebhook')}>
        <WebhookForm
          client={client}
          onSaved={() => {
            setEditing(false);
            toast(t('webhookSaved'));
            onChange();
          }}
        />
      </Dialog>
      <ConfirmDialog
        busy={busy}
        confirmLabel={client.active ? t('deactivate') : t('activate')}
        danger={client.active}
        description={client.active ? t('deactivateBody') : t('activateBody')}
        onClose={() => setToggling(false)}
        onConfirm={() => void toggleActive()}
        open={toggling}
        title={client.active ? t('deactivateTitle', { name: client.name }) : t('activateTitle', { name: client.name })}
      />
    </div>
  );
}

/** The four things that make a client system work, in order, each with its action. */
function ConnectionGuide({ client, onEdit, onPinged }: { client: ClientSystemDetail; onEdit: () => void; onPinged: () => void }) {
  const t = useTranslations('clientSystem');
  const locale = useLocale();
  const [ping, setPing] = useState<Delivery | null>(null);
  const [pinging, setPinging] = useState(false);
  const apiBase = typeof window === 'undefined' ? '/api/v1/' : `${window.location.origin}/api/v1/`;

  const sendPing = async () => {
    setPinging(true);
    try {
      const result = await pingClientSystem(client.id);
      setPing(result);
      toast(result.state === 'delivered' ? t('pingOk') : t('pingFailed'), result.state === 'delivered' ? 'success' : 'error');
      onPinged();
    } catch (error) {
      toast(stepErrors(error)[0] ?? t('actionFailed'), 'error');
    } finally {
      setPinging(false);
    }
  };

  const pingOk = ping ? ping.state === 'delivered' : client.notices.delivered > 0;
  return (
    <Card aria-labelledby="client-guide">
      <CardHeader id="client-guide" subtitle={t('guideSubtitle')} title={t('guideTitle')} />
      <div className="mb-5 grid gap-3">
        <div>
          <p className="text-label mb-1.5">{t('keyId')}</p>
          <CodeValue value={client.key_id} />
        </div>
        <div>
          <p className="text-label mb-1.5">{t('apiBase')}</p>
          <CodeValue value={apiBase} />
        </div>
      </div>
      <RequirementList
        items={[
          { key: 'secret', ok: client.secrets.length > 0, label: t('steps.secret'), detail: t('steps.secretHint') },
          {
            key: 'webhook',
            ok: Boolean(client.webhook_url),
            label: t('steps.webhook'),
            detail: client.webhook_url ? <span className="break-all font-mono text-[12px]">{client.webhook_url}</span> : t('steps.webhookHint'),
            action: (
              <Button icon={<Pencil aria-hidden className="size-3.5" />} onClick={onEdit} size="sm" variant="soft">
                {client.webhook_url ? t('edit') : t('configure')}
              </Button>
            ),
          },
          {
            key: 'ping',
            ok: pingOk,
            label: t('steps.ping'),
            detail: ping
              ? ping.state === 'delivered'
                ? t('pingAnswered', { status: ping.last_status ?? '' })
                : t('pingError', { error: ping.last_error || '—' })
              : client.last_delivered_at
                ? t('lastDelivered', { when: formatRelative(client.last_delivered_at, locale) })
                : t('steps.pingHint'),
            action: client.webhook_url ? (
              <Button icon={<Send aria-hidden className="size-3.5" />} loading={pinging} onClick={() => void sendPing()} size="sm" variant="soft">
                {t('sendPing')}
              </Button>
            ) : undefined,
          },
          {
            key: 'issuers',
            ok: client.issuers.length > 0,
            label: t('steps.issuers', { count: client.issuers.length }),
            detail: t('steps.issuersHint'),
            action: (
              <ButtonLink href={`${ROUTES.ONBOARDING}?client=${client.id}`} size="sm" variant="soft">
                {t('enrol')}
              </ButtonLink>
            ),
          },
        ]}
      />
      <p className="mt-4 text-[13px] text-ink-3">
        {t('docsHint')}{' '}
        <Link className="font-semibold text-primary-text hover:underline" href={ROUTES.API_DOCS}>
          {t('docsLink')}
        </Link>
      </p>
      <HandoffCard className="mt-4" guides={['client-system']} />
    </Card>
  );
}

function WebhookForm({ client, onSaved }: { client: ClientSystemDetail; onSaved: () => void }) {
  const t = useTranslations('clientSystem');
  const [url, setUrl] = useState(client.webhook_url);
  const [errors, setErrors] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors(null);
    try {
      await updateClientSystem(client.id, { webhook_url: url.trim() });
      onSaved();
    } catch (error) {
      setErrors(stepErrors(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
      <Field error={errors?.[0]} help={<HelpTip label={t('webhookUrl')} topic="client.webhook" />} hint={t('webhookHint')} id="client-webhook-url" label={t('webhookUrl')}>
        <Input id="client-webhook-url" onChange={(e) => setUrl(e.target.value)} placeholder="https://" type="url" value={url} />
      </Field>
      <div>
        <Button loading={saving} type="submit" variant="primary">
          {t('saveWebhook')}
        </Button>
      </div>
    </form>
  );
}

/**
 * Where the client system may call from: its domain (and subdomains), each request's signed X-Fiscal-Origin and,
 * optionally, its IPs. Administrators change it.
 */
function Access({ client, onChange }: { client: ClientSystemDetail; onChange: () => void }) {
  const t = useTranslations('clientSystem.access');
  const isAdmin = useIsAdmin();
  const [editing, setEditing] = useState(false);

  return (
    <Card aria-labelledby="client-access">
      <CardHeader
        action={
          isAdmin ? (
            <Button icon={<Pencil aria-hidden className="size-4" />} onClick={() => setEditing(true)} size="sm" variant="soft">
              {t('edit')}
            </Button>
          ) : null
        }
        help={<HelpTip label={t('title')} topic="client.domain" />}
        id="client-access"
        subtitle={t('subtitle')}
        title={t('title')}
      />
      {client.domain ? (
        <div className="flex flex-col gap-3">
          <p className="flex flex-wrap items-center gap-2 text-[15px] text-ink">
            <Globe aria-hidden className="size-4 text-ink-3" />
            <span className="font-mono font-semibold">{client.domain}</span>
            <Badge size="sm" tone={client.allow_subdomains ? 'primary' : 'neutral'}>
              {client.allow_subdomains ? t('withSubdomains') : t('onlyDomain')}
            </Badge>
          </p>
          <p className="text-[13px] text-ink-2">{t('originRule', { example: client.allow_subdomains ? `restaurante.${client.domain}` : client.domain })}</p>
        </div>
      ) : (
        <Notice tone="warning">{t('noDomain')}</Notice>
      )}
      <p className="mt-4 text-label">{t('ips')}</p>
      {client.allowed_ips?.length ? (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {client.allowed_ips.map((ip) => (
            <li className="rounded-full bg-surface-sunk px-3 py-1 font-mono text-[13px] text-ink" key={ip}>
              {ip}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[13px] text-ink-2">{t('anyIp')}</p>
      )}
      <Dialog description={t('dialogBody')} onClose={() => setEditing(false)} open={editing} title={t('edit')}>
        <AccessForm
          client={client}
          onSaved={() => {
            setEditing(false);
            toast(t('saved'));
            onChange();
          }}
        />
      </Dialog>
    </Card>
  );
}

function AccessForm({ client, onSaved }: { client: ClientSystemDetail; onSaved: () => void }) {
  const t = useTranslations('clientSystem.access');
  const [domain, setDomain] = useState(client.domain ?? '');
  const [subdomains, setSubdomains] = useState(Boolean(client.allow_subdomains));
  const [ips, setIps] = useState((client.allowed_ips ?? []).join('\n'));
  const [errors, setErrors] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors(null);
    try {
      await updateClientSystem(client.id, {
        domain: domain.trim(),
        allow_subdomains: subdomains && Boolean(domain.trim()),
        allowed_ips: ips.split(/[\s,]+/).map((ip) => ip.trim()).filter(Boolean),
      });
      onSaved();
    } catch (error) {
      setErrors(stepErrors(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
      <Field help={<HelpTip label={t('domain')} topic="client.domain" />} hint={t('domainHint')} id="access-domain" label={t('domain')}>
        <Input autoCapitalize="none" className="font-mono" id="access-domain" onChange={(e) => setDomain(e.target.value)} placeholder="waiter.co" value={domain} />
      </Field>
      {domain.trim() ? (
        <Choice checked={subdomains} description={t('subdomainsHint', { domain: domain.trim() })} label={t('subdomains')} onChange={(e) => setSubdomains(e.target.checked)} />
      ) : null}
      <Field help={<HelpTip label={t('ips')} topic="client.ips" />} hint={t('ipsHint')} id="access-ips" label={t('ips')}>
        <Textarea className="font-mono" id="access-ips" onChange={(e) => setIps(e.target.value)} placeholder="203.0.113.10" rows={3} value={ips} />
      </Field>
      {errors ? <StepErrors errors={errors} /> : null}
      <div>
        <Button loading={saving} type="submit" variant="primary">
          {t('save')}
        </Button>
      </div>
    </form>
  );
}

/** The secrets that still authenticate the system and «Rotar secreto» (administrators, H-34). */
function Secrets({ client, onChange }: { client: ClientSystemDetail; onChange: () => void }) {
  const t = useTranslations('clientSystem');
  const locale = useLocale();
  const isAdmin = useIsAdmin();
  const [open, setOpen] = useState(false);
  const [grace, setGrace] = useState(24);
  const [rotating, setRotating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  const rotate = async () => {
    setRotating(true);
    try {
      setSecret((await rotateClientSecret(client.id, grace)).secret);
    } catch (error) {
      toast(stepErrors(error)[0] ?? t('actionFailed'), 'error');
    } finally {
      setRotating(false);
    }
  };
  const close = () => {
    if (secret) onChange();
    setOpen(false);
    setSecret(null);
  };

  return (
    <Card aria-labelledby="client-secrets">
      <CardHeader
        action={
          isAdmin ? (
            <Button icon={<KeyRound aria-hidden className="size-4" />} onClick={() => setOpen(true)} size="sm" variant="secondary">
              {t('rotate')}
            </Button>
          ) : null
        }
        id="client-secrets"
        title={t('secretsTitle')}
      />
      {client.secrets.length === 0 ? (
        <Notice tone="danger">{t('noSecrets')}</Notice>
      ) : (
        <ul className="flex flex-col gap-2">
          {client.secrets.map((item) => (
            <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-sunk/60 px-4 py-3" key={item.id}>
              <span className="text-[15px] text-ink">{t('issuedOn', { date: formatDateTime(item.created_at, locale) })}</span>
              {item.current ? (
                <Badge size="sm" tone="success">
                  {t('current')}
                </Badge>
              ) : (
                <Badge size="sm" tone="warning">
                  {t('expiresOn', { date: formatDateTime(item.expires_at, locale) })}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
      <Dialog description={secret ? undefined : t('rotateBody')} onClose={close} open={open} title={t('rotate')}>
        {secret ? (
          <div className="flex flex-col gap-4">
            <Notice title={t('secretOnceTitle')} tone="warning">
              {t('secretOnceBody', { hours: grace })}
            </Notice>
            <CodeValue value={secret} />
            <div>
              <Button onClick={close} variant="primary">
                {t('secretSaved')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Field help={<HelpTip label={t('grace')} topic="client.grace" />} hint={t('graceHint')} id="rotate-grace" label={t('grace')}>
              <Select id="rotate-grace" onChange={(e) => setGrace(Number(e.target.value))} value={grace}>
                {GRACE_OPTIONS.map((hours) => (
                  <option key={hours} value={hours}>
                    {t('graceOption', { hours })}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={close} variant="ghost">
                {t('cancel')}
              </Button>
              <Button loading={rotating} onClick={() => void rotate()} variant="danger">
                {t('rotateConfirm')}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </Card>
  );
}

function Issuers({ client }: { client: ClientSystemDetail }) {
  const t = useTranslations('clientSystem');
  const tEnvironments = useTranslations('operations.environments');

  return (
    <Card aria-labelledby="client-issuers">
      <CardHeader id="client-issuers" title={t('issuersTitle', { count: client.issuers.length })} />
      {client.issuers.length === 0 ? (
        <p className="text-[15px] text-ink-2">{t('noIssuers')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {client.issuers.map((issuer) => (
            <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-sunk/60 px-4 py-3" key={issuer.id}>
              <span className="min-w-0">
                <Link className="block font-semibold text-ink hover:text-primary-text hover:underline" href={issuerDetailRoute(issuer.id)}>
                  {issuer.legal_name}
                </Link>
                <span className="font-mono text-[12px] text-ink-3">
                  {issuer.nit}-{issuer.dv}
                </span>
              </span>
              <Badge size="sm" tone={issuer.environment === '1' ? 'success' : 'pending'}>
                {tEnvironments(issuer.environment)}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Every notice with its result (H-35): by state, resend one, or queue the failed ones again. */
function Deliveries({ client, onChange }: { client: ClientSystemDetail; onChange: () => void }) {
  const t = useTranslations('clientSystem');
  const tKinds = useTranslations('operations.alertKinds');
  const locale = useLocale();
  const [state, setState] = useState<DeliveryState | ''>(client.notices.failed ? 'failed' : '');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<DeliveryPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [viewing, setViewing] = useState<Delivery | null>(null);
  const [retrying, setRetrying] = useState<number | 'all' | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchDeliveries(client.id, { state, page }));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [client.id, state, page]);

  useEffect(() => {
    let active = true;
    fetchDeliveries(client.id, { state, page })
      .then((result) => {
        if (!active) return;
        setData(result);
        setFailed(false);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [client.id, state, page]);

  const retry = async (delivery: Delivery) => {
    setRetrying(delivery.id);
    try {
      const result = await retryDelivery(delivery.id);
      toast(result.state === 'delivered' ? t('resent') : t('resendFailed', { error: result.last_error || '—' }), result.state === 'delivered' ? 'success' : 'error');
      await load();
    } finally {
      setRetrying(null);
    }
  };
  const retryAll = async () => {
    setRetrying('all');
    try {
      const { requeued } = await retryFailedDeliveries(client.id);
      toast(t('requeued', { count: requeued }));
      await load();
      onChange();
    } finally {
      setRetrying(null);
    }
  };

  const tabs = [
    { value: 'all' as const, label: t('deliveryTabs.all') },
    ...DELIVERY_STATES.map((value) => ({
      value,
      label: t(`deliveryTabs.${value}`),
      badge: client.notices[value] ? <Badge dot={false} size="sm" tone={STATE_TONE[value]}>{client.notices[value]}</Badge> : undefined,
    })),
  ];
  return (
    <Card aria-labelledby="client-deliveries" className="mt-4">
      <CardHeader
        action={
          client.notices.failed ? (
            <Button loading={retrying === 'all'} onClick={() => void retryAll()} size="sm" variant="soft">
              {t('requeueFailed')}
            </Button>
          ) : null
        }
        id="client-deliveries"
        subtitle={t('deliveriesSubtitle')}
        title={t('deliveriesTitle')}
      />
      <Tabs
        className="mb-4"
        label={t('deliveriesTitle')}
        onChange={(value) => {
          setState(value === 'all' ? '' : value);
          setPage(1);
        }}
        tabs={tabs}
        value={state || 'all'}
      />
      {failed ? <ConsoleLoadError message={t('deliveriesError')} onRetry={() => void load()} /> : null}
      {!failed && data && data.results.length === 0 ? <p className="text-[15px] text-ink-2">{t('noDeliveries')}</p> : null}
      {!failed && data && data.results.length ? (
        <>
          <DataTable<Delivery>
            caption={t('deliveriesTitle')}
            columns={[
              { key: 'event', header: t('columns.event'), mobile: 'title', cell: (row) => <span className="font-mono text-[12px]">{row.event}</span> },
              {
                key: 'subject',
                header: t('columns.subject'),
                mobile: 'body',
                cell: (row) =>
                  row.document ? (
                    <Link className="font-mono text-[13px] text-primary-text hover:underline" href={documentDetailRoute(row.document.id)}>
                      {row.document.full_number}
                    </Link>
                  ) : (
                    <span className="text-ink-2">{row.alert_kind ? (isAlertKind(row.alert_kind) ? tKinds(row.alert_kind) : row.alert_kind) : t('testNotice')}</span>
                  ),
              },
              {
                key: 'state',
                header: t('columns.state'),
                mobile: 'badge',
                cell: (row) => (
                  <Badge size="sm" tone={STATE_TONE[row.state]}>
                    {t(`deliveryStates.${row.state}`)}
                  </Badge>
                ),
              },
              {
                key: 'result',
                header: t('columns.result'),
                cell: (row) => (
                  <span className="text-[13px] text-ink-2">
                    {t('attempts', { count: row.attempts })}
                    {row.last_error ? ` · ${row.last_error}` : row.last_status ? ` · HTTP ${row.last_status}` : ''}
                  </span>
                ),
              },
              {
                key: 'when',
                header: t('columns.when'),
                className: 'whitespace-nowrap text-[13px]',
                cell: (row) =>
                  row.delivered_at
                    ? t('deliveredAt', { when: formatDateTime(row.delivered_at, locale) })
                    : row.next_attempt_at
                      ? t('nextAttempt', { when: formatRelative(row.next_attempt_at, locale) })
                      : formatDateTime(row.created_at, locale),
              },
              {
                key: 'actions',
                header: t('columns.actions'),
                mobile: 'action',
                align: 'end',
                cell: (row) => (
                  <span className="inline-flex gap-2">
                    <Button onClick={() => setViewing(row)} size="sm" variant="ghost">
                      {t('viewPayload')}
                    </Button>
                    {row.state !== 'delivered' && row.event !== 'ping' ? (
                      <Button loading={retrying === row.id} onClick={() => void retry(row)} size="sm" variant="soft">
                        {t('resend')}
                      </Button>
                    ) : null}
                  </span>
                ),
              },
            ]}
            framed={false}
            rowKey={(row) => row.id}
            rows={data.results}
          />
          <Pagination
            hasNext={Boolean(data.next)}
            hasPrevious={Boolean(data.previous)}
            label={t('deliveriesTitle')}
            onNext={() => setPage((current) => current + 1)}
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            summary={t('pageInfo', { page, count: data.count })}
          />
        </>
      ) : null}
      <Dialog onClose={() => setViewing(null)} open={viewing !== null} size="lg" title={t('payloadTitle')}>
        {viewing ? <JsonViewer fileName={`aviso-${viewing.id}.json`} title={viewing.event} value={viewing.payload} /> : null}
      </Dialog>
    </Card>
  );
}
