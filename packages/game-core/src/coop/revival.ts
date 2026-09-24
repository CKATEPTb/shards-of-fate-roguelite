import { BODY_PARTS, type CoopState, type GridPoint } from '@shards/shared';
import { cloneHeroBody, isBodyAlive } from '../anatomy/body';
import { distance, isWalkable, neighbors, samePoint, tileIndex } from '../world/grid';
import { findPath } from '../world/pathfinding';
import { MOVEMENT_TICK_MS } from '../world/movement-speed';
import { getCoopBattle } from './battles';
import { stopCoopActor } from './movement';
import { coopChunk } from './world';

export const COOP_REVIVE_WINDOW_MS = 180_000;
export const COOP_REVIVE_WINDOW_TICKS = COOP_REVIVE_WINDOW_MS / MOVEMENT_TICK_MS;

export function canReviveCoopActor(state: CoopState, targetActorId: string): boolean {
  const target = state.actors.find(actor => actor.id === targetActorId);
  return state.characterIds.length > 1 && !state.failed && !state.completed && !!target?.body && !isBodyAlive(target.body)
    && target.reviveUntilTick !== undefined && state.tick < target.reviveUntilTick && !getCoopBattle(state, targetActorId);
}

/** Find an adjacent reachable tile without stepping onto a chunk gate on the way. */
export function reviveApproachPosition(state: CoopState, actorId: string, targetActorId: string): GridPoint | undefined {
  const actor = state.actors.find(actor => actor.id === actorId), target = state.actors.find(actor => actor.id === targetActorId);
  if (!actor || !target || actor.id === target.id || actor.chunkId !== target.chunkId || !canReviveCoopActor(state, targetActorId)) return;
  const chunk = coopChunk(state.seed, actor.chunkId, state.worldVersion ?? 2);
  if (distance(actor.position, target.position) <= 1) return { ...actor.position };
  const gates = new Set(chunk.exits.map(exit => tileIndex(exit.position, chunk.size)));
  const candidates = [...neighbors(target.position, chunk.size), target.position].filter(point => isWalkable(chunk, point) && !gates.has(tileIndex(point, chunk.size)))
    .flatMap(point => {
      const path = findPath(chunk, actor.position, point, actor);
      return path.length || samePoint(actor.position, point) ? [{ point, length: path.length }] : [];
    }).sort((a, b) => a.length - b.length || a.point.y - b.point.y || a.point.x - b.point.x);
  return candidates[0]?.point;
}

/** The command names this death's deadline, so delayed input cannot raise a later corpse. */
export function reviveCoopActor(state: CoopState, actorId: string, chunkId: string, targetActorId: string, expectedReviveUntilTick: number): CoopState {
  const actor = state.actors.find(actor => actor.id === actorId), target = state.actors.find(actor => actor.id === targetActorId);
  if (!actor || !target || actorId === targetActorId || state.failed || state.completed || !actor.body || !isBodyAlive(actor.body)
    || getCoopBattle(state, actorId)) throw new Error('Сейчас нельзя поднять союзника.');
  if (actor.chunkId !== chunkId || target.chunkId !== chunkId || actor.path.length || distance(actor.position, target.position) > 1) throw new Error('Сначала подойдите к телу союзника.');
  if (target.reviveUntilTick === undefined && target.body && isBodyAlive(target.body)) return state;
  if (target.reviveUntilTick !== expectedReviveUntilTick || !canReviveCoopActor(state, targetActorId)) throw new Error('Время на воскрешение уже истекло.');
  const body = cloneHeroBody(target.body!);
  for (const part of BODY_PARTS) body[part] = { ...body[part], lost: false, current: part === 'head' || part === 'torso' ? 0 : 1 };
  const { reviveUntilTick: _deadline, ...revived } = target;
  return { ...state, actors: state.actors.map(hero => hero.id === targetActorId ? { ...stopCoopActor(revived), body } : hero) };
}
