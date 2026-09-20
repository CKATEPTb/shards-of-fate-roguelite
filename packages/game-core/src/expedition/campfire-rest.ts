import type { ExpeditionState, GridPoint, WorldPoi } from '@shards/shared';
import { isBodyAlive, restBody } from '../anatomy';
import { distance, isWalkable, neighbors, samePoint } from '../world/grid';
import { findPath } from '../world/pathfinding';
import { requestMove } from '../world/movement';

export interface CampfireAvailability { position: GridPoint; canRest: boolean; reason?: string }

function campfire(state: ExpeditionState, poiId: string): WorldPoi | undefined {
  return state.world.chunk.pois.find(poi => poi.kind === 'campfire' && poi.id === poiId);
}

/** A fire stays solid. Interaction walks to a reachable adjacent tile. */
export function approachCampfire(state: ExpeditionState, actorId: string, poiId: string): { state: ExpeditionState; accepted: boolean } {
  const actor = state.world.actors.find(candidate => candidate.id === actorId);
  const fire = campfire(state, poiId);
  if (state.combat || state.failed || !actor || !fire || actor.body && !isBodyAlive(actor.body)) return { state, accepted: false };
  const candidates = neighbors(fire.position, state.world.chunk.size).filter(point => isWalkable(state.world.chunk, point))
    .map(point => ({ point, path: findPath(state.world.chunk, actor.position, point, actor) }))
    .filter(candidate => candidate.path.length || samePoint(candidate.point, actor.position))
    .sort((a, b) => a.path.length - b.path.length);
  if (!candidates.length) return { state, accepted: false };
  const result = requestMove(state.world, actorId, candidates[0].point);
  return { accepted: result.accepted, state: result.state === state.world ? state : { ...state, world: result.state } };
}

export function campfireAvailability(state: ExpeditionState, actorId: string, poiId: string): CampfireAvailability | null {
  const fire = campfire(state, poiId);
  const actor = state.world.actors.find(candidate => candidate.id === actorId);
  if (!fire || !actor || actor.path.length || distance(actor.position, fire.position) !== 1) return null;
  let reason: string | undefined;
  if (state.failed || actor.body && !isBodyAlive(actor.body)) reason = 'Погибший герой не может отдыхать.';
  else if (state.combat) reason = 'Отдых недоступен во время боя.';
  else if (state.roaming?.chunks[state.world.currentChunkId]?.some(group => group.mode === 'chase')) reason = 'Сначала оторвитесь от преследователей.';
  return { position: fire.position, canRest: !reason, ...(reason ? { reason } : {}) };
}

/** No cost, no resurrection, no regrowth, and no out-of-combat automatic recovery. */
export function restAtCampfire(state: ExpeditionState, actorId: string, poiId: string): ExpeditionState {
  if (!campfireAvailability(state, actorId, poiId)?.canRest) return state;
  const actors = state.world.actors.map(actor => actor.body ? { ...actor, body: restBody(actor.body), path: [],
    ...(actor.movement ? { movement: { ...actor.movement, elapsedMs: 0 } } : {}) } : actor);
  return { ...state, world: { ...state.world, actors } };
}
