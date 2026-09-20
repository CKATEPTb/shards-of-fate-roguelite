export function fail(path: string, reason: string): never { throw new Error(`Invalid snapshot at ${path}: ${reason}`); }
export function record(value: unknown, path: string, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'expected an object');
  const result = value as Record<string, unknown>;
  const unknown = Object.keys(result).find(key => !keys.includes(key));
  if (unknown) fail(`${path}.${unknown}`, 'unknown field');
  return result;
}
export function integer(value: unknown, path: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) fail(path, `expected an integer in [${min}, ${max}]`);
  return value;
}
export function finite(value: unknown, path: string, min = -Number.MAX_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(path, 'expected a finite number in range');
  return value;
}
export function string(value: unknown, path: string, max = 256): string {
  if (typeof value !== 'string' || !value.length || value.length > max) fail(path, `expected a nonempty string of at most ${max} characters`);
  return value;
}
export function array(value: unknown, path: string, max = 100_000): unknown[] {
  if (!Array.isArray(value) || value.length > max) fail(path, 'expected an array within the size limit');
  return value;
}
export function oneOf<T extends string>(value: unknown, options: readonly T[], path: string): T {
  if (typeof value !== 'string' || !options.includes(value as T)) fail(path, 'unknown value');
  return value as T;
}
export function same(value: unknown, expected: unknown, path: string): void { if (value !== expected) fail(path, 'does not match current content or state'); }
