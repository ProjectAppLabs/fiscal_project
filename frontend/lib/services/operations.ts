'use client';

import { API_ENDPOINTS } from '@/lib/constants';
import { api } from '@/lib/services/http';

export const ARTIFACT_KINDS = ['pdf', 'attached_document', 'signed_xml', 'dian_response', 'evidence'] as const;
export const ALERT_SEVERITIES = ['critical', 'warning'] as const;
export const ALERT_KINDS = [
  'certificate_expiring',
  'range_low',
  'resolution_expiring',
  'contingency_deadline',
  'rejection',
  'queue_stuck',
] as const;

export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];
export type AlertKind = (typeof ALERT_KINDS)[number];

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface IssuerListItem {
  id: number;
  nit: string;
  dv: string;
  legal_name: string;
  environment: '1' | '2';
  active: boolean;
  client: string;
  documents: number;
  open_alerts: number;
  certificate_expires: string | null;
}

export interface IssuerCertificate {
  id: number;
  subject: string;
  issued_by: string;
  serial: string;
  not_before: string;
  not_after: string;
  active: boolean;
}

export interface IssuerSoftware {
  environment: '1' | '2';
  software_id: string;
  has_test_set: boolean;
  active: boolean;
  created_at: string;
}

export interface IssuerRange {
  id: number;
  kind: 'invoice' | 'contingency';
  resolution_number: string;
  prefix: string;
  number_from: number;
  number_to: number;
  valid_from: string;
  valid_to: string;
  active: boolean;
  establishment: string;
  last_number: number | null;
  used_share: number;
}

export interface Alert {
  id: number;
  kind: string;
  severity: AlertSeverity;
  message: string;
  issuer: { id: number; nit: string; legal_name: string } | null;
  document: { id: number; full_number: string } | null;
  created_at: string;
  resolved_at: string | null;
}

export interface IssuerDetail extends Omit<IssuerListItem, 'documents' | 'open_alerts' | 'certificate_expires'> {
  person_type: '1' | '2';
  trade_name: string;
  tax_responsibilities: string[];
  address: { line: string; municipality_code: string };
  email: string;
  certificates: IssuerCertificate[];
  software: IssuerSoftware[];
  ranges: IssuerRange[];
  alerts: Alert[];
}

export interface Contingency {
  id: number;
  full_number: string;
  state: string;
  contingency: 'dian' | 'issuer';
  invoice_type: string;
  issuer: { nit: string; legal_name: string };
  client: string;
  started_at: string;
  deadline_at: string;
  hours_left: number;
  attempts: number;
}

export interface ClientSystemRow {
  id: number;
  name: string;
  key_id: string;
  webhook_url: string;
  active: boolean;
  valid_secrets: number;
  issuers: number;
  pending_notices: number;
  failed_notices: number;
  last_delivered_at: string | null;
  created_at: string;
}

export async function fetchIssuers({ query, page }: { query: string; page: number }): Promise<Paginated<IssuerListItem>> {
  const params: Record<string, string | number> = {};
  if (query.trim()) params.q = query.trim();
  if (page > 1) params.page = page;
  const response = await api.get<Paginated<IssuerListItem>>(API_ENDPOINTS.CONSOLE_ISSUERS, { params });
  return response.data;
}

export async function fetchIssuer(id: number | string): Promise<IssuerDetail> {
  const response = await api.get<IssuerDetail>(`${API_ENDPOINTS.CONSOLE_ISSUERS}${id}/`);
  return response.data;
}

export async function fetchAlerts({ includeResolved, page }: { includeResolved: boolean; page: number }): Promise<Paginated<Alert>> {
  const params: Record<string, string | number> = { state: includeResolved ? 'all' : 'open' };
  if (page > 1) params.page = page;
  const response = await api.get<Paginated<Alert>>(API_ENDPOINTS.CONSOLE_ALERTS, { params });
  return response.data;
}

export async function resolveAlert(id: number): Promise<Alert> {
  const response = await api.post<Alert>(`${API_ENDPOINTS.CONSOLE_ALERTS}${id}/resolve/`);
  return response.data;
}

export async function fetchContingencies(): Promise<{ count: number; results: Contingency[] }> {
  const response = await api.get<{ count: number; results: Contingency[] }>(API_ENDPOINTS.CONSOLE_CONTINGENCIES);
  return response.data;
}

export async function fetchClientSystems(): Promise<{ count: number; results: ClientSystemRow[] }> {
  const response = await api.get<{ count: number; results: ClientSystemRow[] }>(API_ENDPOINTS.CONSOLE_CLIENT_SYSTEMS);
  return response.data;
}

/** Download a stored artifact through the authenticated API and hand it to the browser as a file. */
export async function downloadArtifact({ documentId, kind, fileName }: { documentId: number; kind: ArtifactKind; fileName: string }) {
  const response = await api.get<Blob>(`${API_ENDPOINTS.CONSOLE_DOCUMENTS}${documentId}/artifacts/${kind}/`, {
    responseType: 'blob',
  });
  saveBlob(response.data, fileName);
}

/** Download the draft of the issuer's contingency letter to the DIAN for a period (dates as YYYY-MM-DD). */
export async function downloadContingencyLetter({ issuerId, from, to }: { issuerId: number; from: string; to: string }) {
  const response = await api.get<Blob>(`${API_ENDPOINTS.CONSOLE_ISSUERS}${issuerId}/contingency-letter/`, {
    params: { from, to },
    responseType: 'blob',
  });
  saveBlob(response.data, `carta-contingencia-${from}-${to}.pdf`);
}

export function isAlertKind(kind: string): kind is AlertKind {
  return (ALERT_KINDS as readonly string[]).includes(kind);
}

/** Whole days until a date (negative once it passed); null without a date. */
export function daysUntil(value: string | null, now: Date = new Date()): number | null {
  if (!value) return null;
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return null;
  return Math.floor((target - now.getTime()) / 86_400_000);
}

export function artifactFileName(fullNumber: string, kind: ArtifactKind): string {
  return `${fullNumber}-${kind}.${ARTIFACT_EXTENSIONS[kind]}`;
}

function saveBlob(data: Blob, fileName: string) {
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const ARTIFACT_EXTENSIONS: Record<ArtifactKind, string> = {
  pdf: 'pdf',
  attached_document: 'xml',
  signed_xml: 'xml',
  dian_response: 'xml',
  evidence: 'json',
};
