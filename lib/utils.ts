import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortenAccount(account: string): string {
  if (account.length <= 12) return account;
  return `${account.slice(0, 6)}...${account.slice(-4)}`;
}

export function formatMint(mint: string | null | undefined): string {
  if (!mint || mint === '0') return '';
  return `#${mint}`;
}

export function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return 'Unknown';
  const date = new Date(Number(ts));
  if (isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildQueryString(params: Record<string, string | string[] | number | boolean | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      for (const item of v) usp.append(k, String(item));
    } else {
      usp.set(k, String(v));
    }
  }
  return usp.toString();
}
