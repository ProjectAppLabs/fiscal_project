'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Menu, Search, X } from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { cn } from '@/lib/cn';
import { DOCS_HOME, DOCS_PAGES, DOCS_SECTIONS, docsRoute, neighbours } from '@/lib/apiDocs/nav';
import { HTTP_METHODS } from '@/lib/services/apiDocs';
import { useApiDocsStore, type DocsEnvironment } from '@/lib/stores/apiDocsStore';
import { MethodBadge, operationAnchor } from './Prose';

/**
 * The API docs frame, like the Vue guide: the sections on the left (with the environment switch and the search), the
 * page in a comfortable column, «En esta página» on the right and «Anterior / Siguiente» at the end. Below 1024 px the
 * sections open from a «Menú» button.
 */
export function DocsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const slug = pathname.split('/')[2] || DOCS_HOME;
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName));
      if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)) {
        event.preventDefault();
        setSearching(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-6 sm:px-6 lg:pt-8">
      <div className="mb-4 flex items-center gap-2 lg:hidden">
        <button className="inline-flex h-10 items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold text-ink shadow-rest" onClick={() => setMenuOpen(pathname)} type="button">
          <Menu aria-hidden className="size-4" />
          Menú de la documentación
        </button>
        <button aria-label="Buscar en la documentación" className="grid size-10 place-items-center rounded-full bg-surface text-ink shadow-rest" onClick={() => setSearching(true)} type="button">
          <Search aria-hidden className="size-4" />
        </button>
      </div>
      <div className="grid gap-8 lg:grid-cols-[256px_minmax(0,1fr)] xl:grid-cols-[256px_minmax(0,1fr)_208px]">
        <aside aria-label="Secciones de la documentación" className="hidden lg:block">
          <div className="sticky top-28 flex max-h-[calc(100vh-8rem)] flex-col gap-4 overflow-y-auto pb-6 pr-2">
            <Sidebar current={slug} onSearch={() => setSearching(true)} />
          </div>
        </aside>
        <div className="min-w-0">
          <article className="mx-auto max-w-[760px]" ref={articleRef}>
            {children}
          </article>
          <PrevNext slug={slug} />
        </div>
        <OnThisPage articleRef={articleRef} key={slug} />
      </div>

      {menuOpen === pathname ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Cerrar el menú" className="absolute inset-0 bg-[#1E1A30]/35 backdrop-blur-sm" onClick={() => setMenuOpen(null)} type="button" />
          <nav aria-label="Secciones de la documentación" className="appear absolute inset-y-0 left-0 flex w-[min(320px,85vw)] flex-col gap-5 overflow-y-auto bg-surface p-5 shadow-float">
            <button aria-label="Cerrar el menú" className="ml-auto grid size-9 place-items-center rounded-full hover:bg-surface-sunk" onClick={() => setMenuOpen(null)} type="button">
              <X aria-hidden className="size-4" />
            </button>
            <Sidebar current={slug} onSearch={() => setSearching(true)} />
          </nav>
        </div>
      ) : null}
      <DocsSearch onClose={() => setSearching(false)} open={searching} />
    </div>
  );
}

