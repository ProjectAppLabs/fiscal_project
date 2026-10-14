import { Ubuntu } from 'next/font/google';

// Ubuntu Bold is reserved for the wordmark; the rest of the UI uses Figtree.
const ubuntuBold = Ubuntu({ subsets: ['latin'], weight: '700', display: 'swap' });

export const BRAND_NAME = 'Fiscal.';

interface FiscalLogoProps {
  className?: string;
}

/** «Fiscal» in Ubuntu Bold; the period is drawn as a drop of the Boreal aurora, the brand's signature. */
export function FiscalLogo({ className }: FiscalLogoProps) {
  return (
    <span className={`${ubuntuBold.className} inline-flex items-baseline tracking-[-0.02em] ${className ?? ''}`.trim()} data-testid="fiscal-logo">
      <span className="sr-only">{BRAND_NAME}</span>
      <span aria-hidden className="inline-flex items-baseline">
        Fiscal
        <span className="ml-[0.08em] inline-block size-[0.3em] rounded-full bg-[linear-gradient(135deg,#9D8CFA,#7FDDB4)]" />
      </span>
    </span>
  );
}
