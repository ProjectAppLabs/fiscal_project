'use client';

import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Choice, Field, Input, Select } from '@/components/ui/Field';
import { checkDigit } from '@/lib/nit';
import { TAX_RESPONSIBILITIES, TAX_SCHEMES, stepErrors } from '@/lib/services/onboarding';
import { StepErrors } from './ClientSystemForm';
import { MunicipalityField } from './MunicipalityField';

/**
 * The issuer's data as it is in the RUT, shared by the enrolment wizard (create) and the issuer's page (edit, H-11).
 * The check digit follows the NIT (H-23); the municipality is searched by name (H-22). Editing never changes the NIT.
 */
export function IssuerForm({ mode, initial, onSubmit, submitLabel }: IssuerFormProps) {
  const t = useTranslations('onboarding.issuer');
  const tStep = useTranslations('onboarding');
  const [form, setForm] = useState<IssuerFields>({ ...EMPTY, ...initial });
  const [errors, setErrors] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof IssuerFields) => (value: string) => setForm((current) => ({ ...current, [key]: value }));
  const expectedDv = checkDigit(form.nit);

  const setNit = (nit: string) => setForm((current) => ({ ...current, nit, dv: checkDigit(nit) || current.dv }));

  const toggleResponsibility = (code: string) =>
    setForm((current) => {
      const has = current.tax_responsibilities.includes(code);
      const rest = has ? current.tax_responsibilities.filter((item) => item !== code) : [...current.tax_responsibilities, code];
      // R-99-PN means «none of the others»: it leaves when another one is chosen and comes back when none is left.
      const cleaned = code === 'R-99-PN' ? (has ? rest : ['R-99-PN']) : rest.filter((item) => item !== 'R-99-PN');
      return { ...current, tax_responsibilities: cleaned.length ? cleaned : ['R-99-PN'] };
    });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors(null);
    try {
      await onSubmit({ ...form, department_code: form.municipality_code.slice(0, 2) });
    } catch (error) {
      setErrors(stepErrors(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => void submit(e)}>
      <Field hint={mode === 'edit' ? t('nitLocked') : undefined} id="issuer-nit" label={t('nit')}>
        <Input className="font-mono" disabled={mode === 'edit'} id="issuer-nit" inputMode="numeric" onChange={(e) => setNit(e.target.value.trim())} required value={form.nit} />
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
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

export interface IssuerFields {
  nit: string;
  dv: string;
  person_type: '1' | '2';
  legal_name: string;
  trade_name: string;
  tax_responsibilities: string[];
  tax_scheme: (typeof TAX_SCHEMES)[number];
  address_line: string;
  municipality_code: string;
  email: string;
  phone: string;
}

const EMPTY: IssuerFields = {
  nit: '', dv: '', person_type: '2', legal_name: '', trade_name: '', tax_responsibilities: ['R-99-PN'], tax_scheme: 'ZZ',
  address_line: '', municipality_code: '', email: '', phone: '',
};

interface IssuerFormProps {
  mode: 'create' | 'edit';
  initial?: Partial<IssuerFields>;
  onSubmit: (data: IssuerFields & { department_code: string }) => Promise<void>;
  submitLabel: string;
}
