import { describe, it, expect, beforeEach } from '@jest/globals';

import { api } from '../http';
import {
  checkTestSet,
  createClientSystem,
  createIssuer,
  createRange,
  fetchTestSet,
  HABILITATION_RANGE,
  registerSoftware,
  startTestSet,
  stepErrors,
  uploadCertificate,
} from '../onboarding';

jest.mock('../http', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockGet = api.get as unknown as jest.Mock;
const mockPost = api.post as unknown as jest.Mock;

describe('onboarding service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({ data: { id: 1 } });
    mockGet.mockResolvedValue({ data: { readiness: {}, run: null } });
  });

  it('creates a client system', async () => {
    const data = { name: 'Waiter', webhook_url: '', domain: 'waiter.co', allow_subdomains: true };

    await createClientSystem(data);

    expect(mockPost).toHaveBeenCalledWith('console/client-systems/create/', data);
  });

  it('enrols an issuer', async () => {
    const issuer = { client_id: 1, nit: '900373115' } as unknown as Parameters<typeof createIssuer>[0];

    await createIssuer(issuer);

    expect(mockPost).toHaveBeenCalledWith('console/issuers/create/', issuer);
  });

  it('uploads the certificate as a file with its password', async () => {
    const file = new File(['p12'], 'certificado.p12');

    await uploadCertificate(3, { kind: 'p12', file, password: 'clave' });

    const [url, form] = mockPost.mock.calls[0] as [string, FormData];
    expect(url).toBe('console/issuers/3/certificate/');
    expect(form.get('p12')).toBeInstanceOf(File);
    expect(form.get('password')).toBe('clave');
  });

  it('uploads the certificate and its key as separate files', async () => {
    await uploadCertificate(3, {
      kind: 'pair',
      certificate: new File(['cer'], '7674.cer'),
      privateKey: new File(['key'], 'private.key'),
      keyPassword: '',
    });

    const [, form] = mockPost.mock.calls[0] as [string, FormData];
    expect(form.get('certificate')).toBeInstanceOf(File);
    expect(form.get('private_key')).toBeInstanceOf(File);
    expect(form.has('key_password')).toBe(false);
  });

  it('registers the software and the habilitación range', async () => {
    await registerSoftware(3, { environment: '2', software_id: 'sw', software_pin: '1', test_set_id: 'set' });
    await createRange(3, { ...HABILITATION_RANGE, technical_key: 'clave' });

    expect(mockPost).toHaveBeenNthCalledWith(1, 'console/issuers/3/software/', expect.objectContaining({ software_id: 'sw' }));
    expect(mockPost).toHaveBeenNthCalledWith(2, 'console/issuers/3/ranges/', expect.objectContaining({ prefix: 'SETP' }));
  });

  it('reads, starts and checks the test set', async () => {
    await fetchTestSet(3);
    await startTestSet(3, { invoices: 30, credit_notes: 10, debit_notes: 10 });
    await checkTestSet(9);

    expect(mockGet).toHaveBeenCalledWith('console/issuers/3/test-set/');
    expect(mockPost).toHaveBeenNthCalledWith(1, 'console/issuers/3/test-set/', { invoices: 30, credit_notes: 10, debit_notes: 10 });
    expect(mockPost).toHaveBeenNthCalledWith(2, 'console/test-sets/9/check/');
  });

  it.each([
    [{ response: { data: { detail: 'Al emisor le falta: TestSetId.' } } }, ['Al emisor le falta: TestSetId.']],
    [{ response: { data: { dv: ['El dígito no corresponde.'], code: 'invalid' } } }, ['El dígito no corresponde.']],
    [{ response: { data: { p12: ['No se pudo abrir.'], code: 'invalid_certificate' } } }, ['No se pudo abrir.']],
    [new Error('red'), []],
  ])('extracts the messages of a refused step', (error, messages) => {
    expect(stepErrors(error)).toEqual(messages);
  });
});
