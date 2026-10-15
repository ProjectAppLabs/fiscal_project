'use client';

import { create } from 'zustand';

import { fetchApiDocs, type ApiDocsData } from '@/lib/services/apiDocs';

/** Habilitación (pruebas, environment 2) or producción (environment 1): the docs switch examples and warnings. */
export type DocsEnvironment = 'test' | 'prod';

/** The language of the code examples, remembered across pages like the environment. */
export const CODE_LANGUAGES = ['python', 'node', 'curl'] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

const ENV_KEY = 'fiscal.apiDocs.env';
const LANG_KEY = 'fiscal.apiDocs.lang';

function saved(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // A private window keeps the choice for this visit only.
  }
}

function savedEnvironment(): DocsEnvironment {
  return saved(ENV_KEY) === 'prod' ? 'prod' : 'test';
}

function savedLanguage(): CodeLanguage {
  const value = saved(LANG_KEY);
  return (CODE_LANGUAGES as readonly string[]).includes(value ?? '') ? (value as CodeLanguage) : 'python';
}

type ApiDocsState = {
  env: DocsEnvironment;
  lang: CodeLanguage;
  data: ApiDocsData | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  setEnv: (env: DocsEnvironment) => void;
  setLang: (lang: CodeLanguage) => void;
  /** Loads the specification once per session; `force` asks again after an error. */
  load: (force?: boolean) => Promise<void>;
};

export const useApiDocsStore = create<ApiDocsState>((set, get) => ({
  env: savedEnvironment(),
  lang: savedLanguage(),
  data: null,
  status: 'idle',

  setEnv: (env) => {
    save(ENV_KEY, env);
    set({ env });
  },

  setLang: (lang) => {
    save(LANG_KEY, lang);
    set({ lang });
  },

  load: async (force = false) => {
    const { status } = get();
    if (!force && (status === 'loading' || status === 'ready')) return;
    set({ status: 'loading' });
    try {
      set({ data: await fetchApiDocs(), status: 'ready' });
    } catch {
      set({ status: 'error' });
    }
  },
}));

/** The API's base address for examples: the configured one, or the console's own origin. */
export function useApiBaseUrl(): string {
  const configured = useApiDocsStore((s) => s.data?.api_base_url);
  if (configured) return configured;
  return typeof window === 'undefined' ? '' : window.location.origin;
}

/** Picks the value of the selected environment. */
export function useEnvValue<T>(test: T, prod: T): T {
  return useApiDocsStore((s) => (s.env === 'prod' ? prod : test));
}
