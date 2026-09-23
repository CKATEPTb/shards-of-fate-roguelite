import type { GridPoint, WorldChunk, WorldGraph, WorldNode, WorldPoi } from '@shards/shared';
import { createRng, hashString } from '../random';
import { makeTile, paint } from './carving';
import { CHUNK_SIZE, samePoint } from './grid';
import { worldDie } from './generation-dice';
import { validateChunk } from './validation';

interface StoreRoom { x: number; y: number; width: number; height: number }

/** Cellars use a separate stream, and their floor plan has no edge exits into surface terrain. */
export function buildBasementChunk(graph: WorldGraph, node: WorldNode, entrance: WorldPoi, encounterId: string): WorldChunk {
  const id = entrance.destination!.chunkId;
  const rng = createRng(`basement-v3:${hashString(graph.seed)}:${id}`);
  const entry = { x: 17, y: 29 };
  const chunk: WorldChunk = {
    id, layer: 'basement', surfaceNodeId: node.id, season: node.season, size: CHUNK_SIZE,
    tiles: Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, () => makeTile('rock')),
    spawn: { ...entry }, exits: [], structures: [], pois: [
      { id: `${id}:stairs-up`, kind: 'stairs-up', position: { ...entry },
        destination: { chunkId: node.id, poiId: entrance.id } },
      { id: `${id}:encounter`, kind: 'encounter', position: { x: 17, y: 11 }, encounterId },
    ],
  };
  const floor = (room: StoreRoom) => {
    for (let y = room.y; y < room.y + room.height; y++) for (let x = room.x; x < room.x + room.width; x++) paint(chunk, { x, y }, 'path');
  };
  floor({ x: 16, y: 6, width: 3, height: 24 });
  const rooms: StoreRoom[] = [{ x: 12, y: 3, width: 11, height: 6 }];
  const roomCount = 2 + worldDie(rng, 3);
  const positions = [{ x: 3, y: 11 }, { x: 23, y: 11 }, { x: 3, y: 22 }, { x: 23, y: 22 }];
  const rotate = worldDie(rng, positions.length) - 1;
  for (let index = 0; index < roomCount - 1; index++) {
    const origin = positions[(index + rotate) % positions.length];
    const width = 7 + worldDie(rng, 3), height = 5 + worldDie(rng, 3);
    const room = { x: origin.x, y: origin.y - (worldDie(rng, 2) - 1), width, height };
    rooms.push(room);
    const passageY = room.y + Math.floor(height / 2);
    const startX = room.x < 17 ? room.x + room.width - 1 : 17;
    const endX = room.x < 17 ? 17 : room.x;
    floor({ x: startX, y: passageY, width: endX - startX + 1, height: 2 });
  }
  rooms.forEach((room, ordinal) => {
    floor(room);
    // Freestanding shelves leave a complete aisle along every wall and through each doorway.
    const shelves = room.height >= 8 ? 2 : 1;
    for (let row = 0; row < shelves; row++) {
      const y = room.y + 2 + row * 3;
      const gap = room.x + 2 + worldDie(rng, room.width - 4) - 1;
      for (let x = room.x + 2; x < room.x + room.width - 2; x++) if (x !== gap) paint(chunk, { x, y }, 'rock');
    }
    const corners: GridPoint[] = [{ x: room.x + 1, y: room.y + 1 },
      { x: room.x + room.width - 2, y: room.y + room.height - 2 }];
    const count = worldDie(rng, 3) === 3 ? 2 : 1;
    for (let index = 0; index < count; index++) {
      const position = corners[index];
      if (chunk.pois.some(poi => samePoint(poi.position, position))) continue;
      paint(chunk, position, 'path');
      chunk.pois.push({ id: `${id}:store:${ordinal}:chest:${index}`, kind: 'chest', position });
    }
  });
  const result = validateChunk(chunk);
  if (!result.valid) throw new Error(`Basement generation invariant failed at ${id}: ${result.errors.join('; ')}`);
  return chunk;
}
