import type { ChunkExit, WorldGraph, WorldNode, WorldPoi, WorldStructure } from '@shards/shared';
import { createRng, drawRandom, hashString } from '../random';
import { choosePocket, fromBoundary, type DetachedPocket } from './pockets';
import { gatesForNode } from './seams';
import { planStructures } from './structures';
import { hasCampfire } from './campfires';
import { portalForNode } from './portals';
import { structurePois } from './structure-pois';
import { worldDie } from './generation-dice';
import { planSeasonNpc } from './season-npcs';

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
  const interactive = (graph.structureVersion ?? 1) >= 3;
  if (hasCampfire(graph, node)) pois.push({ id: `${node.id}:campfire`, kind: 'campfire', position: { x: 17, y: 17 } });
  const encounterPosition = start ? { x: 23, y: 17 }
    : pocket && (interactive ? worldDie(rng, 20) <= 9 : random() < 0.45) ? fromBoundary(pocket.gate.direction, 4, pocket.coordinate)
      : { x: interactive ? 10 + worldDie(rng, 3) : 11 + Math.floor(random() * 3), y: interactive ? 10 + worldDie(rng, 3) : 11 + Math.floor(random() * 3) };
  const pool = ENCOUNTERS[node.season];
  pois.push({ id: `${node.id}:encounter`, kind: 'encounter', position: encounterPosition,
    encounterId: start ? 'mossy_path' : pool[interactive ? worldDie(rng, pool.length) - 1 : Math.floor(random() * pool.length)] });
  if (node.id === graph.altarNodeId) pois.push({ id: `${node.id}:altar`, kind: 'altar', position: { x: 25, y: 25 } });
  const portal = interactive ? portalForNode(graph, node, pocket, pois) : undefined;
  if (portal) pois.push(portal);
  const structures = planStructures(node.id, start, createRng(`structures-v3:${seed}:${node.id}`), pocket, pois, graph.structureVersion ?? 1);
  if (interactive) pois.push(...structurePois(graph.seed, node, structures));
  const service = interactive ? planSeasonNpc(graph, node, pocket, pois, structures) : undefined;
  if (service) {
    structures.push(service);
    pois.push({ id: `${node.id}:npc:${service.npcKind}`, kind: 'npc', npcKind: service.npcKind,
      structureId: service.id, position: { ...service.approach } });
  }
  return { exits, pocket, pois, structures };
}
