import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * The «cotton» button: always a pill, pressed it shrinks a little (scale .97) with a sunk shadow.
 * primary · secondary · soft · ghost · danger; sm 36 · md 44 · lg 52.
 */
export function Button({ variant = 'secondary', size = 'md', loading = false, loadingLabel, icon, className, children, disabled, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, className })}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}

export function ButtonLink({ href, variant = 'secondary', size = 'md', icon, className, children }: ButtonLinkProps) {
  return (
    <Link className={buttonClass({ variant, size, className })} href={href}>
      {icon}
      {children}
    </Link>
  );
}

export function buttonClass({ variant = 'secondary', size = 'md', className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string }) {
  return cn(
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition duration-200 ease-soft',
    'active:scale-[0.97] disabled:pointer-events-none disabled:bg-surface-sunk disabled:bg-none disabled:text-ink-3 disabled:shadow-none',
    'focus-visible:shadow-[0_0_0_4px_rgb(157_140_250/0.35)]',
    SIZES[size],
    VARIANTS[variant],
    className,
  );
}

function Spinner() {
  return <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />;
}

const SIZES = {
  sm: 'h-9 px-4 text-[13px]',
  md: 'h-11 px-5 text-sm',
  lg: 'h-13 px-6 text-[15px]',
  icon: 'size-11 p-0',
} as const;

const VARIANTS = {
  primary:
    'bg-[linear-gradient(180deg,color-mix(in_oklab,var(--primary),white_10%),var(--primary))] text-primary-ink shadow-primary hover:brightness-105 active:shadow-sunk',
  secondary: 'bg-surface text-ink shadow-rest hover:shadow-float hover:-translate-y-px active:translate-y-0 active:shadow-sunk',
  soft: 'bg-primary-soft text-primary-text hover:brightness-[0.97] active:shadow-sunk',
  ghost: 'bg-transparent text-ink-2 hover:bg-surface-sunk active:shadow-sunk',
  danger:
    'bg-[linear-gradient(180deg,color-mix(in_oklab,var(--danger),white_10%),var(--danger))] text-white dark:text-[#15131F] shadow-danger hover:brightness-105 active:shadow-sunk',
} as const;

type ButtonVariant = keyof typeof VARIANTS;
type ButtonSize = keyof typeof SIZES;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** What the button says while loading («Guardando…»). */
  loadingLabel?: ReactNode;
  icon?: ReactNode;
}

interface ButtonLinkProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}
