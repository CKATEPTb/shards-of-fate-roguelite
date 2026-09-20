import { useEffect, useMemo, useRef, useState } from 'react';
import type { VictoryChance } from '@shards/game-core';
import { partyBodies } from '@shards/game-core';
import type { DifficultyId, HeroBody, WorldActor } from '@shards/shared';

interface Request { key: string; characterIds: string[]; enemyIds: string[]; heroBodies?: Record<string, HeroBody>; difficultyId: DifficultyId }
const cache = new Map<string, VictoryChance>();
export const victoryChanceKey = (characterIds: string[], enemyIds: string[], heroBodies?: Record<string, HeroBody>, difficultyId: DifficultyId = 'normal') => JSON.stringify([characterIds, enemyIds, heroBodies, difficultyId]);

/** One background job at a time; stale work is never displayed for another roster. */
export function useVictoryChance(characterIds: string[], enemyRosters: string[][], inspectedEnemyIds?: string[], heroes?: readonly WorldActor[], difficultyId: DifficultyId = 'normal') {
  const worker = useRef<Worker | null>(null);
  const busy = useRef<string | null>(null);
  const [revision, setRevision] = useState(0);
  const failed = useRef(new Set<string>());
  const heroBodies = heroes ? partyBodies(heroes) : undefined;
  const bodyKey = JSON.stringify(heroBodies);
  const selectedKey = inspectedEnemyIds ? victoryChanceKey(characterIds, inspectedEnemyIds, heroBodies, difficultyId) : null;
  const rostersKey = JSON.stringify(enemyRosters);
  const heroesKey = characterIds.join(',');

  useEffect(() => {
    let instance: Worker;
    try { instance = new Worker(new URL('../world/victory-worker.ts', import.meta.url), { type: 'module' }); }
    catch { return; }
    worker.current = instance;
    instance.onmessage = (event: MessageEvent<{ key: string; result?: VictoryChance; error?: boolean }>) => {
      busy.current = null;
      if (event.data.result) {
        if (cache.size >= 256) cache.delete(cache.keys().next().value!);
        cache.set(event.data.key, event.data.result);
      } else {
        if (failed.current.size >= 256) failed.current.delete(failed.current.values().next().value!);
        failed.current.add(event.data.key);
      }
      setRevision(value => value + 1);
    };
    instance.onerror = event => {
      event.preventDefault(); instance.terminate(); worker.current = null; busy.current = null;
    };
    return () => { instance.terminate(); worker.current = null; busy.current = null; };
  }, []);

  useEffect(() => {
    const ordered = inspectedEnemyIds ? [inspectedEnemyIds, ...enemyRosters] : enemyRosters;
    const unique = new Map<string, Request>();
    for (const enemyIds of ordered) {
      const key = victoryChanceKey(characterIds, enemyIds, heroBodies, difficultyId);
      if (enemyIds.length && !cache.has(key) && key !== busy.current && !failed.current.has(key)) unique.set(key, { key, characterIds, enemyIds, heroBodies, difficultyId });
    }
    const next = unique.values().next().value;
    if (worker.current && !busy.current && next) {
      busy.current = next.key;
      worker.current.postMessage(next);
    }
  }, [heroesKey, rostersKey, selectedKey, bodyKey, difficultyId, revision]);

  const results = useMemo(() => enemyRosters.map(enemyIds => cache.get(victoryChanceKey(characterIds, enemyIds, heroBodies, difficultyId))),
    [heroesKey, rostersKey, bodyKey, difficultyId, revision]);
  return { results };
}
