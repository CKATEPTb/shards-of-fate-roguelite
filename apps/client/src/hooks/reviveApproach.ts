import { canReviveCoopActor, getCoopBattle, isBodyAlive, reviveApproachPosition } from '@shards/game-core';
import type { CoopState, GridPoint } from '@shards/shared';

export interface ReviveApproach {
  targetActorId: string;
  chunkId: string;
  position: GridPoint;
  targetPosition: GridPoint;
  transitions: number;
  expectedReviveUntilTick: number;
}
type RevivePlan = { type: 'unavailable'; reason: string } | { type: 'revive' | 'approach'; approach: ReviveApproach };
const samePosition = (left: GridPoint, right: GridPoint) => left.x === right.x && left.y === right.y;
const adjacent = (left: GridPoint, right: GridPoint) => Math.abs(left.x - right.x) + Math.abs(left.y - right.y) <= 1;

/** Capture this corpse, not just a hero ID that may refer to a later death. */
export function planReviveApproach(state: CoopState, actorId: string, targetActorId: string): RevivePlan {
  const actor = state.actors.find(candidate => candidate.id === actorId);
  const target = state.actors.find(candidate => candidate.id === targetActorId);
  if (!actor?.body || !isBodyAlive(actor.body) || getCoopBattle(state, actorId) || actorId === targetActorId
    || !target || target.chunkId !== actor.chunkId || !canReviveCoopActor(state, targetActorId)) {
    return { type: 'unavailable', reason: 'Сейчас нельзя поднять этого союзника.' };
  }
  const position = reviveApproachPosition(state, actorId, targetActorId);
  if (!position) return { type: 'unavailable', reason: 'К телу союзника нет прохода. Нужен другой путь.' };
  const approach: ReviveApproach = {
    targetActorId, chunkId: actor.chunkId, position: { ...position }, targetPosition: { ...target.position },
    transitions: actor.transitions, expectedReviveUntilTick: target.reviveUntilTick!,
  };
  return { type: !actor.path.length && adjacent(actor.position, target.position) ? 'revive' : 'approach', approach };
}

/** Predicted arrival never bypasses the host's adjacency and stopped-route checks. */
export function reviveApproachReadiness(approach: ReviveApproach, state: CoopState, actorId: string, confirmed?: CoopState | null): 'cancel' | 'wait' | 'ready' {
  const actor = state.actors.find(candidate => candidate.id === actorId);
  const target = state.actors.find(candidate => candidate.id === approach.targetActorId);
  if (!actor?.body || !isBodyAlive(actor.body) || getCoopBattle(state, actorId)
    || actor.chunkId !== approach.chunkId || actor.transitions !== approach.transitions
    || !target || target.chunkId !== approach.chunkId || !samePosition(target.position, approach.targetPosition)
    || target.reviveUntilTick !== approach.expectedReviveUntilTick || !canReviveCoopActor(state, target.id)) return 'cancel';
  const destination = actor.path.at(-1);
  if (destination) return samePosition(destination, approach.position) ? 'wait' : 'cancel';
  if (!samePosition(actor.position, approach.position) || !adjacent(actor.position, target.position)) return 'cancel';
  if (confirmed === undefined) return 'ready';
  if (!confirmed) return 'wait';
  const authoritativeActor = confirmed.actors.find(candidate => candidate.id === actorId);
  const authoritativeTarget = confirmed.actors.find(candidate => candidate.id === approach.targetActorId);
  if (!authoritativeActor || !authoritativeTarget) return 'wait';
  if (confirmed.failed || confirmed.completed || getCoopBattle(confirmed, actorId)
    || !authoritativeActor.body || !isBodyAlive(authoritativeActor.body)
    || authoritativeTarget.reviveUntilTick !== approach.expectedReviveUntilTick
    || !canReviveCoopActor(confirmed, authoritativeTarget.id)) return 'cancel';
  return authoritativeActor.chunkId === approach.chunkId && authoritativeTarget.chunkId === approach.chunkId
    && authoritativeActor.transitions === approach.transitions && !authoritativeActor.path.length
    && samePosition(authoritativeActor.position, approach.position)
    && samePosition(authoritativeTarget.position, approach.targetPosition)
    && adjacent(authoritativeActor.position, authoritativeTarget.position) ? 'ready' : 'wait';
}
