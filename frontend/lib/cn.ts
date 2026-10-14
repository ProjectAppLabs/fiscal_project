/** Joins class names, skipping the falsy ones: cn('a', isActive && 'b'). */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
