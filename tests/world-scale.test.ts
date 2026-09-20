import { describe, expect, it } from 'vitest';
import { analyzeWorldConnectivity, generateWorld, validateChunk, validateWorld, worldProfile } from '@shards/game-core';
import { buildChunk } from '../packages/game-core/src/world/chunk';
import { matchingGate } from '../packages/game-core/src/world/connectivity';
import { planChunk } from '../packages/game-core/src/world/plan';

const minimumSeed = 'world-profile-v3:1173';
const maximumSeed = 'world-profile-v3:1700';

describe('large seasonal world coverage', () => {
  it('checks 10,000 seeded profiles, each with 10–15 rings per season and 40–60 in total', () => {
    const radii = new Set<number>();
    for (let index = 0; index < 10_000; index++) {
      const profile = worldProfile(`world-profile-v3:${index}`);
      if (Object.values(profile.seasonRings).some(width => width < 10 || width > 15 || !Number.isInteger(width))
        || profile.radius !== Object.values(profile.seasonRings).reduce((sum, width) => sum + width, 0)) throw new Error(`Invalid profile at ${index}`);
      radii.add(profile.radius);
    }
    expect([...radii].sort((a, b) => a - b)).toEqual(Array.from({ length: 21 }, (_, index) => index + 40));
    expect(worldProfile(minimumSeed).radius).toBe(40);
    expect(worldProfile(maximumSeed).radius).toBe(60);
  });

  it('checks 10,000 real chunks and reciprocal seam descriptions across eight full-sized worlds', () => {
    const worlds = [minimumSeed, maximumSeed, ...Array.from({ length: 6 }, (_, index) => `chunk-matrix-v3:${index}`)].map(seed => {
      const graph = generateWorld(seed);
      return { graph, byId: new Map(graph.nodes.map(node => [node.id, node])) };
    });
    for (let index = 0; index < 10_000; index++) {
      const { graph, byId } = worlds[index % worlds.length];
      const node = graph.nodes[(index * 7919 + 13) % graph.nodes.length];
      const chunk = buildChunk(graph, node);
      const validation = validateChunk(chunk);
      if (!validation.valid) throw new Error(`${graph.seed}:${node.id}: ${validation.errors.join('; ')}`);
      const exit = chunk.exits[index % chunk.exits.length];
      const peerNode = byId.get(exit.targetNodeId)!;
      if (!matchingGate(chunk, exit, { id: peerNode.id, exits: planChunk(graph, peerNode).exits })) throw new Error(`Unpaired seam at case ${index}`);
    }
  }, 120_000);

  it.each([
    [minimumSeed, 40, 5025], [maximumSeed, 60, 11289], ['FIRST-CAMPFIRE', 49, 7525],
  ] as const)('streams every actual chunk and checks every region/POI in %s', (seed, radius, count) => {
    const graph = generateWorld(seed);
    expect(graph.radius).toBe(radius);
    expect(graph.nodes).toHaveLength(count);
    const analysis = analyzeWorldConnectivity(graph);
    expect(analysis.errors).toEqual([]);
    expect(analysis.valid).toBe(true);
    expect(analysis.reachableRegions).toBe(analysis.regions);
    expect(analysis.detachedRegions).toBeGreaterThan(100);
    expect(analysis.independentWinterRoutes).toBe(4);
  }, 120_000);

  // This intentionally remains available, but is not hidden in every rapid application check:
  // a v3 sweep allocates about 80 million macro nodes instead of the v2 sweep's half million.
  it.skipIf(process.env.WORLD_EXHAUSTIVE !== '1')('exhaustively validates 10,000 full large-world graphs and one chunk per world', () => {
    for (let index = 0; index < 10_000; index++) {
      const graph = generateWorld(`world-property-v3:${index}`);
      const world = validateWorld(graph);
      if (!world.valid) throw new Error(`Seed ${index}: ${world.errors.join('; ')}`);
      const chunk = buildChunk(graph, graph.nodes[index % graph.nodes.length]);
      const local = validateChunk(chunk);
      if (!local.valid) throw new Error(`Seed ${index}: ${local.errors.join('; ')}`);
    }
  }, 1_800_000);
});
