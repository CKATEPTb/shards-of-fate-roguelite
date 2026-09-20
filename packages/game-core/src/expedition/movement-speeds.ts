import type { ExplorationState, GameContent, WorldActor } from '@shards/shared';
import { createMovementState } from '../world/movement-speed';

/** Supply content defaults to old saves and live states without overwriting item bonuses. */
export function initializeMovementSpeeds(world: ExplorationState, content: GameContent): ExplorationState {
  if (world.actors.every(actor => actor.movement)) return world;
  return {
    ...world,
    actors: world.actors.map(actor => actor.movement ? actor : {
      ...actor,
      movement: createMovementState(content.characters.find(character => character.id === actor.id)?.movementSpeed),
    }),
  };
}

export function resetMovementProgress<T extends WorldActor>(actor: T): T {
  return actor.movement?.elapsedMs ? { ...actor, movement: { ...actor.movement, elapsedMs: 0 } } : actor;
}
