import Phaser from 'phaser';
import type { WorldChunk } from '@shards/shared';
import { grain, palettes, type WorldPalette } from './palette';
import { TILE_SIZE } from './projection';
import { drawGroundFleck, drawTreeShadow } from '../art/environment/primitives';
import { drawWaterSurface } from './water';
import { drawPaths } from './terrain-paths';
import { drawStructureFloors } from './terrain-floors';
import { drawRockShadows } from './rocks';

function drawGroundCover(art: Phaser.GameObjects.Graphics, px: number, py: number, x: number, y: number, palette: WorldPalette) {
  for (let dot = 0; dot < 7; dot++) {
    const seed = grain(x, y, dot);
    const dx = px + 3 + seed % 25;
    const dy = py + 3 + (seed >>> 6) % 25;
    drawGroundFleck(art, dx, dy, palette, seed);
    if (seed % 13 === 0) art.fillStyle(palette.flower, 0.8).fillRect(dx - 1, dy - 1, 3, 2);
    if (seed % 7 === 0) art.fillStyle(palette.leaf[2], 0.45).fillRect(dx - 2, dy + 3, 5, 2);
    if (seed % 23 === 0) art.fillStyle(palette.rock[1], 0.5).fillRect(dx + 1, dy + 4, 3, 2);
  }
}

/** Ground and low clutter are baked once. Tall objects belong to the depth-sorted environment. */
export function createTerrainTexture(scene: Phaser.Scene, chunk: WorldChunk, key: string) {
  const art = scene.make.graphics({ x: 0, y: 0 });
  const p = palettes[chunk.season];
  for (let y = 0; y < chunk.size; y++) {
    for (let x = 0; x < chunk.size; x++) {
      const tile = chunk.tiles[y * chunk.size + x];
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;
      const variant = grain(x, y, chunk.season.length);
      art.fillStyle(p.ground[variant % p.ground.length]).fillRect(px, py, TILE_SIZE, TILE_SIZE);
      drawGroundCover(art, px, py, x, y, p);
      if (tile.terrain === 'snow') art.fillStyle(0xd0d9ce, 0.24).fillRect(px + 6, py + 18, 11, 3);
    }
  }
  drawWaterSurface(art, chunk, p);
  drawPaths(art, chunk, p);
  drawStructureFloors(art, chunk, p);
  // Bake ground shadows after every surface so roads and floors receive the same shade.
  for (let y = 0; y < chunk.size; y++) for (let x = 0; x < chunk.size; x++) {
    const tile = chunk.tiles[y * chunk.size + x];
    if (tile.walkable || tile.terrain === 'water' || tile.terrain === 'wall') continue;
    if (tile.terrain === 'tree') drawTreeShadow(art, x * TILE_SIZE + 16, y * TILE_SIZE + 19, 0.6);
  }
  drawRockShadows(art, chunk);
  art.generateTexture(key, chunk.size * TILE_SIZE, chunk.size * TILE_SIZE);
  art.destroy();
}
