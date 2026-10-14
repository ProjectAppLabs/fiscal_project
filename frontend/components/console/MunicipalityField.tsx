'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

import { CONTROL_CLASS } from '@/components/ui/Field';
import { cn } from '@/lib/cn';

/**
 * Municipality search (H-22): type «Medell» or «05001» and pick «Medellín · Antioquia»; the DANE code is what gets
 * saved. The DIAN list (1,122 municipalities) is a static file loaded on first use.
 */
export function MunicipalityField({ id, value, onChange }: { id: string; value: string; onChange: (code: string) => void }) {
  const t = useTranslations('onboarding.issuer');
  const catalog = useMunicipalities();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = catalog?.find(([code]) => code === value);
  const matches = useMemo(() => {
    const wanted = normalize(query.trim());
    if (!catalog || !wanted) return [];
    return catalog.filter(([code, name, department]) => code.startsWith(wanted) || normalize(name).includes(wanted) || normalize(department).startsWith(wanted)).slice(0, 8);
  }, [catalog, query]);

  const choose = (code: string) => {
    onChange(code);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="relative">
      <MapPin aria-hidden className="pointer-events-none absolute left-4 top-[18px] size-4 text-ink-3" />
      <input
        aria-activedescendant={open && matches[active] ? `${id}-option-${matches[active][0]}` : undefined}
        aria-autocomplete="list"
        aria-controls={`${id}-options`}
        aria-expanded={open && matches.length > 0}
        autoComplete="off"
        className={cn(CONTROL_CLASS, 'pl-11')}
        id={id}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          const text = e.target.value;
          setQuery(text);
          setActive(0);
          setOpen(true);
          // Five digits are a DANE code typed directly.
          if (/^\d{5}$/.test(text.trim())) onChange(text.trim());
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!matches.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((current) => (current + 1) % matches.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((current) => (current - 1 + matches.length) % matches.length);
          } else if (e.key === 'Enter' && open) {
            e.preventDefault();
            choose(matches[active][0]);
          }
        }}
        placeholder={t('municipalityPlaceholder')}
        required={!value}
        role="combobox"
        value={query || (selected ? `${selected[1]} · ${selected[2]}` : value)}
      />
      {open && matches.length ? (
        <ul className="appear absolute inset-x-0 top-[calc(100%+6px)] z-20 max-h-72 overflow-auto rounded-lg bg-surface p-1.5 shadow-float" id={`${id}-options`} ref={listRef} role="listbox">
          {matches.map(([code, name, department], index) => (
            <li
              aria-selected={index === active}
              className={cn('flex cursor-pointer items-center justify-between gap-3 rounded-sm px-3 py-2', index === active && 'bg-primary-soft')}
              id={`${id}-option-${code}`}
              key={code}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(code);
              }}
              role="option"
            >
              <span>
                <span className="block text-[15px] font-semibold text-ink">{name}</span>
                <span className="block text-[12px] text-ink-3">{department}</span>
              </span>
              <span className="font-mono text-[13px] text-primary-text">{code}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

let cache: Promise<Municipality[]> | null = null;

function useMunicipalities(): Municipality[] | null {
  const [catalog, setCatalog] = useState<Municipality[] | null>(null);

  useEffect(() => {
    let active = true;
    cache ??=
      typeof fetch === 'function'
        ? fetch('/catalogs/municipalities.json').then((response) => (response.ok ? response.json() : [])).catch(() => [])
        : Promise.resolve([]);
    cache.then((rows) => active && setCatalog(rows)).catch(() => active && setCatalog([]));
    return () => {
      active = false;
    };
  }, []);

  return catalog;
}

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

type Municipality = [code: string, name: string, department: string];
