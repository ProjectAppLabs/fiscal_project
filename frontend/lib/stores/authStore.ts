'use client';

import { create } from 'zustand';

import { API_ENDPOINTS } from '@/lib/constants';
import { api } from '@/lib/services/http';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '@/lib/services/tokens';

type User = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_staff: boolean;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  signIn: (args: { email: string; password: string; captcha_token?: string }) => Promise<void>;
  signOut: () => void;
  syncFromCookies: () => void;
  restoreUser: () => Promise<void>;
  sendPasswordResetCode: (email: string) => Promise<void>;
  resetPassword: (args: { email: string; code: string; new_password: string }) => Promise<void>;
};

function readStoredUser(): User | null {
  try {
    const data = typeof window !== 'undefined' ? localStorage.getItem('user_data') : null;
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: getAccessToken(),
  refreshToken: getRefreshToken(),
  user: readStoredUser(),
  isAuthenticated: Boolean(getAccessToken()),

  syncFromCookies: () => {
    const accessToken = getAccessToken();
    const refreshToken = getRefreshToken();
    set({ accessToken, refreshToken, isAuthenticated: Boolean(accessToken) });
    if (accessToken && !get().user) {
      void get().restoreUser();
    }
  },

  signIn: async ({ email, password, captcha_token }) => {
    const response = await api.post(API_ENDPOINTS.SIGN_IN, { email, password, captcha_token });
    const access = response.data?.access;
    const refresh = response.data?.refresh;
    const user = response.data?.user;

    if (!access || !refresh) {
      throw new Error('Invalid token response');
    }

    setTokens({ access, refresh });
    if (user) localStorage.setItem('user_data', JSON.stringify(user));
    set({ user, isAuthenticated: true });
    get().syncFromCookies();
  },

  signOut: () => {
    clearTokens();
    localStorage.removeItem('user_data');
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
  },

  restoreUser: async () => {
    const token = getAccessToken();
    if (!token) return;

    try {
      const response = await api.get(API_ENDPOINTS.VALIDATE_TOKEN);
      const user = response.data?.user;

      if (user) {
        localStorage.setItem('user_data', JSON.stringify(user));
        set({ user, isAuthenticated: true });
      }
    } catch {
      clearTokens();
      localStorage.removeItem('user_data');
      set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
    }
  },

  sendPasswordResetCode: async (email: string) => {
    await api.post(API_ENDPOINTS.SEND_PASSCODE, { email });
  },

  resetPassword: async ({ email, code, new_password }) => {
    await api.post(API_ENDPOINTS.RESET_PASSWORD, { email, code, new_password });
  },
}));
