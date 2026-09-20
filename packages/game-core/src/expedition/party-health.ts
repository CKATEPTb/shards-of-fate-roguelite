import type { CombatState, ExplorationState, GameContent, HeroBody, WorldActor } from '@shards/shared';
import { isBodyAlive, startHeroBody } from '../anatomy';

/** Old worlds gain anatomy once; later encounters must reuse these exact wounds. */
export function initializePartyBodies(world: ExplorationState, content: GameContent): ExplorationState {
  if (world.actors.every(actor => actor.body)) return world;
  return { ...world, actors: world.actors.map(actor => actor.body ? actor : {
    ...actor, body: startHeroBody(content.characters.find(character => character.id === actor.id)!),
  }) };
}

export function partyBodies(actors: readonly WorldActor[]): Record<string, HeroBody> {
  return Object.fromEntries(actors.filter(actor => actor.body).map(actor => [actor.id, actor.body!]));
}

export function livingActors(actors: readonly WorldActor[]): WorldActor[] {
  return actors.filter(actor => !actor.body || isBodyAlive(actor.body));
}

/** Battle is authoritative until it finishes; the world then takes ownership again. */
export function carryBattleWounds(world: ExplorationState, combat: CombatState): ExplorationState {
  return { ...world, actors: world.actors.map(actor => {
    const body = combat.units.find(unit => unit.team === 'heroes' && unit.definitionId === actor.id)?.body;
    return { ...actor, ...(body ? { body: structuredClone(body) } : {}), path: [],
      ...(actor.movement ? { movement: { ...actor.movement, elapsedMs: 0 } } : {}) };
  }) };
}
