import { describe, expect, it, vi } from 'vitest';
import type { Direction, WorldNode } from '@shards/shared';
import { createExploration, deserializeExploration, requestMove, serializeExploration, stepExploration } from '@shards/game-core';
import { buildMinimapDiscovery, minimapViewport, MINIMAP_GEOMETRY } from '../apps/client/src/components/exploration/minimap-discovery';

function gridNodes(): Map<string, WorldNode> {
  const nodes = new Map<string, WorldNode>();
  const directions: [Direction, number, number][] = [['north', 0, -1], ['east', 1, 0], ['south', 0, 1], ['west', -1, 0]];
  for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
    const exits: WorldNode['exits'] = {};
    for (const [direction, dx, dy] of directions) if (Math.abs(x + dx) <= 4 && Math.abs(y + dy) <= 4) exits[direction] = `${x + dx},${y + dy}`;
    const id = `${x},${y}`;
    nodes.set(id, { id, x, y, exits, season: id === '1,0' ? 'winter' : 'spring' });
  }
  return nodes;
}

const view = (nodes: Map<string, WorldNode>, visited: string[], current = '0,0') =>
  minimapViewport(nodes, buildMinimapDiscovery(nodes, visited), current, '1,0');

describe('discovery within the minimap viewport', () => {
  it('starts with the visited center and its direct neighbors, not three revealed rings', () => {
    const nodes = gridNodes();
    const discovery = buildMinimapDiscovery(nodes, ['0,0']);
    const result = minimapViewport(nodes, discovery, '0,0', '1,0');
    expect(result.nodes.map(node => node.id).sort()).toEqual(['-1,0', '0,-1', '0,0', '0,1', '1,0']);
    expect(result.edges).toHaveLength(4);
    expect(result.nodes.filter(node => node.visited).map(node => node.id)).toEqual(['0,0']);
    expect(discovery.known.has('1,1')).toBe(false);
    expect(discovery.known.has('2,0')).toBe(false);
  });

  it('reveals new neighbors on entry but no edges between two unexplored chunks', () => {
    const result = view(gridNodes(), ['0,0', '1,0'], '1,0');
    expect(result.nodes.map(node => node.id).sort()).toEqual(['-1,0', '0,-1', '0,0', '0,1', '1,-1', '1,0', '1,1', '2,0']);
    expect(result.edges).toHaveLength(7);
    expect(result.edges.every(edge => ['0,0', '1,0'].includes(edge.from.id) || ['0,0', '1,0'].includes(edge.to.id))).toBe(true);
    expect(result.edges.some(edge => [edge.from.id, edge.to.id].sort().join(':') === '0,1:1,1')).toBe(false);
    expect(result.edges.filter(edge => edge.traveled)).toHaveLength(1);
    expect(result.nodes.find(node => node.current)?.id).toBe('1,0');
  });

  it('remembers discovered nodes and passages when returning to an earlier chunk', () => {
    const nodes = gridNodes(); const visited = ['0,0', '1,0', '2,0'];
    const result = view(nodes, visited);
    expect(result.nodes.find(node => node.id === '2,0')?.visited).toBe(true);
    expect(result.nodes.find(node => node.id === '3,0')?.visited).toBe(false);
    expect(result.edges.some(edge => edge.from.id === '2,0' && edge.to.id === '3,0')).toBe(true);
    expect(result.edges.filter(edge => edge.traveled)).toHaveLength(2);
    expect(view(nodes, [...visited], '0,0')).toEqual(result);
  });

  it('never exposes a neighboring chunk biome or altar until that chunk was visited', () => {
    const nodes = gridNodes();
    const unknown = view(nodes, ['0,0']).nodes.find(node => node.id === '1,0')!;
    expect(unknown).toEqual({ id: '1,0', x: 1, y: 0, current: false, visited: false, altar: false });
    expect(unknown).not.toHaveProperty('season');
    const known = view(nodes, ['0,0', '1,0']).nodes.find(node => node.id === '1,0')!;
    expect(known.season).toBe('winter'); expect(known.altar).toBe(true);
  });

  it('keeps known off-rim passage lines but no points beyond the circular boundary', () => {
    const nodes = gridNodes();
    const result = view(nodes, ['-3,0', '-2,0', '-1,0', '0,0']);
    const { radius, spacing } = MINIMAP_GEOMETRY;
    expect(result.nodes.every(node => Math.hypot(node.x, node.y) * spacing <= radius)).toBe(true);
    expect(result.nodes.some(node => node.id === '-4,0')).toBe(false);
    expect(result.edges.some(edge => edge.from.id === '-3,0' && edge.to.id === '-4,0')).toBe(true);
    // Even a fully explored world retains the original circular clipping geometry.
    const fullyExplored = view(nodes, [...nodes.keys()]);
    expect(fullyExplored.nodes).toHaveLength(45);
    expect(fullyExplored.nodes.some(node => node.id === '3,3')).toBe(false);
    expect(fullyExplored.edges.some(edge => edge.from.id === '3,3' || edge.to.id === '3,3')).toBe(true);
  });

  it('reads only visited chunks and direct neighbors without scanning all graph nodes', () => {
    const nodes = gridNodes();
    for (const method of ['values', 'entries', 'forEach'] as const) vi.spyOn(nodes, method).mockImplementation(() => {
      throw new Error('The complete graph must not be scanned for each movement tick');
    });
    const get = vi.spyOn(nodes, 'get');
    const result = view(nodes, ['0,0']);
    expect(result.nodes).toHaveLength(5);
    expect(get.mock.calls.length).toBeLessThanOrEqual(12);
  });

  it('restores all discovery from the existing visited history after save and load', () => {
    let world = createExploration({ seed: 'FIRST-CAMPFIRE', characterIds: ['guardian'] });
    const exit = world.chunk.exits.find(exit => exit.direction === 'north')!;
    world = requestMove(world, 'guardian', exit.position).state;
    for (let step = 0; step < 200 && world.currentChunkId === world.graph.startId; step++) world = stepExploration(world);
    expect(world.currentChunkId).toBe(exit.targetNodeId);
    const restored = deserializeExploration(serializeExploration(world));
    const before = new Map(world.graph.nodes.map(node => [node.id, node]));
    const after = new Map(restored.graph.nodes.map(node => [node.id, node]));
    const expected = minimapViewport(before, buildMinimapDiscovery(before, world.visited), world.currentChunkId, world.graph.altarNodeId);
    const actual = minimapViewport(after, buildMinimapDiscovery(after, restored.visited), restored.currentChunkId, restored.graph.altarNodeId);
    expect(actual).toEqual(expected);
    expect(actual.nodes).toHaveLength(7); expect(actual.edges).toHaveLength(6);
  });
});
