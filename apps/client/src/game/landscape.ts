import Phaser from 'phaser';
import type { GridPoint, Terrain, WorldStructure } from '@shards/shared';
import { environmentPalettes, type EnvironmentPalette } from '../art/environment/palette';
import { drawGroundFleck, drawStoneSlab, drawTreeCrown, drawTreeShadow, drawTreeTrunk } from '../art/environment/primitives';
import { createCampfires } from '../world/campfires';
import { landscapeRandom, type BattleEnvironment } from './battleEnvironment';
import type { BattleStage } from './battleLayout';
import { drawBasementLandscape } from './basementLandscape';

const CELL_X = 42;
const CELL_Y = 26;
let textureSequence = 0;

interface SceneryPoint extends GridPoint { terrain: Terrain; variant: number }
interface Particle extends GridPoint { phase: number; speed: number; size: number }
export interface BattleLandscape {
  resize(stage: BattleStage): void;
  update(delta: number, reduced: boolean): void;
  destroy(): void;
}

function inClearing(x: number, y: number, stage: BattleStage): boolean {
  if (stage.width < 640 && stage.height > stage.width * 0.8) return x > 40 && x < stage.width - 40 && y > 152 && y < stage.height - 36;
  return x > stage.width * 0.155 && x < stage.width * 0.87 && y > stage.height * 0.294 && y < stage.height * 0.82;
}

/** Preserve the landmark's side of the encounter while leaving the combatants readable. */
function borderPoint(point: GridPoint, stage: BattleStage): GridPoint {
  const x = Phaser.Math.Clamp(point.x, 65, Math.max(65, stage.width - 65));
  const y = Phaser.Math.Clamp(point.y, 146, Math.max(146, stage.height - 32));
  if (!inClearing(x, y, stage)) return { x, y };
  if (stage.width < 640 && stage.height > stage.width * 0.8) return { x, y: 146 };
  return { x: x < stage.width / 2 ? Math.min(x, stage.width * 0.16) : Math.max(x, stage.width * 0.848), y: Math.min(y, stage.height * 0.7) };
}

function drawRock(g: Phaser.GameObjects.Graphics, point: SceneryPoint, p: EnvironmentPalette) {
  const { x, y, variant } = point;
  const size = 16 + variant % 19;
  g.fillStyle(0x111d19, 0.4).fillEllipse(x + 4, y + 8, size * 1.9, size * 0.7);
  g.fillStyle(p.rock[0]).fillRect(x - size / 2, y - size / 2, size, size * 0.8);
  g.fillStyle(p.rock[1]).fillRect(x - size / 2 + 3, y - size / 2 - 4, size - 7, size * 0.64);
  g.fillStyle(p.rock[2], 0.55).fillRect(x - size / 2 + 5, y - size / 2 - 4, size - 13, 3);
  g.fillStyle(p.moss).fillRect(x - size / 2, y + size * 0.2, size / 2, 4);
}

