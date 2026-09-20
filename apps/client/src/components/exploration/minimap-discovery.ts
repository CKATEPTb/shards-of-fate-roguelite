import type { GridPoint, Season, WorldNode } from '@shards/shared';

export const MINIMAP_GEOMETRY = { center: 160, radius: 145, spacing: 38 } as const;

interface MinimapPoint extends GridPoint { id: string }
export interface MinimapEdge { id: string; from: MinimapPoint; to: MinimapPoint; traveled: boolean }
export interface MinimapNode extends MinimapPoint { current: boolean; visited: boolean; season?: Season; altar: boolean }
export interface MinimapDiscovery {
  visited: ReadonlySet<string>;
  known: ReadonlySet<string>;
  edgesByNode: ReadonlyMap<string, readonly MinimapEdge[]>;
}

const pointOf = ({ id, x, y }: WorldNode): MinimapPoint => ({ id, x, y });

/** A visited chunk discloses its own exits, never an unexplored neighbor's exits. */
export function buildMinimapDiscovery(byId: ReadonlyMap<string, WorldNode>, visitedIds: readonly string[]): MinimapDiscovery {
  const visited = new Set(visitedIds.filter(id => byId.has(id)));
  const known = new Set(visited);
  const edgeIds = new Set<string>();
  const edgesByNode = new Map<string, MinimapEdge[]>();
  for (const id of visited) {
    const node = byId.get(id)!;
    for (const targetId of Object.values(node.exits)) {
      const target = byId.get(targetId);
      if (!target) continue;
      known.add(targetId);
      const edgeId = [id, targetId].sort().join(':');
      if (edgeIds.has(edgeId)) continue;
      const edge = { id: edgeId, from: pointOf(node), to: pointOf(target), traveled: visited.has(targetId) };
      edgeIds.add(edgeId);
      for (const endpoint of [id, targetId]) {
        const connections = edgesByNode.get(endpoint) ?? [];
        connections.push(edge); edgesByNode.set(endpoint, connections);
      }
    }
  }
  return { visited, known, edgesByNode };
}

/** The three-ring window limits the view; it does not discover its contents. */
export function minimapViewport(byId: ReadonlyMap<string, WorldNode>, discovery: MinimapDiscovery,
  currentChunkId: string, altarNodeId: string): { nodes: MinimapNode[]; edges: MinimapEdge[] } {
  const current = byId.get(currentChunkId);
  if (!current) return { nodes: [], edges: [] };
  const { radius, spacing } = MINIMAP_GEOMETRY;
  const range = Math.floor(radius / spacing);
  const nodes: MinimapNode[] = [];
  const edges = new Map<string, MinimapEdge>();
  for (let y = current.y - range; y <= current.y + range; y++) {
    for (let x = current.x - range; x <= current.x + range; x++) {
      if (Math.hypot(x - current.x, y - current.y) * spacing > radius) continue;
      const id = `${x},${y}`;
      if (!discovery.known.has(id)) continue;
      const node = byId.get(id);
      if (!node) continue;
      const visited = discovery.visited.has(id);
      nodes.push({ id, x, y, current: id === currentChunkId, visited,
        ...(visited ? { season: node.season } : {}), altar: visited && id === altarNodeId });
      // Remembered passages may extend to the clipped rim, but their off-rim
      // endpoint must not create a dot outside the circular viewport.
      for (const edge of discovery.edgesByNode.get(id) ?? []) edges.set(edge.id, edge);
    }
  }
  return { nodes, edges: [...edges.values()] };
}
