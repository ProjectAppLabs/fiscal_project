'use client';

import { useTranslations } from 'next-intl';
import { FormEvent, useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

import { ClientSystemForm, StepErrors } from '@/components/console/ClientSystemForm';
import { CertificateForm, LoadedCertificateNotice, RangeFormFields, SoftwareFormFields, WIZARD_RANGE } from '@/components/console/EnrolmentForms';
import { MunicipalityField } from '@/components/console/MunicipalityField';
import { Page } from '@/components/layout/Page';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Emoji } from '@/components/ui/Emoji';
import { Choice, Field, Input, Select } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonCard } from '@/components/ui/States';
import { Stepper } from '@/components/ui/Steps';
import { issuerDetailRoute } from '@/lib/constants';
import { useQueryParams } from '@/lib/hooks/useQueryParams';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { checkDigit } from '@/lib/nit';
import { TAX_RESPONSIBILITIES, TAX_SCHEMES, createIssuer, fetchTestSet, stepErrors, type IssuerForm, type LoadedCertificate } from '@/lib/services/onboarding';
import { useOperationsStore } from '@/lib/stores/operationsStore';

const STEPS = ['client', 'issuer', 'certificate', 'software', 'range'] as const;
const DONE = STEPS.length;

export default function OnboardingPage() {
  const t = useTranslations('onboarding');
  const { isAuthenticated } = useRequireAuth();
  const { read, write } = useQueryParams();
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState<number | null>(null);
  const [issuerId, setIssuerId] = useState<number | null>(null);
  const [resuming, setResuming] = useState(() => Boolean(Number(read('issuer'))));

  // H-21: /onboarding?issuer=3 resumes a half-done enrolment at its first missing step.
  useEffect(() => {
    if (!isAuthenticated) return;
    const resumeId = Number(read('issuer'));
    if (!resumeId) return;
    fetchTestSet(resumeId)
      .then(({ readiness }) => {
        const next = !readiness.certificate ? 2 : !readiness.software || !readiness.test_set_id ? 3 : !readiness.range ? 4 : DONE;
        setIssuerId(resumeId);
        setStep(next);
      })
      .catch(() => write({ issuer: '' }))
      .finally(() => setResuming(false));
  }, [isAuthenticated, read, write]);

  if (!isAuthenticated) return null;

  const advance = () => setStep((current) => current + 1);
  const canGoBack = step > 0 && step < DONE;

  return (
    <Page narrow>
      <PageHeader emoji="enrol" subtitle={t('subtitle')} title={t('title')} />
      {step < DONE ? (
        <div className="mb-5 flex flex-col gap-4">
          <Stepper current={step} label={t('stepOf', { current: step + 1, total: STEPS.length })} onStepClick={(index) => setStep(index)} steps={STEPS.map((name) => t(`steps.${name}`))} />
        </div>
      ) : null}
      {resuming ? <SkeletonCard lines={5} /> : null}
      {!resuming && step === 0 && issuerId ? <AlreadyDone body={t('clientDone')} onContinue={advance} title={t('client.title')} /> : null}
      {!resuming && step === 0 && !issuerId ? (
        <ClientStep
          onDone={(id) => {
            setClientId(id);
            advance();
          }}
        />
      ) : null}
      {!resuming && step === 1 ? (
        issuerId ? (
          <AlreadyDone body={t('issuerDone')} onContinue={advance} title={t('issuer.title')} />
        ) : clientId ? (
          <IssuerStep
            clientId={clientId}
            onDone={(id) => {
              setIssuerId(id);
              write({ issuer: String(id) });
              advance();
            }}
          />
        ) : null
      ) : null}
      {!resuming && step === 2 && issuerId ? <CertificateStep issuerId={issuerId} onDone={advance} /> : null}
      {!resuming && step === 3 && issuerId ? <SoftwareStep issuerId={issuerId} onDone={advance} /> : null}
      {!resuming && step === 4 && issuerId ? <RangeStep issuerId={issuerId} onDone={advance} /> : null}
      {!resuming && step === DONE && issuerId ? <Done issuerId={issuerId} /> : null}
      {canGoBack && !resuming ? (
        <div className="mt-4">
          <Button icon={<ArrowLeft aria-hidden className="size-4" />} onClick={() => setStep(step - 1)} variant="ghost">
            {t('back')}
          </Button>
        </div>
      ) : null}
    </Page>
  );
}

