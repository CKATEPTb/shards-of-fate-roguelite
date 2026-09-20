import type { GridPoint, WorldChunk } from '@shards/shared';
import { hashString } from '../random';
import { makeTile } from './carving';
import { withinStructure } from './structures';

const near = (a: GridPoint, b: GridPoint, radius: number) => Math.abs(a.x - b.x) <= radius && Math.abs(a.y - b.y) <= radius;

/** Add low undergrowth to open ground without changing any walls, routes or entrances. */
export function applyBushes(chunk: WorldChunk, seed: string): void {
  const salt = `bushes-v1:${hashString(seed)}:${chunk.id}`;
  const patchWidth = Math.ceil(chunk.size / 4);
  const patches = Array.from({ length: patchWidth * patchWidth }, (_, index) => hashString(`${salt}:patch:${index}`) % 100 < 35);
  for (let y = 1; y < chunk.size - 1; y++) for (let x = 1; x < chunk.size - 1; x++) {
    const index = y * chunk.size + x;
    const tile = chunk.tiles[index];
    if (!tile.walkable || tile.terrain !== 'grass' && tile.terrain !== 'snow') continue;
    if (!patches[Math.floor(y / 4) * patchWidth + Math.floor(x / 4)] || hashString(`${salt}:leaf:${x}:${y}`) % 100 >= 70) continue;
    const point = { x, y };
    if (near(point, chunk.spawn, 2) || chunk.pois.some(poi => near(point, poi.position, 2))
      || chunk.exits.some(exit => near(point, exit.position, 3))
      || chunk.structures.some(structure => withinStructure(point, structure, 1))) continue;
    chunk.tiles[index] = makeTile('bush');
  }
}
