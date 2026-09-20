import type Phaser from 'phaser';
import type { Season, WorldStructure } from '@shards/shared';
import { grain, palettes, type WorldPalette } from './palette';
import { TILE_SIZE } from './projection';
import type { Bounds } from './occlusion';
import type { EnvironmentObject } from './environmentObject';
import type { HouseVisibility } from './house-visibility';
import { connectedWallRuns, exposedIntervals, wallElevation, type WallRun } from './wallGeometry';

interface WallTexture { key: string; width: number; height: number; elevation: number; silhouettes: Bounds[] }

function clippedRect(art: Phaser.GameObjects.Graphics, clip: Bounds, x: number, y: number, width: number, height: number): void {
  const left = Math.max(clip.x, x); const top = Math.max(clip.y, y);
  const right = Math.min(clip.x + clip.width, x + width); const bottom = Math.min(clip.y + clip.height, y + height);
  if (right > left && bottom > top) art.fillRect(left, top, right - left, bottom - top);
}

/** Material coordinates belong to the building, so masonry continues across every run and corner. */
function masonry(art: Phaser.GameObjects.Graphics, clip: Bounds, phaseX: number, phaseY: number, p: WorldPalette, variant: number, face: boolean): void {
  art.fillStyle(p.rock[0]).fillRect(clip.x, clip.y, clip.width, clip.height);
  const course = face ? 9 : 10;
  const brick = face ? 20 : 18;
  for (let row = Math.floor(phaseY / course); row * course < phaseY + clip.height; row++) {
    const offset = (row % 2) * Math.floor(brick / 2);
    const y = clip.y + row * course - phaseY;
    for (let col = Math.floor((phaseX + offset) / brick); col * brick - offset < phaseX + clip.width; col++) {
      const x = clip.x + col * brick - offset - phaseX;
      const variation = grain(col, row, variant) % 5;
      art.fillStyle(p.rock[variation === 0 ? 2 : 1], face ? 0.86 : 1);
      clippedRect(art, clip, x + 1, y + 1, brick - 2, course - 2);
      art.fillStyle(p.rock[2], face ? 0.33 : 0.55);
      clippedRect(art, clip, x + 2, y + 1, brick - 4, 1);
    }
  }
}

