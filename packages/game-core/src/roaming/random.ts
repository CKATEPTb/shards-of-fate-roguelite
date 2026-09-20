import { createRng, drawRandom, hashString } from '../random';

export function roamingRandom(seed: string, domain: string): () => number {
  const rng = createRng(`roaming-v1:${hashString(seed)}:${domain}`);
  return () => drawRandom(rng, 'ENCOUNTER');
}

export function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
