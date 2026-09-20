import type { WorldChunk, WorldTile } from '@shards/shared';
import type { Bounds } from './occlusion';
import { grain } from './palette';
import { TILE_SIZE } from './projection';
import { createWaterField, waterFieldAt } from './water-field';

export const WATER_PIXEL_SIZE = 2;
export interface WaterSpan { x: number; y: number; width: number; height: number }
export interface WaterPatch { bounds: Bounds; spans: WaterSpan[] }
export interface WaterGeometry {
  size: number;
  /** 0 is dry ground, 1 is deep water, 2 is a decorative shallow puddle. */
  mask: Uint8Array;
  water: WaterSpan[];
  puddles: WaterSpan[];
  shore: WaterSpan[];
  shallows: WaterSpan[];
  patches: WaterPatch[];
}
const cache = new WeakMap<WorldChunk, WaterGeometry>();

/** Shallow puddles are decoration; gameplay water remains defined by the core tiles. */
export function isPuddle(tile: WorldTile, x: number, y: number): boolean {
  return tile.walkable && tile.terrain === 'grass' && grain(x, y, 38) % 47 === 0;
}

const smooth = (value: number) => value * value * (3 - 2 * value);

function spansOf(mask: Uint8Array, size: number, value: number): WaterSpan[] {
  const spans: WaterSpan[] = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size;) {
    if (mask[y * size + x] !== value) { x++; continue; }
    const start = x;
    while (x < size && mask[y * size + x] === value) x++;
    spans.push({ x: start * WATER_PIXEL_SIZE, y: y * WATER_PIXEL_SIZE,
      width: (x - start) * WATER_PIXEL_SIZE, height: WATER_PIXEL_SIZE });
  }
  return spans;
}

/** Four-connected painted components keep cached ripple textures cropped to each actual pool. */
function waterPatches(mask: Uint8Array, size: number): WaterPatch[] {
  const seen = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  const patches: WaterPatch[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let read = 0, write = 1, minX = size, minY = size, maxX = 0, maxY = 0;
    queue[0] = start; seen[start] = 1;
    while (read < write) {
      const index = queue[read++], x = index % size, y = Math.floor(index / size);
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      for (const next of [x > 0 ? index - 1 : -1, x + 1 < size ? index + 1 : -1,
        y > 0 ? index - size : -1, y + 1 < size ? index + size : -1]) {
        if (next >= 0 && mask[next] && !seen[next]) { seen[next] = 1; queue[write++] = next; }
      }
    }
    const rows = new Map<number, number[]>();
    for (let i = 0; i < write; i++) {
      const y = Math.floor(queue[i] / size), row = rows.get(y) ?? [];
      row.push(queue[i] % size); rows.set(y, row);
    }
    const spans: WaterSpan[] = [];
    for (const [y, row] of rows) {
      row.sort((a, b) => a - b);
      for (let i = 0; i < row.length;) {
        const x = row[i++]; let end = x + 1;
        while (i < row.length && row[i] === end) { end++; i++; }
        spans.push({ x: x * WATER_PIXEL_SIZE, y: y * WATER_PIXEL_SIZE,
          width: (end - x) * WATER_PIXEL_SIZE, height: WATER_PIXEL_SIZE });
      }
    }
    patches.push({ bounds: { x: minX * WATER_PIXEL_SIZE, y: minY * WATER_PIXEL_SIZE,
      width: (maxX - minX + 1) * WATER_PIXEL_SIZE, height: (maxY - minY + 1) * WATER_PIXEL_SIZE }, spans });
  }
  return patches;
}

