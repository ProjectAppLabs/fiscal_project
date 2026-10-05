'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useEffect, useState, type ReactNode } from 'react';

import { issuerDetailRoute } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import {
  HABILITATION_RANGE,
  TAX_RESPONSIBILITIES,
  TAX_SCHEMES,
  createClientSystem,
  createIssuer,
  createRange,
  registerSoftware,
  stepErrors,
  uploadCertificate,
  type CreatedClientSystem,
  type IssuerForm,
} from '@/lib/services/onboarding';
import { useOperationsStore } from '@/lib/stores/operationsStore';

const CARD_CLASS = 'rounded-2xl border border-border bg-card p-6';
const INPUT_CLASS =
  'w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const PRIMARY_BUTTON_CLASS =
  'rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';
const STEPS = ['client', 'issuer', 'certificate', 'software', 'range'] as const;

export default function OnboardingPage() {
  const t = useTranslations('onboarding');
  const { isAuthenticated } = useRequireAuth();
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState<number | null>(null);
  const [issuerId, setIssuerId] = useState<number | null>(null);

  if (!isAuthenticated) return null;

  const advance = () => setStep((current) => current + 1);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
      <ol aria-label={t('stepOf', { current: Math.min(step + 1, STEPS.length), total: STEPS.length })} className="mt-6 flex flex-wrap gap-2 text-xs">
        {STEPS.map((name, index) => (
          <li
            aria-current={index === step ? 'step' : undefined}
            className={`rounded-full px-3 py-1 ${index === step ? 'bg-primary text-primary-foreground' : index < step ? 'bg-success/15' : 'bg-muted'}`}
            key={name}
          >
            {index + 1}. {t(`steps.${name}`)}
          </li>
        ))}
      </ol>
      <div className="mt-6">
        {step === 0 ? <ClientStep onDone={(id) => { setClientId(id); advance(); }} /> : null}
        {step === 1 && clientId ? <IssuerStep clientId={clientId} onDone={(id) => { setIssuerId(id); advance(); }} /> : null}
        {step === 2 && issuerId ? <CertificateStep issuerId={issuerId} onDone={advance} /> : null}
        {step === 3 && issuerId ? <SoftwareStep issuerId={issuerId} onDone={advance} /> : null}
        {step === 4 && issuerId ? <RangeStep issuerId={issuerId} onDone={advance} /> : null}
        {step === 5 && issuerId ? <Done issuerId={issuerId} /> : null}
      </div>
    </main>
  );
}

function ClientStep({ onDone }: { onDone: (clientId: number) => void }) {
  const t = useTranslations('onboarding.client');
  const clients = useOperationsStore((s) => s.clientSystems);
  const loadClientSystems = useOperationsStore((s) => s.loadClientSystems);
  const [chosen, setChosen] = useState('');
  const [name, setName] = useState('');
  const [webhook, setWebhook] = useState('');
  const [created, setCreated] = useState<CreatedClientSystem | null>(null);
  const { errors, saving, run } = useStep();

  useEffect(() => {
    void loadClientSystems();
  }, [loadClientSystems]);

  if (created) {
    return (
      <StepCard title={t('secretTitle')}>
        <p className="text-sm text-destructive">{t('secretBody')}</p>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">{t('keyId')}</dt>
            <dd className="font-mono break-all">{created.key_id}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t('secret')}</dt>
            <dd className="font-mono break-all">{created.secret}</dd>
          </div>
        </dl>
        <button className={`${PRIMARY_BUTTON_CLASS} mt-6`} onClick={() => onDone(created.id)} type="button">
          {t('secretSaved')}
        </button>
      </StepCard>
    );
  }

  return (
    <StepCard title={t('title')}>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field id="client-existing" label={t('existing')}>
          <select id="client-existing" className={INPUT_CLASS} value={chosen} onChange={(e) => setChosen(e.target.value)}>
            <option value="">{t('choose')}</option>
            {(clients ?? []).map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </Field>
        <button className={PRIMARY_BUTTON_CLASS} disabled={!chosen} onClick={() => onDone(Number(chosen))} type="button">
          {t('useClient')}
        </button>
      </div>
      <p className="my-4 text-center text-xs text-muted-foreground">{t('orNew')}</p>
      <form
        className="grid gap-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void run(async () => setCreated(await createClientSystem({ name: name.trim(), webhook_url: webhook.trim() })));
        }}
      >
        <Field id="client-name" label={t('name')}>
          <input id="client-name" className={INPUT_CLASS} required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="client-webhook" label={t('webhook')}>
          <input id="client-webhook" className={INPUT_CLASS} type="url" value={webhook} onChange={(e) => setWebhook(e.target.value)} />
        </Field>
        <StepActions errors={errors} label={t('create')} saving={saving} />
      </form>
    </StepCard>
  );
}

