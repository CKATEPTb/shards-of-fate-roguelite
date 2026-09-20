import Phaser from 'phaser';
import type { Season } from '@shards/shared';
import type { Bounds } from './occlusion';
import { grain, palettes, type WorldPalette } from './palette';
import { drawTreeCrown, drawTreeTrunk } from '../art/environment/primitives';

export type PropKind = 'oak' | 'pine' | 'birch' | 'bush';
export interface PropTexture {
  key: string;
  width: number;
  height: number;
  silhouettes: Bounds[];
  crownKey?: string;
  crownBounds?: Bounds;
}
const textureCaches = new WeakMap<Phaser.Textures.TextureManager, Map<string, PropTexture>>();

interface LeafLobe { x: number; y: number; rx: number; ry: number }

function leafLobe(art: Phaser.GameObjects.Graphics, lobe: LeafLobe, colour: number, salt: number) {
  art.fillStyle(colour);
  const top = Math.round(lobe.y - lobe.ry);
  const bottom = Math.round(lobe.y + lobe.ry);
  for (let y = top; y < bottom; y += 4) {
    const rowHeight = Math.min(4, bottom - y);
    const vertical = (y + rowHeight / 2 - lobe.y) / lobe.ry;
    const radius = Math.sqrt(Math.max(0, 1 - vertical * vertical)) * lobe.rx;
    const fringe = grain(y, salt, 3) % 3 === 0 ? 2 : 0;
    const span = Math.max(2, Math.floor(radius / 2) * 2 - fringe);
    art.fillRect(Math.round(lobe.x - span), y, span * 2, rowHeight);
  }
}

function crown(art: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, p: WorldPalette, salt: number) {
  // Three overlapping leaf masses leave real notches and asymmetric edges,
  // instead of putting decorative pixels inside a rectangular silhouette.
  const lean = (salt % 3 - 1) * 2;
  const lobes: LeafLobe[] = [
    { x: x + width * 0.28, y: y + height * 0.61, rx: width * 0.28, ry: height * 0.35 },
    { x: x + width * 0.72, y: y + height * 0.6 - lean, rx: width * 0.28, ry: height * 0.34 },
    { x: x + width * 0.5 + lean, y: y + height * 0.3, rx: width * 0.29, ry: height * 0.29 },
  ];
  lobes.forEach((lobe, i) => leafLobe(art, lobe, p.leaf[0], salt + i));
  lobes.forEach((lobe, i) => {
    leafLobe(art, { x: lobe.x - 1, y: lobe.y - 2, rx: lobe.rx - 3, ry: lobe.ry - 3 }, p.leaf[1], salt + i + 11);
    leafLobe(art, { x: lobe.x - lobe.rx * 0.18, y: lobe.y - lobe.ry * 0.25, rx: lobe.rx * 0.65, ry: lobe.ry * 0.52 }, p.leaf[2], salt + i + 23);
  });
  for (let i = 0; i < 18; i++) {
    const seed = grain(i, salt, width);
    const dx = x + 3 + seed % Math.max(1, width - 9);
    const dy = y + 3 + (seed >>> 8) % Math.max(1, height - 9);
    // Keep small highlights inside the canopy, including its indented corners.
    const inside = lobes.some(lobe => ((dx + 2 - lobe.x) / (lobe.rx - 3)) ** 2 + ((dy + 1 - lobe.y) / (lobe.ry - 3)) ** 2 < 0.8);
    if (inside) art.fillStyle(p.leaf[i % 4 === 0 ? 3 : 1], 0.85).fillRect(Math.round(dx), Math.round(dy), 3 + seed % 4, 2 + (seed >>> 4) % 2);
  }
}

function drawBush(art: Phaser.GameObjects.Graphics, width: number, height: number, variant: number, p: WorldPalette): Bounds[] {
  art.fillStyle(p.darkLeaf[0], 0.4).fillEllipse(width / 2, height - 3, width - 2, 5);
  // Low, soft leaf clusters distinguish ground that heroes can push through.
  crown(art, 1, 1, width - 2, height - 3, p, variant + 19);
  if (variant % 2 === 0) {
    art.fillStyle(p.flower, 0.8).fillRect(9, height - 11, 2, 2).fillRect(width - 11, height - 8, 2, 2);
  }
  return [{ x: 3, y: 2, width: width - 6, height: height - 4 }];
}

/** Tiny shared textures are generated once per season/species/variant, never per frame. */
export function ensurePropTexture(scene: Phaser.Scene, season: Season, kind: PropKind, variant: number): PropTexture {
  const key = `environment:v5:${season}:${kind}:${variant}`;
  const cache = textureCaches.get(scene.textures) ?? new Map<string, PropTexture>();
  textureCaches.set(scene.textures, cache);
  const cached = cache.get(key);
  if (cached && scene.textures.exists(key)) return cached;
  const sizes: Record<PropKind, [number, number]> = {
    oak: [116 + variant * 10, 142 + variant * 12], pine: [116 + variant * 10, 142 + variant * 12],
    birch: [90 + variant * 8, 142 + variant * 12], bush: [30 + variant * 2, 20 + variant * 2],
  };
  const [width, height] = sizes[kind];
  const art = scene.make.graphics({ x: 0, y: 0 });
  const p = palettes[season];
  const isTree = kind === 'oak' || kind === 'pine' || kind === 'birch';
  let silhouettes: Bounds[];
  let crownKey: string | undefined;
  let crownBounds: Bounds | undefined;
  if (isTree) {
    const scale = (height - 4) / 177;
    const baseY = height - 11 * scale;
    const style = { scale, narrow: kind === 'birch', birch: kind === 'birch', dark: kind === 'pine' };
    drawTreeTrunk(art, width / 2, baseY, p, style);
    const foliage = scene.make.graphics({ x: 0, y: 0 });
    drawTreeCrown(foliage, width / 2, baseY, p, style);
    crownKey = `${key}:crown`;
    foliage.generateTexture(crownKey, width, height);
    foliage.destroy();
    crownBounds = { x: 6, y: 2, width: width - 12, height: height - 40 * scale };
    silhouettes = [crownBounds, { x: width / 2 - 10 * scale, y: height - 45 * scale, width: 22 * scale, height: 45 * scale }];
  } else silhouettes = drawBush(art, width, height, variant, p);
  art.generateTexture(key, width, height);
  art.destroy();
  const result = { key, width, height, silhouettes, crownKey, crownBounds };
  cache.set(key, result);
  return result;
}
