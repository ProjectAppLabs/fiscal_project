'use client';

import { useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';

import { cn } from '@/lib/cn';

/** One field style for the whole console: sunk and soft, lavender ring on focus, rose when it has an error. */
export const CONTROL_CLASS = cn(
  'h-12 w-full rounded-md border-0 bg-surface px-4 text-[15px] text-ink shadow-sunk placeholder:text-ink-3 transition',
  'focus:outline-none focus:shadow-[inset_0_0_0_1.5px_var(--focus),0_0_0_4px_rgb(157_140_250/0.25)]',
  'disabled:bg-surface-sunk disabled:text-ink-3',
  'aria-[invalid=true]:bg-danger-bg/40 aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--danger)]',
);

/** Label on top, control, then the hint or the error (the error replaces the hint). */
export function Field({ id, label, hint, error, labelAction, help, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1">
          <label className="text-[13px] font-semibold text-ink" htmlFor={id}>
            {label}
          </label>
          {help}
        </span>
        {labelAction}
      </div>
      {children}
      {error ? (
        <p className="text-[13px] font-medium text-danger-fg" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-ink-3" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL_CLASS, className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL_CLASS, 'appearance-none bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10', SELECT_ARROW, className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL_CLASS, 'h-auto min-h-24 py-3', className)} {...props} />;
}

/** A password field with a button to show what was typed. */
export function PasswordInput({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const t = useTranslations('ui');
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input className={cn(CONTROL_CLASS, 'pr-12', className)} type={visible ? 'text' : 'password'} {...props} />
      <button
        aria-label={visible ? t('hidePassword') : t('showPassword')}
        aria-pressed={visible}
        className="absolute inset-y-0 right-1 my-auto grid size-10 place-items-center rounded-full text-ink-3 hover:bg-surface-sunk hover:text-ink"
        onClick={() => setVisible((current) => !current)}
        type="button"
      >
        {visible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
      </button>
    </div>
  );
}

/** Checkbox or radio with its label on the right. */
export function Choice({ label, description, className, type = 'checkbox', ...props }: ChoiceProps) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 text-[15px] text-ink', className)}>
      <input className="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--primary)]" type={type} {...props} />
      <span>
        <span className="block font-medium">{label}</span>
        {description ? <span className="block text-[13px] text-ink-3">{description}</span> : null}
      </span>
    </label>
  );
}

const SELECT_ARROW =
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2366617F' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]";

interface FieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Something next to the label, like «¿La olvidaste?». */
  labelAction?: ReactNode;
  /** A «?» right after the label (an InfoTip): what the field is and where its value comes from. */
  help?: ReactNode;
  className?: string;
  children: ReactNode;
}

interface ChoiceProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
  type?: 'checkbox' | 'radio';
}
