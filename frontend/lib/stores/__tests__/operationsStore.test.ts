import { describe, it, expect, beforeEach } from '@jest/globals';

import { useOperationsStore } from '../operationsStore';
import { api } from '../../services/http';
import { httpError } from '../../__tests__/consoleFactories';
import {
  buildAlert,
  buildClientSystem,
  buildContingency,
  buildIssuer,
  buildIssuerDetail,
  buildPage,
} from '../../__tests__/operationsFactories';

jest.mock('../../services/http', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockGet = api.get as unknown as jest.Mock;
const mockPost = api.post as unknown as jest.Mock;
const initialState = useOperationsStore.getState();

describe('operations store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useOperationsStore.setState(initialState, true);
  });

  it('loads the issuers', async () => {
    mockGet.mockResolvedValueOnce({ data: buildPage([buildIssuer()]) });

    await useOperationsStore.getState().loadIssuers();

    expect(useOperationsStore.getState().issuersStatus).toBe('ready');
    expect(useOperationsStore.getState().issuers?.results).toHaveLength(1);
  });

  it('marks the issuers as failed when the API fails', async () => {
    mockGet.mockRejectedValueOnce(httpError(500));

    await useOperationsStore.getState().loadIssuers();

    expect(useOperationsStore.getState().issuersStatus).toBe('error');
  });

  it('searches from the first page', async () => {
    useOperationsStore.setState({ issuersPage: 3 });
    mockGet.mockResolvedValueOnce({ data: buildPage([]) });

    await useOperationsStore.getState().searchIssuers('Casa');

    expect(mockGet).toHaveBeenCalledWith('console/issuers/', { params: { q: 'Casa' } });
    expect(useOperationsStore.getState().issuersPage).toBe(1);
  });

  it('follows a pagination link of the issuers', async () => {
    mockGet.mockResolvedValueOnce({ data: buildPage([]) });

    await useOperationsStore.getState().goToIssuersPage('http://x/api/console/issuers/?page=2');

    expect(useOperationsStore.getState().issuersPage).toBe(2);
  });

  it('ignores an empty pagination link', async () => {
    await useOperationsStore.getState().goToIssuersPage(null);
    await useOperationsStore.getState().goToAlertsPage(null);

    expect(mockGet).not.toHaveBeenCalled();
    expect([useOperationsStore.getState().issuersPage, useOperationsStore.getState().alertsPage]).toEqual([1, 1]);
  });

  it('tells a missing issuer from a failure', async () => {
    mockGet.mockRejectedValueOnce(httpError(404));
    await useOperationsStore.getState().loadIssuer(99);
    expect(useOperationsStore.getState().issuerStatus).toBe('not-found');

    mockGet.mockRejectedValueOnce(httpError(500));
    await useOperationsStore.getState().loadIssuer(99);
    expect(useOperationsStore.getState().issuerStatus).toBe('error');
  });

  it('loads one issuer', async () => {
    mockGet.mockResolvedValueOnce({ data: buildIssuerDetail() });

    await useOperationsStore.getState().loadIssuer(3);

    expect(useOperationsStore.getState().issuer?.nit).toBe('900373115');
  });

  it('shows resolved alerts from the first page', async () => {
    useOperationsStore.setState({ alertsPage: 2 });
    mockGet.mockResolvedValueOnce({ data: buildPage([buildAlert()]) });

    await useOperationsStore.getState().showResolvedAlerts(true);

    expect(mockGet).toHaveBeenCalledWith('console/alerts/', { params: { state: 'all' } });
    expect(useOperationsStore.getState().alertsPage).toBe(1);
  });

  it('follows a pagination link of the alerts', async () => {
    mockGet.mockResolvedValueOnce({ data: buildPage([]) });

    await useOperationsStore.getState().goToAlertsPage('/api/console/alerts/?page=2&state=open');

    expect(mockGet).toHaveBeenCalledWith('console/alerts/', { params: { state: 'open', page: 2 } });
  });

  it('marks the alerts as failed when the API fails', async () => {
    mockGet.mockRejectedValueOnce(httpError(500));

    await useOperationsStore.getState().loadAlerts();

    expect(useOperationsStore.getState().alertsStatus).toBe('error');
  });

  it('reloads the alerts after resolving one', async () => {
    mockPost.mockResolvedValueOnce({ data: buildAlert({ resolved_at: '2026-10-05T13:00:00Z' }) });
    mockGet.mockResolvedValueOnce({ data: buildPage([]) });

    const resolved = await useOperationsStore.getState().resolve(11);

    expect(resolved).toBe(true);
    expect(useOperationsStore.getState().alerts?.results).toEqual([]);
    expect(useOperationsStore.getState().resolvingAlertId).toBeNull();
  });

  it('reports a failed resolution', async () => {
    mockPost.mockRejectedValueOnce(httpError(500));

    expect(await useOperationsStore.getState().resolve(11)).toBe(false);
  });

  it('loads the contingencies and the client systems', async () => {
    mockGet
      .mockResolvedValueOnce({ data: { count: 1, results: [buildContingency()] } })
      .mockResolvedValueOnce({ data: { count: 1, results: [buildClientSystem()] } });

    await useOperationsStore.getState().loadContingencies();
    await useOperationsStore.getState().loadClientSystems();

    expect(useOperationsStore.getState().contingencies).toHaveLength(1);
    expect(useOperationsStore.getState().clientSystems).toHaveLength(1);
  });

  it('marks contingencies and client systems as failed when the API fails', async () => {
    mockGet.mockRejectedValue(httpError(500));

    await useOperationsStore.getState().loadContingencies();
    await useOperationsStore.getState().loadClientSystems();

    expect(useOperationsStore.getState().contingenciesStatus).toBe('error');
    expect(useOperationsStore.getState().clientSystemsStatus).toBe('error');
  });
});
