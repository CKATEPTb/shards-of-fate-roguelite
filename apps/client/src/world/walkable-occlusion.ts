import type { GridPoint, WorldChunk } from '@shards/shared';
import { TILE_SIZE } from './projection';

/** Uses the exact ground point, never a nearby free cell or the sprite's head. */
export class WalkableGround {
  constructor(private chunk: Pick<WorldChunk, 'size' | 'tiles'>) {}

  at(point: GridPoint): { x: number; y: number; width: number; height: number } | undefined {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    const x = Math.floor(point.x / TILE_SIZE);
    const y = Math.floor(point.y / TILE_SIZE);
    if (x < 0 || y < 0 || x >= this.chunk.size || y >= this.chunk.size) return;
    if (!this.chunk.tiles[y * this.chunk.size + x].walkable) return;
    return { x: x * TILE_SIZE, y: y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE };
  }
}
