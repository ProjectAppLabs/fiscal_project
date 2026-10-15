'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { AlertTriangle, Check, Copy, Info, Lightbulb, OctagonAlert } from 'lucide-react';

import { cn } from '@/lib/cn';
import { docsRoute } from '@/lib/apiDocs/nav';
import { CODE_LANGUAGES, useApiDocsStore, type CodeLanguage, type DocsEnvironment } from '@/lib/stores/apiDocsStore';
import { tokenize, type TokenKind } from './highlight';

/**
 * The building blocks of an API docs page, in the spirit of the Vue guide: comfortable prose, headings with anchors
 * that feed «En esta página», callouts, tables, code with copy and language tabs, and environment-only blocks.
 */

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 className="group mt-12 scroll-mt-28 border-t border-line pt-8 text-[24px] font-bold leading-tight text-ink first:mt-0 first:border-0 first:pt-0" data-doc-heading="2" id={id}>
      {children}
      <Anchor id={id} />
    </h2>
  );
}

export function H3({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 className="group mt-8 scroll-mt-28 text-[19px] font-bold leading-snug text-ink" data-doc-heading="3" id={id}>
      {children}
      <Anchor id={id} />
    </h3>
  );
}

function Anchor({ id }: { id: string }) {
  return (
    <a aria-hidden className="ml-2 text-primary-text opacity-0 transition group-hover:opacity-100 focus:opacity-100" href={`#${id}`} tabIndex={-1}>
      #
    </a>
  );
}

