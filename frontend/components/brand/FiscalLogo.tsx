import { Ubuntu } from 'next/font/google';

// Ubuntu Bold is reserved for the wordmark; the rest of the UI keeps the default font.
const ubuntuBold = Ubuntu({ subsets: ['latin'], weight: '700', display: 'swap' });

export const BRAND_NAME = 'Fiscal.';

interface FiscalLogoProps {
  className?: string;
}

export function FiscalLogo({ className }: FiscalLogoProps) {
  return (
    <span className={`${ubuntuBold.className} tracking-tight ${className ?? ''}`.trim()} data-testid="fiscal-logo">
      {BRAND_NAME}
    </span>
  );
}
