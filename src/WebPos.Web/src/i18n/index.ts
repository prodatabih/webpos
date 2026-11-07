import bs from './bs.json';

type Dictionary = typeof bs;

type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationKey = NestedKeyOf<Dictionary>;

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  return typeof current === 'string' ? current : path;
}

export function t(
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  const raw = getNestedValue(bs as unknown as Record<string, unknown>, key);
  if (!params) {
    return raw;
  }
  return Object.entries(params).reduce((acc, [paramKey, paramVal]) => {
    return acc.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
  }, raw);
}

export function useTranslation() {
  return { t };
}

export { bs };
