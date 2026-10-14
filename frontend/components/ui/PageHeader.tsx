import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { EmojiTile, type EmojiName } from './Emoji';

/**
 * The same header on every view: breadcrumb, emoji tile, Title 1, a line of context and the actions. The Glacier
 * aurora lives behind it (the layout paints it); the logo never acts as a title.
 */
export function PageHeader({ emoji, title, subtitle, breadcrumb, badge, actions, className }: PageHeaderProps) {
  const t = useTranslations('ui');

  return (
    <header className={cn('mb-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-4', className)}>
      <div className="flex min-w-0 items-center gap-4">
        {emoji ? (
          <span className="hidden sm:block">
            <EmojiTile name={emoji} size="lg" tone="surface" />
          </span>
        ) : null}
        <div className="min-w-0">
          {breadcrumb ? (
            <nav aria-label={t('breadcrumb')} className="mb-1 text-[13px] font-semibold text-ink-2">
              {breadcrumb.map((item, index) => (
                <span key={item.label}>
                  {index > 0 ? <span aria-hidden className="mx-1.5 text-ink-3">/</span> : null}
                  {item.href ? (
                    <Link className="hover:text-primary-text" href={item.href}>
                      {item.label}
                    </Link>
                  ) : (
                    item.label
                  )}
                </span>
              ))}
            </nav>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-extrabold leading-[34px] tracking-[-0.02em] text-ink sm:text-[32px] sm:leading-[38px]">{title}</h1>
            {badge}
          </div>
          {subtitle ? <p className="mt-1 text-[15px] text-ink-2">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

interface PageHeaderProps {
  emoji?: EmojiName;
  title: ReactNode;
  subtitle?: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}
