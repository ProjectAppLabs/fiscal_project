'use client';

import { API_ENDPOINTS, consoleDocumentEndpoint } from '@/lib/constants';
import { api } from '@/lib/services/http';

export const DOCUMENT_STATES = [
  'queued',
  'transmitting',
  'validated',
  'rejected',
  'contingency_dian',
  'contingency_issuer',
] as const;

export const DOCUMENT_KINDS = ['invoice', 'credit_note', 'debit_note'] as const;

export type DocumentState = (typeof DOCUMENT_STATES)[number];
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export interface IssuerRef {
  nit: string;
  legal_name: string;
}

export interface DianRuleError {
  rule: string;
  message: string;
}

export type DianError = DianRuleError | string;

export interface ConsoleSummary {
  documents: {
    total: number;
    by_state: Record<DocumentState, number>;
  };
  issuers: number;
  client_systems: number;
  queue: {
    due: number;
    oldest_queued_at: string | null;
  };
  last_rejection: {
    id: number;
    full_number: string;
    issuer: IssuerRef;
    errors: DianError[];
    at: string;
  } | null;
}

export interface DocumentListItem {
  id: number;
  client: string;
  issuer: IssuerRef;
  kind: DocumentKind;
  full_number: string;
  state: DocumentState;
  attempts: number;
  issue_datetime: string | null;
  created_at: string;
  validated_at: string | null;
}

export interface DocumentArtifact {
  kind: string;
  sha256: string;
  size: number;
  content_type: string;
  created_at: string;
}

export interface DocumentEvent {
  state: DocumentState;
  detail: string;
  created_at: string;
}

export interface DocumentDetail extends DocumentListItem {
  idempotency_key: string;
  cufe: string | null;
  qr_url: string | null;
  errors: DianError[];
  original: number | null;
  payload: Record<string, unknown>;
  artifacts: DocumentArtifact[];
  events: DocumentEvent[];
}

export interface DocumentPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: DocumentListItem[];
}

export interface DocumentFilters {
  state: DocumentState | '';
  issuer: string;
}

export async function fetchConsoleSummary(): Promise<ConsoleSummary> {
  const response = await api.get<ConsoleSummary>(API_ENDPOINTS.CONSOLE_SUMMARY);
  return response.data;
}

export async function fetchDocuments({
  filters,
  page,
}: {
  filters: DocumentFilters;
  page: number;
}): Promise<DocumentPage> {
  const params: Record<string, string | number> = {};
  if (filters.state) params.state = filters.state;
  if (filters.issuer.trim()) params.issuer = filters.issuer.trim();
  if (page > 1) params.page = page;

  const response = await api.get<DocumentPage>(API_ENDPOINTS.CONSOLE_DOCUMENTS, { params });
  return response.data;
}

export async function fetchDocument(id: number | string): Promise<DocumentDetail> {
  const response = await api.get<DocumentDetail>(consoleDocumentEndpoint(id));
  return response.data;
}

/** Page number a DRF `next`/`previous` link points to; a link without `page` is the first page. */
export function pageFromLink(link: string | null): number | null {
  if (!link) return null;

  try {
    const page = Number(new URL(link, 'http://localhost').searchParams.get('page') ?? '1');
    return Number.isInteger(page) && page > 0 ? page : null;
  } catch {
    return null;
  }
}

export function isDianRuleError(error: DianError): error is DianRuleError {
  return typeof error === 'object' && error !== null && 'message' in error;
}

/** One readable line per DIAN error, whether the backend sent an object or a plain text. */
export function describeDianError(error: DianError): string {
  if (!isDianRuleError(error)) return String(error);
  return error.rule ? `${error.rule}: ${error.message}` : error.message;
}

export function isNotFoundError(error: unknown): boolean {
  return (error as { response?: { status?: number } } | null)?.response?.status === 404;
}
