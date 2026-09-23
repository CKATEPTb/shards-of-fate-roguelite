import type { GridPoint, WorldChunk } from '@shards/shared';
import { distance, isWalkable, samePoint, tileIndex } from '../world/grid';
import type { MovementActor } from '../world/movement-speed';
import { findPath } from '../world/pathfinding';

export const COOP_BATTLE_JOIN_STEPS = 10;

const reachCache = new WeakMap<WorldChunk, Map<string, boolean>>();

/** Count tiles in the same terrain-aware path that movement would actually use. */
export function withinCoopBattleReach(chunk: WorldChunk, from: GridPoint, to: GridPoint, actor?: MovementActor): boolean {
  if (distance(from, to) > COOP_BATTLE_JOIN_STEPS || !isWalkable(chunk, from) || !isWalkable(chunk, to)) return false;
  // findPath also returns [] for an unreachable destination; coincident tiles
  // must therefore be handled before interpreting an empty result.
  if (samePoint(from, to)) return true;
  let cached = reachCache.get(chunk);
  if (!cached) { cached = new Map(); reachCache.set(chunk, cached); }
  // Terrain penalties currently distinguish heroes from roaming enemies only.
  // Directions stay distinct because entering terrain has a destination cost.
  const key = `${actor?.definitionId === undefined ? 'hero' : 'mob'}:${tileIndex(from, chunk.size)}:${tileIndex(to, chunk.size)}`;
  const previous = cached.get(key);
  if (previous !== undefined) return previous;
  const path = findPath(chunk, from, to, actor);
  const reachable = path.length > 0 && path.length <= COOP_BATTLE_JOIN_STEPS;
  if (cached.size >= 4096) cached.clear();
  cached.set(key, reachable);
  return reachable;
}
