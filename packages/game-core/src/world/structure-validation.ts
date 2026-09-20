import type { WorldChunk } from '@shards/shared';
import { inBounds, isWalkable, samePoint, tileIndex } from './grid';
import { withinStructure } from './structures';

export function validateStructures(chunk: WorldChunk): string[] {
  const errors: string[] = []; const ids = new Set<string>(); const occupied = new Set<number>();
  for (const structure of chunk.structures) {
    if (!structure.id || ids.has(structure.id) || !['house', 'ruin', 'well'].includes(structure.kind)
      || !Number.isInteger(structure.width) || !Number.isInteger(structure.height) || structure.width < 1 || structure.height < 1 || structure.width > 8 || structure.height > 8
      || !Number.isInteger(structure.variant) || structure.variant < 0 || structure.variant > 3
      || !inBounds(structure.origin, chunk.size) || !inBounds({ x: structure.origin.x + structure.width - 1, y: structure.origin.y + structure.height - 1 }, chunk.size)
      || !isWalkable(chunk, structure.approach) || withinStructure(structure.approach, structure)
      || !structure.blockedCells.length) { errors.push('Invalid structure'); continue; }
    ids.add(structure.id);
    for (const point of structure.blockedCells) {
      const index = tileIndex(point, chunk.size);
      if (!inBounds(point, chunk.size) || !withinStructure(point, structure) || occupied.has(index)
        || chunk.tiles[index]?.terrain !== 'wall' || chunk.tiles[index]?.walkable
        || chunk.exits.some(exit => samePoint(exit.position, point)) || chunk.pois.some(poi => samePoint(poi.position, point))) errors.push('Invalid structure footprint');
      occupied.add(index);
    }
  }
  if (chunk.tiles.some((tile, index) => tile.terrain === 'wall' && !occupied.has(index))) errors.push('Wall without a structure');
  return errors;
}
