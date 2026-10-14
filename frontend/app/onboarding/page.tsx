'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

import { ClientSystemForm } from '@/components/console/ClientSystemForm';
import { CertificateForm, LoadedCertificateNotice, RangeFormFields, SoftwareFormFields, WIZARD_RANGE } from '@/components/console/EnrolmentForms';
import { IssuerForm } from '@/components/console/IssuerForm';
import { Page } from '@/components/layout/Page';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Emoji } from '@/components/ui/Emoji';
import { Field, Select } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonCard } from '@/components/ui/States';
import { Stepper } from '@/components/ui/Steps';
import { issuerDetailRoute } from '@/lib/constants';
import { useQueryParams } from '@/lib/hooks/useQueryParams';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { createIssuer, fetchTestSet, type LoadedCertificate } from '@/lib/services/onboarding';
import { useOperationsStore } from '@/lib/stores/operationsStore';
import { HandoffCard } from '@/components/console/HandoffCard';
import type { HandoffId } from '@/lib/handoff';

const STEPS = ['client', 'issuer', 'certificate', 'software', 'range'] as const;
const DONE = STEPS.length;

export default function OnboardingPage() {
  const t = useTranslations('onboarding');
  const { isAuthenticated } = useRequireAuth();
  const { read, write } = useQueryParams();
  const [step, setStep] = useState(() => (Number(read('client')) ? 1 : 0));
  // ?client=ID (from a client system's page) skips the first step.
  const [clientId, setClientId] = useState<number | null>(() => Number(read('client')) || null);
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
    <StepCard guides={['client-system']} title={t('title')}>
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

  return (
    <StepCard guides={['enrolment']} subtitle={t('subtitle')} title={t('title')}>
      <IssuerForm
        mode="create"
        onSubmit={async (data) => {
          const issuer = await createIssuer({ ...data, client_id: clientId, environment: '2' });
          onDone(issuer.id);
        }}
        submitLabel={tStep('next')}
      />
    </StepCard>
  );
}

function CertificateStep({ issuerId, onDone }: { issuerId: number; onDone: () => void }) {
  const t = useTranslations('onboarding.certificate');
  const tStep = useTranslations('onboarding');
  const [loaded, setLoaded] = useState<LoadedCertificate | null>(null);

  return (
    <StepCard guides={['certificate']} issuerId={issuerId} subtitle={t('body')} title={t('title')}>
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
    <StepCard guides={['dian-registration', 'software']} issuerId={issuerId} subtitle={t('body')} title={t('title')}>
      <SoftwareFormFields environment="2" issuerId={issuerId} onSaved={onDone} submitLabel={tStep('next')} />
    </StepCard>
  );
}

function RangeStep({ issuerId, onDone }: { issuerId: number; onDone: () => void }) {
  const t = useTranslations('onboarding.range');
  const tStep = useTranslations('onboarding');

  return (
    <StepCard guides={['software']} issuerId={issuerId} subtitle={t('body')} title={t('title')}>
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

/** A wizard step; `guides` adds, under the form, the Claude in Chrome guides for what the step needs from outside. */
function StepCard({ title, subtitle, guides, issuerId, children }: StepCardProps) {
  return (
    <Card aria-label={title} className="appear">
      <CardHeader subtitle={subtitle} title={title} />
      {children}
      {guides ? <HandoffCard className="mt-6" guides={guides} issuer={issuerId ? { id: issuerId } : null} /> : null}
    </Card>
  );
}

interface StepCardProps {
  title: string;
  subtitle?: string;
  guides?: HandoffId[];
  issuerId?: number;
  children: ReactNode;
}
