'use client';

import { create } from 'zustand';

import {
  fetchConsoleSummary,
  fetchDocument,
  fetchDocuments,
  isNotFoundError,
  pageFromLink,
  type ConsoleSummary,
  type DocumentDetail,
  type DocumentFilters,
  type DocumentPage,
} from '@/lib/services/console';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
export type DetailStatus = LoadStatus | 'not-found';

type ConsoleState = {
  summary: ConsoleSummary | null;
  summaryStatus: LoadStatus;
  documents: DocumentPage | null;
  documentsStatus: LoadStatus;
  filters: DocumentFilters;
  page: number;
  document: DocumentDetail | null;
  documentStatus: DetailStatus;
  loadSummary: () => Promise<void>;
  loadDocuments: () => Promise<void>;
  applyFilters: (filters: DocumentFilters) => Promise<void>;
  goToNextPage: () => Promise<void>;
  goToPreviousPage: () => Promise<void>;
  loadDocument: (id: number | string) => Promise<void>;
};

export const EMPTY_FILTERS: DocumentFilters = { state: '', issuer: '' };

export const useConsoleStore = create<ConsoleState>((set, get) => ({
  summary: null,
  summaryStatus: 'idle',
  documents: null,
  documentsStatus: 'idle',
  filters: EMPTY_FILTERS,
  page: 1,
  document: null,
  documentStatus: 'idle',

  loadSummary: async () => {
    set({ summaryStatus: 'loading' });
    try {
      const summary = await fetchConsoleSummary();
      set({ summary, summaryStatus: 'ready' });
    } catch {
      set({ summaryStatus: 'error' });
    }
  },

  loadDocuments: async () => {
    const { filters, page } = get();
    set({ documentsStatus: 'loading' });
    try {
      const documents = await fetchDocuments({ filters, page });
      set({ documents, documentsStatus: 'ready' });
    } catch {
      set({ documentsStatus: 'error' });
    }
  },

  applyFilters: async (filters) => {
    set({ filters, page: 1 });
    await get().loadDocuments();
  },

  goToNextPage: async () => {
    const next = pageFromLink(get().documents?.next ?? null);
    if (next === null) return;
    set({ page: next });
    await get().loadDocuments();
  },

  goToPreviousPage: async () => {
    const previous = pageFromLink(get().documents?.previous ?? null);
    if (previous === null) return;
    set({ page: previous });
    await get().loadDocuments();
  },

  loadDocument: async (id) => {
    set({ document: null, documentStatus: 'loading' });
    try {
      const document = await fetchDocument(id);
      set({ document, documentStatus: 'ready' });
    } catch (error) {
      set({ documentStatus: isNotFoundError(error) ? 'not-found' : 'error' });
    }
  },
}));
