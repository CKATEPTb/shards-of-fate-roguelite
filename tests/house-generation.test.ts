import { beforeAll, describe, expect, it } from 'vitest';
import { findPath, generateChunk, generateWorld, validateChunk } from '@shards/game-core';
import type { Season, WorldGraph, WorldStructure } from '@shards/shared';
import { planChunk } from '../packages/game-core/src/world/plan';
import { insidePocketMask } from '../packages/game-core/src/world/pockets';
import { chunkRegions, regionAt } from '../packages/game-core/src/world/regions';
import { withinStructure } from '../packages/game-core/src/world/structures';

const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter'];
const houseCount = (structures: WorldStructure[]) => structures.filter(structure => structure.kind === 'house').length;
let worlds: WorldGraph[];

beforeAll(() => {
  worlds = ['SETTLEMENT-SIZE-A', 'SETTLEMENT-SIZE-B', 'SETTLEMENT-SIZE-C'].map(seed => generateWorld(seed));
});

describe('varied settlement sizes', () => {
  it.each([
    ['STARTER-HOUSES-0', 1], ['STARTER-HOUSES-3', 2], ['STARTER-HOUSES-9', 3],
  ] as const)('allows %s to start with %i houses without losing camp access', (seed, expected) => {
    const graph = generateWorld(seed);
    const chunk = generateChunk(graph, graph.startId);
    expect(houseCount(chunk.structures)).toBe(expected);
    expect(generateChunk(graph, graph.startId)).toEqual(chunk);
    expect(validateChunk(chunk)).toEqual({ valid: true, errors: [] });
    for (const structure of chunk.structures) expect(findPath(chunk, chunk.spawn, structure.approach).length).toBeGreaterThan(0);
    const encounter = chunk.pois.find(poi => poi.kind === 'encounter')!;
    expect(findPath(chunk, chunk.spawn, encounter.position).length).toBeGreaterThan(0);
  });

  it('keeps settlement locations deterministic while making one house common and three rare', () => {
    const counts = [0, 0, 0, 0];
    for (const graph of worlds) {
      const legacy = { ...graph, structureVersion: 1 as const };
      const sampled = graph.nodes.filter((node, index) => index % 7 === 0 || node.id === graph.startId);
      for (const node of sampled) {
        const current = planChunk(graph, node);
        const previous = planChunk(legacy, node);
        const count = houseCount(current.structures);
        expect(count, `${graph.seed}:${node.id}`).toBeGreaterThanOrEqual(0);
        expect(count, `${graph.seed}:${node.id}`).toBeLessThanOrEqual(3);
        expect(count > 0).toBe(houseCount(previous.structures) > 0);
        expect(planChunk(graph, node)).toEqual(current);
        if (count) counts[count]++;
        else expect(current.structures).toEqual(previous.structures);
      }
      expect(houseCount(planChunk(graph, graph.nodes.find(node => node.id === graph.startId)!).structures)).toBeGreaterThan(0);
    }
    const settlements = counts[1] + counts[2] + counts[3];
    expect(settlements).toBeGreaterThan(500);
    // Broad bounds test the intended experience without pinning every seed to a particular roll.
    expect(counts[1] / settlements).toBeGreaterThan(0.5);
    expect(counts[1] / settlements).toBeLessThan(0.7);
    expect(counts[2] / settlements).toBeGreaterThan(0.25);
    expect(counts[2] / settlements).toBeLessThan(0.45);
    expect(counts[3] / settlements).toBeGreaterThan(0.01);
    expect(counts[3] / settlements).toBeLessThan(0.1);
  });

  it('keeps larger settlements and their interiors accessible across seasons and detached areas', () => {
    let checked = 0; let detached = 0; let triples = 0;
    const seenSizes = new Set<number>();
    for (const graph of worlds) for (const season of seasons) {
      const candidates = graph.nodes.filter(node => node.season === season)
        .map(node => ({ node, plan: planChunk(graph, node) }))
        .filter(({ plan }) => houseCount(plan.structures) > 0);
      const selected = candidates.slice(0, 12);
      const threeHouses = candidates.find(({ plan }) => houseCount(plan.structures) === 3);
      if (threeHouses && !selected.includes(threeHouses)) selected.push(threeHouses);
      expect(selected.length, `${graph.seed}:${season}`).toBeGreaterThanOrEqual(12);
      for (const { node, plan } of selected) {
        const label = `${graph.seed}:${node.id}`;
        const chunk = generateChunk(graph, node.id);
        const count = houseCount(chunk.structures);
        const regions = chunkRegions(chunk);
        const spawnRegion = regionAt(chunk, regions, chunk.spawn);
        expect(validateChunk(chunk), label).toEqual({ valid: true, errors: [] });
        expect(chunk.structures, label).toEqual(plan.structures);
        seenSizes.add(count); checked++;
        if (count === 3) triples++;
        if (plan.pocket) {
          detached++;
          const pocketRegion = regionAt(chunk, regions, plan.pocket.gate.position);
          expect(pocketRegion, label).toBeGreaterThanOrEqual(0);
          expect(pocketRegion, label).not.toBe(spawnRegion);
        }
        for (const exit of chunk.exits) {
          if (exit.id !== plan.pocket?.gate.id) expect(findPath(chunk, chunk.spawn, exit.position).length, label).toBeGreaterThan(0);
        }
        for (const structure of chunk.structures) {
          expect(findPath(chunk, chunk.spawn, structure.approach).length, label).toBeGreaterThan(0);
          for (const poi of chunk.pois) expect(withinStructure(poi.position, structure, 2), label).toBe(false);
          for (let y = structure.origin.y; y < structure.origin.y + structure.height; y++) {
            for (let x = structure.origin.x; x < structure.origin.x + structure.width; x++) {
              const point = { x, y };
              expect(insidePocketMask(point, plan.pocket), label).toBe(false);
              expect(chunk.structures.some(other => other !== structure && withinStructure(point, other, 1)), label).toBe(false);
              if (chunk.tiles[y * chunk.size + x].walkable) expect(findPath(chunk, structure.approach, point).length, label).toBeGreaterThan(0);
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(144);
    expect(detached).toBeGreaterThan(20);
    expect(triples).toBeGreaterThan(3);
    expect([...seenSizes].sort()).toEqual([1, 2, 3]);
  });
});
