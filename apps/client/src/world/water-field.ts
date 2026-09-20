import type { WorldChunk } from '@shards/shared';
import { TILE_SIZE } from './projection';

const RESOLUTION = 4;
const BLUR_RADIUS = 5;
export interface WaterField { size: number; values: Float32Array }

/** Three separable box passes approximate a 22px Gaussian without a costly large kernel. */
export function createWaterField(chunk: WorldChunk): WaterField {
  const size = chunk.size * TILE_SIZE / RESOLUTION;
  let values = new Float32Array(size * size);
  let buffer = new Float32Array(values.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    values[y * size + x] = Number(chunk.tiles[Math.floor(y * RESOLUTION / TILE_SIZE) * chunk.size
      + Math.floor(x * RESOLUTION / TILE_SIZE)].terrain === 'water');
  }
  const diameter = BLUR_RADIUS * 2 + 1;
  for (let pass = 0; pass < 3; pass++) for (const vertical of [false, true]) {
    for (let line = 0; line < size; line++) {
      const index = (offset: number) => vertical ? offset * size + line : line * size + offset;
      let sum = 0;
      for (let offset = 0; offset <= BLUR_RADIUS; offset++) sum += values[index(offset)];
      for (let offset = 0; offset < size; offset++) {
        buffer[index(offset)] = sum / diameter;
        if (offset >= BLUR_RADIUS) sum -= values[index(offset - BLUR_RADIUS)];
        if (offset + BLUR_RADIUS + 1 < size) sum += values[index(offset + BLUR_RADIUS + 1)];
      }
    }
    [values, buffer] = [buffer, values];
  }
  return { size, values };
}

export function waterFieldAt(field: WaterField, x: number, y: number): number {
  const sx = x / RESOLUTION - 0.5, sy = y / RESOLUTION - 0.5;
  const left = Math.floor(sx), top = Math.floor(sy), u = sx - left, v = sy - top;
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < field.size && y < field.size ? field.values[y * field.size + x] : 0;
  return (at(left, top) * (1 - u) + at(left + 1, top) * u) * (1 - v)
    + (at(left, top + 1) * (1 - u) + at(left + 1, top + 1) * u) * v;
}
