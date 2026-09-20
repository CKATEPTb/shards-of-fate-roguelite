import type { ExplorationState, GridPoint, MovementState, WorldActor } from '@shards/shared';
import { canonicalJson } from '../canonical';
import { generateChunk } from './chunk';
import { generateWorld } from './graph';
import { distance, inBounds, isWalkable, samePoint, tileIndex } from './grid';
import { validateActorIds } from './movement';
import { chunkRegions, regionAt } from './regions';
import { campfireTileIndices } from './campfires';
import { normalizeCampfireOccupancy } from './campfire-occupancy';
import { createMovementState, movementStepMs, validateMovementBonus } from './movement-speed';
import { isBodyAlive, restoreHeroBody } from '../anatomy';

interface ExplorationSnapshot {
  version: 3; generatorVersion: 3; seed: string; currentChunkId: string; actors: WorldActor[]; visited: string[]; tick: number; transitions: number;
  structureVersion: 1 | 2;
}

function record(value: unknown, keys: string[], label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  const object = value as Record<string, unknown>;
  if (Object.keys(object).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(object, key))) throw new Error(`Invalid ${label} fields`);
  return object;
}

function point(value: unknown): GridPoint {
  const object = record(value, ['x', 'y'], 'position');
  if (!Number.isInteger(object.x) || !Number.isInteger(object.y)) throw new Error('Invalid tile position');
  return { x: object.x as number, y: object.y as number };
}

function movementState(value: unknown): MovementState {
  const hasBootsBonus = value !== null && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'bootsBonusPercent');
  const object = record(value, ['baseSpeed', 'bonusPercent', 'elapsedMs', ...(hasBootsBonus ? ['bootsBonusPercent'] : [])], 'movement');
  if (typeof object.baseSpeed !== 'number' || typeof object.bonusPercent !== 'number' || typeof object.elapsedMs !== 'number') throw new Error('Invalid movement values');
  const movement: MovementState = { ...createMovementState(object.baseSpeed), bonusPercent: object.bonusPercent, elapsedMs: object.elapsedMs };
  validateMovementBonus(movement.bonusPercent);
  if (hasBootsBonus) {
    if (typeof object.bootsBonusPercent !== 'number') throw new Error('Invalid boots movement bonus');
    validateMovementBonus(object.bootsBonusPercent);
    movement.bootsBonusPercent = object.bootsBonusPercent;
  }
  if (!Number.isFinite(movement.elapsedMs) || movement.elapsedMs < 0) throw new Error('Invalid movement values');
  return movement;
}

/** Geometry is regenerated, never accepted from the save. Saves remain compact and auditable. */
export function serializeExploration(state: ExplorationState): string {
  const snapshot: ExplorationSnapshot = {
    version: 3, generatorVersion: state.graph.generatorVersion, structureVersion: state.graph.structureVersion ?? 1,
    seed: state.graph.seed, currentChunkId: state.currentChunkId,
    actors: state.actors, visited: state.visited, tick: state.tick, transitions: state.transitions,
  };
  return canonicalJson(snapshot);
}