/** A shared, softly warped field joins tiles before drawing; no per-tile shore edges survive. */
export function waterGeometry(chunk: WorldChunk): WaterGeometry {
  const existing = cache.get(chunk);
  if (existing) return existing;
  const size = chunk.size * TILE_SIZE / WATER_PIXEL_SIZE;
  const mask = new Uint8Array(size * size);
  const field = createWaterField(chunk);
  // The blur has finite support: most forest ground needs no field sampling or shoreline work.
  const nearWater = new Uint8Array(chunk.tiles.length);
  for (let y = 0; y < chunk.size; y++) for (let x = 0; x < chunk.size; x++) {
    if (chunk.tiles[y * chunk.size + x].terrain !== 'water') continue;
    for (let ny = Math.max(0, y - 3); ny <= Math.min(chunk.size - 1, y + 3); ny++) {
      nearWater.fill(1, ny * chunk.size + Math.max(0, x - 3), ny * chunk.size + Math.min(chunk.size, x + 4));
    }
  }
  const phase = grain(chunk.size, chunk.id.length, chunk.season.length) % 628 / 100;
  const waterAt = (x: number, y: number) => x >= 0 && y >= 0 && x < chunk.size && y < chunk.size
    && chunk.tiles[y * chunk.size + x].terrain === 'water' ? 1 : 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = (x + 0.5) * WATER_PIXEL_SIZE, py = (y + 0.5) * WATER_PIXEL_SIZE;
    const tx = Math.floor(px / TILE_SIZE), ty = Math.floor(py / TILE_SIZE);
    if (!nearWater[ty * chunk.size + tx]) continue;
    const warpedX = px + Math.sin(py / 31 + phase) * 6.5 + Math.sin((px + py) / 23 + phase) * 2.5;
    const warpedY = py + Math.sin(px / 37 + phase) * 6.5 + Math.sin((px - py) / 29 + phase) * 2.5;
    const wet = waterAt(tx, ty), dx = px - (tx + 0.5) * TILE_SIZE, dy = py - (ty + 0.5) * TILE_SIZE;
    // Preserve small cores and joins of both terrain types while the outer bank is free to curve.
    let coreDistance = Math.hypot(dx, dy);
    if (waterAt(tx + Math.sign(dx), ty) === wet) coreDistance = Math.min(coreDistance, Math.abs(dy));
    if (waterAt(tx, ty + Math.sign(dy)) === wet) coreDistance = Math.min(coreDistance, Math.abs(dx));
    const inner = wet ? 5 : 8;
    const anchor = 1 - smooth(Math.max(0, Math.min(1, (coreDistance - inner) / 5)));
    const value = waterFieldAt(field, warpedX, warpedY) * (1 - anchor) + wet * anchor;
    if (value >= 0.5) mask[y * size + x] = 1;
  }
  for (let ty = 0; ty < chunk.size; ty++) for (let tx = 0; tx < chunk.size; tx++) {
    if (!isPuddle(chunk.tiles[ty * chunk.size + tx], tx, ty)) continue;
    const phase = grain(tx, ty, 49) % 628 / 100;
    for (let y = ty * 16 + 6; y < ty * 16 + 15; y++) for (let x = tx * 16 + 1; x < tx * 16 + 16; x++) {
      if (mask[y * size + x]) continue;
      const dx = ((x + 0.5) * WATER_PIXEL_SIZE - tx * TILE_SIZE - 17) / 12;
      const dy = ((y + 0.5) * WATER_PIXEL_SIZE - ty * TILE_SIZE - 22) / 6;
      const ripple = 1 + Math.sin(Math.atan2(dy, dx) * 3 + phase) * 0.13;
      if (dx * dx + dy * dy < ripple * ripple) mask[y * size + x] = 2;
    }
  }
  // Floors are painted over the ground later; their footprints must also exclude animated glints.
  for (const structure of chunk.structures) {
    const left = structure.origin.x * TILE_SIZE / WATER_PIXEL_SIZE;
    const top = structure.origin.y * TILE_SIZE / WATER_PIXEL_SIZE;
    const right = Math.min(size, left + structure.width * TILE_SIZE / WATER_PIXEL_SIZE);
    const bottom = Math.min(size, top + structure.height * TILE_SIZE / WATER_PIXEL_SIZE);
    for (let y = Math.max(0, top); y < bottom; y++) mask.fill(0, y * size + Math.max(0, left), y * size + right);
  }
  const edge = new Uint8Array(mask.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const wet = mask[y * size + x];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      const neighbour = nx >= 0 && ny >= 0 && nx < size && ny < size ? mask[ny * size + nx] : 0;
      if (wet === 1 && !neighbour) edge[y * size + x] = 2;
      if (!wet && neighbour === 1) edge[y * size + x] = 1;
    }
  }
  const result = { size, mask, water: spansOf(mask, size, 1), puddles: spansOf(mask, size, 2),
    shore: spansOf(edge, size, 1), shallows: spansOf(edge, size, 2), patches: waterPatches(mask, size) };
  cache.set(chunk, result);
  return result;
}

export function waterPixel(geometry: WaterGeometry, x: number, y: number): number {
  const column = Math.floor(x / WATER_PIXEL_SIZE), row = Math.floor(y / WATER_PIXEL_SIZE);
  return column >= 0 && row >= 0 && column < geometry.size && row < geometry.size ? geometry.mask[row * geometry.size + column] : 0;
}
