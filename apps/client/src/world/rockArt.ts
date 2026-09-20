import type Phaser from 'phaser';
import type { Season } from '@shards/shared';
import type { Bounds } from './occlusion';
import { palettes, type WorldPalette } from './palette';
import { TILE_SIZE } from './projection';
import type { RockFormation } from './rockLayout';

export interface RockShape { width: number; height: number; elevation: number; silhouette: Bounds[] }
interface RockTexture extends RockShape { key: string }
const caches = new WeakMap<Phaser.Textures.TextureManager, Map<string, RockTexture>>();
type Polygon = Array<[number, number]>;

/** Scanline rasterization gives crisp natural outlines and the exact same occlusion mask. */
function polygonBands(points: Polygon, width: number, height: number): Bounds[] {
  const bands: Bounds[] = [];
  for (let y = 0; y < height; y += 2) {
    const scan = y + Math.min(2, height - y) / 2;
    const intersections: number[] = [];
    for (let index = 0; index < points.length; index++) {
      const from = points[index]; const to = points[(index + 1) % points.length];
      if ((from[1] <= scan && to[1] > scan) || (to[1] <= scan && from[1] > scan)) intersections.push(from[0] + (scan - from[1]) * (to[0] - from[0]) / (to[1] - from[1]));
    }
    intersections.sort((a, b) => a - b);
    for (let index = 0; index + 1 < intersections.length; index += 2) {
      const left = Math.max(0, Math.floor(intersections[index] / 2) * 2);
      const right = Math.min(width, Math.ceil(intersections[index + 1] / 2) * 2);
      if (right <= left) continue;
      const previous = bands[bands.length - 1];
      if (previous && previous.x === left && previous.width === right - left && previous.y + previous.height === y) previous.height += Math.min(2, height - y);
      else bands.push({ x: left, y, width: right - left, height: Math.min(2, height - y) });
    }
  }
  return bands;
}

export function rockShape(formation: Pick<RockFormation, 'width' | 'height' | 'variant'>): RockShape {
  const single = formation.width === 1 && formation.height === 1;
  const width = single ? 26 + formation.variant % 2 : formation.width * TILE_SIZE - 4;
  const elevation = single ? 0 : 6 + (formation.width + formation.height > 4 ? 2 : 0) + formation.variant * 2;
  const height = single ? 22 + Math.floor(formation.variant / 2) : formation.height * TILE_SIZE - 4 + elevation;
  const lean = formation.variant % 2 ? 0.06 : -0.04;
  const outline: Polygon = single ? [
    [0, height * 0.48], [4, height * 0.18], [width * (0.38 + lean), 0], [width * 0.75, 2],
    [width - 1, height * 0.35], [width, height * 0.7], [width - 5, height], [7, height], [1, height - 4],
  ] : [
    [0, height * 0.4], [4, height * 0.19], [width * 0.16, 5],
    [width * (0.43 + lean), 0], [width * 0.72, 3], [width - 5, height * 0.17],
    [width, height * 0.4], [width - 2, height * 0.7], [width - 9, height * 0.9],
    [width * 0.73, height], [width * 0.3, height - 2], [7, height * 0.9], [1, height * 0.68],
  ];
  return { width, height, elevation, silhouette: polygonBands(outline, width, height) };
}

function fillBands(art: Phaser.GameObjects.Graphics, bands: Bounds[], color: number, alpha = 1): void {
  art.fillStyle(color, alpha);
  for (const band of bands) art.fillRect(band.x, band.y, band.width, band.height);
}

function facet(art: Phaser.GameObjects.Graphics, shape: RockShape, polygon: Polygon, color: number, alpha = 1): void {
  art.fillStyle(color, alpha);
  for (const face of polygonBands(polygon, shape.width, shape.height)) for (const body of shape.silhouette) {
    const x = Math.max(face.x, body.x); const y = Math.max(face.y, body.y);
    const right = Math.min(face.x + face.width, body.x + body.width); const bottom = Math.min(face.y + face.height, body.y + body.height);
    if (right > x && bottom > y) art.fillRect(x, y, right - x, bottom - y);
  }
}

