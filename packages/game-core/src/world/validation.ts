import type { Direction, MapValidation, WorldChunk, WorldGraph } from '@shards/shared';
import { CHUNK_SIZE, DELTAS, DIRECTIONS, inBounds, nodeId, OPPOSITE, samePoint, seasonAt, tileIndex } from './grid';
import { independentWinterRoutes } from './routes';
import { chunkRegions, regionAt } from './regions';
import { MAX_SEASON_RINGS, MAX_WORLD_NODES, MIN_SEASON_RINGS, SEASONS } from './profile';
import { validateStructures } from './structure-validation';
import { campfireTileIndices } from './campfires';
import { poiApproachCells } from './poi-access';

export function validateWorld(graph: WorldGraph): MapValidation {
  const errors: string[] = [];
  if (graph.version !== 1 || graph.generatorVersion !== 3 || typeof graph.seed !== 'string' || !graph.seed.length || graph.seed.length > 256) errors.push('Invalid world header');
  if (!graph.seasonRings || SEASONS.some(season => !Number.isInteger(graph.seasonRings[season]) || graph.seasonRings[season] < MIN_SEASON_RINGS || graph.seasonRings[season] > MAX_SEASON_RINGS)
    || graph.radius !== SEASONS.reduce((sum, season) => sum + graph.seasonRings[season], 0)) return { valid: false, errors: [...errors, 'Invalid seasonal ring profile'] };
  if (!graph.nodes.length || graph.nodes.length > MAX_WORLD_NODES) return { valid: false, errors: [...errors, 'Invalid world size'] };
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  if (nodes.size !== graph.nodes.length) errors.push('Duplicate world node');
  const center = nodes.get(graph.startId);
  if (!center || center.x !== 0 || center.y !== 0 || center.season !== 'spring') errors.push('Missing spring center');
  if (nodes.get(graph.altarNodeId)?.season !== 'winter') errors.push('The single altar must be in winter');
  for (const node of graph.nodes) {
    if (!Number.isInteger(node.x) || !Number.isInteger(node.y) || Math.hypot(node.x, node.y) > graph.radius || node.id !== nodeId(node)) errors.push(`Invalid coordinates at ${node.id}`);
    if (node.season !== seasonAt(node, graph)) errors.push(`Invalid seasonal ring at ${node.id}`);
    for (const [rawDirection, targetId] of Object.entries(node.exits)) {
      if (!DIRECTIONS.includes(rawDirection as Direction)) { errors.push(`Invalid exit direction at ${node.id}`); continue; }
      const direction = rawDirection as Direction;
      const target = nodes.get(targetId);
      if (!target || target.x !== node.x + DELTAS[direction].x || target.y !== node.y + DELTAS[direction].y || target.exits[OPPOSITE[direction]] !== node.id) errors.push(`Invalid reciprocal edge at ${node.id}:${direction}`);
    }
  }
  const seen = new Set([graph.startId]);
  const queue = [graph.startId];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const node = nodes.get(queue[cursor]);
    if (!node) continue;
    for (const next of Object.values(node.exits)) if (nodes.has(next) && !seen.has(next)) { seen.add(next); queue.push(next); }
  }
  if (seen.size !== graph.nodes.length) errors.push('Unreachable world nodes');
  if (independentWinterRoutes(graph) < 3) errors.push('Fewer than three independent routes to winter');
  return { valid: errors.length === 0, errors };
}

export function validateChunk(chunk: WorldChunk): MapValidation {
  const errors: string[] = [];
  if (chunk.size !== CHUNK_SIZE || chunk.tiles.length !== CHUNK_SIZE * CHUNK_SIZE) return { valid: false, errors: ['Invalid chunk dimensions'] };
  const terrain = new Set(['grass', 'path', 'water', 'rock', 'tree', 'snow', 'wall', 'bush']);
  const fires = campfireTileIndices(chunk);
  for (let index = 0; index < chunk.tiles.length; index++) {
    const tile = chunk.tiles[index];
    const shouldWalk = !fires.has(index) && (tile.terrain === 'grass' || tile.terrain === 'path' || tile.terrain === 'snow' || tile.terrain === 'bush');
    if (!terrain.has(tile.terrain) || tile.walkable !== shouldWalk || !Number.isInteger(tile.movementCost) || tile.movementCost < 1 || tile.movementCost > 10
      || tile.terrain === 'bush' && tile.movementCost !== 2) { errors.push('Invalid tile'); break; }
  }
  if (!inBounds(chunk.spawn, chunk.size)) return { valid: false, errors: [...errors, 'Invalid spawn'] };
  const regions = chunkRegions(chunk);
  const spawnRegion = regionAt(chunk, regions, chunk.spawn);
  if (spawnRegion < 0) errors.push('Blocked spawn');
  const accessibleRegions = new Set([spawnRegion]);
  const exitIds = new Set<string>();
  const exitPositions = new Set<number>();
  for (const exit of chunk.exits) {
    const { x, y } = exit.position;
    const border = exit.direction === 'north' ? y === 0 : exit.direction === 'south' ? y === chunk.size - 1 : exit.direction === 'west' ? x === 0 : exit.direction === 'east' && x === chunk.size - 1;
    const index = tileIndex(exit.position, chunk.size);
    const region = regionAt(chunk, regions, exit.position);
    const delta = DELTAS[exit.direction];
    const inwardRegion = delta ? regionAt(chunk, regions, { x: x - delta.x, y: y - delta.y }) : -1;
    const corner = (x === 0 || x === chunk.size - 1) && (y === 0 || y === chunk.size - 1);
    const touchesGate = chunk.exits.some(other => other !== exit && Math.abs(other.position.x - x) + Math.abs(other.position.y - y) === 1);
    const invalidIdentity = !exit.id || !exit.returnGateId || exit.returnGateId === exit.id || exitIds.has(exit.id) || !exit.targetNodeId;
    const invalidPosition = !DIRECTIONS.includes(exit.direction) || !inBounds(exit.position, chunk.size) || !border || corner || touchesGate || exitPositions.has(index);
    const unsafeArrival = region < 0 || inwardRegion !== region || regions.interiorSizes[region] < 4;
    if (invalidIdentity || invalidPosition || unsafeArrival) errors.push('Invalid or unreachable exit');
    exitIds.add(exit.id); exitPositions.add(index); accessibleRegions.add(region);
  }
  if (regions.sizes.some((_, index) => !accessibleRegions.has(index))) errors.push('Walkable region has no spawn or entrance');
  for (let index = 0; index < chunk.tiles.length; index++) {
    const x = index % chunk.size; const y = Math.floor(index / chunk.size);
    if ((x === 0 || y === 0 || x === chunk.size - 1 || y === chunk.size - 1) && chunk.tiles[index].walkable && !exitPositions.has(index)) errors.push('Open boundary without an exit');
  }
  const poiIds = new Set<string>();
  for (const poi of chunk.pois) {
    const reachable = poiApproachCells(chunk, poi).some(point => regionAt(chunk, regions, point) >= 0);
    if (!inBounds(poi.position, chunk.size) || !reachable || poiIds.has(poi.id) || chunk.exits.some(exit => samePoint(exit.position, poi.position))) errors.push('Invalid or unreachable point of interest');
    if (!['campfire', 'encounter', 'altar'].includes(poi.kind) || (poi.kind === 'encounter' && !poi.encounterId)) errors.push('Invalid point of interest kind');
    poiIds.add(poi.id);
  }
  if (chunk.pois.filter(poi => poi.kind === 'altar').length > 1) errors.push('Duplicate altar');
  errors.push(...validateStructures(chunk));
  return { valid: errors.length === 0, errors };
}
