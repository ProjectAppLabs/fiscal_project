'use client';

import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { Choice, Field, Input, PasswordInput, Select } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';
import { formatDate } from '@/lib/format';
import {
  HABILITATION_RANGE,
  createRange,
  registerSoftware,
  stepErrors,
  uploadCertificate,
  type CertificateUpload,
  type LoadedCertificate,
  type RangeForm,
} from '@/lib/services/onboarding';
import { StepErrors } from './ClientSystemForm';
import { HelpTip } from './HelpTip';

/**
 * The enrolment forms, shared by the wizard and the issuer's page (replace the certificate H-12, register the
 * software H-13, add a range H-14). Passwords, PIN and technical key go in hidden fields and never come back.
 */
export function CertificateForm({ issuerId, onLoaded, submitLabel }: { issuerId: number; onLoaded: (certificate: LoadedCertificate) => void; submitLabel: string }) {
  const t = useTranslations('onboarding.certificate');
  const [kind, setKind] = useState<'p12' | 'pair'>('p12');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [certificate, setCertificate] = useState<File | null>(null);
  const [privateKey, setPrivateKey] = useState<File | null>(null);
  const [keyPassword, setKeyPassword] = useState('');
  const { errors, saving, run } = useSubmit();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const upload: CertificateUpload | null =
      kind === 'p12' ? file && { kind, file, password } : certificate && privateKey && { kind, certificate, privateKey, keyPassword };
    if (!upload) return;
    void run(async () => {
      const loaded = await uploadCertificate(issuerId, upload);
      setPassword('');
      setKeyPassword('');
      onLoaded(loaded);
    });
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <fieldset aria-labelledby="certificate-kind-legend" className="flex flex-col gap-2">
        <legend className="mb-2 flex items-center gap-1 text-[13px] font-semibold text-ink">
          <span id="certificate-kind-legend">{t('kind')}</span>
          <HelpTip label={t('kind')} topic="certificate.kind" />
        </legend>
        {(['p12', 'pair'] as const).map((value) => (
          <Choice checked={kind === value} key={value} label={t(`kinds.${value}`)} name="certificate-kind" onChange={() => setKind(value)} type="radio" />
        ))}
      </fieldset>
      {kind === 'p12' ? (
        <>
          <Field help={<HelpTip label={t('file')} topic="certificate.file" />} id="certificate-file" label={t('file')}>
            <Input accept=".p12,.pfx" className="pt-2.5" id="certificate-file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required type="file" />
          </Field>
          <Field help={<HelpTip label={t('password')} topic="certificate.password" />} id="certificate-password" label={t('password')}>
            <PasswordInput autoComplete="off" id="certificate-password" onChange={(e) => setPassword(e.target.value)} required value={password} />
          </Field>
        </>
      ) : (
        <>
          <Field help={<HelpTip label={t('certificateFile')} topic="certificate.file" />} id="certificate-public" label={t('certificateFile')}>
            <Input accept=".cer,.crt,.pem,.der,.zip" className="pt-2.5" id="certificate-public" onChange={(e) => setCertificate(e.target.files?.[0] ?? null)} required type="file" />
          </Field>
          <Field help={<HelpTip label={t('keyFile')} topic="certificate.keyFile" />} id="certificate-key" label={t('keyFile')}>
            <Input accept=".key,.pem" className="pt-2.5" id="certificate-key" onChange={(e) => setPrivateKey(e.target.files?.[0] ?? null)} required type="file" />
          </Field>
          <Field help={<HelpTip label={t('keyPassword')} topic="certificate.password" />} id="certificate-key-password" label={t('keyPassword')}>
            <PasswordInput autoComplete="off" id="certificate-key-password" onChange={(e) => setKeyPassword(e.target.value)} value={keyPassword} />
          </Field>
        </>
      )}
      <SubmitRow errors={errors} label={submitLabel} saving={saving} />
    </form>
  );
}