function drawLandmark(g: Phaser.GameObjects.Graphics, structure: WorldStructure, point: GridPoint, p: EnvironmentPalette, snow: boolean, stage: BattleStage) {
  const { x, y } = borderPoint(point, stage);
  g.fillStyle(0x0c1915, 0.45).fillEllipse(x, y + 5, structure.kind === 'house' ? 164 : 105, 35);
  if (structure.kind === 'well') {
    g.fillStyle(p.rock[0]).fillRect(x - 34, y - 25, 68, 31);
    g.fillStyle(p.rock[1]).fillRect(x - 36, y - 28, 72, 15);
    g.fillStyle(p.rock[2]).fillRect(x - 30, y - 28, 60, 3);
    g.fillStyle(0x14251e).fillRect(x - 21, y - 24, 42, 9);
    g.fillStyle(p.water[1]).fillRect(x - 15, y - 18, 30, 3);
    g.fillStyle(p.bark[0]).fillRect(x - 31, y - 71, 7, 54).fillRect(x + 24, y - 71, 7, 54).fillRect(x - 35, y - 73, 70, 8);
    g.fillStyle(p.bark[1]).fillRect(x - 29, y - 70, 2, 48).fillRect(x + 26, y - 70, 2, 48).fillRect(x - 30, y - 73, 60, 2);
    g.fillStyle(0x9e8e60).fillRect(x, y - 64, 2, 43);
    g.fillStyle(p.moss).fillRect(x - 34, y - 1, 19, 7).fillRect(x + 24, y - 9, 9, 11);
    return;
  }
  const ruined = structure.kind === 'ruin';
  const width = ruined ? 108 : 140;
  const height = ruined ? 54 : 80;
  g.fillStyle(p.rock[0]).fillRect(x - width / 2, y - height, width, height);
  for (let row = 0; row < height / 10; row++) for (let col = 0; col < width / 20; col++) {
    const left = x - width / 2 + col * 20 + row % 2 * 6;
    if (left + 17 > x + width / 2) continue;
    g.fillStyle((row + col) % 3 ? p.rock[1] : p.rock[0], 0.62).fillRect(left + 1, y - height + row * 10 + 1, 17, 8);
  }
  g.fillStyle(0x111f19).fillRect(x - 13, y - 43, 26, 43);
  g.fillStyle(p.bark[0]).fillRect(x - 15, y - 45, 30, 5);
  if (ruined) {
    g.fillStyle(p.ground[0]).fillRect(x - 15, y - height, 35, 17).fillRect(x + 27, y - height, 27, 30);
    g.fillStyle(p.rock[2], 0.6).fillRect(x - 54, y - height, 36, 3).fillRect(x + 20, y - height + 17, 8, 3);
    [0, 1, 2, 3].forEach(index => drawRock(g, { x: x - 68 + index * 44, y: y + 9 + index % 2 * 6, terrain: 'rock', variant: structure.variant + index }, p));
  } else {
    g.fillStyle(p.bark[0]).fillRect(x - 78, y - 84, 156, 13);
    for (let row = 0; row < 7; row++) {
      const inset = (6 - row) * 6;
      const top = y - 131 + row * 7;
      g.fillStyle(row % 2 ? p.bark[1] : p.bark[0]).fillRect(x - 77 + inset, top, 154 - inset * 2, 7);
      g.fillStyle(p.rock[1], 0.35).fillRect(x - 72 + inset, top, 143 - inset * 2, 2);
    }
    g.fillStyle(p.rock[0]).fillRect(x + 32, y - 144, 19, 33);
    g.fillStyle(p.rock[1]).fillRect(x + 35, y - 144, 13, 28);
    g.fillStyle(0x101b17).fillRect(x + 34, y - 145, 16, 5);
    g.fillStyle(0x17241d).fillRect(x - 47, y - 59, 19, 26).fillRect(x + 29, y - 59, 19, 26);
    g.fillStyle(p.bark[1]).fillRect(x - 39, y - 59, 3, 26).fillRect(x + 37, y - 59, 3, 26);
    if (snow) g.fillStyle(p.rock[2]).fillRect(x - 39, y - 132, 78, 4).fillRect(x - 73, y - 88, 146, 4);
  }
  g.fillStyle(p.moss, 0.75).fillRect(x - width / 2, y - 12, 26, 13).fillRect(x + width / 2 - 15, y - 23, 15, 23);
}

