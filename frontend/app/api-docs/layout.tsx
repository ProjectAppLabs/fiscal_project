'use client';

import type { ReactNode } from 'react';

import { DocsShell } from '@/components/apiDocs/DocsShell';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';

/** The API docs live behind the console's sign-in: Fiscal. is not public. */
export default function ApiDocsLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useRequireAuth();
  if (!isAuthenticated) return null;
  return <DocsShell>{children}</DocsShell>;
}
