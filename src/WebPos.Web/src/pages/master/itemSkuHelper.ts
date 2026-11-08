import type { Item } from '../../types/domain';

export const COMMON_CATEGORIES: Array<{ name: string; prefix: string }> = [
  { name: 'Mliječni proizvodi', prefix: 'MLI' },
  { name: 'Pekarski proizvodi', prefix: 'PEK' },
  { name: 'Kafa i topli napici', prefix: 'KAF' },
  { name: 'Vode i bezalkoholna pića', prefix: 'NAP' },
  { name: 'Mlinarski proizvodi', prefix: 'MLN' },
  { name: 'Ulje i osnovne namirnice', prefix: 'NAM' },
  { name: 'Sirovine i repromaterijal', prefix: 'MAT' },
  { name: 'Slatkiši i konditorski proizvodi', prefix: 'SLA' },
  { name: 'Meso i mesne prerađevine', prefix: 'MES' },
  { name: 'Voće i povrće', prefix: 'VOC' },
  { name: 'Hemija i kozmetika', prefix: 'HEM' },
];

export function getCategoryPrefix(categoryName: string): string {
  const match = COMMON_CATEGORIES.find(
    (c) => c.name.toLowerCase() === categoryName.trim().toLowerCase()
  );
  if (match) return match.prefix;
  const cleaned = categoryName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return (cleaned.slice(0, 3) || 'ART').padEnd(3, 'X');
}

export function suggestNextSku(categoryName: string, existingItems: Item[]): string {
  const prefix = getCategoryPrefix(categoryName);
  const regex = new RegExp(`^${prefix}-(\\d+)`);
  let maxSeq = 0;
  for (const it of existingItems) {
    const m = it.sku.match(regex);
    if (m && m[1]) {
      const parsed = parseInt(m[1], 10);
      if (!Number.isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  }
  const nextSeq = maxSeq + 1;
  return `${prefix}-${String(nextSeq).padStart(5, '0')}`;
}
