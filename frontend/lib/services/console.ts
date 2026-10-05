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
  /** 'rechazo' rejects the document; 'notificacion' is an observation on a valid one. */
  severity?: 'rechazo' | 'notificacion';
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
  alerts: { total: number; critical: number };
  /** Share of the DIAN's answers of the last 24 hours that were rejections; null without answers. */
  rejection_rate_24h: number | null;
  health: ServiceHealth;
}

export interface ServiceHealth {
  status: 'ok' | 'degraded' | 'down';
  database: 'ok' | 'down';
  queue: { due: number; oldest_due_seconds: number; ok: boolean };
  worker: { last_beat_at: string | null; ok: boolean };
  dian: { in_contingency: number; last_answer_at: string | null };
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

/** What the backend records with each state change (a JSON object); older stubs and notes may send text. */
export type DocumentEventDetail = Record<string, unknown> | string;

export interface DocumentEvent {
  state: DocumentState;
  detail: DocumentEventDetail;
  created_at: string;
}

export interface DocumentDetail extends DocumentListItem {
  idempotency_key: string;
  /** InvoiceTypeCode of the current XML: 01 sale, 03 paper transcription, 04 DIAN contingency; empty for notes. */
  invoice_type: string;
  contingency_started_at: string | null;
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

/** The parts of an event detail an operator reads, in a stable order; unknown keys are left out. */
export function eventDetailParts(detail: DocumentEventDetail): EventDetailPart[] {
  if (typeof detail === 'string') return detail ? [{ key: 'text', value: detail }] : [];
  if (!detail || typeof detail !== 'object') return [];

  const parts: EventDetailPart[] = [];
  for (const key of EVENT_DETAIL_KEYS) {
    const value = detail[key];
    if (value === undefined || value === null || value === '') continue;
    if (key === 'errors') {
      const errors = Array.isArray(value) ? (value as DianError[]) : [];
      if (errors.length) parts.push({ key, value: errors.map(describeDianError).join(' · ') });
      continue;
    }
    parts.push({ key, value: String(value) });
  }
  return parts;
}

export interface EventDetailPart {
  key: (typeof EVENT_DETAIL_KEYS)[number] | 'text';
  value: string;
}

const EVENT_DETAIL_KEYS = [
  'errors',
  'dian_unavailable',
  'gateway_refused',
  'contingency_refused',
  'invoice_type',
  'waiting_for',
  'delivery_failed',
] as const;

/** A DIAN notification does not reject the document; everything else (or an unknown severity) does. */
export function isDianNotification(error: DianError): boolean {
  return isDianRuleError(error) && error.severity === 'notificacion';
}

export function isNotFoundError(error: unknown): boolean {
  return (error as { response?: { status?: number } } | null)?.response?.status === 404;
}