function wallTexture(scene: Phaser.Scene, structure: WorldStructure, season: Season, run: WallRun): WallTexture {
  // A physical wall is one tile deep. The former 51px face repeated at every row made
  // vertical walls look like stacked slabs; elevation is now separate from that depth.
  const ruined = structure.kind === 'ruin';
  const elevation = wallElevation(structure.kind);
  const width = run.length * TILE_SIZE;
  const faces = exposedIntervals(run.south);
  const height = TILE_SIZE + (faces.length ? elevation - 2 : 0);
  const key = `structure-wall:v3:${season}:${structure.kind}:${structure.variant}:${run.row}:${run.start}:${run.length}:${run.north.map(Number).join('')}:${run.south.map(Number).join('')}`;
  const silhouettes: Bounds[] = [{ x: 0, y: 0, width, height: TILE_SIZE }, ...faces.map(face => ({ x: face.start * TILE_SIZE, y: TILE_SIZE, width: face.length * TILE_SIZE, height: elevation - 2 }))];
  if (scene.textures.exists(key)) return { key, width, height, elevation, silhouettes };
  const art = scene.make.graphics({ x: 0, y: 0 });
  const p = palettes[season];
  masonry(art, silhouettes[0], run.start * TILE_SIZE, run.row * TILE_SIZE, p, structure.variant, false);

  // Exposed north/side caps form one continuous contour. Internal tile edges have no trim.
  const cap = ruined ? p.rock[2] : p.bark[0];
  for (const edge of exposedIntervals(run.north)) {
    art.fillStyle(cap).fillRect(edge.start * TILE_SIZE, 0, edge.length * TILE_SIZE, 3);
    art.fillStyle(ruined ? p.rock[1] : p.bark[1]).fillRect(edge.start * TILE_SIZE + 1, 1, edge.length * TILE_SIZE - 2, 1);
  }
  art.fillStyle(cap).fillRect(0, 0, 3, TILE_SIZE).fillRect(width - 3, 0, 3, TILE_SIZE);
  art.fillStyle(ruined ? p.rock[1] : p.bark[1], 0.7).fillRect(1, 0, 1, TILE_SIZE).fillRect(width - 2, 0, 1, TILE_SIZE);

  for (const face of faces) {
    const left = face.start * TILE_SIZE; const span = face.length * TILE_SIZE;
    const area = { x: left, y: TILE_SIZE, width: span, height: elevation - 2 };
    masonry(art, area, (run.start + face.start) * TILE_SIZE, 0, p, structure.variant, true);
    art.fillStyle(cap).fillRect(left, TILE_SIZE - 3, span, 3);
    art.fillStyle(ruined ? p.rock[2] : p.bark[1]).fillRect(left + 1, TILE_SIZE - 3, span - 2, 1);
    art.fillStyle(p.rock[0]).fillRect(left, height - 3, span, 3);
    if (!ruined) {
      // End posts belong to the real corner or doorway, never every 32px cell.
      art.fillStyle(p.bark[0]).fillRect(left, TILE_SIZE, 4, elevation - 2).fillRect(left + span - 4, TILE_SIZE, 4, elevation - 2);
      art.fillStyle(p.bark[1]).fillRect(left + 1, TILE_SIZE + 1, 1, elevation - 4).fillRect(left + span - 3, TILE_SIZE + 1, 1, elevation - 4);
    }
    const moss = 5 + grain(run.start + face.start, run.row, structure.variant) % 12;
    art.fillStyle(p.moss, 0.65).fillRect(left + 4, height - 5, Math.min(span - 8, moss), 3);
  }
  // Close the concave L junction where a long rear wall turns into a side wall.
  // Its corner belongs to the connected neighbor, beyond the exposed edge interval.
  for (const [edges, y] of [[run.north, 0], [run.south, TILE_SIZE - 3]] as const) {
    for (let index = 1; index < edges.length; index++) {
      if (edges[index] === edges[index - 1]) continue;
      const x = index * TILE_SIZE + (edges[index] ? -3 : 0);
      art.fillStyle(cap).fillRect(x, y, 3, 3);
    }
  }
  if (ruined) {
    for (let index = 0; index < run.length; index++) {
      const offset = grain(run.start + index, run.row, structure.variant);
      const x = index * TILE_SIZE + 7 + offset % 10;
      art.fillStyle(p.rock[0], 0.85).fillRect(x, 8, 2, 8).fillRect(x - 4, 15, 6, 2);
      if (run.north[index]) art.fillStyle(p.rock[0]).fillRect(index * TILE_SIZE + 12, 0, 7, 3);
    }
  }
  art.generateTexture(key, width, height);
  art.destroy();
  return { key, width, height, elevation, silhouettes };
}

/** A row run is independently depth-sorted and fades only when its actual silhouette overlaps. */
export function createWalls(scene: Phaser.Scene, structure: WorldStructure, season: Season, house?: HouseVisibility): EnvironmentObject[] {
  return connectedWallRuns(structure).map(run => {
    const texture = wallTexture(scene, structure, season, run);
    const left = (structure.origin.x + run.start) * TILE_SIZE;
    const top = (structure.origin.y + run.row) * TILE_SIZE - texture.elevation;
    const base = { x: left + texture.width / 2, y: (structure.origin.y + run.row + 1) * TILE_SIZE - 2 };
    const image = scene.add.image(left, top, texture.key).setOrigin(0, 0).setDepth(10 + base.y);
    const bounds = { x: left, y: top, width: texture.width, height: texture.height };
    return { images: [image], occluder: { base, bounds, silhouettes: texture.silhouettes.map(shape => ({ ...shape, x: left + shape.x, y: top + shape.y })),
      ...(house ? { house: { geometry: house, part: 'wall' as const } } : {}) } };
  });
}
