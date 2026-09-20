import type { DifficultyId, DifficultyProfile } from '@shards/shared';

export const DIFFICULTY_PROFILES: Record<DifficultyId, DifficultyProfile> = {
  normal: { id: 'normal', name: 'Обычная', description: 'Стандартная сила врагов и частота опасных встреч.', enemyHpMultiplier: 1, enemyDamageMultiplier: 1, epicGroupChance: 0.26, minibossChunkChance: 0.08, rareLootMultiplier: 1 },
  hard: { id: 'hard', name: 'Сложная', description: 'Враги крепче, наносят больше урона; опасные группы встречаются чаще.', enemyHpMultiplier: 1.3, enemyDamageMultiplier: 1.2, epicGroupChance: 0.36, minibossChunkChance: 0.12, rareLootMultiplier: 1.25 },
  nightmare: { id: 'nightmare', name: 'Кошмар', description: 'Самые стойкие и опасные враги, больше эпических групп и мини-боссов.', enemyHpMultiplier: 1.6, enemyDamageMultiplier: 1.4, epicGroupChance: 0.46, minibossChunkChance: 0.18, rareLootMultiplier: 1.5 },
};
