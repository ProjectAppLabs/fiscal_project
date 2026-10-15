/**
 * The API docs map: sections and pages in reading order (the sidebar, «Anterior / Siguiente» and the search use it).
 * Each page's content lives in components/apiDocs/pages, keyed by its slug.
 */

export const DOCS_SECTIONS = [
  {
    key: 'start',
    title: 'Empezar',
    pages: [
      { slug: 'introduccion', title: 'Introducción', description: 'Qué es Fiscal., qué hace el sistema cliente y cómo leer esta documentación.' },
      { slug: 'inicio-rapido', title: 'Inicio rápido', description: 'De las credenciales a la primera factura, en cinco pasos.' },
      { slug: 'autenticacion', title: 'Autenticación y firma', description: 'Las cabeceras X-Fiscal-*, el texto canónico y la firma HMAC-SHA256.' },
      { slug: 'origen', title: 'Origen y dominios', description: 'X-Fiscal-Origin, dominio y subdominios, emisores atados a su host e IPs.' },
      { slug: 'ambientes', title: 'Pruebas y producción', description: 'Qué cambia entre habilitación y producción, y cómo pasar de una a otra.' },
    ],
  },
  {
    key: 'guides',
    title: 'Guías',
    pages: [
      { slug: 'inscribir-emisor', title: 'Inscribir un emisor', description: 'Emisor, certificado, software y numeración por la API.' },
      { slug: 'set-de-pruebas', title: 'Set de pruebas', description: 'Correr el set de la DIAN y leer su resultado.' },
      { slug: 'paso-a-produccion', title: 'Paso a producción', description: 'Software, numeración de la DIAN y el paso que da efecto fiscal.' },
      { slug: 'emitir-documentos', title: 'Emitir documentos', description: 'Facturas, idempotencia, documento comercial y estados.' },
      { slug: 'notas', title: 'Notas crédito y débito', description: 'Corregir una factura con su referencia y concepto de la DIAN.' },
      { slug: 'avisos', title: 'Avisos (webhooks)', description: 'Eventos firmados, cómo verificarlos y los reintentos.' },
      { slug: 'contingencias', title: 'Contingencias', description: 'Cuando la DIAN no responde (tipo 04) o el comercio factura en papel (tipo 03).' },
      { slug: 'errores', title: 'Errores', description: 'La forma de los errores, sus códigos y qué hacer con cada uno.' },
    ],
  },
  {
    key: 'reference',
    title: 'Referencia',
    pages: [
      { slug: 'referencia', title: 'Endpoints', description: 'Cada ruta de /api/v1/, generada del openapi.json.' },
      { slug: 'eventos', title: 'Eventos de aviso', description: 'Los cuerpos de document.state_changed, issuer.alert y ping.' },
    ],
  },
] as const;

export type DocsPage = (typeof DOCS_SECTIONS)[number]['pages'][number];
export type DocsSlug = DocsPage['slug'];

export const DOCS_PAGES: readonly (DocsPage & { section: string })[] = DOCS_SECTIONS.flatMap((section) =>
  section.pages.map((page) => ({ ...page, section: section.title })),
);

export const DOCS_HOME: DocsSlug = 'introduccion';

export function docsRoute(slug: string, hash?: string): string {
  return `/api-docs/${slug}${hash ? `#${hash}` : ''}`;
}

export function findPage(slug: string | undefined) {
  return DOCS_PAGES.find((page) => page.slug === slug) ?? null;
}

/** The page before and after, in reading order. */
export function neighbours(slug: string) {
  const index = DOCS_PAGES.findIndex((page) => page.slug === slug);
  return { previous: index > 0 ? DOCS_PAGES[index - 1] : null, next: index >= 0 && index < DOCS_PAGES.length - 1 ? DOCS_PAGES[index + 1] : null };
}
