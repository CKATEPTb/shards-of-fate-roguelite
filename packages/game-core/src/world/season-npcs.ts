import { NPC_KINDS, type GridPoint, type NpcKind, type Season, type WorldGraph, type WorldNode, type WorldPoi, type WorldStructure } from '@shards/shared';
import { createRng, hashString } from '../random';
import { CHUNK_SIZE } from './grid';
import { worldDie } from './generation-dice';
import { insidePocketMask, type DetachedPocket } from './pockets';
import { SEASONS } from './profile';
import { seasonAltarNodeIds } from './season-altars';
import { withinStructure } from './structures';

type SeasonalNpcs = Record<Season, Record<NpcKind, string>>;
const derivedNpcs = new WeakMap<WorldGraph, SeasonalNpcs>();

/** One of each service in every season; visitation and hero dice never affect selection. */
export function seasonNpcNodeIds(graph: WorldGraph): SeasonalNpcs {
  const cached = derivedNpcs.get(graph);
  if (cached) return cached;
  const altars = seasonAltarNodeIds(graph);
  const result = {} as SeasonalNpcs;
  for (const season of SEASONS) {
    const nodes = graph.nodes.filter(node => node.season === season && node.id !== graph.startId)
      .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
    const ordinary = nodes.filter(node => node.id !== altars[season]);
    const candidates = [...(ordinary.length >= NPC_KINDS.length ? ordinary : nodes)];
    if (candidates.length < NPC_KINDS.length) throw new Error(`Missing ${season} service regions`);
    const rng = createRng(`season-npc-node-v1:${hashString(graph.seed)}:${season}`);
    result[season] = {} as Record<NpcKind, string>;
    for (const kind of NPC_KINDS) result[season][kind] = candidates.splice(worldDie(rng, candidates.length) - 1, 1)[0].id;
  }
  derivedNpcs.set(graph, result);
  return result;
}

/** Appended after ordinary structures, preserving their IDs and basement ordinals. */
export function planSeasonNpc(graph: WorldGraph, node: WorldNode, pocket: DetachedPocket | null,
  pois: readonly WorldPoi[], structures: readonly WorldStructure[]): WorldStructure | undefined {
  if ((graph.structureVersion ?? 1) < 3) return;
  const kind = NPC_KINDS.find(candidate => seasonNpcNodeIds(graph)[node.season][candidate] === node.id);
  if (!kind) return;
  const width = 4, height = 3;
  const rng = createRng(`season-npc-house-v1:${hashString(graph.seed)}:${node.id}:${kind}`);
  const variant = worldDie(rng, 4) - 1;
  const door = 1 + variant % 2;
  const protectedPoints = [{ x: Math.floor(CHUNK_SIZE / 2), y: Math.floor(CHUNK_SIZE / 2) }, ...pois.map(poi => poi.position)];
  const candidates: GridPoint[] = [];
  for (let y = 2; y <= CHUNK_SIZE - height - 3; y++) for (let x = 2; x <= CHUNK_SIZE - width - 3; x++) {
    let safe = true;
    for (let row = y - 1; safe && row <= y + height + 1; row++) for (let col = x - 1; col <= x + width; col++) {
      const point = { x: col, y: row };
      if (insidePocketMask(point, pocket)
        || protectedPoints.some(protectedPoint => Math.abs(col - protectedPoint.x) <= 2 && Math.abs(row - protectedPoint.y) <= 2)
        || structures.some(structure => withinStructure(point, structure, 1))) { safe = false; break; }
    }
    if (safe) candidates.push({ x, y });
  }
  if (!candidates.length) throw new Error(`Missing safe ${kind} house footprint in ${node.id}`);
  const origin = candidates[worldDie(rng, candidates.length) - 1];
  const blockedCells: GridPoint[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if ((x === 0 || y === 0 || x === width - 1 || y === height - 1) && !(y === height - 1 && x === door)) {
      blockedCells.push({ x: origin.x + x, y: origin.y + y });
    }
  }
  return { id: `${node.id}:npc-structure:${kind}`, kind: 'house', npcKind: kind, origin, width, height,
    approach: { x: origin.x + door, y: origin.y + height }, blockedCells, variant };
}
