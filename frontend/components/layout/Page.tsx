import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** The page column: 1296 px wide at most, 16 px of side margin on phones. */
export function Page({ narrow = false, className, children }: { narrow?: boolean; className?: string; children: ReactNode }) {
  return <main className={cn('mx-auto w-full px-4 pt-8 sm:px-6 lg:pt-10', narrow ? 'max-w-3xl' : 'max-w-[1296px]', className)}>{children}</main>;
}
