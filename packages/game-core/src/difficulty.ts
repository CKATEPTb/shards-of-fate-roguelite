import { DIFFICULTY_IDS, type DifficultyId, type DifficultyProfile, type GameContent } from '@shards/shared';

/** Minimal content fixtures retain normal play without importing game-data into the engine. */
const NORMAL: DifficultyProfile = { id: 'normal', name: 'Обычная', description: 'Стандартная сложность', enemyHpMultiplier: 1, enemyDamageMultiplier: 1, epicGroupChance: 0.26, minibossChunkChance: 0.08, rareLootMultiplier: 1 };

export function restoreDifficultyId(value: unknown = 'normal'): DifficultyId {
  if (typeof value !== 'string' || !DIFFICULTY_IDS.includes(value as DifficultyId)) throw new Error('Unknown difficulty');
  return value as DifficultyId;
}

export function getDifficultyProfile(content: GameContent, difficultyId: DifficultyId = 'normal'): DifficultyProfile {
  const id = restoreDifficultyId(difficultyId);
  const profile = content.difficulties?.[id] ?? (id === 'normal' ? NORMAL : undefined);
  if (!profile || profile.id !== id) throw new Error(`Missing difficulty profile: ${id}`);
  return profile;
}
