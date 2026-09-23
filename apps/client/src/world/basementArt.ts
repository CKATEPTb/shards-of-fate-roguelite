import type Phaser from 'phaser';
import type { WorldChunk } from '@shards/shared';
import { grain } from './palette';
import { TILE_SIZE } from './projection';

/** Stone courses and warehouse shelves use the same blocked cells as pathfinding. */
export function drawBasementTerrain(art: Phaser.GameObjects.Graphics, chunk: WorldChunk): void {
  const walkable = (x: number, y: number) => x >= 0 && y >= 0 && x < chunk.size && y < chunk.size && chunk.tiles[y * chunk.size + x].walkable;
  art.fillStyle(0x0d1216).fillRect(0, 0, chunk.size * TILE_SIZE, chunk.size * TILE_SIZE);
  for (let y = 0; y < chunk.size; y++) for (let x = 0; x < chunk.size; x++) {
    const px = x * TILE_SIZE, py = y * TILE_SIZE, variant = grain(x, y, 47);
    if (walkable(x, y)) {
      art.fillStyle([0x303935, 0x343d37, 0x2c3634, 0x384039][variant % 4]).fillRect(px, py, 32, 32);
      for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
        const sx = px + col * 16, sy = py + row * 16;
        art.fillStyle(0x172324, .72).fillRect(sx, sy, 16, 1).fillRect(sx, sy, 1, 16);
        art.fillStyle(0x8f9580, .11).fillRect(sx + 2, sy + 2, 12, 1);
        if ((variant >>> (row * 2 + col)) % 3 === 0) art.fillStyle(0x202b29, .8).fillRect(sx + 7, sy + 7, 5, 1).fillRect(sx + 11, sy + 8, 1, 3);
      }
      if (variant % 7 === 0) art.fillStyle(0x556142, .22).fillRect(px + 4, py + 23, 9, 3).fillRect(px + 8, py + 26, 12, 2);
      if (variant % 19 === 0) art.fillStyle(0xaaa38a, .24).fillRect(px + 21, py + 9, 3, 2).fillRect(px + 23, py + 11, 2, 2);
      if (!walkable(x - 1, y)) art.fillStyle(0x0c171b, .45).fillRect(px, py, 5, 32);
      if (!walkable(x, y - 1)) art.fillStyle(0x0c171b, .52).fillRect(px, py, 32, 7);
      continue;
    }
    const openSides = Number(walkable(x - 1, y)) + Number(walkable(x + 1, y)) + Number(walkable(x, y - 1)) + Number(walkable(x, y + 1));
    if (!openSides) {
      if (variant % 5 === 0) art.fillStyle(0x202c2d, .28).fillRect(px + 3, py + 15, 23, 2);
      continue;
    }
    const shelf = walkable(x, y - 1) && walkable(x, y + 1);
    if (shelf) {
      art.fillStyle(0x141a18).fillRect(px, py + 1, 32, 31);
      art.fillStyle(0x493d2e).fillRect(px + 1, py + 2, 30, 27);
      art.fillStyle(0x725a3b).fillRect(px + 2, py + 2, 28, 4).fillRect(px + 2, py + 15, 28, 4).fillRect(px + 2, py + 27, 28, 3);
      art.fillStyle(0x9d8052).fillRect(px + 3, py + 2, 26, 1).fillRect(px + 3, py + 15, 26, 1);
      art.fillStyle(0x9e8c60).fillRect(px + 4, py + 8, 6, 6).fillRect(px + 18, py + 20, 8, 6);
      art.fillStyle(0x44685b).fillRect(px + 15, py + 6, 3, 8).fillRect(px + 22, py + 9, 4, 5);
      art.fillStyle(0x768967, .7).fillRect(px + 15, py + 7, 1, 4).fillRect(px + 22, py + 10, 1, 3);
      art.fillStyle(0x252c25).fillRect(px + 1, py + 6, 2, 21).fillRect(px + 29, py + 6, 2, 21);
    } else {
      art.fillStyle(0x202b2e).fillRect(px, py, 32, 32);
      for (let row = 0; row < 3; row++) {
        const offset = row % 2 ? -8 : 0;
        for (let col = 0; col < 3; col++) {
          const sx = px + Math.max(0, offset + col * 16), right = Math.min(px + 32, px + offset + col * 16 + 15);
          if (right <= sx) continue;
          art.fillStyle(row === 0 ? 0x52605b : variant % 2 ? 0x3d4b47 : 0x364542).fillRect(sx, py + row * 11, right - sx, 10);
          art.fillStyle(0x8b9584, row === 0 ? .35 : .13).fillRect(sx + 1, py + row * 11, Math.max(1, right - sx - 2), 1);
        }
      }
      if (walkable(x, y + 1)) art.fillStyle(0x899381, .5).fillRect(px, py, 32, 2);
    }
  }
}
