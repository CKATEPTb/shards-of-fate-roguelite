import { BODY_PARTS, type CoopEvent, type CoopState } from '@shards/shared';
import { isBodyAlive } from '../anatomy/body';
import { distance, tileIndex } from '../world/grid';
import { coopChunk } from './world';

export const CAMPFIRE_LIFETIME_TICKS = 4500;
export const CAMPFIRE_HEAL_TICKS = 375;

function visible(state: CoopState, actor: CoopState['actors'][number], target: { x: number; y: number }): boolean {
  const chunk = coopChunk(state.seed, actor.chunkId, state.worldVersion ?? 2);
  const dx = target.x - actor.position.x, dy = target.y - actor.position.y;
  if (dx * dx + dy * dy > 100) return false;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 1; i < steps; i++) {
    const p = { x: Math.round(actor.position.x + dx * i / steps), y: Math.round(actor.position.y + dy * i / steps) };
    if (!chunk.tiles[tileIndex(p, chunk.size)]?.walkable) return false;
  }
  return true;
}

export function discoverCampfires(state: CoopState, events: CoopEvent[]): CoopState {
  if (!state.progression) return state;
  const campfires = { ...state.progression.campfires };
  let changed = false;
  for (const actor of state.actors) {
    if (actor.body && !isBodyAlive(actor.body)) continue;
    for (const poi of coopChunk(state.seed, actor.chunkId, state.worldVersion ?? 2).pois) {
      if (poi.kind !== 'campfire' || campfires[poi.id] || !visible(state, actor, poi.position)) continue;
      campfires[poi.id] = { litAtTick: state.tick, expiresAtTick: state.tick + CAMPFIRE_LIFETIME_TICKS };
      events.push({ type: 'campfire-lit', poiId: poi.id, tick: state.tick }); changed = true;
    }
  }
  return changed ? { ...state, progression: { ...state.progression, campfires } } : state;
}

/** Both prediction and host call this on the same absolute ticks; no healing packets. */
export function advanceCampfireHealing(state: CoopState): CoopState {
  if (!state.progression) return state;
  let changed = false;
  const actors = state.actors.map(actor => {
    if (!actor.body || !isBodyAlive(actor.body) || actor.path.length || state.battles.some(battle => battle.actorIds.includes(actor.id)
      && !battle.combat.units.some(unit => unit.definitionId === actor.id && unit.escaped))) return actor;
    const fire = coopChunk(state.seed, actor.chunkId, state.worldVersion ?? 2).pois.find(poi => poi.kind === 'campfire'
      && state.progression!.campfires[poi.id]?.expiresAtTick > state.tick && distance(poi.position, actor.position) <= 2
      && visible(state, actor, poi.position));
    if (!fire) return actor;
    const body = { ...actor.body };
    let healed = false;
    for (const part of BODY_PARTS) {
      const resource = body[part];
      if (resource.lost || resource.current >= resource.max) continue;
      // Spread integer healing over fifteen seconds, including the negative attached range.
      const capacity = Math.ceil(resource.max * 1.5);
      const amount = Math.floor(state.tick * capacity / CAMPFIRE_HEAL_TICKS) - Math.floor((state.tick - 1) * capacity / CAMPFIRE_HEAL_TICKS);
      if (amount) { body[part] = { ...resource, current: Math.min(resource.max, resource.current + amount) }; healed = true; }
    }
    changed ||= healed;
    return healed ? { ...actor, body } : actor;
  });
  return changed ? { ...state, actors } : state;
}
