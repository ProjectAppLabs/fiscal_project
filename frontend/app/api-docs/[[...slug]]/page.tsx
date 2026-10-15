'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';

import { DOC_CONTENT } from '@/components/apiDocs/pages';
import { NotFoundState } from '@/components/ui/States';
import { ButtonLink } from '@/components/ui/Button';
import { DOCS_HOME, docsRoute, findPage } from '@/lib/apiDocs/nav';
import { useApiDocsStore } from '@/lib/stores/apiDocsStore';

/** One page of the API docs, by its slug (/api-docs is the introduction). */
export default function ApiDocsPage() {
  const params = useParams<{ slug?: string[] }>();
  const slug = params.slug?.[0] ?? DOCS_HOME;
  const page = findPage(slug);
  const load = useApiDocsStore((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (page) document.title = `${page.title} · API · Fiscal.`;
  }, [page]);

  if (!page) {
    return (
      <NotFoundState
        action={<ButtonLink href={docsRoute(DOCS_HOME)} variant="primary">Ir a la introducción</ButtonLink>}
        body="Esa página de la documentación no existe."
        title="Página no encontrada"
      />
    );
  }

  const Content = DOC_CONTENT[page.slug];
  return (
    <>
      <p className="text-label text-primary-text">{page.section}</p>
      <h1 className="mt-2 text-[34px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[40px]">{page.title}</h1>
      <Content />
    </>
  );
}
