import { describe, it, expect, beforeEach } from '@jest/globals';
import { act } from '@testing-library/react';

import { api } from '../../services/http';
import { useApiDocsStore } from '../apiDocsStore';

jest.mock('../../services/http', () => ({ api: { get: jest.fn() } }));

const mockGet = api.get as unknown as jest.Mock;
const initialState = useApiDocsStore.getState();
const DATA = { api_base_url: '', spec: { info: { title: 'Fiscal.', version: '1' }, paths: {} } };

describe('apiDocsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    useApiDocsStore.setState(initialState, true);
  });

  it('remembers the chosen environment', () => {
    act(() => useApiDocsStore.getState().setEnv('prod'));

    expect(window.localStorage.getItem('fiscal.apiDocs.env')).toBe('prod');
  });

  it('remembers the chosen code language', () => {
    act(() => useApiDocsStore.getState().setLang('node'));

    expect(window.localStorage.getItem('fiscal.apiDocs.lang')).toBe('node');
  });

  it('asks for the specification once per session', async () => {
    mockGet.mockResolvedValue({ data: DATA });

    await act(async () => {
      await useApiDocsStore.getState().load();
      await useApiDocsStore.getState().load();
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('asks again after an error when forced', async () => {
    mockGet.mockRejectedValueOnce(new Error('caído')).mockResolvedValueOnce({ data: DATA });

    await act(async () => {
      await useApiDocsStore.getState().load();
      await useApiDocsStore.getState().load(true);
    });

    expect(useApiDocsStore.getState().status).toBe('ready');
  });
});
