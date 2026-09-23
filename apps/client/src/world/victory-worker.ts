import { estimateVictoryChance } from '@shards/game-core';
import { gameContent } from '@shards/game-data';
import type { DifficultyId, HeroBody } from '@shards/shared';

self.onmessage = (event: MessageEvent<{ key: string; characterIds: string[]; enemyIds: string[]; heroBodies?: Record<string, HeroBody>; difficultyId?: DifficultyId; roomDice?: boolean }>) => {
  const { key, characterIds, enemyIds, heroBodies, difficultyId, roomDice } = event.data;
  try {
    const result = estimateVictoryChance({ seed: 'preview:v1', encounterId: 'roaming', characterIds, enemyIds, heroBodies, difficultyId }, gameContent, 64, roomDice);
    self.postMessage({ key, result });
  } catch {
    self.postMessage({ key, error: true });
  }
};
