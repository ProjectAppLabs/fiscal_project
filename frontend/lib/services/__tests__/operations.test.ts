import { describe, it, expect, beforeEach } from '@jest/globals';

import { api } from '../http';
import {
  artifactFileName,
  daysUntil,
  downloadArtifact,
  downloadContingencyLetter,
  fetchAlerts,
  fetchClientSystems,
  fetchContingencies,
  fetchIssuer,
  fetchIssuers,
  isAlertKind,
  resolveAlert,
} from '../operations';
import { buildAlert, buildIssuer, buildIssuerDetail, buildPage } from '../../__tests__/operationsFactories';

jest.mock('../http', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockGet = api.get as unknown as jest.Mock;
const mockPost = api.post as unknown as jest.Mock;

describe('operations service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(URL, { createObjectURL: jest.fn(() => 'blob:fiscal'), revokeObjectURL: jest.fn() });
  });

  it('asks for the first issuer page without params', async () => {
    mockGet.mockResolvedValueOnce({ data: buildPage([buildIssuer()]) });

    await fetchIssuers({ query: '', page: 1 });

    expect(mockGet).toHaveBeenCalledWith('console/issuers/', { params: {} });
  });

  it('sends the trimmed search and the page', async () => {
    mockGet.mockResolvedValueOnce({ data: buildPage([]) });

    await fetchIssuers({ query: ' 9003 ', page: 2 });

    expect(mockGet).toHaveBeenCalledWith('console/issuers/', { params: { q: '9003', page: 2 } });
  });

  it('reads one issuer by id', async () => {
    mockGet.mockResolvedValueOnce({ data: buildIssuerDetail() });

    const issuer = await fetchIssuer(3);

    expect(mockGet).toHaveBeenCalledWith('console/issuers/3/');
    expect(issuer.ranges).toHaveLength(1);
  });

  it.each([
    [false, 'open'],
    [true, 'all'],
  ])('asks for alerts including resolved = %s as state %s', async (includeResolved, state) => {
    mockGet.mockResolvedValueOnce({ data: buildPage([buildAlert()]) });

    await fetchAlerts({ includeResolved, page: 1 });

    expect(mockGet).toHaveBeenCalledWith('console/alerts/', { params: { state } });
  });

  it('resolves an alert with a POST', async () => {
    mockPost.mockResolvedValueOnce({ data: buildAlert({ resolved_at: '2026-10-05T13:00:00Z' }) });

    const alert = await resolveAlert(11);

    expect(mockPost).toHaveBeenCalledWith('console/alerts/11/resolve/');
    expect(alert.resolved_at).not.toBeNull();
  });

  it('reads the contingencies and the client systems', async () => {
    mockGet.mockResolvedValue({ data: { count: 0, results: [] } });

    await fetchContingencies();
    await fetchClientSystems();

    expect(mockGet).toHaveBeenNthCalledWith(1, 'console/contingencies/');
    expect(mockGet).toHaveBeenNthCalledWith(2, 'console/client-systems/');
  });

  it('downloads an artifact as a blob and saves it with its name', async () => {
    mockGet.mockResolvedValueOnce({ data: new Blob(['%PDF']) });
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    await downloadArtifact({ documentId: 7, kind: 'pdf', fileName: 'SETP7-pdf.pdf' });

    expect(mockGet).toHaveBeenCalledWith('console/documents/7/artifacts/pdf/', { responseType: 'blob' });
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it('downloads the contingency letter for the period', async () => {
    mockGet.mockResolvedValueOnce({ data: new Blob(['%PDF']) });
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    await downloadContingencyLetter({ issuerId: 3, from: '2026-10-01', to: '2026-10-03' });

    expect(mockGet).toHaveBeenCalledWith('console/issuers/3/contingency-letter/', {
      params: { from: '2026-10-01', to: '2026-10-03' },
      responseType: 'blob',
    });
    click.mockRestore();
  });

  it.each([
    ['2026-10-15T12:00:00Z', 10],
    ['2026-10-04T12:00:00Z', -1],
    [null, null],
    ['no es fecha', null],
  ])('counts the days until %s as %s', (value, days) => {
    expect(daysUntil(value, new Date('2026-10-05T12:00:00Z'))).toBe(days);
  });

  it.each([
    ['pdf', 'SETP7-pdf.pdf'],
    ['attached_document', 'SETP7-attached_document.xml'],
    ['evidence', 'SETP7-evidence.json'],
  ] as const)('names a %s download %s', (kind, name) => {
    expect(artifactFileName('SETP7', kind)).toBe(name);
  });

  it('recognizes only the alert kinds it can translate', () => {
    expect(isAlertKind('rejection')).toBe(true);
    expect(isAlertKind('otra_cosa')).toBe(false);
  });
});
