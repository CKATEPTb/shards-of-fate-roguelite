import type Phaser from 'phaser';
import type { GridPoint } from '@shards/shared';
import { opaqueBodyPixels } from './roaming-body-visibility';

const masks = new WeakMap<Phaser.Textures.Frame, GridPoint[]>();

/** Unit atlases are immutable canvases: read each painted frame once, never the screen framebuffer. */
export function* roamingBodySamples(sprite: Phaser.GameObjects.Sprite): Iterable<GridPoint> {
  const frame = sprite.frame;
  let pixels = masks.get(frame);
  if (!pixels) {
    const source = frame.source.image as HTMLCanvasElement;
    const context = source.getContext('2d');
    if (!context) return;
    const data = context.getImageData(frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight).data;
    pixels = opaqueBodyPixels(data, frame.cutWidth, frame.cutHeight, sprite.displayOriginY);
    masks.set(frame, pixels);
  }
  const transform = sprite.getWorldTransformMatrix();
  // Visibility consumes each sample immediately; reuse it instead of allocating per pixel.
  const sample = { x: 0, y: 0 };
  for (const pixel of pixels) {
    const x = (sprite.flipX ? frame.cutWidth - pixel.x : pixel.x) - sprite.displayOriginX;
    const y = (sprite.flipY ? frame.cutHeight - pixel.y : pixel.y) - sprite.displayOriginY;
    yield transform.transformPoint(x, y, sample);
  }
}
