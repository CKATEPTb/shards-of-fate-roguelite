import type { DifficultyId, DifficultyProfile } from '@shards/shared';

export const DIFFICULTY_PROFILES: Record<DifficultyId, DifficultyProfile> = {
  normal: { id: 'normal', name: 'Легкая', description: 'Стандартная сила врагов и частота опасных встреч.', enemyHpMultiplier: 1.28, enemyDamageMultiplier: 1.14, epicGroupChance: 0.26, minibossChunkChance: 0.08, rareLootMultiplier: 1 },
  hard: { id: 'hard', name: 'Нормальная', description: 'Враги крепче, наносят больше урона; опасные группы встречаются чаще.', enemyHpMultiplier: 1.36, enemyDamageMultiplier: 1.23, epicGroupChance: 0.36, minibossChunkChance: 0.12, rareLootMultiplier: 1.25 },
  nightmare: { id: 'nightmare', name: 'Сложная', description: 'Самые стойкие и опасные враги, больше эпических групп и мини-боссов.', enemyHpMultiplier: 1.55, enemyDamageMultiplier: 1.29, epicGroupChance: 0.46, minibossChunkChance: 0.18, rareLootMultiplier: 1.5 },
};
