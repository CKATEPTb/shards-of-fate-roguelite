import { REWARD_RARITIES, type RewardLuckRoll, type RewardRarity, type RngState } from '@shards/shared';
import { drawDie } from './dice';
import { createEntityRng } from './random';

/** Continue the same hero counter used by encounters; one item may consume up to three dice. */
export function rollHeroRewardRarity(seed: string, characterId: string, diceIndex: number, base: RewardRarity, luck: number) {
  return rollRewardRarity(base, luck, createEntityRng(seed, `hero:${characterId}`, diceIndex));
}

/** Pure award calculation: caller commits the returned personal RNG with the awarded item. */
export function rollRewardRarity(base: RewardRarity, luck: number, rng: RngState): {
  rarity: RewardRarity; rolls: RewardLuckRoll[]; rng: RngState;
} {
  let index = REWARD_RARITIES.indexOf(base);
  if (index < 0 || !Number.isSafeInteger(luck)) throw new Error('Invalid reward rarity or luck');
  if (rng.entityDice) throw new Error('Reward luck requires the receiving hero’s personal RNG');
  const updated = structuredClone(rng);
  const rolls: RewardLuckRoll[] = [];
  const threshold = 20 - luck;
  while (index < REWARD_RARITIES.length - 1) {
    const diceIndex = updated.diceIndex;
    const result = drawDie(20, updated, 'LOOT');
    const upgraded = result >= threshold;
    const from = REWARD_RARITIES[index];
    if (upgraded) index++;
    rolls.push({ expression: '1d20', result, threshold, from, to: REWARD_RARITIES[index], upgraded,
      ...(diceIndex === undefined ? {} : { diceIndex }) });
    if (!upgraded) break;
  }
  return { rarity: REWARD_RARITIES[index], rolls, rng: updated };
}
