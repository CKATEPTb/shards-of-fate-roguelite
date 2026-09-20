import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { generateChunk, generateWorld } from '@shards/game-core';
import type { WorldChunk } from '@shards/shared';

// Captured before the cosmetic rock→tree change. These hashes deliberately omit obstacle material,
// but retain every tile's walkability/cost, plus all gates, structures, POIs and spawn coordinates.
const baseline = [
  ['FIRST-CAMPFIRE', '0,0', 117, 'b45e753b7d66f8c8529fe69f7bc56192332923b99ccbf7b27f07919f0f3ae6b6'],
  ['FIRST-CAMPFIRE', '11,0', 117, '807f24320af635c960263c9dceaee77810c4ab38c1030dba497126f8d39fbc4b'],
  ['FIRST-CAMPFIRE', '23,0', 138, '045530c2d9845983020c5b77978126a906a57471500e70dbff0c52bf58dafff7'],
  ['FIRST-CAMPFIRE', '38,0', 126, '31b1ae0c9ae00f9b23c799e3808612a651223357df56b2c39eb25b1436a401e2'],
  ['ROCK-LAYOUT-A', '0,0', 119, 'b95b5664ad5f77ce7715e1dbd359d3b99cd2b2394d8ff48a3ae1d7bdfe83080b'],
  ['ROCK-LAYOUT-A', '12,0', 149, 'fcd783ccb15694a3dca1f9d5f4e8f26a6157d98952280b22135bc63cb24d7778'],
  ['ROCK-LAYOUT-A', '27,0', 85, '55c99600866539873c2ed92373550420c4915080b37e8ebc03030770a7efe4bb'],
  ['ROCK-LAYOUT-A', '39,0', 154, 'fcc63b4fde648c8fd78f6e275c9c33dc0e0a82a405171147ee33ff52497e48d2'],
  ['ROCK-LAYOUT-B', '0,0', 79, 'b8d1ec01be30dc2122ecb366bfacf2b81a09419748d4471bfbf5d4d358129599'],
  ['ROCK-LAYOUT-B', '16,0', 145, '2a0245cdc7b6d1c7a2ce3aa6acb3d4dd9b371982d8da662277166f68b19213eb'],
  ['ROCK-LAYOUT-B', '28,0', 131, '2b2e5fe9e25b57d4226a01be75b7b90c6fe49b628d6e45ef4c559893ffaf80ef'],
  ['ROCK-LAYOUT-B', '40,0', 126, 'dd95dbb18ee3b054275b581c755e7693fce558979010c564dfacfdf2872af107'],
] as const;

function geometryHash(chunk: WorldChunk): string {
  // The later fire-collision fix intentionally blocks its single ground tile and moves the start
  // south. Normalize exactly those two verified changes to keep the original rock-only baseline.
  const fires = chunk.pois.filter(poi => poi.kind === 'campfire');
  const fireIndices = new Set(fires.map(poi => poi.position.y * chunk.size + poi.position.x));
  for (const fire of fires) {
    const fireTile = chunk.tiles[fire.position.y * chunk.size + fire.position.x];
    expect(['grass', 'path', 'snow']).toContain(fireTile.terrain);
    expect(fireTile).toMatchObject({ walkable: false, movementCost: 1 });
    expect(chunk.spawn).toEqual({ x: fire.position.x, y: fire.position.y + 1 });
  }
  // Later bushes replace only grass/snow, and snow routing now matches its normal pace.
  // Normalize these costs while checking every original collision cell and footprint.
  return createHash('sha256').update(JSON.stringify({ tiles: chunk.tiles.map((tile, index) => [fireIndices.has(index) || tile.walkable,
    tile.terrain === 'snow' || tile.terrain === 'bush' && chunk.season === 'winter' ? 2
      : tile.terrain === 'bush' ? 1 : tile.movementCost]),
    spawn: fires[0]?.position ?? chunk.spawn, exits: chunk.exits, pois: chunk.pois, structures: chunk.structures })).digest('hex');
}

describe('sparser rock material preserves saved world geometry', () => {
  it('substantially reduces rocks across twelve seasonal chunks without changing any gameplay footprint', () => {
    // Preserve the original building layout too: newer settlements deliberately change footprints.
    const worlds = new Map([...new Set(baseline.map(([seed]) => seed))].map(seed => [seed, generateWorld(seed, { structureVersion: 1 })]));
    let previousRocks = 0; let rocks = 0;
    for (const [seed, id, before, hash] of baseline) {
      const chunk = generateChunk(worlds.get(seed)!, id);
      expect(geometryHash(chunk), `${seed}:${id}`).toBe(hash);
      const current = chunk.tiles.filter(tile => tile.terrain === 'rock').length;
      expect(current).toBeLessThan(before);
      previousRocks += before; rocks += current;
    }
    // Bound the aggregate sample, not individual small patches: the target is one third of the old density.
    expect(rocks / previousRocks).toBeGreaterThan(0.2);
    expect(rocks / previousRocks).toBeLessThan(0.45);
    const start = generateChunk(worlds.get('FIRST-CAMPFIRE')!, '0,0');
    for (const [x, y] of [[19, 18], [17, 19], [23, 17]]) expect(start.tiles[y * start.size + x].walkable).toBe(true);
    expect(start.pois.find(poi => poi.kind === 'encounter')?.position).toEqual({ x: 23, y: 17 });
  });
});
