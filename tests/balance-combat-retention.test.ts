import { expect, it } from 'vitest';
import { createCombat, runCombat } from '@shards/game-core';
import { gameContent } from '@shards/game-data';
import { simulationPolicy } from '../packages/game-core/src/simulation-policy';

it('accelerated battle retention preserves every outcome, wound and entity dice counter', () => {
  const content = Object.freeze({ ...gameContent, equipmentCatalog: undefined });
  const initial = createCombat({ seed: 'retention-equivalence', characterIds: ['guardian', 'priest', 'ranger'],
    encounterId: 'retention', enemyIds: gameContent.enemies.filter(enemy => enemy.tags.includes('BOSS')).slice(0, 1).map(enemy => enemy.id) }, content);
  const full = runCombat(initial, content, simulationPolicy);
  const compact = runCombat(initial, content, simulationPolicy, { eventHistoryLimit: 128 });
  expect({ ...compact, events: [] }).toEqual({ ...full, events: [] });
  expect(compact.events).toEqual(full.events.slice(-compact.events.length));
  expect(compact.events.length).toBeLessThan(full.events.length);
  expect(initial.status).toBe('ready');
});
