/**
 * The step-by-step guides for Claude in Chrome (frontend/public/handoff/*.md). The console copies or downloads one with
 * the context filled in: the console address and, when there is one, the issuer.
 */

export const HANDOFF_GUIDES = [
  { id: 'dian-registration', file: '01-registro-facturador-dian.md', group: 'dian' },
  { id: 'software', file: '02-software-propio-y-set.md', group: 'dian' },
  { id: 'certificate', file: '03-certificado-digital.md', group: 'fiscal' },
  { id: 'enrolment', file: '04-inscribir-emisor.md', group: 'fiscal' },
  { id: 'test-set', file: '05-set-de-pruebas.md', group: 'fiscal' },
  { id: 'production', file: '06-paso-a-produccion.md', group: 'dian' },
  { id: 'client-system', file: '07-conectar-sistema-cliente.md', group: 'fiscal' },
  { id: 'rejection', file: '08-revisar-un-rechazo.md', group: 'fiscal' },
] as const;

export type HandoffId = (typeof HANDOFF_GUIDES)[number]['id'];

export interface HandoffContext {
  /** The console's own address, like https://fiscal.example.co. */
  origin: string;
  /** As much as the page knows: the wizard has only the id, a document only the name and NIT. */
  issuer?: { id?: number; legal_name?: string; nit?: string } | null;
}

export function handoffGuide(id: HandoffId) {
  return HANDOFF_GUIDES.find((guide) => guide.id === id) ?? HANDOFF_GUIDES[0];
}

export function handoffUrl(id: HandoffId): string {
  return `/handoff/${handoffGuide(id).file}`;
}

/** Fills {{CONSOLA_URL}}, {{EMISOR}} and {{EMISOR_URL}}; without an issuer they say so, and Claude asks for it. */
export function fillHandoff(text: string, { origin, issuer }: HandoffContext, noIssuer: string): string {
  return text
    .replaceAll('{{CONSOLA_URL}}', origin)
    .replaceAll('{{EMISOR_URL}}', issuer?.id ? `${origin}/issuers/${issuer.id}` : `${origin}/issuers`)
    .replaceAll('{{EMISOR}}', issuerLabel(issuer) ?? noIssuer);
}

function issuerLabel(issuer: HandoffContext['issuer']): string | null {
  if (issuer?.legal_name) return issuer.nit ? `${issuer.legal_name} (NIT ${issuer.nit})` : issuer.legal_name;
  return issuer?.id ? `#${issuer.id}` : null;
}

export async function loadHandoff(id: HandoffId, context: HandoffContext, noIssuer: string): Promise<string> {
  const response = await fetch(handoffUrl(id));
  if (!response.ok) throw new Error(`handoff ${id}: ${response.status}`);
  return fillHandoff(await response.text(), context, noIssuer);
}
