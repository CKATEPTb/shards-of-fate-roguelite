import type { RngState } from '@shards/shared';
import { createRng, drawRandom, hashString } from '../random';
import { drawDie } from '../dice';

export function roamingRandom(seed: string, domain: string, rng?: RngState): () => number {
  const source = rng ?? createRng(`roaming-v1:${hashString(seed)}:${domain}`);
  return () => drawRandom(source, 'ENCOUNTER');
}

export function shuffled<T>(values: readonly T[], random: () => number, rng?: RngState): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = rng ? drawDie(index + 1, rng, 'ENCOUNTER') - 1 : Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
