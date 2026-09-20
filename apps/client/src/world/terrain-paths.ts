import type Phaser from 'phaser';
import type { WorldChunk } from '@shards/shared';
import { grain, type WorldPalette } from './palette';
import { TILE_SIZE } from './projection';
import { mixColour, pathMaterial, smoothStep } from './terrain-materials';
import { planTrails } from './trail-routes';
import { TRAIL_WIDTH, trailCoverage, trailDistance } from './trail-geometry';

function drawCobbles(art: Phaser.GameObjects.Graphics, px: number, py: number, p: WorldPalette, distance: (x: number, y: number) => number, material: (x: number, y: number) => number) {
  // Small staggered courses continue across tile boundaries, clipped to the same narrow strip.
  for (let row = Math.floor(py / 4); row * 4 < py + TILE_SIZE; row++) {
    const top = Math.max(py, row * 4 + 1);
    const bottom = Math.min(py + TILE_SIZE, row * 4 + 4);
    const shift = row % 2 * 3;
    for (let col = Math.floor((px - shift) / 6); col * 6 + shift < px + TILE_SIZE; col++) {
      const left = Math.max(px, col * 6 + shift + 1);
      const right = Math.min(px + TILE_SIZE, col * 6 + shift + 6);
      if (right <= left || bottom <= top) continue;
      const finish = material((left + right) / 2, (top + bottom) / 2);
      if (finish < 0.63) continue;
      if ([[left, top], [right, top], [left, bottom], [right, bottom]].some(([x, y]) => distance(x - px, y - py) > TRAIL_WIDTH / 2 - 0.3)) continue;
      const variant = grain(col, row, 83);
      const alpha = smoothStep(0.63, 0.82, finish);
      const colour = mixColour(p.path[variant % p.path.length], p.rock[1], 0.3);
      art.fillStyle(colour, alpha).fillRect(left, top, right - left, bottom - top);
      art.fillStyle(p.rock[2], alpha * 0.27).fillRect(left + 1, top, Math.max(1, right - left - 2), 1);
    }
  }
}

function drawTrailSurface(art: Phaser.GameObjects.Graphics, px: number, py: number, earth: number, paving: number,
  distance: (x: number, y: number) => number, material: (x: number, y: number) => number, naturalSpur: boolean) {
  // Run-length batches keep the finer 2px edge mask cheap when baking the terrain texture.
  for (let oy = 0; oy < TILE_SIZE; oy += 2) {
    let start = 0;
    let colour = 0;
    let alpha = 0;
    for (let ox = 0; ox <= TILE_SIZE; ox += 2) {
      const coverage = ox < TILE_SIZE ? trailCoverage(distance(ox + 1, oy + 1)) : 0;
      const finish = coverage > 0 ? material(px + ox + 1, py + oy + 1) : 0;
      const wear = naturalSpur ? 0.3 : 0.24 + smoothStep(0.16, 0.76, finish) * 0.64;
      const nextAlpha = Math.round(wear * coverage * 10) / 10;
      const nextColour = nextAlpha > 0 ? mixColour(earth, paving, naturalSpur ? 0 : smoothStep(0.57, 0.8, finish) * 0.55) : 0;
      if (nextAlpha === alpha && nextColour === colour) continue;
      if (alpha > 0) art.fillStyle(colour, alpha).fillRect(px + start, py + oy, ox - start, 2);
      start = ox;
      alpha = nextAlpha;
      colour = nextColour;
    }
  }
}

/** Draw selected gate-to-gate routes, not every adjacency in broad carved terrain. */
export function drawPaths(art: Phaser.GameObjects.Graphics, chunk: WorldChunk, p: WorldPalette) {
  const material = pathMaterial(chunk);
  const earth = mixColour(p.ground[1], p.bark[1], chunk.season === 'winter' ? 0.3 : 0.7);
  for (const cell of planTrails(chunk).cells) {
    const px = cell.x * TILE_SIZE;
    const py = cell.y * TILE_SIZE;
    const distance = trailDistance(cell.directions);
    drawTrailSurface(art, px, py, earth, p.path[2], distance, material, cell.naturalSpur);
    if (!cell.naturalSpur) drawCobbles(art, px, py, p, distance, material);
  }
}
