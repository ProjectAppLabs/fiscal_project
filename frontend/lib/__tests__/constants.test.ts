import { describe, it, expect } from '@jest/globals';

import {
  API_ENDPOINTS,
  COOKIE_KEYS,
  DISPLAY_TIME_ZONE,
  ROUTES,
  consoleDocumentEndpoint,
  documentDetailRoute,
} from '../constants';

describe('constants', () => {
  describe('ROUTES', () => {
    it.each([
      ['HOME', '/'],
      ['SIGN_IN', '/sign-in'],
      ['FORGOT_PASSWORD', '/forgot-password'],
      ['DASHBOARD', '/dashboard'],
      ['DOCUMENTS', '/documents'],
    ] as const)('maps %s to %s', (key, path) => {
      expect(ROUTES[key]).toBe(path);
    });
  });

  describe('API_ENDPOINTS', () => {
    it.each([
      ['SIGN_IN', 'sign_in/'],
      ['SEND_PASSCODE', 'send_passcode/'],
      ['RESET_PASSWORD', 'verify_passcode_and_reset_password/'],
      ['UPDATE_PASSWORD', 'update_password/'],
      ['VALIDATE_TOKEN', 'validate_token/'],
      ['TOKEN_REFRESH', 'token/refresh/'],
      ['HEALTH', 'health/'],
      ['STAGING_BANNER', 'staging-banner/'],
      ['CONSOLE_SUMMARY', 'console/summary/'],
      ['CONSOLE_DOCUMENTS', 'console/documents/'],
    ] as const)('maps %s to the backend path %s', (key, path) => {
      expect(API_ENDPOINTS[key]).toBe(path);
    });

    it('builds the console path of one document', () => {
      expect(consoleDocumentEndpoint(7)).toBe('console/documents/7/');
    });
  });

  describe('documentDetailRoute', () => {
    it('builds the console route of one document', () => {
      expect(documentDetailRoute(7)).toBe('/documents/7');
    });
  });

  describe('DISPLAY_TIME_ZONE', () => {
    it('shows dates in Colombia time', () => {
      expect(DISPLAY_TIME_ZONE).toBe('America/Bogota');
    });
  });

  describe('COOKIE_KEYS', () => {
    it('exposes the access token cookie name', () => {
      expect(COOKIE_KEYS.ACCESS_TOKEN).toBe('access_token');
    });

    it('exposes the refresh token cookie name', () => {
      expect(COOKIE_KEYS.REFRESH_TOKEN).toBe('refresh_token');
    });
  });
});
