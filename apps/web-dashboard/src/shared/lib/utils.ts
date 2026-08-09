import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Trim and default to https:// when the user typed a bare host. */
export function normalizeUrl(url: string): string {
  const t = url.trim();
  return t.startsWith('http') ? t : `https://${t}`;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