/** What a loaded certificate looks like, with the warning when the chain could not be completed. */
export function LoadedCertificateNotice({ certificate }: { certificate: LoadedCertificate }) {
  const t = useTranslations('onboarding.certificate');
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-2">
      <Notice tone="success">
        {t('loaded', { subject: certificate.subject, date: formatDate(certificate.not_after, locale) })}
      </Notice>
      {certificate.chain_complete === false ? <Notice tone="warning">{t('chainIncomplete')}</Notice> : null}
    </div>
  );
}

export function SoftwareFormFields({ issuerId, environment, onSaved, submitLabel }: { issuerId: number; environment?: '1' | '2'; onSaved: () => void; submitLabel: string }) {
  const t = useTranslations('onboarding.software');
  const tEnvironments = useTranslations('operations.environments');
  const [env, setEnv] = useState<'1' | '2'>(environment ?? '2');
  const [softwareId, setSoftwareId] = useState('');
  const [pin, setPin] = useState('');
  const [testSetId, setTestSetId] = useState('');
  const { errors, saving, run } = useSubmit();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await registerSoftware(issuerId, { environment: env, software_id: softwareId.trim(), software_pin: pin, test_set_id: env === '2' ? testSetId.trim() : '' });
      onSaved();
    });
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      {environment ? null : (
        <Field help={<HelpTip label={t('environment')} topic="software.environment" />} id="software-environment" label={t('environment')}>
          <Select id="software-environment" onChange={(e) => setEnv(e.target.value as '1' | '2')} value={env}>
            <option value="2">{tEnvironments('2')}</option>
            <option value="1">{tEnvironments('1')}</option>
          </Select>
        </Field>
      )}
      <Field help={<HelpTip label={t('softwareId')} topic="software.softwareId" />} hint={t('softwareIdHint')} id="software-id" label={t('softwareId')}>
        <Input className="font-mono" id="software-id" onChange={(e) => setSoftwareId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" required value={softwareId} />
      </Field>
      <Field help={<HelpTip label={t('pin')} topic="software.pin" />} hint={t('pinHint')} id="software-pin" label={t('pin')}>
        <PasswordInput autoComplete="off" id="software-pin" onChange={(e) => setPin(e.target.value)} required value={pin} />
      </Field>
      {env === '2' ? (
        <Field help={<HelpTip label={t('testSetId')} topic="software.testSetId" />} hint={t('testSetIdHint')} id="software-test-set" label={t('testSetId')}>
          <Input className="font-mono" id="software-test-set" onChange={(e) => setTestSetId(e.target.value)} required value={testSetId} />
        </Field>
      ) : null}
      <SubmitRow errors={errors} label={submitLabel} saving={saving} />
    </form>
  );
}

/**
 * A numbering range. In the wizard it comes preloaded with the habilitación range (SETP); on the issuer's page it
 * can be an authorized invoice range or a contingency range (paper or booklet, type 03).
 */
