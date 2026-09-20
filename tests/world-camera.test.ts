import { describe, expect, it } from 'vitest';
import { visibleWorldBounds, worldCameraZoom } from '../apps/client/src/world/camera';

describe('fixed world camera', () => {
  it.each([[320, 456], [1440, 764], [844, 216], [3840, 1924], [390, 2400]])('covers a %s by %s viewport without needing outside terrain', (width, height) => {
    const size = 35 * 32;
    const zoom = worldCameraZoom(width, height, size);
    expect(width / zoom).toBeLessThanOrEqual(size + 0.0001);
    expect(height / zoom).toBeLessThanOrEqual(size + 0.0001);
    const bounds = visibleWorldBounds({ width, height, zoom, scrollX: size / 2 - width / 2, scrollY: size / 2 - height / 2 });
    expect(bounds.x).toBeGreaterThanOrEqual(-0.0001);
    expect(bounds.y).toBeGreaterThanOrEqual(-0.0001);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(size + 0.0001);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(size + 0.0001);
  });
});
