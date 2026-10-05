'use client';

import { API_ENDPOINTS } from '@/lib/constants';
import { api } from '@/lib/services/http';

/** Fiscal responsibilities an issuer can declare (TipoResponsabilidad-2.1 of the DIAN toolkit). */
export const TAX_RESPONSIBILITIES = ['O-13', 'O-15', 'O-23', 'O-47', 'ZZ'] as const;
export const TAX_SCHEMES = ['01', '04', 'ZZ'] as const;

/** The habilitación range of the official toolkit example; the participants catalog shows each issuer's own values. */
export const HABILITATION_RANGE = {
  kind: 'invoice',
  resolution_number: '18760000001',
  prefix: 'SETP',
  number_from: 990000000,
  number_to: 995000000,
  valid_from: '2019-01-19',
  valid_to: '2030-01-19',
} as const;

export const DEFAULT_TEST_SET_INVOICES = 8;

export interface CreatedClientSystem {
  id: number;
  name: string;
  key_id: string;
  /** Shown only in this answer: Fiscal. keeps it encrypted and never returns it again. */
  secret: string;
}

export interface IssuerForm {
  client_id: number;
  nit: string;
  dv: string;
  person_type: '1' | '2';
  legal_name: string;
  trade_name: string;
  tax_responsibilities: string[];
  tax_scheme: (typeof TAX_SCHEMES)[number];
  address_line: string;
  municipality_code: string;
  department_code: string;
  email: string;
  phone: string;
  environment: '2';
}

export interface SoftwareForm {
  environment: '2';
  software_id: string;
  software_pin: string;
  test_set_id: string;
}

export interface RangeForm {
  kind: 'invoice';
  resolution_number: string;
  prefix: string;
  number_from: number;
  number_to: number;
  valid_from: string;
  valid_to: string;
  technical_key: string;
}

export type TestSetReadiness = Record<'environment' | 'certificate' | 'software' | 'test_set_id' | 'range', boolean>;

export interface TestSetDocument {
  kind: 'invoice' | 'credit_note' | 'debit_note';
  full_number: string;
  code: string;
  status: 'pending' | 'accepted' | 'rejected';
  messages: { rule: string; message: string; severity: string }[];
  file_name: string;
}

export interface TestSetRun {
  id: number;
  state: 'processing' | 'accepted' | 'rejected' | 'failed';
  error: string;
  created_at: string;
  updated_at: string;
  documents: TestSetDocument[];
  phases: { name: string; zip_key: string; errors: string[] }[];
}

export async function createClientSystem(data: { name: string; webhook_url: string }): Promise<CreatedClientSystem> {
  return (await api.post<CreatedClientSystem>(`${API_ENDPOINTS.CONSOLE_CLIENT_SYSTEMS}create/`, data)).data;
}

export async function createIssuer(data: IssuerForm): Promise<{ id: number; nit: string; legal_name: string }> {
  return (await api.post(`${API_ENDPOINTS.CONSOLE_ISSUERS}create/`, data)).data;
}

export async function uploadCertificate(issuerId: number, file: File, password: string) {
  const form = new FormData();
  form.append('p12', file);
  form.append('password', password);
  const response = await api.post<{ id: number; subject: string; not_after: string }>(
    `${API_ENDPOINTS.CONSOLE_ISSUERS}${issuerId}/certificate/`,
    form,
  );
  return response.data;
}

export async function registerSoftware(issuerId: number, data: SoftwareForm) {
  return (await api.post(`${API_ENDPOINTS.CONSOLE_ISSUERS}${issuerId}/software/`, data)).data;
}

export async function createRange(issuerId: number, data: RangeForm) {
  return (await api.post(`${API_ENDPOINTS.CONSOLE_ISSUERS}${issuerId}/ranges/`, data)).data;
}

export async function fetchTestSet(issuerId: number): Promise<{ readiness: TestSetReadiness; run: TestSetRun | null }> {
  return (await api.get(`${API_ENDPOINTS.CONSOLE_ISSUERS}${issuerId}/test-set/`)).data;
}

export async function startTestSet(issuerId: number, invoices: number): Promise<TestSetRun> {
  return (await api.post<TestSetRun>(`${API_ENDPOINTS.CONSOLE_ISSUERS}${issuerId}/test-set/`, { invoices })).data;
}

export async function checkTestSet(runId: number): Promise<TestSetRun> {
  return (await api.post<TestSetRun>(`console/test-sets/${runId}/check/`)).data;
}

/** The messages the backend returned for a refused step: field errors, a `detail` or nothing. */
export function stepErrors(error: unknown): string[] {
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;
  if (!data || typeof data !== 'object') return [];
  const body = data as Record<string, unknown>;
  if (typeof body.detail === 'string') return [body.detail];
  return Object.entries(body)
    .filter(([key]) => key !== 'code')
    .flatMap(([, value]) => (Array.isArray(value) ? value.map(String) : typeof value === 'string' ? [value] : []));
}
