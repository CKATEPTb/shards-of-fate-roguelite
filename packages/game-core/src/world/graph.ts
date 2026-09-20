import type { Direction, WorldGraph, WorldNode } from '@shards/shared';
import { createRng, drawRandom, hashString } from '../random';
import { DELTAS, nodeId, OPPOSITE, seasonAt } from './grid';
import { validateWorld } from './validation';
import { worldProfile } from './profile';

interface CandidateEdge { from: number; to: number; direction: Direction; protected: boolean }

/** The four cardinal spokes are independent by construction; remaining edges are seeded. */
export function generateWorld(seed: string, options: { structureVersion?: 1 | 2 } = {}): WorldGraph {
  createRng(seed); // Apply the common seed contract before deriving a bounded stream key.
  const rng = createRng(`world-v3:${hashString(seed)}`);
  const random = () => drawRandom(rng, 'WORLD');
  const profile = worldProfile(seed);
  const nodes: WorldNode[] = [];
  for (let y = -profile.radius; y <= profile.radius; y++) {
    for (let x = -profile.radius; x <= profile.radius; x++) {
      const radius = Math.hypot(x, y);
      if (radius > profile.radius) continue;
      nodes.push({ id: nodeId({ x, y }), x, y, season: seasonAt({ x, y }, profile), exits: {} });
    }
  }
  const byId = new Map(nodes.map((node, index) => [node.id, index]));
  const candidates: CandidateEdge[] = [];
  for (let fromIndex = 0; fromIndex < nodes.length; fromIndex++) {
    const from = nodes[fromIndex];
    for (const direction of ['east', 'south'] as const) {
      const delta = DELTAS[direction];
      const toIndex = byId.get(nodeId({ x: from.x + delta.x, y: from.y + delta.y }));
      if (toIndex === undefined) continue;
      const to = nodes[toIndex];
      candidates.push({ from: fromIndex, to: toIndex, direction, protected: (from.x === 0 && to.x === 0) || (from.y === 0 && to.y === 0) });
    }
  }
  for (let index = candidates.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [candidates[index], candidates[other]] = [candidates[other], candidates[index]];
  }
  const parents = Int32Array.from(nodes, (_, index) => index);
  const ranks = new Uint8Array(nodes.length);
  const root = (index: number): number => {
    while (parents[index] !== index) { parents[index] = parents[parents[index]]; index = parents[index]; }
    return index;
  };
  const connect = (edge: CandidateEdge) => {
    const from = nodes[edge.from]; const to = nodes[edge.to];
    from.exits[edge.direction] = to.id;
    to.exits[OPPOSITE[edge.direction]] = from.id;
    let a = root(edge.from); let b = root(edge.to);
    if (a === b) return;
    if (ranks[a] < ranks[b]) [a, b] = [b, a];
    parents[b] = a;
    if (ranks[a] === ranks[b]) ranks[a]++;
  };
  candidates.filter(edge => edge.protected).forEach(connect);
  for (const edge of candidates) {
    if (!edge.protected && (root(edge.from) !== root(edge.to) || random() < 0.36)) connect(edge);
  }
  const winter = nodes.filter(node => node.season === 'winter');
  const graph: WorldGraph = { version: 1, generatorVersion: 3, structureVersion: options.structureVersion ?? 2,
    ...profile, seed, startId: '0,0', altarNodeId: winter[Math.floor(random() * winter.length)].id, nodes };
  const result = validateWorld(graph);
  if (!result.valid) throw new Error(`World generation invariant failed: ${result.errors.join('; ')}`);
  return graph;
}
