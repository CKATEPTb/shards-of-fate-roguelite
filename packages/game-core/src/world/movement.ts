import type { ExplorationState, GridPoint, WorldActor, WorldChunk } from '@shards/shared';
import { generateChunk } from './chunk';
import { generateWorld } from './graph';
import { DELTAS, distance, inBounds, isWalkable, samePoint, tileIndex } from './grid';
import { findPath } from './pathfinding';
import { normalizeCampfireOccupancy } from './campfire-occupancy';
import { BASE_MOVEMENT_STEP_MS, createMovementState, movementStepMs } from './movement-speed';
import { placePartyAtCampfire, placePartyAtEntrance } from './party-placement';
import { bodyMovementMultiplier } from '../anatomy';

export function validateActorIds(characterIds: string[]): void {
  if (!Array.isArray(characterIds) || characterIds.length < 1 || characterIds.length > 4 || new Set(characterIds).size !== characterIds.length || characterIds.some(id => typeof id !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(id))) throw new Error('Choose 1–4 distinct valid character IDs');
}

export function createExploration(options: { seed: string; characterIds: string[]; movementSpeeds?: Record<string, number>; structureVersion?: 1 | 2 | 3 }): ExplorationState {
  validateActorIds(options.characterIds);
  const graph = generateWorld(options.seed, { structureVersion: options.structureVersion });
  const chunk = generateChunk(graph, graph.startId);
  const actors = placePartyAtCampfire(chunk, options.characterIds).map(actor => {
    const speed = options.movementSpeeds?.[actor.id];
    return speed === undefined ? actor : { ...actor, movement: createMovementState(speed) };
  });
  return {
    version: 1, graph, chunk, currentChunkId: graph.startId, actors,
    visited: [graph.startId], tick: 0, transitions: 0,
  };
}

export function requestMove(state: ExplorationState, actorId: string, target: GridPoint): { state: ExplorationState; accepted: boolean; reason?: string } {
  state = normalizeCampfireOccupancy(state);
  const actor = state.actors.find(candidate => candidate.id === actorId);
  if (!actor) return { state, accepted: false, reason: 'Герой не найден.' };
  if (actor.body && bodyMovementMultiplier(actor.body) <= 0) return { state, accepted: false, reason: 'Нет действующих конечностей для передвижения.' };
  if (!inBounds(target, state.chunk.size) || !isWalkable(state.chunk, target)) return { state, accepted: false, reason: 'Сюда не пройти. Выберите свободную клетку.' };
  const path = findPath(state.chunk, actor.position, target, actor);
  if (!path.length && !samePoint(actor.position, target)) return { state, accepted: false, reason: 'Нужен другой вход. Эта область отделена: обойдите её через соседний участок.' };
  const movement = actor.movement ?? createMovementState();
  const keepProgress = path[0] && actor.path[0] && samePoint(path[0], actor.path[0]);
  return { state: { ...state, actors: state.actors.map(candidate => candidate.id === actorId
    ? { ...candidate, path, movement: keepProgress ? movement : { ...movement, elapsedMs: 0 } } : candidate) }, accepted: true };
}

export function advanceActor(actor: WorldActor, chunk: WorldChunk, elapsedMs: number): WorldActor {
  if (actor.body && bodyMovementMultiplier(actor.body) <= 0) return actor.path.length || actor.movement?.elapsedMs
    ? { ...actor, path: [], movement: { ...(actor.movement ?? createMovementState()), elapsedMs: 0 } } : actor;
  const next = actor.path[0];
  if (!next) return actor;
  const movement = actor.movement ?? createMovementState();
  if (!isWalkable(chunk, next) || distance(actor.position, next) !== 1) return { ...actor, path: [], movement: { ...movement, elapsedMs: 0 } };
  const duration = movementStepMs(actor, chunk.tiles[tileIndex(next, chunk.size)].terrain);
  // Long frame stalls cannot skip intermediate encounters or gates. Keep only the
  // fractional remainder after at most one tile and drop any excessive catch-up.
  const elapsed = movement.elapsedMs + Math.min(elapsedMs, duration);
  if (elapsed < duration) return { ...actor, movement: { ...movement, elapsedMs: elapsed } };
  const path = actor.path.slice(1);
  const nextDuration = path.length ? movementStepMs(actor, chunk.tiles[tileIndex(path[0], chunk.size)]?.terrain) : 0;
  // A slow tile can leave more time than the following fast tile takes. Keep
  // that progress bounded so a frame stall cannot skip a second encounter.
  const remainder = path.length ? Math.min(elapsed % duration, nextDuration * (1 - Number.EPSILON)) : 0;
  return { ...actor, position: next, path, movement: { ...movement, elapsedMs: remainder } };
}

/** Advance each actor's clock; the first exit transfers the complete party atomically. */
export function stepExploration(state: ExplorationState, elapsedMs = BASE_MOVEMENT_STEP_MS): ExplorationState {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error('Invalid movement elapsed time');
  state = normalizeCampfireOccupancy(state);
  if (!elapsedMs || !state.actors.some(actor => actor.path.length)) return state;
  const actors = state.actors.map(actor => advanceActor(actor, state.chunk, elapsedMs));
  const moved = actors.some((actor, index) => !samePoint(actor.position, state.actors[index].position));
  if (!moved) return { ...state, actors };
  for (const actor of actors) {
    const exit = state.chunk.exits.find(candidate => samePoint(candidate.position, actor.position));
    if (!exit) continue;
    const chunk = generateChunk(state.graph, exit.targetNodeId);
    const arrival = chunk.exits.find(candidate => candidate.id === exit.returnGateId);
    if (!arrival || arrival.returnGateId !== exit.id || arrival.targetNodeId !== state.currentChunkId) throw new Error('The destination has no reciprocal gate');
    const delta = DELTAS[exit.direction];
    const origin = { x: arrival.position.x + delta.x, y: arrival.position.y + delta.y };
    return {
      ...state, chunk, currentChunkId: chunk.id, actors: placePartyAtEntrance(chunk, actors, origin),
      visited: state.visited.includes(chunk.id) ? state.visited : [...state.visited, chunk.id], tick: state.tick + 1, transitions: state.transitions + 1,
    };
  }
  return { ...state, actors, tick: state.tick + 1 };
}
