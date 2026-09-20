export const DIFFICULTY_IDS = ['normal', 'hard', 'nightmare'] as const;
export type DifficultyId = typeof DIFFICULTY_IDS[number];

export interface DifficultyProfile {
  id: DifficultyId;
  name: string;
  description: string;
  enemyHpMultiplier: number;
  enemyDamageMultiplier: number;
  epicGroupChance: number;
  minibossChunkChance: number;
  /** Reserved for future loot generation; no rewards are created by this value yet. */
  rareLootMultiplier: number;
}
