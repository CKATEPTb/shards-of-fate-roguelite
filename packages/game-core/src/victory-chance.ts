import type { CombatOptions, GameContent } from '@shards/shared';
import { runCombat } from './combat';
import { createCombat } from './create';
import { createRng, hashString } from './random';

export interface VictoryChance { percent: number; wins: number; samples: number; draws: number }

/** Sample real combat rules with independent seeds, never the actual encounter seed. */
export function estimateVictoryChance(options: CombatOptions, content: GameContent, samples = 64): VictoryChance {
  if (!Number.isSafeInteger(samples) || samples < 1 || samples > 4096) throw new Error('Victory chance requires 1–4096 samples');
  // Build and validate the roster/hash once. runCombat clones it and retains only one trial's log.
  const baseline = createCombat(options, content);
  const prefix = `estimate:${hashString(options.seed).toString(16)}`;
  let wins = 0;
  let draws = 0;
  for (let index = 0; index < samples; index++) {
    baseline.seed = `${prefix}:${index}`;
    baseline.rng = createRng(baseline.seed);
    const result = runCombat(baseline, content);
    if (result.status === 'victory') wins++;
    else if (result.status === 'draw') draws++;
  }
  const percent = wins === 0 ? 0 : wins === samples ? 100 : Math.max(1, Math.min(99, Math.round(wins * 100 / samples)));
  return { percent, wins, samples, draws };
}
