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
export function hashValue(value: unknown): string { return hashString(canonicalJson(value)).toString(16).padStart(8, '0'); }
