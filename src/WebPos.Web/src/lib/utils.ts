import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDateBs(isoDate: string | undefined | null): string {
  if (!isoDate) return '-';
  try {
    return format(parseISO(isoDate), 'dd.MM.yyyy');
  } catch {
    return isoDate;
  }
}

export function formatDateTimeBs(isoDate: string | undefined | null): string {
  if (!isoDate) return '-';
  try {
    return format(parseISO(isoDate), 'dd.MM.yyyy HH:mm');
  } catch {
    return isoDate;
  }
}

export function generateUuidV7(): string {
  const now = Date.now();
  const timeHex = now.toString(16).padStart(12, '0');
  const randomBytes = new Uint8Array(10);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 10; i += 1) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const rHex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${timeHex.slice(0, 8)}-${timeHex.slice(8, 12)}-7${rHex.slice(0, 3)}-8${rHex.slice(3, 6)}-${rHex.slice(6, 18)}`;
}
