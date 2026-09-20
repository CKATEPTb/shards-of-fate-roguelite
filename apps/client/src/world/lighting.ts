import Phaser from 'phaser';
import type { GridPoint } from '@shards/shared';
import type { WorldProjection } from './projection';
import { LIGHT_STYLES, WORLD_DARKNESS, lightFalloff, lightPulse, lightingOverlayPlacement, visibleWorldLights, type WorldLightKind } from './lightingGeometry';

export interface WorldLightingFrame {
  heroes: readonly GridPoint[];
  campfires: readonly GridPoint[];
  projection: WorldProjection;
  delta: number;
  reducedMotion: boolean;
}

export interface WorldLighting {
  update(frame: WorldLightingFrame): void;
  destroy(): void;
}

interface LightStamp { reveal: HTMLCanvasElement; warmth: HTMLCanvasElement }
let nextLightingId = 0;
const STAMP_SIZE = 384;

function gradientStamp(kind: WorldLightKind, warm: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = STAMP_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas lighting is unavailable');
  const radius = STAMP_SIZE / 2;
  const style = LIGHT_STYLES[kind];
  const gradient = context.createRadialGradient(radius, radius, 0, radius, radius, radius);
  for (let stop = 0; stop <= 24; stop++) {
    const distance = stop / 24;
    const alpha = lightFalloff(distance) * (warm ? style.warmth : style.reveal);
    gradient.addColorStop(distance, `rgba(${warm ? style.color : '255,255,255'},${alpha})`);
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, STAMP_SIZE, STAMP_SIZE);
  return canvas;
}

/** Canvas-only illumination: four cached stamps and one viewport-sized half-resolution mask. */
export function createWorldLighting(scene: Phaser.Scene): WorldLighting {
  const key = `world-lighting:${++nextLightingId}`;
  const texture = scene.textures.createCanvas(key, 1, 1);
  if (!texture) throw new Error('Cannot create world lighting');
  const context = texture.getContext();
  const overlay = scene.add.image(0, 0, key).setOrigin(0).setScrollFactor(0).setDepth(90_000);
  const stamps: Record<WorldLightKind, LightStamp> = {
    hero: { reveal: gradientStamp('hero', false), warmth: gradientStamp('hero', true) },
    campfire: { reveal: gradientStamp('campfire', false), warmth: gradientStamp('campfire', true) },
  };
  let elapsed = 0;
  let destroyed = false;
  let lastFrame = '';

  return {
    update({ heroes, campfires, projection, delta, reducedMotion }) {
      if (destroyed || projection.width <= 0 || projection.height <= 0 || projection.zoom <= 0) return;
      if (!reducedMotion) elapsed += Math.max(0, Math.min(delta, 250));
      const placement = lightingOverlayPlacement(projection);
      if (texture.width !== placement.canvasWidth || texture.height !== placement.canvasHeight) {
        texture.setSize(placement.canvasWidth, placement.canvasHeight);
        overlay.setSize(placement.canvasWidth, placement.canvasHeight).updateDisplayOrigin();
      }
      overlay.setPosition(placement.x, placement.y).setDisplaySize(placement.width, placement.height);
      const lights = visibleWorldLights(heroes, campfires, projection);
      const signature = `${projection.width}:${projection.height}:${projection.zoom}:` + lights.map((light) =>
        `${light.kind}:${light.x.toFixed(2)}:${light.y.toFixed(2)}:${lightPulse(light.kind, elapsed, reducedMotion).toFixed(4)}`).join('|');
      if (signature === lastFrame) return;
      lastFrame = signature;
      const scaleX = texture.width / projection.width;
      const scaleY = texture.height / projection.height;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
      context.clearRect(0, 0, texture.width, texture.height);
      context.fillStyle = `rgba(5,12,18,${WORLD_DARKNESS})`;
      context.fillRect(0, 0, texture.width, texture.height);
      context.imageSmoothingEnabled = true;
      // Destination-out combines overlapping reveals continuously; no additive white discs.
      context.globalCompositeOperation = 'destination-out';
      for (const light of lights) {
        context.globalAlpha = lightPulse(light.kind, elapsed, reducedMotion);
        context.drawImage(stamps[light.kind].reveal,
          (light.x - light.radius) * scaleX, (light.y - light.radius) * scaleY,
          light.radius * 2 * scaleX, light.radius * 2 * scaleY);
      }
      context.globalCompositeOperation = 'source-over';
      for (const light of lights) {
        context.globalAlpha = lightPulse(light.kind, elapsed, reducedMotion);
        context.drawImage(stamps[light.kind].warmth,
          (light.x - light.radius) * scaleX, (light.y - light.radius) * scaleY,
          light.radius * 2 * scaleX, light.radius * 2 * scaleY);
      }
      context.globalAlpha = 1;
      texture.refresh();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      overlay.destroy();
      if (scene.textures.exists(key)) scene.textures.remove(key);
      for (const stamp of Object.values(stamps)) {
        stamp.reveal.width = stamp.reveal.height = 1;
        stamp.warmth.width = stamp.warmth.height = 1;
      }
    },
  };
}
