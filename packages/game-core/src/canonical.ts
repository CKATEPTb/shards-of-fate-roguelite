import { hashString } from './random';

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).filter(key => object[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Deterministic diagnostic checksum; deliberately not an authenticity guarantee. */
const frozenChecksums = new WeakMap<object, string>();
export function hashValue(value: unknown): string {
  const cacheable = value !== null && typeof value === 'object' && Object.isFrozen(value);
  if (cacheable) { const found = frozenChecksums.get(value); if (found) return found; }
  const hash = hashString(canonicalJson(value)).toString(16).padStart(8, '0');
  if (cacheable) frozenChecksums.set(value, hash);
  return hash;
}
