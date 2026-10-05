'use client';

import { create } from 'zustand';

import { isNotFoundError, pageFromLink } from '@/lib/services/console';
import {
  fetchAlerts,
  fetchClientSystems,
  fetchContingencies,
  fetchIssuer,
  fetchIssuers,
  resolveAlert,
  type Alert,
  type ClientSystemRow,
  type Contingency,
  type IssuerDetail,
  type IssuerListItem,
  type Paginated,
} from '@/lib/services/operations';
import type { DetailStatus, LoadStatus } from '@/lib/stores/consoleStore';

type OperationsState = {
  issuers: Paginated<IssuerListItem> | null;
  issuersStatus: LoadStatus;
  issuerQuery: string;
  issuersPage: number;
  issuer: IssuerDetail | null;
  issuerStatus: DetailStatus;
  alerts: Paginated<Alert> | null;
  alertsStatus: LoadStatus;
  includeResolved: boolean;
  alertsPage: number;
  resolvingAlertId: number | null;
  contingencies: Contingency[] | null;
  contingenciesStatus: LoadStatus;
  clientSystems: ClientSystemRow[] | null;
  clientSystemsStatus: LoadStatus;
  loadIssuers: () => Promise<void>;
  searchIssuers: (query: string) => Promise<void>;
  goToIssuersPage: (link: string | null) => Promise<void>;
  loadIssuer: (id: number | string) => Promise<void>;
  loadAlerts: () => Promise<void>;
  showResolvedAlerts: (includeResolved: boolean) => Promise<void>;
  goToAlertsPage: (link: string | null) => Promise<void>;
  resolve: (id: number) => Promise<boolean>;
  loadContingencies: () => Promise<void>;
  loadClientSystems: () => Promise<void>;
};

export const useOperationsStore = create<OperationsState>((set, get) => ({
  issuers: null,
  issuersStatus: 'idle',
  issuerQuery: '',
  issuersPage: 1,
  issuer: null,
  issuerStatus: 'idle',
  alerts: null,
  alertsStatus: 'idle',
  includeResolved: false,
  alertsPage: 1,
  resolvingAlertId: null,
  contingencies: null,
  contingenciesStatus: 'idle',
  clientSystems: null,
  clientSystemsStatus: 'idle',

  loadIssuers: async () => {
    const { issuerQuery, issuersPage } = get();
    set({ issuersStatus: 'loading' });
    try {
      set({ issuers: await fetchIssuers({ query: issuerQuery, page: issuersPage }), issuersStatus: 'ready' });
    } catch {
      set({ issuersStatus: 'error' });
    }
  },

  searchIssuers: async (query) => {
    set({ issuerQuery: query, issuersPage: 1 });
    await get().loadIssuers();
  },

  goToIssuersPage: async (link) => {
    const page = pageFromLink(link);
    if (page === null) return;
    set({ issuersPage: page });
    await get().loadIssuers();
  },

  loadIssuer: async (id) => {
    set({ issuer: null, issuerStatus: 'loading' });
    try {
      set({ issuer: await fetchIssuer(id), issuerStatus: 'ready' });
    } catch (error) {
      set({ issuerStatus: isNotFoundError(error) ? 'not-found' : 'error' });
    }
  },

  loadAlerts: async () => {
    const { includeResolved, alertsPage } = get();
    set({ alertsStatus: 'loading' });
    try {
      set({ alerts: await fetchAlerts({ includeResolved, page: alertsPage }), alertsStatus: 'ready' });
    } catch {
      set({ alertsStatus: 'error' });
    }
  },

  showResolvedAlerts: async (includeResolved) => {
    set({ includeResolved, alertsPage: 1 });
    await get().loadAlerts();
  },

  goToAlertsPage: async (link) => {
    const page = pageFromLink(link);
    if (page === null) return;
    set({ alertsPage: page });
    await get().loadAlerts();
  },

  resolve: async (id) => {
    set({ resolvingAlertId: id });
    try {
      await resolveAlert(id);
      await get().loadAlerts();
      return true;
    } catch {
      return false;
    } finally {
      set({ resolvingAlertId: null });
    }
  },

  loadContingencies: async () => {
    set({ contingenciesStatus: 'loading' });
    try {
      set({ contingencies: (await fetchContingencies()).results, contingenciesStatus: 'ready' });
    } catch {
      set({ contingenciesStatus: 'error' });
    }
  },

  loadClientSystems: async () => {
    set({ clientSystemsStatus: 'loading' });
    try {
      set({ clientSystems: (await fetchClientSystems()).results, clientSystemsStatus: 'ready' });
    } catch {
      set({ clientSystemsStatus: 'error' });
    }
  },
}));
