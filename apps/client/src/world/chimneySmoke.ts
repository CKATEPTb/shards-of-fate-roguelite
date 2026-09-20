import type Phaser from 'phaser';
import type { GridPoint } from '@shards/shared';
import type { Bounds } from './occlusion';
import { intersectsViewport } from './water';
import { CAMPFIRE_SMOKE, CHIMNEY_SMOKE, SMOKE_TEXTURE, smokePuffAt, smokeTrailBounds, type SmokeStyle } from './smokeMotion';

const TEXTURE_KEY = 'chimney-smoke:v1';
const SMOKE_DEPTH = 90001;

function ensurePuffTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEY)) return;
  const art = scene.make.graphics({ x: 0, y: 0 });
  // Small stepped edges retain the world's pixel style as the wisps broaden.
  art.fillStyle(0xaab7ad, 0.45).fillRect(6, 0, 6, 2).fillRect(2, 4, 14, 6)
    .fillRect(0, 6, 18, 4).fillRect(4, 10, 10, 4);
  art.fillStyle(0xc3c9ba, 0.9).fillRect(6, 2, 7, 2).fillRect(3, 4, 11, 6).fillRect(5, 10, 8, 2);
  art.fillStyle(0xd5d8c9, 0.65).fillRect(6, 4, 6, 2).fillRect(4, 6, 6, 2);
  art.generateTexture(TEXTURE_KEY, SMOKE_TEXTURE.width, SMOKE_TEXTURE.height);
  art.destroy();
}

export interface AmbientSmoke {
  readonly count: number;
  update(delta: number, reducedMotion: boolean, viewport?: Bounds): void;
  destroy(): void;
}

/** Cosmetic images have no input/physics and a fixed lifetime allocation per source. */
export function createChimneySmoke(scene: Phaser.Scene, sources: GridPoint[]): AmbientSmoke {
  return createSmoke(scene, sources, CHIMNEY_SMOKE, () => SMOKE_DEPTH);
}

/** Sources are flame tips, sixteen pixels above the fire's ground anchor. */
export function createCampfireSmoke(scene: Phaser.Scene, sources: GridPoint[]): AmbientSmoke {
  return createSmoke(scene, sources, CAMPFIRE_SMOKE, source => 10 + source.y + 16 + 0.3);
}

function createSmoke(scene: Phaser.Scene, sources: GridPoint[], style: SmokeStyle, depth: (source: GridPoint) => number): AmbientSmoke {
  if (sources.length) ensurePuffTexture(scene);
  const plumes = sources.map(point => {
    const source = { ...point };
    const images = Array.from({ length: style.count }, (_, index) => {
      const puff = smokePuffAt(source, 0, index, style);
      return scene.add.image(puff.x, puff.y, TEXTURE_KEY).setOrigin(0.5, 0.5)
        .setDepth(depth(source)).setScale(puff.scale).setAlpha(puff.alpha);
    });
    return { source, images, bounds: smokeTrailBounds(source, style) };
  });
  let elapsed = 0;
  let destroyed = false;
  return {
    count: sources.length * style.count,
    update(delta, reducedMotion, viewport) {
      if (destroyed) return;
      if (!reducedMotion && Number.isFinite(delta)) elapsed = (elapsed + Math.max(0, delta)) % style.cycle;
      for (const plume of plumes) {
        const visible = intersectsViewport(plume.bounds, viewport);
        for (let index = 0; index < plume.images.length; index++) {
          const image = plume.images[index];
          image.setVisible(visible);
          if (!visible || reducedMotion) continue;
          const puff = smokePuffAt(plume.source, elapsed, index, style);
          image.setPosition(puff.x, puff.y).setScale(puff.scale).setAlpha(puff.alpha);
        }
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const plume of plumes) for (const image of plume.images) image.destroy();
      plumes.length = 0;
    },
  };
}
