'use client';

import Cookies from 'js-cookie';

import { COOKIE_KEYS } from '@/lib/constants';

const ACCESS_TOKEN_KEY = COOKIE_KEYS.ACCESS_TOKEN;
const REFRESH_TOKEN_KEY = COOKIE_KEYS.REFRESH_TOKEN;

export const getAccessToken = () => Cookies.get(ACCESS_TOKEN_KEY) || null;
export const getRefreshToken = () => Cookies.get(REFRESH_TOKEN_KEY) || null;

export const setTokens = ({ access, refresh }: { access: string; refresh: string }) => {
  Cookies.set(ACCESS_TOKEN_KEY, access, { sameSite: 'lax' });
  Cookies.set(REFRESH_TOKEN_KEY, refresh, { sameSite: 'lax' });
};

export const clearTokens = () => {
  Cookies.remove(ACCESS_TOKEN_KEY);
  Cookies.remove(REFRESH_TOKEN_KEY);
};
