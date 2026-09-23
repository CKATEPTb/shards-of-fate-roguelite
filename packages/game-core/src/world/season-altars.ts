import type { GridPoint, Season, WorldChunk, WorldGraph } from '@shards/shared';
import { createRng, hashString } from '../random';
import { worldDie } from './generation-dice';
import { neighbors, pointAt, reachableTiles, samePoint } from './grid';
import { withinStructure } from './structures';

const derivedAltars = new WeakMap<WorldGraph, Record<Season, string>>();

/** Private generation dice leave every existing world, structure and terrain stream intact. */
export function seasonAltarNodeIds(graph: WorldGraph): Record<Season, string> {
  if (graph.seasonalAltarNodeIds) return graph.seasonalAltarNodeIds;
  const cached = derivedAltars.get(graph);
  if (cached) return cached;
  const result = { winter: graph.altarNodeId } as Record<Season, string>;
  for (const season of ['spring', 'summer', 'autumn'] as const) {
    const candidates = graph.nodes.filter(node => node.season === season && node.id !== graph.startId);
    if (!candidates.length) throw new Error(`Missing ${season} altar region`);
    const rng = createRng(`season-altar-node-v1:${hashString(graph.seed)}:${season}`);
    result[season] = candidates[worldDie(rng, candidates.length) - 1].id;
  }
  derivedAltars.set(graph, result);
  return result;
}

export function seasonAltarNodeId(graph: WorldGraph, season: Season): string {
  return seasonAltarNodeIds(graph)[season];
}

const near = (left: GridPoint, right: GridPoint, radius: number) =>
  Math.abs(left.x - right.x) <= radius && Math.abs(left.y - right.y) <= radius;

/**
 * Add new landmarks only after terrain is complete. No tile, building, exit, old
 * POI or dice counter changes, including when an older saved world is restored.
 * The winter altar keeps its original planned clearing and identity.
 */
export function applySeasonAltar(graph: WorldGraph, chunk: WorldChunk): void {
  if (chunk.layer === 'basement' || seasonAltarNodeId(graph, chunk.season) !== chunk.id) return;
  const existing = chunk.pois.find(poi => poi.kind === 'altar');
  if (existing) { existing.bossSeason = chunk.season; return; }
  const reachable = reachableTiles(chunk);
  const free = [...reachable].sort((left, right) => left - right).map(index => pointAt(index, chunk.size)).filter(point =>
    point.x > 0 && point.y > 0 && point.x < chunk.size - 1 && point.y < chunk.size - 1
    && !samePoint(point, chunk.spawn)
    && !chunk.pois.some(poi => samePoint(point, poi.position))
    && !chunk.exits.some(exit => samePoint(point, exit.position))
    && !chunk.structures.some(structure => withinStructure(point, structure) || samePoint(point, structure.approach)));
  // Prefer an open outdoor clearing with room for the altar sprite. Dense legacy
  // layouts still have a safe fallback without carving or moving their contents.
  const clearings = free.filter(point => !near(point, chunk.spawn, 2)
    && !chunk.pois.some(poi => near(point, poi.position, 2))
    && !chunk.exits.some(exit => near(point, exit.position, 3))
    && !chunk.structures.some(structure => withinStructure(point, structure, 1))
    && neighbors(point, chunk.size).every(next => reachable.has(next.y * chunk.size + next.x))
    && chunk.tiles[point.y * chunk.size + point.x].terrain !== 'bush');
  const candidates = clearings.length ? clearings : free;
  if (!candidates.length) throw new Error(`Missing reachable altar tile in ${chunk.id}`);
  const rng = createRng(`season-altar-tile-v1:${hashString(graph.seed)}:${chunk.id}`);
  chunk.pois.push({ id: `${chunk.id}:altar`, kind: 'altar', bossSeason: chunk.season,
    position: candidates[worldDie(rng, candidates.length) - 1] });
}