export function P({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mt-4 text-[16px] leading-[1.75] text-ink-2', className)}>{children}</p>;
}

export function Lead({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[18px] leading-[1.7] text-ink-2">{children}</p>;
}

export function Ul({ children }: { children: ReactNode }) {
  return <ul className="mt-4 flex list-disc flex-col gap-2 pl-6 text-[16px] leading-[1.7] text-ink-2 marker:text-primary-text">{children}</ul>;
}

export function Ol({ children }: { children: ReactNode }) {
  return <ol className="mt-4 flex list-decimal flex-col gap-2 pl-6 text-[16px] leading-[1.7] text-ink-2 marker:font-semibold marker:text-primary-text">{children}</ol>;
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-[6px] bg-surface-sunk px-1.5 py-0.5 font-mono text-[0.88em] text-ink">{children}</code>;
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}

export function DocLink({ to, hash, children }: { to: string; hash?: string; children: ReactNode }) {
  return (
    <Link className="font-semibold text-primary-text underline decoration-primary-text/30 underline-offset-2 hover:decoration-primary-text" href={docsRoute(to, hash)}>
      {children}
    </Link>
  );
}

const CALLOUT = {
  tip: { icon: Lightbulb, box: 'bg-success-bg/70 text-success-fg', label: 'Consejo' },
  info: { icon: Info, box: 'bg-info-bg/70 text-info-fg', label: 'Nota' },
  warning: { icon: AlertTriangle, box: 'bg-warning-bg/80 text-warning-fg', label: 'Importante' },
  danger: { icon: OctagonAlert, box: 'bg-danger-bg/80 text-danger-fg', label: 'Cuidado' },
} as const;

/** A highlighted block, like Vue's custom containers (TIP, WARNING, DANGER). */
export function Callout({ tone = 'info', title, children }: { tone?: keyof typeof CALLOUT; title?: string; children: ReactNode }) {
  const { icon: Icon, box, label } = CALLOUT[tone];
  return (
    <aside className={cn('mt-6 rounded-lg px-5 py-4 text-[15px] leading-relaxed', box)}>
      <p className="flex items-center gap-2 font-bold">
        <Icon aria-hidden className="size-4" />
        {title ?? label}
      </p>
      <div className="mt-1.5 [&_code]:bg-surface/60">{children}</div>
    </aside>
  );
}

export function Table({ head, rows }: { head: ReactNode[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-lg shadow-[inset_0_0_0_1px_var(--line)]">
      <table className="w-full border-collapse text-left text-[14px]">
        <thead className="bg-surface-sunk/70">
          <tr>
            {head.map((cell, index) => (
              <th className="px-4 py-2.5 font-semibold text-ink" key={index} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr className="border-t border-line align-top" key={index}>
              {row.map((cell, column) => (
                <td className="px-4 py-2.5 leading-relaxed text-ink-2" key={column}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TOKEN_CLASS: Record<TokenKind, string> = {
  plain: '',
  comment: 'italic text-ink-3',
  string: 'text-success-fg',
  number: 'text-warning-fg',
  keyword: 'font-semibold text-primary-text',
  property: 'text-info-fg',
  flag: 'text-primary-text',
};

/** A code block with its language, an optional title (a file or a request line) and a copy button. */
export function CodeBlock({ code, lang = 'plain', title }: { code: string; lang?: string; title?: string }) {
  return (
    <figure className="mt-5 overflow-hidden rounded-lg bg-surface-sunk/80 shadow-[inset_0_0_0_1px_var(--line)]">
      <figcaption className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
        <span className="truncate font-mono text-[12px] text-ink-3">{title ?? LANG_LABEL[lang] ?? lang}</span>
        <CopyCode code={code} />
      </figcaption>
      <Highlighted code={code} lang={lang} />
    </figure>
  );
}

function Highlighted({ code, lang }: { code: string; lang: string }) {
  return (
    <pre className="overflow-x-auto px-4 py-3.5 text-[13px] leading-[1.7]">
      <code className="font-mono text-ink">
        {tokenize(code, lang).map((token, index) => (
          <span className={TOKEN_CLASS[token.kind]} key={index}>
            {token.text}
          </span>
        ))}
      </code>
    </pre>
  );
}

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      aria-label={copied ? 'Copiado' : 'Copiar el código'}
      className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold text-ink-2 transition hover:bg-surface hover:text-ink"
      onClick={() => void copy()}
      type="button"
    >
      {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
      <span aria-live="polite">{copied ? 'Copiado' : 'Copiar'}</span>
    </button>
  );
}

const LANG_LABEL: Record<string, string> = { python: 'Python', javascript: 'JavaScript', json: 'JSON', bash: 'Terminal', http: 'HTTP', plain: 'Texto' };
const CODE_TAB_LABEL: Record<CodeLanguage, string> = { python: 'Python', node: 'Node.js', curl: 'curl' };
const CODE_TAB_LANG: Record<CodeLanguage, string> = { python: 'python', node: 'javascript', curl: 'bash' };

/** The same example in several languages; the chosen one is remembered on every page. */
export function CodeTabs({ examples, title }: { examples: Partial<Record<CodeLanguage, string>>; title?: string }) {
  const lang = useApiDocsStore((s) => s.lang);
  const setLang = useApiDocsStore((s) => s.setLang);
  const available = CODE_LANGUAGES.filter((item) => examples[item]);
  const current = available.includes(lang) ? lang : available[0];
  const code = examples[current] ?? '';

  return (
    <figure className="mt-5 overflow-hidden rounded-lg bg-surface-sunk/80 shadow-[inset_0_0_0_1px_var(--line)]">
      <figcaption className="flex items-center justify-between gap-3 border-b border-line px-2 py-1.5">
        <span aria-label={title ?? 'Lenguaje del ejemplo'} className="flex gap-1" role="tablist">
          {available.map((item) => (
            <button
              aria-selected={item === current}
              className={cn(
                'h-7 rounded-full px-3 text-[12px] font-semibold transition',
                item === current ? 'bg-surface text-ink shadow-rest' : 'text-ink-3 hover:text-ink',
              )}
              key={item}
              onClick={() => setLang(item)}
              role="tab"
              type="button"
            >
              {CODE_TAB_LABEL[item]}
            </button>
          ))}
        </span>
        <CopyCode code={code} />
      </figcaption>
      <Highlighted code={code} lang={CODE_TAB_LANG[current]} />
    </figure>
  );
}

/** Content for one environment only (habilitación or producción). */
export function OnlyIn({ env, children }: { env: DocsEnvironment; children: ReactNode }) {
  const current = useApiDocsStore((s) => s.env);
  return current === env ? <>{children}</> : null;
}

const METHOD_TONE: Record<string, string> = {
  GET: 'bg-info-bg text-info-fg',
  POST: 'bg-success-bg text-success-fg',
  PUT: 'bg-warning-bg text-warning-fg',
  PATCH: 'bg-warning-bg text-warning-fg',
  DELETE: 'bg-danger-bg text-danger-fg',
};

export function MethodBadge({ method }: { method: string }) {
  const upper = method.toUpperCase();
  return <span className={cn('inline-flex h-6 shrink-0 items-center rounded-full px-2.5 font-mono text-[11px] font-bold', METHOD_TONE[upper] ?? 'bg-neutral-bg text-neutral-fg')}>{upper}</span>;
}

/** The anchor of an operation in the reference, shared by the reference and the guides that link to it. */
export function operationAnchor(method: string, path: string): string {
  return `${method.toLowerCase()}-${path.replace(/[{}]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`;
}

/** An endpoint mentioned in a guide, linked to its entry in the reference. */
export function Endpoint({ method, path }: { method: string; path: string }) {
  return (
    <Link
      className="mt-4 flex w-fit max-w-full items-center gap-2 rounded-full bg-surface px-1.5 py-1 pr-4 shadow-[inset_0_0_0_1px_var(--line)] transition hover:shadow-rest"
      href={docsRoute('referencia', operationAnchor(method, path))}
    >
      <MethodBadge method={method} />
      <span className="truncate font-mono text-[13px] text-ink">{path}</span>
    </Link>
  );
}
