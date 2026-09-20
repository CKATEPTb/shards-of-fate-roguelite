import type Phaser from 'phaser';
import type { GridPoint } from '@shards/shared';
import type { Bounds } from './occlusion';
import { grain } from './palette';
import { intersectsViewport } from './water';
import { createCampfireSmoke } from './chimneySmoke';
import { ensureCampfireArt, FLAME_ANCHOR, FLAME_FRAME_MS, FLAME_FRAMES, FLAME_SIZE, flameTexture } from './campfireArt';

/** Shared texture frames and a fixed puff pool live and die with the current chunk. */
export function createCampfires(scene: Phaser.Scene, sources: GridPoint[]) {
  if (sources.length) ensureCampfireArt(scene);
  const fires = sources.map(source => {
    const offset = grain(Math.round(source.x), Math.round(source.y), 97) % FLAME_FRAMES;
    const image = scene.add.image(source.x - FLAME_ANCHOR.x, source.y + 4 - FLAME_ANCHOR.y, flameTexture(offset))
      .setOrigin(0).setDepth(10 + source.y + 0.2);
    return { image, offset, frame: offset, bounds: { x: image.x, y: image.y, ...FLAME_SIZE } };
  });
  const smoke = createCampfireSmoke(scene, sources.map(source => ({ x: source.x, y: source.y - 16 })));
  let elapsed = 0;
  let destroyed = false;

  return {
    count: fires.length + smoke.count,
    update(delta: number, reducedMotion: boolean, viewport?: Bounds) {
      if (destroyed) return;
      if (!reducedMotion && Number.isFinite(delta)) elapsed = (elapsed + Math.max(0, delta)) % (FLAME_FRAMES * FLAME_FRAME_MS);
      for (const fire of fires) {
        const visible = intersectsViewport(fire.bounds, viewport);
        fire.image.setVisible(visible);
        if (!visible || reducedMotion) continue;
        const frame = (Math.floor(elapsed / FLAME_FRAME_MS) + fire.offset) % FLAME_FRAMES;
        if (frame === fire.frame) continue;
        fire.image.setTexture(flameTexture(frame));
        fire.frame = frame;
      }
      smoke.update(delta, reducedMotion, viewport);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const fire of fires) fire.image.destroy();
      fires.length = 0;
      smoke.destroy();
    },
  };
}
