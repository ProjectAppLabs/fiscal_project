import { describe, it, expect } from '@jest/globals';

import { DOCS_PAGES, docsRoute, findPage, neighbours } from '../nav';

describe('API docs nav', () => {
  it('links the first page only forward', () => {
    expect(neighbours('introduccion')).toEqual({ previous: null, next: expect.objectContaining({ slug: 'inicio-rapido' }) });
  });

  it('links a middle page both ways', () => {
    expect([neighbours('autenticacion').previous?.slug, neighbours('autenticacion').next?.slug]).toEqual(['inicio-rapido', 'origen']);
  });

  it('finds a page by its slug', () => {
    expect(findPage('origen')?.title).toBe('Origen y dominios');
  });

  it('knows nothing about an unknown page', () => {
    // quality: allow-negation-only (an unknown slug must resolve to nothing so the page shows «no encontrada»)
    expect(findPage('no-existe')).toBeNull();
  });

  it('builds a route with its anchor', () => {
    expect(docsRoute('referencia', 'post-api-v1-documents-create')).toBe('/api-docs/referencia#post-api-v1-documents-create');
  });

  it('keeps every slug unique', () => {
    expect(new Set(DOCS_PAGES.map((page) => page.slug)).size).toBe(DOCS_PAGES.length);
  });
});
