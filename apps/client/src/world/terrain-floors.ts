import type Phaser from 'phaser';
import type { WorldChunk, WorldStructure } from '@shards/shared';
import { grain, type WorldPalette } from './palette';
import { TILE_SIZE } from './projection';
import { mixColour } from './terrain-materials';

type Art = Phaser.GameObjects.Graphics;

function houseFloor(art: Art, structure: WorldStructure, p: WorldPalette) {
  const left = structure.origin.x * TILE_SIZE;
  const top = structure.origin.y * TILE_SIZE;
  const width = structure.width * TILE_SIZE;
  const height = structure.height * TILE_SIZE;
  const seam = mixColour(0x30281f, p.bark[0], 0.2);
  const wood = [0x5c4935, 0x63503b, 0x594735].map(colour => mixColour(colour, p.bark[1], 0.15));
  art.fillStyle(seam).fillRect(left, top, width, height);
  for (let row = 0; row * 8 < height; row++) {
    const y = top + row * 8;
    const boardHeight = Math.min(7, top + height - y);
    art.fillStyle(wood[(row + structure.variant) % wood.length]).fillRect(left + 1, y + 1, width - 2, boardHeight);
    art.fillStyle(0xb39768, 0.14).fillRect(left + 2, y + 1, width - 4, 1);
    const shift = row % 2 * 24;
    for (let joint = shift; joint < width; joint += 48) {
      if (joint > 0) art.fillStyle(seam, 0.8).fillRect(left + joint, y + 1, 1, boardHeight);
      const grainLength = Math.min(24, width - joint - 9);
      if (grainLength > 0) art.fillStyle(seam, 0.23).fillRect(left + joint + 6, y + 5, grainLength, 1);
    }
  }
  art.lineStyle(1, seam, 0.9).strokeRect(left + 0.5, top + 0.5, width - 1, height - 1);
}

function ruinFloor(art: Art, structure: WorldStructure, p: WorldPalette) {
  const left = structure.origin.x * TILE_SIZE;
  const top = structure.origin.y * TILE_SIZE;
  const width = structure.width * TILE_SIZE;
  const height = structure.height * TILE_SIZE;
  const soil = mixColour(p.ground[1], p.bark[0], 0.3);
  art.fillStyle(soil).fillRect(left, top, width, height);
  const brokenLeft = structure.variant % 2 === 0;
  for (let row = 0; row * 10 < height; row++) for (let col = 0; col * 12 < width; col++) {
    const x = col * 12;
    const y = row * 10;
    // One eroded corner makes the remaining courses read as a single old floor.
    const edgeX = brokenLeft ? x : width - x - 12;
    if (edgeX + (height - y) * 0.7 < 32) continue;
    const variant = grain(col, row, structure.variant);
    art.fillStyle(mixColour(p.path[variant % p.path.length], p.rock[1], 0.2), 0.88)
      .fillRect(left + x + 1, top + y + 1, Math.min(10, width - x - 1), Math.min(8, height - y - 1));
    art.fillStyle(p.rock[2], 0.14).fillRect(left + x + 2, top + y + 1, Math.min(8, width - x - 2), 1);
  }
  const mossX = brokenLeft ? left + 2 : left + width - 22;
  art.fillStyle(p.moss, 0.65).fillRect(mossX, top + height - 18, 18, 5).fillRect(mossX + 5, top + height - 27, 8, 12);
}

function wellCourt(art: Art, chunk: WorldChunk, structure: WorldStructure, p: WorldPalette) {
  const centerX = (structure.origin.x + structure.width / 2) * TILE_SIZE;
  const centerY = (structure.origin.y + structure.height / 2) * TILE_SIZE;
  const radiusX = structure.width * TILE_SIZE / 2 + 12;
  const radiusY = structure.height * TILE_SIZE / 2 + 10;
  const earth = mixColour(p.ground[1], p.bark[1], 0.5);
  for (let y = Math.max(0, structure.origin.y - 1) * TILE_SIZE; y < (structure.origin.y + structure.height + 1) * TILE_SIZE; y += 4) {
    for (let x = Math.max(0, structure.origin.x - 1) * TILE_SIZE; x < (structure.origin.x + structure.width + 1) * TILE_SIZE; x += 4) {
      const tileX = Math.floor(x / TILE_SIZE);
      const tileY = Math.floor(y / TILE_SIZE);
      if (tileX >= chunk.size || tileY >= chunk.size) continue;
      const inside = tileX >= structure.origin.x && tileX < structure.origin.x + structure.width && tileY >= structure.origin.y && tileY < structure.origin.y + structure.height;
      if (!inside && !chunk.tiles[tileY * chunk.size + tileX].walkable) continue;
      const distance = ((x + 2 - centerX) / radiusX) ** 2 + ((y + 2 - centerY) / radiusY) ** 2;
      if (distance > 1) continue;
      art.fillStyle(earth, Math.min(0.85, (1 - distance) * 3)).fillRect(x, y, 4, 4);
      if (distance > 0.58 && distance < 0.82 && grain(x, y, 11) % 3 === 0) art.fillStyle(p.path[1], 0.75).fillRect(x, y, 4, 3);
    }
  }
  const approach = structure.approach;
  if (chunk.tiles[approach.y * chunk.size + approach.x]?.walkable) {
    const x = approach.x * TILE_SIZE;
    const y = approach.y * TILE_SIZE;
    for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
      art.fillStyle(p.path[(row + col) % p.path.length], 0.9).fillRect(x + 5 + col * 7, y + 10 + row * 6, 6, 5);
      art.fillStyle(p.rock[2], 0.2).fillRect(x + 6 + col * 7, y + 10 + row * 6, 4, 1);
    }
  }
}

/** Floors describe the existing footprint; they never create obstacles or new rooms. */
export function drawStructureFloors(art: Art, chunk: WorldChunk, palette: WorldPalette) {
  for (const structure of chunk.structures) {
    if (structure.kind === 'house') houseFloor(art, structure, palette);
    else if (structure.kind === 'ruin') ruinFloor(art, structure, palette);
    else wellCourt(art, chunk, structure, palette);
  }
}
