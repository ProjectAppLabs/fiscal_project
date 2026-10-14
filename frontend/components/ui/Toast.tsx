'use client';

import { create } from 'zustand';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { cn } from '@/lib/cn';

/**
 * Confirms that something worked (H-06): bottom centre, dark over any background. Success closes itself after
 * 4 s; an error stays until it is closed.
 */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (message, tone = 'success') =>
    set((state) => ({ toasts: [...state.toasts.slice(-2), { id: Date.now() + Math.random(), message, tone }] })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export function toast(message: string, tone: ToastTone = 'success') {
  useToastStore.getState().show(message, tone);
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {toasts.map((item) => (
        <ToastItem item={item} key={item.id} />
      ))}
    </div>
  );
}

function ToastItem({ item }: { item: ToastData }) {
  const t = useTranslations('ui');
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    if (item.tone === 'error') return;
    const timer = window.setTimeout(() => dismiss(item.id), 4000);
    return () => window.clearTimeout(timer);
  }, [dismiss, item]);

  const Icon = item.tone === 'error' ? XCircle : CheckCircle2;
  return (
    <div className="appear pointer-events-auto flex items-center gap-3 rounded-full bg-[#1E1A30] py-2 pl-4 pr-2 text-sm font-semibold text-white shadow-float dark:bg-[#F3F1FA] dark:text-[#15131F]" role={item.tone === 'error' ? 'alert' : 'status'}>
      <Icon aria-hidden className={cn('size-4', item.tone === 'error' ? 'text-[#FF9AB0] dark:text-[#C53B5B]' : 'text-[#7FDDB4] dark:text-[#1E845A]')} />
      <span>{item.message}</span>
      <button aria-label={t('close')} className="grid size-7 place-items-center rounded-full hover:bg-white/10 dark:hover:bg-black/10" onClick={() => dismiss(item.id)} type="button">
        <X aria-hidden className="size-3.5" />
      </button>
    </div>
  );
}

type ToastTone = 'success' | 'error';

interface ToastData {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: ToastData[];
  show: (message: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
}
