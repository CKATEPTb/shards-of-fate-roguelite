import { useEffect, useMemo, useRef, useState } from 'react';
import type { VictoryChance } from '@shards/game-core';
import { partyBodies } from '@shards/game-core';
import type { DifficultyId, HeroBody, WorldActor } from '@shards/shared';

interface Request { key: string; characterIds: string[]; enemyIds: string[]; heroBodies?: Record<string, HeroBody>; difficultyId: DifficultyId; roomDice?: boolean }
interface CoopPreview { heroRosters: string[][]; inspectedIndex?: number }
const cache = new Map<string, VictoryChance>();
export const victoryChanceKey = (characterIds: string[], enemyIds: string[], heroBodies?: Record<string, HeroBody>, difficultyId: DifficultyId = 'normal', roomDice = false) => JSON.stringify(roomDice ? [characterIds, enemyIds, heroBodies, difficultyId, 'room'] : [characterIds, enemyIds, heroBodies, difficultyId]);

/** Preview trials use independent seeds and never advance the room's live dice counter. */
export function useVictoryChance(characterIds: string[], enemyRosters: string[][], inspectedEnemyIds?: string[], heroes?: readonly WorldActor[], difficultyId: DifficultyId = 'normal', cooperative?: CoopPreview) {
  const worker = useRef<Worker | null>(null);
  const busy = useRef<string | null>(null);
  const [revision, setRevision] = useState(0);
  const failed = useRef(new Set<string>());
  const heroBodies = heroes ? partyBodies(heroes) : undefined;
  const bodyKey = JSON.stringify(heroBodies);
  const rostersKey = JSON.stringify(enemyRosters);
  const heroesKey = characterIds.join(',');
  const coopKey = JSON.stringify(cooperative?.heroRosters);
  const requests = useMemo(() => enemyRosters.map((enemyIds, index): Request => {
    const ids = cooperative?.heroRosters[index] ?? characterIds;
    const bodies = cooperative && heroBodies ? Object.fromEntries(ids.filter(id => heroBodies[id]).map(id => [id, heroBodies[id]])) : heroBodies;
    return { key: victoryChanceKey(ids, enemyIds, bodies, difficultyId, !!cooperative), characterIds: ids, enemyIds, heroBodies: bodies, difficultyId, roomDice: !!cooperative };
  }), [heroesKey, rostersKey, bodyKey, difficultyId, coopKey]);
  const inspectedKey = JSON.stringify(inspectedEnemyIds);

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
    instance.onerror = event => { event.preventDefault(); instance.terminate(); worker.current = null; busy.current = null; };
    return () => { instance.terminate(); worker.current = null; busy.current = null; };
  }, []);

  useEffect(() => {
    const selected = cooperative ? requests[cooperative.inspectedIndex ?? -1]
      : inspectedEnemyIds ? { key: victoryChanceKey(characterIds, inspectedEnemyIds, heroBodies, difficultyId), characterIds, enemyIds: inspectedEnemyIds, heroBodies, difficultyId } : undefined;
    const next = (selected ? [selected, ...requests] : requests).find(request => request.characterIds.length && request.enemyIds.length
      && !cache.has(request.key) && request.key !== busy.current && !failed.current.has(request.key));
    if (worker.current && !busy.current && next) { busy.current = next.key; worker.current.postMessage(next); }
  }, [requests, cooperative?.inspectedIndex, inspectedKey, revision]);

  const results = useMemo(() => requests.map(request => cache.get(request.key)), [requests, revision]);
  return { results };
}