function IssuerStep({ clientId, onDone }: { clientId: number; onDone: (issuerId: number) => void }) {
  const t = useTranslations('onboarding.issuer');
  const tStep = useTranslations('onboarding');
  const [form, setForm] = useState<Omit<IssuerForm, 'client_id' | 'department_code' | 'environment'>>({
    nit: '', dv: '', person_type: '2', legal_name: '', trade_name: '', tax_responsibilities: ['ZZ'], tax_scheme: 'ZZ',
    address_line: '', municipality_code: '', email: '', phone: '',
  });
  const { errors, saving, run } = useStep();
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  const toggleResponsibility = (code: string) =>
    setForm((current) => ({
      ...current,
      tax_responsibilities: current.tax_responsibilities.includes(code)
        ? current.tax_responsibilities.filter((item) => item !== code)
        : [...current.tax_responsibilities, code],
    }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const issuer = await createIssuer({
        ...form, client_id: clientId, environment: '2', department_code: form.municipality_code.slice(0, 2),
      });
      onDone(issuer.id);
    });
  };

  return (
    <StepCard title={t('title')}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
        <Field id="issuer-nit" label={t('nit')}>
          <input id="issuer-nit" className={INPUT_CLASS} inputMode="numeric" required value={form.nit} onChange={(e) => set('nit')(e.target.value.trim())} />
        </Field>
        <Field id="issuer-dv" label={t('dv')}>
          <input id="issuer-dv" className={INPUT_CLASS} inputMode="numeric" maxLength={1} required value={form.dv} onChange={(e) => set('dv')(e.target.value.trim())} />
        </Field>
        <Field id="issuer-person" label={t('personType')}>
          <select id="issuer-person" className={INPUT_CLASS} value={form.person_type} onChange={(e) => set('person_type')(e.target.value)}>
            <option value="2">{t('personTypes.2')}</option>
            <option value="1">{t('personTypes.1')}</option>
          </select>
        </Field>
        <Field id="issuer-scheme" label={t('taxScheme')}>
          <select id="issuer-scheme" className={INPUT_CLASS} value={form.tax_scheme} onChange={(e) => set('tax_scheme')(e.target.value)}>
            {TAX_SCHEMES.map((code) => (
              <option key={code} value={code}>
                {t(`taxSchemes.${code}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="issuer-name" label={t('legalName')}>
          <input id="issuer-name" className={INPUT_CLASS} required value={form.legal_name} onChange={(e) => set('legal_name')(e.target.value)} />
        </Field>
        <Field id="issuer-trade" label={t('tradeName')}>
          <input id="issuer-trade" className={INPUT_CLASS} value={form.trade_name} onChange={(e) => set('trade_name')(e.target.value)} />
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-sm">{t('responsibilities')}</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            {TAX_RESPONSIBILITIES.map((code) => (
              <label className="inline-flex items-center gap-2" key={code}>
                <input checked={form.tax_responsibilities.includes(code)} onChange={() => toggleResponsibility(code)} type="checkbox" />
                {code}
              </label>
            ))}
          </div>
        </fieldset>
        <Field id="issuer-address" label={t('address')}>
          <input id="issuer-address" className={INPUT_CLASS} required value={form.address_line} onChange={(e) => set('address_line')(e.target.value)} />
        </Field>
        <Field id="issuer-municipality" label={t('municipality')}>
          <input id="issuer-municipality" className={INPUT_CLASS} inputMode="numeric" maxLength={5} pattern="[0-9]{5}" required value={form.municipality_code} onChange={(e) => set('municipality_code')(e.target.value.trim())} />
        </Field>
        <Field id="issuer-email" label={t('email')}>
          <input id="issuer-email" className={INPUT_CLASS} required type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} />
        </Field>
        <Field id="issuer-phone" label={t('phone')}>
          <input id="issuer-phone" className={INPUT_CLASS} value={form.phone} onChange={(e) => set('phone')(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <StepActions errors={errors} label={tStep('next')} saving={saving} />
        </div>
      </form>
    </StepCard>
  );
}

function CertificateStep({ issuerId, onDone }: { issuerId: number; onDone: () => void }) {
  const t = useTranslations('onboarding.certificate');
  const tStep = useTranslations('onboarding');
  const locale = useLocale();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [loaded, setLoaded] = useState<{ subject: string; not_after: string } | null>(null);
  const { errors, saving, run } = useStep();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    void run(async () => {
      setLoaded(await uploadCertificate(issuerId, file, password));
      setPassword('');
    });
  };

  return (
    <StepCard title={t('title')}>
      <p className="text-sm text-muted-foreground">{t('body')}</p>
      {loaded ? (
        <>
          <p className="mt-4 text-sm text-success" role="status">
            {t('loaded', { subject: loaded.subject, date: formatDateTime(loaded.not_after, locale) })}
          </p>
          <button className={`${PRIMARY_BUTTON_CLASS} mt-6`} onClick={onDone} type="button">
            {tStep('next')}
          </button>
        </>
      ) : (
        <form className="mt-4 grid gap-4" onSubmit={onSubmit}>
          <Field id="certificate-file" label={t('file')}>
            <input id="certificate-file" accept=".p12,.pfx" className={INPUT_CLASS} required type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
          <Field id="certificate-password" label={t('password')}>
            <input id="certificate-password" autoComplete="off" className={INPUT_CLASS} required type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <StepActions errors={errors} label={tStep('next')} saving={saving} />
        </form>
      )}
    </StepCard>
  );
}

function SoftwareStep({ issuerId, onDone }: { issuerId: number; onDone: () => void }) {
  const t = useTranslations('onboarding.software');
  const tStep = useTranslations('onboarding');
  const [softwareId, setSoftwareId] = useState('');
  const [pin, setPin] = useState('');
  const [testSetId, setTestSetId] = useState('');
  const { errors, saving, run } = useStep();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await registerSoftware(issuerId, { environment: '2', software_id: softwareId.trim(), software_pin: pin, test_set_id: testSetId.trim() });
      onDone();
    });
  };

  return (
    <StepCard title={t('title')}>
      <p className="text-sm text-muted-foreground">{t('body')}</p>
      <form className="mt-4 grid gap-4" onSubmit={onSubmit}>
        <Field id="software-id" label={t('softwareId')}>
          <input id="software-id" className={INPUT_CLASS} required value={softwareId} onChange={(e) => setSoftwareId(e.target.value)} />
        </Field>
        <Field id="software-pin" label={t('pin')}>
          <input id="software-pin" autoComplete="off" className={INPUT_CLASS} required type="password" value={pin} onChange={(e) => setPin(e.target.value)} />
        </Field>
        <Field id="software-test-set" label={t('testSetId')}>
          <input id="software-test-set" className={INPUT_CLASS} required value={testSetId} onChange={(e) => setTestSetId(e.target.value)} />
        </Field>
        <StepActions errors={errors} label={tStep('next')} saving={saving} />
      </form>
    </StepCard>
  );
}

function RangeStep({ issuerId, onDone }: { issuerId: number; onDone: () => void }) {
  const t = useTranslations('onboarding.range');
  const tStep = useTranslations('onboarding');
  const [form, setForm] = useState({ ...HABILITATION_RANGE, technical_key: '' });
  const { errors, saving, run } = useStep();
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: key === 'number_from' || key === 'number_to' ? Number(value) : value }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await createRange(issuerId, { ...form, technical_key: form.technical_key.trim() });
      onDone();
    });
  };

  return (
    <StepCard title={t('title')}>
      <p className="text-sm text-muted-foreground">{t('body')}</p>
      <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
        <Field id="range-resolution" label={t('resolution')}>
          <input id="range-resolution" className={INPUT_CLASS} required value={form.resolution_number} onChange={(e) => set('resolution_number')(e.target.value)} />
        </Field>
        <Field id="range-prefix" label={t('prefix')}>
          <input id="range-prefix" className={INPUT_CLASS} maxLength={4} value={form.prefix} onChange={(e) => set('prefix')(e.target.value)} />
        </Field>
        <Field id="range-from" label={t('from')}>
          <input id="range-from" className={INPUT_CLASS} required type="number" value={form.number_from} onChange={(e) => set('number_from')(e.target.value)} />
        </Field>
        <Field id="range-to" label={t('to')}>
          <input id="range-to" className={INPUT_CLASS} required type="number" value={form.number_to} onChange={(e) => set('number_to')(e.target.value)} />
        </Field>
        <Field id="range-valid-from" label={t('validFrom')}>
          <input id="range-valid-from" className={INPUT_CLASS} required type="date" value={form.valid_from} onChange={(e) => set('valid_from')(e.target.value)} />
        </Field>
        <Field id="range-valid-to" label={t('validTo')}>
          <input id="range-valid-to" className={INPUT_CLASS} required type="date" value={form.valid_to} onChange={(e) => set('valid_to')(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field id="range-key" label={t('technicalKey')}>
            <input id="range-key" autoComplete="off" className={INPUT_CLASS} required value={form.technical_key} onChange={(e) => set('technical_key')(e.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <StepActions errors={errors} label={tStep('next')} saving={saving} />
        </div>
      </form>
    </StepCard>
  );
}

function Done({ issuerId }: { issuerId: number }) {
  const t = useTranslations('onboarding.done');

  return (
    <StepCard title={t('title')}>
      <p className="text-sm">{t('body')}</p>
      <Link className={`${PRIMARY_BUTTON_CLASS} mt-6 inline-block`} href={issuerDetailRoute(issuerId)}>
        {t('open')}
      </Link>
    </StepCard>
  );
}

function useStep() {
  const [errors, setErrors] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setSaving(true);
    setErrors(null);
    try {
      await action();
    } catch (error) {
      setErrors(stepErrors(error));
    } finally {
      setSaving(false);
    }
  };

  return { errors, saving, run };
}

function StepActions({ errors, label, saving }: { errors: string[] | null; label: string; saving: boolean }) {
  const t = useTranslations('onboarding');

  return (
    <div>
      {errors ? (
        <div className="mb-3 text-sm text-destructive" role="alert">
          <p>{t('error')}</p>
          <ul className="list-disc pl-5">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <button className={PRIMARY_BUTTON_CLASS} disabled={saving} type="submit">
        {saving ? t('saving') : label}
      </button>
    </div>
  );
}

function StepCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className={CARD_CLASS}>
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}
