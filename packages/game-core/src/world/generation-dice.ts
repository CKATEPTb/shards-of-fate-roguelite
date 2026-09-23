import type { RngState } from '@shards/shared';
import { drawRandom } from '../random';

/** Generation uses private WORLD streams and never consumes a hero's combat dice. */
export function worldDie(rng: RngState, sides: number): number {
  if (!Number.isSafeInteger(sides) || sides < 1) throw new Error('Invalid generation die');
  return 1 + Math.floor(drawRandom(rng, 'WORLD') * sides);
}
