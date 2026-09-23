import type { ChunkExit, MapValidation, WorldChunk, WorldGraph, WorldNode, WorldPoi } from '@shards/shared';
import { buildChunk, generateChunk } from './chunk';
import { OPPOSITE } from './grid';
import { chunkRegions, regionAt } from './regions';
import { independentWinterRoutes } from './routes';
import { validateChunk, validateWorld } from './validation';
import { poiApproachCells } from './poi-access';
import { seasonAltarNodeIds } from './season-altars';
import { SEASONS } from './profile';

export interface WorldConnectivityAnalysis extends MapValidation {
  regions: number;
  reachableRegions: number;
  detachedRegions: number;
  independentWinterRoutes: number;
}

interface GateSummary extends ChunkExit { region: number }
interface ChunkSummary {
  id: string;
  main: number;
  count: number;
  exits: GateSummary[];
  points: Array<{ id: string; kind: string; region: number; destination?: WorldPoi['destination'] }>;
}

export function matchingGate<T extends ChunkExit>(source: { id: string }, exit: ChunkExit, target: { id: string; exits: T[] }): T | undefined {
  const peer = target.exits.find(gate => gate.id === exit.returnGateId);
  const sameCoordinate = exit.direction === 'north' || exit.direction === 'south'
    ? peer?.position.x === exit.position.x : peer?.position.y === exit.position.y;
  return peer && peer.returnGateId === exit.id && peer.targetNodeId === source.id
    && peer.direction === OPPOSITE[exit.direction] && sameCoordinate ? peer : undefined;
}

function summarizeChunk(chunk: WorldChunk): ChunkSummary {
  const regions = chunkRegions(chunk);
  return {
    id: chunk.id, main: regionAt(chunk, regions, chunk.spawn), count: regions.sizes.length,
    exits: chunk.exits.map(exit => ({ ...exit, region: regionAt(chunk, regions, exit.position) })),
    points: [
      ...chunk.pois.map(poi => ({
        id: poi.id, kind: poi.kind, destination: poi.destination,
        region: poiApproachCells(chunk, poi).map(point => regionAt(chunk, regions, point)).find(region => region >= 0) ?? -1,
      })),
      ...chunk.structures.map(structure => ({ id: structure.id, kind: 'structure', region: regionAt(chunk, regions, structure.approach) })),
    ],
  };
}

/**
 * Stream real terrain one chunk at a time; retain only component/gate/POI summaries.
 * Optional sparse overrides support independent fault injection without materializing the world.
 * Three vertex-disjoint paths through physically connected transit components certify routes;
 * two gates or disconnected regions in the same chunk never count as two world routes.
 */
