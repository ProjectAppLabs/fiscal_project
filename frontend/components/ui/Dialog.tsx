'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Button } from './Button';

/**
 * A modal on the native <dialog> (focus trap, Escape and backdrop for free). Radius 28, floating relief.
 * Used for delicate actions (H-06) and for side forms (replace the certificate, add a range…).
 */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md' }: DialogProps) {
  const t = useTranslations('ui');
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close?.();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      aria-labelledby="dialog-title"
      className={cn(
        'm-auto w-[calc(100%-2rem)] rounded-panel bg-surface p-0 text-ink shadow-float backdrop:bg-[#1E1A30]/35 backdrop:backdrop-blur-sm',
        size === 'lg' ? 'max-w-2xl' : 'max-w-lg',
      )}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      open={typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal ? true : undefined}
      ref={ref}
    >
      <div className="appear p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[22px] font-bold leading-7 tracking-[-0.01em]" id="dialog-title">
              {title}
            </h2>
            {description ? <p className="mt-1.5 text-[15px] text-ink-2">{description}</p> : null}
          </div>
          <button aria-label={t('close')} className="grid size-9 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-surface-sunk hover:text-ink" onClick={onClose} type="button">
            <X aria-hidden className="size-4" />
          </button>
        </div>
        {children ? <div className="mt-5">{children}</div> : null}
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </dialog>
  );
}

/** «Are you sure?» with the consequences spelled out; the confirm button is rose when it cannot be undone. */
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel, danger = false, busy = false, children }: ConfirmDialogProps) {
  const t = useTranslations('ui');

  return (
    <Dialog
      description={description}
      footer={
        <>
          <Button onClick={onClose} variant="ghost">
            {t('cancel')}
          </Button>
          <Button loading={busy} onClick={onConfirm} variant={danger ? 'danger' : 'primary'}>
            {confirmLabel}
          </Button>
        </>
      }
      onClose={onClose}
      open={open}
      title={title}
    >
      {children}
    </Dialog>
  );
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: ReactNode;
  danger?: boolean;
  busy?: boolean;
  children?: ReactNode;
}
