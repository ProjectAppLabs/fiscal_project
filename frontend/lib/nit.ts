/** The DIAN's check digit of a NIT (modulo 11 with prime weights, right to left); empty for a malformed NIT. */
export function checkDigit(nit: string): string {
  if (!/^\d{5,15}$/.test(nit)) return '';

  const total = [...nit].reverse().reduce((sum, digit, index) => sum + Number(digit) * WEIGHTS[index], 0);
  const rest = total % 11;
  return String(rest > 1 ? 11 - rest : rest);
}

const WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
