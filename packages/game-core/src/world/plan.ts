import type { ChunkExit, WorldGraph, WorldNode, WorldPoi, WorldStructure } from '@shards/shared';
import { createRng, drawRandom, hashString } from '../random';
import { choosePocket, fromBoundary, type DetachedPocket } from './pockets';
import { gatesForNode } from './seams';
import { planStructures } from './structures';

const ENCOUNTERS = {
  spring: ['mossy_path', 'wolf_den'], summer: ['wolf_den', 'goblin_ambush'],
  autumn: ['goblin_ambush', 'thorn_thicket'], winter: ['thorn_thicket', 'warden_grove'],
};

export interface ChunkPlan { exits: ChunkExit[]; pocket: DetachedPocket | null; pois: WorldPoi[]; structures: WorldStructure[] }

/** Small deterministic metadata can be checked without allocating or carving 1,225 tiles. */
export function planChunk(graph: WorldGraph, node: WorldNode): ChunkPlan {
  const seed = hashString(graph.seed);
  const exits = gatesForNode(graph, node);
  const pocket = choosePocket(node, exits, createRng(`pocket-v3:${seed}:${node.id}`));
  const rng = createRng(`points-v3:${seed}:${node.id}`);
  const random = () => drawRandom(rng, 'WORLD');
  const pois: WorldPoi[] = [];
  const start = node.id === graph.startId;
  if (start) pois.push({ id: `${node.id}:campfire`, kind: 'campfire', position: { x: 17, y: 17 } });
  const encounterPosition = start ? { x: 23, y: 17 }
    : pocket && random() < 0.45 ? fromBoundary(pocket.gate.direction, 4, pocket.coordinate)
      : { x: 11 + Math.floor(random() * 3), y: 11 + Math.floor(random() * 3) };
  const pool = ENCOUNTERS[node.season];
  pois.push({ id: `${node.id}:encounter`, kind: 'encounter', position: encounterPosition,
    encounterId: start ? 'mossy_path' : pool[Math.floor(random() * pool.length)] });
  if (node.id === graph.altarNodeId) pois.push({ id: `${node.id}:altar`, kind: 'altar', position: { x: 25, y: 25 } });
  const structures = planStructures(node.id, start, createRng(`structures-v3:${seed}:${node.id}`), pocket, pois, graph.structureVersion ?? 1);
  return { exits, pocket, pois, structures };
}
