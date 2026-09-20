import type { GridPoint, WorldChunk } from '@shards/shared';
import { inBounds, tileIndex } from './grid';

export interface ChunkRegions { labels: Int16Array; sizes: number[]; interiorSizes: number[] }

/** Independent flood fill over actual terrain; generation plans are deliberately not consulted. */
export function chunkRegions(chunk: WorldChunk): ChunkRegions {
  const labels = new Int16Array(chunk.tiles.length).fill(-1);
  const sizes: number[] = [];
  const interiorSizes: number[] = [];
  const queue = new Int32Array(chunk.tiles.length);
  for (let first = 0; first < chunk.tiles.length; first++) {
    if (!chunk.tiles[first].walkable || labels[first] !== -1) continue;
    const region = sizes.length;
    let read = 0; let write = 1; let interior = 0;
    queue[0] = first; labels[first] = region;
    while (read < write) {
      const index = queue[read++];
      const x = index % chunk.size; const y = Math.floor(index / chunk.size);
      if (x > 0 && y > 0 && x < chunk.size - 1 && y < chunk.size - 1) interior++;
      for (const next of [x > 0 ? index - 1 : -1, x < chunk.size - 1 ? index + 1 : -1, y > 0 ? index - chunk.size : -1, y < chunk.size - 1 ? index + chunk.size : -1]) {
        if (next >= 0 && labels[next] === -1 && chunk.tiles[next].walkable) {
          labels[next] = region; queue[write++] = next;
        }
      }
    }
    sizes.push(write); interiorSizes.push(interior);
  }
  return { labels, sizes, interiorSizes };
}

export function regionAt(chunk: WorldChunk, regions: ChunkRegions, point: GridPoint): number {
  return inBounds(point, chunk.size) ? regions.labels[tileIndex(point, chunk.size)] : -1;
}
