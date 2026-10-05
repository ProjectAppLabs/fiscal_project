/**
 * Flow tag constants for consistent E2E test tagging.
 *
 * Each constant bundles @flow:, @module:, and @priority: tags.
 * Use spread syntax to compose tags in tests:
 *
 *   import { AUTH_LOGIN_INVALID } from '../helpers/flow-tags';
 *   test('...', { tag: [...AUTH_LOGIN_INVALID] }, async ({ page }) => { ... });
 */

// ── Home ──
export const HOME_REDIRECT = ['@flow:home-redirect', '@module:home', '@priority:P1'];

// ── Auth ──
export const AUTH_SIGN_IN_FORM = ['@flow:auth-sign-in-form', '@module:auth', '@priority:P2'];
export const AUTH_LOGIN_INVALID = ['@flow:auth-login-invalid', '@module:auth', '@priority:P1'];
export const AUTH_LOGIN_SUCCESS = ['@flow:auth-login-success', '@module:auth', '@priority:P1'];
export const AUTH_PROTECTED_REDIRECT = ['@flow:auth-protected-redirect', '@module:auth', '@priority:P1'];
export const AUTH_SIGN_OUT = ['@flow:auth-sign-out', '@module:auth', '@priority:P1'];
export const AUTH_FORGOT_PASSWORD_FORM = ['@flow:auth-forgot-password-form', '@module:auth', '@priority:P2'];
export const AUTH_FORGOT_PASSWORD_SEND_CODE = ['@flow:auth-forgot-password-send-code', '@module:auth', '@priority:P1'];

// ── Dashboard ──
export const DASHBOARD_EMPTY_STATE = ['@flow:dashboard-empty-state', '@module:dashboard', '@priority:P1'];

// ── Console ──
export const CONSOLE_DASHBOARD_COUNTERS = ['@flow:console-dashboard-counters', '@module:console', '@priority:P1'];
export const CONSOLE_DASHBOARD_RETRY = ['@flow:console-dashboard-retry', '@module:console', '@priority:P2'];
export const CONSOLE_DOCUMENTS_FILTER = ['@flow:console-documents-filter', '@module:console', '@priority:P1'];
export const CONSOLE_DOCUMENTS_PAGINATION = ['@flow:console-documents-pagination', '@module:console', '@priority:P2'];
export const CONSOLE_DOCUMENT_DETAIL = ['@flow:console-document-detail', '@module:console', '@priority:P1'];
export const CONSOLE_DOCUMENT_NOT_FOUND = ['@flow:console-document-not-found', '@module:console', '@priority:P2'];
export const CONSOLE_DOCUMENT_DOWNLOAD = ['@flow:console-document-download', '@module:console', '@priority:P1'];
export const CONSOLE_DASHBOARD_HEALTH = ['@flow:console-dashboard-health', '@module:console', '@priority:P1'];
export const CONSOLE_ISSUERS_LIST = ['@flow:console-issuers-list', '@module:console', '@priority:P1'];
export const CONSOLE_ISSUER_DETAIL = ['@flow:console-issuer-detail', '@module:console', '@priority:P1'];
export const CONSOLE_CONTINGENCY_LETTER = ['@flow:console-contingency-letter', '@module:console', '@priority:P2'];

// ── i18n ──
export const I18N_LOCALE_SWITCH = ['@flow:i18n-locale-switch', '@module:i18n', '@priority:P2'];

// ── Navigation ──
export const NAVIGATION_UNKNOWN_ROUTE = ['@flow:navigation-unknown-route', '@module:navigation', '@priority:P3'];
