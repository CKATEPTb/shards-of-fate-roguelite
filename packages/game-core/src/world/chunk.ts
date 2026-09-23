import type { GridPoint, Terrain, WorldChunk, WorldGraph, WorldNode } from '@shards/shared';
import { createRng, hashString } from '../random';
import { CHUNK_SIZE, DELTAS } from './grid';
import { carveMaze, connectToMaze, makeTile, paint } from './carving';
import { fromBoundary, insidePocketMask } from './pockets';
import { validateChunk } from './validation';
import { planChunk } from './plan';
import { withinStructure } from './structures';
import { applyCampfireObstacles } from './campfires';
import { applyBushes } from './bushes';
import { parseBasementChunkId, resolveWorldNode } from './chunk-identity';
import { buildBasementChunk } from './basements';
import { applySeasonAltar } from './season-altars';

const MID = Math.floor(CHUNK_SIZE / 2);
/** The local stream and shared seam streams are independent of visitation order. */
export function generateChunk(graph: WorldGraph, nodeId: string): WorldChunk {
  if (graph.generatorVersion !== 3) throw new Error('Unsupported world generator version');
  const node = resolveWorldNode(graph, nodeId);
  if (!node) throw new Error(`Unknown world node: ${nodeId}`);
  if (nodeId !== node.id) {
    if ((graph.structureVersion ?? 1) < 3 || !parseBasementChunkId(nodeId)) throw new Error(`Unknown world chunk: ${nodeId}`);
    const plan = planChunk(graph, node);
    const entrance = plan.pois.find(poi => poi.kind === 'stairs-down' && poi.destination?.chunkId === nodeId);
    if (!entrance) throw new Error(`Unknown basement: ${nodeId}`);
    return buildBasementChunk(graph, node, entrance, plan.pois.find(poi => poi.kind === 'encounter')!.encounterId!);
  }
  return buildChunk(graph, node);
}

/** Existence checks only inspect small deterministic plans, without allocating chunk terrain. */
export function isWorldChunkId(graph: WorldGraph, chunkId: string): boolean {
  const node = resolveWorldNode(graph, chunkId);
  if (!node) return false;
  if (node.id === chunkId) return true;
  return (graph.structureVersion ?? 1) >= 3 && !!parseBasementChunkId(chunkId)
    && planChunk(graph, node).pois.some(poi => poi.kind === 'stairs-down' && poi.destination?.chunkId === chunkId);
}

/** Bulk audit callers already hold a node and avoid repeating a whole-graph lookup. */
export function buildChunk(graph: WorldGraph, node: WorldNode): WorldChunk {
  if (graph.generatorVersion !== 3) throw new Error('Unsupported world generator version');
  const seedHash = hashString(graph.seed);
  const rng = createRng(`chunk-v3:${seedHash}:${node.id}`);
  const plan = planChunk(graph, node);
  const { pocket } = plan;
  const ground: Terrain = node.season === 'winter' ? 'snow' : 'grass';
  const patchSize = Math.ceil(CHUNK_SIZE / 4);
  const patches = Array.from({ length: patchSize * patchSize }, (_, index) => hashString(`${node.id}:${index % patchSize}:${Math.floor(index / patchSize)}:${seedHash}`) % 13);
  const chunk: WorldChunk = {
    id: node.id, ...((graph.structureVersion ?? 1) >= 3 ? { layer: 'surface' as const, surfaceNodeId: node.id } : {}), size: CHUNK_SIZE, season: node.season,
    tiles: Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, (_, index) => {
      const x = index % CHUNK_SIZE; const y = Math.floor(index / CHUNK_SIZE);
      const patch = patches[Math.floor(y / 4) * patchSize + Math.floor(x / 4)];
      return makeTile(patch === 0 ? 'water' : patch === 1 ? 'rock' : 'tree');
    }),
    spawn: { x: MID, y: MID }, exits: plan.exits, pois: plan.pois, structures: plan.structures,
  };
  const reserved = (point: GridPoint) => insidePocketMask(point, pocket) || chunk.structures.some(structure => withinStructure(point, structure));
  carveMaze(chunk, reserved, rng, ground);
  connectToMaze(chunk, chunk.spawn, reserved, rng);
  for (let y = MID - 2; y <= MID + 2; y++) for (let x = MID - 2; x <= MID + 2; x++) paint(chunk, { x, y }, ground);
  for (const exit of chunk.exits) {
    if (exit.id === pocket?.gate.id) continue;
    const delta = DELTAS[exit.direction];
    connectToMaze(chunk, { x: exit.position.x - delta.x, y: exit.position.y - delta.y }, reserved, rng);
    paint(chunk, exit.position, 'path');
  }
  if (pocket) {
    for (let depth = 1; depth <= 7; depth++) for (let coordinate = pocket.coordinate - 3; coordinate <= pocket.coordinate + 3; coordinate++) {
      paint(chunk, fromBoundary(pocket.gate.direction, depth, coordinate), ground);
    }
    paint(chunk, pocket.gate.position, 'path');
  }
  for (const poi of chunk.pois) {
    // Interior loot/stairs are reached through the real doorway after the walls are painted.
    if (poi.structureId) continue;
    if (!insidePocketMask(poi.position, pocket)) connectToMaze(chunk, poi.position, reserved, rng);
    for (let y = poi.position.y - 1; y <= poi.position.y + 1; y++) for (let x = poi.position.x - 1; x <= poi.position.x + 1; x++) paint(chunk, { x, y }, ground);
  }
  for (const structure of chunk.structures) {
    connectToMaze(chunk, structure.approach, reserved, rng);
    for (let y = structure.origin.y; y < structure.origin.y + structure.height; y++) for (let x = structure.origin.x; x < structure.origin.x + structure.width; x++) paint(chunk, { x, y }, ground);
    for (const point of structure.blockedCells) paint(chunk, point, 'wall');
  }
  applyCampfireObstacles(chunk);
  applyBushes(chunk, graph.seed);
  applySeasonAltar(graph, chunk);
  const result = validateChunk(chunk);
  if (!result.valid) throw new Error(`Chunk generation invariant failed at ${node.id}: ${result.errors.join('; ')}`);
  return chunk;
}
