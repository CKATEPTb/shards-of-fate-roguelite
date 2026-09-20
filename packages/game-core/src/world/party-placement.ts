import type { GridPoint, WorldActor, WorldChunk } from '@shards/shared';
import { DELTAS, isWalkable } from './grid';
import { createMovementState } from './movement-speed';

function placeActors(chunk: WorldChunk, ids: string[], positions: GridPoint[], previousActors: WorldActor[] = []): WorldActor[] {
  return ids.map((id, index) => {
    const position = positions[index];
    if (!position || !isWalkable(chunk, position) || position.x <= 0 || position.y <= 0
      || position.x >= chunk.size - 1 || position.y >= chunk.size - 1) throw new Error('No safe party position');
    const previous = previousActors.find(actor => actor.id === id);
    return { ...previous, id, position: { ...position }, path: [], movement: { ...(previous?.movement ?? createMovementState()), elapsedMs: 0 } };
  });
}

/** Party order fills the four ground tiles around the fire: north, west, east, south. */
export function placePartyAtCampfire(chunk: WorldChunk, ids: string[]): WorldActor[] {
  const campfire = chunk.pois.find(poi => poi.kind === 'campfire');
  if (!campfire) throw new Error('Starting chunk has no campfire');
  const positions = [DELTAS.north, DELTAS.west, DELTAS.east, DELTAS.south]
    .map(delta => ({ x: campfire.position.x + delta.x, y: campfire.position.y + delta.y }));
  return placeActors(chunk, ids, positions);
}

/** Heroes can share a tile; arriving one step inside the gate avoids an immediate return. */
export function placePartyAtEntrance(chunk: WorldChunk, actors: WorldActor[], origin: GridPoint): WorldActor[] {
  return placeActors(chunk, actors.map(actor => actor.id), actors.map(() => origin), actors);
}
