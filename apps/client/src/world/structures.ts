import type Phaser from 'phaser';
import type { Season, WorldChunk, WorldStructure } from '@shards/shared';
import { palettes } from './palette';
import { TILE_SIZE } from './projection';
import type { EnvironmentObject } from './environmentObject';
import { createWalls } from './walls';
import { houseRoofGeometry, type RoofGeometry } from './roofGeometry';
import { houseVisibility } from './house-visibility';

function roofTexture(scene: Phaser.Scene, season: Season, roof: RoofGeometry, variant: number): string {
  const { width, height } = roof.bounds;
  const key = `structure-roof:v2:${season}:${width}:${height}:${variant}`;
  const opening = roof.chimneyOpening;
  if (scene.textures.exists(key)) return key;
  const art = scene.make.graphics({ x: 0, y: 0 });
  const p = palettes[season];
  for (const [row, course] of roof.courses.entries()) {
    const { x: inset, y, width: span, height: depth } = course;
    art.fillStyle(row % 2 ? p.bark[1] : p.bark[0]).fillRect(inset, y, span, depth);
    const right = inset + span;
    for (let x = inset + 3 + row % 2 * 4; x + 11 < right - 3; x += 13) {
      art.fillStyle(p.rock[1], 0.3).fillRect(x, y, 9, Math.min(2, depth));
      if (depth > 2) art.fillStyle(0x192b23, 0.7).fillRect(x + 10, y + 2, 2, Math.min(5, depth - 2));
    }
  }
  const ridge = roof.courses[0];
  art.fillStyle(p.bark[1]).fillRect(ridge.x, 0, ridge.width, 3);
  art.fillStyle(p.bark[0]).fillRect(0, height - 7, width, 7);
  art.fillStyle(p.bark[1]).fillRect(1, height - 7, width - 2, 2);
  art.fillStyle(p.rock[0]).fillRect(width - 35, 10, 17, 24);
  art.fillStyle(p.rock[1]).fillRect(width - 33, 10, 13, 21);
  art.fillStyle(0x192b23).fillRect(opening.x, opening.y, opening.width, opening.height);
  art.fillStyle(p.moss, 0.85).fillRect(9, height - 19, 25, 9).fillRect(20, height - 25, 13, 10);
  if (season === 'winter') art.fillStyle(p.rock[2], 0.8).fillRect(ridge.x, 0, ridge.width, 5).fillRect(8, height - 12, width - 16, 4);
  art.generateTexture(key, width, height);
  art.destroy();
  return key;
}

function wellTexture(scene: Phaser.Scene, season: Season) {
  const key = `structure-well:v1:${season}`;
  if (scene.textures.exists(key)) return key;
  const art = scene.make.graphics({ x: 0, y: 0 });
  const p = palettes[season];
  art.fillStyle(p.rock[0]).fillRect(7, 55, 62, 27).fillRect(14, 49, 49, 38);
  art.fillStyle(p.rock[1]).fillRect(9, 52, 58, 14).fillRect(15, 48, 46, 12);
  art.fillStyle(p.rock[2]).fillRect(12, 51, 52, 3).fillRect(18, 48, 39, 3);
  art.fillStyle(0x14251e).fillRect(20, 51, 37, 10);
  art.fillStyle(p.water[1]).fillRect(25, 57, 28, 3);
  art.fillStyle(p.bark[0]).fillRect(10, 13, 6, 49).fillRect(59, 13, 6, 49).fillRect(8, 11, 59, 7);
  art.fillStyle(p.bark[1]).fillRect(12, 17, 2, 38).fillRect(60, 17, 2, 38).fillRect(13, 12, 49, 2);
  art.fillStyle(0x8d8156).fillRect(36, 17, 2, 35);
  art.fillStyle(p.rock[0]).fillRect(7, 70, 10, 2).fillRect(27, 78, 2, 7).fillRect(53, 70, 2, 12);
  art.fillStyle(p.moss).fillRect(9, 80, 14, 6).fillRect(58, 76, 9, 7);
  art.generateTexture(key, 76, 88);
  art.destroy();
  return key;
}

function createWell(scene: Phaser.Scene, structure: WorldStructure, season: Season): EnvironmentObject {
  const base = { x: (structure.origin.x + structure.width / 2) * TILE_SIZE, y: (structure.origin.y + structure.height) * TILE_SIZE - 2 };
  const image = scene.add.image(base.x, base.y, wellTexture(scene, season)).setOrigin(0.5, 1).setDepth(10 + base.y);
  const bounds = { x: base.x - 38, y: base.y - 88, width: 76, height: 88 };
  return { images: [image], occluder: { base, bounds, silhouettes: [
    { x: bounds.x + 7, y: bounds.y + 48, width: 62, height: 40 },
    { x: bounds.x + 10, y: bounds.y + 11, width: 6, height: 42 },
    { x: bounds.x + 59, y: bounds.y + 11, width: 6, height: 42 },
    { x: bounds.x + 8, y: bounds.y + 11, width: 59, height: 7 },
  ] } };
}

/** Wall cells come from the core; gaps and courtyards stay visibly open and clickable. */
export function createStructures(scene: Phaser.Scene, chunk: WorldChunk): EnvironmentObject[] {
  const objects: EnvironmentObject[] = [];
  for (const structure of chunk.structures) {
    if (structure.kind === 'well') { objects.push(createWell(scene, structure, chunk.season)); continue; }
    const roof = structure.kind === 'house' ? houseRoofGeometry(structure) : undefined;
    const house = roof ? houseVisibility(structure, roof) : undefined;
    objects.push(...createWalls(scene, structure, chunk.season, house));
    if (roof && house) {
      const { base, bounds, chimneyOpening } = roof;
      const texture = roofTexture(scene, chunk.season, roof, structure.variant);
      const image = scene.add.image(bounds.x, bounds.y, texture).setOrigin(0, 0).setDepth(10 + base.y + 0.1);
      const smokeSource = { x: bounds.x + chimneyOpening.x + chimneyOpening.width / 2, y: bounds.y + chimneyOpening.y };
      objects.push({ images: [image], occluder: { base, bounds, silhouettes: house.roofSilhouettes, house: { geometry: house, part: 'roof' } }, smokeSource });
    }
  }
  return objects;
}
