export const ROUTES = {
  HOME: '/',
  SIGN_IN: '/sign-in',
  FORGOT_PASSWORD: '/forgot-password',
  DASHBOARD: '/dashboard',
  DOCUMENTS: '/documents',
} as const;

export function documentDetailRoute(id: number | string): string {
  return `${ROUTES.DOCUMENTS}/${id}`;
}

// Paths relative to the axios base URL (`/api`), matching the backend's routes.
export const API_ENDPOINTS = {
  SIGN_IN: 'sign_in/',
  SEND_PASSCODE: 'send_passcode/',
  RESET_PASSWORD: 'verify_passcode_and_reset_password/',
  UPDATE_PASSWORD: 'update_password/',
  VALIDATE_TOKEN: 'validate_token/',
  TOKEN_REFRESH: 'token/refresh/',
  HEALTH: 'health/',
  STAGING_BANNER: 'staging-banner/',
  CAPTCHA_SITE_KEY: 'google-captcha/site-key/',
  CONSOLE_SUMMARY: 'console/summary/',
  CONSOLE_DOCUMENTS: 'console/documents/',
} as const;

export function consoleDocumentEndpoint(id: number | string): string {
  return `${API_ENDPOINTS.CONSOLE_DOCUMENTS}${id}/`;
}

// Fiscal documents are DIAN documents: dates are shown in Colombia's time zone.
export const DISPLAY_TIME_ZONE = 'America/Bogota';

export const COOKIE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
} as const;
