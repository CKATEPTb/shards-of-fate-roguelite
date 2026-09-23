import type { WorldChunk } from '@shards/shared';
import { surfaceNodeIdForChunk } from '@shards/game-core';
import { grain } from './palette';
import { TILE_SIZE } from './projection';

export function mixColour(left: number, right: number, amount: number): number {
  const weight = Math.max(0, Math.min(1, amount));
  const channel = (shift: number) => Math.round(((left >> shift) & 255) * (1 - weight) + ((right >> shift) & 255) * weight);
  return channel(16) << 16 | channel(8) << 8 | channel(0);
}

export function smoothStep(start: number, end: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

function landscapeNoise(x: number, y: number): number {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  const tx = smoothStep(0, 1, x - cellX);
  const ty = smoothStep(0, 1, y - cellY);
  const sample = (dx: number, dy: number) => grain(cellX + dx, cellY + dy, 71) / 0xffffffff;
  const top = sample(0, 0) * (1 - tx) + sample(1, 0) * tx;
  const bottom = sample(0, 1) * (1 - tx) + sample(1, 1) * tx;
  return top * (1 - ty) + bottom * ty;
}

/** Broad material areas follow world coordinates; a tile never chooses its own random surface. */
export function pathMaterial(chunk: WorldChunk): (x: number, y: number) => number {
  const coordinates = (chunk.surfaceNodeId ?? surfaceNodeIdForChunk(chunk.id)).split(',').map(Number);
  const offsetX = Number.isFinite(coordinates[0]) ? coordinates[0] * chunk.size * TILE_SIZE : 0;
  const offsetY = Number.isFinite(coordinates[1]) ? coordinates[1] * chunk.size * TILE_SIZE : 0;
  const settlements = chunk.structures.map(structure => ({
    left: structure.origin.x * TILE_SIZE, top: structure.origin.y * TILE_SIZE,
    right: (structure.origin.x + structure.width) * TILE_SIZE, bottom: (structure.origin.y + structure.height) * TILE_SIZE,
    strength: structure.kind === 'ruin' ? 0.38 : 0.65,
  }));
  return (x, y) => {
    const natural = landscapeNoise((offsetX + x) / (TILE_SIZE * 7), (offsetY + y) / (TILE_SIZE * 7)) * 0.9;
    let settlement = 0;
    for (const structure of settlements) {
      const dx = Math.max(structure.left - x, 0, x - structure.right);
      const dy = Math.max(structure.top - y, 0, y - structure.bottom);
      const influence = 1 - smoothStep(TILE_SIZE, TILE_SIZE * 4, Math.hypot(dx, dy));
      settlement = Math.max(settlement, influence * structure.strength);
    }
    return Math.min(1, natural + settlement);
  };
}
