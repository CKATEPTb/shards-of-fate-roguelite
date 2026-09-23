/** Ordered upgrade ladder; each successful luck check moves exactly one tier. */
export const REWARD_RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
export type RewardRarity = typeof REWARD_RARITIES[number];
export interface RewardPoolEntry { id: string; rarity: RewardRarity }
export interface RewardLuckRoll {
  expression: '1d20'; result: number; threshold: number;
  from: RewardRarity; to: RewardRarity; upgraded: boolean;
  /** Personal index before this die; available for indexed room RNG. */
  diceIndex?: number;
}