export function deserializeExploration(json: string): ExplorationState {
  if (typeof json !== 'string' || json.length > 1_000_000) throw new Error('Exploration save is too large');
  const parsed = JSON.parse(json) as unknown;
  if (parsed !== null && typeof parsed === 'object' && 'version' in parsed && parsed.version !== 3) throw new Error('Эта карта создана старым генератором. Начните новый мир.');
  const hasStructureVersion = parsed !== null && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'structureVersion');
  const fields = ['version', 'generatorVersion', 'seed', 'currentChunkId', 'actors', 'visited', 'tick', 'transitions'];
  const data = record(parsed, hasStructureVersion ? [...fields, 'structureVersion'] : fields, 'exploration save');
  if (data.version !== 3 || data.generatorVersion !== 3 || typeof data.seed !== 'string' || typeof data.currentChunkId !== 'string') throw new Error('Unsupported exploration generator version');
  const structureVersion = hasStructureVersion ? data.structureVersion : 1;
  if (structureVersion !== 1 && structureVersion !== 2) throw new Error('Unsupported structure generator version');
  if (!Number.isSafeInteger(data.tick) || (data.tick as number) < 0 || !Number.isSafeInteger(data.transitions) || (data.transitions as number) < 0 || (data.transitions as number) > (data.tick as number)) throw new Error('Invalid exploration counters');
  if (!Array.isArray(data.actors) || data.actors.length < 1 || data.actors.length > 4) throw new Error('Invalid saved party');
  const actors: WorldActor[] = data.actors.map(value => {
    const hasMovement = value !== null && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'movement');
    const hasBody = value !== null && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'body');
    const actor = record(value, ['id', 'position', 'path', ...(hasMovement ? ['movement'] : []), ...(hasBody ? ['body'] : [])], 'actor');
    if (typeof actor.id !== 'string' || !Array.isArray(actor.path) || actor.path.length > 1225) throw new Error('Invalid saved actor');
    return { id: actor.id, position: point(actor.position), path: actor.path.map(point), ...(hasMovement ? { movement: movementState(actor.movement) } : {}), ...(hasBody ? { body: restoreHeroBody(actor.body) } : {}) };
  });
  validateActorIds(actors.map(actor => actor.id));
  const graph = generateWorld(data.seed, { structureVersion });
  const chunk = generateChunk(graph, data.currentChunkId);
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  if (!Array.isArray(data.visited) || !data.visited.length || data.visited.length > graph.nodes.length || data.visited.some(id => typeof id !== 'string' || !nodes.has(id)) || new Set(data.visited).size !== data.visited.length || data.visited[0] !== graph.startId || !data.visited.includes(chunk.id) || data.visited.length > (data.transitions as number) + 1) throw new Error('Invalid visited maps');
  const visited = data.visited as string[];
  const discovered = new Set([graph.startId]);
  for (const id of visited.slice(1)) {
    const node = nodes.get(id)!;
    if (!Object.values(node.exits).some(neighbor => discovered.has(neighbor))) throw new Error('Disconnected visited maps');
    discovered.add(id);
  }
  // Version-three saves predate solid campfires. Validate their original paths
  // strictly, relaxing only those fire cells; then migrate to the current geometry.
  const fires = campfireTileIndices(chunk);
  const validationChunk = fires.size ? { ...chunk, tiles: chunk.tiles.map((tile, index) => fires.has(index) ? { ...tile, walkable: true } : tile) } : chunk;
  const regions = chunkRegions(validationChunk);
  const partyRegion = regionAt(validationChunk, regions, actors[0].position);
  for (const actor of actors) {
    if (actor.body && !isBodyAlive(actor.body) && (actor.path.length || actor.movement?.elapsedMs)) throw new Error('A fallen hero cannot move');
    if (!inBounds(actor.position, chunk.size) || !isWalkable(validationChunk, actor.position) || chunk.exits.some(exit => samePoint(exit.position, actor.position))) throw new Error('Invalid actor position');
    if (regionAt(validationChunk, regions, actor.position) !== partyRegion) throw new Error('The party occupies different disconnected regions');
    let previous = actor.position;
    const seen = new Set([tileIndex(previous, chunk.size)]);
    actor.path.forEach((next, index) => {
      if (!isWalkable(validationChunk, next) || distance(previous, next) !== 1 || seen.has(tileIndex(next, chunk.size))) throw new Error('Invalid movement path');
      if (index < actor.path.length - 1 && chunk.exits.some(exit => samePoint(exit.position, next))) throw new Error('Movement path continues beyond a gate');
      seen.add(tileIndex(next, chunk.size)); previous = next;
    });
    const nextTerrain = actor.path[0] ? chunk.tiles[tileIndex(actor.path[0], chunk.size)].terrain : undefined;
    if (actor.movement && actor.movement.elapsedMs >= movementStepMs(actor, nextTerrain)) throw new Error('Invalid movement values');
  }
  return normalizeCampfireOccupancy({ version: 1, graph, chunk, currentChunkId: chunk.id, actors, visited, tick: data.tick as number, transitions: data.transitions as number });
}