function drawBoulder(art: Phaser.GameObjects.Graphics, shape: RockShape, palette: WorldPalette): void {
  const { width: w, height: h } = shape;
  fillBands(art, shape.silhouette, palette.rock[0]);
  facet(art, shape, [[2, h * 0.4], [w * 0.6, 2], [w - 2, h * 0.5], [w - 3, h - 3], [8, h - 1], [1, h * 0.7]], palette.rock[1]);
  facet(art, shape, [[3, h * 0.38], [w * 0.4, 1], [w * 0.75, 3], [w * 0.67, h * 0.45], [w * 0.38, h * 0.62], [2, h * 0.6]], palette.rock[2], 0.8);
  facet(art, shape, [[w * 0.74, 5], [w - 1, h * 0.42], [w - 2, h - 4], [w * 0.66, h - 2], [w * 0.6, h * 0.63]], palette.rock[0], 0.65);
  facet(art, shape, [[3, h - 4], [8, h - 5], [10, h - 1], [4, h]], palette.moss, 0.6);
}

function drawOutcrop(art: Phaser.GameObjects.Graphics, shape: RockShape, palette: WorldPalette, variant: number): void {
  const { width: w, height: h } = shape;
  const lean = (variant % 2 ? 1 : -1) * w * 0.04;
  fillBands(art, shape.silhouette, palette.rock[0]);
  // Broad sloping faces describe a low weathered mass, not a stack of cliff ledges.
  facet(art, shape, [[3, h * 0.33], [w * 0.2, 5], [w * 0.55, 2], [w * 0.84, h * 0.19],
    [w - 4, h * 0.55], [w * 0.84, h * 0.84], [w * 0.48, h - 5], [w * 0.17, h * 0.88], [2, h * 0.57]], palette.rock[1]);
  facet(art, shape, [[5, h * 0.3], [w * 0.18, 5], [w * 0.43 + lean, 1], [w * 0.68, 5],
    [w * 0.77, h * 0.26], [w * 0.57, h * 0.43], [w * 0.3, h * 0.49], [w * 0.09, h * 0.57]], palette.rock[2], 0.58);
  facet(art, shape, [[w * 0.75, h * 0.17], [w - 4, h * 0.31], [w - 2, h * 0.65],
    [w * 0.79, h * 0.88], [w * 0.58, h * 0.94], [w * 0.68, h * 0.58]], palette.rock[0], 0.42);
  facet(art, shape, [[w * 0.13, h * 0.61], [w * 0.36, h * 0.5], [w * 0.55, h * 0.64],
    [w * 0.43, h * 0.85], [w * 0.2, h * 0.83]], palette.rock[2], 0.12);
  // Short branching fractures follow facets; no line spans the full rock width.
  const split = w * (0.5 + variant * 0.025);
  facet(art, shape, [[split + 3, h * 0.1], [split + 5, h * 0.1], [split - 3, h * 0.38],
    [split + 5, h * 0.6], [split + 1, h * 0.74], [split - 1, h * 0.73], [split + 2, h * 0.6], [split - 6, h * 0.38]], palette.rock[0], 0.8);
  facet(art, shape, [[split - 5, h * 0.38], [w * 0.3, h * 0.48], [w * 0.17, h * 0.45],
    [w * 0.3, h * 0.51], [split - 3, h * 0.41]], palette.rock[0], 0.7);
  facet(art, shape, [[split + 3, h * 0.58], [w * 0.76, h * 0.52], [w * 0.84, h * 0.39],
    [w * 0.74, h * 0.55], [split + 4, h * 0.62]], palette.rock[0], 0.55);
  facet(art, shape, [[w * 0.08, h * 0.78], [w * 0.2, h * 0.75], [w * 0.31, h * 0.88],
    [w * 0.22, h * 0.94], [w * 0.1, h * 0.86]], palette.moss, 0.6);
  facet(art, shape, [[w * 0.66, h * 0.86], [w * 0.76, h * 0.82], [w * 0.78, h * 0.9], [w * 0.63, h * 0.96]], palette.moss, 0.45);
}

export function ensureRockTexture(scene: Phaser.Scene, season: Season, formation: RockFormation): RockTexture {
  const key = `natural-rock:v2:${season}:${formation.width}x${formation.height}:${formation.variant}`;
  const cache = caches.get(scene.textures) ?? new Map<string, RockTexture>();
  caches.set(scene.textures, cache);
  const saved = cache.get(key);
  if (saved && scene.textures.exists(key)) return saved;
  const shape = rockShape(formation);
  const art = scene.make.graphics({ x: 0, y: 0 });
  if (formation.width === 1) drawBoulder(art, shape, palettes[season]);
  else drawOutcrop(art, shape, palettes[season], formation.variant);
  art.generateTexture(key, shape.width, shape.height);
  art.destroy();
  const result = { ...shape, key };
  cache.set(key, result);
  return result;
}
