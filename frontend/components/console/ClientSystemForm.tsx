'use client';

import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { CodeValue } from '@/components/ui/Copy';
import { Field, Input } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';
import { createClientSystem, stepErrors, type CreatedClientSystem } from '@/lib/services/onboarding';

/**
 * Creates a client system and shows its secret **once** (H-32): the same flow in Sistemas cliente and in the
 * enrolment wizard. The secret is not kept anywhere after «Ya lo guardé».
 */
export function ClientSystemForm({ onDone, submitLabel }: { onDone: (client: CreatedClientSystem) => void; submitLabel?: string }) {
  const t = useTranslations('onboarding.client');
  const [name, setName] = useState('');
  const [webhook, setWebhook] = useState('');
  const [created, setCreated] = useState<CreatedClientSystem | null>(null);
  const [errors, setErrors] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  if (created) return <SecretReveal client={created} onSaved={() => onDone(created)} />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors(null);
    try {
      setCreated(await createClientSystem({ name: name.trim(), webhook_url: webhook.trim() }));
    } catch (error) {
      setErrors(stepErrors(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
      <Field id="client-name" label={t('name')}>
        <Input id="client-name" onChange={(e) => setName(e.target.value)} placeholder={t('namePlaceholder')} required value={name} />
      </Field>
      <Field hint={t('webhookHint')} id="client-webhook" label={t('webhook')}>
        <Input id="client-webhook" onChange={(e) => setWebhook(e.target.value)} placeholder="https://" type="url" value={webhook} />
      </Field>
      {errors ? <StepErrors errors={errors} /> : null}
      <div>
        <Button loading={saving} loadingLabel={t('creating')} type="submit" variant="primary">
          {submitLabel ?? t('create')}
        </Button>
      </div>
    </form>
  );
}

function SecretReveal({ client, onSaved }: { client: CreatedClientSystem; onSaved: () => void }) {
  const t = useTranslations('onboarding.client');

  return (
    <div className="flex flex-col gap-4">
      <Notice title={t('secretTitle')} tone="warning">
        {t('secretBody')}
      </Notice>
      <dl className="flex flex-col gap-3">
        <div>
          <dt className="text-label mb-1.5">{t('keyId')}</dt>
          <dd>
            <CodeValue value={client.key_id} />
          </dd>
        </div>
        <div>
          <dt className="text-label mb-1.5">{t('secret')}</dt>
          <dd>
            <CodeValue value={client.secret} />
          </dd>
        </div>
      </dl>
      <div>
        <Button onClick={onSaved} variant="primary">
          {t('secretSaved')}
        </Button>
      </div>
    </div>
  );
}

/** The backend's messages for a step, in Spanish and ready to show. */
export function StepErrors({ errors }: { errors: string[] }) {
  const t = useTranslations('onboarding');

  return (
    <div className="rounded-lg bg-danger-bg px-4 py-3 text-[13px] text-danger-fg" role="alert">
      <p className="font-bold">{t('error')}</p>
      <ul className="mt-1 list-disc pl-5">
        {errors.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}
