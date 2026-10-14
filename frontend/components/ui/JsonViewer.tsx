'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { CopyButton } from './Copy';
import { Button } from './Button';

/** The received content, formatted with line numbers, folded until asked for, with copy and download. */
export function JsonViewer({ title, subtitle, value, fileName }: JsonViewerProps) {
  const t = useTranslations('ui');
  const [open, setOpen] = useState(false);
  const text = JSON.stringify(value, null, 2);

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="overflow-hidden rounded-card bg-surface shadow-rest">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="text-[17px] font-bold text-ink">{title}</h2>
          {subtitle ? <p className="text-[13px] text-ink-3">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={text} />
          <Button onClick={download} size="sm" variant="secondary">
            {t('download')}
          </Button>
          <Button aria-expanded={open} onClick={() => setOpen((current) => !current)} size="sm" variant="soft">
            {open ? t('hide') : t('show')}
          </Button>
        </div>
      </div>
      {open ? (
        <pre className="max-h-[32rem] overflow-auto border-t border-line bg-surface-sunk/50 px-5 py-4 font-mono text-[12.5px] leading-5 text-ink">
          {text.split('\n').map((line, index) => (
            <span className="block" key={index}>
              <span aria-hidden className="mr-4 inline-block w-8 select-none text-right text-ink-3">
                {index + 1}
              </span>
              {line}
            </span>
          ))}
        </pre>
      ) : null}
    </section>
  );
}

interface JsonViewerProps {
  title: ReactNode;
  subtitle?: ReactNode;
  value: unknown;
  fileName: string;
}