/** Nearby world materials are enlarged into an arena; combat itself never consumes random numbers here. */
export function drawLandscape(scene: Phaser.Scene, environment?: BattleEnvironment, fallbackSeed = 'battle'): BattleLandscape {
  if (environment?.chunk.layer === 'basement') return drawBasementLandscape(scene, environment);
  // Bake to the current aspect ratio so portrait trees and houses keep their proportions.
  const ratio = Math.min(1, 1600 / Math.max(1, scene.scale.width), 1200 / Math.max(1, scene.scale.height));
  const W = Math.max(1, Math.round(scene.scale.width * ratio));
  const H = Math.max(1, Math.round(scene.scale.height * ratio));
  const bounds = { width: W, height: H };
  const season = environment?.chunk.season ?? 'spring';
  const p = environmentPalettes[season];
  const seed = environment ? `${environment.seed}:${environment.chunk.id}:${environment.focus.x},${environment.focus.y}` : fallbackSeed;
  const random = landscapeRandom(seed);
  const g = scene.make.graphics({ x: 0, y: 0 });
  const points: SceneryPoint[] = [];
  const water: GridPoint[] = [];
  const project = (point: GridPoint): GridPoint => ({ x: W / 2 + (point.x - environment!.focus.x) * CELL_X, y: H / 2 + (point.y - environment!.focus.y) * CELL_Y });
  const material = (x: number, y: number): Terrain => {
    if (!environment) return 'grass';
    const tileX = Math.round(environment.focus.x + (x - W / 2) / CELL_X);
    const tileY = Math.round(environment.focus.y + (y - H / 2) / CELL_Y);
    const size = environment.chunk.size;
    return environment.chunk.tiles[Phaser.Math.Clamp(tileY, 0, size - 1) * size + Phaser.Math.Clamp(tileX, 0, size - 1)]?.terrain ?? 'grass';
  };
  g.fillStyle(p.ground[0]).fillRect(0, 0, W, H);
  // Small irregular material patches retain connected water and paths without a visible grid.
  for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 10) {
    const terrain = material(x + (random() - 0.5) * 13, y + (random() - 0.5) * 9);
    const shade = Math.floor(random() * 3);
    const colours = terrain === 'water' ? p.water : terrain === 'path' || terrain === 'wall' ? p.path : p.ground;
    g.fillStyle(colours[shade], terrain === 'water' ? 1 : 0.5).fillRect(x, y, 10, 8);
    if (terrain === 'snow' && season !== 'winter') g.fillStyle(0x84938b, 0.75).fillRect(x, y, 10, 8);
    if (terrain === 'water' && random() < 0.012) water.push({ x, y });
  }
  for (let i = 0; i < 2600; i++) {
    const x = Math.floor(random() * W / 4) * 4;
    const y = Math.floor(random() * H / 4) * 4;
    const terrain = material(x, y);
    if (terrain === 'water') {
      if (i % 5 === 0) g.fillStyle(p.water[2], 0.2).fillRect(x, y, 10 + i % 11, 2);
    } else if (terrain === 'path' && i % 7 === 0) drawStoneSlab(g, x, y, p, i, 0.7);
    else drawGroundFleck(g, x, y, p, i);
  }
  if (environment) {
    const { chunk, focus } = environment;
    const radiusY = Math.ceil(H / CELL_Y / 2) + 2;
    const radiusX = Math.ceil(W / CELL_X / 2) + 2;
    for (let y = Math.max(0, focus.y - radiusY); y <= Math.min(chunk.size - 1, focus.y + radiusY); y++) {
      for (let x = Math.max(0, focus.x - radiusX); x <= Math.min(chunk.size - 1, focus.x + radiusX); x++) {
        const terrain = chunk.tiles[y * chunk.size + x]?.terrain;
        if (terrain !== 'tree' && terrain !== 'rock' && terrain !== 'bush') continue;
        const point = project({ x, y });
        point.x += (random() - 0.5) * 18;
        point.y += (random() - 0.5) * 12;
        points.push({ ...point, terrain, variant: Math.floor(random() * 105) });
      }
    }
  }
  // Keep large silhouettes around the edges; low grass and shadows still echo the encounter tile.
  points.sort((a, b) => a.y - b.y).forEach(point => {
    if (inClearing(point.x, point.y, bounds)) return;
    // A trunk outside the clearing can still project its crown over the entire hero row.
    // Keep the foreground framing at the extreme edges of portrait arenas.
    if (W < 640 && H > W * 0.8 && point.terrain === 'tree' && point.y > H * 0.66
      && point.x > -75 && point.x < W + 75) return;
    if (point.terrain === 'rock') { drawRock(g, point, p); return; }
    if (point.terrain === 'bush') {
      g.fillStyle(p.leaf[0]).fillEllipse(point.x, point.y, 30, 14);
      g.fillStyle(p.leaf[1]).fillRect(point.x - 9, point.y - 9, 16, 10);
      return;
    }
    const style = { scale: 0.7 + point.variant % 6 / 10, dark: point.y < 160, birch: point.variant % 11 === 0, narrow: point.variant % 3 === 0 };
    drawTreeShadow(g, point.x, point.y, style.scale);
    drawTreeTrunk(g, point.x, point.y, p, style);
    drawTreeCrown(g, point.x, point.y, p, style);
  });
  if (environment) {
    const nearby = environment.chunk.structures.map(structure => {
      const dx = Math.max(structure.origin.x - environment.focus.x, 0, environment.focus.x - structure.origin.x - structure.width);
      const dy = Math.max(structure.origin.y - environment.focus.y, 0, environment.focus.y - structure.origin.y - structure.height);
      return { structure, distance: Math.hypot(dx, dy) };
    }).filter(item => item.distance <= 11).sort((a, b) => a.distance - b.distance).slice(0, 3);
    for (const { structure } of nearby) drawLandmark(g, structure, project({ x: structure.origin.x + structure.width / 2, y: structure.origin.y + structure.height }), p, season === 'winter', bounds);
  }
  const firePoints = environment?.chunk.pois.filter(poi => poi.kind === 'campfire'
    && (environment.litCampfireIds === undefined || environment.litCampfireIds.includes(poi.id))
    && Math.hypot(poi.position.x - environment.focus.x, poi.position.y - environment.focus.y) <= 8)
    .slice(0, 2).map(poi => borderPoint(project(poi.position), bounds)) ?? [];
  firePoints.forEach(({ x, y }) => {
    for (let i = 0; i < 14; i++) g.fillStyle(0xe4aa58, 0.012).fillEllipse(x, y, 150 - i * 8, 75 - i * 4);
    g.fillStyle(p.rock[1]).fillRect(x - 23, y + 6, 12, 6).fillRect(x + 14, y + 5, 11, 6).fillRect(x - 4, y + 12, 13, 6);
    g.fillStyle(p.bark[1]).fillRect(x - 16, y + 3, 33, 6).fillRect(x - 10, y - 2, 25, 6);
  });
  // Cool peripheral shade supports the miniature silhouettes.
  for (let i = 0; i < 14; i++) {
    g.fillStyle(0x081510, 0.024).fillRect(i * 7, 0, 7, H).fillRect(W - (i + 1) * 7, 0, 7, H);
    g.fillStyle(0x081510, 0.028).fillRect(0, i * 5, W, 5).fillRect(0, H - (i + 1) * 4, W, 4);
  }
  g.fillStyle(0x071611, season === 'winter' ? 0.12 : 0.15).fillRect(0, 0, W, H);
  const key = `battle-landscape:${textureSequence++}`;
  g.generateTexture(key, W, H);
  g.destroy();
  const image = scene.add.image(0, 0, key).setOrigin(0).setDepth(0);
  const weather = scene.add.graphics().setDepth(1);
  const particles: Particle[] = Array.from({ length: season === 'winter' ? 28 : 18 }, () => ({ x: random() * W, y: random() * H, phase: random() * Math.PI * 2, speed: 0.4 + random() * 0.7, size: random() > 0.75 ? 3 : 2 }));
  const ripples = water.slice(0, 20).map(point => ({ ...point, phase: random() * Math.PI * 2 }));
  let campfires: ReturnType<typeof createCampfires> | undefined;
  let elapsed = 0;
  let stage: BattleStage = { width: W, height: H };
  let previousReduced: boolean | undefined;
  let destroyed = false;
  const resize = (next: BattleStage) => {
    stage = next;
    image.setDisplaySize(stage.width, stage.height);
    weather.setScale(stage.width / W, stage.height / H);
    campfires?.destroy();
    campfires = firePoints.length ? createCampfires(scene, firePoints.map(point => ({ x: point.x * stage.width / W, y: point.y * stage.height / H }))) : undefined;
  };
  resize({ width: scene.scale.width, height: scene.scale.height });
  return {
    resize,
    update(delta, reduced) {
      if (destroyed) return;
      campfires?.update(delta, reduced);
      if (reduced) {
        if (previousReduced !== reduced) weather.clear();
        previousReduced = reduced;
        return;
      }
      previousReduced = reduced;
      elapsed += Math.min(Math.max(delta, 0), 100);
      const time = elapsed / 1000;
      weather.clear();
      ripples.forEach(ripple => {
        const phase = (time * 0.34 + ripple.phase) % 1;
        weather.lineStyle(1, p.water[2], Math.sin(phase * Math.PI) * 0.28).strokeEllipse(ripple.x, ripple.y, 8 + phase * 30, 3 + phase * 7);
      });
      const falling = season === 'winter' || season === 'autumn';
      particles.forEach(particle => {
        const x = ((particle.x + time * (falling ? 12 : 4) * particle.speed + Math.sin(time * 0.7 + particle.phase) * 12) % (W + 20)) - 10;
        const y = (particle.y + time * (falling ? 15 : -3) * particle.speed + Math.sin(time + particle.phase) * 5 + H) % H;
        weather.fillStyle(season === 'winter' ? 0xd9e6dc : season === 'autumn' ? p.leaf[3] : 0xb9c18b,
          falling ? 0.35 : 0.12 + (Math.sin(time + particle.phase) + 1) * 0.09).fillRect(Math.round(x), Math.round(y), particle.size, season === 'autumn' ? 2 : particle.size);
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      campfires?.destroy();
      weather.destroy();
      image.destroy();
      if (scene.textures.exists(key)) scene.textures.remove(key);
    },
  };
}
