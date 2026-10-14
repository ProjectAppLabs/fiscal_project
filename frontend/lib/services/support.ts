'use client';

import { API_ENDPOINTS } from '@/lib/constants';
import { documentParams, type DocumentFilters, type ServiceHealth } from '@/lib/services/console';
import { api } from '@/lib/services/http';
import { alertParams, saveBlob, type AlertFilters } from '@/lib/services/operations';

export type DocumentAction = 'transmit' | 'check-dian' | 'resend-notice';

/** What the DIAN says about a document now (GetStatus by CUFE); it only informs. */
export interface DianAnswer {
  is_valid: boolean;
  status_code: string;
  status_description: string;
  status_message: string;
  messages: { rule: string; message: string; severity: string }[];
}

export async function runDocumentAction(id: number, action: DocumentAction): Promise<Record<string, unknown>> {
  return (await api.post(`${API_ENDPOINTS.CONSOLE_DOCUMENTS}${id}/actions/${action}/`, {})).data;
}

export async function exportDocuments(filters: DocumentFilters) {
  const response = await api.get<Blob>(`${API_ENDPOINTS.CONSOLE_DOCUMENTS}export/`, { params: documentParams(filters), responseType: 'blob' });
  saveBlob(response.data, 'documentos.csv');
}

export async function exportAlerts(includeResolved: boolean, filters?: AlertFilters) {
  const response = await api.get<Blob>(`${API_ENDPOINTS.CONSOLE_ALERTS}export/`, { params: alertParams(includeResolved, filters), responseType: 'blob' });
  saveBlob(response.data, 'alertas.csv');
}

/** The service health with what waits (documents by open state, notices pending or failed). */
export interface HealthDetail extends ServiceHealth {
  documents: Record<'queued' | 'transmitting' | 'contingency_dian' | 'contingency_issuer', number>;
  notices: Record<'pending' | 'failed', number>;
  checked_at: string;
}

export async function fetchHealth(): Promise<HealthDetail> {
  return (await api.get<HealthDetail>(API_ENDPOINTS.CONSOLE_HEALTH)).data;
}