export function RangeFormFields({ issuerId, preset, allowKind = false, onSaved, submitLabel, footer }: RangeFormProps) {
  const t = useTranslations('onboarding.range');
  const [form, setForm] = useState<RangeForm>(() => ({ ...(preset ?? EMPTY_RANGE), technical_key: '' }));
  const { errors, saving, run } = useSubmit();
  const set = (key: keyof RangeForm) => (value: string) =>
    setForm((current) => ({ ...current, [key]: key === 'number_from' || key === 'number_to' ? Number(value) : value }));
  const invoice = form.kind === 'invoice';

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await createRange(issuerId, { ...form, prefix: form.prefix.toUpperCase(), technical_key: form.technical_key.trim() });
      onSaved();
    });
  };

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
      {allowKind ? (
        <fieldset aria-labelledby="range-kind-legend" className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-2 flex items-center gap-1 text-[13px] font-semibold text-ink">
            <span id="range-kind-legend">{t('kind')}</span>
            <HelpTip label={t('kind')} topic="range.kind" />
          </legend>
          {(['invoice', 'contingency'] as const).map((value) => (
            <Choice
              checked={form.kind === value}
              description={t(`kinds.${value}.description`)}
              key={value}
              label={t(`kinds.${value}.label`)}
              name="range-kind"
              onChange={() => setForm((current) => ({ ...current, kind: value }))}
              type="radio"
            />
          ))}
        </fieldset>
      ) : null}
      <Field help={<HelpTip label={t('resolution')} topic="range.resolution" />} id="range-resolution" label={t('resolution')}>
        <Input className="font-mono" id="range-resolution" onChange={(e) => set('resolution_number')(e.target.value)} required value={form.resolution_number} />
      </Field>
      <Field help={<HelpTip label={t('prefix')} topic="range.prefix" />} hint={t('prefixHint')} id="range-prefix" label={t('prefix')}>
        <Input className="font-mono uppercase" id="range-prefix" maxLength={4} onChange={(e) => set('prefix')(e.target.value)} value={form.prefix} />
      </Field>
      <Field help={<HelpTip label={t('from')} topic="range.numbers" />} id="range-from" label={t('from')}>
        <Input className="font-mono" id="range-from" min={1} onChange={(e) => set('number_from')(e.target.value)} required type="number" value={form.number_from || ''} />
      </Field>
      <Field id="range-to" label={t('to')}>
        <Input className="font-mono" id="range-to" min={1} onChange={(e) => set('number_to')(e.target.value)} required type="number" value={form.number_to || ''} />
      </Field>
      <Field help={<HelpTip label={t('validFrom')} topic="range.validity" />} id="range-valid-from" label={t('validFrom')}>
        <Input id="range-valid-from" onChange={(e) => set('valid_from')(e.target.value)} required type="date" value={form.valid_from} />
      </Field>
      <Field id="range-valid-to" label={t('validTo')}>
        <Input id="range-valid-to" onChange={(e) => set('valid_to')(e.target.value)} required type="date" value={form.valid_to} />
      </Field>
      {allowKind ? (
        <>
          <Field help={<HelpTip label={t('resolutionDate')} topic="range.resolutionDate" />} id="range-resolution-date" label={t('resolutionDate')}>
            <Input id="range-resolution-date" onChange={(e) => set('resolution_date')(e.target.value)} type="date" value={form.resolution_date ?? ''} />
          </Field>
          <Field help={<HelpTip label={t('establishment')} topic="range.establishment" />} hint={t('establishmentHint')} id="range-establishment" label={t('establishment')}>
            <Input id="range-establishment" onChange={(e) => set('establishment')(e.target.value)} value={form.establishment ?? ''} />
          </Field>
        </>
      ) : null}
      {invoice ? (
        <Field className="sm:col-span-2" help={<HelpTip label={t('technicalKey')} topic="range.technicalKey" />} hint={t('technicalKeyHint')} id="range-key" label={t('technicalKey')}>
          <PasswordInput autoComplete="off" className="font-mono" id="range-key" onChange={(e) => set('technical_key')(e.target.value)} required value={form.technical_key} />
        </Field>
      ) : null}
      <div className="sm:col-span-2">
        {footer}
        <SubmitRow errors={errors} label={submitLabel} saving={saving} />
      </div>
    </form>
  );
}

function SubmitRow({ errors, label, saving }: { errors: string[] | null; label: string; saving: boolean }) {
  const t = useTranslations('onboarding');

  return (
    <div className="flex flex-col gap-3">
      {errors ? <StepErrors errors={errors} /> : null}
      <div>
        <Button loading={saving} loadingLabel={t('saving')} type="submit" variant="primary">
          {label}
        </Button>
      </div>
    </div>
  );
}

function useSubmit() {
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

const EMPTY_RANGE: RangeForm = {
  kind: 'invoice',
  resolution_number: '',
  prefix: '',
  number_from: 1,
  number_to: 0,
  valid_from: '',
  valid_to: '',
  technical_key: '',
};

export const WIZARD_RANGE: RangeForm = { ...HABILITATION_RANGE, technical_key: '' };

interface RangeFormProps {
  issuerId: number;
  preset?: RangeForm;
  allowKind?: boolean;
  onSaved: () => void;
  submitLabel: string;
  footer?: ReactNode;
}