function ClientStep({ onDone }: { onDone: (clientId: number) => void }) {
  const t = useTranslations('onboarding.client');
  const clients = useOperationsStore((s) => s.clientSystems);
  const loadClientSystems = useOperationsStore((s) => s.loadClientSystems);
  const [chosen, setChosen] = useState('');

  useEffect(() => {
    void loadClientSystems();
  }, [loadClientSystems]);

  return (
    <StepCard title={t('title')}>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field id="client-existing" label={t('existing')}>
          <Select id="client-existing" onChange={(e) => setChosen(e.target.value)} value={chosen}>
            <option value="">{t('choose')}</option>
            {(clients ?? []).map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button className="h-12" disabled={!chosen} onClick={() => onDone(Number(chosen))} variant="primary">
          {t('useClient')}
        </Button>
      </div>
      <div className="my-6 flex items-center gap-3 text-[13px] font-semibold text-ink-3">
        <span className="h-px flex-1 bg-line" />
        {t('orNew')}
        <span className="h-px flex-1 bg-line" />
      </div>
      <ClientSystemForm onDone={(client) => onDone(client.id)} />
    </StepCard>
  );
}

function IssuerStep({ clientId, onDone }: { clientId: number; onDone: (issuerId: number) => void }) {
  const t = useTranslations('onboarding.issuer');
  const tStep = useTranslations('onboarding');
  const [form, setForm] = useState<Omit<IssuerForm, 'client_id' | 'department_code' | 'environment'>>({
    nit: '', dv: '', person_type: '2', legal_name: '', trade_name: '', tax_responsibilities: ['R-99-PN'], tax_scheme: 'ZZ',
    address_line: '', municipality_code: '', email: '', phone: '',
  });
  const [errors, setErrors] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));
  const expectedDv = checkDigit(form.nit);

  const setNit = (nit: string) =>
    // H-23: the check digit follows the NIT; it can still be corrected by hand.
    setForm((current) => ({ ...current, nit, dv: checkDigit(nit) || current.dv }));

  const toggleResponsibility = (code: string) =>
    setForm((current) => {
      const has = current.tax_responsibilities.includes(code);
      const rest = has ? current.tax_responsibilities.filter((item) => item !== code) : [...current.tax_responsibilities, code];
      // R-99-PN means «none of the others»: it leaves when another one is chosen and comes back when none is left.
      const cleaned = code === 'R-99-PN' ? (has ? rest : ['R-99-PN']) : rest.filter((item) => item !== 'R-99-PN');
      return { ...current, tax_responsibilities: cleaned.length ? cleaned : ['R-99-PN'] };
    });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors(null);
    try {
      const issuer = await createIssuer({ ...form, client_id: clientId, environment: '2', department_code: form.municipality_code.slice(0, 2) });
      onDone(issuer.id);
    } catch (error) {
      setErrors(stepErrors(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepCard subtitle={t('subtitle')} title={t('title')}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => void onSubmit(e)}>
        <Field id="issuer-nit" label={t('nit')}>
          <Input className="font-mono" id="issuer-nit" inputMode="numeric" onChange={(e) => setNit(e.target.value.trim())} required value={form.nit} />
        </Field>
        <Field
          error={form.dv && expectedDv && form.dv !== expectedDv ? t('dvMismatch', { expected: expectedDv }) : undefined}
          hint={expectedDv ? t('dvCalculated') : undefined}
          id="issuer-dv"
          label={t('dv')}
        >
          <Input aria-invalid={Boolean(form.dv && expectedDv && form.dv !== expectedDv)} className="font-mono" id="issuer-dv" inputMode="numeric" maxLength={1} onChange={(e) => set('dv')(e.target.value.trim())} required value={form.dv} />
        </Field>
        <Field id="issuer-person" label={t('personType')}>
          <Select id="issuer-person" onChange={(e) => set('person_type')(e.target.value)} value={form.person_type}>
            <option value="2">{t('personTypes.2')}</option>
            <option value="1">{t('personTypes.1')}</option>
          </Select>
        </Field>
        <Field id="issuer-scheme" label={t('taxScheme')}>
          <Select id="issuer-scheme" onChange={(e) => set('tax_scheme')(e.target.value)} value={form.tax_scheme}>
            {TAX_SCHEMES.map((code) => (
              <option key={code} value={code}>
                {t(`taxSchemes.${code}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="issuer-name" label={t('legalName')}>
          <Input id="issuer-name" onChange={(e) => set('legal_name')(e.target.value)} required value={form.legal_name} />
        </Field>
        <Field id="issuer-trade" label={t('tradeName')}>
          <Input id="issuer-trade" onChange={(e) => set('trade_name')(e.target.value)} value={form.trade_name} />
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-[13px] font-semibold text-ink">{t('responsibilities')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {TAX_RESPONSIBILITIES.map((code) => (
              <Choice
                checked={form.tax_responsibilities.includes(code)}
                className="rounded-sm bg-surface-sunk/60 px-3 py-2.5"
                description={code}
                key={code}
                label={t(`responsibilityNames.${code}`)}
                onChange={() => toggleResponsibility(code)}
              />
            ))}
          </div>
        </fieldset>
        <Field id="issuer-address" label={t('address')}>
          <Input id="issuer-address" onChange={(e) => set('address_line')(e.target.value)} required value={form.address_line} />
        </Field>
        <Field hint={form.municipality_code ? t('municipalityCode', { code: form.municipality_code }) : t('municipalityHint')} id="issuer-municipality" label={t('municipality')}>
          <MunicipalityField id="issuer-municipality" onChange={set('municipality_code')} value={form.municipality_code} />
        </Field>
        <Field id="issuer-email" label={t('email')}>
          <Input id="issuer-email" onChange={(e) => set('email')(e.target.value)} required type="email" value={form.email} />
        </Field>
        <Field id="issuer-phone" label={t('phone')}>
          <Input id="issuer-phone" onChange={(e) => set('phone')(e.target.value)} value={form.phone} />
        </Field>
        <div className="flex flex-col gap-3 sm:col-span-2">
          {errors ? <StepErrors errors={errors} /> : null}
          <div>
            <Button loading={saving} loadingLabel={tStep('saving')} type="submit" variant="primary">
              {tStep('next')}
            </Button>
          </div>
        </div>
      </form>
    </StepCard>
  );
}

function CertificateStep({ issuerId, onDone }: { issuerId: number; onDone: () => void }) {
  const t = useTranslations('onboarding.certificate');
  const tStep = useTranslations('onboarding');
  const [loaded, setLoaded] = useState<LoadedCertificate | null>(null);

  return (
    <StepCard subtitle={t('body')} title={t('title')}>
      {loaded ? (
        <div className="flex flex-col gap-4">
          <LoadedCertificateNotice certificate={loaded} />
          <div>
            <Button onClick={onDone} variant="primary">
              {tStep('next')}
            </Button>
          </div>
        </div>
      ) : (
        <CertificateForm issuerId={issuerId} onLoaded={setLoaded} submitLabel={tStep('next')} />
      )}
    </StepCard>
  );
}

function SoftwareStep({ issuerId, onDone }: { issuerId: number; onDone: () => void }) {
  const t = useTranslations('onboarding.software');
  const tStep = useTranslations('onboarding');

  return (
    <StepCard subtitle={t('body')} title={t('title')}>
      <SoftwareFormFields environment="2" issuerId={issuerId} onSaved={onDone} submitLabel={tStep('next')} />
    </StepCard>
  );
}

function RangeStep({ issuerId, onDone }: { issuerId: number; onDone: () => void }) {
  const t = useTranslations('onboarding.range');
  const tStep = useTranslations('onboarding');

  return (
    <StepCard subtitle={t('body')} title={t('title')}>
      <RangeFormFields issuerId={issuerId} onSaved={onDone} preset={WIZARD_RANGE} submitLabel={tStep('next')} />
    </StepCard>
  );
}

/** The Dawn aurora and a party popper: the business can now run its DIAN test set. */
function Done({ issuerId }: { issuerId: number }) {
  const t = useTranslations('onboarding.done');

  return (
    <section className="aurora-dawn appear overflow-hidden rounded-panel px-6 py-12 text-center shadow-rest">
      <Emoji className="mx-auto" name="success" size={64} />
      <h2 className="mt-4 text-[22px] font-bold text-ink">{t('title')}</h2>
      <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-2">{t('body')}</p>
      <div className="mt-6 flex justify-center">
        <ButtonLink href={`${issuerDetailRoute(issuerId)}?tab=habilitation`} variant="primary">
          {t('open')}
        </ButtonLink>
      </div>
    </section>
  );
}

/** A step that is already saved and cannot be redone here (the issuer exists): its data is edited from its page. */
function AlreadyDone({ title, body, onContinue }: { title: string; body: string; onContinue: () => void }) {
  const t = useTranslations('onboarding');

  return (
    <StepCard title={title}>
      <Notice tone="success">{body}</Notice>
      <Button className="mt-4" onClick={onContinue} variant="primary">
        {t('next')}
      </Button>
    </StepCard>
  );
}

function StepCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card aria-label={title} className="appear">
      <CardHeader subtitle={subtitle} title={title} />
      {children}
    </Card>
  );
}
