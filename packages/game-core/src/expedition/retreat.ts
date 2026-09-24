import type { GridPoint, WorldActor, WorldChunk } from '@shards/shared';
import { isWalkable, neighbors, pointAt, tileIndex } from '../world/grid';
import { COOP_BATTLE_JOIN_STEPS, withinCoopBattleReach } from '../coop/battle-reach';

/**
 * Retreat onto open ground connected to a real chunk exit. Unlike ordinary
 * movement, retreat may cross to another component: the destination must let
 * the hero leave the chunk, even if combat started in a disconnected pocket.
 * Gates are endpoints only, exactly as in findPath; a basement's stairs are
 * its exit. This selection never consumes gameplay dice.
 */
export function retreatPosition(chunk: WorldChunk, actor: WorldActor, participants: readonly GridPoint[], occupied: readonly GridPoint[] = []): GridPoint {
  const gates = new Set(chunk.exits.map(exit => tileIndex(exit.position, chunk.size)));
  const blocked = new Set(occupied.map(point => tileIndex(point, chunk.size)));
  const departures = chunk.layer === 'basement'
    ? chunk.pois.filter(poi => poi.kind === 'stairs-up' && poi.destination).map(poi => poi.position)
    : chunk.exits.map(exit => exit.position);
  function distances(starts: readonly GridPoint[]): Int32Array {
    const result = new Int32Array(chunk.tiles.length).fill(-1);
    const queue: number[] = [];
    for (const point of starts) if (isWalkable(chunk, point)) {
      const index = tileIndex(point, chunk.size);
      if (result[index] < 0) { result[index] = 0; queue.push(index); }
    }
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor];
      for (const next of neighbors(pointAt(index, chunk.size), chunk.size)) {
        const target = tileIndex(next, chunk.size);
        if (result[target] >= 0 || !chunk.tiles[target].walkable || gates.has(target)) continue;
        result[target] = result[index] + 1;
        queue.push(target);
      }
    }
    return result;
  }
  const exitDistance = distances(departures);
  const threat = distances(participants);
  const candidates: number[] = [];
  for (let index = 0; index < exitDistance.length; index++) {
    const tile = chunk.tiles[index];
    if (exitDistance[index] < 0 || gates.has(index) || blocked.has(index)
      || !tile.walkable || tile.terrain === 'bush' || tile.terrain === 'tree' || tile.terrain === 'water') continue;
    candidates.push(index);
  }
  // The shortest unweighted route is a lower bound for the terrain-aware
  // pathfinder. Rank it first; stable exit distance / tile index break ties.
  const safety = (index: number) => threat[index] < 0 ? chunk.tiles.length : threat[index];
  candidates.sort((a, b) => safety(b) - safety(a) || exitDistance[a] - exitDistance[b] || a - b);
  const safe = candidates.find(index => threat[index] < 0 || threat[index] > COOP_BATTLE_JOIN_STEPS
    || participants.every(point => !withinCoopBattleReach(chunk, pointAt(index, chunk.size), point, actor)));
  // Exceptionally small rooms can have no point beyond the recruitment radius.
  // Co-op recruitment excludes heroes who escaped that same running battle;
  // still choose an exit-connected tile rather than strand them or use a gate.
  const chosen = safe ?? candidates[0];
  if (chosen === undefined) throw new Error(`No exit-connected retreat position in ${chunk.id}`);
  return pointAt(chosen, chunk.size);
}
