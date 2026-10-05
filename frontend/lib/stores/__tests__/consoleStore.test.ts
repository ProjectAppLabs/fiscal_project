import { describe, it, expect, beforeEach } from '@jest/globals';
import { act } from '@testing-library/react';

import { useConsoleStore } from '../consoleStore';
import { api } from '../../services/http';
import {
  buildDocumentDetail,
  buildDocumentPage,
  buildSummary,
  httpError,
} from '../../__tests__/consoleFactories';

jest.mock('../../services/http', () => ({
  api: {
    get: jest.fn(),
  },
}));

const mockGet = api.get as unknown as jest.Mock;
const initialState = useConsoleStore.getState();

describe('consoleStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useConsoleStore.setState(initialState, true);
  });

  it('stores the summary once it loads', async () => {
    mockGet.mockResolvedValueOnce({ data: buildSummary() });

    await act(async () => {
      await useConsoleStore.getState().loadSummary();
    });

    expect(useConsoleStore.getState().summaryStatus).toBe('ready');
    expect(useConsoleStore.getState().summary?.issuers).toBe(3);
  });

  it('marks the summary as failed when the request fails', async () => {
    mockGet.mockRejectedValueOnce(httpError(500));

    await act(async () => {
      await useConsoleStore.getState().loadSummary();
    });

    expect(useConsoleStore.getState().summaryStatus).toBe('error');
  });

  it('stores the loaded document page', async () => {
    mockGet.mockResolvedValueOnce({ data: buildDocumentPage({ count: 30 }) });

    await act(async () => {
      await useConsoleStore.getState().loadDocuments();
    });

    expect(useConsoleStore.getState().documents?.count).toBe(30);
  });

  it('marks the document list as failed when the request fails', async () => {
    mockGet.mockRejectedValueOnce(httpError(500));

    await act(async () => {
      await useConsoleStore.getState().loadDocuments();
    });

    expect(useConsoleStore.getState().documentsStatus).toBe('error');
  });

  it('returns to the first page when the filters change', async () => {
    useConsoleStore.setState({ page: 3 });
    mockGet.mockResolvedValueOnce({ data: buildDocumentPage() });

    await act(async () => {
      await useConsoleStore.getState().applyFilters({ state: 'validated', issuer: '' });
    });

    expect(mockGet).toHaveBeenCalledWith('console/documents/', { params: { state: 'validated' } });
    expect(useConsoleStore.getState().page).toBe(1);
  });

  it('moves to the page named by the next link', async () => {
    useConsoleStore.setState({
      documents: buildDocumentPage({ next: 'http://localhost/api/console/documents/?page=2' }),
    });
    mockGet.mockResolvedValueOnce({ data: buildDocumentPage() });

    await act(async () => {
      await useConsoleStore.getState().goToNextPage();
    });

    expect(mockGet).toHaveBeenCalledWith('console/documents/', { params: { page: 2 } });
    expect(useConsoleStore.getState().page).toBe(2);
  });

  it('moves back to the page named by the previous link', async () => {
    useConsoleStore.setState({
      page: 2,
      documents: buildDocumentPage({ previous: 'http://localhost/api/console/documents/' }),
    });
    mockGet.mockResolvedValueOnce({ data: buildDocumentPage() });

    await act(async () => {
      await useConsoleStore.getState().goToPreviousPage();
    });

    expect(useConsoleStore.getState().page).toBe(1);
  });

  it('stays on the last page when there is no next link', async () => {
    useConsoleStore.setState({ page: 4, documents: buildDocumentPage({ next: null }) });

    await act(async () => {
      await useConsoleStore.getState().goToNextPage();
    });

    expect(mockGet).not.toHaveBeenCalled();
    expect(useConsoleStore.getState().page).toBe(4);
  });

  it('stays on the first page when there is no previous link', async () => {
    useConsoleStore.setState({ page: 1, documents: buildDocumentPage({ previous: null }) });

    await act(async () => {
      await useConsoleStore.getState().goToPreviousPage();
    });

    expect(useConsoleStore.getState().page).toBe(1);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('stores the loaded document detail', async () => {
    mockGet.mockResolvedValueOnce({ data: buildDocumentDetail() });

    await act(async () => {
      await useConsoleStore.getState().loadDocument('7');
    });

    expect(useConsoleStore.getState().documentStatus).toBe('ready');
    expect(useConsoleStore.getState().document?.cufe).toBe('a1b2c3d4e5f6a7b8c9d0');
  });

  it.each([
    [404, 'not-found'],
    [500, 'error'],
  ])('maps a %i on the detail to the %s status', async (status, expected) => {
    mockGet.mockRejectedValueOnce(httpError(status));

    await act(async () => {
      await useConsoleStore.getState().loadDocument('999');
    });

    expect(useConsoleStore.getState().documentStatus).toBe(expected);
  });
});
