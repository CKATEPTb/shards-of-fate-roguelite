import type { CoopActor, CoopEvent, CoopState, GameContent, GridPoint, RoamingMob, WorldActor } from '@shards/shared';
import { isBodyAlive } from '../anatomy';
import { isTerminal } from '../combat';
import { advanceActor } from '../world/movement';
import { createMovementState, MOVEMENT_TICK_MS, movementStepMs } from '../world/movement-speed';
import { findPath } from '../world/pathfinding';
import { DELTAS, isWalkable, samePoint, tileIndex } from '../world/grid';
import { placePartyAtEntrance } from '../world/party-placement';
import { coopChunk, ensureCoopChunk } from './world';
import { advanceCampfireHealing } from './campfire-runtime';

export function coopLocks(state: CoopState) {
  return {
    actors: new Set(state.battles.flatMap(battle => battle.actorIds.filter(id => !battle.combat.units.some(unit => unit.definitionId === id && unit.escaped)))),
    mobs: new Set(state.battles.flatMap(battle => battle.mobIds)),
  };
}

export function stopCoopActor<T extends WorldActor>(actor: T): T {
  return { ...actor, path: [], movement: { ...(actor.movement ?? createMovementState()), elapsedMs: 0 } };
}

export function motionEvent(actor: WorldActor, chunkId: string, groupId?: string): Extract<CoopEvent, { type: 'motion' }> {
  return { type: 'motion', entity: groupId ? 'mob' : 'actor', id: actor.id, chunkId,
    ...(groupId ? { groupId } : {}), from: { ...actor.position }, to: actor.path.length ? { ...actor.path[actor.path.length - 1] } : null,
    elapsedMs: actor.movement?.elapsedMs ?? 0 };
}

/** Both sides rebuild the same remaining route from a discontinuity's exact origin. */
export function rebuildMotion<T extends WorldActor>(actor: T, event: Extract<CoopEvent, { type: 'motion' }>, seed: string, structureVersion: 1 | 2 | 3 = 3): T {
  const chunk = coopChunk(seed, event.chunkId, structureVersion);
  if (!isWalkable(chunk, event.from) || event.to && !isWalkable(chunk, event.to)) throw new Error('Invalid motion position');
  const path = event.to ? findPath(chunk, event.from, event.to, actor) : [];
  if (event.to && !path.length && !samePoint(event.from, event.to)) throw new Error('Unreachable motion destination');
  const movement = actor.movement ?? createMovementState();
  const duration = path.length ? movementStepMs(actor, chunk.tiles[tileIndex(path[0], chunk.size)].terrain) : 0;
  return { ...actor, position: { ...event.from }, path,
    movement: { ...movement, elapsedMs: path.length ? Math.max(0, Math.min(event.elapsedMs, duration * (1 - Number.EPSILON))) : 0 } };
}

export function sameMotion(a: WorldActor, b: WorldActor): boolean {
  return samePoint(a.position, b.position) && (a.movement?.elapsedMs ?? 0) === (b.movement?.elapsedMs ?? 0)
    && a.path.length === b.path.length && a.path.every((point, index) => samePoint(point, b.path[index]));
}

