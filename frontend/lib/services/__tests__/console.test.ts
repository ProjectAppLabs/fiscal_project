import { describe, it, expect, beforeEach } from '@jest/globals';

import {
  describeDianError,
  fetchConsoleSummary,
  fetchDocument,
  fetchDocuments,
  isNotFoundError,
  pageFromLink,
} from '../console';
import { api } from '../http';
import { buildDocumentDetail, buildDocumentPage, buildSummary, httpError } from '../../__tests__/consoleFactories';

jest.mock('../http', () => ({
  api: {
    get: jest.fn(),
  },
}));

const mockGet = api.get as unknown as jest.Mock;

describe('console service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads the summary from console/summary/', async () => {
    mockGet.mockResolvedValueOnce({ data: buildSummary() });

    const summary = await fetchConsoleSummary();

    expect(mockGet).toHaveBeenCalledWith('console/summary/');
    expect(summary.documents.total).toBe(12);
  });

  it('requests the first page without query params when no filter is set', async () => {
    mockGet.mockResolvedValueOnce({ data: buildDocumentPage() });

    await fetchDocuments({ filters: { state: '', issuer: '' }, page: 1 });

    expect(mockGet).toHaveBeenCalledWith('console/documents/', { params: {} });
  });

  it('sends the state, trimmed issuer NIT and page as query params', async () => {
    mockGet.mockResolvedValueOnce({ data: buildDocumentPage() });

    await fetchDocuments({ filters: { state: 'rejected', issuer: ' 900373115 ' }, page: 2 });

    expect(mockGet).toHaveBeenCalledWith('console/documents/', {
      params: { state: 'rejected', issuer: '900373115', page: 2 },
    });
  });

  it('reads one document from its detail endpoint', async () => {
    mockGet.mockResolvedValueOnce({ data: buildDocumentDetail() });

    const document = await fetchDocument(7);

    expect(mockGet).toHaveBeenCalledWith('console/documents/7/');
    expect(document.full_number).toBe('SETP990000007');
  });
});

describe('pageFromLink', () => {
  it.each([
    ['http://localhost/api/console/documents/?page=3&state=queued', 3],
    ['http://localhost/api/console/documents/?state=queued', 1],
    ['/api/console/documents/?page=2', 2],
    [null, null],
    ['http://localhost/api/console/documents/?page=abc', null],
    ['http://localhost/api/console/documents/?page=0', null],
  ])('reads %p as page %p', (link, page) => {
    expect(pageFromLink(link)).toBe(page);
  });
});

describe('describeDianError', () => {
  it('joins the rule and message of a structured error', () => {
    expect(describeDianError({ rule: 'FAD06', message: 'El CUFE no corresponde.' })).toBe('FAD06: El CUFE no corresponde.');
  });

  it('shows only the message when the rule is empty', () => {
    expect(describeDianError({ rule: '', message: 'Error general.' })).toBe('Error general.');
  });

  it('keeps a plain text error as is', () => {
    expect(describeDianError('Documento con errores en campos mandatorios.')).toBe(
      'Documento con errores en campos mandatorios.'
    );
  });
});

describe('isNotFoundError', () => {
  it.each([
    [httpError(404), true],
    [httpError(500), false],
    [new Error('network'), false],
    [null, false],
  ])('classifies %p as not found: %p', (error, expected) => {
    expect(isNotFoundError(error)).toBe(expected);
  });
});
