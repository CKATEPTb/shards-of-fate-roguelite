import type { GridPoint, RoamingGroup, Terrain, WorldActor, WorldChunk } from '@shards/shared';
import { createMovementState } from '../../packages/game-core/src/world/movement-speed';

export function roamingChunk(size = 35): WorldChunk {
  return { id: '0,0', size, season: 'spring', spawn: { x: Math.floor(size / 2), y: Math.floor(size / 2) },
    exits: [], pois: [], structures: [], tiles: Array.from({ length: size * size }, (_, index) => {
      const x = index % size; const y = Math.floor(index / size);
      return x === 0 || y === 0 || x === size - 1 || y === size - 1
        ? { terrain: 'wall', walkable: false, movementCost: 1 } : { terrain: 'grass', walkable: true, movementCost: 1 };
    }) };
}

export function roamingHero(x: number, y: number, id = 'guardian'): WorldActor {
  return { id, position: { x, y }, path: [], movement: createMovementState() };
}

export function roamingGroup(id: string, positions: GridPoint[], overrides: Partial<RoamingGroup> = {}): RoamingGroup {
  return { id, category: 'normal', chases: false, home: positions[0], mode: 'patrol', targetActorId: null, decision: 0, pauseMs: 0,
    members: positions.map((position, index) => ({ id: `${id}:${index}`, definitionId: 'rat', position, path: [], movement: createMovementState() })),
    ...overrides };
}

export function paintRoamingTile(chunk: WorldChunk, x: number, y: number, terrain: Terrain): void {
  chunk.tiles[y * chunk.size + x] = { terrain, walkable: !['wall', 'rock', 'water', 'tree'].includes(terrain), movementCost: terrain === 'bush' ? 2 : 1 };
}