function Sidebar({ current, onSearch }: { current: string; onSearch: () => void }) {
  return (
    <>
      <Link className="flex items-center gap-2 text-[15px] font-bold text-ink" href={docsRoute(DOCS_HOME)}>
        <BookOpen aria-hidden className="size-4 text-primary-text" />
        API de Fiscal.
      </Link>
      <button
        className="flex h-10 w-full items-center gap-2 rounded-full bg-surface-sunk/80 px-3.5 text-left text-[13px] text-ink-3 shadow-sunk transition hover:text-ink"
        onClick={onSearch}
        type="button"
      >
        <Search aria-hidden className="size-4" />
        <span className="flex-1">Buscar</span>
        <kbd className="rounded-[6px] bg-surface px-1.5 font-mono text-[11px] text-ink-3 shadow-rest">Ctrl K</kbd>
      </button>
      <EnvironmentSwitch />
      <nav aria-label="Páginas de la documentación" className="flex flex-col gap-4">
        {DOCS_SECTIONS.map((section) => (
          <div key={section.key}>
            <p className="text-label mb-1.5 px-3">{section.title}</p>
            <ul className="flex flex-col gap-0.5">
              {section.pages.map((page) => (
                <li key={page.slug}>
                  <Link
                    aria-current={page.slug === current ? 'page' : undefined}
                    className={cn(
                      'block rounded-lg px-3 py-1 text-[14px] transition',
                      page.slug === current ? 'bg-primary-soft font-semibold text-primary-text' : 'text-ink-2 hover:bg-surface-sunk/70 hover:text-ink',
                    )}
                    href={docsRoute(page.slug)}
                  >
                    {page.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}

const ENVIRONMENTS: { value: DocsEnvironment; label: string; hint: string }[] = [
  { value: 'test', label: 'Pruebas', hint: 'Habilitación DIAN (ambiente 2), sin efecto fiscal' },
  { value: 'prod', label: 'Producción', hint: 'Ambiente 1: los documentos tienen efecto fiscal' },
];

/** Like Vue's «API preference»: the examples and warnings of every page follow it. */
export function EnvironmentSwitch() {
  const env = useApiDocsStore((s) => s.env);
  const setEnv = useApiDocsStore((s) => s.setEnv);
  const current = ENVIRONMENTS.find((item) => item.value === env) ?? ENVIRONMENTS[0];

  return (
    <div>
      <p className="text-label mb-1.5 px-1" id="docs-env-label">
        Ambiente
      </p>
      <div aria-labelledby="docs-env-label" className="grid grid-cols-2 gap-1 rounded-full bg-surface-sunk/80 p-1 shadow-sunk" role="radiogroup">
        {ENVIRONMENTS.map((item) => (
          <button
            aria-checked={env === item.value}
            className={cn(
              'h-8 rounded-full text-[13px] font-semibold transition duration-200 ease-soft',
              env === item.value ? (item.value === 'prod' ? 'bg-surface text-danger-fg shadow-rest' : 'bg-surface text-ink shadow-rest') : 'text-ink-3 hover:text-ink',
            )}
            key={item.value}
            onClick={() => setEnv(item.value)}
            role="radio"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 px-1 text-[12px] leading-snug text-ink-3">{current.hint}</p>
    </div>
  );
}

function PrevNext({ slug }: { slug: string }) {
  const { previous, next } = neighbours(slug);
  return (
    <nav aria-label="Anterior y siguiente" className="mx-auto mt-14 grid max-w-[760px] gap-3 border-t border-line pt-6 sm:grid-cols-2">
      {previous ? (
        <Link className="group rounded-lg px-4 py-3 shadow-[inset_0_0_0_1px_var(--line)] transition hover:shadow-rest" href={docsRoute(previous.slug)}>
          <span className="flex items-center gap-1 text-[12px] text-ink-3">
            <ArrowLeft aria-hidden className="size-3.5" />
            Anterior
          </span>
          <span className="mt-0.5 block font-semibold text-primary-text">{previous.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link className="group rounded-lg px-4 py-3 text-right shadow-[inset_0_0_0_1px_var(--line)] transition hover:shadow-rest" href={docsRoute(next.slug)}>
          <span className="flex items-center justify-end gap-1 text-[12px] text-ink-3">
            Siguiente
            <ArrowRight aria-hidden className="size-3.5" />
          </span>
          <span className="mt-0.5 block font-semibold text-primary-text">{next.title}</span>
        </Link>
      ) : null}
    </nav>
  );
}

interface Heading {
  id: string;
  text: string;
  level: number;
}

/** «En esta página»: the page's headings, with the one being read marked as you scroll. */
function OnThisPage({ articleRef }: { articleRef: React.RefObject<HTMLElement | null> }) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    let observer: IntersectionObserver | null = null;
    const read = () => {
      const found = Array.from(article.querySelectorAll<HTMLElement>('[data-doc-heading]')).map((element) => ({
        id: element.id,
        text: element.dataset.docTitle ?? element.textContent?.replace(/#$/, '').trim() ?? '',
        level: Number(element.dataset.docHeading),
      }));
      setHeadings(found);
      observer?.disconnect();
      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
          if (visible) setActive(visible.target.id);
        },
        { rootMargin: '-96px 0px -65% 0px' },
      );
      article.querySelectorAll('[data-doc-heading]').forEach((element) => observer?.observe(element));
    };
    // Content arrives after the specification loads and changes with the environment: read the headings again then.
    const frame = window.requestAnimationFrame(read);
    const mutations = new MutationObserver(() => read());
    mutations.observe(article, { childList: true, subtree: true });
    return () => {
      window.cancelAnimationFrame(frame);
      mutations.disconnect();
      observer?.disconnect();
    };
  }, [articleRef]);

  if (!headings.length) return <div className="hidden xl:block" />;
  return (
    <aside aria-label="En esta página" className="hidden xl:block">
      <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto">
        <p className="text-label mb-2">En esta página</p>
        <ul className="flex flex-col gap-1 border-l border-line">
          {headings.map((heading) => (
            <li key={heading.id}>
              <a
                className={cn(
                  '-ml-px block border-l-2 py-1 text-[13px] leading-snug transition',
                  heading.level === 3 ? 'pl-6' : 'pl-3',
                  active === heading.id ? 'border-primary-text font-semibold text-primary-text' : 'border-transparent text-ink-3 hover:text-ink',
                )}
                href={`#${heading.id}`}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

interface SearchResult {
  key: string;
  title: string;
  context: string;
  href: string;
  method?: string;
}

/** Search over the pages and every endpoint of the specification (accents do not matter). */
function DocsSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const spec = useApiDocsStore((s) => s.data?.spec);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);

  const index = useMemo<SearchResult[]>(() => {
    const pages = DOCS_PAGES.map((page) => ({ key: page.slug, title: page.title, context: `${page.section} · ${page.description}`, href: docsRoute(page.slug) }));
    const operations = Object.entries(spec?.paths ?? {}).flatMap(([path, item]) =>
      HTTP_METHODS.filter((method) => item[method]).map((method) => ({
        key: `${method}-${path}`,
        title: item[method]?.summary ?? path,
        context: path,
        href: docsRoute('referencia', operationAnchor(method, path)),
        method,
      })),
    );
    return [...pages, ...operations];
  }, [spec]);

  const results = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (!words.length) return index.slice(0, 8);
    return index.filter((item) => words.every((word) => normalize(`${item.title} ${item.context}`).includes(word))).slice(0, 12);
  }, [index, query]);

  const close = () => {
    setQuery('');
    setSelected(0);
    onClose();
  };
  const go = (result: SearchResult | undefined) => {
    if (!result) return;
    close();
    router.push(result.href);
  };

  return (
    <Dialog onClose={close} open={open} size="lg" title="Buscar en la documentación">
      <input
        aria-label="Qué buscas"
        autoFocus
        className="h-12 w-full rounded-md bg-surface-sunk px-4 text-[15px] text-ink shadow-sunk placeholder:text-ink-3 focus:outline-none focus:shadow-[inset_0_0_0_1.5px_var(--focus)]"
        onChange={(event) => {
          setQuery(event.target.value);
          setSelected(0);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') setSelected((current) => Math.min(current + 1, results.length - 1));
          if (event.key === 'ArrowUp') setSelected((current) => Math.max(current - 1, 0));
          if (event.key === 'Enter') go(results[selected]);
        }}
        placeholder="Firma, avisos, documents/create…"
        value={query}
      />
      <ul aria-label="Resultados" className="mt-3 flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
        {results.map((result, position) => (
          <li key={result.key}>
            <button
              className={cn('flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition', position === selected ? 'bg-primary-soft' : 'hover:bg-surface-sunk')}
              onClick={() => go(result)}
              onMouseEnter={() => setSelected(position)}
              type="button"
            >
              {result.method ? <MethodBadge method={result.method} /> : <BookOpen aria-hidden className="mt-0.5 size-4 shrink-0 text-primary-text" />}
              <span className="min-w-0">
                <span className="block font-semibold text-ink">{result.title}</span>
                <span className="block truncate text-[13px] text-ink-3">{result.context}</span>
              </span>
            </button>
          </li>
        ))}
        {!results.length ? <li className="px-3 py-6 text-center text-[14px] text-ink-3">Nada coincide con «{query}».</li> : null}
      </ul>
    </Dialog>
  );
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
