export const ROUTES = {
  HOME: '/',
  SIGN_IN: '/sign-in',
  FORGOT_PASSWORD: '/forgot-password',
  DASHBOARD: '/dashboard',
} as const;

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
} as const;

export const COOKIE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
} as const;
