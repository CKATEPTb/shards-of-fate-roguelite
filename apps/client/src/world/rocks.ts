import type Phaser from 'phaser';
import type { WorldChunk } from '@shards/shared';
import type { EnvironmentObject } from './environmentObject';
import { ensureRockTexture } from './rockArt';
import { planRockLayout } from './rockLayout';
import { TILE_SIZE } from './projection';

/** Rock images describe existing blocked cells; their only overhang is above their footprint. */
export function createRocks(scene: Phaser.Scene, chunk: WorldChunk): EnvironmentObject[] {
  return planRockLayout(chunk).map(formation => {
    const single = formation.width === 1;
    const texture = ensureRockTexture(scene, chunk.season, formation);
    const base = { x: (formation.origin.x + formation.width / 2) * TILE_SIZE,
      y: (formation.origin.y + formation.height) * TILE_SIZE - (single ? 3 : 2) };
    const left = base.x - texture.width / 2; const top = base.y - texture.height;
    const image = scene.add.image(base.x, base.y, texture.key).setOrigin(0.5, 1).setDepth(10 + base.y);
    return { images: [image], occluder: { base, revealable: !single,
      bounds: { x: left, y: top, width: texture.width, height: texture.height },
      silhouettes: texture.silhouette.map(part => ({ ...part, x: left + part.x, y: top + part.y })),
    } };
  });
}

export function drawRockShadows(art: Phaser.GameObjects.Graphics, chunk: WorldChunk): void {
  for (const formation of planRockLayout(chunk)) {
    const single = formation.width === 1;
    const width = formation.width * TILE_SIZE; const height = formation.height * TILE_SIZE;
    const x = formation.origin.x * TILE_SIZE; const y = formation.origin.y * TILE_SIZE;
    art.fillStyle(0x10231b, chunk.season === 'winter' ? 0.19 : 0.3)
      .fillEllipse(x + width / 2 + 1, y + (single ? 27 : height * 0.59), single ? 28 : width - 5, single ? 9 : height * 0.7);
  }
}
