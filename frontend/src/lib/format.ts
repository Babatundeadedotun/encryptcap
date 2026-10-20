/** Display formatters, ported from the prototype so figures read identically. */

export const money = (n: number, cur = '$'): string =>
  cur + Math.round(n || 0).toLocaleString('en-US');

/** Compact form for axis labels: $12.3k, $500. */
export const moneyK = (n: number, cur = '$'): string =>
  Math.abs(n) >= 1000
    ? cur + (n / 1000).toFixed(Math.abs(n) % 1000 === 0 ? 0 : 1) + 'k'
    : cur + Math.round(n);

/** Ratio to percentage: 0.125 -> "12.5%". */
export const pct = (n: number, d = 1): string =>
  (n * 100).toFixed(Number.isInteger(n * 100) ? 0 : d) + '%';

/** Always-signed money, using a true minus sign rather than a hyphen. */
export const signed = (n: number, cur = '$'): string =>
  (n >= 0 ? '+' : '−') + money(Math.abs(n), cur);

export const initials = (name: string): string =>
  name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** Strips thousands separators from a typed amount. */
export const parseAmount = (raw: string): number => Number(raw.replace(/[^0-9.-]/g, ''));

export const formatAmountInput = (n: number): string =>
  Number.isFinite(n) ? n.toLocaleString('en-US') : '';

export const fileSize = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
