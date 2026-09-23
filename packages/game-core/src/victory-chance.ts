import type { CombatOptions, GameContent } from '@shards/shared';
import { runCombat } from './combat';
import { createCombat } from './create';
import { createCombatEntityRng, createRng, hashString } from './random';
import { simulationPolicy } from './simulation-policy';

export interface VictoryChance { percent: number; wins: number; samples: number; draws: number }

/** Offline balance analysis with an explicit decision policy. Not a prediction of player choices. */
export function estimateVictoryChance(options: CombatOptions, content: GameContent, samples = 64, roomDice = false): VictoryChance {
  if (!Number.isSafeInteger(samples) || samples < 1 || samples > 4096) throw new Error('Victory chance requires 1–4096 samples');
  // Build and validate the roster/hash once. runCombat clones it and retains only one trial's log.
  const baseline = createCombat(options, content);
  const owners = Object.fromEntries(baseline.units.map(unit => [unit.id,
    unit.team === 'heroes' ? `hero:${unit.definitionId}` : `enemy:preview:${unit.id}`]));
  const prefix = `estimate:${hashString(options.seed).toString(16)}`;
  let wins = 0;
  let draws = 0;
  for (let index = 0; index < samples; index++) {
    baseline.seed = `${prefix}:${index}`;
    // Preview enemies have identities local to this roster. Every trial owns a
    // fresh counter bank, so estimation never consumes the live room's dice.
    baseline.rng = roomDice ? createCombatEntityRng(baseline.seed, owners,
      Object.fromEntries(Object.values(owners).map(owner => [owner, 0]))) : createRng(baseline.seed);
    const result = runCombat(baseline, content, simulationPolicy);
    if (result.status === 'victory') wins++;
    else if (result.status === 'draw') draws++;
  }
  const percent = wins === 0 ? 0 : wins === samples ? 100 : Math.max(1, Math.min(99, Math.round(wins * 100 / samples)));
  return { percent, wins, samples, draws };
}