export function analyzeWorldConnectivity(graph: WorldGraph, overrides?: ReadonlyMap<string, WorldChunk>): WorldConnectivityAnalysis {
  const errors = [...validateWorld(graph).errors];
  const result = { valid: false, errors, regions: 0, reachableRegions: 0, detachedRegions: 0, independentWinterRoutes: 0 };
  if (errors.length) return result;
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  const summaries = new Map<string, ChunkSummary>();
  const adjacency = new Map<string, Set<string>>();
  const componentKey = (id: string, component: number) => `${id}#${component}`;
  for (const node of graph.nodes) {
    const chunk = overrides?.get(node.id) ?? buildChunk(graph, node);
    if (chunk.id !== node.id || chunk.season !== node.season) { errors.push(`Mismatched chunk ${node.id}`); continue; }
    const local = validateChunk(chunk);
    if (!local.valid) errors.push(...local.errors.map(error => `${node.id}: ${error}`));
    const summary = summarizeChunk(chunk);
    summaries.set(node.id, summary);
    for (let component = 0; component < summary.count; component++) adjacency.set(componentKey(node.id, component), new Set());
  }
  const cellarIds = [...summaries.values()].flatMap(chunk => chunk.points.flatMap(point =>
    point.kind === 'stairs-down' && point.destination ? [point.destination.chunkId] : []));
  for (const id of new Set(cellarIds)) {
    let chunk: WorldChunk;
    try { chunk = overrides?.get(id) ?? generateChunk(graph, id); }
    catch { errors.push(`Invalid basement destination ${id}`); continue; }
    if (chunk.id !== id || chunk.layer !== 'basement' || chunk.season !== nodes.get(chunk.surfaceNodeId ?? '')?.season) {
      errors.push(`Mismatched basement ${id}`); continue;
    }
    const local = validateChunk(chunk);
    if (!local.valid) errors.push(...local.errors.map(error => `${id}: ${error}`));
    const summary = summarizeChunk(chunk);
    summaries.set(id, summary);
    for (let component = 0; component < summary.count; component++) adjacency.set(componentKey(id, component), new Set());
  }
  result.regions = adjacency.size;
  result.detachedRegions = result.regions - summaries.size;
  const altars = [...summaries.values()].flatMap(chunk => chunk.points.filter(point => point.kind === 'altar').map(() => chunk.id));
  const expectedAltars = seasonAltarNodeIds(graph);
  if (altars.length !== SEASONS.length || SEASONS.some(season => altars.filter(id => id === expectedAltars[season]).length !== 1)) {
    errors.push('Missing or misplaced seasonal altar');
  }
  if (errors.length) return result;
  const transitNodes: WorldNode[] = graph.nodes.map(node => ({ ...node, exits: {} }));
  for (const node of transitNodes) {
    const chunk = summaries.get(node.id)!;
    for (const exit of chunk.exits) {
      const target = summaries.get(exit.targetNodeId);
      const peer = target && node.id !== target.id && nodes.get(node.id)?.exits[exit.direction] === target.id
        ? matchingGate(chunk, exit, target) : undefined;
      if (!target || !peer) { errors.push(`Unpaired or misaligned gate ${exit.id}`); continue; }
      adjacency.get(componentKey(node.id, exit.region))!.add(componentKey(target.id, peer.region));
      if (exit.region === chunk.main && peer.region === target.main) node.exits[exit.direction] = target.id;
    }
    for (const direction of Object.keys(nodes.get(node.id)!.exits) as Array<ChunkExit['direction']>) {
      if (!chunk.exits.some(exit => exit.direction === direction)) errors.push(`World edge has no gate at ${node.id}:${direction}`);
    }
  }
  for (const chunk of summaries.values()) for (const point of chunk.points) {
    if (!point.destination) continue;
    const target = summaries.get(point.destination.chunkId);
    const peer = target?.points.find(candidate => candidate.id === point.destination!.poiId);
    const pairedKind = point.kind === 'portal' ? peer?.kind === 'portal'
      : point.kind === 'stairs-down' ? peer?.kind === 'stairs-up' : point.kind === 'stairs-up' && peer?.kind === 'stairs-down';
    if (!target || !peer || !pairedKind || peer.destination?.chunkId !== chunk.id || peer.destination.poiId !== point.id
      || point.region < 0 || peer.region < 0) { errors.push(`Unpaired travel point ${point.id}`); continue; }
    adjacency.get(componentKey(chunk.id, point.region))!.add(componentKey(target.id, peer.region));
  }
  const start = summaries.get(graph.startId)!;
  const first = componentKey(start.id, start.main);
  const seen = new Set([first]); const queue = [first];
  for (let cursor = 0; cursor < queue.length; cursor++) for (const next of adjacency.get(queue[cursor]) ?? []) {
    if (!seen.has(next)) { seen.add(next); queue.push(next); }
  }
  result.reachableRegions = seen.size;
  if (seen.size !== adjacency.size) errors.push('Unreachable world regions');
  for (const chunk of summaries.values()) for (const point of chunk.points) {
    if (!seen.has(componentKey(chunk.id, point.region))) errors.push(`Unreachable world point ${point.id}`);
  }
  result.independentWinterRoutes = independentWinterRoutes({ ...graph, nodes: transitNodes }, 4);
  if (result.independentWinterRoutes < 3) errors.push('Fewer than three physically independent routes to winter');
  result.valid = errors.length === 0;
  return result;
}

export const validateWorldLayout = analyzeWorldConnectivity;
