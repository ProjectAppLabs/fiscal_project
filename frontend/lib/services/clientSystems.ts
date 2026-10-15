'use client';

import { API_ENDPOINTS } from '@/lib/constants';
import { api } from '@/lib/services/http';

/** A client system as its console page shows it: never its secrets, only when they were issued and expire. */
export interface ClientSystemDetail {
  id: number;
  name: string;
  key_id: string;
  webhook_url: string;
  /** Domain the client system calls from (waiter.co); empty means any origin. */
  domain: string;
  allow_subdomains: boolean;
  /** IPs or networks it calls from; empty means any. */
  allowed_ips: string[];
  active: boolean;
  created_at: string;
  secrets: { id: number; created_at: string; expires_at: string | null; current: boolean }[];
  issuers: { id: number; nit: string; dv: string; legal_name: string; environment: '1' | '2'; active: boolean }[];
  notices: Record<DeliveryState, number>;
  last_delivered_at: string | null;
}

export const DELIVERY_STATES = ['pending', 'failed', 'delivered'] as const;
export type DeliveryState = (typeof DELIVERY_STATES)[number];

export interface Delivery {
  id: number;
  event: 'document.state_changed' | 'issuer.alert' | 'ping' | string;
  state: DeliveryState;
  attempts: number;
  document: { id: number; full_number: string } | null;
  alert_kind: string;
  last_status: number | null;
  last_error: string;
  next_attempt_at: string | null;
  delivered_at: string | null;
  created_at: string;
  payload: Record<string, unknown>;
}

export interface DeliveryPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: Delivery[];
}

const base = (id: number | string) => `${API_ENDPOINTS.CONSOLE_CLIENT_SYSTEMS}${id}/`;

export async function fetchClientSystem(id: number | string): Promise<ClientSystemDetail> {
  return (await api.get<ClientSystemDetail>(base(id))).data;
}

export type ClientSystemChanges = Partial<Pick<ClientSystemDetail, 'webhook_url' | 'active' | 'domain' | 'allow_subdomains' | 'allowed_ips'>>;

export async function updateClientSystem(id: number, changes: ClientSystemChanges): Promise<ClientSystemDetail> {
  return (await api.patch<ClientSystemDetail>(base(id), changes)).data;
}

/** A new secret, returned only here; the previous one keeps working for `graceHours`. */
export async function rotateClientSecret(id: number, graceHours: number): Promise<{ secret: string; grace_hours: number }> {
  return (await api.post(`${base(id)}rotate-secret/`, { grace_hours: graceHours })).data;
}

export async function pingClientSystem(id: number): Promise<Delivery> {
  return (await api.post<Delivery>(`${base(id)}ping/`, {})).data;
}

export async function fetchDeliveries(id: number, { state, page }: { state: DeliveryState | ''; page: number }): Promise<DeliveryPage> {
  const params: Record<string, string | number> = {};
  if (state) params.state = state;
  if (page > 1) params.page = page;
  return (await api.get<DeliveryPage>(`${base(id)}deliveries/`, { params })).data;
}

export async function retryFailedDeliveries(id: number): Promise<{ requeued: number }> {
  return (await api.post(`${base(id)}deliveries/retry-failed/`, {})).data;
}

export async function retryDelivery(deliveryId: number): Promise<Delivery> {
  return (await api.post<Delivery>(`console/deliveries/${deliveryId}/retry/`, {})).data;
}
