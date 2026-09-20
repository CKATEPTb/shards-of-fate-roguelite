import { estimateVictoryChance } from '@shards/game-core';
import { gameContent } from '@shards/game-data';
import type { DifficultyId, HeroBody } from '@shards/shared';

self.onmessage = (event: MessageEvent<{ key: string; characterIds: string[]; enemyIds: string[]; heroBodies?: Record<string, HeroBody>; difficultyId?: DifficultyId }>) => {
  const { key, characterIds, enemyIds, heroBodies, difficultyId } = event.data;
  try {
    const result = estimateVictoryChance({ seed: 'preview:v1', encounterId: 'roaming', characterIds, enemyIds, heroBodies, difficultyId }, gameContent, 64);
    self.postMessage({ key, result });
  } catch {
    self.postMessage({ key, error: true });
  }
};