/** No AI, RNG, gate transitions or encounter detection. Only known routes and clocks. */
export function advanceCoopTo(state: CoopState, tick: number, _content: GameContent): CoopState {
  if (!Number.isSafeInteger(tick) || tick < state.tick) throw new Error('Co-op ticks must advance monotonically');
  if (tick - state.tick > 90_000) throw new Error('Co-op clock is too far ahead; request a fresh snapshot');
  if (state.completed || state.failed && !state.battles.length) return state;
  for (; state.tick < tick;) {
    const locks = coopLocks(state);
    const activeChunks = new Set(state.actors.filter(actor => !locks.actors.has(actor.id) && (!actor.body || isBodyAlive(actor.body))).map(actor => actor.chunkId));
    const actors = state.actors.map(actor => locks.actors.has(actor.id) ? actor : advanceActor(actor, coopChunk(state.seed, actor.chunkId, state.worldVersion ?? 2), MOVEMENT_TICK_MS) as CoopActor);
    const groups = { ...state.groups };
    for (const chunkId of activeChunks) {
      const chunk = coopChunk(state.seed, chunkId, state.worldVersion ?? 2);
      groups[chunkId] = (groups[chunkId] ?? []).map(group => {
        if (!group.members.some(mob => !locks.mobs.has(mob.id))) return group;
        const pauseMs = Math.max(0, group.pauseMs - MOVEMENT_TICK_MS);
        if (group.mode === 'patrol' && group.pauseMs > 0) return { ...group, pauseMs };
        return { ...group, pauseMs, members: group.members.map(mob => locks.mobs.has(mob.id) ? mob : advanceActor(mob, chunk, MOVEMENT_TICK_MS) as RoamingMob) };
      });
    }
    const battles = state.battles.map(battle => !battle.combat.pendingActorId && !isTerminal(battle.combat)
      ? { ...battle, elapsedMs: battle.elapsedMs + MOVEMENT_TICK_MS } : battle);
    // The room has one seasonal clock: any ongoing encounter pauses it for
    // everyone, including heroes exploring other chunks. Replayed clock ticks
    // shift the deadline identically without broadcasting countdown updates.
    const bosses = state.battles.length && state.bosses?.nextAtTick != null
      ? { ...state.bosses, nextAtTick: state.bosses.nextAtTick + 1 } : state.bosses;
    state = advanceCampfireHealing({ ...state, tick: state.tick + 1, actors, groups, battles, bosses });
  }
  return state;
}

export function enterCoopChunk(state: CoopState, actorId: string, chunkId: string, position: GridPoint, content: GameContent): CoopState {
  const chunk = coopChunk(state.seed, chunkId, state.worldVersion ?? 2);
  if (!isWalkable(chunk, position)) throw new Error('Invalid co-op arrival');
  state = ensureCoopChunk(state, chunkId, content);
  const actors = state.actors.map(actor => actor.id !== actorId ? actor : {
    ...stopCoopActor(actor), position: { ...position }, chunkId,
    visited: actor.visited.includes(chunkId) ? actor.visited : [...actor.visited, chunkId], transitions: actor.transitions + 1,
  });
  // Vacated chunks need only their killed IDs. Re-entering regenerates the
  // surviving population, while occupied chunks retain exact live movement.
  const occupied = new Set([...actors.map(actor => actor.chunkId), ...state.battles.map(battle => battle.chunkId),
    ...(state.bosses?.spawned ?? []).filter(boss => !state.killedEnemyIds.includes(boss.mobId)).map(boss => boss.chunkId)]);
  const groups = Object.fromEntries(Object.entries(state.groups).filter(([id]) => occupied.has(id)));
  return { ...state, actors, groups };
}

export function resolveCoopGates(state: CoopState, content: GameContent, events: CoopEvent[], regeneratedChunks = new Set<string>()): CoopState {
  const locks = coopLocks(state);
  for (const actor of state.actors) {
    if (locks.actors.has(actor.id) || actor.body && !isBodyAlive(actor.body)) continue;
    const chunk = coopChunk(state.seed, actor.chunkId, state.worldVersion ?? 2);
    const exit = chunk.exits.find(candidate => samePoint(candidate.position, actor.position));
    if (!exit) continue;
    const destination = coopChunk(state.seed, exit.targetNodeId, state.worldVersion ?? 2);
    const gate = destination.exits.find(candidate => candidate.id === exit.returnGateId);
    if (!gate || gate.returnGateId !== exit.id || gate.targetNodeId !== actor.chunkId) throw new Error('Missing reciprocal co-op gate');
    const delta = DELTAS[exit.direction];
    const position = placePartyAtEntrance(destination, [actor], { x: gate.position.x + delta.x, y: gate.position.y + delta.y })[0].position;
    if (!state.groups[destination.id]) regeneratedChunks.add(destination.id);
    state = enterCoopChunk(state, actor.id, destination.id, position, content);
    events.push({ type: 'chunk-enter', actorId: actor.id, fromChunkId: actor.chunkId, chunkId: destination.id, position });
  }
  return state;
}
